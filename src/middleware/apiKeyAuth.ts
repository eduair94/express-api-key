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
import { ApiKeySchema, IApiKey } from "../models/ApiKey";
import { RoleSchema } from "../models/Role";

function getOrCreateModel<T extends object>(mongoose: Mongoose, name: string, schema: Schema<T>): Model<T> {
  return mongoose.models[name] || mongoose.model<T>(name, schema);
}

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
        if (start) {
          expiresAt = new Date(new Date(start).getTime() + apiKeyDoc.daysValid * 24 * 60 * 60 * 1000);
        }
      }

      // Effective cap: per-key override > role > default
      const effectiveCap = apiKeyDoc.maxMonthlyUsage
        ?? roleInfo?.maxMonthlyUsage
        ?? 10000;

      return res.json({
        key: apiKeyDoc.key,
        role: apiKeyDoc.role,
        requestCountMonth: apiKeyDoc.requestCountMonth,
        requestCountStart: apiKeyDoc.requestCountStart,
        lastUsedAt: apiKeyDoc.lastUsedAt,
        maxMonthlyUsage: effectiveCap,
        expiresAt: expiresAt || "Api key not used yet",
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
    if (!keyDoc.maxMonthlyUsage) {
      if (!keyDoc.requestCountStart) {
        keyDoc.requestCountStart = now;
        keyDoc.requestCountMonth = 0;
      } else {
        const start = new Date(keyDoc.requestCountStart);
        const daysSinceStart = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceStart >= 30) {
          keyDoc.requestCountMonth = 0;
          keyDoc.requestCountStart = now;
        }
      }
    } else if (!keyDoc.requestCountStart) {
      // Per-key quota key used for the first time — set the start date but don't auto-reset later
      keyDoc.requestCountStart = now;
      keyDoc.requestCountMonth = 0;
    }

    // Minimum interval between requests (per-key override > role config > default 2s)
    const minInterval = keyDoc.minIntervalSeconds
      ?? (typeof roleConfig.minIntervalSeconds === "number" ? roleConfig.minIntervalSeconds : 2);
    if (keyDoc.lastUsedAt && now.getTime() - new Date(keyDoc.lastUsedAt).getTime() < minInterval * 1000) {
      return res.status(429).json({ error: `Requests must be at least ${minInterval} seconds apart` });
    }

    // Monthly cap (per-key override > role config > default 10k)
    const monthlyCap = keyDoc.maxMonthlyUsage
      ?? (typeof roleConfig.maxMonthlyUsage === "number" ? roleConfig.maxMonthlyUsage : 10000);
    if ((keyDoc.requestCountMonth ?? 0) >= monthlyCap) {
      return res.status(429).json({ error: "Monthly quota exceeded" });
    }

    // Endpoint authorization can be handled by route-level middleware (see allowRoles)

    // Attach key info to request for downstream use
    (req as any).apiKeyDoc = keyDoc;

    // Increment requestCountMonth based on countOnly200 option
    res.on("finish", async () => {
      if (countOnly200) {
        // Only count successful (200) requests
        if (res.statusCode === 200) {
          keyDoc.requestCountMonth = (keyDoc.requestCountMonth ?? 0) + 1;
          keyDoc.lastUsedAt = now;
          await keyDoc.save();
        }
      } else {
        // Count all requests regardless of status code
        keyDoc.requestCountMonth = (keyDoc.requestCountMonth ?? 0) + 1;
        keyDoc.lastUsedAt = now;
        await keyDoc.save();
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

    const apiKey = await ApiKeyModel.findOne({ key });
    if (!apiKey) return null;

    const now = new Date();
    const daysToAdd = options.additionalDays ?? 30;

    // Determine if the key is currently expired
    let isExpired = false;
    if (apiKey.expiresAt) {
      isExpired = now > new Date(apiKey.expiresAt);
    } else if (apiKey.requestCountStart && apiKey.daysValid) {
      const expiry = new Date(
        new Date(apiKey.requestCountStart).getTime() + apiKey.daysValid * 24 * 60 * 60 * 1000
      );
      isExpired = now > expiry;
    }

    // Extend expiration: if expired extend from now, otherwise extend from current expiration
    const baseDate = isExpired ? now : (apiKey.expiresAt ? new Date(apiKey.expiresAt) : now);
    apiKey.expiresAt = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    // Add requests to per-key quota (cumulative)
    const currentMax = apiKey.maxMonthlyUsage || 0;
    apiKey.maxMonthlyUsage = currentMax + options.additionalRequests;

    // Reset usage if expired or explicitly requested
    if (isExpired || options.resetUsageCount) {
      apiKey.requestCountMonth = 0;
      apiKey.requestCountStart = now;
    }

    await apiKey.save();
    return apiKey;
  };
}
