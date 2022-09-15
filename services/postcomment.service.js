"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
// const bcrypt   = require("bcrypt");
const jwt = require("jsonwebtoken");
const { ServiceBroker } = require("moleculer");
const DbService = require("../mixins/db.mixin");
const broker = new ServiceBroker();
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
    name: "postcomment",
    mixins: [DbService("postcomment")],

    /**
     * Settings
     */
    settings: {
        /** Public fields */
        fields: ["_id", "postID", "firebaseID", "comment"],
        /** Validator schema for entity */
        entityValidator: {
            comment: { type: "string" }
        }
    },

    /**
     * Dependencies
     */
    dependencies: [],

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
                // await this.validateEntity(entity);

                entity.angryReactionCount = 0;
                entity.funnyReactionCount = 0;
                entity.loveReactionCount = 0;
                entity.sadReactionCount = 0;
                entity.wowReactionCount = 0;
                entity.latestReactionType = '';
                entity.isReport = false;
                entity.isHide = false;

                entity.createdAt = new Date();
                entity.updatedAt = entity.createdAt;

                let noti_data = {};
                let userpost = await ctx.call("post.getbyID", { postID: entity.postID });
                let postOwner = await ctx.call("user.findFirebaseID", { firebaseID: userpost.result.firebaseID });
                let user = await ctx.call("user.findFirebaseID", { firebaseID: entity.firebaseID });

                let fireuserName = '';
                let fireuserAvatar = '';

                if (user["result"].length > 0) {
                    fireuserName = user["result"][0]["fullname"];
                    fireuserAvatar = user["result"][0]["avatar"];
                }
                if (userpost.result.isNotificationOff == undefined || !userpost.result.isNotificationOff) {

                    noti_data.TofirebaseID = userpost.result.firebaseID;
                    noti_data.FromfirebaseID = entity.firebaseID;
                    noti_data.type = "commneted";
                    noti_data.msg = fireuserName + " commneted on your post";
                    noti_data.read = false;
                    noti_data.details = {
                        fireuserName: fireuserName,
                        fireuserAvatar: fireuserAvatar
                    }
                    noti_data.createdAt = new Date();

                    const noti = await ctx.call("notification.create", { data: noti_data });
                    const badge = await ctx.call("notification.badge", { firebaseID: userpost.result.firebaseID });

                    let playerID = [];
                    playerID.push(postOwner["result"][0]["pushId"]);
                    let message = {
                        app_id: _const.appId,
                        ios_badgeType: "SetTo",
                        ios_badgeCount: badge.count,
                        contents: { "en": fireuserName + " commented on your post" },
                        include_player_ids: playerID,
                        data: { "type": "comment", "postID": entity.postID, "firebaseID": entity.firebaseID, "page": 1, "limit": 5, "orderby": "", "reactionType": "all" }
                    }
                    _const.sendNotification(message);
                }


                const doc = await this.adapter.insert(entity);
                const post = await this.transformDocuments(ctx, {}, doc);
                var postEntity = await this.entityChanged("created", post, ctx).then(() => post);

                console.log("Post", postEntity);

                let _userTag = entity.userTag;
                if (_userTag) {
                    if (_userTag.length > 0) {
                        for (let i = 0; i < _userTag.length; i++) {
                            let firebaseID = _userTag[i].firebaseID;
                            let tagUser = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                            let Noti_data = {
                                TofirebaseID: firebaseID,
                                FromfirebaseID: entity.firebaseID,
                                type: "tag comment",
                                msg: fireuserName + " tagged you in comment",
                                read: false,
                                details: {
                                    fireuserName: fireuserName,
                                    fireuserAvatar: fireuserAvatar
                                },
                                createdAt: new Date()
                            };
                            let noti = await ctx.call("notification.create", { data: Noti_data });
                            const badge = await ctx.call("notification.badge", { firebaseID: firebaseID });

                            let playerID = [];
                            playerID.push(tagUser["result"][0]["pushId"]);
                            let message = {
                                app_id: _const.appId,
                                ios_badgeType: "SetTo",
                                ios_badgeCount: badge.count,
                                contents: { "en": fireuserName + " tagged you in comment" },
                                include_player_ids: playerID,
                                data: { "type": "tagged in comment", "commentID": doc._id, "postID": entity.postID, "firebaseID": entity.firebaseID, "page": 1, "limit": 5, "orderby": "", "reactionType": "all" }
                            }
                            _const.sendNotification(message);

                        }
                    }
                }

                const ctxpost = await ctx.call("post.updateData", { postID: ctx.params.data.postID, latestAction: 'comment' });

                return { status: 200, message: "success", data: { postEntity } };

            },
        },
        mediaUpload: {
            params: {
                baseString: { type: "string" },
                thumbString: { type: "string" },
                fileName: { type: "string" },
                filetype: { type: "string" }
            },
            handler(ctx) {
                console.log("List of params", ctx.params);
                var uploadDir;
                var entity = ctx.params;
                var base64Data = entity.baseString;
                var thumbbase64Data = entity.thumbString;

                //var _path = "/root/moleculer-demo/public";

                uploadDir = process.env.POST_COMMENT_PATH;
                //uploadDir = "D:/Projects/admin-dashboard-Backend/public/profileImanges";

                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir);
                }

                const imageBufferData = Buffer.from(base64Data, 'base64');
                var streamObj = new ReadableData();
                streamObj.push(imageBufferData);
                streamObj.push(null);

                var fname = entity.fileName.split('.')[0];
                var extension = entity.fileName.split('.')[1];
                var tempVideoName = fname + "_" + Date.now() + "." + extension;

                const filePath = path.join(uploadDir, tempVideoName);
                streamObj.pipe(fs.createWriteStream(filePath));



                const thumbimageBufferData = Buffer.from(thumbbase64Data, 'base64');
                var thumbstreamObj = new ReadableData();
                thumbstreamObj.push(thumbimageBufferData);
                thumbstreamObj.push(null);

                //var thumbextension = 'jpg';
                if (entity.filetype == 'video') {
                    extension = 'jpg';
                }
                var tempThumbName = fname + "thumb_" + Date.now() + "." + extension;

                const thumbfilePath = path.join(uploadDir, tempThumbName);
                thumbstreamObj.pipe(fs.createWriteStream(thumbfilePath));

                // const thumbnail =  imageThumbnail(base64Data);
                // const stream = fs.createReadStream(filePath)

                //const thumbnail =  imageThumbnail(stream);

                var mediaUrl = process.env.POST_COMMENT_URL + tempVideoName;
                var mediaThumbUrl = process.env.POST_COMMENT_URL + tempThumbName;

                return { status: 200, message: "success", data: { mediaUrl: mediaUrl, mediaThumbUrl: mediaThumbUrl } };

            }
        },
        update: {
            params: {
                data: { type: "object" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.data;
                //await this.validateEntity(entity);

                //entity.createdAt = new Date();
                //entity.updatedAt = entity.createdAt;
                //const doc = await this.adapter.insert(entity);
                //const post = await this.transformDocuments(ctx, {}, doc);
                //var postEntity = await this.entityChanged("created", post, ctx).then(() => post);

                var commentID = entity._id;
                console.log("Post ID", commentID);
                var temp = await this.adapter.findOne({ _id: new ObjectId(commentID) });
                console.log("Post", temp);

                if (temp != undefined && temp._id != null && temp._id != "") {
                    console.log("ID", temp._id);
                    delete entity._id;
                    var newPost = entity;
                    newPost.updatedAt = new Date();
                    const doc = await this.adapter.updateById(temp._id, { $set: newPost });
                    const post = await this.transformDocuments(ctx, {}, doc);
                    var postEntity = await this.entityChanged("updated", post, ctx).then(() => post);
                    return { status: 200, message: "success", data: doc };
                }
                else {
                    return { status: 201, message: "Comment not found!" };
                }
            },
        },
        delete: {
            params: {
                commentID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.commentID;

                var deletedEntity = await this.adapter.removeById(entity);

                if (deletedEntity)
                    return { status: 200, message: "Post comment deleted successfully!" };
                else
                    return { status: 201, message: "Post comment delete failed!" };

            },
        },
        //* Chnaged
        getAll: {
            params: {
                postID: { type: "string" },
                firebaseID: { type: "string" },
                page: { type: "number" },
                limit: { type: "number" },
                orderby: { type: "string" },
                reactionType: { type: "string" },
                //userFirebaseID:{type:"string"}
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var postID = ctx.params.postID;
                var firebaseID = ctx.params.firebaseID;
                var page_size = ctx.params.limit;
                var page_number = ctx.params.page;
                var orderby = ctx.params.orderby;
                var reactionType = ctx.params.reactionType;

                var temp = await this.adapter.find({ query: { postID: postID, isHide: false } });

                var temp = temp.sort((a, b) => b.createdAt - a.createdAt);

                console.log("Posts", temp);
                var totalPages = 1;
                var result = [];
                var allReactdata = {};
                var tempResult = [];

                const ctxuser = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                var blockID = ctxuser["result"][0].blockedUserId;
                if (temp.length > 0) {
                    var allreact = 0;
                    var allangryreact = 0;
                    var allfunnyreact = 0;
                    var alllovereact = 0;
                    var allsadreact = 0;
                    var allwowreact = 0;

                    for (var k = 0; k < temp.length; k++) {
                        if (typeof blockID === "undefined" || !blockID.includes(temp[k].firebaseID)) {
                            let _firebaseID = temp[k].firebaseID;
                            let ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: _firebaseID });
                            if (ctxdata["result"].length > 0) {
                                if (typeof ctxdata["result"][0].blockedUserId === "undefined" || !ctxdata["result"][0].blockedUserId.includes(firebaseID)) {

                                    allangryreact += temp[k].angryReactionCount;
                                    allfunnyreact += temp[k].funnyReactionCount;
                                    alllovereact += temp[k].loveReactionCount;
                                    allsadreact += temp[k].sadReactionCount;
                                    allwowreact += temp[k].wowReactionCount;

                                    console.log('temp[k]._id=>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>')
                                    console.log(temp[k]._id)
                                    console.log('temp[k]._id=>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>')

                                    const getReactionByMe = await ctx.call("postcommentreaction.getReactionByMe", {
                                        firebaseID: ctx.params.firebaseID,
                                        commentID: temp[k]._id.toString(),
                                        reactionType: ctx.params.reactionType
                                    });
                                    temp[k].IsangryReaction = getReactionByMe.data.angry;
                                    temp[k].IsfunnyReaction = getReactionByMe.data.funny;
                                    temp[k].IsloveReaction = getReactionByMe.data.love;
                                    temp[k].IssadReaction = getReactionByMe.data.sad;
                                    temp[k].IswowReaction = getReactionByMe.data.wow;
                                    var fireuserName = '';
                                    var fireavatar = '';

                                    if (ctxdata["result"].length > 0) {
                                        fireuserName = ctxdata["result"][0]["fullname"];
                                        fireavatar = ctxdata["result"][0]["avatar"];
                                        temp[k].userName = fireuserName;
                                        temp[k].avatar = fireavatar;
                                    }

                                    if (reactionType == 'all') {
                                        tempResult.push(temp[k]);
                                    } else if (reactionType == 'angry') {
                                        if (temp[k].angryReactionCount > 0) {
                                            tempResult.push(temp[k]);
                                        }

                                    } else if (reactionType == 'funny') {
                                        if (temp[k].funnyReactionCount > 0) {
                                            tempResult.push(temp[k]);
                                        }

                                    } else if (reactionType == 'love') {
                                        if (temp[k].loveReactionCount > 0) {
                                            tempResult.push(temp[k]);
                                        }

                                    } else if (reactionType == 'sad') {
                                        if (temp[k].sadReactionCount > 0) {
                                            tempResult.push(temp[k]);
                                        }

                                    } else if (reactionType == 'wow') {
                                        if (temp[k].wowReactionCount > 0) {
                                            tempResult.push(temp[k]);
                                        }

                                    }
                                }
                            }
                        }


                    }
                    allreact = (allangryreact + allfunnyreact + alllovereact + allsadreact + allwowreact);

                    allReactdata['All'] = allreact;
                    allReactdata['Angry'] = allangryreact;
                    allReactdata['Funny'] = allfunnyreact;
                    allReactdata['Love'] = alllovereact;
                    allReactdata['Sad'] = allsadreact;
                    allReactdata['Wow'] = allwowreact;

                }

                temp = tempResult;
                if (orderby == 'desc') {
                    temp = temp.sort((a, b) => b.createdAt - a.createdAt);
                } else if (orderby == 'asc') {
                    temp = temp.sort((a, b) => a.createdAt - b.createdAt);
                }

                if (temp != undefined && temp.length > 0) {

                    var totalRecords = temp.length;
                    totalPages = Math.ceil((totalRecords / page_size));

                    if (page_number <= totalPages)
                        result = temp.slice((page_number - 1) * page_size, page_number * page_size);
                }

                return { status: 200, message: "success", totalPages: totalPages, reactdata: allReactdata, data: result };

            },
        },
        commentReact: {
            params: {
                commentID: { type: "string" },
                firebaseID: { type: "string" },
                reactionType: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.commentID;
                var reactionType = ctx.params.reactionType;

                var temp = await this.adapter.findOne({ _id: new ObjectId(entity) });
                console.log("Post", temp);

                const reactUser = await ctx.call("user.findFirebaseID", { firebaseID: ctx.params.firebaseID });
                var react_fireuserName = '';
                var react_fireavatar = '';
                if (reactUser["result"].length > 0) {
                    react_fireuserName = reactUser["result"][0]["fullname"];
                    react_fireavatar = reactUser["result"][0]["avatar"];
                }
                var firebaseID = temp.firebaseID;
                const ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                var fireuserName = '';
                var fireavatar = '';

                let noti_data = {
                    TofirebaseID: firebaseID,
                    FromfirebaseID: ctx.params.firebaseID,
                    type: "reacted",
                    msg: react_fireuserName + " reacted you comment",
                    read: false,
                    reactionType: reactionType,
                    details: {
                        fireuserName: react_fireuserName,
                        fireuserAvatar: react_fireavatar
                    },
                    createdAt: new Date()
                };

                const noti = await ctx.call("notification.create", { data: noti_data });
                const badge = await ctx.call("notification.badge", { firebaseID: firebaseID });

                let playerID = [];
                playerID.push(ctxdata["result"][0]["pushId"]);
                let message = {
                    app_id: _const.appId,
                    ios_badgeType: "SetTo",
                    ios_badgeCount: badge.count,
                    contents: { "en": react_fireuserName + " reacted your comment" },
                    include_player_ids: playerID,
                    data: { "type": "react comment", "commentID": entity, "postID": temp.postID, "firebaseID": ctx.params.firebaseID, "page": 1, "limit": 5, "orderby": "", "reactionType": "all" }
                }
                _const.sendNotification(message);

                if (ctxdata["result"].length > 0) {
                    fireuserName = ctxdata["result"][0]["fullname"];
                    fireavatar = ctxdata["result"][0]["avatar"];
                    temp.userName = fireuserName;
                    temp.avatar = fireavatar;
                }

                await ctx.call("postcommentreaction.createreaction", {
                    firebaseID: ctx.params.firebaseID,
                    commentID: ctx.params.commentID,
                    reactionType: ctx.params.reactionType
                });
                const getReactionCount = await ctx.call("postcommentreaction.getReactionCount", {
                    firebaseID: ctx.params.firebaseID,
                    commentID: ctx.params.commentID,
                    reactionType: ctx.params.reactionType
                });

                if (reactionType == 'angry') {
                    temp.angryReactionCount = getReactionCount.data;
                    temp.latestReactionType = 'angry';
                }
                if (reactionType == 'funny') {
                    temp.funnyReactionCount = getReactionCount.data;
                    temp.latestReactionType = 'funny';

                }
                if (reactionType == 'love') {
                    temp.loveReactionCount = getReactionCount.data;
                    temp.latestReactionType = 'love';

                }
                if (reactionType == 'sad') {
                    temp.sadReactionCount = getReactionCount.data;
                    temp.latestReactionType = 'sad';

                }
                if (reactionType == 'wow') {
                    temp.wowReactionCount = getReactionCount.data;
                    temp.latestReactionType = 'wow';

                }

                temp.updatedAt = new Date();
                const doc = await this.adapter.updateById(temp._id, { $set: temp });
                const post = await this.transformDocuments(ctx, {}, doc);
                // var postEntity = await this.entityChanged("updated", post, ctx).then(() => post);
                const getReactionByMe = await ctx.call("postcommentreaction.getReactionByMe", {
                    firebaseID: ctx.params.firebaseID,
                    commentID: ctx.params.commentID,
                    reactionType: ctx.params.reactionType
                });
                doc.IsangryReaction = getReactionByMe.data.angry;
                doc.IsfunnyReaction = getReactionByMe.data.funny;
                doc.IsloveReaction = getReactionByMe.data.love;
                doc.IssadReaction = getReactionByMe.data.sad;
                doc.IswowReaction = getReactionByMe.data.wow;
                return { status: 200, message: "success", data: doc };

            },
        },

        getlatest: {
            params: {
                postID: { type: "string" }
            },
            async handler(ctx) {

                var postID = ctx.params.postID;

                var temp = await this.adapter.find({ query: { postID: postID } });
                var totalcomments = 0;
                var result = {};

                if (temp != undefined && temp.length > 0) {
                    for (var k = 0; k < temp.length; k++) {
                        var firebaseID = temp[k].firebaseID;
                        const ctxuser = await ctx.call("user.findFirebaseID", { firebaseID: firebaseID });
                        var fireuserName = '';
                        var fireuserAvatar = '';

                        if (ctxuser["result"].length > 0) {
                            fireuserName = ctxuser["result"][0]["fullname"];
                            temp[k].userName = fireuserName;
                            fireuserAvatar = ctxuser["result"][0]["avatar"];
                            temp[k].avatar = fireuserAvatar;

                        }
                    }
                }

                if (temp != undefined && temp.length > 0) {
                    totalcomments = temp.length;
                    //temp = temp.sort((a, b) => b.createdAt - a.createdAt);
                    result = temp[temp.length - 1];
                }

                return { total: totalcomments, comment: result };

            }

        },
        deleteByPost: {
            params: {
                postID: { type: "string" }
            },
            async handler(ctx) {
                var baseEntity = await this.adapter.findOne({ postID: ctx.params.postID });

                if (baseEntity) {
                    let entity = baseEntity._id;
                    var deletedEntity = await this.adapter.removeById(entity);
                }
                return { status: 200, message: "Post Comment deleted successfully!" };
            },
        },
        deleteByUser: {
            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {
                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID });

                if (baseEntity) {
                    let entity = baseEntity._id;
                    var deletedEntity = await this.adapter.removeById(entity);
                }
                return { status: 200, message: "Post Comment deleted successfully!" };
            },
        },
        hideComment: {
            params: {
                commentID: { type: "string" }
            },
            async handler(ctx) {
                var temp = await this.adapter.findOne({ _id: new ObjectId(ctx.params.commentID) });
                console.log(temp);
                if (temp != undefined && temp._id != null && temp._id != "") {
                    let entity = {
                        "isHide": true,
                        "updatedAt": new Date()
                    }
                    console.log("ID", temp._id);
                    const doc = await this.adapter.updateById(temp._id, { $set: entity });
                    const post = await this.transformDocuments(ctx, {}, doc);
                    var postEntity = await this.entityChanged("updated", post, ctx).then(() => post);
                    return { status: 200, message: "success", data: doc };
                }
                else {
                    return { status: 201, message: "Comment not found!" };
                }
            }
        },
        getUserPostComments: {
            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {
                let comment = await this.adapter.find({ query: { firebaseID: ctx.params.firebaseID, postID: ctx.params.postID } });
                var result = [];
                if (comment != undefined && comment.length > 0) {

                    result = comment;
                }

                return { result };
            }
        },
        getUserComments: {
            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {
                let comment = await this.adapter.find({ query: { firebaseID: ctx.params.firebaseID } });
                var result = [];
                if (comment != undefined && comment.length > 0) {

                    result = comment;
                }

                return { result };
            }
        }
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
