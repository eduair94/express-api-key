# Feature Request: Per-Key Quota Override & Renewal Support for express-api-key

## Context

The `express-api-key` package currently determines the monthly usage cap from the **Role** document (`Role.maxMonthlyUsage`). This means every API key with the same role shares the same quota limit. There is no way for an individual API key to have its own quota — which is required for subscription renewal workflows where a user pays to increase their personal request allowance.

## Current Architecture (Problem)

### ApiKey Schema (`src/models/ApiKey.ts`)
```ts
{
  key: String,
  role: String,
  createdAt: Date,
  daysValid: Number,       // days from first use
  lastUsedAt: Date,
  requestCountMonth: Number,
  requestCountStart: Date,
}
```

### Role Schema (`src/models/Role.ts`)
```ts
{
  name: String,
  minIntervalSeconds: Number,
  maxMonthlyUsage: Number,    // <-- THIS is used as the cap for ALL keys with this role
  allowedEndpoints: [String],
}
```

### Middleware Logic (`src/middleware/apiKeyAuth.ts`, lines ~258-263)
```ts
// Monthly cap comes ONLY from role config
const monthlyCap = typeof roleConfig.maxMonthlyUsage === "number" ? roleConfig.maxMonthlyUsage : 10000;
if ((keyDoc.requestCountMonth ?? 0) >= monthlyCap) {
  return res.status(429).json({ error: "Monthly quota exceeded" });
}
```

### The Problem
When a user renews their subscription and pays for more requests (e.g., going from 500,000 → 800,000), there's no way to store or enforce a per-key limit. The role says 500,000 and that's what every key with that role gets, regardless of what was purchased.

### Dashboard & Stats Endpoint
The dashboard and `/api-key-stats` endpoint also read from the role for the cap, so even if the DB document has a higher limit, the UI shows the role's limit.

## Requested Changes

### 1. Add per-key quota fields to ApiKey Schema

Add optional fields to `ApiKey` that can **override** the role defaults when present:

```ts
// src/models/ApiKey.ts
export const ApiKeySchema = new Schema<IApiKey>({
  key: { type: String, required: true, unique: true },
  role: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  daysValid: { type: Number, default: 30 },
  lastUsedAt: { type: Date },
  requestCountMonth: { type: Number, default: 0 },
  requestCountStart: { type: Date },
  
  // NEW: Per-key overrides (when set, these take priority over role defaults)
  maxMonthlyUsage: { type: Number, default: null },      // Overrides role.maxMonthlyUsage
  minIntervalSeconds: { type: Number, default: null },    // Overrides role.minIntervalSeconds
  expiresAt: { type: Date, default: null },               // Absolute expiration (overrides daysValid calculation)
});
```

### 2. Update middleware to respect per-key overrides

In `apiKeyAuth.ts`, the middleware should check the ApiKey document first, then fall back to the role:

```ts
// Expiration check: prefer expiresAt (absolute) over daysValid (relative)
if (keyDoc.expiresAt) {
  if (new Date() > keyDoc.expiresAt) {
    return res.status(401).json({ error: "API key expired" });
  }
} else if (typeof keyDoc.daysValid === "number") {
  // existing daysValid logic...
}

// Monthly cap: per-key override > role config > default
const monthlyCap = keyDoc.maxMonthlyUsage 
  ?? (typeof roleConfig.maxMonthlyUsage === "number" ? roleConfig.maxMonthlyUsage : 10000);

// Min interval: per-key override > role config > default
const minInterval = keyDoc.minIntervalSeconds
  ?? (typeof roleConfig.minIntervalSeconds === "number" ? roleConfig.minIntervalSeconds : 2);
```

### 3. Add a `renewApiKey` utility function

Export a function that can be called from external services (like a payment webhook handler) to safely renew a key:

```ts
// src/middleware/apiKeyAuth.ts or a new src/utils/renewal.ts

export interface RenewalOptions {
  additionalRequests: number;   // Requests to ADD to the current maxMonthlyUsage
  additionalDays?: number;      // Days to extend (default: 30)
  resetUsageCount?: boolean;    // Whether to reset requestCountMonth to 0 (default: false, only reset if expired)
}

export function createRenewalFunction(mongoose: Mongoose) {
  const ApiKeyModel = getOrCreateModel(mongoose, "ApiKey", ApiKeySchema);
  
  return async function renewApiKey(key: string, options: RenewalOptions) {
    const apiKey = await ApiKeyModel.findOne({ key });
    if (!apiKey) return null;

    const now = new Date();
    const daysToAdd = options.additionalDays ?? 30;

    // Determine if key is currently expired
    let isExpired = false;
    if (apiKey.expiresAt) {
      isExpired = now > apiKey.expiresAt;
    } else if (apiKey.requestCountStart && apiKey.daysValid) {
      const expiry = new Date(apiKey.requestCountStart.getTime() + apiKey.daysValid * 24 * 60 * 60 * 1000);
      isExpired = now > expiry;
    }

    // Extend expiration
    const baseDate = isExpired ? now : (apiKey.expiresAt || now);
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
```

### 4. Update Dashboard & Stats to show per-key values

In the dashboard route and stats endpoint, use the effective cap (per-key override or role fallback):

```ts
// Stats endpoint
const effectiveCap = apiKeyDoc.maxMonthlyUsage ?? roleInfo?.maxMonthlyUsage ?? 10000;
const effectiveExpiresAt = apiKeyDoc.expiresAt || (start 
  ? new Date(new Date(start).getTime() + apiKeyDoc.daysValid * 24 * 60 * 60 * 1000)
  : null);

return res.json({
  key: apiKeyDoc.key,
  role: apiKeyDoc.role,
  requestCountMonth: apiKeyDoc.requestCountMonth,
  maxMonthlyUsage: effectiveCap,  // Show the EFFECTIVE cap
  expiresAt: effectiveExpiresAt || "Api key not used yet",
  roleInfo,
});

// Dashboard data
const dashboardData: DashboardData = {
  // ... existing fields ...
  roleInfo: roleData ? {
    ...roleData,
    maxMonthlyUsage: apiKeyDoc.maxMonthlyUsage ?? roleData.maxMonthlyUsage, // Per-key override
  } : null,
};
```

### 5. Export the renewal function from index.ts

```ts
// src/index.ts
export * from "./middleware/allowRoles";
export * from "./middleware/apiKeyAuth";
export * from "./models/ApiKey";
export * from "./models/Role";
// NEW
export { createRenewalFunction } from "./middleware/apiKeyAuth"; // or from utils/renewal.ts
```

## Key Design Principles

1. **Backward compatible**: All new fields are optional with `null` defaults. Existing keys without per-key overrides continue using role defaults exactly as before.
2. **No caching conflicts**: The middleware already queries MongoDB fresh on every request (`ApiKeyModel.findOne`), so updated values are immediately visible. No in-memory cache to invalidate.
3. **Per-key overrides > Role defaults > Hardcoded defaults**: Clear precedence chain.
4. **Cumulative renewals**: Multiple renewals ADD to the existing `maxMonthlyUsage`, they don't replace it.
5. **Smart expiration handling**: If key is expired, extend from `now`. If still active, extend from current expiration date.

## Usage Example (Payment Webhook)

```ts
import { createRenewalFunction } from 'express-api-key';
import mongoose from 'mongoose';

const renewApiKey = createRenewalFunction(mongoose);

// In your payment webhook handler:
async function handlePaymentCompleted(apiKey: string, requestsPurchased: number) {
  const renewed = await renewApiKey(apiKey, {
    additionalRequests: requestsPurchased,  // e.g., 500000
    additionalDays: 30,
    resetUsageCount: false,  // Only resets if expired
  });
  
  if (renewed) {
    console.log(`Renewed: new cap = ${renewed.maxMonthlyUsage}, expires = ${renewed.expiresAt}`);
  }
}
```

## Files to Modify

1. `src/models/ApiKey.ts` — Add `maxMonthlyUsage`, `minIntervalSeconds`, `expiresAt` fields
2. `src/middleware/ApiKeyDbAdapter.ts` — Update `IApiKey` interface  
3. `src/middleware/apiKeyAuth.ts` — Update middleware logic + add `createRenewalFunction` export
4. `src/dashboard/types.ts` — No change needed (already has the right fields in computed data)
5. `src/dashboard/utils.ts` — Update `computeDashboardData` to use effective cap
6. `src/index.ts` — Export `createRenewalFunction`
