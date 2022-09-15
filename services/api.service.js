"use strict";

const ApiGateway = require("moleculer-web");
const E = require("moleculer-web").Errors;
const fs = require("fs");

require("dotenv").config();

const admin = require("firebase-admin");
var serviceAccount = require("../admin-dashboard-50850-firebase-adminsdk-lrrsc-5460925e75.json");
// var serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: "https://admin-dashboard-50850.firebaseio.com",
});

/**
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 * @typedef {import('http').IncomingMessage} IncomingRequest Incoming HTTP Request
 * @typedef {import('http').ServerResponse} ServerResponse HTTP Server Response
 */

module.exports = {
	name: "api",
	mixins: [ApiGateway],

	// More info about settings: https://moleculer.services/docs/0.14/moleculer-web.html
	settings: {
		// Exposed port
		port: process.env.PORT || 3000,

		// Exposed IP
		ip: "0.0.0.0",

		// HTTPS server with certificate
		// https: {
		// 	key: fs.readFileSync("/etc/letsencrypt/live/dev.admin-dashboard.com/privkey.pem"),
		// 	cert: fs.readFileSync("/etc/letsencrypt/live/dev.admin-dashboard.com/cert.pem")
		// },

		// Global Express middlewares. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Middlewares
		use: [],

		routes: [
			{
				path: "/api",

				whitelist: ["**"],

				cors: {
					origin: ["*"],
					methods: ["GET", "OPTIONS", "POST", "PATCH", "DELETE"],
					credentials: false,
				},

				// Route-level Express middlewares. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Middlewares
				use: [],

				// Enable/disable parameter merging method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Disable-merging
				mergeParams: true,

				// Enable authentication. Implement the logic into `authenticate` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authentication
				authentication: false,

				// Enable authorization. Implement the logic into `authorize` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authorization
				authorization: false,

				// The auto-alias feature allows you to declare your route alias directly in your services.
				// The gateway will dynamically build the full routes from service schema.
				autoAliases: true,

				aliases: {},

				/**
				 * Before call hook. You can check the request.
				 * @param {Context} ctx
				 * @param {Object} route
				 * @param {IncomingRequest} req
				 * @param {ServerResponse} res
				 * @param {Object} data
				 */
				onBeforeCall(ctx, route, req, res) {
					// Set request headers to context meta
					ctx.meta.requestHeaders = req.headers;
				},

				/**
				 * After call hook. You can modify the data.
				 * @param {Context} ctx 
				 * @param {Object} route 
				 * @param {IncomingRequest} req 
				 * @param {ServerResponse} res 
				 * @param {Object} data
				onAfterCall(ctx, route, req, res, data) {
					// Async function which return with Promise
					return doSomething(ctx, res, data);
				}, */

				// Calling options. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Calling-options
				callingOptions: {},

				bodyParsers: {
					json: {
						strict: false,
						limit: "100MB",
					},
					urlencoded: {
						extended: true,
						limit: "100MB",
					},
				},

				// Mapping policy setting. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Mapping-policy
				mappingPolicy: "all", // Available values: "all", "restrict"

				// Enable/disable logging
				logging: true,
			},
		],

		// Do not log client side errors (does not log an error response when the error.code is 400<=X<500)
		log4XXResponses: false,
		// Logging the request parameters. Set to any log level to enable it. E.g. "info"
		logRequestParams: null,
		// Logging the response data. Set to any log level to enable it. E.g. "info"
		logResponseData: null,

		// Serve assets from "public" folder. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Serve-static-files
		assets: {
			folder: "public",

			// Options to `server-static` module
			options: {},
		},
		profileimages: {
			// Root folder of assets
			folder: "./public/profileimages",

			// Further options to `server-static` module
			options: {},
		},
		postimages: {
			// Root folder of assets
			folder: "./public/postimanges",

			// Further options to `server-static` module
			options: {},
		},
		postvideos: {
			// Root folder of assets
			folder: "./public/postvideos",

			// Further options to `server-static` module
			options: {},
		},
		onError(req, res, err) {
			// Return with the error as JSON object
			res.setHeader("Content-type", "application/json; charset=utf-8");
			res.writeHead(err.code || 500);
			console.log("Error code", err.code);

			res.end(JSON.stringify({ errors: err }, null, 2));
			////} else {//
			//const errObj = _.pick(err, ["name", "message", "code", "type", "data"]);
			//res.end(JSON.stringify(errObj, null, 2));
			//}
			this.logResponse(req, res, err ? err.ctx : null);
		},
	},

	methods: {
		/**
		 * Authenticate the request. It check the `Authorization` token value in the request header.
		 * Check the token value & resolve the user by the token.
		 * The resolved user will be available in `ctx.meta.user`
		 *
		 * PLEASE NOTE, IT'S JUST AN EXAMPLE IMPLEMENTATION. DO NOT USE IN PRODUCTION!
		 *
		 * @param {Context} ctx
		 * @param {Object} route
		 * @param {IncomingRequest} req
		 * @returns {Promise}
		 */
		async authenticate(ctx, route, req) { },

		/**
		 * Authorize the request. Check that the authenticated user has right to access the resource.
		 *
		 * PLEASE NOTE, IT'S JUST AN EXAMPLE IMPLEMENTATION. DO NOT USE IN PRODUCTION!
		 *
		 * @param {Context} ctx
		 * @param {Object} route
		 * @param {IncomingRequest} req
		 * @returns {Promise}
		 */
		async authorize(ctx, route, req, res) {
			// Get the authenticated user.
			/*const user = ctx.meta.user;

			// It check the `auth` property in action schema.
			if (req.$action.auth == "required" && !user) {
				throw new ApiGateway.Errors.UnAuthorizedError("NO_RIGHTS");
			}*/

			// Read the token from header
			const auth = req.headers["authorization"];

			if (auth && auth.startsWith("Bearer")) {
				const token = auth.slice(7);

				// Check the token. Tip: call a service which verify the token. E.g. `accounts.resolveToken`
				if (token != "" && token != undefined) {
					// Returns the resolved user. It will be set to the `ctx.meta.user`
					// Validate token with Firebase Admin

					console.log("Firebase ID Token", token);

					admin
						.auth()
						.verifyIdToken(token)
						.then((decodedToken) => {
							const uid = decodedToken.uid;
							console.log("Firebase User ID", uid);
							ctx.meta.user = { firebaseUserID: uid };
							return Promise.resolve(ctx);
						})
						.catch((error) => {
							console.log("Auth Error", error);
							res.setHeader("Content-Type", "text/json");
							res.writeHead(401);
							res.end(
								JSON.stringify(
									{ errors: "Invalid Token" },
									null,
									2
								)
							);
						});

					//return { id: 1, name: "John Doe" };
				} else {
					// Invalid token
					res.setHeader("Content-Type", "text/json");
					res.writeHead(401);
					res.end(
						JSON.stringify({ errors: "Invalid Token" }, null, 2)
					);
				}
			} else {
				// No token. Throw an error or do nothing if anonymous access is allowed.
				res.setHeader("Content-Type", "text/json");
				res.writeHead(401);
				res.end(JSON.stringify({ errors: "Invalid Token" }, null, 2));
			}
		},
	},
};
