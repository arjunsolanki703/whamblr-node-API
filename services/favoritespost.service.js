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

/**
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 */

module.exports = {
    name: "favoritespost",
    mixins: [DbService("favoritespost")],

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

                    await this.validateEntity(entity);

                    entity.createdAt = new Date();
                    entity.updatedAt = entity.createdAt;

                    const doc = await this.adapter.insert(entity);
                    const favPost = await this.transformDocuments(ctx, {}, doc);
                    var favPostEntity = await this.entityChanged("created", favPost, ctx).then(() => favPost);

                    console.log("Post", favPostEntity);

                    return { status: 200, message: "Post favorite successfully!", data: doc };
                }
                else {
                    return { status: 200, message: "Post favorite successfully!", data: baseEntity };
                }

            },
        },
        delete: {
            params: {
                firebaseID: { type: "string" },
                postID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var baseEntity = await this.adapter.findOne({ firebaseID: ctx.params.firebaseID, postID: ctx.params.postID });
                console.log("Base User", baseEntity);

                if (baseEntity) {
                    let entity = baseEntity._id;
                    var deletedEntity = await this.adapter.removeById(entity);
                    if (deletedEntity)
                        return { status: 200, message: "Post unfavorite successfully!" };
                    else
                        return { status: 201, message: "Post unfavorite failed!" };
                }
                else {
                    return { status: 201, message: "Post unfavorite failed!" };
                }

            },
        },
        //* chnaged
        getByFirebaseID: {
            params: {
                firebaseID: { type: "string" },
                page: { type: "number" },
                limit: { type: "number" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.firebaseID;
                var page_size = ctx.params.limit;
                var page_number = ctx.params.page;

                var temp = await this.adapter.find({ query: { firebaseID: entity } });
                var temp = temp.sort((a, b) => b.createdAt - a.createdAt);

                var newResult = [];

                const ctxfireuser = await ctx.call("user.findFirebaseID", { firebaseID: entity });
                var blockID = ctxfireuser["result"][0]["blockedUserId"];

                if (temp != undefined && temp.length > 0) {
                    for (var j = 0; j < temp.length; j++) {
                        let ctxpost = await ctx.call("post.getbyID", { postID: temp[j].postID });

                        if (typeof blockID === "undefined" || !blockID.includes(ctxpost.result.firebaseID)) {

                            let creatorUser = ctxpost.result.firebaseID;
                            let ctxdata = await ctx.call("user.findFirebaseID", { firebaseID: creatorUser });
                            if (ctxdata["result"].length > 0) {
                                if (typeof ctxdata["result"][0].blockedUserId === "undefined" || !ctxdata["result"][0].blockedUserId.includes(entity)) {

                                    newResult.push({ _id: temp[j].postID.toString(), firebaseID: temp[j].firebaseID });
                                }
                            }
                        }
                    }
                }

                temp = newResult;

                if (temp != undefined && temp.length > 0) {
                    for (var k = 0; k < temp.length; k++) {
                        var isFollowed = false;
                        var postID = temp[k]._id;
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

                        const ctxcomment = await ctx.call("postcomment.getlatest", { postID: postID });
                        const ctxfavpost = await ctx.call("favoritespost.findUserPost", { firebaseID: entity, postID: postID });
                        temp[k].commentData = ctxcomment["comment"];
                        temp[k].comments = ctxcomment["total"];
                        temp[k].isfav = ctxfavpost["found"];
                    }
                }


                console.log("Posts", temp);

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
        getFavPostCount: {
            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.firebaseID;

                var temp = await this.adapter.find({ query: { firebaseID: entity } });
                var totalRecords = 0;

                if (temp != undefined && temp.length > 0) {

                    totalRecords = temp.length;
                }

                return { totalRecords: totalRecords };

            },
        },
        findUserPost: {
            params: {
                firebaseID: { type: "string" },
                postID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var firebaseID = ctx.params.firebaseID;
                var postID = ctx.params.postID;
                var result = [];

                var temp = await this.adapter.find({ query: { firebaseID: firebaseID, postID: postID } });
                console.log("favpost", temp);

                if (temp != undefined && temp.length > 0) {
                    result = temp;
                    return { found: true };
                }
                else {
                    return { found: false };
                }

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
                return { status: 200, message: "Favorites Post deleted successfully!" };
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
                return { status: 200, message: "Favorites Post deleted successfully!" };
            },
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
