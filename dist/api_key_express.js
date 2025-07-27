#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const mongoose_1 = __importDefault(require("mongoose"));
const uuid4_1 = __importDefault(require("uuid4"));
const ApiKey_1 = require("./models/ApiKey");
const Role_1 = require("./models/Role");
dotenv_1.default.config();
async function genkeys(role, daysValidStr, countStr) {
    const daysValid = parseInt(daysValidStr) || 30;
    const count = parseInt(countStr) || 1;
    if (!role) {
        console.log("Role is required");
        process.exit(1);
    }
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    // Validate role exists
    const roleDoc = await Role_1.RoleModel.findOne({ name: role });
    if (!roleDoc) {
        console.log(`Role '${role}' does not exist. Please create it first.`);
        await mongoose_1.default.disconnect();
        process.exit(1);
    }
    const keys = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
        const key = (0, uuid4_1.default)();
        await ApiKey_1.ApiKeyModel.create({
            key,
            role,
            createdAt: now,
            daysValid,
        });
        keys.push(key);
    }
    // Write to txt file
    const filePath = `genkeys_${role}_${daysValid}_${Date.now()}.txt`;
    const fileContent = [`role: ${role}, daysValid: ${daysValid}`, ...keys].join("\n");
    fs_1.default.writeFileSync(filePath, fileContent);
    console.log(`Keys written to ${filePath}`);
    await mongoose_1.default.disconnect();
}
async function roleCmd(name, minIntervalStr, maxMonthlyStr) {
    if (!name) {
        console.log("Role name is required");
        process.exit(1);
    }
    const minIntervalSeconds = parseFloat(minIntervalStr);
    const maxMonthlyUsage = parseInt(maxMonthlyStr);
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    const update = { name, minIntervalSeconds, maxMonthlyUsage };
    const result = await Role_1.RoleModel.findOneAndUpdate({ name }, update, { upsert: true, new: true });
    console.log(`Role '${name}' set: minIntervalSeconds=${minIntervalSeconds}, maxMonthlyUsage=${maxMonthlyUsage}`);
    await mongoose_1.default.disconnect();
}
async function main() {
    const [, , cmd, ...args] = process.argv;
    if (cmd === "genkeys") {
        await genkeys(args[0], args[1], args[2]);
    }
    else if (cmd === "role") {
        await roleCmd(args[0], args[1], args[2]);
    }
    else {
        console.log("Usage:\n  api_key_express genkeys <role> <daysValid> <count>\n  api_key_express role <name> <minIntervalSeconds> <maxMonthlyUsage>");
        process.exit(1);
    }
}
main();
