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
const _const = require("../constant");
/**
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 */

module.exports = {
    name: "likepost",
    mixins: [DbService("likepost")],

    /**
     * Settings
     */
    settings: {
        /** Public fields */
        fields: ["_id", "firebaseID", "postID"],
        /** Validator schema for entity */
        entityValidator: {
            firebaseID: { type: "string" },
            postID: { type: "string" }
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
                firebaseID: { type: "string" },
                postID: { type: "string" }
            },
            async handler(ctx) {
                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID, postID: ctx.params.postID });
                if (!baseEntity) {
                    let entity = ctx.params;
                    let noti_data = {};
                    let userpost = await ctx.call("post.getbyID", { postID: ctx.params.postID });
                    let postOwner = await ctx.call("user.findFirebaseID", { firebaseID: userpost.result.firebaseID });
                    let user = await ctx.call("user.findFirebaseID", { firebaseID: entity.firebaseID });

                    let fireuserName = '';
                    let fireuserAvatar = '';

                    if (user["result"].length > 0) {
                        fireuserName = user["result"][0]["fullname"];
                        fireuserAvatar = user["result"][0]["avatar"];
                    }
                    if (userpost.result.firebaseID != entity.firebaseID) {
                        if (userpost.result.isNotificationOff == undefined || !userpost.result.isNotificationOff) {

                            noti_data.TofirebaseID = userpost.result.firebaseID;
                            noti_data.FromfirebaseID = entity.firebaseID;
                            noti_data.type = "loved";
                            noti_data.msg = fireuserName + " Loved your post";
                            noti_data.read = false;
                            noti_data.details = {
                                fireuserName: fireuserName,
                                fireuserAvatar: fireuserAvatar
                            }
                            noti_data.createdAt = new Date();
                            const noti = await ctx.call("notification.create", { data: noti_data });
                            const badge = await ctx.call("notification.badge", { firebaseID: userpost.result.firebaseID });

                            await this.validateEntity(entity);
                            let _mediaID = "";
                            if (userpost.result.postMedia.length > 0) {
                                _mediaID = userpost.result.postMedia[0].mediaID;
                            }

                            entity.createdAt = new Date();
                            let playerID = [];
                            playerID.push(postOwner["result"][0]["pushId"]);
                            let message = {
                                app_id: _const.appId,
                                ios_badgeType: "SetTo",
                                ios_badgeCount: badge.count,
                                contents: { "en": fireuserName + " Loved your post" },
                                include_player_ids: playerID,
                                data: { "type": "loved", "mediaID": _mediaID, "postID": ctx.params.postID }
                            }
                            _const.sendNotification(message);
                        }
                    }
                    const doc = await this.adapter.insert(entity);
                    const likePost = await this.transformDocuments(ctx, {}, doc);
                    var likePostEntity = await this.entityChanged("created", likePost, ctx).then(() => likePost);
                    return { status: 200, message: "Post like successfully!", data: doc };
                }
            },
        },
        getByPostID: {
            params: {
                postID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var postID = ctx.params.postID;

                var temp = await this.adapter.find({ query: { postID: postID } });

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
                    result = temp[temp.length - 1];
                }

                return { likeData: result };

            },
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
                return { status: 200, message: "Like Post deleted successfully!" };
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
                return { status: 200, message: "Like sPost deleted successfully!" };
            },
        },
        getLikeByMe: {
            params: {
                postID: { type: "string" },
                firebaseID: { type: "string" },
            },
            async handler(ctx) {
                var baseEntity = await this.adapter.find({ query: { firebaseID: ctx.params.firebaseID, postID: ctx.params.postID } });
                console.log('baseEntity: ' + JSON.stringify(baseEntity))
                if (baseEntity.length == 0) {
                    var isLikebyme = false;
                } else {
                    var isLikebyme = true;
                }
                return { isLikebyme: isLikebyme };
            },
        },
        delete: {
            params: {
                postID: { type: "string" },
                firebaseID: { type: "string" }
            },
            async handler(ctx) {
                const doc = await this.adapter.removeMany({ postID: ctx.params.postID, firebaseID: ctx.params.firebaseID });

                return { status: 200, message: "successfully deleted" }
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
