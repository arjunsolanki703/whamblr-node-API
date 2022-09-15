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
var ObjectId = require('mongodb').ObjectID;
/**
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 */

module.exports = {
    name: "notification",
    mixins: [DbService("notification")],

    /**
     * Settings
     */
    settings: {
        /** Public fields */
        fields: ["_id", "TofirebaseID", "FromfirebaseID", "type", "msg", "read"],
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
                data: { type: "object" }
            },
            async handler(ctx) {

                let entity = ctx.params.data;
                // await this.validateEntity(entity);

                entity.createdAt = new Date();
                entity.updatedAt = entity.createdAt;

                const data = await this.adapter.insert(entity);
                const notification = await this.transformDocuments(ctx, {}, data);
                var postEntity = await this.entityChanged("created", notification, ctx).then(() => notification);

                return { status: 200, message: "success" };

            },
        },
        delete: {
            params: {
                notificationID: { type: "string" }
            },
            async handler(ctx) {

                var notificationID = ctx.params.notificationID;

                var deletedEntity = await this.adapter.removeById(notificationID);
                if (deletedEntity)
                    return { status: 200, message: "Notification deleted successfully!" };
                else
                    return { status: 201, message: "Notification delete failed!" };

            },
        },
        update: {
            params: {
                notificationID: { type: "array" }
            },
            async handler(ctx) {
                let ID = ctx.params.notificationID;
                let Objectid = ID.map((ele) => ObjectId(ele));

                let data = await this.adapter.updateMany({ _id: { $in: Objectid } }, { $set: { read: true } });

                return { status: 200, message: "success updated", total: data }
            }
        },
        badge: {
            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {
                let count = await this.adapter.count({ query: { TofirebaseID: ctx.params.firebaseID, read: false } });

                return { status: 200, message: "success", count: count }
            }
        },
        getByFirebaseID: {
            params: {
                firebaseID: { type: "string" },
                // page: {type: "number"},
                // limit: {type: "number"}
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.firebaseID;
                // var page_size = ctx.params.limit;
                // var page_number = ctx.params.page;

                var temp = await this.adapter.find({ query: { TofirebaseID: entity, read: true } });
                var temp2 = await this.adapter.find({ query: { TofirebaseID: entity, read: false } });
                console.log("Posts", temp);
                console.log("Posts", temp2);

                var Read = [];
                var Unread = [];
                if (temp != undefined && temp.length > 0) {
                    Read = temp;
                }
                if (temp2 != undefined && temp2.length > 0) {
                    Unread = temp2;
                }

                // if(temp != undefined && temp.length > 0)
                // {
                //     var totalPages = 1;
                //     var totalRecords = temp.length;
                //     totalPages = Math.ceil((totalRecords/page_size));

                //     if(page_number<= totalPages)
                //         result = temp.slice((page_number - 1) * page_size, page_number * page_size);
                // }

                return { status: 200, message: "success", read: Read, unread: Unread };

            },
        },
        chatNoti: {
            params: {
                data: { type: "object" }
            },
            async handler(ctx) {
                let entity = ctx.params.data;
                let message = {
                    app_id: _const.appId,
                    contents: entity.contents,
                    include_player_ids: entity.pushId,
                    ios_badgeType: entity.ios_badgeType,
                    ios_badgeCount: entity.ios_badgeCount
                }
                _const.sendNotification(message);
                return { status: 200, message: "success" }
            }
        },
        deleteAll: {
            params: {
                firebaseID: { type: "string" }
            },
            async handler(ctx) {
                let total = await this.adapter.removeMany({ TofirebaseID: ctx.params.firebaseID });

                return { status: 200, message: "success", total: total }
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
