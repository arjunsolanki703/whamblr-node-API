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
    name: "postviewed",
    mixins: [DbService("postviewed")],

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

                const ctxuser = await ctx.call("user.findFirebaseID", { firebaseID: ctx.params.firebaseID });
                var firebaseID = ctx.params.firebaseID;

                if (ctxuser["result"].length > 0) {
                    if (!ctxuser["result"][0]["isPrimaryProfile"]) {
                        firebaseID = ctxuser["result"][0]["primaryObjectId"];
                    }
                }

                var baseEntity = await this.adapter.findOne({ firebaseID: firebaseID, postID: ctx.params.postID });
                if (!baseEntity) {

                    let entity = ctx.params;

                    await this.validateEntity(entity);
                    entity.firebaseID = firebaseID;
                    entity.createdAt = new Date();

                    const doc = await this.adapter.insert(entity);
                    const viewPost = await this.transformDocuments(ctx, {}, doc);
                    var viewPostEntity = await this.entityChanged("created", viewPost, ctx).then(() => viewPost);
                    return { status: 200, message: "Post viewed successfully!", data: doc };
                }

            },
        },
        getViewPostCount: {
            params: {
                postID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.postID;

                var temp = await this.adapter.find({ query: { postID: entity } });
                var totalRecords = 0;

                if (temp != undefined && temp.length > 0) {

                    totalRecords = temp.length;
                }

                return { totalRecords: totalRecords };

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
                return { status: 200, message: "Viewed Post deleted successfully!" };
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
                return { status: 200, message: "Viewed Post deleted successfully!" };
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
