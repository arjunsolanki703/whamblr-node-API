"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
// const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { ServiceBroker } = require("moleculer");
const DbService = require("../mixins/db.mixin");
const broker = new ServiceBroker();
var ReadableData = require('stream').Readable;
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");
var ObjectId = require('mongodb').ObjectID;

/**
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 */

module.exports = {
    name: "settings",
    mixins: [DbService("settings")],

    /**
     * Settings
     */
    settings: {
        /** Public fields */
        fields: ["_id"],
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

                entity.isActive = false;
                entity.createdAt = new Date();
                entity.updatedAt = entity.createdAt;
                const doc = await this.adapter.insert(entity);
                const post = await this.transformDocuments(ctx, {}, doc);
                var postEntity = await this.entityChanged("created", post, ctx).then(() => post);

                return { status: 200, message: "success", data: doc };

            },
        },
        update: {
            params: {
                data: { type: "object" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.data;

                var settingID = entity._id;
                console.log("Post ID", settingID);
                var temp = await this.adapter.findOne({ _id: new ObjectId(settingID) });
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
                    return { status: 201, message: "Record not found!" };
                }
            },
        },
        delete: {
            params: {
                settingID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.settingID;

                var deletedEntity = await this.adapter.removeById(entity);

                if (deletedEntity)
                    return { status: 200, message: "Settings deleted successfully!" };
                else
                    return { status: 201, message: "Settings delete failed!" };

            },
        },
        getByID: {
            params: {
                settingID: { type: "string" }
            },
            async handler(ctx) {

                var result = [];
                var settingID = ctx.params.settingID;

                var temp = await this.adapter.findOne({ _id: new ObjectId(settingID) });

                result.push(temp);


                return { status: 200, message: "success", data: result };

            },
        },
        getAll: {
            params: {
            },
            async handler(ctx) {

                var result = [];

                var temp = await this.adapter.find({});


                if (temp != undefined && temp.length > 0) {
                    result = temp;
                }

                return { status: 200, message: "success", data: result };

            },
        },
        getActive: {
            params: {
                isActive: { type: "boolean" }
            },
            async handler(ctx) {

                var result = [];
                var isActive = ctx.params.isActive;

                var temp = await this.adapter.findOne({ isActive: isActive });

                result.push(temp);


                return { result };

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
