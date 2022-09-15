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
    name: "postcommentreaction",
    mixins: [DbService("postcommentreaction")],

    /**
     * Settings
     */
    settings: {
        /** Public fields */
        fields: ["commentID", "firebaseID", "reactionType"],
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
        createreaction: {
            params: {
                firebaseID: { type: "string" },
                commentID: { type: "string" },
                reactionType: { type: "string" },
            },
            async handler(ctx) {
                let entity = ctx.params;
                var postID = ctx.params;
                var temp = await this.adapter.find({
                    query: {
                        firebaseID: entity.firebaseID,
                        commentID: entity.commentID,
                        reactionType: entity.reactionType
                    }
                });
                if (temp != undefined && temp.length > 0) {
                    await this.adapter.removeById(temp[0]._id);
                } else {
                    entity.firebaseID = ctx.params.firebaseID;
                    entity.commentID = ctx.params.commentID;
                    entity.reactionType = ctx.params.reactionType;
                    entity.createdAt = new Date();

                    const data = await this.adapter.insert(entity);
                    const user = await this.transformDocuments(ctx, {}, data);
                    var userEntity = this.entityChanged("created", user, ctx).then(() => user);
                }
            }
        },
        getReactionCount: {
            params: {
                firebaseID: { type: "string" },
                commentID: { type: "string" },
                reactionType: { type: "string" },
            },
            async handler(ctx) {
                let entity = ctx.params;
                var temp = await this.adapter.find({
                    query: {
                        commentID: entity.commentID,
                        reactionType: entity.reactionType
                    }
                });
                return { status: 201, message: "Reaction count", data: temp.length };
            }
        },
        getReactionByMe: {
            params: {
                firebaseID: { type: "string" },
                commentID: { type: "string" },
                reactionType: { type: "string" },
            },
            async handler(ctx) {
                let entity = ctx.params;

                var angry_temp = await this.adapter.find({
                    query: {
                        commentID: entity.commentID,
                        reactionType: "angry",
                        firebaseID: entity.firebaseID
                    }
                });
                var funny_temp = await this.adapter.find({
                    query: {
                        commentID: entity.commentID,
                        reactionType: "funny",
                        firebaseID: entity.firebaseID
                    }
                });
                var love_temp = await this.adapter.find({
                    query: {
                        commentID: entity.commentID,
                        reactionType: "love",
                        firebaseID: entity.firebaseID
                    }
                });
                var sad_temp = await this.adapter.find({
                    query: {
                        commentID: entity.commentID,
                        reactionType: "sad",
                        firebaseID: entity.firebaseID
                    }
                });
                var wow_temp = await this.adapter.find({
                    query: {
                        commentID: entity.commentID,
                        reactionType: "wow",
                        firebaseID: entity.firebaseID
                    }
                });



                const all_temp = {
                    angry: angry_temp.length,
                    funny: funny_temp.length,
                    love: love_temp.length,
                    sad: sad_temp.length,
                    wow: wow_temp.length,
                }

                return { status: 201, message: "My Reaction count", data: all_temp };
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
