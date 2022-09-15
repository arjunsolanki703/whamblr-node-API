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
    name: "user",
    mixins: [DbService("user")],

    /**
     * Settings
     */
    settings: {
        /** Public fields */
        fields: ["_id", "firebaseID", "country", "countryCode", "email", "phone", "fullname", "type", "userName", "avatar", "ageUnder", "ageOlder", "followers", "following", "blockedUserId", "members"],
        /** Validator schema for entity */
        entityValidator: {
            firebaseID: { type: "string" },
            fullname: { type: "string" },
            userName: { type: "string" },
            type: { type: "string" },
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
                await this.validateEntity(entity);

                var temp = await this.adapter.find({ query: { firebaseID: entity.firebaseID } });
                console.log("User", temp);

                if (temp != undefined && temp.length > 0) {
                    console.log("ID", temp[0]._id);
                    const data = await this.adapter.updateById(temp[0]._id, { $set: { avatar: entity.avatar, fullname: entity.fullname, userName: entity.userName, type: entity.type, updatedAt: new Date() } });
                    const user = await this.transformDocuments(ctx, {}, data);
                    var userEntity = this.entityChanged("updated", user, ctx).then(() => user);
                    return { status: 201, message: "user already exists", data: data };
                }
                else {
                    entity.isPrimaryProfile = true;
                    entity.createdAt = new Date();
                    entity.updatedAt = entity.createdAt;
                    entity.isAllowIncomingChat = true;
                    entity.isOnline = true;
                    entity.isAvatarChat = true;
                    entity.isShowPhone = false;
                    if (entity.type === "business" || entity.type === "group") {
                        entity.isOnline = false;
                    }
                    if (entity.type === "business") {
                        entity.isShowPhone = true;
                    }

                    const data = await this.adapter.insert(entity);
                    const user = await this.transformDocuments(ctx, {}, data);
                    var userEntity = this.entityChanged("created", user, ctx).then(() => user);
                    return { status: 200, message: "success", data: data };
                }
            },
        },
        pushIdupdate: {
            params: {
                firebaseID: { type: "string" },
                pushId: { type: "string" }
            },
            async handler(ctx) {
                var temp = await this.adapter.find({ query: { firebaseID: ctx.params.firebaseID } });
                console.log("User", temp);
                let entity = temp[0];
                let userid = temp[0]._id;
                if (temp != undefined && temp.length > 0) {
                    console.log("ID", temp[0]._id);
                    delete entity._id;
                    entity.pushId = ctx.params.pushId;
                    entity.updatedAt = new Date();
                    const data = await this.adapter.updateById(userid, { $set: entity });
                    const user = await this.transformDocuments(ctx, {}, data);
                    var userEntity = await this.entityChanged("updated", user, ctx).then(() => user);
                    return { status: 200, message: "success" };
                }
            }
        },
        profile: {
            params: {
                data: { type: "object" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.data;
                //await this.validateEntity(entity);

                var temp = await this.adapter.find({ query: { firebaseID: entity.primaryObjectId } });
                console.log("User", temp);

                if (temp != undefined && temp.length > 0) {
                    entity.isPrimaryProfile = false;
                    entity.createdAt = new Date();
                    const data = await this.adapter.insert(entity);
                    const user = await this.transformDocuments(ctx, {}, data);
                    var userEntity = this.entityChanged("created", user, ctx).then(() => user);

                    console.log("ID", temp[0]._id);
                    if (!temp[0].profiles) {
                        temp[0].profiles = [];
                        temp[0].profiles.push(data._id.toString());

                    } else {
                        temp[0].profiles.push(data._id.toString());
                    }

                    const pdata = await this.adapter.updateById(temp[0]._id, { $set: { profiles: temp[0].profiles, isPrimaryProfile: true, updatedAt: new Date() } });
                    const puser = await this.transformDocuments(ctx, {}, pdata);
                    var puserEntity = this.entityChanged("updated", puser, ctx).then(() => puser);
                    const updata = await this.adapter.updateById(data._id, { $set: { firebaseID: data._id.toString() } });
                    var returnval = [];
                    returnval.push(updata);
                    //const ctxgroupfuser = await ctx.call("user.findFirebaseID", { firebaseID: data._id.toString() });
                    return { status: 200, message: "profile added succesfully", data: returnval };
                }
                else {
                    return { status: 201, message: "User not found" };
                }

            },
        },
        delete: {
            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.firebaseID;

                var temp = await this.adapter.find({ query: { firebaseID: entity } });
                console.log("User", temp);

                if (temp != undefined && temp.length > 0) {
                    var userId = temp[0]._id;
                    if (temp[0].isPrimaryProfile) {
                        const ctxprofileuserdata = await ctx.call("user.getUserProfiles", { firebaseID: entity });
                        if (ctxprofileuserdata["result"].length > 0) {
                            for (var x = 0; x < ctxprofileuserdata["result"].length; x++) {
                                var deletesubId = ctxprofileuserdata["result"][x];

                                var callctxdata = await this.broker.call("user.getAll");

                                if (callctxdata["result"].length > 0) {
                                    var user_count = callctxdata["result"].length;
                                    for (var i = 0; i < user_count; i++) {
                                        if (callctxdata["result"][i]["mute"]) {

                                            var muteArray = callctxdata["result"][i]["mute"];

                                            muteArray = muteArray.filter(function (item, index, inputArray) {
                                                return inputArray.indexOf(item) === index;
                                            });

                                            var index = muteArray.indexOf(deletesubId);
                                            if (index > -1) {
                                                muteArray.splice(index, 1);
                                            }
                                            const doc = await this.adapter.updateById(callctxdata["result"][i]["_id"], { $set: { mute: muteArray, updatedAt: new Date() } });
                                        }
                                        if (callctxdata["result"][i]["followers"]) {

                                            var followersArray = callctxdata["result"][i]["followers"];

                                            followersArray = followersArray.filter(function (item, index, inputArray) {
                                                return inputArray.indexOf(item) === index;
                                            });

                                            var index = followersArray.indexOf(deletesubId);
                                            if (index > -1) {
                                                followersArray.splice(index, 1);
                                            }
                                            const doc = await this.adapter.updateById(callctxdata["result"][i]["_id"], { $set: { followers: followersArray, updatedAt: new Date() } });
                                        }
                                        if (callctxdata["result"][i]["following"]) {

                                            var followingArray = callctxdata["result"][i]["following"];

                                            followingArray = followingArray.filter(function (item, index, inputArray) {
                                                return inputArray.indexOf(item) === index;
                                            });

                                            var index = followingArray.indexOf(deletesubId);
                                            if (index > -1) {
                                                followingArray.splice(index, 1);
                                            }
                                            const doc = await this.adapter.updateById(callctxdata["result"][i]["_id"], { $set: { following: followingArray, updatedAt: new Date() } });
                                        }
                                        if (callctxdata["result"][i]["blockedUserId"]) {

                                            var blockArray = callctxdata["result"][i]["blockedUserId"];

                                            blockArray = blockArray.filter(function (item, index, inputArray) {
                                                return inputArray.indexOf(item) === index;
                                            });

                                            var index = blockArray.indexOf(deletesubId);
                                            if (index > -1) {
                                                blockArray.splice(index, 1);
                                            }
                                            const doc = await this.adapter.updateById(callctxdata["result"][i]["_id"], { $set: { blockedUserId: blockArray, updatedAt: new Date() } });
                                        }
                                        if (callctxdata["result"][i]["members"]) {
                                            var ctmembers = callctxdata["result"][i]["members"];
                                            var updatedmembers = [];
                                            for (var a = 0; a < ctmembers.length; a++) {
                                                if (deletesubId != ctmembers[a].firebaseID) {
                                                    updatedmembers.push(ctmembers[a]);
                                                }
                                            }
                                            const doc = await this.adapter.updateById(callctxdata["result"][i]["_id"], { $set: { members: updatedmembers, updatedAt: new Date() } });
                                        }


                                    }
                                }
                                // remove like view fav and comment of that user
                                var deletefavctxdata = await this.broker.call("favoritespost.deleteByUser", { firebaseID: deletesubId });
                                var deletelikectxdata = await this.broker.call("likepost.deleteByUser", { firebaseID: deletesubId });
                                var deleteviewctxdata = await this.broker.call("postviewed.deleteByUser", { firebaseID: deletesubId });
                                var deletecommentctxdata = await this.broker.call("postcomment.deleteByUser", { firebaseID: deletesubId });

                                var callpctxdata = await this.broker.call("post.getUserPosts", { firebaseID: deletesubId });

                                if (callpctxdata["result"].length > 0) {
                                    var post_count = callpctxdata["result"].length;
                                    for (var k = 0; k < post_count; k++) {
                                        var pid = callpctxdata["result"][k]["_id"].toString();

                                        var callsharectxdata = await this.broker.call("post.getSharePosts", { basePostID: pid });
                                        if (callsharectxdata["result"].length > 0) {
                                            // loop and remove all post and related data
                                            for (var j = 0; j < callsharectxdata["result"].length; j++) {
                                                var shareid = callsharectxdata["result"][j]["_id"].toString();
                                                var deletesfavctxdata = await this.broker.call("favoritespost.deleteByPost", { postID: shareid });
                                                var deleteslikectxdata = await this.broker.call("likepost.deleteByPost", { postID: shareid });
                                                var deletesviewctxdata = await this.broker.call("postviewed.deleteByPost", { postID: shareid });
                                                var deletescommentctxdata = await this.broker.call("postcomment.deleteByPost", { postID: shareid });
                                                var deletesharectxdata = await this.broker.call("post.deleted", { postID: shareid });
                                            }
                                        }
                                        var deletepfavctxdata = await this.broker.call("favoritespost.deleteByPost", { postID: pid });
                                        var deleteplikectxdata = await this.broker.call("likepost.deleteByPost", { postID: pid });
                                        var deletepviewctxdata = await this.broker.call("postviewed.deleteByPost", { postID: pid });
                                        var deletepcommentctxdata = await this.broker.call("postcomment.deleteByPost", { postID: pid });
                                        var deletepostctxdata = await this.broker.call("post.deleted", { postID: pid });
                                    }

                                }

                            }


                        }
                    }

                    // take users Primary profile and updte Profiles from that
                    if (temp[0].primaryObjectId) {
                        var primaryId = temp[0].primaryObjectId;

                        const ctxprimaryuserdata = await ctx.call("user.findFirebaseID", { firebaseID: primaryId });
                        if (ctxprimaryuserdata["result"].length > 0) {
                            if (ctxprimaryuserdata["result"][0]["profiles"]) {
                                var priprofiles = ctxprimaryuserdata["result"][0]["profiles"];
                                var priprofilesId = ctxprimaryuserdata["result"][0]["_id"];

                                var index = priprofiles.indexOf(entity);
                                if (index > -1) {
                                    priprofiles.splice(index, 1);
                                }
                                const prdata = await this.adapter.updateById(priprofilesId, { $set: { profiles: priprofiles, updatedAt: new Date() } });
                            }
                        }
                    }

                    //remove entity from all users list
                    var callctxdata = await this.broker.call("user.getAll");

                    if (callctxdata["result"].length > 0) {
                        var user_count = callctxdata["result"].length;
                        for (var i = 0; i < user_count; i++) {
                            if (callctxdata["result"][i]["mute"]) {

                                var muteArray = callctxdata["result"][i]["mute"];

                                muteArray = muteArray.filter(function (item, index, inputArray) {
                                    return inputArray.indexOf(item) === index;
                                });

                                var index = muteArray.indexOf(entity);
                                if (index > -1) {
                                    muteArray.splice(index, 1);
                                }
                                const doc = await this.adapter.updateById(callctxdata["result"][i]["_id"], { $set: { mute: muteArray, updatedAt: new Date() } });
                            }
                            if (callctxdata["result"][i]["followers"]) {

                                var followersArray = callctxdata["result"][i]["followers"];

                                followersArray = followersArray.filter(function (item, index, inputArray) {
                                    return inputArray.indexOf(item) === index;
                                });

                                var index = followersArray.indexOf(entity);
                                if (index > -1) {
                                    followersArray.splice(index, 1);
                                }
                                const doc = await this.adapter.updateById(callctxdata["result"][i]["_id"], { $set: { followers: followersArray, updatedAt: new Date() } });
                            }
                            if (callctxdata["result"][i]["following"]) {

                                var followingArray = callctxdata["result"][i]["following"];

                                followingArray = followingArray.filter(function (item, index, inputArray) {
                                    return inputArray.indexOf(item) === index;
                                });

                                var index = followingArray.indexOf(entity);
                                if (index > -1) {
                                    followingArray.splice(index, 1);
                                }
                                const doc = await this.adapter.updateById(callctxdata["result"][i]["_id"], { $set: { following: followingArray, updatedAt: new Date() } });
                            }
                            if (callctxdata["result"][i]["blockedUserId"]) {

                                var blockArray = callctxdata["result"][i]["blockedUserId"];

                                blockArray = blockArray.filter(function (item, index, inputArray) {
                                    return inputArray.indexOf(item) === index;
                                });

                                var index = blockArray.indexOf(entity);
                                if (index > -1) {
                                    blockArray.splice(index, 1);
                                }
                                const doc = await this.adapter.updateById(callctxdata["result"][i]["_id"], { $set: { blockedUserId: blockArray, updatedAt: new Date() } });
                            }
                            if (callctxdata["result"][i]["members"]) {
                                var ctmembers = callctxdata["result"][i]["members"];
                                var updatedmembers = [];
                                for (var a = 0; a < ctmembers.length; a++) {
                                    if (entity != ctmembers[a].firebaseID) {
                                        updatedmembers.push(ctmembers[a]);
                                    }
                                }
                                const doc = await this.adapter.updateById(callctxdata["result"][i]["_id"], { $set: { members: updatedmembers, updatedAt: new Date() } });
                            }


                        }
                    }
                    // remove like view fav and comment of that user
                    var deletefavctxdata = await this.broker.call("favoritespost.deleteByUser", { firebaseID: entity });
                    var deletelikectxdata = await this.broker.call("likepost.deleteByUser", { firebaseID: entity });
                    var deleteviewctxdata = await this.broker.call("postviewed.deleteByUser", { firebaseID: entity });
                    var deletecommentctxdata = await this.broker.call("postcomment.deleteByUser", { firebaseID: entity });

                    var callpctxdata = await this.broker.call("post.getUserPosts", { firebaseID: entity });

                    if (callpctxdata["result"].length > 0) {
                        var post_count = callpctxdata["result"].length;
                        for (var k = 0; k < post_count; k++) {
                            var pid = callpctxdata["result"][k]["_id"].toString();

                            var callsharectxdata = await this.broker.call("post.getSharePosts", { basePostID: pid });
                            if (callsharectxdata["result"].length > 0) {
                                // loop and remove all post and related data
                                for (var j = 0; j < callsharectxdata["result"].length; j++) {
                                    var shareid = callsharectxdata["result"][j]["_id"].toString();
                                    var deletesfavctxdata = await this.broker.call("favoritespost.deleteByPost", { postID: shareid });
                                    var deleteslikectxdata = await this.broker.call("likepost.deleteByPost", { postID: shareid });
                                    var deletesviewctxdata = await this.broker.call("postviewed.deleteByPost", { postID: shareid });
                                    var deletescommentctxdata = await this.broker.call("postcomment.deleteByPost", { postID: shareid });
                                    var deletesharectxdata = await this.broker.call("post.deleted", { postID: shareid });
                                }
                            }
                            var deletepfavctxdata = await this.broker.call("favoritespost.deleteByPost", { postID: pid });
                            var deleteplikectxdata = await this.broker.call("likepost.deleteByPost", { postID: pid });
                            var deletepviewctxdata = await this.broker.call("postviewed.deleteByPost", { postID: pid });
                            var deletepcommentctxdata = await this.broker.call("postcomment.deleteByPost", { postID: pid });
                            var deletepostctxdata = await this.broker.call("post.deleted", { postID: pid });
                        }

                    }

                    var deletedEntity = await this.adapter.removeById(userId);

                    if (deletedEntity)
                        return { status: 200, message: "User deleted successfully!" };
                    else
                        return { status: 201, message: "User delete failed!" };
                }

            },
        },
        findCustomUserID: {
            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.firebaseID;
                var result = [];

                var temp = await this.adapter.find({ query: { firebaseID: entity } });
                console.log("User", temp);

                if (temp != undefined && temp.length > 0) {
                    const ctxactivesetting = await ctx.call("settings.getActive", { isActive: true });
                    if (ctxactivesetting["result"].length > 0) {
                        temp[0].settings = ctxactivesetting["result"][0];
                    }
                    result = temp;
                    return { status: 200, message: "success", found: true, data: result };
                }
                else {
                    return { status: 201, message: "failed", found: false, data: result };
                }

            },
        },
        profileImageUpload: {
            params: {
                firebaseID: { type: "string" },
                baseString: { type: "string" },
                imageName: { type: "string" }
            },
            handler(ctx) {
                console.log("List of params", ctx.params);
                var uploadDir;
                var entity = ctx.params;
                var base64Data = entity.baseString;

                //var _path = "/root/moleculer-demo/public";

                uploadDir = process.env.PROFILE_IMAGE_PATH;
                //uploadDir = "D:/Projects/admin-dashboard-Backend/public/profileImanges";

                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir);
                }

                const imageBufferData = Buffer.from(base64Data, 'base64');
                var streamObj = new ReadableData();
                streamObj.push(imageBufferData);
                streamObj.push(null);

                var extension = entity.imageName.split('.')[1];
                var secondTemp = Math.floor(Date.now() / 1000);
                var tempImageName = entity.firebaseID + "_" + secondTemp + "." + extension;

                const filePath = path.join(uploadDir, tempImageName);
                streamObj.pipe(fs.createWriteStream(filePath));

                var profileImageURL = process.env.PROFILE_IMAGE_URL + tempImageName;

                return { status: 200, message: "success", data: { profileimangeurl: profileImageURL } };

            }
        },
        backgroungImageUpload: {
            params: {
                userID: { type: "string" },
                firebaseID: { type: "string" },
                baseString: { type: "string" },
                imageName: { type: "string" }
            },
            async handler(ctx) {
                console.log("List of params", ctx.params);
                var uploadDir;
                var entity = ctx.params;
                var base64Data = entity.baseString;
                var firebaseID = entity.firebaseID;
                var userID = entity.userID;

                //var _path = "/root/moleculer-demo/public";

                uploadDir = process.env.PROFILE_IMAGE_PATH;
                //uploadDir = "D:/Projects/admin-dashboard-Backend/public/profileImanges";

                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir);
                }

                const imageBufferData = Buffer.from(base64Data, 'base64');
                var streamObj = new ReadableData();
                streamObj.push(imageBufferData);
                streamObj.push(null);

                var extension = entity.imageName.split('.')[1];
                var secondTemp = Math.floor(Date.now() / 1000);
                var tempImageName = "background_" + firebaseID + "_" + secondTemp + "." + extension;

                const filePath = path.join(uploadDir, tempImageName);
                streamObj.pipe(fs.createWriteStream(filePath));

                var backgroundImageURL = process.env.PROFILE_IMAGE_URL + tempImageName;

                var temp = await this.adapter.findOne({ _id: new ObjectId(userID) });

                if (temp != undefined && temp._id != null && temp._id != "") {
                    temp.backgroundImageURL = backgroundImageURL;
                    temp.updatedAt = new Date();
                    const data = await this.adapter.updateById(temp._id, { $set: temp });
                    const user = await this.transformDocuments(ctx, {}, data);
                    var userEntity = await this.entityChanged("updated", user, ctx).then(() => user);
                }
                // const ctxuser = await ctx.call("user.updateData", { firebaseID: firebaseID , backgroundImageURL : backgroundImageURL });

                return { status: 200, message: "success", data: { backgroundimageurl: backgroundImageURL } };

            }
        },
        findUser: {
            params: {
                firebaseID: { type: "string" },
                searchtext: { type: "string" },
                page: { type: "number" },
                limit: { type: "number" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var result = [];
                var page_size = ctx.params.limit;
                var page_number = ctx.params.page;
                var firebaseID = ctx.params.firebaseID;

                if (ctx.params.searchtext != "") {
                    var tempName = new RegExp(ctx.params.searchtext, 'i');
                    console.log("Regular expression", tempName);
                    // var temp = await this.adapter.find({ query: { fullname: {$regex: tempName}, type: {$in: ['creator','business','personal']} } });
                    var newTemp = await this.adapter.find({ query: { $or: [{ fullname: { $regex: tempName } }, { email: { $regex: tempName } }, { phone: { $regex: tempName } }], type: { $in: ['creator', 'business', 'personal'] } } });
                } else {
                    //var temp = await this.adapter.find({});
                    var newTemp = await this.adapter.find({ query: { type: { $in: ['creator', 'business', 'personal'] } } });
                }
                var temp = [...newTemp];
                let user = await this.adapter.findOne({ firebaseID: firebaseID });

                if (newTemp != undefined && newTemp.length > 0) {

                    if (user.isPrimaryProfile) {
                        for (let i = 0; i < newTemp.length; i++) {
                            if (!newTemp[i].isPrimaryProfile) {
                                if (newTemp[i].primaryObjectId === firebaseID) {
                                    delete temp[i];
                                }
                            }
                        }
                    } else {
                        for (let i = 0; i < temp.length; i++) {
                            if (newTemp[i].isPrimaryProfile) {
                                if (user.primaryObjectId === newTemp[i].firebaseID) {
                                    delete temp[i];
                                }
                            } else {
                                if (user.primaryObjectId == newTemp[i].primaryObjectId) {
                                    delete temp[i];
                                }
                            }
                        }
                    }

                }
                temp = temp.filter(function (element) {
                    return element !== undefined;
                });

                if (temp != undefined && temp.length > 0) {

                    var MutedUser = [];
                    var followfUser = [];
                    var blkedUsers = [];

                    for (var i = 0; i < temp.length; i++) {
                        var isFriend = false;
                        var chatRequestStatus = 'not sent';
                        var isChat = false;
                        var userblockYou = false;
                        var youblockUser = false;

                        if (temp[i].blockedUserId) {
                            var block_count = temp[i].blockedUserId.length;
                            if (block_count > 0) {
                                for (var s = 0; s < block_count; s++) {
                                    if (temp[i].blockedUserId[s] == firebaseID) {
                                        userblockYou = true;
                                    }
                                }
                            }
                        }
                        if (user.blockedUserId && user.blockedUserId.includes(temp[i].firebaseID)) {
                            youblockUser = true;
                        }
                        temp[i].userblockYou = userblockYou;
                        temp[i].youblockUser = youblockUser;

                        if (temp[i].chatmembers) {
                            var chatmembers_count = temp[i].chatmembers.length;
                            if (chatmembers_count > 0) {
                                for (var n = 0; n < temp[i].chatmembers.length; n++) {
                                    if (temp[i].chatmembers[n].firebaseID == firebaseID) {
                                        if (temp[i].chatmembers[n].isApproved) {
                                            chatRequestStatus = 'Accepted';
                                        } else {
                                            chatRequestStatus = 'Pending';
                                        }
                                    }
                                }
                            }
                        }
                        temp[i].chatRequestStatus = chatRequestStatus;
                        if (chatRequestStatus == 'Accepted') {
                            isChat = true;
                        }
                        temp[i].isChat = isChat;

                        if (temp[i].contact) {
                            var contact_count = temp[i].contact.length;
                            if (contact_count > 0) {
                                for (var h = 0; h < contact_count; h++) {
                                    if (temp[i].contact[h].firebaseID == firebaseID) {
                                        // if(temp[i].contact[h].isApproved)
                                        // {
                                        isFriend = true;
                                        // }
                                    }
                                }
                            }
                        }
                        temp[i].isFriend = isFriend;

                        if (temp[i].firebaseID == firebaseID) {
                            if (temp[i].mute) {
                                MutedUser = temp[i].mute;
                            }
                            if (temp[i].following) {
                                followfUser = temp[i].following;
                            }
                            if (temp[i].blockedUserId) {
                                blkedUsers = temp[i].blockedUserId;
                            }


                        }
                        var followersCount = 0;
                        if (temp[i].followers) {
                            followersCount = temp[i].followers.length;
                        }
                        temp[i].followersCount = followersCount;

                    }

                    if (MutedUser.length > 0) {

                        for (var j = 0; j < temp.length; j++) {
                            var isMuted = false;
                            var existRecord = MutedUser.includes(temp[j].firebaseID);
                            if (existRecord) {
                                isMuted = true;
                            }
                            temp[j].isMuted = isMuted;
                        }
                    }

                    if (followfUser.length > 0) {

                        for (var k = 0; k < temp.length; k++) {
                            var isFollowed = false;
                            var existRecord = followfUser.includes(temp[k].firebaseID);
                            if (existRecord) {
                                isFollowed = true;
                            }
                            temp[k].isFollowed = isFollowed;
                        }
                    }

                    if (blkedUsers.length > 0) {

                        for (var p = 0; p < temp.length; p++) {
                            var isBlocked = false;
                            var existRecord = blkedUsers.includes(temp[p].firebaseID);
                            if (existRecord) {
                                isBlocked = true;
                            }
                            temp[p].isBlocked = isBlocked;
                        }
                    }

                    var totalPages = 1;
                    var totalRecords = temp.length;
                    totalPages = Math.ceil((totalRecords / page_size));

                    if (page_number <= totalPages)
                        result = temp.slice((page_number - 1) * page_size, page_number * page_size);

                }

                return { status: 200, message: "success", totalPages: totalPages, data: result };

            },
        },
        follow: {
            params: {
                baseFirebaseID: { type: "string" },
                followFirebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.baseFirebaseID });
                console.log("Base User", baseEntity);

                var followEntity = await this.adapter.findOne({ firebaseID: ctx.params.followFirebaseID });
                console.log("Follow User", followEntity);

                if (baseEntity) {
                    if (!baseEntity.following) {
                        baseEntity.following = [];
                        baseEntity.following.push(ctx.params.followFirebaseID);
                    }
                    else {
                        var userFollowing = baseEntity.following;

                        userFollowing = userFollowing.filter(function (item, index, inputArray) {
                            return inputArray.indexOf(item) === index;
                        });

                        var existRecord = userFollowing.includes(ctx.params.followFirebaseID);
                        if (!existRecord) {
                            baseEntity.following.push(ctx.params.followFirebaseID);
                        }
                    }
                    console.log("ID", baseEntity._id);
                    const doc = await this.adapter.updateById(baseEntity._id, { $set: { following: baseEntity.following, updatedAt: new Date() } });
                    const user = await this.transformDocuments(ctx, {}, doc);
                    var userEntity = this.entityChanged("updated", user, ctx).then(() => user);

                    let baseUser = await ctx.call("user.findFirebaseID", { firebaseID: ctx.params.baseFirebaseID });
                    let followUser = await ctx.call("user.findFirebaseID", { firebaseID: ctx.params.followFirebaseID });

                    let base_fireuserName = '';
                    let base_fireuserAvatar = '';

                    if (baseUser["result"].length > 0) {
                        base_fireuserName = baseUser["result"][0]["fullname"];
                        base_fireuserAvatar = baseUser["result"][0]["avatar"];
                    }
                    let noti_data = {
                        TofirebaseID: ctx.params.followFirebaseID,
                        FromfirebaseID: ctx.params.baseFirebaseID,
                        type: "followed",
                        msg: base_fireuserName + " followed you",
                        read: false,
                        details: {
                            fireuserName: base_fireuserName,
                            fireuserAvatar: base_fireuserAvatar
                        },
                        createdAt: new Date()
                    };
                    const noti = await ctx.call("notification.create", { data: noti_data });
                    const badge = await ctx.call("notification.badge", { firebaseID: ctx.params.followFirebaseID });


                    let playerID = [];
                    playerID.push(followUser["result"][0]["pushId"]);

                    let message = {
                        app_id: _const.appId,
                        ios_badgeType: "SetTo",
                        ios_badgeCount: badge.count,
                        contents: { "en": base_fireuserName + " followed you" },
                        include_player_ids: playerID,
                        data: { "type": "followed", "firebaseID": ctx.params.baseFirebaseID }
                    }
                    if (followUser["result"][0].mute) {
                        if (!followUser["result"][0].mute.includes(ctx.params.baseFirebaseID)) {
                            _const.sendNotification(message);
                        }
                    } else {
                        _const.sendNotification(message);
                    }

                    if (!followEntity.followers) {
                        followEntity.followers = [];
                        followEntity.followers.push(ctx.params.baseFirebaseID);
                    }
                    else {
                        var userFollowers = followEntity.followers;

                        userFollowers = userFollowers.filter(function (item, index, inputArray) {
                            return inputArray.indexOf(item) === index;
                        });

                        var existFRecord = userFollowers.includes(ctx.params.baseFirebaseID);
                        if (!existFRecord) {
                            followEntity.followers.push(ctx.params.baseFirebaseID);
                        }
                    }
                    console.log("ID", followEntity._id);
                    const followdoc = await this.adapter.updateById(followEntity._id, { $set: { followers: followEntity.followers, updatedAt: new Date() } });
                    const followuser = await this.transformDocuments(ctx, {}, followdoc);
                    var followuserEntity = this.entityChanged("updated", followuser, ctx).then(() => followuser);

                    return { status: 200, message: "success" };
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        unfollow: {
            params: {
                baseFirebaseID: { type: "string" },
                followFirebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.baseFirebaseID });
                console.log("Base User", baseEntity);

                var followEntity = await this.adapter.findOne({ firebaseID: ctx.params.followFirebaseID });
                console.log("Follow User", followEntity);

                if (baseEntity) {
                    var followingArray = baseEntity.following;

                    followingArray = followingArray.filter(function (item, index, inputArray) {
                        return inputArray.indexOf(item) === index;
                    });

                    var index = followingArray.indexOf(ctx.params.followFirebaseID);
                    if (index > -1) {
                        followingArray.splice(index, 1);
                    }

                    //baseEntity.following.pop(ctx.params.followFirebaseID);
                    //console.log("ID", baseEntity._id);
                    const doc = await this.adapter.updateById(baseEntity._id, { $set: { following: followingArray, updatedAt: new Date() } });
                    const user = await this.transformDocuments(ctx, {}, doc);
                    var userEntity = this.entityChanged("updated", user, ctx).then(() => user);

                    let baseUser = await ctx.call("user.findFirebaseID", { firebaseID: ctx.params.baseFirebaseID });
                    let followUser = await ctx.call("user.findFirebaseID", { firebaseID: ctx.params.followFirebaseID });

                    let base_fireuserName = '';
                    let base_fireuserAvatar = '';

                    if (baseUser["result"].length > 0) {
                        base_fireuserName = baseUser["result"][0]["fullname"];
                        base_fireuserAvatar = baseUser["result"][0]["avatar"];
                    }

                    let noti_data = {
                        TofirebaseID: ctx.params.followFirebaseID,
                        FromfirebaseID: ctx.params.baseFirebaseID,
                        type: "unfollowed",
                        msg: base_fireuserName + " unfollowed you",
                        read: false,
                        details: {
                            fireuserName: base_fireuserName,
                            fireuserAvatar: base_fireuserAvatar
                        },
                        createdAt: new Date()
                    };

                    const noti = await ctx.call("notification.create", { data: noti_data });
                    const badge = await ctx.call("notification.badge", { firebaseID: ctx.params.followFirebaseID });

                    let playerID = [];
                    playerID.push(followUser["result"][0]["pushId"]);

                    let message = {
                        app_id: _const.appId,
                        ios_badgeType: "SetTo",
                        ios_badgeCount: badge.count,
                        contents: { "en": base_fireuserName + " unfollowed you" },
                        include_player_ids: playerID,
                        data: { "type": "unfollowed", "firebaseID": ctx.params.baseFirebaseID }
                    }

                    if (followUser["result"][0].mute) {
                        if (!followUser["result"][0].mute.includes(ctx.params.baseFirebaseID)) {
                            _const.sendNotification(message);
                        }
                    } else {
                        _const.sendNotification(message);
                    }

                    var followersArray = followEntity.followers;

                    followersArray = followersArray.filter(function (item, index, inputArray) {
                        return inputArray.indexOf(item) === index;
                    });


                    var findex = followersArray.indexOf(ctx.params.baseFirebaseID);
                    if (findex > -1) {
                        followersArray.splice(findex, 1);
                    }

                    // followEntity.followers.pop(ctx.params.baseFirebaseID);
                    // console.log("ID", followEntity._id);
                    const followdoc = await this.adapter.updateById(followEntity._id, { $set: { followers: followersArray, updatedAt: new Date() } });
                    const followuser = await this.transformDocuments(ctx, {}, followdoc);
                    var followuserEntity = this.entityChanged("updated", followuser, ctx).then(() => followuser);

                    return { status: 200, message: "success" };
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        mute: {
            params: {
                baseFirebaseID: { type: "string" },
                followFirebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.baseFirebaseID });
                console.log("Base User", baseEntity);

                var followEntity = await this.adapter.findOne({ firebaseID: ctx.params.followFirebaseID });
                console.log("Follow User", followEntity);

                if (baseEntity) {
                    if (!baseEntity.mute) {
                        baseEntity.mute = [];
                        baseEntity.mute.push(ctx.params.followFirebaseID);
                    }
                    else {
                        var userMutes = baseEntity.mute;

                        userMutes = userMutes.filter(function (item, index, inputArray) {
                            return inputArray.indexOf(item) === index;
                        });

                        var existRecord = userMutes.includes(ctx.params.followFirebaseID);
                        if (!existRecord) {
                            baseEntity.mute.push(ctx.params.followFirebaseID);
                        }
                    }
                    console.log("ID", baseEntity._id);
                    const doc = await this.adapter.updateById(baseEntity._id, { $set: { mute: baseEntity.mute, updatedAt: new Date() } });
                    const user = await this.transformDocuments(ctx, {}, doc);
                    var userEntity = this.entityChanged("updated", user, ctx).then(() => user);

                    return { status: 200, message: "success" };
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        unmute: {
            params: {
                baseFirebaseID: { type: "string" },
                followFirebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.baseFirebaseID });
                console.log("Base User", baseEntity);

                var followEntity = await this.adapter.findOne({ firebaseID: ctx.params.followFirebaseID });
                console.log("Follow User", followEntity);

                if (baseEntity) {
                    var muteArray = baseEntity.mute;

                    muteArray = muteArray.filter(function (item, index, inputArray) {
                        return inputArray.indexOf(item) === index;
                    });

                    var index = muteArray.indexOf(ctx.params.followFirebaseID);
                    if (index > -1) {
                        muteArray.splice(index, 1);
                    }

                    // baseEntity.mute.pop(ctx.params.followFirebaseID);
                    console.log("ID", baseEntity._id);
                    const doc = await this.adapter.updateById(baseEntity._id, { $set: { mute: muteArray, updatedAt: new Date() } });
                    const user = await this.transformDocuments(ctx, {}, doc);
                    var userEntity = this.entityChanged("updated", user, ctx).then(() => user);
                    return { status: 200, message: "success" };
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        blockUser: {
            params: {
                baseFirebaseID: { type: "string" },
                followFirebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.baseFirebaseID });
                console.log("Base User", baseEntity);

                var followEntity = await this.adapter.findOne({ firebaseID: ctx.params.followFirebaseID });
                console.log("Follow User", followEntity);

                if (baseEntity) {
                    if (!baseEntity.blockedUserId) {
                        baseEntity.blockedUserId = [];
                        baseEntity.blockedUserId.push(ctx.params.followFirebaseID);
                    }
                    else {
                        var userblock = baseEntity.blockedUserId;

                        userblock = userblock.filter(function (item, index, inputArray) {
                            return inputArray.indexOf(item) === index;
                        });

                        var existRecord = userblock.includes(ctx.params.followFirebaseID);
                        if (!existRecord) {
                            baseEntity.blockedUserId.push(ctx.params.followFirebaseID);
                        }
                    }
                    console.log("ID", baseEntity._id);
                    const doc = await this.adapter.updateById(baseEntity._id, { $set: { blockedUserId: baseEntity.blockedUserId, updatedAt: new Date() } });
                    const user = await this.transformDocuments(ctx, {}, doc);
                    var userEntity = this.entityChanged("updated", user, ctx).then(() => user);

                    return { status: 200, message: "success" };
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        unblockUser: {
            params: {
                baseFirebaseID: { type: "string" },
                followFirebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.baseFirebaseID });
                console.log("Base User", baseEntity);

                var followEntity = await this.adapter.findOne({ firebaseID: ctx.params.followFirebaseID });
                console.log("Follow User", followEntity);

                if (baseEntity) {
                    var unBlockArray = baseEntity.blockedUserId;

                    unBlockArray = unBlockArray.filter(function (item, index, inputArray) {
                        return inputArray.indexOf(item) === index;
                    });

                    var index = unBlockArray.indexOf(ctx.params.followFirebaseID);
                    if (index > -1) {
                        unBlockArray.splice(index, 1);
                    }

                    // baseEntity.mute.pop(ctx.params.followFirebaseID);
                    console.log("ID", baseEntity._id);
                    const doc = await this.adapter.updateById(baseEntity._id, { $set: { blockedUserId: unBlockArray, updatedAt: new Date() } });
                    const user = await this.transformDocuments(ctx, {}, doc);
                    var userEntity = this.entityChanged("updated", user, ctx).then(() => user);
                    return { status: 200, message: "success" };
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        findPopular: {
            params: {
                searchtext: { type: "string" },
                page: { type: "number" },
                limit: { type: "number" },
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var result = [];
                var page_size = ctx.params.limit;
                var page_number = ctx.params.page;
                var firebaseID = ctx.params.firebaseID;

                if (ctx.params.searchtext != "") {
                    var tempName = new RegExp(ctx.params.searchtext, 'i');
                    console.log("Regular expression", tempName);
                    var temp = await this.adapter.find({ query: { fullname: { $regex: tempName }, type: { $in: ['creator', 'business', 'personal'] } } });
                } else {
                    //var temp = await this.adapter.find({});
                    var temp = await this.adapter.find({ query: { type: { $in: ['creator', 'business', 'personal'] } } });
                }

                if (temp != undefined && temp.length > 0) {

                    var followfUser = [];
                    for (var i = 0; i < temp.length; i++) {
                        if (temp[i].firebaseID == firebaseID) {
                            if (temp[i].following) {
                                followfUser = temp[i].following;
                            }
                        }

                        var followersCount = 0;
                        if (temp[i].followers) {
                            followersCount = temp[i].followers.length;
                        }
                        temp[i].followersCount = followersCount;
                    }

                    if (followfUser.length > 0) {
                        for (var k = 0; k < temp.length; k++) {
                            var isFollowed = false;
                            var existRecord = followfUser.includes(temp[k].firebaseID);
                            if (existRecord) {
                                isFollowed = true;
                            }
                            temp[k].isFollowed = isFollowed;
                        }
                    }

                    var totalPages = 1;
                    var totalRecords = temp.length;
                    totalPages = Math.ceil((totalRecords / page_size));

                    if (page_number <= totalPages)
                        result = temp.slice((page_number - 1) * page_size, page_number * page_size);

                }

                return { status: 200, message: "success", totalPages: totalPages, data: result };

            },
        },
        findFirebaseID: {
            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.firebaseID;
                var result = [];

                var temp = await this.adapter.find({ query: { firebaseID: entity } });
                // console.log("User", temp);

                if (temp != undefined && temp.length > 0) {
                    result = temp;
                    return { result };
                }
                else {
                    return { result };
                }

            },
        },
        checkUser: {
            params: {
                name: { type: "string" }
            },
            async handler(ctx) {

                //console.log("Params", JSON.stringify(ctx.params));
                var name = ctx.params.name;
                var randomName = this.generate(ctx.params.name);
                // var randomName = 'testajit_nbwo';

                var temp = await this.adapter.find({ query: { userName: randomName } });

                if (temp != undefined && temp.length > 0) {
                    //var result = this.checkUser( { name : name });
                    const ctxdata = await ctx.call("user.checkUser", { name: name });
                    // return { status : 201, message : "failed", name : name, userName : randomName };
                }
                else {
                    return { status: 200, message: "success", name: name, userName: randomName };
                }
            },
        },
        blockUserlist: {
            params: {
                firebaseID: { type: "string" },
                search: { type: "string" },
                page: { type: "number" },
                limit: { type: "number" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.firebaseID;
                var result = [];

                var temp = await this.adapter.find({ query: { firebaseID: entity } });
                console.log("User", temp);

                if (temp != undefined && temp.length > 0) {
                    result = temp;
                    return { status: 200, message: "success", found: true, data: result };
                }
                else {
                    return { status: 201, message: "wrong user" };
                }

            },
        },
        addEducation: {
            params: {
                firebaseID: { type: "string" },
                Degree: { type: "string" },
                InstituteName: { type: "string" },
                fromYear: { type: "string" },
                toYear: { type: "string" },
                isGraduate: { type: "boolean" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID });
                console.log("Base User", baseEntity);

                if (baseEntity) {
                    if (!baseEntity.EducationHistory) {
                        baseEntity.EducationHistory = [];
                        var dataarray = {};
                        var uniqueID = this.getUniqueID(20);
                        dataarray.educationId = uniqueID;
                        dataarray.Degree = ctx.params.Degree;
                        dataarray.InstituteName = ctx.params.InstituteName;
                        dataarray.fromYear = ctx.params.fromYear;
                        dataarray.toYear = ctx.params.toYear;
                        dataarray.isGraduate = ctx.params.isGraduate;
                        dataarray.createdAt = new Date();
                        dataarray.updatedAt = new Date();
                        baseEntity.EducationHistory.push(dataarray);
                    }
                    else {
                        var dataarray = {};
                        var uniqueID = this.getUniqueID(20);
                        dataarray.educationId = uniqueID;
                        dataarray.Degree = ctx.params.Degree;
                        dataarray.InstituteName = ctx.params.InstituteName;
                        dataarray.fromYear = ctx.params.fromYear;
                        dataarray.toYear = ctx.params.toYear;
                        dataarray.isGraduate = ctx.params.isGraduate;
                        dataarray.createdAt = new Date();
                        dataarray.updatedAt = new Date();
                        baseEntity.EducationHistory.push(dataarray);
                    }
                    console.log("ID", baseEntity._id);
                    const doc = await this.adapter.updateById(baseEntity._id, { $set: { EducationHistory: baseEntity.EducationHistory, updatedAt: new Date() } });
                    const user = await this.transformDocuments(ctx, {}, doc);
                    var userEntity = this.entityChanged("updated", user, ctx).then(() => user);

                    return { status: 200, message: "success" };
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        editEducation: {
            params: {
                firebaseID: { type: "string" },
                educationId: { type: "string" },
                Degree: { type: "string" },
                InstituteName: { type: "string" },
                fromYear: { type: "string" },
                toYear: { type: "string" },
                isGraduate: { type: "boolean" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID });
                console.log("Base User", baseEntity);

                var educationId = ctx.params.educationId;

                if (baseEntity) {
                    if (!baseEntity.EducationHistory) {
                        return { status: 201, message: "Record not found!" };
                    } else {
                        var edHistory = baseEntity.EducationHistory;
                        for (var i = 0; i < edHistory.length; i++) {
                            if (educationId == edHistory[i].educationId) {
                                edHistory[i].Degree = ctx.params.Degree;
                                edHistory[i].InstituteName = ctx.params.InstituteName;
                                edHistory[i].fromYear = ctx.params.fromYear;
                                edHistory[i].toYear = ctx.params.toYear;
                                edHistory[i].isGraduate = ctx.params.isGraduate;
                                edHistory[i].updatedAt = new Date();
                            }
                        }
                        console.log("ID", baseEntity._id);
                        const doc = await this.adapter.updateById(baseEntity._id, { $set: { EducationHistory: baseEntity.EducationHistory, updatedAt: new Date() } });
                        const user = await this.transformDocuments(ctx, {}, doc);
                        var userEntity = this.entityChanged("updated", user, ctx).then(() => user);
                        return { status: 200, message: "success" };
                    }
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        deleteEducation: {
            params: {
                firebaseID: { type: "string" },
                educationId: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID });
                console.log("Base User", baseEntity);

                var educationId = ctx.params.educationId;

                if (baseEntity) {
                    if (!baseEntity.EducationHistory) {
                        return { status: 201, message: "Record not found!" };
                    } else {
                        var edHistory = baseEntity.EducationHistory;
                        var updatedHistory = [];
                        for (var i = 0; i < edHistory.length; i++) {
                            if (educationId != edHistory[i].educationId) {
                                updatedHistory.push(edHistory[i]);
                            }
                        }
                        console.log("ID", baseEntity._id);
                        const doc = await this.adapter.updateById(baseEntity._id, { $set: { EducationHistory: updatedHistory, updatedAt: new Date() } });
                        const user = await this.transformDocuments(ctx, {}, doc);
                        var userEntity = this.entityChanged("updated", user, ctx).then(() => user);
                        return { status: 200, message: "success" };
                    }
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        listEducation: {

            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID });
                console.log("Base User", baseEntity);

                if (baseEntity) {
                    var edHistory = [];
                    if (baseEntity.EducationHistory) {
                        edHistory = baseEntity.EducationHistory;
                    }
                    return { status: 200, message: "success", data: edHistory };
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        addWork: {
            params: {
                firebaseID: { type: "string" },
                companyName: { type: "string" },
                jobTitle: { type: "string" },
                location: { type: "string" },
                description: { type: "string" },
                isCurrentlyWorking: { type: "boolean" },
                fromMonth: { type: "string" },
                fromYear: { type: "string" },
                toMonth: { type: "string" },
                toYear: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID });
                console.log("Base User", baseEntity);

                if (baseEntity) {
                    if (!baseEntity.workHistory) {
                        baseEntity.workHistory = [];
                        var dataarray = {};
                        var uniqueID = this.getUniqueID(20);
                        dataarray.workId = uniqueID;
                        dataarray.companyName = ctx.params.companyName;
                        dataarray.jobTitle = ctx.params.jobTitle;
                        dataarray.location = ctx.params.location;
                        dataarray.description = ctx.params.description;
                        dataarray.isCurrentlyWorking = ctx.params.isCurrentlyWorking;
                        dataarray.fromMonth = ctx.params.fromMonth;
                        dataarray.fromYear = ctx.params.fromYear;
                        dataarray.toMonth = ctx.params.toMonth;
                        dataarray.toYear = ctx.params.toYear;
                        dataarray.createdAt = new Date();
                        dataarray.updatedAt = new Date();
                        baseEntity.workHistory.push(dataarray);
                    }
                    else {
                        var dataarray = {};
                        var uniqueID = this.getUniqueID(20);
                        dataarray.workId = uniqueID;
                        dataarray.companyName = ctx.params.companyName;
                        dataarray.jobTitle = ctx.params.jobTitle;
                        dataarray.location = ctx.params.location;
                        dataarray.description = ctx.params.description;
                        dataarray.isCurrentlyWorking = ctx.params.isCurrentlyWorking;
                        dataarray.fromMonth = ctx.params.fromMonth;
                        dataarray.fromYear = ctx.params.fromYear;
                        dataarray.toMonth = ctx.params.toMonth;
                        dataarray.toYear = ctx.params.toYear;
                        dataarray.createdAt = new Date();
                        dataarray.updatedAt = new Date();
                        baseEntity.workHistory.push(dataarray);
                    }
                    console.log("ID", baseEntity._id);
                    const doc = await this.adapter.updateById(baseEntity._id, { $set: { workHistory: baseEntity.workHistory, updatedAt: new Date() } });
                    const user = await this.transformDocuments(ctx, {}, doc);
                    var userEntity = this.entityChanged("updated", user, ctx).then(() => user);

                    return { status: 200, message: "success" };
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        editWork: {
            params: {
                firebaseID: { type: "string" },
                workId: { type: "string" },
                companyName: { type: "string" },
                jobTitle: { type: "string" },
                location: { type: "string" },
                description: { type: "string" },
                isCurrentlyWorking: { type: "boolean" },
                fromMonth: { type: "string" },
                fromYear: { type: "string" },
                toMonth: { type: "string" },
                toYear: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID });
                console.log("Base User", baseEntity);

                var workId = ctx.params.workId;

                if (baseEntity) {
                    if (!baseEntity.workHistory) {
                        return { status: 201, message: "Record not found!" };
                    } else {
                        var edHistory = baseEntity.workHistory;
                        for (var i = 0; i < edHistory.length; i++) {
                            if (workId == edHistory[i].workId) {
                                edHistory[i].companyName = ctx.params.companyName;
                                edHistory[i].jobTitle = ctx.params.jobTitle;
                                edHistory[i].location = ctx.params.location;
                                edHistory[i].description = ctx.params.description;
                                edHistory[i].isCurrentlyWorking = ctx.params.isCurrentlyWorking;
                                edHistory[i].fromMonth = ctx.params.fromMonth;
                                edHistory[i].fromYear = ctx.params.fromYear;
                                edHistory[i].toMonth = ctx.params.toMonth;
                                edHistory[i].toYear = ctx.params.toYear;
                                edHistory[i].updatedAt = new Date();
                            }
                        }
                        console.log("ID", baseEntity._id);
                        const doc = await this.adapter.updateById(baseEntity._id, { $set: { workHistory: baseEntity.workHistory, updatedAt: new Date() } });
                        const user = await this.transformDocuments(ctx, {}, doc);
                        var userEntity = this.entityChanged("updated", user, ctx).then(() => user);
                        return { status: 200, message: "success" };
                    }
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        deleteWork: {
            params: {
                firebaseID: { type: "string" },
                workId: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID });
                console.log("Base User", baseEntity);

                var workId = ctx.params.workId;

                if (baseEntity) {
                    if (!baseEntity.workHistory) {
                        return { status: 201, message: "Record not found!" };
                    } else {
                        var edHistory = baseEntity.workHistory;
                        var updatedHistory = [];
                        for (var i = 0; i < edHistory.length; i++) {
                            if (workId != edHistory[i].workId) {
                                updatedHistory.push(edHistory[i]);
                            }
                        }
                        console.log("ID", baseEntity._id);
                        const doc = await this.adapter.updateById(baseEntity._id, { $set: { workHistory: updatedHistory, updatedAt: new Date() } });
                        const user = await this.transformDocuments(ctx, {}, doc);
                        var userEntity = this.entityChanged("updated", user, ctx).then(() => user);
                        return { status: 200, message: "success" };
                    }
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        listWork: {

            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID });
                console.log("Base User", baseEntity);

                if (baseEntity) {
                    var edHistory = [];
                    if (baseEntity.workHistory) {
                        edHistory = baseEntity.workHistory;
                    }
                    return { status: 200, message: "success", data: edHistory };
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        update: {
            params: {
                data: { type: "object" }
            },
            async handler(ctx) {

                let entity = ctx.params.data;
                var userID = entity._id;
                console.log("User ID", userID);
                var temp = await this.adapter.findOne({ _id: new ObjectId(userID) });

                if (temp != undefined && temp._id != null && temp._id != "") {
                    console.log("ID", temp._id);
                    delete entity._id;
                    var newUser = entity;
                    newUser.updatedAt = new Date();
                    const data = await this.adapter.updateById(temp._id, { $set: newUser });
                    const user = await this.transformDocuments(ctx, {}, data);
                    var userEntity = await this.entityChanged("updated", user, ctx).then(() => user);
                    return { status: 200, message: "success", data: data };
                }

            },
        },
        profileDetails: {
            params: {
                firebaseID: { type: "string" },
                viewerFirebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.firebaseID;
                var viewerFirebaseID = ctx.params.viewerFirebaseID;
                var result = [];

                var temp = await this.adapter.find({ query: { firebaseID: entity } });
                console.log("User", temp);
                var vtemp = await this.adapter.find({ query: { firebaseID: viewerFirebaseID } });
                console.log("Viewe User", vtemp);

                if (temp != undefined && temp.length > 0) {
                    var followors_count = 0;
                    var following_count = 0;
                    var post_count = 0;
                    var gmembers_count = 0;
                    var is_online = false;
                    var favpost_count = 0;
                    var isFollow = false;
                    var isBlockedUser = false;
                    var isMember = false;
                    var blockedUsers = [];
                    var followersUsers = [];
                    var followingUsers = [];
                    var blockedUserlist = [];
                    var pendingList = [];

                    var isAllowIncomingChat = false;
                    var isAvatarChat = false;
                    var isShowOnline = false;
                    var isShowPhone = false;
                    var isVerified = false;

                    var callctxdata = [];
                    callctxdata = await this.broker.call("post.getUserPosts", { firebaseID: entity });

                    if (callctxdata["result"].length > 0) {
                        post_count = callctxdata["result"].length;
                    }

                    var callfavctxdata = await this.broker.call("favoritespost.getFavPostCount", { firebaseID: entity });

                    favpost_count = callfavctxdata["totalRecords"];


                    if (temp[0].followers) {
                        followors_count = temp[0].followers.length;
                        if (followors_count > 0) {
                            for (var b = 0; b < temp[0].followers.length; b++) {
                                var followfireUser = temp[0].followers[b];
                                if (followfireUser == viewerFirebaseID) {
                                    isFollow = true;
                                }
                                const ctxfdata = await ctx.call("user.findFirebaseID", { firebaseID: followfireUser });

                                if (ctxfdata["result"].length > 0) {
                                    var fireid = ctxfdata["result"][0]["_id"];
                                    var followfirebase = ctxfdata["result"][0]["firebaseID"];
                                    var followfullname = ctxfdata["result"][0]["fullname"];
                                    var followavatar = ctxfdata["result"][0]["avatar"];
                                    followersUsers.push({ "_id": fireid, "firebaseID": followfirebase, "fullname": followfullname, "avatar": followavatar });
                                }
                            }

                        }
                    }
                    if (temp[0].members) {
                        var gmembers_count = temp[0].members.length;
                        if (gmembers_count > 0) {
                            for (var k = 0; k < temp[0].members.length; k++) {
                                if (temp[0].members[k].firebaseID == viewerFirebaseID) {
                                    isMember = true;
                                }
                                var memsDetail = temp[0].members[k].firebaseID;

                                const ctxmemsDetaildata = await ctx.call("user.findFirebaseID", { firebaseID: memsDetail });
                                if (ctxmemsDetaildata["result"].length > 0) {
                                    temp[0].members[k]._id = ctxmemsDetaildata["result"][0]["_id"];
                                    temp[0].members[k].fullname = ctxmemsDetaildata["result"][0]["fullname"];
                                    temp[0].members[k].avatar = ctxmemsDetaildata["result"][0]["avatar"];
                                    // pendingList.push({"_id" : ctxmemPenId, "firebaseID": ctxmemPenfId, "fullname" : ctxmemPenfullname, "avatar": ctxmemPenavatar });
                                }

                            }
                        }
                    }
                    if (temp[0].following) {
                        following_count = temp[0].following.length;
                        if (following_count > 0) {
                            for (var c = 0; c < temp[0].following.length; c++) {
                                var followingfireUser = temp[0].following[c];
                                const ctxfodata = await ctx.call("user.findFirebaseID", { firebaseID: followingfireUser });

                                if (ctxfodata["result"].length > 0) {
                                    var followingid = ctxfodata["result"][0]["_id"];
                                    var followingfirebase = ctxfodata["result"][0]["firebaseID"];
                                    var followingfullname = ctxfodata["result"][0]["fullname"];
                                    var followingavatar = ctxfodata["result"][0]["avatar"];
                                    followingUsers.push({ "_id": followingid, "firebaseID": followingfirebase, "fullname": followingfullname, "avatar": followingavatar });
                                }
                            }

                        }
                    }

                    temp[0].followersCount = followors_count;
                    temp[0].followingCount = following_count;
                    temp[0].postsCount = post_count;
                    temp[0].members_count = gmembers_count;
                    // temp[0].pushId = '';
                    temp[0].loginMethod = '';
                    temp[0].followersUser = followersUsers;
                    temp[0].followingUser = followingUsers;

                    // temp[0].lastSeenDateTime = '';
                    if (!temp[0].isOnline) {
                        temp[0].isOnline = is_online;
                    }
                    if (!temp[0].pushId) {
                        temp[0].pushId = '';
                    }
                    if (!temp[0].isAdvertise) {
                        temp[0].isAdvertise = false;
                    }

                    if (!temp[0].isAllowIncomingChat) {
                        temp[0].isAllowIncomingChat = isAllowIncomingChat;
                    }

                    if (!temp[0].isAvatarChat) {
                        temp[0].isAvatarChat = isAvatarChat;
                    }

                    if (!temp[0].isShowOnline) {
                        temp[0].isShowOnline = isShowOnline;
                    }

                    if (!temp[0].isShowPhone) {
                        temp[0].isShowPhone = isShowPhone;
                    }

                    if (!temp[0].isVerified) {
                        temp[0].isVerified = isVerified;
                    }

                    if (!temp[0].backgroundPicture) {
                        temp[0].backgroundPicture = '';
                    }

                    if (!temp[0].primaryObjectId) {
                        temp[0].primaryObjectId = '';
                    }
                    if (!temp[0].isPrimaryProfile) {
                        temp[0].isPrimaryProfile = false;
                    }
                    if (!temp[0].profilePin) {
                        temp[0].profilePin = '';
                    }
                    if (!temp[0].isHidden) {
                        temp[0].isHidden = false;
                    }
                    if (!temp[0].locationLatitude) {
                        temp[0].locationLatitude = '';
                    }
                    if (!temp[0].locationLongitude) {
                        temp[0].locationLongitude = '';
                    }
                    if (temp[0].blockedUserId) {
                        var block_user_count = temp[0].blockedUserId.length;
                        var loopRecords = temp[0].blockedUserId;
                        if (block_user_count > 0) {
                            for (var p = 0; p < loopRecords.length; p++) {
                                var blockfire = loopRecords[p];

                                const ctxbdata = await ctx.call("user.findFirebaseID", { firebaseID: blockfire });
                                var bprimaryObjectId = '';
                                var bobjectId = '';
                                var bisPrimaryProfile = false;
                                var bobjectPId = '';
                                var blockfullname = '';
                                var blockavatar = '';


                                if (ctxbdata["result"].length > 0) {
                                    if (ctxbdata["result"][0]["primaryObjectId"]) {
                                        bprimaryObjectId = ctxbdata["result"][0]["primaryObjectId"];
                                    }

                                    bobjectPId = ctxbdata["result"][0]["_id"];
                                    bobjectId = ctxbdata["result"][0]["firebaseID"];
                                    if (ctxbdata["result"][0]["isPrimaryProfile"]) {
                                        bisPrimaryProfile = ctxbdata["result"][0]["isPrimaryProfile"];
                                    }
                                    blockedUsers.push({ "primaryObjectId": bprimaryObjectId, "objectId": bobjectId, "isPrimaryProfile": bisPrimaryProfile });

                                    blockfullname = ctxbdata["result"][0]["fullname"];
                                    blockavatar = ctxbdata["result"][0]["avatar"];
                                    blockedUserlist.push({ "_id": bobjectPId, "firebaseID": bobjectId, "fullname": blockfullname, "avatar": blockavatar });


                                }


                            }
                        }
                    }
                    if (vtemp[0].blockedUserId) {
                        var vblock_user_count = vtemp[0].blockedUserId.length;
                        var vloopRecords = vtemp[0].blockedUserId;
                        if (vblock_user_count > 0) {
                            for (var r = 0; r < vblock_user_count; r++) {
                                if (entity == vloopRecords[r]) {
                                    isBlockedUser = true;
                                }
                            }
                        }
                    }
                    temp[0].blockedUserlist = blockedUserlist;

                    temp[0].favoritesPostCount = favpost_count;
                    if (!temp[0].profilePin) {
                        temp[0].profilePin = '';
                    }
                    temp[0].blockedUsers = blockedUsers;
                    temp[0].isFollow = isFollow;
                    temp[0].isBlockedUser = isBlockedUser;
                    temp[0].isMember = isMember;
                    var pendingReqCount = 0;
                    if (temp[0].type == 'group') {
                        if (entity == viewerFirebaseID) {
                            if (temp[0].members) {
                                var gfmembers_count = temp[0].members.length;
                                if (gfmembers_count > 0) {

                                    for (var m = 0; m < temp[0].members.length; m++) {
                                        if (!temp[0].members[m].isApproved) {
                                            var memPen = temp[0].members[m].firebaseID;

                                            const ctxmemPendata = await ctx.call("user.findFirebaseID", { firebaseID: memPen });
                                            if (ctxmemPendata["result"].length > 0) {
                                                var ctxmemPenId = ctxmemPendata["result"][0]["_id"];
                                                var ctxmemPenfId = ctxmemPendata["result"][0]["firebaseID"];
                                                var ctxmemPenfullname = ctxmemPendata["result"][0]["fullname"];
                                                var ctxmemPenavatar = ctxmemPendata["result"][0]["avatar"];
                                                pendingList.push({ "_id": ctxmemPenId, "firebaseID": ctxmemPenfId, "fullname": ctxmemPenfullname, "avatar": ctxmemPenavatar });
                                            }
                                            pendingReqCount++;
                                        }
                                    }
                                }
                            }

                        }

                    }
                    temp[0].pendingRequest = pendingReqCount;
                    temp[0].pendingList = pendingList;

                    result = temp;
                    return { status: 200, message: "success", data: result };
                }
                else {
                    return { status: 201, message: "failed", data: result };
                }

            },
        },
        addHash: {
            params: {
                firebaseID: { type: "string" },
                hashId: { type: "array" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));
                var hashValue = ctx.params.hashId;

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID });
                console.log("Base User", baseEntity);

                if (baseEntity) {
                    for (var i = 0; i < hashValue.length; i++) {
                        var hashId = hashValue[i];
                        const ctxdata = await ctx.call("hashtag.getByID", { hashId: hashId });
                        var firehashName = ctxdata.hashName;

                        if (!baseEntity.hashTags) {
                            baseEntity.hashTags = [];
                            var dataarray = {};
                            dataarray.hashId = hashId;
                            dataarray.hashName = firehashName;
                            dataarray.createdAt = new Date();
                            baseEntity.hashTags.push(dataarray);
                        }
                        else {
                            var dataarray = {};
                            dataarray.hashId = hashId;
                            dataarray.hashName = firehashName;
                            dataarray.createdAt = new Date();
                            baseEntity.hashTags.push(dataarray);
                        }
                        console.log("ID", baseEntity._id);
                        const doc = await this.adapter.updateById(baseEntity._id, { $set: { hashTags: baseEntity.hashTags, updatedAt: new Date() } });
                        const user = await this.transformDocuments(ctx, {}, doc);
                        var userEntity = this.entityChanged("updated", user, ctx).then(() => user);
                    }

                    return { status: 200, message: "success" };
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        deleteHash: {
            params: {
                firebaseID: { type: "string" },
                hashId: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID });
                console.log("Base User", baseEntity);

                var hashId = ctx.params.hashId;

                if (baseEntity) {
                    if (!baseEntity.hashTags) {
                        return { status: 201, message: "Record not found!" };
                    } else {
                        var edHistory = baseEntity.hashTags;
                        var updatedHistory = [];
                        for (var i = 0; i < edHistory.length; i++) {
                            if (hashId != edHistory[i].hashId) {
                                updatedHistory.push(edHistory[i]);
                            }
                        }
                        console.log("ID", baseEntity._id);
                        const doc = await this.adapter.updateById(baseEntity._id, { $set: { hashTags: updatedHistory, updatedAt: new Date() } });
                        const user = await this.transformDocuments(ctx, {}, doc);
                        var userEntity = this.entityChanged("updated", user, ctx).then(() => user);
                        return { status: 200, message: "success" };
                    }
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        getUserHash: {
            params: {
                searchtext: { type: "string" },
                hashtext: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var temp = await this.adapter.find({});

                var result = [];
                var tempImages = [];
                var finalResult = [];
                var tempSearch = ctx.params.hashtext;
                var textSearch = ctx.params.searchtext;
                if (textSearch != '') {
                    for (var t = 0; t < temp.length; t++) {
                        if (temp[t].hashTags) {
                            var _hashTag = temp[t].hashTags;
                            if (_hashTag != null) {
                                // tempSearch = tempSearch.toLowerCase();

                                for (var n = 0; n < _hashTag.length; n++) {
                                    var hashData = _hashTag[n].hashName;
                                    //const ctxdata = await ctx.call("hashtag.getByID", { hashId: hashId });
                                    //var hashData = ctxdata.hashName.toLowerCase();
                                    console.log('hashData: ' + hashData);

                                    if (hashData == tempSearch) {
                                        finalResult.push({
                                            _id: temp[t]._id,
                                            firebaseID: temp[t].firebaseID,
                                            fullname: temp[t].fullname,
                                            hashTags: temp[t].hashTags
                                        });
                                    }
                                }
                            }
                        }
                    }

                } else {
                    for (var t = 0; t < temp.length; t++) {
                        if (temp[t].hashTags) {
                            if (temp[t].hashTags.length != 0) {
                                var pushItem = false;
                                var hashFound = false;
                                var _hashTag = temp[t].hashTags;
                                if (_hashTag != null) {
                                    // tempSearch = tempSearch;

                                    for (var n = 0; n < _hashTag.length; n++) {
                                        var hashData = _hashTag[n].hashName;
                                        console.log('hashData Else: ' + hashData);
                                        console.log('tempSearch Else: ' + tempSearch);
                                        pushItem = true;

                                        var totaccfollowers = 0;
                                        var totaccPosts = 0;
                                        // if (ctxaccountdata["result"][0]["followers"]) {
                                        if (temp[t].hashTags) {
                                            if (hashData == tempSearch) {
                                                // hashFound = true;
                                                finalResult.push({
                                                    _id: temp[t]._id,
                                                    firebaseID: temp[t].firebaseID,
                                                    fullname: temp[t].fullname,
                                                    userName: temp[t].userName,
                                                    avatar: temp[t].avatar,
                                                    posts: totaccPosts,
                                                    followers: totaccfollowers,
                                                    hashTags: temp[t].hashTags
                                                });
                                            }
                                        }
                                    }
                                    if (hashFound == true) {
                                        pushItem = true;
                                    }
                                    totaccfollowers = temp[t].followers.length;
                                    var calluapostctxdata = [];
                                    calluapostctxdata = await ctx.call("post.getUserPosts", { firebaseID: temp[t].firebaseID });

                                    if (calluapostctxdata["result"]) {
                                        if (calluapostctxdata["result"].length > 0) {
                                            totaccPosts = calluapostctxdata["result"].length;
                                        }
                                    }
                                    // if (pushItem == true) {
                                    //     finalResult.push({
                                    //         _id: temp[t]._id,
                                    //         firebaseID: temp[t].firebaseID,
                                    //         fullname: temp[t].fullname,
                                    //         userName: temp[t].userName,
                                    //         avatar: temp[t].avatar,
                                    //         posts: totaccPosts,
                                    //         followers: totaccfollowers,
                                    //         hashTags: temp[t].hashTags
                                    //     });
                                    // }
                                }
                            }
                        }
                    }
                }

                console.log('=======================================')
                console.log(JSON.stringify(finalResult))
                console.log('=======================================')
                var result = finalResult;

                return result;
            },
        },
        listHash: {
            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID });
                console.log("Base User", baseEntity);

                if (baseEntity) {
                    var edHistory = [];
                    if (baseEntity.hashTags) {
                        edHistory = baseEntity.hashTags;
                    }
                    return { status: 200, message: "success", data: edHistory };
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        addMembers: {
            params: {
                firebaseID: { type: "string" },
                memberFirebaseId: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));
                var memberFirebaseId = ctx.params.memberFirebaseId;

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID });
                console.log("Base User", baseEntity);

                if (baseEntity) {
                    if (!baseEntity.members) {
                        baseEntity.members = [];
                        var dataarray = {};
                        dataarray.firebaseID = memberFirebaseId;
                        dataarray.isApproved = false;
                        dataarray.createdAt = new Date();
                        baseEntity.members.push(dataarray);
                    }
                    else {
                        let edHistory = baseEntity.members;
                        for (var i = 0; i < edHistory.length; i++) {
                            if (memberFirebaseId == edHistory[i].firebaseID && edHistory[i].isApproved == false) {
                                return { status: 200, message: "already request send" };
                            }
                            if (memberFirebaseId == edHistory[i].firebaseID && edHistory[i].isApproved == true) {
                                return { status: 200, message: "you are already member" };
                            }
                        }
                        var dataarray = {};
                        dataarray.firebaseID = memberFirebaseId;
                        dataarray.isApproved = false;
                        dataarray.createdAt = new Date();
                        baseEntity.members.push(dataarray);
                    }
                    console.log("ID", baseEntity._id);

                    let baseUser = await ctx.call("user.findFirebaseID", { firebaseID: ctx.params.firebaseID });
                    let memberUser = await ctx.call("user.findFirebaseID", { firebaseID: memberFirebaseId });

                    let member_fireuserName = '';
                    let member_fireuserAvatar = '';

                    if (memberUser["result"].length > 0) {
                        member_fireuserName = memberUser["result"][0]["fullname"];
                        member_fireuserAvatar = memberUser["result"][0]["avatar"];
                    }

                    let noti_data = {
                        TofirebaseID: ctx.params.firebaseID,
                        FromfirebaseID: memberFirebaseId,
                        type: "group request",
                        msg: member_fireuserName + " want to join your group",
                        read: false,
                        details: {
                            fireuserName: member_fireuserName,
                            fireuserAvatar: member_fireuserAvatar
                        },
                        createdAt: new Date()
                    };
                    const noti = await ctx.call("notification.create", { data: noti_data });
                    const badge = await ctx.call("notification.badge", { firebaseID: ctx.params.firebaseID });


                    let playerID = [];
                    playerID.push(baseUser["result"][0]["pushId"]);

                    let message = {
                        app_id: _const.appId,
                        ios_badgeType: "SetTo",
                        ios_badgeCount: badge.count,
                        contents: { "en": member_fireuserName + " want to join your group" },
                        include_player_ids: playerID,
                        data: { type: "join group" }
                    }
                    if (baseUser["result"][0].mute) {
                        if (!baseUser["result"][0].mute.includes(memberFirebaseId)) {
                            _const.sendNotification(message);
                        }
                    } else {
                        _const.sendNotification(message);
                    }

                    const doc = await this.adapter.updateById(baseEntity._id, { $set: { members: baseEntity.members, updatedAt: new Date() } });
                    const user = await this.transformDocuments(ctx, {}, doc);
                    var userEntity = this.entityChanged("updated", user, ctx).then(() => user);

                    return { status: 200, message: "success" };
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        approveMember: {
            params: {
                firebaseID: { type: "string" },
                memberFirebaseId: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID });
                console.log("Base User", baseEntity);

                var memberFirebaseId = ctx.params.memberFirebaseId;

                if (baseEntity) {
                    if (!baseEntity.members) {
                        return { status: 201, message: "Record not found!" };
                    } else {
                        var edHistory = baseEntity.members;
                        for (var i = 0; i < edHistory.length; i++) {
                            if (memberFirebaseId == edHistory[i].firebaseID) {
                                edHistory[i].isApproved = true;
                                edHistory[i].updatedAt = new Date();
                            }
                        }
                        console.log("ID", baseEntity._id);
                        const doc = await this.adapter.updateById(baseEntity._id, { $set: { members: baseEntity.members, updatedAt: new Date() } });
                        const user = await this.transformDocuments(ctx, {}, doc);
                        var userEntity = this.entityChanged("updated", user, ctx).then(() => user);
                        return { status: 200, message: "success" };
                    }
                }
                else {
                    return { status: 201, message: "User not found!" };
                }
            }
        },
        rejectMember: {
            params: {
                firebaseID: { type: "string" },
                memberFirebaseId: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID });
                console.log("Base User", baseEntity);

                var memberFirebaseId = ctx.params.memberFirebaseId;

                if (baseEntity) {
                    if (!baseEntity.members) {
                        return { status: 201, message: "Record not found!" };
                    } else {
                        var edHistory = baseEntity.members;
                        var updatedHistory = [];
                        for (var i = 0; i < edHistory.length; i++) {
                            if (memberFirebaseId != edHistory[i].firebaseID) {
                                updatedHistory.push(edHistory[i]);
                            }
                        }
                        console.log("ID", baseEntity._id);
                        const doc = await this.adapter.updateById(baseEntity._id, { $set: { members: updatedHistory, updatedAt: new Date() } });
                        const user = await this.transformDocuments(ctx, {}, doc);
                        var userEntity = this.entityChanged("updated", user, ctx).then(() => user);
                        return { status: 200, message: "success" };
                    }
                }
                else {
                    return { status: 201, message: "User not found!" };
                }
            }
        },
        findGroup: {
            params: {
                firebaseID: { type: "string" },
                searchtext: { type: "string" },
                page: { type: "number" },
                limit: { type: "number" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var result = [];
                var page_size = ctx.params.limit;
                var page_number = ctx.params.page;
                var firebaseID = ctx.params.firebaseID;


                if (ctx.params.searchtext != "") {
                    var tempName = new RegExp(ctx.params.searchtext, 'i');
                    console.log("Regular expression", tempName);
                    var temp = await this.adapter.find({ query: { fullname: { $regex: tempName }, type: 'group' } });
                } else {
                    var temp = await this.adapter.find({ query: { type: 'group' } });
                }

                if (temp != undefined && temp.length > 0) {

                    var MutedUser = [];
                    var followfUser = [];
                    var groupMembers = [];


                    for (var i = 0; i < temp.length; i++) {
                        if (temp[i].mute) {
                            MutedUser = temp[i].mute;
                        }
                        if (temp[i].followers) {
                            followfUser = temp[i].followers;
                        }

                        var isMember = false;
                        if (temp[i].members) {
                            var gmembers_count = temp[i].members.length;
                            if (gmembers_count > 0) {
                                for (var k = 0; k < temp[i].members.length; k++) {
                                    if (temp[i].members[k].firebaseID == firebaseID) {
                                        isMember = true;
                                    }
                                }
                            }
                        }
                        temp[i].isMember = isMember;


                        var isFollowed = false;
                        var existRecord = followfUser.includes(firebaseID);
                        if (existRecord) {
                            isFollowed = true;
                        }
                        temp[i].isFollowed = isFollowed;

                        var isMuted = false;
                        var existmRecord = MutedUser.includes(firebaseID);
                        if (existmRecord) {
                            isMuted = true;
                        }
                        temp[i].isMuted = isMuted;

                        var followersCount = 0;
                        if (temp[i].followers) {
                            followersCount = temp[i].followers.length;
                        }
                        temp[i].followersCount = followersCount;


                    }


                    for (var k = 0; k < temp.length; k++) {

                    }

                    var totalPages = 1;
                    var totalRecords = temp.length;
                    totalPages = Math.ceil((totalRecords / page_size));

                    if (page_number <= totalPages)
                        result = temp.slice((page_number - 1) * page_size, page_number * page_size);

                }

                return { status: 200, message: "success", totalPages: totalPages, data: result };

            },
        },
        findUserGroup: {
            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var firebaseID = ctx.params.firebaseID;
                var result = [];

                var temp = await this.adapter.find({ query: { type: 'group' } });
                console.log("User", temp);

                if (temp != undefined && temp.length > 0) {

                    for (var i = 0; i < temp.length; i++) {
                        if (temp[i].members) {
                            var gmembers_count = temp[i].members.length;
                            if (gmembers_count > 0) {
                                for (var k = 0; k < temp[i].members.length; k++) {
                                    if (temp[i].members[k].firebaseID == firebaseID) {
                                        // result.push(temp[i]);
                                        if (temp[i].members[k].isApproved) {
                                            result.push({ _id: temp[i]._id, firebaseID: temp[i].firebaseID, fullname: temp[i].fullname, userName: temp[i].userName, avatar: temp[i].avatar });
                                        }
                                    }
                                }
                            }
                        }

                    }
                }
                return { status: 200, message: "success", data: result };

            },
        },
        updateData: {
            params: {
                firebaseID: { type: "string" },
                backgroundImageURL: { type: "string" }

            },
            async handler(ctx) {

                var firebaseID = ctx.params.firebaseID;
                var backgroundImageURL = ctx.params.backgroundImageURL;
                var temp = await this.adapter.findOne({ _id: new ObjectId(firebaseID) });

                if (temp != undefined && temp._id != null && temp._id != "") {
                    temp.backgroundImageURL = backgroundImageURL;
                    temp.updatedAt = new Date();
                    const data = await this.adapter.updateById(temp._id, { $set: temp });
                    const user = await this.transformDocuments(ctx, {}, data);
                    var userEntity = await this.entityChanged("updated", user, ctx).then(() => user);
                }

            },
        },
        findMultiProfiles: {
            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));
                let entity = ctx.params.firebaseID;
                var match = entity.split(',');
                var finalresult = [];

                for (var a in match) {
                    var variable = match[a]
                    var temp = await this.adapter.find({
                        query: {
                            "firebaseID": variable
                        }
                    })
                    finalresult.push(temp[0])
                }
                return { status: 200, message: "success", data: finalresult };
            },
        },
        findProfiles: {
            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.firebaseID;
                var finalresult = [];

                var temp = await this.adapter.find({ query: { firebaseID: entity } });
                console.log("User", temp);

                if (temp != undefined && temp.length > 0) {
                    if (temp[0].isPrimaryProfile) {
                        finalresult.push(temp[0]);

                        var listProfiles = [];
                        if (temp[0].profiles) {
                            listProfiles = temp[0].profiles;
                        }
                        if (listProfiles.length > 0) {
                            for (var i = 0; i < listProfiles.length; i++) {
                                var usePrf = listProfiles[i];
                                const ctxuser = await ctx.call("user.findFirebaseID", { firebaseID: usePrf });

                                if (ctxuser["result"].length > 0) {
                                    var isHidden = false;
                                    if (ctxuser["result"][0]["isHidden"]) {
                                        isHidden = ctxuser["result"][0]["isHidden"];
                                    }
                                    if (!isHidden) {
                                        finalresult.push(ctxuser["result"][0]);
                                    }
                                }
                            }

                        }
                    } else {
                        var primaryProfileID = temp[0].primaryObjectId;
                        var tempProfiles = await this.adapter.find({ query: { firebaseID: primaryProfileID } });
                        if (tempProfiles != undefined && tempProfiles.length > 0) {
                            finalresult.push(tempProfiles[0]);
                            var listProfiles = [];
                            if (tempProfiles[0].profiles) {
                                listProfiles = tempProfiles[0].profiles;
                            }
                            if (listProfiles.length > 0) {
                                for (var i = 0; i < listProfiles.length; i++) {
                                    var usePrf = listProfiles[i];
                                    //if(usePrf !== entity){
                                    const ctxuser = await ctx.call("user.findFirebaseID", { firebaseID: usePrf });
                                    if (ctxuser["result"].length > 0) {
                                        var isHidden = false;
                                        if (ctxuser["result"][0]["isHidden"]) {
                                            isHidden = ctxuser["result"][0]["isHidden"];
                                        }
                                        if (!isHidden) {
                                            finalresult.push(ctxuser["result"][0]);
                                        }

                                    }
                                    // }

                                }

                            }


                        }


                    }

                    if (finalresult != undefined && finalresult.length > 0) {
                        var mutuserls = '';
                        for (var j = 0; j < finalresult.length; j++) {
                            //var isMuted = false;
                            if (finalresult[j].mute) {
                                var mutedVal = finalresult[j].mute;
                                for (var k = 0; k < mutedVal.length; k++) {
                                    mutuserls += mutedVal[k] + ",";
                                }

                                // var existRecord = mutedVal.includes(entity);
                                //   if(existRecord){
                                //       isMuted = true;
                                //   }
                            }
                            // finalresult[j].isMuted = isMuted;

                        }
                        mutuserls = mutuserls.slice(0, -1);
                        var finalarrayval = mutuserls.split(",");
                        finalarrayval = finalarrayval.filter(function (item, index, inputArray) {
                            return inputArray.indexOf(item) === index;
                        });

                    }
                    if (finalresult != undefined && finalresult.length > 0) {
                        for (var j = 0; j < finalresult.length; j++) {
                            var isMuted = false;

                            var existRecord = finalarrayval.includes(finalresult[j].firebaseID);
                            if (existRecord) {
                                isMuted = true;
                            }
                            finalresult[j].isMuted = isMuted;
                            if (ctx.params.postID) {
                                const ctxuserpostcomment = await ctx.call("postcomment.getUserPostComments", { firebaseID: finalresult[j].firebaseID, postID: ctx.params.postID });
                                finalresult[j].comment_count = ctxuserpostcomment.result.length;
                            }
                        }
                    }

                    return { status: 200, message: "success", data: finalresult };
                }


            },
        },
        profileshowhide: {
            params: {
                firebaseID: { type: "string" },
                pin: { type: "string" },
                isforhide: { type: "boolean" }
            },
            async handler(ctx) {

                var firebaseID = ctx.params.firebaseID;
                var pin = ctx.params.pin;
                var isforhide = ctx.params.isforhide;


                var temp = await this.adapter.findOne({ firebaseID: firebaseID });

                if (temp != undefined && temp._id != null && temp._id != "") {

                    if (isforhide) {
                        isHidden = true;
                        const data = await this.adapter.updateById(temp._id, { $set: { isHidden: isHidden, profilePin: pin, updatedAt: new Date() } });
                        const user = await this.transformDocuments(ctx, {}, data);
                        var userEntity = await this.entityChanged("updated", user, ctx).then(() => user);
                        return { status: 200, message: "success" };

                    } else {

                        var listProfiles = [];
                        if (temp.profiles) {
                            listProfiles = temp.profiles;
                        }
                        if (listProfiles.length > 0) {

                            var isUpdated = false;
                            for (var i = 0; i < listProfiles.length; i++) {
                                var usePrf = listProfiles[i];
                                const ctxuser = await ctx.call("user.findFirebaseID", { firebaseID: usePrf });

                                if (ctxuser["result"].length > 0) {

                                    if (ctxuser["result"][0]["profilePin"]) {
                                        if (ctxuser["result"][0]["profilePin"] == pin) {
                                            var _id = ctxuser["result"][0]["_id"];
                                            var isHidden = false;
                                            const data = await this.adapter.updateById(_id, { $set: { isHidden: isHidden, updatedAt: new Date() } });
                                            const user = await this.transformDocuments(ctx, {}, data);
                                            var userEntity = await this.entityChanged("updated", user, ctx).then(() => user);
                                            isUpdated = true;
                                        }
                                    }
                                }
                            }
                            if (isUpdated) {
                                return { status: 200, message: "success" };
                            } else {
                                return { status: 200, message: "No record found" };
                            }

                        }

                        // if(temp.profiles != pin)
                        //  {
                        //     return { status : 201, message : "Profile pin mismatch!" };
                        // }
                    }

                } else {
                    return { status: 201, message: "User not found!" };
                }
            },
        },
        getAll: {
            params: {

            },
            async handler(ctx) {

                var result = [];

                var temp = await this.adapter.find({});
                console.log("User", temp);

                if (temp != undefined && temp.length > 0) {
                    result = temp;
                }
                return { result };


            },
        },
        getUserProfiles: {
            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.firebaseID;
                var result = [];

                var temp = await this.adapter.find({ query: { firebaseID: entity } });
                console.log("User", temp);

                if (temp != undefined && temp.length > 0) {
                    if (temp[0].profiles) {
                        result = temp[0].profiles;
                    }
                    return { result };
                }


            },
        },
        addChatMembers: {
            params: {
                firebaseID: { type: "string" },
                requestFirebaseId: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));
                var memberFirebaseId = ctx.params.firebaseID;
                var requestFirebaseId = ctx.params.requestFirebaseId;

                var baseEntity = await this.adapter.findOne({ firebaseID: requestFirebaseId });
                console.log("Base User", baseEntity);


                if (baseEntity) {
                    if (!baseEntity.chatmembers) {
                        baseEntity.chatmembers = [];
                        var dataarray = {};
                        dataarray.firebaseID = memberFirebaseId;
                        dataarray.isApproved = false;
                        dataarray.createdAt = new Date();
                        baseEntity.chatmembers.push(dataarray);
                    }
                    else {
                        let edHistory = baseEntity.chatmembers;
                        for (var i = 0; i < edHistory.length; i++) {
                            if (memberFirebaseId == edHistory[i].firebaseID && edHistory[i].isApproved == false) {
                                return { status: 200, message: "already request send" };
                            }
                            if (memberFirebaseId == edHistory[i].firebaseID && edHistory[i].isApproved == true) {
                                return { status: 200, message: "already added" };
                            }
                        }
                        var dataarray = {};
                        dataarray.firebaseID = memberFirebaseId;
                        dataarray.isApproved = false;
                        dataarray.createdAt = new Date();
                        baseEntity.chatmembers.push(dataarray);
                    }
                    console.log("ID", baseEntity._id);

                    let LoggedUser = await ctx.call("user.findFirebaseID", { firebaseID: memberFirebaseId });
                    let ReqUser = await ctx.call("user.findFirebaseID", { firebaseID: requestFirebaseId });

                    let log_fireuserName = '';
                    let log_fireuserAvatar = '';

                    if (LoggedUser["result"].length > 0) {
                        log_fireuserName = LoggedUser["result"][0]["fullname"];
                        log_fireuserAvatar = LoggedUser["result"][0]["avatar"];
                    }

                    let noti_data = {
                        TofirebaseID: requestFirebaseId,
                        FromfirebaseID: memberFirebaseId,
                        type: "chat request",
                        msg: "You have a new chat request from " + log_fireuserName,
                        read: false,
                        details: {
                            fireuserName: log_fireuserName,
                            fireuserAvatar: log_fireuserAvatar
                        },
                        createdAt: new Date()
                    };

                    const noti = await ctx.call("notification.create", { data: noti_data });
                    const badge = await ctx.call("notification.badge", { firebaseID: requestFirebaseId });


                    let playerID = [];
                    playerID.push(ReqUser["result"][0]["pushId"]);

                    let message = {
                        app_id: _const.appId,
                        ios_badgeType: "SetTo",
                        ios_badgeCount: badge.count,
                        contents: { "en": "You have a new chat request from " + log_fireuserName },
                        include_player_ids: playerID,
                        data: { "type": "chat request" }
                    }
                    if (ReqUser["result"][0].mute) {
                        if (!ReqUser["result"][0].mute.includes(memberFirebaseId)) {
                            _const.sendNotification(message);
                        }
                    } else {
                        _const.sendNotification(message);
                    }

                    const doc = await this.adapter.updateById(baseEntity._id, { $set: { chatmembers: baseEntity.chatmembers, updatedAt: new Date() } });
                    const user = await this.transformDocuments(ctx, {}, doc);
                    var userEntity = this.entityChanged("updated", user, ctx).then(() => user);

                    return { status: 200, message: "success" };
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        approveChatMember: {
            params: {
                firebaseID: { type: "string" },
                requestFirebaseId: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID });
                console.log("Base User", baseEntity);

                var memberFirebaseId = ctx.params.requestFirebaseId;

                if (baseEntity) {
                    if (!baseEntity.chatmembers) {
                        return { status: 201, message: "Record not found!" };
                    } else {
                        var edHistory = baseEntity.chatmembers;
                        for (var i = 0; i < edHistory.length; i++) {
                            if (memberFirebaseId == edHistory[i].firebaseID) {
                                edHistory[i].isApproved = true;
                                edHistory[i].updatedAt = new Date();
                            }
                        }
                        console.log("ID", baseEntity._id);
                        const doc = await this.adapter.updateById(baseEntity._id, { $set: { chatmembers: baseEntity.chatmembers, updatedAt: new Date() } });
                        const user = await this.transformDocuments(ctx, {}, doc);
                        var userEntity = this.entityChanged("updated", user, ctx).then(() => user);
                        return { status: 200, message: "success" };
                    }
                }
                else {
                    return { status: 201, message: "User not found!" };
                }
            }
        },
        rejectChatMember: {
            params: {
                firebaseID: { type: "string" },
                requestFirebaseId: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID });
                console.log("Base User", baseEntity);

                var memberFirebaseId = ctx.params.requestFirebaseId;

                if (baseEntity) {
                    if (!baseEntity.chatmembers) {
                        return { status: 201, message: "Record not found!" };
                    } else {
                        var edHistory = baseEntity.chatmembers;
                        var updatedHistory = [];
                        for (var i = 0; i < edHistory.length; i++) {
                            if (memberFirebaseId != edHistory[i].firebaseID) {
                                updatedHistory.push(edHistory[i]);
                            }
                        }
                        console.log("ID", baseEntity._id);
                        const doc = await this.adapter.updateById(baseEntity._id, { $set: { chatmembers: updatedHistory, updatedAt: new Date() } });
                        const user = await this.transformDocuments(ctx, {}, doc);
                        var userEntity = this.entityChanged("updated", user, ctx).then(() => user);
                        return { status: 200, message: "success" };
                    }
                }
                else {
                    return { status: 201, message: "User not found!" };
                }
            }
        },
        pendingChatRequestList: {
            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.firebaseID;
                var result = [];

                var temp = await this.adapter.find({ query: { firebaseID: entity } });
                console.log("User", temp);

                if (temp != undefined && temp.length > 0) {
                    var pendingList = [];
                    if (temp[0].chatmembers) {
                        var chatmembers_count = temp[0].chatmembers.length;
                        if (chatmembers_count > 0) {
                            for (var m = 0; m < temp[0].chatmembers.length; m++) {
                                if (!temp[0].chatmembers[m].isApproved) {
                                    var memPen = temp[0].chatmembers[m].firebaseID;

                                    const ctxmemPendata = await ctx.call("user.findFirebaseID", { firebaseID: memPen });
                                    if (ctxmemPendata["result"].length > 0) {
                                        var ctxmemPenId = ctxmemPendata["result"][0]["_id"];
                                        var ctxmemPenfId = ctxmemPendata["result"][0]["firebaseID"];
                                        var ctxmemPenfullname = ctxmemPendata["result"][0]["fullname"];
                                        var ctxmemPenavatar = ctxmemPendata["result"][0]["avatar"];
                                        //pendingList.push({"_id" : ctxmemPenId, "firebaseID": ctxmemPenfId, "fullname" : ctxmemPenfullname, "avatar": ctxmemPenavatar });
                                        pendingList.push(ctxmemPendata["result"][0]);
                                    }
                                }
                            }
                        }
                    }
                    // temp[0].pendingList = pendingList;

                    //result = temp;
                    return { status: 200, message: "success", data: pendingList };
                }
                else {
                    return { status: 201, message: "failed", data: result };
                }

            },
        },
        chatRequestList: {
            params: {
                firebaseID: { type: "string" },
                isAll: { type: "boolean" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.firebaseID;
                var isAll = ctx.params.isAll;

                var result = [];

                var temp = await this.adapter.find({ query: { firebaseID: entity } });
                console.log("User", temp);

                if (temp != undefined && temp.length > 0) {
                    var pendingList = [];
                    if (temp[0].chatmembers) {
                        var chatmembers_count = temp[0].chatmembers.length;
                        if (chatmembers_count > 0) {
                            for (var m = 0; m < temp[0].chatmembers.length; m++) {
                                if (isAll) {
                                    var memPen = temp[0].chatmembers[m].firebaseID;
                                    const ctxmemPendata = await ctx.call("user.findFirebaseID", { firebaseID: memPen });
                                    if (ctxmemPendata["result"].length > 0) {
                                        var ctxmemPenId = ctxmemPendata["result"][0]["_id"];
                                        var ctxmemPenfId = ctxmemPendata["result"][0]["firebaseID"];
                                        var ctxmemPenfullname = ctxmemPendata["result"][0]["fullname"];
                                        var ctxmemPenavatar = ctxmemPendata["result"][0]["avatar"];
                                        //pendingList.push({"_id" : ctxmemPenId, "firebaseID": ctxmemPenfId, "fullname" : ctxmemPenfullname, "avatar": ctxmemPenavatar });
                                        pendingList.push(ctxmemPendata["result"][0]);
                                    }

                                } else {
                                    if (temp[0].chatmembers[m].isApproved) {
                                        var memPen = temp[0].chatmembers[m].firebaseID;

                                        const ctxmemPendata = await ctx.call("user.findFirebaseID", { firebaseID: memPen });
                                        if (ctxmemPendata["result"].length > 0) {
                                            var ctxmemPenId = ctxmemPendata["result"][0]["_id"];
                                            var ctxmemPenfId = ctxmemPendata["result"][0]["firebaseID"];
                                            var ctxmemPenfullname = ctxmemPendata["result"][0]["fullname"];
                                            var ctxmemPenavatar = ctxmemPendata["result"][0]["avatar"];
                                            //pendingList.push({"_id" : ctxmemPenId, "firebaseID": ctxmemPenfId, "fullname" : ctxmemPenfullname, "avatar": ctxmemPenavatar });
                                            pendingList.push(ctxmemPendata["result"][0]);
                                        }
                                    }
                                }

                            }
                        }
                    }
                    // temp[0].pendingList = pendingList;

                    //result = temp;
                    return { status: 200, message: "success", data: pendingList };
                }
                else {
                    return { status: 201, message: "failed", data: result };
                }

            },
        },
        addContact: {
            params: {
                firebaseID: { type: "string" },
                requestFirebaseId: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));
                var memberFirebaseId = ctx.params.firebaseID;
                var requestFirebaseId = ctx.params.requestFirebaseId;

                var baseEntity = await this.adapter.findOne({ firebaseID: requestFirebaseId });
                console.log("Base User", baseEntity);

                if (baseEntity) {
                    if (!baseEntity.contact) {
                        baseEntity.contact = [];
                        var dataarray = {};
                        dataarray.firebaseID = memberFirebaseId;
                        dataarray.isApproved = true;
                        dataarray.createdAt = new Date();
                        baseEntity.contact.push(dataarray);
                    }
                    else {
                        var dataarray = {};
                        dataarray.firebaseID = memberFirebaseId;
                        dataarray.isApproved = true;
                        dataarray.createdAt = new Date();
                        baseEntity.contact.push(dataarray);
                    }
                    console.log("ID", baseEntity._id);
                    const doc = await this.adapter.updateById(baseEntity._id, { $set: { contact: baseEntity.contact, updatedAt: new Date() } });
                    const user = await this.transformDocuments(ctx, {}, doc);
                    var userEntity = this.entityChanged("updated", user, ctx).then(() => user);

                    return { status: 200, message: "success" };
                }
                else {
                    return { status: 201, message: "User not found!" };
                }

            },
        },
        removeContact: {
            params: {
                firebaseID: { type: "string" },
                requestFirebaseId: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID });
                console.log("Base User", baseEntity);

                var memberFirebaseId = ctx.params.requestFirebaseId;

                if (baseEntity) {
                    if (!baseEntity.contact) {
                        return { status: 201, message: "Record not found!" };
                    } else {
                        var edHistory = baseEntity.contact;
                        var updatedHistory = [];
                        for (var i = 0; i < edHistory.length; i++) {
                            if (memberFirebaseId != edHistory[i].firebaseID) {
                                updatedHistory.push(edHistory[i]);
                            }
                        }
                        console.log("ID", baseEntity._id);
                        const doc = await this.adapter.updateById(baseEntity._id, { $set: { contact: updatedHistory, updatedAt: new Date() } });
                        const user = await this.transformDocuments(ctx, {}, doc);
                        var userEntity = this.entityChanged("updated", user, ctx).then(() => user);
                        return { status: 200, message: "success" };
                    }
                }
                else {
                    return { status: 201, message: "User not found!" };
                }
            }
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
        generate(fname) {

            var name = fname;
            var totalChar = name.length;
            var vname = name.toLowerCase();
            var finalStr = vname.replace(" ", "_");
            var lenfString = finalStr.length;
            var crop = '';
            var fuserName = '';
            var n = 0;

            // if(lenfString > 0)
            //   {
            if (lenfString > 7) {
                crop = finalStr.slice(0, 6)
                fuserName = crop;
                n = 3;

            } else {
                fuserName = finalStr;
                n = 10 - lenfString;
            }

            var add = 1, max = 12 - add;   // 12 is the min safe number Math.random() can generate without it starting to pad the end with zeros.   

            //  if ( n > max ) {
            //          return generate(fuserName,max) + generate(fuserName, n - max);
            //   }

            max = Math.pow(10, n + add);
            var min = max / 10; // Math.pow(10, n) basically
            var number = Math.floor(Math.random() * (max - min + 1)) + min;

            var finalval = ("" + number).substring(add);
            var retval = fuserName + finalval;
            return retval;

            //   }
        },
        getUniqueID(length) {
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
