import { Request, Response } from 'express';
import { Mongoose } from 'mongoose';
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
/**
 * Initializes the session store with a Mongoose connection
 * Must be called before using session functions
 */
export declare function initSessionStore(mongoose: Mongoose): void;
/**
 * Sets the session secret key
 */
export declare function setSessionSecret(secret: string): void;
/**
 * Creates a new session for an API key (persisted to MongoDB)
 */
export declare function createSession(res: Response, apiKey: string, options?: SessionOptions): Promise<string>;
/**
 * Gets the API key from a session cookie (reads from MongoDB)
 * Returns null if session is invalid or expired
 */
export declare function getSessionApiKey(req: Request, options?: SessionOptions): Promise<string | null>;
/**
 * Destroys a session (logout) - removes from MongoDB
 */
export declare function destroySession(req: Request, res: Response, options?: SessionOptions): Promise<void>;
/**
 * Validates if a session exists and is valid
 */
export declare function hasValidSession(req: Request, options?: SessionOptions): Promise<boolean>;
/**
 * Cleans up expired sessions manually (MongoDB TTL handles this automatically)
 */
export declare function cleanupExpiredSessions(): Promise<number>;
