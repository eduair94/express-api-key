import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import { RoleModel } from "./src/models/Role";

async function syncRoles() {
  // const rolesPath = path.resolve(__dirname, "roles.json");
  const fileArg = process.argv[2];
  const fileName = fileArg || "roles.json";
  const rolesPath = path.resolve(__dirname, fileName);
  if (!fs.existsSync(rolesPath)) {
    console.error(`${fileName} not found`);
    process.exit(1);
  }
  const roles = JSON.parse(fs.readFileSync(rolesPath, "utf-8"));
  if (!Array.isArray(roles)) {
    console.error(`${fileName} must be an array of role objects`);
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/express-api-key");
  await RoleModel.deleteMany({});
  await RoleModel.insertMany(roles);
  console.log(`Synced ${roles.length} roles to the database from ${fileName}.`);
  process.exit(0);
}

syncRoles();
