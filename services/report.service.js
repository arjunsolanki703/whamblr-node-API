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
    name: "report",
    mixins: [DbService("report")],

    /**
     * Settings
     */
    settings: {
        /** Public fields */
        fields: ["_id", "category", "reportedBy"],
        /** Validator schema for entity */
        entityValidator: {
            category: { type: "string" },
            reportedBy: { type: "string" }
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
        reportUser: {
            params: {
                data: { type: "object" }  //? firebaseID(reportedUser),category,reportedBy
            },
            async handler(ctx) {
                let entity = ctx.params.data;
                entity.createdAt = new Date();
                entity.type = "user";
                const doc = await this.adapter.insert(entity);
                const cat = await this.transformDocuments(ctx, {}, doc);
                var reportUserEntity = await this.entityChanged("created", cat, ctx).then(() => cat);
                return { status: 200, message: "Report created successfully!", data: doc };
            }
        },
        reportPost: {
            params: {
                data: { type: "object" }  //? postID(reportedpost),category,reportedBy
            },
            async handler(ctx) {
                let entity = ctx.params.data;
                entity.createdAt = new Date();
                entity.type = "post";
                const doc = await this.adapter.insert(entity);
                const cat = await this.transformDocuments(ctx, {}, doc);
                var reportUserEntity = await this.entityChanged("created", cat, ctx).then(() => cat);
                return { status: 200, message: "Report created successfully!", data: doc };
            }
        },
        reportComment: {
            params: {
                data: { type: "object" }  //? commnetID(reportedpost),category,reportedBy
            },
            async handler(ctx) {
                let entity = ctx.params.data;
                entity.createdAt = new Date();
                entity.type = "comment";
                const doc = await this.adapter.insert(entity);
                const cat = await this.transformDocuments(ctx, {}, doc);
                var reportUserEntity = await this.entityChanged("created", cat, ctx).then(() => cat);
                return { status: 200, message: "Report created successfully!", data: doc };
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
