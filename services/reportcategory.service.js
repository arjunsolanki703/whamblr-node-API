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
    name: "reportcategory",
    mixins: [DbService("reportCategory")],

    /**
     * Settings
     */
    settings: {
        /** Public fields */
        fields: ["_id", "category"],
        /** Validator schema for entity */
        entityValidator: {
            category: { type: "string" },
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
        createReportcat: {
            params: {
                category: { type: "string" }
            },
            async handler(ctx) {
                let entity = ctx.params;

                entity.createdAt = new Date();
                entity.updatedAt = entity.createdAt;

                const doc = await this.adapter.insert(entity);
                const cat = await this.transformDocuments(ctx, {}, doc);
                var likePostEntity = await this.entityChanged("created", cat, ctx).then(() => cat);
                return { status: 200, message: "Report category created successfully!", data: doc };
            }
        },
        updateReportcat: {
            params: {
                catid: { type: "string" },
                category: { type: "string" }
            },
            async handler(ctx) {
                let updateEntity = {
                    category: ctx.params.category,
                    updatedAt: new Date()
                }
                const doc = await this.adapter.updateById(ctx.params.catid, { $set: updateEntity });
                const post = await this.transformDocuments(ctx, {}, doc);
                var postEntity = await this.entityChanged("updated", post, ctx).then(() => post);
                return { status: 200, message: "successfully updated", data: doc };
            }
        },
        deleteReportcat: {
            params: {
                catid: { type: "string" },
            },
            async handler(ctx) {
                var deletedEntity = await this.adapter.removeById(ctx.params.catid);
                return { status: 200, message: "Report category deleted successfully!" };
            }
        },
        listReportcat: {
            async handler() {
                const doc = await this.adapter.find();
                return { status: 200, message: "success", data: doc };
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
