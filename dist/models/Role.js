"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleModel = void 0;
// src/models/Role.ts
const mongoose_1 = require("mongoose");
const RoleSchema = new mongoose_1.Schema({
    name: { type: String, required: true, unique: true },
    minIntervalSeconds: { type: Number, default: 2 },
    maxMonthlyUsage: { type: Number, default: 10000 },
});
exports.RoleModel = (0, mongoose_1.model)("Role", RoleSchema);
