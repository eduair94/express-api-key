import { Document, Schema, model } from "mongoose";
import type { UsageAccountingRecord } from '../usageAccounting';

export interface IApiKey extends Document {
  key: string;
  role: string;
  createdAt: Date;
  daysValid: number;
  lastUsedAt?: Date;
  requestCountMonth: number;
  requestCountStart?: Date;
  usageAccounting?: UsageAccountingRecord;

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
  // Internal, bounded aggregates. No defaults: opt-out keys stay untouched.
  usageAccounting: { type: Schema.Types.Mixed, select: false },

  // Per-key overrides (when set, these take priority over role defaults)
  maxMonthlyUsage: { type: Number, default: null },
  minIntervalSeconds: { type: Number, default: null },
  expiresAt: { type: Date, default: null },
});

// Explicitly selecting accounting for an internal job must not accidentally
// expose it when a document is later serialized for an API or dashboard.
const hideUsageAccounting = (_doc: unknown, value: { usageAccounting?: unknown }) => {
  delete value.usageAccounting;
  return value;
};
ApiKeySchema.set('toJSON', { transform: hideUsageAccounting });
ApiKeySchema.set('toObject', { transform: hideUsageAccounting });

export const ApiKeyModel = model<IApiKey>("ApiKey", ApiKeySchema);
