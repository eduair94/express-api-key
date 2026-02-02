import { Request, Response } from 'express';
import { Model, Mongoose } from 'mongoose';
import * as crypto from 'crypto';
import { ISession, SessionSchema } from '../models/Session';

/**
 * Session configuration options
 */
export interface SessionOptions {
  /** Cookie name for the session (default: 'apikey_session') */
  cookieName?: string;
  /** Session expiration time in milliseconds (default: 24 hours) */
  sessionExpiry?: number;
  /** Cookie path (default: '/') */
  cookiePath?: string;
  /** Whether to use secure cookies (default: true in production) */
  secure?: boolean;
}

// Module-level state
let sessionSecret: string = crypto.randomBytes(32).toString('hex');
let SessionModel: Model<ISession> | null = null;

/**
 * Initializes the session store with a Mongoose connection
 * Must be called before using session functions
 */
export function initSessionStore(mongoose: Mongoose): void {
  if (!SessionModel) {
    SessionModel = mongoose.models['Session'] || mongoose.model<ISession>('Session', SessionSchema);
  }
}

/**
 * Sets the session secret key
 */
export function setSessionSecret(secret: string): void {
  sessionSecret = secret;
}

/**
 * Generates a secure session token
 */
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Signs a session token with HMAC
 */
function signToken(token: string): string {
  const hmac = crypto.createHmac('sha256', sessionSecret);
  hmac.update(token);
  return `${token}.${hmac.digest('hex')}`;
}

/**
 * Verifies and extracts the token from a signed token
 */
function verifyToken(signedToken: string): string | null {
  const parts = signedToken.split('.');
  if (parts.length !== 2) return null;
  
  const [token, signature] = parts;
  const hmac = crypto.createHmac('sha256', sessionSecret);
  hmac.update(token);
  const expectedSignature = hmac.digest('hex');
  
  // Constant-time comparison to prevent timing attacks
  try {
    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return token;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Creates a new session for an API key (persisted to MongoDB)
 */
export async function createSession(
  res: Response, 
  apiKey: string, 
  options: SessionOptions = {}
): Promise<string> {
  if (!SessionModel) {
    throw new Error('Session store not initialized. Call initSessionStore(mongoose) first.');
  }

  const {
    cookieName = 'apikey_session',
    sessionExpiry = 24 * 60 * 60 * 1000, // 24 hours default
    cookiePath = '/',
    secure = process.env.NODE_ENV === 'production',
  } = options;

  // Generate and sign the session token
  const token = generateSessionToken();
  const signedToken = signToken(token);
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionExpiry);

  // Store session in MongoDB
  await SessionModel.create({
    token,
    apiKey,
    createdAt: now,
    expiresAt,
  });
  
  // Set cookie with security options
  res.cookie(cookieName, signedToken, {
    httpOnly: true, // Prevents JavaScript access
    secure, // HTTPS only in production
    sameSite: 'strict', // CSRF protection
    path: cookiePath,
    maxAge: sessionExpiry,
  });
  
  return token;
}

/**
 * Gets the API key from a session cookie (reads from MongoDB)
 * Returns null if session is invalid or expired
 */
export async function getSessionApiKey(req: Request, options: SessionOptions = {}): Promise<string | null> {
  if (!SessionModel) {
    return null;
  }

  const { cookieName = 'apikey_session' } = options;
  
  const signedToken = req.cookies?.[cookieName];
  if (!signedToken) return null;
  
  // Verify signature
  const token = verifyToken(signedToken);
  if (!token) return null;
  
  // Get session from MongoDB
  const session = await SessionModel.findOne({ token });
  if (!session) return null;
  
  // Check expiration (MongoDB TTL might not have cleaned it up yet)
  if (new Date() > session.expiresAt) {
    await SessionModel.deleteOne({ token });
    return null;
  }
  
  return session.apiKey;
}

/**
 * Destroys a session (logout) - removes from MongoDB
 */
export async function destroySession(req: Request, res: Response, options: SessionOptions = {}): Promise<void> {
  const { 
    cookieName = 'apikey_session',
    cookiePath = '/',
  } = options;
  
  const signedToken = req.cookies?.[cookieName];
  if (signedToken && SessionModel) {
    const token = verifyToken(signedToken);
    if (token) {
      await SessionModel.deleteOne({ token });
    }
  }
  
  // Clear the cookie
  res.clearCookie(cookieName, {
    httpOnly: true,
    path: cookiePath,
  });
}

/**
 * Validates if a session exists and is valid
 */
export async function hasValidSession(req: Request, options: SessionOptions = {}): Promise<boolean> {
  return (await getSessionApiKey(req, options)) !== null;
}

/**
 * Cleans up expired sessions manually (MongoDB TTL handles this automatically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  if (!SessionModel) return 0;
  
  const result = await SessionModel.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  
  return result.deletedCount || 0;
}
