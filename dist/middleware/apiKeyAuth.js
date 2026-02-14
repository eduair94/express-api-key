"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiKeyMiddlewareWithConnection = createApiKeyMiddlewareWithConnection;
exports.createRenewalFunction = createRenewalFunction;
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_1 = require("express");
const dashboard_1 = require("../dashboard");
const ApiKey_1 = require("../models/ApiKey");
const Role_1 = require("../models/Role");
function getOrCreateModel(mongoose, name, schema) {
    return mongoose.models[name] || mongoose.model(name, schema);
}
function createApiKeyMiddlewareWithConnection(mongoose, options = {}) {
    var _a, _b, _c, _d;
    const ApiKeyModel = getOrCreateModel(mongoose, "ApiKey", ApiKey_1.ApiKeySchema);
    const RoleModel = getOrCreateModel(mongoose, "Role", Role_1.RoleSchema);
    const headerName = options.headerName || "x-api-key";
    const exposeStats = (_a = options.exposeStatsEndpoint) !== null && _a !== void 0 ? _a : false;
    const statsPath = options.statsEndpointPath || "/api-key-stats";
    const countOnly200 = (_b = options.countOnly200) !== null && _b !== void 0 ? _b : true; // Default to only counting 200 status
    const exposeDashboard = (_c = options.exposeDashboard) !== null && _c !== void 0 ? _c : false;
    const dashboardPath = options.dashboardPath || "/dashboard";
    const sessionExpiry = (_d = options.sessionExpiry) !== null && _d !== void 0 ? _d : 24 * 60 * 60 * 1000; // 24 hours default
    const router = (0, express_1.Router)();
    // Set session secret if provided
    if (options.sessionSecret) {
        (0, dashboard_1.setSessionSecret)(options.sessionSecret);
    }
    // Initialize session store with MongoDB connection for persistence
    if (exposeDashboard) {
        (0, dashboard_1.initSessionStore)(mongoose);
    }
    // Add cookie parser for dashboard session support
    if (exposeDashboard) {
        router.use((0, cookie_parser_1.default)());
        router.use((0, express_1.json)());
        router.use((0, express_1.urlencoded)({ extended: true }));
    }
    // Built-in stats endpoint
    if (exposeStats) {
        router.get(statsPath, async (req, res) => {
            var _a, _b;
            const apiKey = req.header(headerName);
            const apiKeyDoc = await ApiKeyModel.findOne({ key: apiKey });
            const roleInfo = apiKeyDoc ? await RoleModel.findOne({ name: apiKeyDoc.role }) : null;
            if (!apiKeyDoc) {
                return res.status(404).json({ error: "API key not found" });
            }
            // Effective expiration: per-key expiresAt > daysValid calculation
            let expiresAt = null;
            if (apiKeyDoc.expiresAt) {
                expiresAt = new Date(apiKeyDoc.expiresAt);
            }
            else {
                const start = apiKeyDoc.requestCountStart;
                if (start) {
                    expiresAt = new Date(new Date(start).getTime() + apiKeyDoc.daysValid * 24 * 60 * 60 * 1000);
                }
            }
            // Effective cap: per-key override > role > default
            const effectiveCap = (_b = (_a = apiKeyDoc.maxMonthlyUsage) !== null && _a !== void 0 ? _a : roleInfo === null || roleInfo === void 0 ? void 0 : roleInfo.maxMonthlyUsage) !== null && _b !== void 0 ? _b : 10000;
            return res.json({
                key: apiKeyDoc.key,
                role: apiKeyDoc.role,
                requestCountMonth: apiKeyDoc.requestCountMonth,
                requestCountStart: apiKeyDoc.requestCountStart,
                lastUsedAt: apiKeyDoc.lastUsedAt,
                maxMonthlyUsage: effectiveCap,
                expiresAt: expiresAt || "Api key not used yet",
                roleInfo,
            });
        });
    }
    // Dashboard UI endpoints with session-based authentication
    if (exposeDashboard) {
        const sessionOptions = {
            sessionExpiry,
            cookiePath: dashboardPath,
        };
        // Login page (GET) - show login form or redirect to dashboard if already logged in
        router.get(`${dashboardPath}/login`, async (req, res) => {
            const sessionApiKey = await (0, dashboard_1.getSessionApiKey)(req, sessionOptions);
            if (sessionApiKey) {
                // Already logged in, redirect to dashboard
                return res.redirect(dashboardPath);
            }
            res.setHeader("Content-Type", "text/html");
            return res.send((0, dashboard_1.renderLoginPage)({ dashboardPath }));
        });
        // Login handler (POST) - validate API key and create session
        router.post(`${dashboardPath}/login`, async (req, res) => {
            var _a;
            const apiKey = (_a = req.body) === null || _a === void 0 ? void 0 : _a.apiKey;
            if (!apiKey) {
                res.setHeader("Content-Type", "text/html");
                return res.status(400).send((0, dashboard_1.renderLoginPage)({
                    error: 'API key is required',
                    dashboardPath
                }));
            }
            const apiKeyDoc = await ApiKeyModel.findOne({ key: apiKey });
            if (!apiKeyDoc) {
                res.setHeader("Content-Type", "text/html");
                return res.status(401).send((0, dashboard_1.renderLoginPage)({
                    error: 'Invalid API key. Please check your key and try again.',
                    dashboardPath
                }));
            }
            // Create session and redirect to dashboard
            await (0, dashboard_1.createSession)(res, apiKey, sessionOptions);
            return res.redirect(dashboardPath);
        });
        // Logout handler - destroy session and redirect to login
        router.get(`${dashboardPath}/logout`, async (req, res) => {
            await (0, dashboard_1.destroySession)(req, res, sessionOptions);
            return res.redirect(`${dashboardPath}/login`);
        });
        // Main dashboard route - requires valid session
        router.get(dashboardPath, async (req, res) => {
            var _a, _b, _c, _d, _e, _f, _g;
            // Check for session-based authentication first
            let apiKey = await (0, dashboard_1.getSessionApiKey)(req, sessionOptions);
            // Fallback to header-based auth for API clients
            if (!apiKey) {
                apiKey = req.header(headerName) || null;
            }
            if (!apiKey) {
                // No session or header - redirect to login
                return res.redirect(`${dashboardPath}/login`);
            }
            const apiKeyDoc = await ApiKeyModel.findOne({ key: apiKey });
            if (!apiKeyDoc) {
                // Invalid key - destroy any existing session and redirect to login
                await (0, dashboard_1.destroySession)(req, res, sessionOptions);
                return res.redirect(`${dashboardPath}/login`);
            }
            const roleInfo = apiKeyDoc.role ? await RoleModel.findOne({ name: apiKeyDoc.role }) : null;
            // Effective expiration: per-key expiresAt > daysValid calculation
            let keyExpiresAt = null;
            if (apiKeyDoc.expiresAt) {
                keyExpiresAt = new Date(apiKeyDoc.expiresAt);
            }
            else {
                const start = apiKeyDoc.requestCountStart;
                if (start && apiKeyDoc.daysValid) {
                    keyExpiresAt = new Date(new Date(start).getTime() + apiKeyDoc.daysValid * 24 * 60 * 60 * 1000);
                }
                else {
                    keyExpiresAt = "Api key not used yet";
                }
            }
            // Convert roleInfo to plain object with allowedEndpoints
            const roleData = roleInfo ? roleInfo.toObject() : null;
            const dashboardData = {
                key: apiKeyDoc.key,
                role: apiKeyDoc.role,
                requestCountMonth: (_a = apiKeyDoc.requestCountMonth) !== null && _a !== void 0 ? _a : null,
                requestCountStart: (_b = apiKeyDoc.requestCountStart) !== null && _b !== void 0 ? _b : null,
                lastUsedAt: (_c = apiKeyDoc.lastUsedAt) !== null && _c !== void 0 ? _c : null,
                keyExpiresAt,
                roleInfo: roleData ? {
                    name: roleData.name,
                    maxMonthlyUsage: (_d = apiKeyDoc.maxMonthlyUsage) !== null && _d !== void 0 ? _d : roleData.maxMonthlyUsage,
                    minIntervalSeconds: (_e = apiKeyDoc.minIntervalSeconds) !== null && _e !== void 0 ? _e : roleData.minIntervalSeconds,
                    allowedEndpoints: roleData.allowedEndpoints,
                } : null,
                daysValid: (_f = apiKeyDoc.daysValid) !== null && _f !== void 0 ? _f : null,
                createdAt: (_g = apiKeyDoc.createdAt) !== null && _g !== void 0 ? _g : null,
            };
            // Compute additional dashboard metrics
            const computedData = (0, dashboard_1.computeDashboardData)(dashboardData);
            res.setHeader("Content-Type", "text/html");
            return res.send((0, dashboard_1.renderDashboard)(computedData, dashboardPath));
        });
    }
    // Main middleware
    const apiKeyAuthMiddleware = async function (req, res, next) {
        var _a, _b, _c;
        const apiKey = req.header(headerName);
        if (!apiKey) {
            return res.status(401).json({ error: "API key missing" });
        }
        // Find API key in MongoDB
        const keyDoc = await ApiKeyModel.findOne({ key: apiKey });
        if (!keyDoc) {
            return res.status(401).json({ error: "Invalid API key" });
        }
        // Check expiration: prefer expiresAt (absolute) over daysValid (relative)
        if (keyDoc.expiresAt) {
            if (new Date() > new Date(keyDoc.expiresAt)) {
                return res.status(401).json({ error: "API key expired" });
            }
        }
        else if (typeof keyDoc.daysValid === "number") {
            const start = keyDoc.requestCountStart;
            if (start) {
                const expiresAt = new Date(new Date(start).getTime() + keyDoc.daysValid * 24 * 60 * 60 * 1000);
                if (new Date() > expiresAt) {
                    return res.status(401).json({ error: "API key expired" });
                }
            }
        }
        // --- Rate limiting and usage tracking (per-role configurable) ---
        const now = new Date();
        // Get role config if present (from DB, not hardcoded)
        let roleConfig = {};
        if (keyDoc.role) {
            const roleDoc = await RoleModel.findOne({ name: keyDoc.role });
            if (roleDoc) {
                roleConfig = roleDoc.toObject();
            }
        }
        // Rolling 30-day quota tracking
        if (!keyDoc.requestCountStart) {
            keyDoc.requestCountStart = now;
            keyDoc.requestCountMonth = 0;
        }
        else {
            const start = new Date(keyDoc.requestCountStart);
            const daysSinceStart = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceStart >= 30) {
                keyDoc.requestCountMonth = 0;
                keyDoc.requestCountStart = now;
            }
        }
        // Minimum interval between requests (per-key override > role config > default 2s)
        const minInterval = (_a = keyDoc.minIntervalSeconds) !== null && _a !== void 0 ? _a : (typeof roleConfig.minIntervalSeconds === "number" ? roleConfig.minIntervalSeconds : 2);
        if (keyDoc.lastUsedAt && now.getTime() - new Date(keyDoc.lastUsedAt).getTime() < minInterval * 1000) {
            return res.status(429).json({ error: `Requests must be at least ${minInterval} seconds apart` });
        }
        // Monthly cap (per-key override > role config > default 10k)
        const monthlyCap = (_b = keyDoc.maxMonthlyUsage) !== null && _b !== void 0 ? _b : (typeof roleConfig.maxMonthlyUsage === "number" ? roleConfig.maxMonthlyUsage : 10000);
        if (((_c = keyDoc.requestCountMonth) !== null && _c !== void 0 ? _c : 0) >= monthlyCap) {
            return res.status(429).json({ error: "Monthly quota exceeded" });
        }
        // Endpoint authorization can be handled by route-level middleware (see allowRoles)
        // Attach key info to request for downstream use
        req.apiKeyDoc = keyDoc;
        // Increment requestCountMonth based on countOnly200 option
        res.on("finish", async () => {
            var _a, _b;
            if (countOnly200) {
                // Only count successful (200) requests
                if (res.statusCode === 200) {
                    keyDoc.requestCountMonth = ((_a = keyDoc.requestCountMonth) !== null && _a !== void 0 ? _a : 0) + 1;
                    keyDoc.lastUsedAt = now;
                    await keyDoc.save();
                }
            }
            else {
                // Count all requests regardless of status code
                keyDoc.requestCountMonth = ((_b = keyDoc.requestCountMonth) !== null && _b !== void 0 ? _b : 0) + 1;
                keyDoc.lastUsedAt = now;
                await keyDoc.save();
            }
        });
        next();
    };
    // Return a router that runs the middleware and exposes stats if enabled
    router.use(apiKeyAuthMiddleware);
    return router;
}
/**
 * Creates a renewal function bound to a Mongoose connection.
 * The returned function can be called from external services (e.g. payment webhook handlers)
 * to safely extend a key's quota and expiration.
 *
 * @example
 * ```ts
 * const renewApiKey = createRenewalFunction(mongoose);
 *
 * // In a payment webhook handler:
 * const renewed = await renewApiKey('user-api-key-here', {
 *   additionalRequests: 500000,
 *   additionalDays: 30,
 * });
 * ```
 */
function createRenewalFunction(mongoose) {
    const ApiKeyModel = getOrCreateModel(mongoose, "ApiKey", ApiKey_1.ApiKeySchema);
    return async function renewApiKey(key, options) {
        var _a;
        const apiKey = await ApiKeyModel.findOne({ key });
        if (!apiKey)
            return null;
        const now = new Date();
        const daysToAdd = (_a = options.additionalDays) !== null && _a !== void 0 ? _a : 30;
        // Determine if the key is currently expired
        let isExpired = false;
        if (apiKey.expiresAt) {
            isExpired = now > new Date(apiKey.expiresAt);
        }
        else if (apiKey.requestCountStart && apiKey.daysValid) {
            const expiry = new Date(new Date(apiKey.requestCountStart).getTime() + apiKey.daysValid * 24 * 60 * 60 * 1000);
            isExpired = now > expiry;
        }
        // Extend expiration: if expired extend from now, otherwise extend from current expiration
        const baseDate = isExpired ? now : (apiKey.expiresAt ? new Date(apiKey.expiresAt) : now);
        apiKey.expiresAt = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        // Add requests to per-key quota (cumulative)
        const currentMax = apiKey.maxMonthlyUsage || 0;
        apiKey.maxMonthlyUsage = currentMax + options.additionalRequests;
        // Reset usage if expired or explicitly requested
        if (isExpired || options.resetUsageCount) {
            apiKey.requestCountMonth = 0;
            apiKey.requestCountStart = now;
        }
        await apiKey.save();
        return apiKey;
    };
}
