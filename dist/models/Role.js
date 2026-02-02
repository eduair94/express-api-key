"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleModel = exports.RoleSchema = void 0;
// src/models/Role.ts
const mongoose_1 = require("mongoose");
exports.RoleSchema = new mongoose_1.Schema({
    name: { type: String, required: true, unique: true },
    minIntervalSeconds: { type: Number, default: 2 },
    maxMonthlyUsage: { type: Number, default: 10000 },
    allowedEndpoints: { type: [String], default: [] },
});
exports.RoleModel = (0, mongoose_1.model)("Role", exports.RoleSchema);
