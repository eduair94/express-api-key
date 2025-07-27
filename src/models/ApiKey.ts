import { Document, Schema, model } from "mongoose";

export interface IApiKey extends Document {
  key: string;
  role: string;
  createdAt: Date;
  daysValid: number;
  lastUsedAt?: Date;
  requestCountMonth: number;
  requestCountStart?: Date;
}

const ApiKeySchema = new Schema<IApiKey>({
  key: { type: String, required: true, unique: true },
  role: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  daysValid: { type: Number, default: 30 }, // Default to 30 days
  lastUsedAt: { type: Date },
  requestCountMonth: { type: Number, default: 0 },
  requestCountStart: { type: Date },
});

export const ApiKeyModel = model<IApiKey>("ApiKey", ApiKeySchema);
