// src/models/Role.ts
import { Document, Schema, model } from "mongoose";

export interface IRole extends Document {
  name: string;
  minIntervalSeconds?: number;
  maxMonthlyUsage?: number;
  allowedEndpoints?: string[];
  /** Maximum response latency in milliseconds (informational, displayed on status page) */
  responseLatency?: number;
  /** Request timeout in seconds */
  timeout?: number;
  /** Maximum concurrent requests allowed */
  concurrency?: number;
  /** Maximum number of items per batch request */
  batchLimit?: number;
  /** Time-to-live for batch requests in seconds */
  batchTTL?: number;
}

export const RoleSchema = new Schema<IRole>({
  name: { type: String, required: true, unique: true },
  minIntervalSeconds: { type: Number, default: 2 },
  maxMonthlyUsage: { type: Number, default: 10000 },
  allowedEndpoints: { type: [String], default: [] },
  responseLatency: { type: Number, default: null },
  timeout: { type: Number, default: null },
  concurrency: { type: Number, default: null },
  batchLimit: { type: Number, default: null },
  batchTTL: { type: Number, default: null },
});

export const RoleModel = model<IRole>("Role", RoleSchema);
