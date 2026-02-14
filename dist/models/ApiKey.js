"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyModel = exports.ApiKeySchema = void 0;
const mongoose_1 = require("mongoose");
exports.ApiKeySchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true },
    role: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    daysValid: { type: Number, default: 30 }, // Default to 30 days
    lastUsedAt: { type: Date },
    requestCountMonth: { type: Number, default: 0 },
    requestCountStart: { type: Date },
    // Per-key overrides (when set, these take priority over role defaults)
    maxMonthlyUsage: { type: Number, default: null },
    minIntervalSeconds: { type: Number, default: null },
    expiresAt: { type: Date, default: null },
});
exports.ApiKeyModel = (0, mongoose_1.model)("ApiKey", exports.ApiKeySchema);
