// src/models/Role.ts
import { Document, Schema, model } from "mongoose";

export interface IRole extends Document {
  name: string;
  minIntervalSeconds?: number;
  maxMonthlyUsage?: number;
}

const RoleSchema = new Schema<IRole>({
  name: { type: String, required: true, unique: true },
  minIntervalSeconds: { type: Number, default: 2 },
  maxMonthlyUsage: { type: Number, default: 10000 },
});

export const RoleModel = model<IRole>("Role", RoleSchema);
