"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiKeyMiddleware = createApiKeyMiddleware;
const ApiKey_1 = require("../models/ApiKey");
const Role_1 = require("../models/Role");
const express_1 = require("express");
function createApiKeyMiddleware(options = {}) {
    var _a;
    const headerName = options.headerName || "x-api-key";
    const exposeStats = (_a = options.exposeStatsEndpoint) !== null && _a !== void 0 ? _a : false;
    const statsPath = options.statsEndpointPath || "/api-key-stats";
    const router = (0, express_1.Router)();
    // Built-in stats endpoint
    if (exposeStats) {
        router.get(statsPath, async (req, res) => {
            const apiKey = req.header(headerName);
            const apiKeyDoc = await ApiKey_1.ApiKeyModel.findOne({ key: apiKey });
            const roleInfo = apiKeyDoc ? await Role_1.RoleModel.findOne({ name: apiKeyDoc.role }) : null;
            if (!apiKeyDoc) {
                return res.status(404).json({ error: "API key not found" });
            }
            let expiresAt = null;
            const start = apiKeyDoc.requestCountStart;
            if (start) {
                expiresAt = new Date(new Date(start).getTime() + apiKeyDoc.daysValid * 24 * 60 * 60 * 1000);
            }
            return res.json({
                key: apiKeyDoc.key,
                role: apiKeyDoc.role,
                requestCountMonth: apiKeyDoc.requestCountMonth,
                requestCountStart: apiKeyDoc.requestCountStart,
                lastUsedAt: apiKeyDoc.lastUsedAt,
                expiresAt: expiresAt || "Api key not used yet",
                roleInfo,
            });
        });
    }
    // Main middleware
    const apiKeyAuthMiddleware = async function (req, res, next) {
        var _a;
        const apiKey = req.header(headerName);
        if (!apiKey) {
            return res.status(401).json({ error: "API key missing" });
        }
        // Find API key in MongoDB
        const keyDoc = await ApiKey_1.ApiKeyModel.findOne({ key: apiKey });
        if (!keyDoc) {
            return res.status(401).json({ error: "Invalid API key" });
        }
        // Check expiration: daysValid from first use (requestCountStart or createdAt)
        if (typeof keyDoc.daysValid === "number") {
            const start = keyDoc.requestCountStart || keyDoc.createdAt;
            if (start) {
                const expiresAt = new Date(new Date(start).getTime() + keyDoc.daysValid * 24 * 60 * 60 * 1000);
                if (new Date() > expiresAt) {
                    return res.status(401).json({ error: "API key expired" });
                }
            }
        }
        // --- Rate limiting and usage tracking (per-role configurable) ---
        const now = new Date();
        // monthKey is now only declared below for quota tracking
        // Get role config if present (from DB, not hardcoded)
        let roleConfig = {};
        if (keyDoc.role) {
            const roleDoc = await Role_1.RoleModel.findOne({ name: keyDoc.role });
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
        // Minimum interval between requests (from role config, fallback 2s)
        const minInterval = typeof roleConfig.minIntervalSeconds === "number" ? roleConfig.minIntervalSeconds : 2;
        if (keyDoc.lastUsedAt && now.getTime() - new Date(keyDoc.lastUsedAt).getTime() < minInterval * 1000) {
            return res.status(429).json({ error: `Requests must be at least ${minInterval} seconds apart` });
        }
        // Monthly cap (from role config, fallback 10k)
        const monthlyCap = typeof roleConfig.maxMonthlyUsage === "number" ? roleConfig.maxMonthlyUsage : 10000;
        if (((_a = keyDoc.requestCountMonth) !== null && _a !== void 0 ? _a : 0) >= monthlyCap) {
            return res.status(429).json({ error: "Monthly quota exceeded" });
        }
        // Endpoint authorization can be handled by route-level middleware (see allowRoles)
        // Attach key info to request for downstream use
        req.apiKeyDoc = keyDoc;
        // Only increment requestCountMonth if response status is 200
        res.on("finish", async () => {
            var _a;
            if (res.statusCode === 200) {
                keyDoc.requestCountMonth = ((_a = keyDoc.requestCountMonth) !== null && _a !== void 0 ? _a : 0) + 1;
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
