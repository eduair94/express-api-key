"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSessionStore = initSessionStore;
exports.setSessionSecret = setSessionSecret;
exports.createSession = createSession;
exports.getSessionApiKey = getSessionApiKey;
exports.destroySession = destroySession;
exports.hasValidSession = hasValidSession;
exports.cleanupExpiredSessions = cleanupExpiredSessions;
const crypto = __importStar(require("crypto"));
const Session_1 = require("../models/Session");
// Module-level state
let sessionSecret = crypto.randomBytes(32).toString('hex');
let SessionModel = null;
/**
 * Initializes the session store with a Mongoose connection
 * Must be called before using session functions
 */
function initSessionStore(mongoose) {
    if (!SessionModel) {
        SessionModel = mongoose.models['Session'] || mongoose.model('Session', Session_1.SessionSchema);
    }
}
/**
 * Sets the session secret key
 */
function setSessionSecret(secret) {
    sessionSecret = secret;
}
/**
 * Generates a secure session token
 */
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}
/**
 * Signs a session token with HMAC
 */
function signToken(token) {
    const hmac = crypto.createHmac('sha256', sessionSecret);
    hmac.update(token);
    return `${token}.${hmac.digest('hex')}`;
}
/**
 * Verifies and extracts the token from a signed token
 */
function verifyToken(signedToken) {
    const parts = signedToken.split('.');
    if (parts.length !== 2)
        return null;
    const [token, signature] = parts;
    const hmac = crypto.createHmac('sha256', sessionSecret);
    hmac.update(token);
    const expectedSignature = hmac.digest('hex');
    // Constant-time comparison to prevent timing attacks
    try {
        if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            return token;
        }
    }
    catch (_a) {
        return null;
    }
    return null;
}
/**
 * Creates a new session for an API key (persisted to MongoDB)
 */
async function createSession(res, apiKey, options = {}) {
    if (!SessionModel) {
        throw new Error('Session store not initialized. Call initSessionStore(mongoose) first.');
    }
    const { cookieName = 'apikey_session', sessionExpiry = 24 * 60 * 60 * 1000, // 24 hours default
    cookiePath = '/', secure = process.env.NODE_ENV === 'production', } = options;
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
async function getSessionApiKey(req, options = {}) {
    var _a;
    if (!SessionModel) {
        return null;
    }
    const { cookieName = 'apikey_session' } = options;
    const signedToken = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a[cookieName];
    if (!signedToken)
        return null;
    // Verify signature
    const token = verifyToken(signedToken);
    if (!token)
        return null;
    // Get session from MongoDB
    const session = await SessionModel.findOne({ token });
    if (!session)
        return null;
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
async function destroySession(req, res, options = {}) {
    var _a;
    const { cookieName = 'apikey_session', cookiePath = '/', } = options;
    const signedToken = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a[cookieName];
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
async function hasValidSession(req, options = {}) {
    return (await getSessionApiKey(req, options)) !== null;
}
/**
 * Cleans up expired sessions manually (MongoDB TTL handles this automatically)
 */
async function cleanupExpiredSessions() {
    if (!SessionModel)
        return 0;
    const result = await SessionModel.deleteMany({
        expiresAt: { $lt: new Date() }
    });
    return result.deletedCount || 0;
}
