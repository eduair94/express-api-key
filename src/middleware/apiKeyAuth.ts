import cookieParser from "cookie-parser";
import { NextFunction, Request, Response, Router, json, urlencoded } from "express";
import { Model, Mongoose, Schema } from "mongoose";
import {
    DashboardData,
    computeDashboardData,
    createSession,
    destroySession,
    getSessionApiKey,
    initSessionStore,
    renderDashboard,
    renderLoginPage,
    renderStatusPage,
    setSessionSecret
} from "../dashboard";
import { renderSubscriptionPanel, SubscriptionPanelData } from "../dashboard/subscriptionPanel";
import { ApiKeySchema, IApiKey } from "../models/ApiKey";
import { RoleSchema } from "../models/Role";

// Minimal fetch declaration for Node 20 global fetch (not in ES2018 lib).
declare const fetch: (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

function getOrCreateModel<T extends object>(mongoose: Mongoose, name: string, schema: Schema<T>): Model<T> {
  return mongoose.models[name] || mongoose.model<T>(name, schema);
}

async function fetchSubscriptionPanel(
  baseUrl: string,
  internalSecret: string,
  apiKey: string,
  dashboardPath: string,
): Promise<string> {
  if (!baseUrl) return "";
  try {
    const res = await fetch(`${baseUrl}/api/subscription/status`, {
      method: "GET",
      headers: { "x-internal-secret": internalSecret, "x-api-key": apiKey },
    });
    if (!res.ok) return "";
    const json = (await res.json()) as { success?: boolean; data?: SubscriptionPanelData };
    if (!json.success || !json.data) return "";
    return renderSubscriptionPanel(json.data, dashboardPath);
  } catch {
    return ""; // never break the dashboard if the subscription API is down
  }
}

/**
 * In-memory rate limit map: apiKey → last accepted request timestamp (ms).
 *
 * Because Node.js executes synchronous code on a single thread, checking
 * and setting this map is atomic — no two concurrent requests can both
 * read a stale value.  This eliminates the TOCTOU race condition that
 * exists when relying solely on a MongoDB read-then-check pattern.
 *
 * Memory is bounded by the number of unique API keys (one number per key).
 */
const rateLimitMap = new Map<string, number>();

export interface ApiKeyMiddlewareOptions {
  headerName?: string;
  exposeStatsEndpoint?: boolean;
  statsEndpointPath?: string;
  countOnly200?: boolean; // If true, only count requests with 200 status code (default: true)
  exposeDashboard?: boolean; // If true, expose a UI dashboard at dashboardPath
  dashboardPath?: string; // Path for the dashboard UI (default: "/dashboard")
  sessionSecret?: string; // Secret for session signing (recommended to set in production)
  sessionExpiry?: number; // Session expiry in milliseconds (default: 24 hours)
  exposeStatusPage?: boolean; // If true, expose a public status page showing role limits
  statusPagePath?: string; // Path for the public status page (default: "/status")
  /** Enable the customer Subscription panel + manage routes on the dashboard. */
  subscriptionsEnabled?: boolean;
  /** Base URL of the paylix-subscription API (e.g. https://whatsapp-sub.checkleaked.com). */
  subscriptionApiBaseUrl?: string;
  /** Shared secret sent as x-internal-secret to the subscription API. */
  subscriptionInternalSecret?: string;
}

export function createApiKeyMiddlewareWithConnection(mongoose: Mongoose, options: ApiKeyMiddlewareOptions = {}) {
  const ApiKeyModel = getOrCreateModel(mongoose, "ApiKey", ApiKeySchema);
  const RoleModel = getOrCreateModel(mongoose, "Role", RoleSchema);

  const headerName = options.headerName || "x-api-key";
  const exposeStats = options.exposeStatsEndpoint ?? false;
  const statsPath = options.statsEndpointPath || "/api-key-stats";
  const countOnly200 = options.countOnly200 ?? true; // Default to only counting 200 status
  const exposeDashboard = options.exposeDashboard ?? false;
  const dashboardPath = options.dashboardPath || "/dashboard";
  const sessionExpiry = options.sessionExpiry ?? 24 * 60 * 60 * 1000; // 24 hours default
  const exposeStatusPage = options.exposeStatusPage ?? false;
  const statusPagePath = options.statusPagePath || "/status";
  const subscriptionsEnabled = options.subscriptionsEnabled ?? false;
  const subscriptionApiBaseUrl = (options.subscriptionApiBaseUrl || "").replace(/\/+$/, "");
  const subscriptionInternalSecret = options.subscriptionInternalSecret || "";
  const router = Router();

  // Set session secret if provided
  if (options.sessionSecret) {
    setSessionSecret(options.sessionSecret);
  }

  // Initialize session store with MongoDB connection for persistence
  if (exposeDashboard) {
    initSessionStore(mongoose);
  }

  // Add cookie parser for dashboard session support
  if (exposeDashboard) {
    router.use(cookieParser());
    router.use(json());
    router.use(urlencoded({ extended: true }));
  }

  // Built-in stats endpoint
  if (exposeStats) {
    router.get(statsPath, async (req: Request, res: Response) => {
      const apiKey = req.header(headerName);
      const apiKeyDoc = await ApiKeyModel.findOne({ key: apiKey });
      const roleInfo = apiKeyDoc ? await RoleModel.findOne({ name: apiKeyDoc.role }) : null;

      if (!apiKeyDoc) {
        return res.status(404).json({ error: "API key not found" });
      }

      // Effective expiration: per-key expiresAt > daysValid calculation
      let expiresAt: Date | null = null;
      if (apiKeyDoc.expiresAt) {
        expiresAt = new Date(apiKeyDoc.expiresAt);
      } else {
        const start = apiKeyDoc.requestCountStart;
        if (start && typeof apiKeyDoc.daysValid === "number") {
          expiresAt = new Date(new Date(start).getTime() + apiKeyDoc.daysValid * 24 * 60 * 60 * 1000);
        }
      }

      // Effective cap: per-key override > role > default
      const effectiveCap = apiKeyDoc.maxMonthlyUsage
        ?? roleInfo?.maxMonthlyUsage
        ?? 10000;

      // Quota reset window: only role-based keys auto-reset every 30d.
      // Per-key paid quotas never auto-reset → resetAt is null.
      let resetAt: Date | null = null;
      if (!apiKeyDoc.maxMonthlyUsage && apiKeyDoc.requestCountStart) {
        resetAt = new Date(
          new Date(apiKeyDoc.requestCountStart).getTime() + 30 * 24 * 60 * 60 * 1000
        );
      }

      // Status state machine — separate from timestamp
      const now = new Date();
      let status: "unused" | "active" | "expired" = "active";
      if (!apiKeyDoc.requestCountStart) {
        status = "unused";
      } else if (expiresAt && now > expiresAt) {
        status = "expired";
      }

      const requestRemaining = Math.max(0, effectiveCap - (apiKeyDoc.requestCountMonth ?? 0));

      // Seconds-until-reset (RapidAPI convention). Null when N/A.
      const requestReset = resetAt
        ? Math.max(0, Math.floor((resetAt.getTime() - now.getTime()) / 1000))
        : null;

      // Mirror RapidAPI headers so consumers can use one code path
      res.setHeader("x-ratelimit-requests-limit", String(effectiveCap));
      res.setHeader("x-ratelimit-requests-remaining", String(requestRemaining));
      if (requestReset !== null) {
        res.setHeader("x-ratelimit-requests-reset", String(requestReset));
      }

      return res.json({
        key: apiKeyDoc.key,
        role: apiKeyDoc.role,
        status,
        // New canonical fields — always typed consistently
        requestLimit: effectiveCap,
        requestRemaining,
        requestReset,                                       // seconds | null
        resetAt: resetAt ? resetAt.toISOString() : null,    // ISO | null
        expiresAt: expiresAt ? expiresAt.toISOString() : null, // ISO | null
        lastUsedAt: apiKeyDoc.lastUsedAt
          ? new Date(apiKeyDoc.lastUsedAt).toISOString()
          : null,
        requestCountMonth: apiKeyDoc.requestCountMonth ?? 0,
        requestCountStart: apiKeyDoc.requestCountStart
          ? new Date(apiKeyDoc.requestCountStart).toISOString()
          : null,
        // Legacy field kept for back-compat with old consumers.
        // Same type as expiresAt above (no human-text sentinel).
        maxMonthlyUsage: effectiveCap,
        roleInfo,
      });
    });
  }

  // Dashboard UI endpoints with session-based authentication
  if (exposeDashboard) {
    const sessionOptions = { 
      sessionExpiry,
      cookiePath: dashboardPath,
    };

    // Login page (GET) - show login form or redirect to dashboard if already logged in
    router.get(`${dashboardPath}/login`, async (req: Request, res: Response) => {
      const sessionApiKey = await getSessionApiKey(req, sessionOptions);
      
      if (sessionApiKey) {
        // Already logged in, redirect to dashboard
        return res.redirect(dashboardPath);
      }

      res.setHeader("Content-Type", "text/html");
      return res.send(renderLoginPage({ dashboardPath }));
    });

    // Login handler (POST) - validate API key and create session
    router.post(`${dashboardPath}/login`, async (req: Request, res: Response) => {
      const apiKey = req.body?.apiKey;
      
      if (!apiKey) {
        res.setHeader("Content-Type", "text/html");
        return res.status(400).send(renderLoginPage({ 
          error: 'API key is required',
          dashboardPath 
        }));
      }

      const apiKeyDoc = await ApiKeyModel.findOne({ key: apiKey });
      
      if (!apiKeyDoc) {
        res.setHeader("Content-Type", "text/html");
        return res.status(401).send(renderLoginPage({ 
          error: 'Invalid API key. Please check your key and try again.',
          dashboardPath 
        }));
      }

      // Create session and redirect to dashboard
      await createSession(res, apiKey, sessionOptions);
      return res.redirect(dashboardPath);
    });

    // Logout handler - destroy session and redirect to login
    router.get(`${dashboardPath}/logout`, async (req: Request, res: Response) => {
      await destroySession(req, res, sessionOptions);
      return res.redirect(`${dashboardPath}/login`);
    });

    // Main dashboard route - requires valid session
    router.get(dashboardPath, async (req: Request, res: Response) => {
      // Check for session-based authentication first
      let apiKey = await getSessionApiKey(req, sessionOptions);
      
      // Fallback to header-based auth for API clients
      if (!apiKey) {
        apiKey = req.header(headerName) || null;
      }
      
      if (!apiKey) {
        // No session or header - redirect to login
        return res.redirect(`${dashboardPath}/login`);
      }

      const apiKeyDoc = await ApiKeyModel.findOne({ key: apiKey });
      
      if (!apiKeyDoc) {
        // Invalid key - destroy any existing session and redirect to login
        await destroySession(req, res, sessionOptions);
        return res.redirect(`${dashboardPath}/login`);
      }

      const roleInfo = apiKeyDoc.role ? await RoleModel.findOne({ name: apiKeyDoc.role }) : null;
      
      // Effective expiration: per-key expiresAt > daysValid calculation
      let keyExpiresAt: Date | string | null = null;
      if (apiKeyDoc.expiresAt) {
        keyExpiresAt = new Date(apiKeyDoc.expiresAt);
      } else {
        const start = apiKeyDoc.requestCountStart;
        if (start && apiKeyDoc.daysValid) {
          keyExpiresAt = new Date(new Date(start).getTime() + apiKeyDoc.daysValid * 24 * 60 * 60 * 1000);
        } else {
          keyExpiresAt = "Api key not used yet";
        }
      }

      // Convert roleInfo to plain object with allowedEndpoints
      const roleData = roleInfo ? roleInfo.toObject() : null;

      const dashboardData: DashboardData = {
        key: apiKeyDoc.key,
        role: apiKeyDoc.role,
        requestCountMonth: apiKeyDoc.requestCountMonth ?? null,
        requestCountStart: apiKeyDoc.requestCountStart ?? null,
        lastUsedAt: apiKeyDoc.lastUsedAt ?? null,
        keyExpiresAt,
        roleInfo: roleData ? {
          name: roleData.name,
          maxMonthlyUsage: apiKeyDoc.maxMonthlyUsage ?? roleData.maxMonthlyUsage,
          minIntervalSeconds: apiKeyDoc.minIntervalSeconds ?? roleData.minIntervalSeconds,
          allowedEndpoints: roleData.allowedEndpoints,
        } : null,
        daysValid: apiKeyDoc.daysValid ?? null,
        createdAt: (apiKeyDoc as any).createdAt ?? null,
        hasPerKeyQuota: !!apiKeyDoc.maxMonthlyUsage,
      };

      // Compute additional dashboard metrics
      const computedData = computeDashboardData(dashboardData);
      if (subscriptionsEnabled) {
        computedData.subscriptionSection = await fetchSubscriptionPanel(
          subscriptionApiBaseUrl,
          subscriptionInternalSecret,
          apiKey,
          dashboardPath,
        );
      }

      res.setHeader("Content-Type", "text/html");
      return res.send(renderDashboard(computedData, dashboardPath));
    });
  }

  // Public status page - no authentication required
  if (exposeStatusPage) {
    // Serve CSS for status page
    router.get(`${statusPagePath}/css`, (req: Request, res: Response) => {
      const cssPath = require('path').join(__dirname, '..', 'dashboard', 'templates', 'dashboard.css');
      res.setHeader('Content-Type', 'text/css');
      res.sendFile(cssPath);
    });

    router.get(statusPagePath, async (req: Request, res: Response) => {
      const roles = await RoleModel.find({}).lean();
      res.setHeader("Content-Type", "text/html");
      return res.send(renderStatusPage(roles, statusPagePath));
    });
  }

  // Main middleware
  const apiKeyAuthMiddleware = async function (req: Request, res: Response, next: NextFunction) {
    const apiKey = req.header(headerName);
    if (!apiKey) {
      return res.status(401).json({ error: "API key missing" });
    }

    // Find API key in MongoDB
    const keyDoc = await ApiKeyModel.findOne({ key: apiKey });
    if (!keyDoc) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    // Check expiration: prefer expiresAt (absolute) over daysValid (relative)
    if (keyDoc.expiresAt) {
      if (new Date() > new Date(keyDoc.expiresAt)) {
        return res.status(401).json({ error: "API key expired" });
      }
    } else if (typeof keyDoc.daysValid === "number") {
      const start = keyDoc.requestCountStart;
      if (start) {
        const expiresAt = new Date(new Date(start).getTime() + keyDoc.daysValid * 24 * 60 * 60 * 1000);
        if (new Date() > expiresAt) {
          return res.status(401).json({ error: "API key expired" });
        }
      }
    }

    // --- Rate limiting and usage tracking (per-role configurable) ---
    const now = new Date();

    // Get role config if present (from DB, not hardcoded)
    let roleConfig: any = {};
    if (keyDoc.role) {
      const roleDoc = await RoleModel.findOne({ name: keyDoc.role });
      if (roleDoc) {
        roleConfig = roleDoc.toObject();
      }
    }

    // Rolling 30-day quota tracking
    // ONLY auto-reset for keys using role-based quotas (no per-key override).
    // Keys with per-key maxMonthlyUsage have their quota managed exclusively
    // via createRenewalFunction — they must NOT be auto-reset.
    // Resets are persisted immediately with an atomic updateOne so that
    // the finish callback can use a simple $inc without stale data.
    if (!keyDoc.maxMonthlyUsage) {
      if (!keyDoc.requestCountStart) {
        await ApiKeyModel.updateOne(
          { key: apiKey },
          { $set: { requestCountStart: now, requestCountMonth: 0 } },
        );
        keyDoc.requestCountStart = now;
        keyDoc.requestCountMonth = 0;
      } else {
        const start = new Date(keyDoc.requestCountStart);
        const daysSinceStart = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceStart >= 30) {
          await ApiKeyModel.updateOne(
            { key: apiKey },
            { $set: { requestCountMonth: 0, requestCountStart: now } },
          );
          keyDoc.requestCountMonth = 0;
          keyDoc.requestCountStart = now;
        }
      }
    } else if (!keyDoc.requestCountStart) {
      // Per-key quota key used for the first time — set the start date but don't auto-reset later
      await ApiKeyModel.updateOne(
        { key: apiKey },
        { $set: { requestCountStart: now, requestCountMonth: 0 } },
      );
      keyDoc.requestCountStart = now;
      keyDoc.requestCountMonth = 0;
    }

    // Minimum interval between requests (per-key override > role config > default 2s)
    const minInterval = keyDoc.minIntervalSeconds
      ?? (typeof roleConfig.minIntervalSeconds === "number" ? roleConfig.minIntervalSeconds : 2);

    // --- In-memory rate limit (Option B) ---
    // Synchronous check + set: immune to TOCTOU because Node.js is
    // single-threaded for synchronous code — no concurrent request can
    // read the map between our check and our set.
    const lastInMemory = rateLimitMap.get(apiKey!);
    if (lastInMemory && (now.getTime() - lastInMemory) < minInterval * 1000) {
      return res.status(429).json({ error: `Requests must be at least ${minInterval} seconds apart` });
    }
    rateLimitMap.set(apiKey!, now.getTime());

    // --- Atomic DB rate limit (Option A) ---
    // Even though the in-memory check covers single-process deployments,
    // this atomic findOneAndUpdate protects multi-process / cluster setups
    // where separate Node.js processes don't share memory.
    const minIntervalMs = minInterval * 1000;
    const earliestAllowed = new Date(now.getTime() - minIntervalMs);
    const rateLimitResult = await ApiKeyModel.findOneAndUpdate(
      {
        key: apiKey,
        $or: [
          { lastUsedAt: { $exists: false } },
          { lastUsedAt: null },
          { lastUsedAt: { $lte: earliestAllowed } },
        ],
      },
      { $set: { lastUsedAt: now } },
      { new: true },
    );
    if (!rateLimitResult) {
      // Revert in-memory timestamp so the next request re-checks cleanly
      if (lastInMemory !== undefined) {
        rateLimitMap.set(apiKey!, lastInMemory);
      } else {
        rateLimitMap.delete(apiKey!);
      }
      return res.status(429).json({ error: `Requests must be at least ${minInterval} seconds apart` });
    }

    // Monthly cap (per-key override > role config > default 10k)
    const monthlyCap = keyDoc.maxMonthlyUsage
      ?? (typeof roleConfig.maxMonthlyUsage === "number" ? roleConfig.maxMonthlyUsage : 10000);

    // Mirror RapidAPI rate-limit headers on every authenticated response.
    // Lets proxy/clients use one code path (header-driven) and skip parsing JSON.
    const remainingBeforeInc = Math.max(0, monthlyCap - (keyDoc.requestCountMonth ?? 0));
    let resetSecondsHeader: number | null = null;
    if (!keyDoc.maxMonthlyUsage && keyDoc.requestCountStart) {
      const resetMs = new Date(keyDoc.requestCountStart).getTime() + 30 * 24 * 60 * 60 * 1000;
      resetSecondsHeader = Math.max(0, Math.floor((resetMs - now.getTime()) / 1000));
    }
    res.setHeader("x-ratelimit-requests-limit", String(monthlyCap));
    res.setHeader("x-ratelimit-requests-remaining", String(remainingBeforeInc));
    if (resetSecondsHeader !== null) {
      res.setHeader("x-ratelimit-requests-reset", String(resetSecondsHeader));
    }

    if ((keyDoc.requestCountMonth ?? 0) >= monthlyCap) {
      return res.status(429).json({ error: "Monthly quota exceeded" });
    }

    // Endpoint authorization can be handled by route-level middleware (see allowRoles)

    // Attach key info to request for downstream use
    (req as any).apiKeyDoc = keyDoc;

    // Increment requestCountMonth based on countOnly200 option.
    // Uses atomic $inc to avoid overwriting the lastUsedAt that was
    // already set by the atomic findOneAndUpdate above.
    res.on("finish", async () => {
      const shouldCount = countOnly200 ? res.statusCode === 200 : true;
      if (shouldCount) {
        await ApiKeyModel.updateOne(
          { key: apiKey },
          { $inc: { requestCountMonth: 1 } },
        );
      }
    });
    next();
  };

  // Return a router that runs the middleware and exposes stats if enabled
  router.use(apiKeyAuthMiddleware);
  return router;
}

/**
 * Options for renewing an API key's quota and expiration.
 */
export interface RenewalOptions {
  /** Number of requests to ADD to the current per-key maxMonthlyUsage */
  additionalRequests: number;
  /** Days to extend the key's expiration (default: 30) */
  additionalDays?: number;
  /** Whether to reset requestCountMonth to 0 (default: false — only resets automatically if the key is expired) */
  resetUsageCount?: boolean;
}

/**
 * Creates a renewal function bound to a Mongoose connection.
 * The returned function can be called from external services (e.g. payment webhook handlers)
 * to safely extend a key's quota and expiration.
 *
 * @example
 * ```ts
 * const renewApiKey = createRenewalFunction(mongoose);
 *
 * // In a payment webhook handler:
 * const renewed = await renewApiKey('user-api-key-here', {
 *   additionalRequests: 500000,
 *   additionalDays: 30,
 * });
 * ```
 */
export function createRenewalFunction(mongoose: Mongoose) {
  const ApiKeyModel = getOrCreateModel<IApiKey>(mongoose, "ApiKey", ApiKeySchema);

  return async function renewApiKey(key: string, options: RenewalOptions) {
    if (!options.additionalRequests || options.additionalRequests <= 0) {
      throw new Error('additionalRequests must be a positive number');
    }
    if (options.additionalDays !== undefined && options.additionalDays <= 0) {
      throw new Error('additionalDays must be a positive number');
    }

    const now = new Date();
    const daysToAdd = options.additionalDays ?? 30;
    const additionalMs = daysToAdd * 24 * 60 * 60 * 1000;
    const explicitReset = options.resetUsageCount === true;
    const additionalRequests = options.additionalRequests;

    // Atomic aggregation-pipeline update — eliminates lost-update race when
    // two concurrent renewals (e.g. payment webhook retries) target the same key.
    // Pipeline computes the effective current expiry, decides if the key is
    // expired, then sets the new expiry/quota in a single document operation.
    const updated = await ApiKeyModel.findOneAndUpdate(
      { key },
      [
        {
          $set: {
            // Effective current expiry: explicit expiresAt > daysValid calc > now
            _currentExpiry: {
              $cond: {
                if: { $ne: [{ $ifNull: ['$expiresAt', null] }, null] },
                then: '$expiresAt',
                else: {
                  $cond: {
                    if: {
                      $and: [
                        { $ne: [{ $ifNull: ['$requestCountStart', null] }, null] },
                        { $ne: [{ $ifNull: ['$daysValid', null] }, null] },
                      ],
                    },
                    then: {
                      $add: [
                        '$requestCountStart',
                        { $multiply: ['$daysValid', 24 * 60 * 60 * 1000] },
                      ],
                    },
                    else: now,
                  },
                },
              },
            },
          },
        },
        {
          $set: {
            _isExpired: { $gt: [now, '$_currentExpiry'] },
          },
        },
        {
          $set: {
            // Expired → extend from now. Active → extend from current effective expiry
            // (preserves remaining time on daysValid-only keys).
            expiresAt: {
              $cond: {
                if: '$_isExpired',
                then: new Date(now.getTime() + additionalMs),
                else: { $add: ['$_currentExpiry', additionalMs] },
              },
            },
            maxMonthlyUsage: {
              $add: [{ $ifNull: ['$maxMonthlyUsage', 0] }, additionalRequests],
            },
            requestCountMonth: {
              $cond: {
                if: { $or: ['$_isExpired', explicitReset] },
                then: 0,
                else: '$requestCountMonth',
              },
            },
            requestCountStart: {
              $cond: {
                if: { $or: ['$_isExpired', explicitReset] },
                then: now,
                else: '$requestCountStart',
              },
            },
          },
        },
        { $unset: ['_currentExpiry', '_isExpired'] },
      ],
      { new: true },
    );

    return updated;
  };
}
