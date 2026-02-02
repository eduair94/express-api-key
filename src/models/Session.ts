import { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  token: string;
  apiKey: string;
  createdAt: Date;
  expiresAt: Date;
}

export const SessionSchema = new Schema<ISession>({
  token: { type: String, required: true, unique: true, index: true },
  apiKey: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true },
});

// TTL index - MongoDB will automatically delete expired sessions
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
