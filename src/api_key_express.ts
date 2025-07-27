#!/usr/bin/env node
import dotenv from "dotenv";
import fs from "fs";
import mongoose from "mongoose";
import uuid4 from "uuid4";
import { ApiKeyModel } from "./models/ApiKey";
import { RoleModel } from "./models/Role";
dotenv.config();

async function genkeys(role: string, daysValidStr: string, countStr: string) {
  const daysValid = parseInt(daysValidStr) || 30;
  const count = parseInt(countStr) || 1;
  if (!role) {
    console.log("Role is required");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI!);
  // Validate role exists
  const roleDoc = await RoleModel.findOne({ name: role });
  if (!roleDoc) {
    console.log(`Role '${role}' does not exist. Please create it first.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  const keys: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const key = uuid4();
    await ApiKeyModel.create({
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
  fs.writeFileSync(filePath, fileContent);
  console.log(`Keys written to ${filePath}`);
  await mongoose.disconnect();
}

async function roleCmd(name: string, minIntervalStr: string, maxMonthlyStr: string) {
  if (!name) {
    console.log("Role name is required");
    process.exit(1);
  }
  const minIntervalSeconds = parseFloat(minIntervalStr);
  const maxMonthlyUsage = parseInt(maxMonthlyStr);
  await mongoose.connect(process.env.MONGODB_URI!);
  const update = { name, minIntervalSeconds, maxMonthlyUsage };
  const result = await RoleModel.findOneAndUpdate({ name }, update, { upsert: true, new: true });
  console.log(`Role '${name}' set: minIntervalSeconds=${minIntervalSeconds}, maxMonthlyUsage=${maxMonthlyUsage}`);
  await mongoose.disconnect();
}

async function main() {
  const [, , cmd, ...args] = process.argv;
  if (cmd === "genkeys") {
    await genkeys(args[0], args[1], args[2]);
  } else if (cmd === "role") {
    await roleCmd(args[0], args[1], args[2]);
  } else {
    console.log("Usage:\n  api_key_express genkeys <role> <daysValid> <count>\n  api_key_express role <name> <minIntervalSeconds> <maxMonthlyUsage>");
    process.exit(1);
  }
}

main();
