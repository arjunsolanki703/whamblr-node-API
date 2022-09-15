"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
// const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { ServiceBroker } = require("moleculer");
const DbService = require("../mixins/db.mixin");
const broker = new ServiceBroker({ nodeID: "node-27" });
var ReadableData = require('stream').Readable;
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");

var ObjectId = require('mongodb').ObjectID;
const _const = require("../constant");
/**
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 */

module.exports = {
    name: "post",
    mixins: [DbService("post")],

    /**
     * Settings
     */
    settings: {
        /** Public fields */
        fields: ["_id", "firebaseID", "postMedia", "location", "basePostID", "shareText", "like", "dislike", "likeFirebaseIDs", "dislikeFirebaseIDs", "muteUsers"],
        /** Validator schema for entity */
        entityValidator: {
            firebaseID: { type: "string" }
        }
    },

    /**
     * Dependencies
     */
    dependencies: [
        "user"
    ],

    /**
     * Actions
     */
    actions: {
        /**
         * Register a new user
         *
         * @actions
         * @param {Object} user - User entity
         *
         * @returns {Object} Mongo User _id
         */
        create: {
            params: {
                data: { type: "object" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.data;
                await this.validateEntity(entity);

                let temp = entity;

                let postUser = await ctx.call("user.findFirebaseID", { firebaseID: entity.firebaseID });

                let post_fireuserName = '';
                let post_fireuserAvatar = '';

                if (postUser["result"].length > 0) {
                    post_fireuserName = postUser["result"][0]["fullname"];
                    post_fireuserAvatar = postUser["result"][0]["avatar"];
                }



                if (entity.shareType == 'group') {
                    var groupsID = entity.groupID;
                    var setgroupID = [];
                    setgroupID = groupsID.split(',');

                    for (var k = 0; k < setgroupID.length; k++) {

                        if (entity.postMedia) {
                            if (entity.postMedia.length > 0) {
                                for (var i = 0; i < entity.postMedia.length; i++) {
                                    var uniqueID = this.getUniqueMediaID(20);
                                    entity.postMedia[i].mediaID = uniqueID;
                                }
                            }
                        }
                        entity.groupID = setgroupID[k];
                        entity.createdAt = new Date();
                        entity.updatedAt = entity.createdAt;

                        const data = await this.adapter.insert(entity);
                        const post = await this.transformDocuments(ctx, {}, data);
                        var postEntity = await this.entityChanged("created", post, ctx).then(() => post);

                    }

                    return { status: 200, message: "success" };

                } else {

                    if (entity.postMedia) {
                        if (entity.postMedia.length > 0) {
                            for (var i = 0; i < entity.postMedia.length; i++) {
                                var uniqueID = this.getUniqueMediaID(20);
                                entity.postMedia[i].mediaID = uniqueID;
                            }
                        }
                    }

                    entity.createdAt = new Date();
                    entity.updatedAt = entity.createdAt;

                    const data = await this.adapter.insert(entity);
                    const post = await this.transformDocuments(ctx, {}, data);
                    var postEntity = await this.entityChanged("created", post, ctx).then(() => post);

                    if (temp.postMedia.length > 0) {
                        for (let i = 0; i < temp.postMedia.length; i++) {
                            let options = temp.postMedia[i].options;
                            if (options != null) {
                                let _userTag = options.userTags;
                                if (_userTag != null) {
                                    for (let x = 0; x < _userTag.length; x++) {
                                        let firebaseID = _userTag[x].firebaseID;
                                        let tagUser = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });

                                        let noti_data = {
                                            TofirebaseID: firebaseID,
                                            FromfirebaseID: entity.firebaseID,
                                            type: "tag post",
                                            msg: post_fireuserName + " tagged you in post",
                                            read: false,
                                            details: {
                                                fireuserName: post_fireuserName,
                                                fireuserAvatar: post_fireuserAvatar
                                            },
                                            createdAt: new Date()
                                        };
                                        let noti = await ctx.call("notification.create", { data: noti_data });
                                        const badge = await ctx.call("notification.badge", { firebaseID: firebaseID });

                                        let playerID = [];
                                        playerID.push(tagUser["result"][0]["pushId"]);
                                        let message = {
                                            app_id: _const.appId,
                                            ios_badgeType: "SetTo",
                                            ios_badgeCount: badge.count,
                                            contents: { "en": post_fireuserName + " tagged you in post" },
                                            include_player_ids: playerID,
                                            data: { "type": "tagged", "firebaseID": entity.firebaseID, "postID": data._id }
                                        }
                                        if (tagUser["result"][0].mute) {
                                            if (!tagUser["result"][0].mute.includes(entity.firebaseID)) {
                                                _const.sendNotification(message);
                                            }
                                        } else {
                                            _const.sendNotification(message);
                                        }
                                    }
                                }
                            }

                        }
                    }

                    console.log("Post", postEntity);

                    return { status: 200, message: "success" };
                }
            },
        },
        update: {
            params: {
                data: { type: "object" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.data;
                await this.validateEntity(entity);

                //entity.createdAt = new Date();
                //entity.updatedAt = entity.createdAt;
                //const doc = await this.adapter.insert(entity);
                //const post = await this.transformDocuments(ctx, {}, doc);
                //var postEntity = await this.entityChanged("created", post, ctx).then(() => post);

                var postID = entity._id;
                console.log("Post ID", postID);
                var temp = await this.adapter.findOne({ _id: new ObjectId(postID) });
                console.log("Post", temp);

                if (temp != undefined && temp._id != null && temp._id != "") {
                    console.log("ID", temp._id);
                    delete entity._id;
                    var newPost = entity;
                    newPost.updatedAt = new Date();
                    const data = await this.adapter.updateById(temp._id, { $set: newPost });
                    const post = await this.transformDocuments(ctx, {}, data);
                    var postEntity = await this.entityChanged("updated", post, ctx).then(() => post);
                    return { status: 200, message: "success" };
                }
            },
        },
        delete: {
            params: {
                postID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var pid = ctx.params.postID;

                var callsharectxdata = await this.broker.call("post.getSharePosts", { basePostID: pid });
                if (callsharectxdata["result"].length > 0) {
                    // loop and remove all post and related data
                    for (var j = 0; j < callsharectxdata["result"].length; j++) {
                        var shareid = callsharectxdata["result"][j]["_id"];
                        var deletesfavctxdata = await this.broker.call("favoritespost.deleteByPost", { postID: shareid });
                        var deleteslikectxdata = await this.broker.call("likepost.deleteByPost", { postID: shareid });
                        var deletesviewctxdata = await this.broker.call("postviewed.deleteByPost", { postID: shareid });
                        var deletescommentctxdata = await this.broker.call("postcomment.deleteByPost", { postID: shareid });
                        var deletesharectxdata = await this.adapter.removeById(shareid);
                    }
                }
                var deletepfavctxdata = await this.broker.call("favoritespost.deleteByPost", { postID: pid });
                var deleteplikectxdata = await this.broker.call("likepost.deleteByPost", { postID: pid });
                var deletepviewctxdata = await this.broker.call("postviewed.deleteByPost", { postID: pid });
                var deletepcommentctxdata = await this.broker.call("postcomment.deleteByPost", { postID: pid });


                var deletedEntity = await this.adapter.removeById(pid);
                if (deletedEntity)
                    return { status: 200, message: "Post deleted successfully!" };
                else
                    return { status: 201, message: "Post delete failed!" };

            },
        },
        deleted: {
            params: {
                postID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.postID;

                var deletedEntity = await this.adapter.removeById(entity);

                if (deletedEntity)
                    return { status: 200, message: "Post deleted successfully!" };
                else
                    return { status: 201, message: "Post delete failed!" };

            },
        },
        share: {
            params: {
                postID: { type: "string" },
                firebaseID: { type: "string" },
                groupID: { type: "string" },
                chatID: { type: "string" },
                shareType: { type: "string" },
                shareText: { type: "string" }
            },
            async handler(ctx) {


                let entity = ctx.params.postID;
                console.log("entity", entity);
                var shareType = ctx.params.shareType;
                var setsharetype = [];
                setsharetype = shareType.split(',');

                var tempEntity = await this.adapter.findOne({ _id: new ObjectId(entity) });


                let postUser = await ctx.call("user.findFirebaseID", { firebaseID: tempEntity.firebaseID });
                let shareUser = await ctx.call("user.findFirebaseID", { firebaseID: ctx.params.firebaseID });

                let share_fireuserName = '';
                let share_fireuserAvatar = '';

                if (shareUser["result"].length > 0) {
                    share_fireuserName = shareUser["result"][0]["fullname"];
                    share_fireuserAvatar = shareUser["result"][0]["avatar"];
                }
                if (tempEntity.isNotificationOff == undefined || !tempEntity.isNotificationOff) {
                    let noti_data = {
                        TofirebaseID: tempEntity.firebaseID,
                        FromfirebaseID: shareUser["result"][0]["firebaseID"],
                        type: "share",
                        msg: share_fireuserName + " shared your post",
                        read: false,
                        details: {
                            fireuserName: share_fireuserName,
                            fireuserAvatar: share_fireuserAvatar
                        },
                        createdAt: new Date()
                    };
                    let noti = await ctx.call("notification.create", { data: noti_data });
                    const badge = await ctx.call("notification.badge", { firebaseID: tempEntity.firebaseID });

                    let playerID = [];
                    playerID.push(postUser["result"][0]["pushId"]);
                    let message = {
                        app_id: _const.appId,
                        ios_badgeType: "SetTo",
                        ios_badgeCount: badge.count,
                        contents: { "en": share_fireuserName + " shared your post" },
                        include_player_ids: playerID,
                        data: { "type": "share", "postID": entity }
                    }
                    if (postUser["result"][0].mute) {
                        if (!postUser["result"][0].mute.includes(shareUser["result"][0]["firebaseID"])) {
                            _const.sendNotification(message);
                        }
                    } else {
                        _const.sendNotification(message);
                    }
                }
                for (var j = 0; j < setsharetype.length; j++) {
                    var currentshare = setsharetype[j];
                    if (currentshare == 'group') {
                        var groupsID = ctx.params.groupID;
                        var setgroupID = [];
                        setgroupID = groupsID.split(',');

                        for (var k = 0; k < setgroupID.length; k++) {
                            tempEntity._id = new ObjectId();
                            tempEntity.createdAt = new Date();
                            tempEntity.updatedAt = tempEntity.createdAt;
                            tempEntity.firebaseID = ctx.params.firebaseID;
                            tempEntity.shareType = currentshare;
                            tempEntity.groupID = setgroupID[k];
                            tempEntity.chatID = ctx.params.chatID;
                            tempEntity.shareText = ctx.params.shareText;
                            tempEntity.latestAction = '';
                            delete tempEntity.like;
                            delete tempEntity.dislike;
                            delete tempEntity.likeFirebaseIDs;
                            delete tempEntity.dislikeFirebaseIDs;
                            tempEntity.basePostID = ctx.params.postID;

                            // if (tempEntity.basePostID == null)

                            const doc = await this.adapter.insert(tempEntity);
                            const post = await this.transformDocuments(ctx, {}, doc);
                            var postEntity = await this.entityChanged("created", post, ctx).then(() => post);
                        }

                    } else {
                        tempEntity._id = new ObjectId();
                        tempEntity.createdAt = new Date();
                        tempEntity.updatedAt = tempEntity.createdAt;
                        tempEntity.firebaseID = ctx.params.firebaseID;
                        tempEntity.shareType = currentshare;
                        tempEntity.latestAction = '';
                        delete tempEntity.like;
                        delete tempEntity.dislike;
                        delete tempEntity.likeFirebaseIDs;
                        delete tempEntity.dislikeFirebaseIDs;

                        tempEntity.chatID = ctx.params.chatID;
                        tempEntity.shareText = ctx.params.shareText;

                        tempEntity.basePostID = ctx.params.postID;
                        // if (tempEntity.basePostID == null)

                        const doc = await this.adapter.insert(tempEntity);
                        const post = await this.transformDocuments(ctx, {}, doc);
                        var postEntity = await this.entityChanged("created", post, ctx).then(() => post);
                    }
                }

                return { status: 200, message: "success" };

            },
        },
        like: {
            params: {
                postID: { type: "string" },
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.postID;

                var temp = await this.adapter.findOne({ _id: new ObjectId(entity) });
                console.log("Post", temp);

                if (!temp.likeFirebaseIDs) {
                    temp.likeFirebaseIDs = [];
                    temp.likeFirebaseIDs.push(ctx.params.firebaseID);

                    if (!temp.like)
                        temp.like = 1;
                    else
                        temp.like++;

                }
                else {

                    console.log("Push index", temp.likeFirebaseIDs.indexOf(ctx.params.firebaseID));
                    if (temp.likeFirebaseIDs.indexOf(ctx.params.firebaseID) < 0) {
                        temp.likeFirebaseIDs.push(ctx.params.firebaseID);
                        if (!temp.like)
                            temp.like = 1;
                        else
                            temp.like++;
                    }
                }

                temp.latestAction = 'like';
                temp.updatedAt = new Date();
                const doc = await this.adapter.updateById(temp._id, { $set: temp });
                const post = await this.transformDocuments(ctx, {}, doc);
                var postEntity = await this.entityChanged("updated", post, ctx).then(() => post);

                const ctxuser = await ctx.call("likepost.create", { firebaseID: ctx.params.firebaseID, postID: ctx.params.postID });


                return { status: 200, message: "success", data: { postEntity } };

            },
        },
        dislike: {
            params: {
                postID: { type: "string" },
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.postID;

                var temp = await this.adapter.findOne({ _id: new ObjectId(entity) });
                console.log("Post", temp);

                if (temp.likeFirebaseIDs) {
                    var tempPop = temp.likeFirebaseIDs.pop(ctx.params.firebaseID);
                    if (tempPop) {
                        temp.like--;
                        const dislike = await ctx.call("likepost.delete", { firebaseID: ctx.params.firebaseID, postID: ctx.params.postID });
                    }
                }

                if (!temp.dislikeFirebaseIDs) {
                    temp.dislikeFirebaseIDs = [];
                    temp.dislikeFirebaseIDs.push(ctx.params.firebaseID);

                    if (!temp.dislike)
                        temp.dislike = 1;
                    else
                        temp.dislike++;

                }
                else {
                    if (temp.dislikeFirebaseIDs.indexOf(ctx.params.firebaseID) < 0) {
                        temp.dislikeFirebaseIDs.push(ctx.params.firebaseID);
                        if (!temp.dislike)
                            temp.dislike = 1;
                        else
                            temp.dislike++;
                    }
                }

                if (temp.latestAction == 'like') {
                    temp.latestAction = '';
                }

                temp.updatedAt = new Date();
                const doc = await this.adapter.updateById(temp._id, { $set: temp });
                const post = await this.transformDocuments(ctx, {}, doc);
                var postEntity = await this.entityChanged("updated", post, ctx).then(() => post);
                return { status: 200, message: "success", data: { postEntity } };

            },
        },
        //* chnaged removed
        getAllPosts: {
            params: {
                firebaseID: { type: "string" },
                page: { type: "number" },
                limit: { type: "number" },
                //userFirebaseID:{ type: "string"}
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.firebaseID;
                var page_size = ctx.params.limit;
                var page_number = ctx.params.page;
                //  let userFirebaseID = ctx.params.userFirebaseID;

                // const ctxuser = await ctx.call("user.findFirebaseID", { firebaseID: userFirebaseID });
                // var blockID = ctxuser["result"][0].blockedUserId;
                // if(typeof blockID === "undefined" || !blockID.includes(entity)){

                //   const ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: entity });

                // if(typeof ctxdata["result"][0].blockedUserId === "undefined" || !ctxdata["result"][0].blockedUserId.includes(userFirebaseID)){

                var temp = await this.adapter.find({ query: { firebaseID: entity } });
                console.log("Posts", temp);

                var totalPages = 1;
                var result = [];
                if (temp != undefined && temp.length > 0) {

                    var totalRecords = temp.length;
                    totalPages = Math.ceil((totalRecords / page_size));

                    if (page_number <= totalPages)
                        result = temp.slice((page_number - 1) * page_size, page_number * page_size);
                }

                return { status: 200, message: "success", totalPages: totalPages, data: result };
                //     }else{
                //         return { status : 200, message : "success", totalPages : 1, data : [] };
                //     }
                // }else{
                //     return { status : 200, message : "success", totalPages : 1, data : [] };
                // }
            },
        },
        //* chnaged removed
        getPostByID: {
            params: {
                firebaseID: { type: "string" },
                postID: { type: "string" },
                // postMediaID: { type: "string" },
                // userFirebaseID:{ type: "string"}
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.postID;
                var vfbID = ctx.params.firebaseID;

                // const ctxuser = await ctx.call("user.findFirebaseID", { firebaseID: userFirebaseID });
                // var blockID = ctxuser["result"][0].blockedUserId;

                // if(typeof blockID === "undefined" || !blockID.includes(vfbID)){

                //     const ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: vfbID });

                //         if(typeof ctxdata["result"][0].blockedUserId === "undefined" || !ctxdata["result"][0].blockedUserId.includes(userFirebaseID)){

                const ctxpview = await this.broker.call("postviewed.create", { firebaseID: vfbID, postID: entity });

                var result = [];

                var temp = await this.adapter.findOne({ _id: new ObjectId(entity) });
                console.log("Post", temp);

                var favview_count = 0;
                var callviewctxdata = await this.broker.call("postviewed.getViewPostCount", { postID: entity });
                favview_count = callviewctxdata["totalRecords"];

                // temp.views = favview_count;

                if (!temp.views) {
                    temp.views = 0;
                } else {
                    temp.views = favview_count;

                }
                if (!temp.like) {
                    temp.like = 0;
                }

                if (!temp.sharedCount) {
                    temp.sharedCount = 0;
                }

                if (!temp.latestAction) {
                    temp.latestAction = '';
                }

                if (temp.groupID) {
                    var setgroup = temp.groupID.split(',');
                    var finalResultData = [];
                    for (var i = 0; i < setgroup.length; i++) {
                        var searchuserdata = setgroup[i];
                        const ctxgroupfuser = await ctx.call("user.findFirebaseID", { firebaseID: searchuserdata });
                        var groupuserName = '';
                        var groupuserAvatar = '';

                        if (ctxgroupfuser["result"].length > 0) {
                            groupuserName = ctxgroupfuser["result"][0]["fullname"];
                            groupuserAvatar = ctxgroupfuser["result"][0]["avatar"];
                        }
                        finalResultData.push({ groupid: setgroup[i], groupName: groupuserName, groupAvatar: groupuserAvatar });
                    }
                    temp.groupData = finalResultData;
                }

                if (temp.likeFirebaseIDs) {
                    const ctxlikeuser = await ctx.call("likepost.getByPostID", { postID: entity });
                    temp.likeData = ctxlikeuser["likeData"];
                }


                if (temp.basePostID) {
                    temp.isShared = true;
                    var bpostID = temp.basePostID;
                    const ctxbuser = await ctx.call("post.getpostDetails", { postID: bpostID });
                    temp.originalPostData = ctxbuser["postDetail"];
                }

                const ctxuser = await ctx.call("user.findFirebaseID", { firebaseID: temp.firebaseID });
                var fireuserName = '';
                var fireuserAvatar = '';

                if (ctxuser["result"].length > 0) {
                    fireuserName = ctxuser["result"][0]["fullname"];
                    temp.userName = fireuserName;
                    fireuserAvatar = ctxuser["result"][0]["avatar"];
                    temp.avatar = fireuserAvatar;

                }
                const ctxfavpost = await ctx.call("favoritespost.findUserPost", { firebaseID: temp.firebaseID, postID: entity });
                const ctxcomment = await ctx.call("postcomment.getlatest", { postID: entity });
                temp.commentData = ctxcomment["comment"];
                temp.comments = ctxcomment["total"];
                temp.isfav = ctxfavpost["found"];

                result.push(temp);

                return { status: 200, message: "success", data: result };
                //         }else{
                //             return { status : 200, message : "success", data : [] };
                //         }
                // }else{
                //     return { status : 200, message : "success", data : [] };
                // }

            },
        },
        postImageUpload: {
            params: {
                firebaseID: { type: "string" },
                baseString: { type: "string" },
                imageName: { type: "string" },
                assetsIdentifier: { type: "string" }
            },
            handler(ctx) {
                console.log("List of params", ctx.params);
                var uploadDir;
                var entity = ctx.params;
                var base64Data = entity.baseString;
                var assetsIdentifier = entity.assetsIdentifier;

                //var _path = "/root/moleculer-demo/public";

                uploadDir = process.env.POST_IMAGE_PATH;
                //uploadDir = "D:/Projects/admin-dashboard-Backend/public/profileImanges";

                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir);
                }

                const imageBufferData = Buffer.from(base64Data, 'base64');
                var streamObj = new ReadableData();
                streamObj.push(imageBufferData);
                streamObj.push(null);

                var extension = entity.imageName.split('.')[1];
                var tempImageName = entity.firebaseID + "_" + Date.now() + "." + extension;

                const filePath = path.join(uploadDir, tempImageName);
                streamObj.pipe(fs.createWriteStream(filePath));

                const thumbnail = '';
                // let options = { percentage: 25, responseType: 'base64' };
                // const stream = fs.createReadStream(filePath);
                // const thumbnail = await imageThumbnail(stream);
                //const thumbnail = await imageThumbnail({ uri: postImageURL });

                var postImageURL = process.env.POST_IMANGE_URL + tempImageName;

                return { status: 200, message: "success", data: { postimangeurl: postImageURL, thumbnail: thumbnail, assetsIdentifier: assetsIdentifier } };

            }
        },
        postVideoUpload: {
            params: {
                firebaseID: { type: "string" },
                baseString: { type: "string" },
                thumbString: { type: "string" },
                videoName: { type: "string" },
                assetsIdentifier: { type: "string" }
            },
            handler(ctx) {
                console.log("List of params", ctx.params);
                var uploadDir;
                var entity = ctx.params;
                var base64Data = entity.baseString;
                var thumbbase64Data = entity.thumbString;
                var assetsIdentifier = entity.assetsIdentifier;

                //var _path = "/root/moleculer-demo/public";

                uploadDir = process.env.POST_VIDEO_PATH;
                //uploadDir = "D:/Projects/admin-dashboard-Backend/public/profileImanges";

                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir);
                }

                const imageBufferData = Buffer.from(base64Data, 'base64');
                var streamObj = new ReadableData();
                streamObj.push(imageBufferData);
                streamObj.push(null);

                var extension = entity.videoName.split('.')[1];
                var tempVideoName = entity.firebaseID + "_" + Date.now() + "." + extension;

                const filePath = path.join(uploadDir, tempVideoName);
                streamObj.pipe(fs.createWriteStream(filePath));



                const thumbimageBufferData = Buffer.from(thumbbase64Data, 'base64');
                var thumbstreamObj = new ReadableData();
                thumbstreamObj.push(thumbimageBufferData);
                thumbstreamObj.push(null);

                var thumbextension = 'jpg';
                var tempThumbName = entity.firebaseID + "_" + Date.now() + "." + thumbextension;

                const thumbfilePath = path.join(uploadDir, tempThumbName);
                thumbstreamObj.pipe(fs.createWriteStream(thumbfilePath));

                // const thumbnail =  imageThumbnail(base64Data);
                // const stream = fs.createReadStream(filePath)

                //const thumbnail =  imageThumbnail(stream);

                var postVideoURL = process.env.POST_VIDEO_URL + tempVideoName;
                var postStreamURL = process.env.POST_VIDEO_STREAM_URL + tempVideoName;
                var thumbnail = process.env.POST_VIDEO_URL + tempThumbName;

                return { status: 200, message: "success", data: { postvideourl: postVideoURL, thumbnail: thumbnail, streamvideourl: postStreamURL, assetsIdentifier: assetsIdentifier } };

            }
        },
        streamvideos: {
            rest: {
                method: "GET",
                path: "/streamvideos"
            },
            params: {
                video: { type: "string" }
            },
            handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var file = path.join(process.env.POST_VIDEO_PATH, ctx.params.video);

                console.log("File Path", file);

                return fs.createReadStream(file);

            },
        },
        hashtags: {
            params: {
                searchtext: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var temp = await this.adapter.find({});

                console.log("hashtag", temp);
                var tempSearch = ctx.params.searchtext;

                var tempHashTags = [];
                await temp.forEach(function (item, index) {
                    if (item.postMedia.length > 0) {
                        item.postMedia.forEach(function (slideItem, slideIndex) {
                            var _option = slideItem.options;
                            if (_option != null) {

                                var _optionHash = _option.hashTag;
                                if (_optionHash != null) {
                                    _optionHash.forEach(function (optionItem, optionIndex) {
                                        if (tempSearch == optionItem) {
                                            tempHashTags.push(item);
                                        }
                                    });
                                }
                            }
                        });
                    }
                });

                return { status: 200, message: "success", data: tempHashTags };

            },
        },
        //* changed
        findImage: {
            params: {
                firebaseID: { type: "string" },
                searchtext: { type: "string" },
                page: { type: "number" },
                limit: { type: "number" }
            },
            async handler(ctx) {

                var result = [];
                console.log("Params", JSON.stringify(ctx.params));
                var page_size = ctx.params.limit;
                var page_number = ctx.params.page;
                var firebaseID = ctx.params.firebaseID;

                const ctxuserdata = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                var followers = [];
                var blockID;
                if (ctxuserdata["result"].length > 0) {
                    followers = ctxuserdata["result"][0]["followers"];
                    blockID = ctxuserdata["result"][0].blockedUserId;
                }

                var _temp = await this.adapter.find({});

                var temp = _temp.sort((a, b) => b.createdAt - a.createdAt);

                console.log("findImage", temp);
                var tempSearch = ctx.params.searchtext;

                var tempImages = [];
                var finalResult = [];

                if (tempSearch != '') {
                    for (let i = 0; i < temp.length; i++) {
                        if (followers.length > 0) {
                            if (followers.includes(temp[i].firebaseID)) {
                                if (typeof blockID === "undefined" || !blockID.includes(item.firebaseID)) {

                                    let _firebaseID = temp[i].firebaseID;
                                    let ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: _firebaseID });
                                    if (ctxdata["result"].length > 0) {
                                        if (typeof ctxdata["result"][0].blockedUserId === "undefined" || !ctxdata["result"][0].blockedUserId.includes(firebaseID)) {
                                            if (temp[i].postMedia.length > 0) {
                                                temp[i].postMedia.forEach(function (slideItem, slideIndex) {
                                                    var pushItem = false;
                                                    var _background = slideItem.media;
                                                    var _options = slideItem.options;
                                                    var _text = slideItem.text;
                                                    if (_background != null) {

                                                        var _bgtype = _background.mediaType;
                                                        if (_bgtype == 'picture') {

                                                            var stringData = "";
                                                            if (_text != null) {
                                                                stringData = _text.mediaCaption;
                                                            }
                                                            if (stringData != null) {
                                                                //const res = stringData.split(/[\s,\?\,\.!]+/).some(f=> f === tempSearch);
                                                                stringData = stringData.toLowerCase();
                                                                tempSearch = tempSearch.toLowerCase();
                                                                var res = stringData.search(tempSearch);
                                                                if (res >= 0) {
                                                                    pushItem = true;
                                                                }
                                                            }
                                                            if (_options != null) {

                                                                var _hashTag = _options.hashTag;
                                                                if (_hashTag != null) {
                                                                    tempSearch = tempSearch.toLowerCase();
                                                                    var hashFound = false;
                                                                    for (var n = 0; n < _hashTag.length; n++) {
                                                                        var hashData = _hashTag[n].hashName.toLowerCase();
                                                                        //const ctxdata = await ctx.call("hashtag.getByID", { hashId: hashId });
                                                                        //var hashData = ctxdata.hashName.toLowerCase();

                                                                        if (hashData == tempSearch) {
                                                                            hashFound = true;
                                                                        }
                                                                    }
                                                                    if (hashFound) {
                                                                        pushItem = true;
                                                                    }
                                                                }
                                                            }

                                                        }
                                                        if (pushItem) {
                                                            var like = 0;
                                                            if (temp[i].like) {
                                                                like = temp[i].like;
                                                            }
                                                            var postm = [];
                                                            postm.push(slideItem);
                                                            finalResult.push({ _id: temp[i]._id, firebaseID: temp[i].firebaseID, postMedia: postm, like: like });
                                                        }
                                                    }
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }


                } else {
                    for (let i = 0; i < temp.length; i++) {
                        if (typeof blockID === "undefined" || !blockID.includes(temp[i].firebaseID)) {

                            let _firebaseID = temp[i].firebaseID;
                            let ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: _firebaseID });
                            if (ctxdata["result"].length > 0) {
                                if (typeof ctxdata["result"][0].blockedUserId === "undefined" || !ctxdata["result"][0].blockedUserId.includes(firebaseID)) {
                                    if (temp[i].postMedia.length > 0) {
                                        temp[i].postMedia.forEach(function (slideItem, slideIndex) {
                                            var pushItem = false;
                                            var _background = slideItem.media;
                                            //var _text = slideItem.text;
                                            if (_background != null) {

                                                var _bgtype = _background.mediaType;
                                                if (_bgtype == 'picture') {
                                                    pushItem = true;
                                                }
                                                if (pushItem) {
                                                    var like = 0;
                                                    if (temp[i].like) {
                                                        like = temp[i].like;
                                                    }
                                                    var postm = [];
                                                    postm.push(slideItem);
                                                    finalResult.push({ _id: temp[i]._id, firebaseID: temp[i].firebaseID, postMedia: postm, like: like });
                                                }
                                            }
                                        });
                                    }
                                }
                            }
                        }

                    }
                }

                tempImages = finalResult;
                if (tempImages.length > 0) {
                    for (var k = 0; k < tempImages.length; k++) {
                        var favview_count = 0;
                        var postDataId = tempImages[k]._id.toString();
                        var callviewctxdata = await ctx.call("postviewed.getViewPostCount", { postID: postDataId });
                        favview_count = callviewctxdata["totalRecords"];

                        tempImages[k].views = favview_count;

                        var firebaseID = tempImages[k].firebaseID;
                        const ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                        var fireuserName = '';

                        if (ctxdata["result"].length > 0) {
                            fireuserName = ctxdata["result"][0]["fullname"];
                            tempImages[k].userName = fireuserName;
                        }
                    }
                }

                var totalPages = 1;
                var totalRecords = tempImages.length;
                totalPages = Math.ceil((totalRecords / page_size));

                if (page_number <= totalPages)
                    result = tempImages.slice((page_number - 1) * page_size, page_number * page_size);


                return { status: 200, message: "success", totalPages: totalPages, data: result };

            },
        },
        //* chnaged
        findVideo: {
            params: {
                firebaseID: { type: "string" },
                searchtext: { type: "string" },
                page: { type: "number" },
                limit: { type: "number" }
            },
            async handler(ctx) {

                var result = [];
                console.log("Params", JSON.stringify(ctx.params));
                var page_size = ctx.params.limit;
                var page_number = ctx.params.page;
                var firebaseID = ctx.params.firebaseID;

                const ctxuserdata = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                var followers = [];
                var blockID;
                if (ctxuserdata["result"].length > 0) {
                    followers = ctxuserdata["result"][0]["followers"];
                    blockID = ctxuserdata["result"][0].blockedUserId;
                }

                var _temp = await this.adapter.find({});

                var temp = _temp.sort((a, b) => b.createdAt - a.createdAt);

                console.log("findImage", temp);
                var tempSearch = ctx.params.searchtext;

                var tempImages = [];
                var finalResult = [];

                if (tempSearch != '') {

                    for (let i = 0; i < temp.length; i++) {
                        if (followers.length > 0) {
                            if (followers.includes(temp[i].firebaseID)) {
                                if (typeof blockID === "undefined" || !blockID.includes(temp[i].firebaseID)) {

                                    let _firebaseID = temp[i].firebaseID;
                                    let ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: _firebaseID });
                                    if (ctxdata["result"].length > 0) {
                                        if (typeof ctxdata["result"][0].blockedUserId === "undefined" || !ctxdata["result"][0].blockedUserId.includes(firebaseID)) {
                                            if (temp[i].postMedia.length > 0) {
                                                temp[i].postMedia.forEach(function (slideItem, slideIndex) {
                                                    var pushItem = false;
                                                    var _background = slideItem.media;
                                                    var _options = slideItem.options;
                                                    var _text = slideItem.text;
                                                    if (_background != null) {

                                                        var _bgtype = _background.mediaType;
                                                        if (_bgtype == 'video') {

                                                            var stringData = "";
                                                            if (_text != null) {
                                                                stringData = _text.mediaCaption;
                                                            }
                                                            if (stringData != null) {
                                                                //const res = stringData.split(/[\s,\?\,\.!]+/).some(f=> f === tempSearch);
                                                                stringData = stringData.toLowerCase();
                                                                tempSearch = tempSearch.toLowerCase();
                                                                var res = stringData.search(tempSearch);
                                                                if (res >= 0) {
                                                                    pushItem = true;
                                                                }
                                                            }
                                                            if (_options != null) {

                                                                var _hashTag = _options.hashTag;
                                                                if (_hashTag != null) {
                                                                    tempSearch = tempSearch.toLowerCase();
                                                                    var hashFound = false;
                                                                    for (var n = 0; n < _hashTag.length; n++) {
                                                                        var hashData = _hashTag[n].hashName.toLowerCase();
                                                                        //const ctxdata = await ctx.call("hashtag.getByID", { hashId: hashId });
                                                                        //var hashData = ctxdata.hashName.toLowerCase();

                                                                        if (hashData == tempSearch) {
                                                                            hashFound = true;
                                                                        }
                                                                    }
                                                                    if (hashFound) {
                                                                        pushItem = true;
                                                                    }
                                                                }
                                                            }

                                                        }
                                                        if (pushItem) {

                                                            var like = 0;
                                                            if (temp[i].like) {
                                                                like = temp[i].like;
                                                            }
                                                            var postm = [];
                                                            postm.push(slideItem);
                                                            finalResult.push({ _id: temp[i]._id, firebaseID: temp[i].firebaseID, postMedia: postm, like: like });
                                                        }
                                                    }
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                } else {
                    for (let i = 0; i < temp.length; i++) {
                        if (typeof blockID === "undefined" || !blockID.includes(temp[i].firebaseID)) {

                            let _firebaseID = temp[i].firebaseID;
                            let ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: _firebaseID });
                            if (ctxdata["result"].length > 0) {
                                if (typeof ctxdata["result"][0].blockedUserId === "undefined" || !ctxdata["result"][0].blockedUserId.includes(firebaseID)) {
                                    if (temp[i].postMedia.length > 0) {
                                        temp[i].postMedia.forEach(function (slideItem, slideIndex) {
                                            var pushItem = false;
                                            var _background = slideItem.media;
                                            // var _text = slideItem.text;
                                            if (_background != null) {

                                                var _bgtype = _background.mediaType;
                                                if (_bgtype == 'video') {
                                                    pushItem = true;
                                                }
                                                if (pushItem) {
                                                    var like = 0;
                                                    if (temp[i].like) {
                                                        like = temp[i].like;
                                                    }
                                                    var postm = [];
                                                    postm.push(slideItem);

                                                    finalResult.push({ _id: temp[i]._id, firebaseID: temp[i].firebaseID, postMedia: postm, like: like });
                                                }
                                            }
                                        });
                                    }
                                }
                            }
                        }
                    }
                }

                tempImages = finalResult;

                if (tempImages.length > 0) {
                    for (var k = 0; k < tempImages.length; k++) {

                        var favview_count = 0;
                        var postDataId = tempImages[k]._id.toString();
                        var callviewctxdata = await ctx.call("postviewed.getViewPostCount", { postID: postDataId });
                        favview_count = callviewctxdata["totalRecords"];

                        tempImages[k].views = favview_count;
                        var firebaseID = tempImages[k].firebaseID;
                        const ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                        var fireuserName = '';

                        if (ctxdata["result"].length > 0) {
                            fireuserName = ctxdata["result"][0]["fullname"];
                            tempImages[k].userName = fireuserName;
                        }
                    }

                }
                var totalPages = 1;
                var totalRecords = tempImages.length;
                totalPages = Math.ceil((totalRecords / page_size));

                if (page_number <= totalPages)
                    result = tempImages.slice((page_number - 1) * page_size, page_number * page_size);

                return { status: 200, message: "success", totalPages: totalPages, data: result };

            },
        },
        //* changed removed
        getSocialPosts: {
            params: {
                firebaseID: { type: "string" },
                searchtext: { type: "string" },
                page: { type: "number" },
                limit: { type: "number" }
            },
            async handler(ctx) {

                var result = [];
                console.log("Params", JSON.stringify(ctx.params));
                var page_size = ctx.params.limit;
                var page_number = ctx.params.page;
                var firebaseID = ctx.params.firebaseID;

                const ctxuserdata = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                var followers = [];

                if (ctxuserdata["result"].length > 0) {
                    followers = ctxuserdata["result"][0]["followers"];
                    // var blockID = ctxuser["result"][0].blockedUserId;
                }

                var _temp = await this.adapter.find({});

                var temp = _temp.sort((a, b) => b.createdAt - a.createdAt);

                console.log("findImage", temp);
                var tempSearch = ctx.params.searchtext;

                var tempImages = [];
                var finalResult = [];


                if (tempSearch != '') {

                    await temp.forEach(function (item, index) {
                        if (followers.length > 0) {
                            if (followers.includes(item.firebaseID)) {
                                if (item.postMedia) {
                                    if (item.postMedia.length > 0) {
                                        var pushItem = false;
                                        var hashFound = false;
                                        item.postMedia.forEach(function (slideItem, slideIndex) {

                                            var _background = slideItem.media;
                                            var _options = slideItem.options;
                                            var _text = slideItem.text;
                                            if (_background != null) {

                                                var _bgtype = _background.mediaType;

                                                var stringData = "";
                                                if (_text != null) {
                                                    stringData = _text.mediaCaption;
                                                }
                                                if (stringData != null) {
                                                    //const res = stringData.split(/[\s,\?\,\.!]+/).some(f=> f === tempSearch);
                                                    stringData = stringData.toLowerCase();
                                                    tempSearch = tempSearch.toLowerCase();
                                                    var res = stringData.search(tempSearch);
                                                    if (res >= 0) {
                                                        pushItem = true;
                                                    }
                                                }
                                                if (_options != null) {

                                                    var _hashTag = _options.hashTag;
                                                    if (_hashTag != null) {
                                                        tempSearch = tempSearch.toLowerCase();

                                                        for (var n = 0; n < _hashTag.length; n++) {
                                                            var hashData = _hashTag[n].hashName.toLowerCase();
                                                            //const ctxdata = await ctx.call("hashtag.getByID", { hashId: hashId });
                                                            //var hashData = ctxdata.hashName.toLowerCase();

                                                            if (hashData == tempSearch) {
                                                                hashFound = true;
                                                            }
                                                        }
                                                        if (hashFound) {
                                                            pushItem = true;
                                                        }
                                                    }
                                                }

                                            }
                                        });

                                    }
                                    if (pushItem) {
                                        var like = 0;

                                        if (item.like) {
                                            like = item.like;
                                        }
                                        var postm = [];
                                        postm.push(item.postMedia[0]);
                                        finalResult.push({ _id: item._id, firebaseID: item.firebaseID, postMedia: postm, like: like });
                                    }
                                }
                            }
                        }
                    });

                } else {
                    await temp.forEach(function (item, index) {
                        var like = 0;
                        var postm = [];
                        if (item.postMedia) {
                            if (item.postMedia.length > 0) {
                                var _background = item.postMedia[0].media;
                                if (_background != null) {

                                    if (item.like) {
                                        like = item.like;
                                    }
                                    postm.push(item.postMedia[0]);
                                }

                                finalResult.push({ _id: item._id, firebaseID: item.firebaseID, postMedia: postm, like: like });
                            }
                        }
                    });
                }
                tempImages = finalResult;
                if (tempImages.length > 0) {
                    for (var k = 0; k < tempImages.length; k++) {
                        var favview_count = 0;
                        var postDataId = tempImages[k]._id.toString();
                        var callviewctxdata = await ctx.call("postviewed.getViewPostCount", { postID: postDataId });
                        favview_count = callviewctxdata["totalRecords"];

                        tempImages[k].views = favview_count;

                        var firebaseID = tempImages[k].firebaseID;
                        const ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                        var fireuserName = '';

                        if (ctxdata["result"].length > 0) {
                            fireuserName = ctxdata["result"][0]["fullname"];
                            tempImages[k].userName = fireuserName;
                        }

                    }

                }


                var totalPages = 1;
                var totalRecords = tempImages.length;
                totalPages = Math.ceil((totalRecords / page_size));

                if (page_number <= totalPages)
                    result = tempImages.slice((page_number - 1) * page_size, page_number * page_size);


                return { status: 200, message: "success", totalPages: totalPages, data: result };

            },
        },
        trending: {
            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                var result = {};

                var firebaseID = ctx.params.firebaseID;
                var searchtext = '';
                var page = 1;
                var limit = 5;
                var plimit = 6;
                const ctxdata = await ctx.call("user.findPopular", { searchtext: searchtext, page: page, limit: limit, firebaseID: firebaseID });


                if (ctxdata["data"].length > 0) {
                    result.Accounts = ctxdata["data"];
                    // fireuserName = ctxdata["result"][0]["userName"];
                }

                const ctxhashtagdata = await ctx.call("hashtag.getAllHash", { searchtext: searchtext, page: page, limit: limit, firebaseID: firebaseID });


                if (ctxhashtagdata["data"].length > 0) {
                    result.HashTags = ctxhashtagdata["data"];
                    // fireuserName = ctxdata["result"][0]["userName"];
                }

                const ctxvideodata = await ctx.call("post.findVideo", { searchtext: searchtext, page: page, limit: plimit, firebaseID: firebaseID });


                if (ctxvideodata["data"].length > 0) {
                    result.Videos = ctxvideodata["data"];
                    // fireuserName = ctxdata["result"][0]["userName"];
                }

                const ctximagedata = await ctx.call("post.findImage", { searchtext: searchtext, page: page, limit: plimit, firebaseID: firebaseID });


                if (ctximagedata["data"].length > 0) {
                    result.Images = ctximagedata["data"];
                    // fireuserName = ctxdata["result"][0]["userName"];
                }

                const ctxpostdata = await ctx.call("post.getSocialPosts", { searchtext: searchtext, page: page, limit: limit, firebaseID: firebaseID });


                if (ctxpostdata["data"].length > 0) {
                    result.Posts = ctxpostdata["data"];
                    // fireuserName = ctxdata["result"][0]["userName"];
                }


                return result;

            }
        },
        //* changed
        userSocial: {
            params: {
                firebaseID: { type: "string" },
                page: { type: "number" },
                limit: { type: "number" },
                socialType: { type: "string" },
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var entity = ctx.params.firebaseID;
                var page_size = ctx.params.limit;
                var page_number = ctx.params.page;

                // var temp = await this.adapter.find({});
                // console.log("Posts", temp);

                var socialType = ctx.params.socialType;
                var firebaseID = ctx.params.firebaseID;

                if (socialType == "group") {
                    var _temp = await this.adapter.find({ query: { groupID: firebaseID } });
                } else {
                    var _temp = await this.adapter.find({ query: { firebaseID: firebaseID } });
                }
                var temp = _temp.sort((a, b) => b.createdAt - a.createdAt);

                const ctxfireuser = await ctx.call("user.findFirebaseID", { firebaseID: entity });
                var userfollowers = [];
                var ageUnder = true;
                var blockID;
                if (ctxfireuser["result"].length > 0) {
                    if (ctxfireuser["result"][0]["following"]) {
                        userfollowers = ctxfireuser["result"][0]["following"];
                    }
                    blockID = ctxfireuser["result"][0].blockedUserId;
                    ageUnder = ctxfireuser["result"][0]["ageUnder"];
                }

                if (temp != undefined && temp.length > 0) {
                    for (var k = 0; k < temp.length; k++) {
                        var isFollowed = false;
                        var postID = temp[k]._id.toString();
                        const ctxpost = await ctx.call("post.getbyID", { postID: postID });
                        temp[k] = ctxpost["result"];
                        let isMute = false;
                        if (ctxpost["result"].muteUsers) {
                            if (ctxpost["result"].muteUsers.includes(entity)) {
                                isMute = true;
                            }
                        }
                        temp[k].ismute = isMute;

                        const ctxlike = await ctx.call("likepost.getLikeByMe", { firebaseID: entity, postID: postID });
                        temp[k].isLikebyme = ctxlike["isLikebyme"];
                        var firebaseID = temp[k].firebaseID;
                        const ctxuser = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                        var fireuserName = '';
                        var fireuserAvatar = '';

                        if (ctxuser["result"].length > 0) {
                            fireuserName = ctxuser["result"][0]["fullname"];
                            temp[k].userName = fireuserName;
                            fireuserAvatar = ctxuser["result"][0]["avatar"];
                            temp[k].avatar = fireuserAvatar;

                            if (ctxuser["result"][0]["followers"]) {
                                var infollowors_count = ctxuser["result"][0]["followers"].length;
                                if (infollowors_count > 0) {
                                    for (var b = 0; b < infollowors_count; b++) {
                                        var infollowfireUser = ctxuser["result"][0]["followers"][b];
                                        if (infollowfireUser == entity) {
                                            isFollowed = true;
                                        }
                                    }
                                }
                            }
                            temp[k].isFollowed = isFollowed;
                        }

                        const ctxfavpost = await ctx.call("favoritespost.findUserPost", { firebaseID: entity, postID: postID });
                        const ctxcomment = await ctx.call("postcomment.getlatest", { postID: postID });
                        temp[k].commentData = ctxcomment["comment"];
                        temp[k].comments = ctxcomment["total"];
                        temp[k].isfav = ctxfavpost["found"];
                    }
                }
                if (temp != undefined && temp.length > 0) {
                    for (let k = 0; k < temp.length; k++) {
                        if (!temp[k].commentData || Object.keys(temp[k].commentData).length === 0 && temp[k].commentData.constructor === Object) {
                            if (temp[k].latestAction !== "like") {
                                temp[k].latestAction = "like";
                            }
                        }
                        if (!temp[k].likeData || Object.keys(temp[k].likeData).length === 0 && temp[k].likeData.constructor === Object) {
                            if (temp[k].latestAction !== "comment") {
                                temp[k].latestAction = "comment";
                            }
                        }
                        if ((!temp[k].commentData || Object.keys(temp[k].commentData).length === 0 && temp[k].commentData.constructor === Object)
                            && (!temp[k].likeData || Object.keys(temp[k].likeData).length === 0 && temp[k].likeData.constructor === Object)) {
                            temp[k].latestAction = "";
                        }
                    }
                }
                var result = [];
                if (temp.length > 0) {
                    for (var k = 0; k < temp.length; k++) {
                        var favview_count = 0;
                        var postDataId = temp[k]._id.toString();
                        var callviewctxdata = await ctx.call("postviewed.getViewPostCount", { postID: postDataId });
                        favview_count = callviewctxdata["totalRecords"];
                        temp[k].views = favview_count;

                        var firebaseID = temp[k].firebaseID;
                        const ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                        var fireuserName = '';

                        if (ctxdata["result"].length > 0) {
                            fireuserName = ctxdata["result"][0]["fullname"];
                            temp[k].userName = fireuserName;
                        }
                    }
                }
                var tempImages = temp;

                var totalPages = 1;
                var totalRecords = tempImages.length;
                totalPages = Math.ceil((totalRecords / page_size));

                if (page_number <= totalPages)
                    result = tempImages.slice((page_number - 1) * page_size, page_number * page_size);


                return { status: 200, message: "success", totalPages: totalPages, data: result };

            },
        },
        //* changed
        followingPost: {
            params: {
                firebaseID: { type: "string" },
                page: { type: "number" },
                limit: { type: "number" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var entity = ctx.params.firebaseID;
                var page_size = ctx.params.limit;
                var page_number = ctx.params.page;

                var temp = await this.adapter.find({});
                var temp = temp.sort((a, b) => b.createdAt - a.createdAt);
                console.log("Posts", temp);

                const ctxfireuser = await ctx.call("user.findFirebaseID", { firebaseID: entity });
                var userfollowers = [];
                var ageUnder = true;
                var blockID;
                if (ctxfireuser["result"].length > 0) {
                    if (ctxfireuser["result"][0]["following"]) {
                        userfollowers = ctxfireuser["result"][0]["following"];
                    }
                    blockID = ctxfireuser["result"][0].blockedUserId;
                    ageUnder = ctxfireuser["result"][0]["ageUnder"];
                }

                var newResult = [];
                if (temp != undefined && temp.length > 0) {

                    for (var j = 0; j < temp.length; j++) {
                        if (typeof blockID === "undefined" || !blockID.includes(temp[j].firebaseID) && temp[j].shareType != "shareofworld") {
                            var creatorUser = temp[j].firebaseID;
                            let ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: creatorUser });
                            if (ctxdata["result"].length > 0) {
                                if (typeof ctxdata["result"][0].blockedUserId === "undefined" || !ctxdata["result"][0].blockedUserId.includes(entity)) {
                                    var sharetypepost = temp[j].shareType;
                                    var setsharetype = [];
                                    setsharetype = sharetypepost.split(',');

                                    if (creatorUser == entity) {
                                        newResult.push({ _id: temp[j]._id.toString(), firebaseID: temp[j].firebaseID });
                                    } else {

                                        if (!setsharetype.includes("yourself")) {
                                            if (userfollowers.length > 0) {
                                                if (userfollowers.includes(creatorUser)) {
                                                    if (!temp[j].forKids) {
                                                        if (!ageUnder) {
                                                            newResult.push({ _id: temp[j]._id.toString(), firebaseID: temp[j].firebaseID });
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                }

                temp = newResult;

                if (temp != undefined && temp.length > 0) {
                    for (var k = 0; k < temp.length; k++) {
                        var isFollowed = false;
                        var postID = temp[k]._id.toString();
                        const ctxpost = await ctx.call("post.getbyID", { postID: postID });
                        temp[k] = ctxpost["result"];
                        let isMute = false;
                        if (ctxpost["result"].muteUsers) {
                            if (ctxpost["result"].muteUsers.includes(entity)) {
                                isMute = true;
                            }
                        }
                        temp[k].ismute = isMute;

                        const ctxlike = await ctx.call("likepost.getLikeByMe", { firebaseID: entity, postID: postID });
                        temp[k].isLikebyme = ctxlike["isLikebyme"];
                        var firebaseID = temp[k].firebaseID;
                        const ctxuser = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                        var fireuserName = '';
                        var fireuserAvatar = '';

                        if (ctxuser["result"].length > 0) {
                            fireuserName = ctxuser["result"][0]["fullname"];
                            temp[k].userName = fireuserName;
                            fireuserAvatar = ctxuser["result"][0]["avatar"];
                            temp[k].avatar = fireuserAvatar;

                            if (ctxuser["result"][0]["followers"]) {
                                var infollowors_count = ctxuser["result"][0]["followers"].length;
                                if (infollowors_count > 0) {
                                    for (var b = 0; b < infollowors_count; b++) {
                                        var infollowfireUser = ctxuser["result"][0]["followers"][b];
                                        if (infollowfireUser == entity) {
                                            isFollowed = true;
                                        }
                                    }
                                }
                            }
                            temp[k].isFollowed = isFollowed;
                        }

                        const ctxfavpost = await ctx.call("favoritespost.findUserPost", { firebaseID: entity, postID: postID });
                        const ctxcomment = await ctx.call("postcomment.getlatest", { postID: postID });
                        temp[k].commentData = ctxcomment["comment"];
                        temp[k].comments = ctxcomment["total"];
                        temp[k].isfav = ctxfavpost["found"];
                    }
                }
                if (temp != undefined && temp.length > 0) {
                    for (let k = 0; k < temp.length; k++) {
                        if (!temp[k].commentData || Object.keys(temp[k].commentData).length === 0 && temp[k].commentData.constructor === Object) {
                            if (temp[k].latestAction !== "like") {
                                temp[k].latestAction = "like";
                            }
                        }
                        if (!temp[k].likeData || Object.keys(temp[k].likeData).length === 0 && temp[k].likeData.constructor === Object) {
                            if (temp[k].latestAction !== "comment") {
                                temp[k].latestAction = "comment";
                            }
                        }
                        if ((!temp[k].commentData || Object.keys(temp[k].commentData).length === 0 && temp[k].commentData.constructor === Object)
                            && (!temp[k].likeData || Object.keys(temp[k].likeData).length === 0 && temp[k].likeData.constructor === Object)) {
                            temp[k].latestAction = "";
                        }
                    }
                }
                var result = [];
                if (temp != undefined && temp.length > 0) {
                    var totalPages = 1;
                    var totalRecords = temp.length;
                    totalPages = Math.ceil((totalRecords / page_size));

                    if (page_number <= totalPages)
                        result = temp.slice((page_number - 1) * page_size, page_number * page_size);
                    if (page_number != 1) {
                        var oldpno = page_number - 1;
                        var viewtemp = [];
                        viewtemp = temp.slice((oldpno - 1) * page_size, oldpno * page_size);
                        for (var p = 0; p < viewtemp.length; p++) {
                            var vpostID = viewtemp[p]._id.toString();
                            const ctxpview = await this.broker.call("postviewed.create", { firebaseID: entity, postID: vpostID });
                        }
                    }
                }

                return { status: 200, message: "success", totalPages: totalPages, data: result };

            },
        },
        //* changed
        suggestedPostv1: {
            params: {
                firebaseID: { type: "string" },
                page: { type: "number" },
                limit: { type: "number" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var firebaseID = ctx.params.firebaseID;
                var page_size = ctx.params.limit;
                var page_number = ctx.params.page;

                const ctxhash = await ctx.call("user.listHash", { firebaseID: firebaseID });
                var userHash = ctxhash["data"];

                var temp = await this.adapter.find({});
                var temp = temp.sort((a, b) => b.createdAt - a.createdAt);
                console.log("Posts", temp);

                var newResult = [];
                const ctxfireuser = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                var blockID = ctxfireuser["result"][0]["blockedUserId"];
                if (temp != undefined && temp.length > 0) {
                    for (var j = 0; j < temp.length; j++) {
                        if (typeof blockID === "undefined" || !blockID.includes(temp[j].firebaseID)) {
                            var creatorUser = temp[j].firebaseID;
                            let ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: creatorUser });
                            if (ctxdata["result"].length > 0) {
                                if (ctxdata["result"][0].type === "creator" && (typeof ctxdata["result"][0].blockedUserId === "undefined" || !ctxdata["result"][0].blockedUserId.includes(firebaseID))) {
                                    newResult.push({ _id: temp[j]._id.toString(), firebaseID: temp[j].firebaseID });
                                }
                            }
                        }
                    }
                }

                temp = newResult;

                if (temp != undefined && temp.length > 0) {
                    for (var k = 0; k < temp.length; k++) {
                        var isFollowed = false;
                        var postID = temp[k]._id.toString();
                        const ctxpost = await ctx.call("post.getbyID", { postID: postID });
                        temp[k] = ctxpost["result"];
                        let isMute = false;
                        if (ctxpost["result"].muteUsers) {
                            if (ctxpost["result"].muteUsers.includes(firebaseID)) {
                                isMute = true;
                            }
                        }
                        temp[k].ismute = isMute;

                        const ctxlike = await ctx.call("likepost.getLikeByMe", { firebaseID: firebaseID, postID: postID });
                        temp[k].isLikebyme = ctxlike["isLikebyme"];
                        var firebaseID = temp[k].firebaseID;
                        const ctxuser = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                        var fireuserName = '';
                        var fireuserAvatar = '';

                        if (ctxuser["result"].length > 0) {
                            fireuserName = ctxuser["result"][0]["fullname"];
                            temp[k].userName = fireuserName;
                            fireuserAvatar = ctxuser["result"][0]["avatar"];
                            temp[k].avatar = fireuserAvatar;

                            if (ctxuser["result"][0]["followers"]) {
                                var infollowors_count = ctxuser["result"][0]["followers"].length;
                                if (infollowors_count > 0) {
                                    for (var b = 0; b < infollowors_count; b++) {
                                        var infollowfireUser = ctxuser["result"][0]["followers"][b];
                                        if (infollowfireUser == firebaseID) {
                                            isFollowed = true;
                                        }
                                    }
                                }
                            }
                            temp[k].isFollowed = isFollowed;

                        }

                        const ctxfavpost = await ctx.call("favoritespost.findUserPost", { firebaseID: firebaseID, postID: postID });
                        const ctxcomment = await ctx.call("postcomment.getlatest", { postID: postID });
                        temp[k].commentData = ctxcomment["comment"];
                        temp[k].comments = ctxcomment["total"];
                        temp[k].isfav = ctxfavpost["found"];
                    }

                    var finalResult = [];
                    await temp.forEach(function (item, index) {
                        if (item.postMedia.length > 0) {
                            item.postMedia.forEach(function (slideItem, slideIndex) {
                                var _options = slideItem.options;
                                if (_options != null) {

                                    var _hashTag = _options.hashTag;
                                    if (_hashTag != null) {
                                        finalResult.push(item);
                                    }
                                }
                            });
                        }
                    });


                    temp = finalResult;
                }

                var result = [];
                if (temp != undefined && temp.length > 0) {
                    var totalPages = 1;
                    var totalRecords = temp.length;
                    totalPages = Math.ceil((totalRecords / page_size));

                    if (page_number <= totalPages)
                        result = temp.slice((page_number - 1) * page_size, page_number * page_size);

                    if (page_number != 1) {
                        var oldpno = page_number - 1;
                        var viewtemp = [];
                        viewtemp = temp.slice((oldpno - 1) * page_size, oldpno * page_size);
                        for (var p = 0; p < viewtemp.length; p++) {
                            var vpostID = viewtemp[p]._id.toString();
                            const ctxpview = await this.broker.call("postviewed.create", { firebaseID: firebaseID, postID: vpostID });
                        }
                    }
                }

                return { status: 200, message: "success", totalPages: totalPages, data: result, userHash };

            },
        },
        //* changed
        suggestedPost: {
            params: {
                firebaseID: { type: "string" },
                page: { type: "number" },
                limit: { type: "number" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var firebaseID = ctx.params.firebaseID;
                var page_size = ctx.params.limit;
                var page_number = ctx.params.page;


                const ctxhash = await ctx.call("user.listHash", { firebaseID: firebaseID });
                var userHash = ctxhash["data"];

                // var temp = await this.adapter.find().project({ shareType: 'shareofworld' });
                // var temp = await this.adapter.find({},{ shareType: 'shareofworld' });

                var temp = await this.adapter.find({ query: { shareType: 'shareofworld' } });
                var temp = temp.sort((a, b) => b.createdAt - a.createdAt);
                console.log("Posts RRKK", temp);

                var newResult = [];
                const ctxfireuser = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                var blockID = ctxfireuser["result"][0]["blockedUserId"];

                if (blockID) {
                    if (temp != undefined && temp.length > 0) {
                        for (var j = 0; j < temp.length; j++) {
                            if (typeof blockID === "undefined" || !blockID.includes(temp[j].firebaseID)) {
                                var creatorUser = temp[j].firebaseID;
                                let ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: creatorUser });
                                if (ctxdata["result"].length > 0) {
                                    if (ctxdata["result"][0].type === "creator" && (typeof ctxdata["result"][0].blockedUserId === "undefined" || !ctxdata["result"][0].blockedUserId.includes(firebaseID))) {
                                        newResult.push({ _id: temp[j]._id.toString(), firebaseID: temp[j].firebaseID });
                                    }
                                }
                            }
                        }
                    }
                    // temp = newResult;
                }



                if (temp != undefined && temp.length > 0) {

                    for (var k = 0; k < temp.length; k++) {
                        console.log('temp: ' + JSON.stringify(temp))
                        var isFollowed = false;
                        var postID = temp[k]._id.toString();
                        const ctxpost = await ctx.call("post.getbyID", { postID: postID });
                        temp[k] = ctxpost["result"];
                        let isMute = false;
                        if (ctxpost["result"].muteUsers) {
                            if (ctxpost["result"].muteUsers.includes(firebaseID)) {
                                isMute = true;
                            }
                        }
                        temp[k].ismute = isMute;

                        const ctxlike = await ctx.call("likepost.getLikeByMe", { firebaseID: firebaseID, postID: postID });
                        temp[k].isLikebyme = ctxlike["isLikebyme"];
                        var firebaseID = temp[k].firebaseID;
                        const ctxuser = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                        var fireuserName = '';
                        var fireuserAvatar = '';

                        if (ctxuser["result"].length > 0) {
                            fireuserName = ctxuser["result"][0]["fullname"];
                            temp[k].userName = fireuserName;
                            fireuserAvatar = ctxuser["result"][0]["avatar"];
                            temp[k].avatar = fireuserAvatar;

                            if (ctxuser["result"][0]["followers"]) {
                                var infollowors_count = ctxuser["result"][0]["followers"].length;
                                if (infollowors_count > 0) {
                                    for (var b = 0; b < infollowors_count; b++) {
                                        var infollowfireUser = ctxuser["result"][0]["followers"][b];
                                        if (infollowfireUser == firebaseID) {
                                            isFollowed = true;
                                        }
                                    }
                                }
                            }
                            temp[k].isFollowed = isFollowed;

                        }

                        const ctxfavpost = await ctx.call("favoritespost.findUserPost", { firebaseID: firebaseID, postID: postID });
                        const ctxcomment = await ctx.call("postcomment.getlatest", { postID: postID });
                        temp[k].commentData = ctxcomment["comment"];
                        temp[k].comments = ctxcomment["total"];
                        temp[k].isfav = ctxfavpost["found"];
                    }

                    var finalResult = [];
                    await temp.forEach(function (item, index) {
                        if (item.postMedia.length > 0) {
                            item.postMedia.forEach(function (slideItem, slideIndex) {
                                var _options = slideItem.options;
                                if (_options != null) {

                                    var _hashTag = _options.hashTag;
                                    if (_hashTag != null) {
                                        finalResult.push(item);
                                    }
                                }
                            });
                        }
                    });
                    // temp = finalResult;
                }
                var result = [];

                if (temp != undefined && temp.length > 0) {
                    var totalPages = 1;
                    var totalRecords = temp.length;
                    totalPages = Math.ceil((totalRecords / page_size));

                    if (page_number <= totalPages)
                        result = temp.slice((page_number - 1) * page_size, page_number * page_size);

                    if (page_number != 1) {
                        var oldpno = page_number - 1;
                        var viewtemp = [];
                        viewtemp = temp.slice((oldpno - 1) * page_size, oldpno * page_size);
                        for (var p = 0; p < viewtemp.length; p++) {
                            var vpostID = viewtemp[p]._id.toString();
                            const ctxpview = await this.broker.call("postviewed.create", { firebaseID: firebaseID, postID: vpostID });
                        }
                    }
                }
                console.log("result   ", result);

                return { status: 200, message: "success", totalPages: totalPages, data: result, userHash };

            },
        },
        mute: {
            params: {
                postID: { type: "string" },
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var entity = ctx.params.postID;

                var baseEntity = await this.adapter.findOne({ _id: new ObjectId(entity) });

                if (!baseEntity.muteUsers) {
                    baseEntity.muteUsers = [];
                    baseEntity.muteUsers.push(ctx.params.firebaseID);
                }
                else {
                    var userMutes = baseEntity.muteUsers;

                    userMutes = userMutes.filter(function (item, index, inputArray) {
                        return inputArray.indexOf(item) === index;
                    });

                    var existRecord = userMutes.includes(ctx.params.firebaseID);
                    if (!existRecord) {
                        baseEntity.muteUsers.push(ctx.params.firebaseID);
                    }
                }
                console.log("ID", baseEntity._id);
                const doc = await this.adapter.updateById(entity, { $set: { muteUsers: baseEntity.muteUsers, updatedAt: new Date() } });
                const user = await this.transformDocuments(ctx, {}, doc);
                var userEntity = this.entityChanged("updated", user, ctx).then(() => user);

                return { status: 200, message: "success" };

            },
        },
        unmute: {
            params: {
                postID: { type: "string" },
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var entity = ctx.params.postID;

                var baseEntity = await this.adapter.findOne({ _id: new ObjectId(entity) });

                if (baseEntity.muteUsers) {
                    var muteArray = baseEntity.muteUsers;

                    muteArray = muteArray.filter(function (item, index, inputArray) {
                        return inputArray.indexOf(item) === index;
                    });

                    var index = muteArray.indexOf(ctx.params.firebaseID);
                    if (index > -1) {
                        muteArray.splice(index, 1);
                    }

                    // baseEntity.mute.pop(ctx.params.firebaseID);
                    console.log("ID", baseEntity._id);
                    const doc = await this.adapter.updateById(entity, { $set: { muteUsers: muteArray, updatedAt: new Date() } });
                    const user = await this.transformDocuments(ctx, {}, doc);
                    var userEntity = this.entityChanged("updated", user, ctx).then(() => user);
                    return { status: 200, message: "success" };
                }
                else {
                    return { status: 201, message: "Mute Users not found!" };
                }

            },
        },
        getUserPosts: {
            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.firebaseID;

                var temp = await this.adapter.find({ query: { firebaseID: entity } });

                var result = [];
                if (temp != undefined && temp.length > 0) {

                    result = temp;
                }

                return { result };

            },
        },
        getbyID: {
            params: {
                postID: { type: "string" }
            },
            async handler(ctx) {

                let entity = ctx.params.postID;
                var result = [];


                var postresult = await this.adapter.findOne({ _id: new ObjectId(entity) });

                if (postresult != undefined) {
                    var favview_count = 0;
                    var callviewctxdata = await this.broker.call("postviewed.getViewPostCount", { postID: entity });
                    favview_count = callviewctxdata["totalRecords"];

                    postresult.views = favview_count;

                    var postShareCount = await this.adapter.find({
                        query: {
                            basePostID: entity,
                        }
                    });

                    if (!postresult.like) {
                        postresult.like = 0;
                    }

                    postresult.sharedCount = postShareCount.length;

                    if (!postresult.latestAction) {
                        postresult.latestAction = '';
                    }

                    if (postresult.groupID) {
                        var setgroup = postresult.groupID.split(',');
                        var finalResultData = [];
                        for (var i = 0; i < setgroup.length; i++) {
                            var searchuserdata = setgroup[i];
                            const ctxgroupfuser = await ctx.call("user.findFirebaseID", { firebaseID: searchuserdata });
                            var groupuserName = '';
                            var groupuserAvatar = '';

                            if (ctxgroupfuser["result"].length > 0) {
                                groupuserName = ctxgroupfuser["result"][0]["fullname"];
                                groupuserAvatar = ctxgroupfuser["result"][0]["avatar"];
                            }
                            finalResultData.push({ groupid: setgroup[i], groupName: groupuserName, groupAvatar: groupuserAvatar });
                        }
                        postresult.groupData = finalResultData;
                    }

                    if (postresult.likeFirebaseIDs) {
                        const ctxlikeuser = await ctx.call("likepost.getByPostID", { postID: entity });
                        postresult.likeData = ctxlikeuser["likeData"];
                    }


                    if (postresult.basePostID) {
                        postresult.isShared = true;
                        var bpostID = postresult.basePostID;
                        const ctxbuser = await ctx.call("post.getpostDetails", { postID: bpostID });
                        postresult.originalPostData = ctxbuser["postDetail"];
                    }

                    result = postresult;
                }

                return { result };

            },
        },
        getpostDetails: {
            params: {
                postID: { type: "string" }
            },
            async handler(ctx) {

                let entitypost = ctx.params.postID;
                var postDetail = [];
                var postreturn = [];


                var postdresult = await this.adapter.findOne({ _id: new ObjectId(entitypost) });

                if (postdresult != undefined) {
                    var firebaseID = postdresult.firebaseID;
                    const ctxuser = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                    var firegroupuserName = '';
                    var firegroupuserAvatar = '';
                    var firegid = '';

                    if (ctxuser["result"].length > 0) {
                        firegid = ctxuser["result"][0]["firebaseID"];
                        firegroupuserName = ctxuser["result"][0]["fullname"];
                        firegroupuserAvatar = ctxuser["result"][0]["avatar"];
                        postreturn.push({ firebaseID: firegid, userName: firegroupuserName, avatar: firegroupuserAvatar, createdAt: postdresult.createdAt });
                    }

                    postDetail = postreturn;
                }

                return { postDetail };

            },
        },
        updateData: {
            params: {
                postID: { type: "string" },
                latestAction: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var postID = ctx.params.postID;
                var temp = await this.adapter.findOne({ _id: new ObjectId(postID) });
                console.log("Post", temp);

                if (temp != undefined && temp._id != null && temp._id != "") {

                    temp.latestAction = ctx.params.latestAction;
                    temp.updatedAt = new Date();
                    const doc = await this.adapter.updateById(temp._id, { $set: temp });
                    const post = await this.transformDocuments(ctx, {}, doc);
                    var postEntity = await this.entityChanged("updated", post, ctx).then(() => post);

                    // return { status : 200, message : "success" };
                }
            },
        },
        userMedia: {
            params: {
                firebaseID: { type: "string" },
                mediatype: { type: "string" },
                page: { type: "number" },
                limit: { type: "number" }

            },
            async handler(ctx) {

                var result = [];
                console.log("Params", JSON.stringify(ctx.params));
                var page_size = ctx.params.limit;
                var page_number = ctx.params.page;
                var firebaseID = ctx.params.firebaseID;
                var mediatype = ctx.params.mediatype;

                var _temp = await this.adapter.find({ query: { firebaseID: firebaseID } });

                var temp = _temp.sort((a, b) => b.createdAt - a.createdAt);
                var tempImages = [];
                var finalResult = [];


                await temp.forEach(function (item, index) {
                    if (item.postMedia.length > 0) {
                        item.postMedia.forEach(function (slideItem, slideIndex) {
                            var pushItem = false;
                            var _background = slideItem.media;
                            // var _text = slideItem.text;
                            if (_background != null) {

                                var _bgtype = _background.mediaType;
                                if (mediatype == 'all') {
                                    pushItem = true;
                                } else {
                                    if (_bgtype == mediatype) {
                                        pushItem = true;
                                    }
                                }
                                if (pushItem) {

                                    var like = 0;
                                    if (item.like) {
                                        like = item.like;
                                    }
                                    var postm = [];
                                    postm.push(slideItem);

                                    finalResult.push({ _id: item._id, firebaseID: item.firebaseID, postMedia: postm, like: like });
                                }
                            }
                        });
                    }
                });

                tempImages = finalResult;

                if (tempImages.length > 0) {
                    for (var k = 0; k < tempImages.length; k++) {
                        var favview_count = 0;
                        var postDataId = tempImages[k]._id.toString();
                        var callviewctxdata = await ctx.call("postviewed.getViewPostCount", { postID: postDataId });
                        favview_count = callviewctxdata["totalRecords"];

                        tempImages[k].views = favview_count;

                        var firebaseID = tempImages[k].firebaseID;
                        const ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                        var fireuserName = '';

                        if (ctxdata["result"].length > 0) {
                            fireuserName = ctxdata["result"][0]["fullname"];
                            tempImages[k].userName = fireuserName;
                        }
                    }
                }

                var totalPages = 1;
                var totalRecords = tempImages.length;
                totalPages = Math.ceil((totalRecords / page_size));

                if (page_number <= totalPages)
                    result = tempImages.slice((page_number - 1) * page_size, page_number * page_size);


                return { status: 200, message: "success", totalPages: totalPages, data: result };

            },
        },
        userSocialv1: {
            params: {
                firebaseID: { type: "string" },
                socialType: { type: "string" },
                page: { type: "number" },
                limit: { type: "number" }
            },
            async handler(ctx) {

                var result = [];
                console.log("Params", JSON.stringify(ctx.params));
                var page_size = ctx.params.limit;
                var page_number = ctx.params.page;
                var firebaseID = ctx.params.firebaseID;
                var socialType = ctx.params.socialType;

                if (socialType == "group") {
                    var _temp = await this.adapter.find({ query: { groupID: firebaseID } });
                } else {
                    var _temp = await this.adapter.find({ query: { firebaseID: firebaseID } });
                }


                var temp = _temp.sort((a, b) => b.createdAt - a.createdAt);
                var tempImages = [];
                var finalResult = [];


                await temp.forEach(function (item, index) {
                    var like = 0;
                    var postm = [];
                    if (item.postMedia.length > 0) {
                        var _background = item.postMedia[0].media;
                        if (_background != null) {
                            if (item.like) {
                                like = item.like;
                            }
                            postm.push(item.postMedia[0]);
                        }

                        finalResult.push({ _id: item._id, firebaseID: item.firebaseID, postMedia: postm, like: like });
                    }
                });

                tempImages = finalResult;

                if (tempImages.length > 0) {
                    for (var k = 0; k < tempImages.length; k++) {
                        var favview_count = 0;
                        var postDataId = tempImages[k]._id.toString();
                        var callviewctxdata = await ctx.call("postviewed.getViewPostCount", { postID: postDataId });
                        favview_count = callviewctxdata["totalRecords"];
                        tempImages[k].views = favview_count;

                        var firebaseID = tempImages[k].firebaseID;
                        const ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                        var fireuserName = '';

                        if (ctxdata["result"].length > 0) {
                            fireuserName = ctxdata["result"][0]["fullname"];
                            tempImages[k].userName = fireuserName;
                        }
                    }
                }

                var totalPages = 1;
                var totalRecords = tempImages.length;
                totalPages = Math.ceil((totalRecords / page_size));

                if (page_number <= totalPages)
                    result = tempImages.slice((page_number - 1) * page_size, page_number * page_size);


                return { status: 200, message: "success", totalPages: totalPages, data: result };

            },
        },
        getSocialHash: {
            params: {
                firebaseID: { type: "string" },
                searchtext: { type: "string" },
                hashtext: { type: "string" }
            },
            async handler(ctx) {

                var result = [];
                console.log("Params", JSON.stringify(ctx.params));
                var firebaseID = ctx.params.firebaseID;
                console.log("+++++++++++++++++++++++++++++++++++++++");
                const ctxuserdata = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                var followers = [];

                // console.log("---------userData-----------", ctxuserdata);

                if (ctxuserdata["result"].length > 0) {
                    followers = ctxuserdata["result"][0]["followers"];
                }

                var _temp = await this.adapter.find({});

                var temp = _temp.sort((a, b) => b.createdAt - a.createdAt);

                // console.log("---------***temp**-----------", temp);


                // console.log("findImage", temp);
                var tempSearch = ctx.params.hashtext;
                console.log("tempSearch", ctx.params.hashtext);
                var textSearch = ctx.params.searchtext;
                console.log("textSearch", ctx.params.hashtext);

                var tempImages = [];
                var finalResult = [];

                if (textSearch != '') {
                    await temp.forEach(function (item, index) {
                        if (item.postMedia != undefined) {
                            if (item.postMedia.length != 0) {
                                var pushItem = false;
                                var hashFound = false;
                                var SearchFound = false;
                                item.postMedia.forEach(function (slideItem, slideIndex) {
                                    var _background = slideItem.media;
                                    var _options = slideItem.options;
                                    var _text = slideItem.text;
                                    if (_background != null) {

                                        var _bgtype = _background.mediaType;
                                        if (_options != null) {

                                            var _hashTag = _options.hashTag;
                                            if (_hashTag != null) {
                                                tempSearch = tempSearch.toLowerCase();

                                                for (var n = 0; n < _hashTag.length; n++) {
                                                    var hashData = _hashTag[n].hashName.toLowerCase();
                                                    //const ctxdata = await ctx.call("hashtag.getByID", { hashId: hashId });
                                                    //var hashData = ctxdata.hashName.toLowerCase();

                                                    if (hashData == tempSearch) {
                                                        hashFound = true;
                                                    }
                                                }
                                                if (hashFound) {
                                                    pushItem = true;
                                                }
                                            }
                                        }

                                        if (pushItem) {
                                            var stringData = "";
                                            if (_text != null) {
                                                stringData = _text.mediaCaption;
                                            }
                                            if (stringData != null) {
                                                stringData = stringData.toLowerCase();
                                                textSearch = textSearch.toLowerCase();
                                                var res = stringData.search(textSearch);
                                                if (res >= 0) {
                                                    SearchFound = true;
                                                }
                                            }
                                        }
                                    }
                                });
                            }
                            if (SearchFound) {
                                var like = 0;
                                if (item.like) {
                                    like = item.like;
                                }
                                var postm = [];
                                postm.push(item.postMedia[0]);
                                finalResult.push({ _id: item._id, firebaseID: item.firebaseID, postMedia: postm, like: like });
                            }
                        }
                    });

                } else {
                    await temp.forEach(function (item, index) {
                        console.log('=======================================')
                        console.log(JSON.stringify(item))
                        console.log('=======================================')
                        if (item.postMedia != undefined) {
                            if (item.postMedia.length > 0) {
                                var pushItem = false;
                                var hashFound = false;
                                item.postMedia.forEach(function (slideItem, slideIndex) {
                                    var _background = slideItem.media;
                                    var _options = slideItem.options;
                                    var _text = slideItem.text;
                                    if (_background != null) {

                                        var _bgtype = _background.mediaType;
                                        if (_options != null) {

                                            var _hashTag = _options.hashTag;
                                            if (_hashTag != null) {
                                                tempSearch = tempSearch.toLowerCase();

                                                for (var n = 0; n < _hashTag.length; n++) {
                                                    var hashData = _hashTag[n].hashName.toLowerCase();
                                                    //const ctxdata = await ctx.call("hashtag.getByID", { hashId: hashId });
                                                    //var hashData = ctxdata.hashName.toLowerCase();
                                                    console.log("hashData", hashData);

                                                    if (hashData == tempSearch) {
                                                        hashFound = true;
                                                    }
                                                }
                                                if (hashFound) {
                                                    pushItem = true;
                                                }
                                            }
                                        }
                                    }
                                });
                            }
                        }
                        if (pushItem) {
                            var like = 0;

                            if (item.like) {
                                like = item.like;
                            }
                            var postm = [];
                            console.log("---------***postm**-----------", postm);

                            postm.push(item.postMedia[0]);
                            finalResult.push({ _id: item._id, firebaseID: item.firebaseID, postMedia: postm, like: like });

                        }
                    });
                }

                tempImages = finalResult;
                if (tempImages.length > 0) {
                    for (var k = 0; k < tempImages.length; k++) {

                        var favview_count = 0;
                        var postDataId = tempImages[k]._id.toString();
                        var callviewctxdata = await ctx.call("postviewed.getViewPostCount", { postID: postDataId });
                        favview_count = callviewctxdata["totalRecords"];

                        tempImages[k].views = favview_count;

                        var firebaseID = tempImages[k].firebaseID;
                        const ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                        var fireuserName = '';

                        if (ctxdata["result"].length > 0) {
                            fireuserName = ctxdata["result"][0]["fullname"];
                            tempImages[k].userName = fireuserName;
                            // tempImages[k].accounttype = ctxdata["result"][0]["type"];
                        }
                    }
                }

                result = tempImages;

                console.log("---------***result**-----------", result);
                return result;

            },
        },
        getImageHash: {
            params: {
                firebaseID: { type: "string" },
                searchtext: { type: "string" },
                hashtext: { type: "string" }
            },
            async handler(ctx) {

                var result = [];
                // console.log("Params", JSON.stringify(ctx.params));
                var firebaseID = ctx.params.firebaseID;

                const ctxuserdata = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                var followers = [];

                if (ctxuserdata["result"].length > 0) {
                    followers = ctxuserdata["result"][0]["followers"];
                }

                var _temp = await this.adapter.find({});

                var temp = _temp.sort((a, b) => b.createdAt - a.createdAt);

                // console.log("findImage", temp);
                var tempSearch = ctx.params.hashtext;
                var textSearch = ctx.params.searchtext;

                var tempImages = [];
                var finalResult = [];

                if (textSearch != '') {
                    await temp.forEach(function (item, index) {
                        if (item.postMedia) {
                            if (item.postMedia.length > 0) {
                                item.postMedia.forEach(function (slideItem, slideIndex) {
                                    var pushItem = false;
                                    var SearchFound = false;
                                    var _background = slideItem.media;
                                    var _options = slideItem.options;
                                    var _text = slideItem.text;
                                    if (_background != null) {

                                        var _bgtype = _background.mediaType;
                                        if (_bgtype == 'picture') {
                                            if (_options != null) {

                                                var _hashTag = _options.hashTag;
                                                if (_hashTag != null) {
                                                    tempSearch = tempSearch.toLowerCase();
                                                    var hashFound = false;
                                                    for (var n = 0; n < _hashTag.length; n++) {
                                                        var hashData = _hashTag[n].hashName.toLowerCase();
                                                        //const ctxdata = await ctx.call("hashtag.getByID", { hashId: hashId });
                                                        //var hashData = ctxdata.hashName.toLowerCase();

                                                        if (hashData == tempSearch) {
                                                            hashFound = true;
                                                        }
                                                    }
                                                    if (hashFound) {
                                                        pushItem = true;
                                                    }
                                                }
                                            }
                                            if (pushItem) {
                                                var stringData = "";
                                                if (_text != null) {
                                                    stringData = _text.mediaCaption;
                                                }
                                                if (stringData != null) {
                                                    stringData = stringData.toLowerCase();
                                                    textSearch = textSearch.toLowerCase();
                                                    var res = stringData.search(textSearch);
                                                    if (res >= 0) {
                                                        SearchFound = true;
                                                    }
                                                }
                                            }

                                        }
                                        if (SearchFound) {
                                            var like = 0;
                                            if (item.like) {
                                                like = item.like;
                                            }
                                            var postm = [];
                                            postm.push(slideItem);
                                            finalResult.push({ _id: item._id, firebaseID: item.firebaseID, postMedia: postm, like: like });
                                        }
                                    }
                                });
                            }
                        }
                    });

                } else {
                    await temp.forEach(function (item, index) {
                        if (item.postMedia != undefined) {

                            if (item.postMedia.length > 0) {
                                item.postMedia.forEach(function (slideItem, slideIndex) {
                                    var pushItem = false;
                                    var _background = slideItem.media;
                                    var _options = slideItem.options;
                                    var _text = slideItem.text;
                                    if (_background != null) {

                                        var _bgtype = _background.mediaType;
                                        if (_bgtype == 'picture') {
                                            if (_options != null) {

                                                var _hashTag = _options.hashTag;
                                                if (_hashTag != null) {
                                                    tempSearch = tempSearch.toLowerCase();
                                                    var hashFound = false;
                                                    for (var n = 0; n < _hashTag.length; n++) {
                                                        var hashData = _hashTag[n].hashName.toLowerCase();
                                                        //const ctxdata = await ctx.call("hashtag.getByID", { hashId: hashId });
                                                        //var hashData = ctxdata.hashName.toLowerCase();

                                                        if (hashData == tempSearch) {
                                                            hashFound = true;
                                                        }
                                                    }
                                                    if (hashFound) {
                                                        pushItem = true;
                                                    }
                                                }
                                            }

                                        }
                                        if (pushItem) {
                                            var like = 0;
                                            if (item.like) {
                                                like = item.like;
                                            }
                                            var postm = [];
                                            postm.push(slideItem);
                                            finalResult.push({ _id: item._id, firebaseID: item.firebaseID, postMedia: postm, like: like });
                                        }
                                    }
                                });
                            }
                        }
                    });
                }

                tempImages = finalResult;
                if (tempImages.length > 0) {
                    for (var k = 0; k < tempImages.length; k++) {
                        var favview_count = 0;
                        var postDataId = tempImages[k]._id.toString();
                        var callviewctxdata = await ctx.call("postviewed.getViewPostCount", { postID: postDataId });
                        favview_count = callviewctxdata["totalRecords"];

                        tempImages[k].views = favview_count;

                        var firebaseID = tempImages[k].firebaseID;
                        const ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                        var fireuserName = '';

                        if (ctxdata["result"].length > 0) {
                            fireuserName = ctxdata["result"][0]["fullname"];
                            tempImages[k].userName = fireuserName;
                        }
                    }
                }

                result = tempImages;

                return result;

            },
        },
        getVideoHash: {
            params: {
                firebaseID: { type: "string" },
                searchtext: { type: "string" },
                hashtext: { type: "string" }
            },
            async handler(ctx) {

                var result = [];
                // console.log("Params", JSON.stringify(ctx.params));
                var firebaseID = ctx.params.firebaseID;

                const ctxuserdata = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                var followers = [];

                if (ctxuserdata["result"].length > 0) {
                    followers = ctxuserdata["result"][0]["followers"];
                }

                var _temp = await this.adapter.find({});

                var temp = _temp.sort((a, b) => b.createdAt - a.createdAt);

                // console.log("findImage", temp);
                var tempSearch = ctx.params.hashtext;
                var textSearch = ctx.params.searchtext;

                var tempImages = [];
                var finalResult = [];

                if (textSearch != '') {

                    await temp.forEach(function (item, index) {
                        if (item.postMedia) {
                            if (item.postMedia.length > 0) {
                                item.postMedia.forEach(function (slideItem, slideIndex) {
                                    var pushItem = false;
                                    var SearchFound = false;
                                    var _background = slideItem.media;
                                    var _options = slideItem.options;
                                    var _text = slideItem.text;
                                    if (_background != null) {

                                        var _bgtype = _background.mediaType;
                                        if (_bgtype == 'video') {
                                            if (_options != null) {

                                                var _hashTag = _options.hashTag;
                                                if (_hashTag != null) {
                                                    tempSearch = tempSearch.toLowerCase();
                                                    var hashFound = false;
                                                    for (var n = 0; n < _hashTag.length; n++) {
                                                        var hashData = _hashTag[n].hashName.toLowerCase();
                                                        //const ctxdata = await ctx.call("hashtag.getByID", { hashId: hashId });
                                                        //var hashData = ctxdata.hashName.toLowerCase();

                                                        if (hashData == tempSearch) {
                                                            hashFound = true;
                                                        }
                                                    }
                                                    if (hashFound) {
                                                        pushItem = true;
                                                    }
                                                }
                                            }
                                            if (pushItem) {
                                                var stringData = "";
                                                if (_text != null) {
                                                    stringData = _text.mediaCaption;
                                                }
                                                if (stringData != null) {
                                                    stringData = stringData.toLowerCase();
                                                    textSearch = textSearch.toLowerCase();
                                                    var res = stringData.search(textSearch);
                                                    if (res >= 0) {
                                                        SearchFound = true;
                                                    }
                                                }
                                            }

                                        }
                                        if (SearchFound) {

                                            var like = 0;
                                            if (item.like) {
                                                like = item.like;
                                            }
                                            var postm = [];
                                            postm.push(slideItem);
                                            finalResult.push({ _id: item._id, firebaseID: item.firebaseID, postMedia: postm, like: like });
                                        }
                                    }
                                });
                            }
                        }
                    });

                } else {
                    await temp.forEach(function (item, index) {
                        if (item.postMedia != undefined) {
                            if (item.postMedia.length > 0) {
                                item.postMedia.forEach(function (slideItem, slideIndex) {
                                    var pushItem = false;
                                    var _background = slideItem.media;
                                    var _options = slideItem.options;
                                    var _text = slideItem.text;
                                    if (_background != null) {

                                        var _bgtype = _background.mediaType;
                                        if (_bgtype == 'video') {
                                            if (_options != null) {

                                                var _hashTag = _options.hashTag;
                                                if (_hashTag != null) {
                                                    tempSearch = tempSearch.toLowerCase();
                                                    var hashFound = false;
                                                    for (var n = 0; n < _hashTag.length; n++) {
                                                        var hashData = _hashTag[n].hashName.toLowerCase();
                                                        //const ctxdata = await ctx.call("hashtag.getByID", { hashId: hashId });
                                                        //var hashData = ctxdata.hashName.toLowerCase();

                                                        if (hashData == tempSearch) {
                                                            hashFound = true;
                                                        }
                                                    }
                                                    if (hashFound) {
                                                        pushItem = true;
                                                    }
                                                }
                                            }

                                        }
                                        if (pushItem) {

                                            var like = 0;
                                            if (item.like) {
                                                like = item.like;
                                            }
                                            var postm = [];
                                            postm.push(slideItem);
                                            finalResult.push({ _id: item._id, firebaseID: item.firebaseID, postMedia: postm, like: like });
                                        }
                                    }
                                });
                            }
                        }
                    });
                }

                tempImages = finalResult;

                if (tempImages.length > 0) {
                    for (var k = 0; k < tempImages.length; k++) {

                        var favview_count = 0;
                        var postDataId = tempImages[k]._id.toString();
                        var callviewctxdata = await ctx.call("postviewed.getViewPostCount", { postID: postDataId });
                        favview_count = callviewctxdata["totalRecords"];

                        tempImages[k].views = favview_count;
                        var firebaseID = tempImages[k].firebaseID;
                        const ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                        var fireuserName = '';

                        if (ctxdata["result"].length > 0) {
                            fireuserName = ctxdata["result"][0]["fullname"];
                            tempImages[k].userName = fireuserName;
                        }
                    }
                }

                result = tempImages;

                return result;

            },
        },
        getSharePosts: {
            params: {
                basePostID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.basePostID;

                var temp = await this.adapter.find({ query: {} });

                var result = [];
                var finaldata = [];
                if (temp != undefined && temp.length > 0) {
                    for (var k = 0; k < temp.length; k++) {
                        if (temp[k].basePostID) {
                            if (temp[k].basePostID == entity) {
                                finaldata.push(temp[k]);
                            }
                        }

                    }
                }
                result = finaldata;
                return { result };

            },
        },
        offNoti: {
            params: {
                postID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.postID;

                const doc = await this.adapter.updateById(entity, { $set: { isNotificationOff: true, updatedAt: new Date() } });

                return { status: 200, message: "success", data: doc }
            },
        },
        onNoti: {
            params: {
                postID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.postID;

                const doc = await this.adapter.updateById(entity, { $set: { isNotificationOff: false, updatedAt: new Date() } });

                return { status: 200, message: "success", data: doc }
            },
        },

    },

    /**
     * Events
     */
    events: {

    },

    /**
     * Methods
     */
    methods: {
        getUniqueMediaID(length) {
            return Math.random().toString(20).substr(2, length)
        }

    },

    /**
     * Service created lifecycle event handler
     */
    created() {

    },

    /**
     * Service started lifecycle event handler
     */
    async started() {

    },

    /**
     * Service stopped lifecycle event handler
     */
    async stopped() {

    }
};
