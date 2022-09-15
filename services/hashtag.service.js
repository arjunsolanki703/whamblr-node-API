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

/**
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 */

module.exports = {
    name: "hashtag",
    mixins: [DbService("hashtag")],

    /**
     * Settings
     */
    settings: {
        /** Public fields */
        fields: ["_id", "hashName"],
        /** Validator schema for entity */
        entityValidator: {
            // hashName:     { type: "string"}
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
                hashName: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                //let entity = ctx.params.hashName;
                //await this.validateEntity(ctx.params.hashName);


                if (ctx.params.hashName != "") {
                    var temphashName = new RegExp(ctx.params.hashName, 'i');
                    var temp = await this.adapter.find({ query: { hashName: { $regex: temphashName } } });
                }

                //  var temp = await this.adapter.find({ query: { hashName: ctx.params.hashName } });
                console.log("hash", temp);

                if (temp != undefined && temp.length > 0) {
                    var result = [];
                    for (var i = 0; i < temp.length; i++) {
                        console.log("ID", temp[i]._id);

                        var popCount = temp[i].popularityCount;
                        var finalCount = popCount + 1;

                        const data = await this.adapter.updateById(temp[i]._id, { $set: { popularityCount: finalCount, updatedAt: new Date() } });
                        const hash = await this.transformDocuments(ctx, {}, data);
                        var hashEntity = this.entityChanged("updated", hash, ctx).then(() => hash);
                        result.push(data);
                    }
                    return { status: 200, message: "success", data: result };

                } else {
                    let entity = ctx.params;
                    var result = [];
                    entity.hashName = ctx.params.hashName;
                    entity.popularityCount = 0;
                    entity.createdAt = new Date();
                    entity.updatedAt = entity.createdAt;
                    entity.is_active = true;

                    const data = await this.adapter.insert(entity);
                    const hash = await this.transformDocuments(ctx, {}, data);
                    var hashEntity = await this.entityChanged("created", hash, ctx).then(() => hash);
                    result.push(data);
                    console.log("Post", hashEntity);
                    return { status: 200, message: "success", data: result };
                }

            },
        },
        search: {
            params: {
                hashName: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));


                // var temp = await this.adapter.find({ query: { hashName: ctx.params.hashName } });
                // console.log("hash", temp);

                if (ctx.params.hashName != "") {
                    var temphashName = new RegExp(ctx.params.hashName, 'i');
                    // console.log("Regular expression", temphashName);
                    var temp = await this.adapter.find({ query: { hashName: { $regex: temphashName } } });
                }

                return { status: 200, message: "success", data: temp };

            },
        },
        getAllHash: {
            params: {
                searchtext: { type: "string" },
                page: { type: "number" },
                limit: { type: "number" },
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var page_size = ctx.params.limit;
                var page_number = ctx.params.page;
                var firebaseID = ctx.params.firebaseID;

                if (ctx.params.searchtext != "") {
                    var tempName = new RegExp(ctx.params.searchtext, 'i');
                    console.log("Regular expression", tempName);
                    var temp = await this.adapter.find({ query: { hashName: { $regex: tempName }, is_active: true } });
                } else {
                    var temp = await this.adapter.find({});
                }

                console.log("Posts", temp);

                var result = [];
                if (temp != undefined && temp.length > 0) {

                    for (var k = 0; k < temp.length; k++) {
                        var isFollowed = false;
                        if (temp[k].followers) {
                            var followfUser = temp[k].followers;
                            var existRecord = followfUser.includes(firebaseID);
                            if (existRecord) {
                                isFollowed = true;
                            }
                        }
                        temp[k].isFollowed = isFollowed;
                        temp[k].is_active = true;
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
                hashID: { type: "string" },
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.hashID;

                var baseEntity = await this.adapter.findOne({ _id: new ObjectId(entity) });
                console.log("Base User", baseEntity);

                if (!baseEntity.followers) {
                    baseEntity.followers = [];
                    baseEntity.followers.push(ctx.params.firebaseID);
                }
                else {
                    if (baseEntity.followers.indexOf(ctx.params.firebaseID) < 0) {
                        baseEntity.followers.push(ctx.params.firebaseID);
                    }
                }
                console.log("ID", baseEntity._id);

                baseEntity.updatedAt = new Date();
                const doc = await this.adapter.updateById(baseEntity._id, { $set: baseEntity });
                const post = await this.transformDocuments(ctx, {}, doc);
                var postEntity = await this.entityChanged("updated", post, ctx).then(() => post);
                return { status: 200, message: "success", data: { postEntity } };
            },
        },
        followTags: {
            params: {
                hashID: { type: "string" },
                firebaseID: { type: "string" }
            },
            async handler(ctx) {



                var result = ctx.params.hashID.split(',');

                console.log("Params", JSON.stringify(ctx.params));


                for (let i = 0; i < result.length; i++) {
                    let entity = result[i];
                    var baseEntity = await this.adapter.findOne({ _id: new ObjectId(entity) });
                    console.log("Base User", baseEntity);

                    if (!baseEntity.followers) {
                        baseEntity.followers = [];
                        baseEntity.followers.push(ctx.params.firebaseID);
                    }
                    else {
                        if (baseEntity.followers.indexOf(ctx.params.firebaseID) < 0) {
                            baseEntity.followers.push(ctx.params.firebaseID);
                        }
                    }
                    console.log("ID", baseEntity._id);

                    baseEntity.updatedAt = new Date();
                    const doc = await this.adapter.updateById(baseEntity._id, { $set: baseEntity });
                    const post = await this.transformDocuments(ctx, {}, doc);
                    var postEntity = await this.entityChanged("updated", post, ctx).then(() => post);
                }

                return { status: 200, message: "success" };
            },
        },
        unfollow: {
            params: {
                hashID: { type: "string" },
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                let entity = ctx.params.hashID;

                var baseEntity = await this.adapter.findOne({ _id: new ObjectId(entity) });

                console.log("Base User", baseEntity);


                if (baseEntity.followers) {

                    var index = baseEntity.followers.indexOf(ctx.params.firebaseID);
                    if (index > -1) {
                        baseEntity.followers.splice(index, 1);
                    }

                    baseEntity.updatedAt = new Date();
                    const doc = await this.adapter.updateById(baseEntity._id, { $set: baseEntity });
                    const post = await this.transformDocuments(ctx, {}, doc);
                    var postEntity = await this.entityChanged("updated", post, ctx).then(() => post);
                    return { status: 200, message: "success", data: { postEntity } };

                }
                else {
                    return { status: 201, message: "hash not found!" };
                }

            },
        },
        getHashByUser: {
            params: {
                page: { type: "number" },
                limit: { type: "number" },
                firebaseID: { type: "string" }
            },
            async handler(ctx) {

                console.log("Params", JSON.stringify(ctx.params));

                var page_size = ctx.params.limit;
                var page_number = ctx.params.page;
                var firebaseID = ctx.params.firebaseID;

                var temp = await this.adapter.find({});

                console.log("Posts", temp);

                var result = [];
                var userHash = [];
                if (temp != undefined && temp.length > 0) {

                    for (var k = 0; k < temp.length; k++) {
                        if (temp[k].followers) {
                            var followfUser = temp[k].followers;
                            var existRecord = followfUser.includes(firebaseID);
                            if (existRecord) {
                                userHash.push(temp[k]);
                            }
                        }
                    }

                    var totalPages = 1;
                    var totalRecords = userHash.length;

                    if (page_size > 0) {
                        totalPages = Math.ceil((totalRecords / page_size));

                        if (page_number <= totalPages)
                            result = userHash.slice((page_number - 1) * page_size, page_number * page_size);
                    } else {
                        result = userHash;
                    }
                }

                return { status: 200, message: "success", totalPages: totalPages, data: result };

            },
        },
        getByID: {
            params: {
                hashId: { type: "string" }
            },
            async handler(ctx) {

                let entity = ctx.params.hashId;

                var temp = await this.adapter.findOne({ _id: new ObjectId(entity) });
                console.log("Post", temp);

                if (temp.popularityCount)
                    temp.popularityCount++;
                else
                    temp.popularityCount = 1;

                temp.updatedAt = new Date();
                const doc = await this.adapter.updateById(temp._id, { $set: temp });
                const post = await this.transformDocuments(ctx, {}, doc);
                var postEntity = await this.entityChanged("updated", post, ctx).then(() => post);
                return doc;
            },
        },
        getDetails: {
            params: {
                hashId: { type: "string" },
                firebaseID: { type: "string" },
                searchtext: { type: "string" },
                currenttab: { type: "string" },
                page: { type: "number" },
                limit: { type: "number" }
            },
            async handler(ctx) {

                let entity = ctx.params.hashId;
                var firebaseID = ctx.params.firebaseID;
                var searchtext = ctx.params.searchtext;
                var currenttab = ctx.params.currenttab;
                var page_size = ctx.params.limit;
                var page_number = ctx.params.page;

                var isFollowed = false;
                var result = [];

                var temp = await this.adapter.findOne({ _id: new ObjectId(entity) });
                // console.log("Post", temp);

                var followors_count = 0;
                var stories_count = 0;
                if (temp.followers) {
                    followors_count = temp.followers.length;
                    if (followors_count > 0) {
                        var existRecord = temp.followers.includes(firebaseID);
                        if (existRecord) {
                            isFollowed = true;
                        }
                    }

                }
                temp.mentions = temp.popularityCount;
                temp.followers = followors_count;
                temp.isFollowed = isFollowed;
                var hashtext = temp.hashName;

                console.log("-----------------------------------------------------------------");
                console.log("---------------------------ctx.params---------------------------", ctx.params);

                const ctxsocialdata = await ctx.call("post.getSocialHash", { firebaseID: firebaseID, searchtext: searchtext, hashtext: hashtext });
                // console.log("---------------------------social---------------------------", ctxsocialdata);



                const ctximagedata = await ctx.call("post.getImageHash", { firebaseID: firebaseID, searchtext: searchtext, hashtext: hashtext });
                // console.log("---------------------------image---------------------------", ctximagedata);
                const ctxvideodata = await ctx.call("post.getVideoHash", { firebaseID: firebaseID, searchtext: searchtext, hashtext: hashtext });
                // console.log("---------------------------video---------------------------", ctxvideodata);

                var groupData = [];
                var generalData = [];

                if (ctxsocialdata.length > 0) {
                    for (var i = 0; i < ctxsocialdata.length; i++) {
                        var firID = ctxsocialdata[i].firebaseID;
                        if (firebaseID != firID) {
                            const ctxinnerdata = await ctx.call("user.findFirebaseID", { firebaseID: firID });
                            if (ctxinnerdata["result"].length > 0) {
                                var accounttype = ctxinnerdata["result"][0]["type"];
                                if (accounttype == 'group') {
                                    groupData.push(firID);
                                } else {
                                    generalData.push(firID);
                                }
                            }
                        }
                    }
                }

                var Accountreturn = [];
                var groupreturn = [];

                if (groupData.length > 0) {
                    groupData = groupData.filter(function (item, index, inputArray) {
                        return inputArray.indexOf(item) === index;
                    });
                    for (var j = 0; j < groupData.length; j++) {
                        const ctxgroupdata = await ctx.call("user.findFirebaseID", { firebaseID: groupData[j] });
                        if (ctxgroupdata["result"].length > 0) {
                            var totfollowers = 0;
                            var totMembers = 0;
                            var totPosts = 0;
                            if (ctxgroupdata["result"][0]["followers"]) {
                                totfollowers = ctxgroupdata["result"][0]["followers"].length;
                            }
                            if (ctxgroupdata["result"][0]["members"]) {
                                totMembers = ctxgroupdata["result"][0]["members"].length;
                            }

                            var callupostctxdata = [];
                            callupostctxdata = await this.broker.call("post.getUserPosts", { firebaseID: groupData[j] });

                            if (callupostctxdata["result"].length > 0) {
                                totPosts = callupostctxdata["result"].length;
                            }

                            groupreturn.push({ _id: ctxgroupdata["result"][0]["_id"], firebaseID: ctxgroupdata["result"][0]["firebaseID"], fullname: ctxgroupdata["result"][0]["fullname"], userName: ctxgroupdata["result"][0]["userName"], avatar: ctxgroupdata["result"][0]["avatar"], followers: totfollowers, members: totMembers, posts: totPosts });
                        }
                    }
                }

                if (generalData.length > 0) {
                    generalData = generalData.filter(function (item, index, inputArray) {
                        return inputArray.indexOf(item) === index;
                    });
                    for (var k = 0; k < generalData.length; k++) {
                        const ctxaccountdata = await ctx.call("user.findFirebaseID", { firebaseID: generalData[k] });
                        if (ctxaccountdata["result"].length > 0) {
                            var totaccfollowers = 0;
                            var totaccPosts = 0;
                            if (ctxaccountdata["result"][0]["followers"]) {
                                totaccfollowers = ctxaccountdata["result"][0]["followers"].length;
                            }
                            var calluapostctxdata = [];
                            calluapostctxdata = await this.broker.call("post.getUserPosts", { firebaseID: generalData[k] });

                            if (calluapostctxdata["result"].length > 0) {
                                totaccPosts = calluapostctxdata["result"].length;
                            }
                            Accountreturn.push({ _id: ctxaccountdata["result"][0]["_id"], firebaseID: ctxaccountdata["result"][0]["firebaseID"], fullname: ctxaccountdata["result"][0]["fullname"], userName: ctxaccountdata["result"][0]["userName"], avatar: ctxaccountdata["result"][0]["avatar"], followers: totaccfollowers, posts: totaccPosts });
                        }
                    }
                }

                const ctxgetUserHash = await ctx.call("user.getUserHash", { searchtext: searchtext, hashtext: hashtext });

                temp.Posts = ctxsocialdata;
                temp.Images = ctximagedata;
                temp.Videos = ctxvideodata;
                // temp.Accounts = Accountreturn;
                temp.Groups = groupreturn;
                // temp.UsersHashTags = ctxgetUserHash;

                var totalPages = 1;
                if (currenttab == 'social') {
                    temp.stories = ctxsocialdata.length;
                    var totalRecords = ctxsocialdata.length;
                    totalPages = Math.ceil((totalRecords / page_size));
                    if (page_number <= totalPages)
                        temp.Posts = ctxsocialdata.slice((page_number - 1) * page_size, page_number * page_size);
                } else if (currenttab == 'picture') {
                    temp.stories = ctximagedata.length;
                    var totalRecords = ctximagedata.length;
                    totalPages = Math.ceil((totalRecords / page_size));
                    if (page_number <= totalPages)
                        temp.Images = ctximagedata.slice((page_number - 1) * page_size, page_number * page_size);
                } else if (currenttab == 'video') {
                    temp.stories = ctxvideodata.length;
                    var totalRecords = ctxvideodata.length;
                    totalPages = Math.ceil((totalRecords / page_size));
                    if (page_number <= totalPages)
                        temp.Videos = ctxvideodata.slice((page_number - 1) * page_size, page_number * page_size);
                } else if (currenttab == 'account') {
                    temp.stories = ctxgetUserHash.length;
                    var totalRecords = ctxgetUserHash.length;
                    totalPages = Math.ceil((totalRecords / page_size));
                    if (page_number <= totalPages)
                        temp.Accounts = ctxgetUserHash;
                    temp.Accounts = ctxgetUserHash.slice((page_number - 1) * page_size, page_number * page_size);
                } else if (currenttab == 'group') {
                    temp.stories = groupreturn.length;
                    var totalRecords = groupreturn.length;
                    totalPages = Math.ceil((totalRecords / page_size));
                    if (page_number <= totalPages)
                        temp.Groups = groupreturn.slice((page_number - 1) * page_size, page_number * page_size);
                }
                result = temp;


                return { status: 200, message: "success", totalPages: totalPages, data: result };
                // return { status : 200, message : "success", post : ctx.params };


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
