"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionSchema = void 0;
const mongoose_1 = require("mongoose");
exports.SessionSchema = new mongoose_1.Schema({
    token: { type: String, required: true, unique: true, index: true },
    apiKey: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
});
// TTL index - MongoDB will automatically delete expired sessions
exports.SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
