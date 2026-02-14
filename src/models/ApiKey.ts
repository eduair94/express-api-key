import { Document, Schema, model } from "mongoose";

export interface IApiKey extends Document {
  key: string;
  role: string;
  createdAt: Date;
  daysValid: number;
  lastUsedAt?: Date;
  requestCountMonth: number;
  requestCountStart?: Date;

  // Per-key overrides (when set, these take priority over role defaults)
  maxMonthlyUsage?: number | null;      // Overrides role.maxMonthlyUsage
  minIntervalSeconds?: number | null;   // Overrides role.minIntervalSeconds
  expiresAt?: Date | null;              // Absolute expiration (overrides daysValid calculation)
}

export const ApiKeySchema = new Schema<IApiKey>({
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

export const ApiKeyModel = model<IApiKey>("ApiKey", ApiKeySchema);
