# express-api-key

A robust, reusable Express middleware for API key authentication, role-based access control, and rate limiting. Includes a Discord bot for key generation and a flexible MongoDB schema for scalable API protection.

---
## Installation

```bash
npm install express-api-key
```

> **Peer dependencies:** Your project provides `express` and `mongoose` (8.16+ or 9).

---
## Quick Start

### 1. Configure MongoDB Models

Ensure your MongoDB instance is running and your models are set up as in `src/models/ApiKey.ts` and `src/models/Role.ts`.

### 2. Integrate Middleware

```typescript
import express from 'express';
import mongoose from 'mongoose';
import { createApiKeyMiddlewareWithConnection } from 'express-api-key';

const app = express();
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/your-db');

app.use(createApiKeyMiddlewareWithConnection(mongoose, { headerName: 'x-api-key' }));

app.get('/protected', (req, res) => {
  res.json({ message: 'You are authenticated!', apiKey: (req as any).apiKeyDoc });
});
```

### 3. Customer dashboard, renewals and auto-renew (optional)

```typescript
app.use(createApiKeyMiddlewareWithConnection(mongoose, {
  headerName: 'x-api-key',
  exposeDashboard: true,              // GET /dashboard (login with the API key)
  docsUrl: '/docs',                   // "API Docs" button
  renewUrl: 'https://checkout.example.com/', // "Add credits" / "Renew now" links
  subscriptionsEnabled: true,         // "Auto-renew" panel (PayPal subscriptions)
  subscriptionApiBaseUrl: 'http://127.0.0.1:4011',
  subscriptionInternalSecret: process.env.SUBSCRIPTION_INTERNAL_SECRET,
}));
```

With `renewUrl` set, the dashboard links to `<renewUrl>?mode=renew&src=dashboard#key=<key>`
(and `&autorenew=1` for "Turn on auto-renew"). The key travels in the URL **fragment**, which
browsers never send to a server; the checkout reads it and removes it from the address bar.
`buildRenewUrl(renewUrl, key, { autoRenew })` builds the same link for your own pages.

The auto-renew panel reads `GET <subscriptionApiBaseUrl>/api/subscription/status`: a
subscription (`success` + `data`) is shown with change/turn-off controls; `code: "NO_SUBSCRIPTION"`
with `autoRenew: { available, message }` offers "Turn on auto-renew" (or says why it is not
available). Its change form uses the status's `requestBounds: { min, step }` (default 50,000 / 50,000).

### 4. Confirmed debit accounting (optional)

```typescript
app.use(createApiKeyMiddlewareWithConnection(mongoose, {
  countOnly200: true, // the existing billing policy; accounting does not change it
  usageAccounting: {
    categories: ['lookup', 'bulk', 'profile'],
    // Return a server-owned label, never a URL, key, number or customer identifier.
    category: (req) => req.path.startsWith('/profile/') ? 'profile' : 'lookup',
  },
}));
```

Omit `usageAccounting` to retain the original debit write without creating accounting
fields. Configuration accepts at most 31 category names (`[a-z][a-z0-9_-]{0,31}`),
plus the reserved `unknown` category. Invalid configuration fails at startup. The
classifier is synchronous; missing, invalid or throwing results become `unknown`.
Changing the allowlist folds retired labels into `unknown` when that day is next
updated, preserving the day's total.

A response that finishes with HTTP 200 still consumes exactly one credit when
`countOnly200` is true, including a bulk response. With `countOnly200: false`, every
finished response that reached the debit listener still counts. Rejected requests
before that listener and connections closed without `finish` do not count. This
feature does not add per-number billing or deduplicate repeated HTTP requests.

The existing quota counter and the accounting are updated in **one atomic MongoDB
document operation**. `finish` itself is not proof of a persisted debit: the database
write can fail. The middleware checks its acknowledgement/result, catches failures,
and emits only a fixed warning label (at most once per minute per middleware).
It never retries a debit after an error or a lost acknowledgement, and does not
delay or change the HTTP response. Existing driver/write-concern settings still
determine durability; acknowledgement does not imply majority persistence.

Internal storage, under the existing API-key document:

```typescript
usageAccounting: {
  version: 1,
  totalDebitedCredits: 12,       // never reset by quota renewal/reset
  firstRecordedDay: '2026-11-02',
  lastRecordedDay: '2026-11-02',
  outOfWindowDebits: 0,         // old clock date could not replace a newer slot
  daily: {
    // UTC epoch day modulo 90.
    '59': {
      day: '2026-11-02',
      debitedCredits: 12,
      categories: { lookup: 10, unknown: 2 },
    },
  },
}
```

Only numeric aggregates and fixed labels are added: no new identifiers, request
payloads, URLs, phone numbers or emails. Days use the server's response-completion
time in UTC. The ring has at most 90 slots and 32 categories per slot. Reusing a slot
replaces its older day atomically; a date older than an occupied slot increments
`outOfWindowDebits` and the lifetime total without overwriting that slot. Inactive
keys can retain old slots, so **always filter by `day` for the reporting window**;
the field is not a TTL index and never expires an API key. The test's worst-case
90-by-32 fixture is below 256 KiB, well below MongoDB's 16 MiB document limit.
Existing unrelated data still contributes to the full document size.

Normal library reads explicitly exclude the field, its schema uses `select: false`,
and document `toJSON()`/`toObject()` omit it even after an explicit selection.
Raw collection queries, aggregation and explicitly selected lean results bypass
those protections. Use them only for internal reporting and project aggregate
numbers without API keys or document IDs; no public accounting endpoint is added.

Accounting starts on activation; it does not backfill old usage or prove continuous
coverage when switched off. It measures direct debited HTTP requests, not live
checks, cache hits, revenue, or external marketplace billing. Counter resets do not
erase it. First-use and rolling quota resets compare the observed window, cap and
authorization fields before writing; a concurrent reset or renewal forces a fresh
quota check instead of overwriting its result. Quota admission is still checked
before the response and charged after it, so parallel accepted requests can exceed
the remaining quota; this accounting does not reserve credits in advance.
Three conflicting reset attempts return 503 if a fresh read still needs a reset,
without admitting or charging the request. Noncanonical legacy BSON types may
also require correcting the stored field before a reset can proceed; the
middleware never rewrites those types.
The additional bounded update has a per-request cost; validate it against the
deployment's traffic before enabling it broadly.

The opt-in uses MongoDB 4.2+ aggregation update expressions, as the renewal helper
already does. `npm run test:usage` exercises MongoDB 8.2.6 locally with Mongoose
9.10.3 and the minimum supported 8.16.5. It does not connect to production.
`npm run test:quota-reset` uses the same matrix for deterministic reset races,
concurrent renewals, expiration changes and legacy null/missing fields.

## CLI Usage

This package provides a CLI for managing roles and generating API keys.

### Create or Update a Role

```bash
npx api_key_express role <name> <minIntervalSeconds> <maxMonthlyUsage>
# Example:
npx api_key_express role premium 1 5000
```

### Generate API Keys

```bash
npx api_key_express genkeys <role> <daysValid> <count>
# Example:
npx api_key_express genkeys premium 30 10
```

> **Note:** Requires `MONGODB_URI` in your environment.

---
## API Key Generation (Discord Bot)

1. Set up your Discord bot token and authorized user IDs as environment variables:
   - `DISCORD_TOKEN=your-bot-token`
   - `AUTHORIZED_USER_IDS=comma,separated,discord,ids`
2. Run the bot:
   ```bash
   node dist/discord/bot.js
   ```
3. Use the command in Discord:
   ```
   !genkeys <count> <role> <daysValid> <endpoints>
   # Example: !genkeys 5 premium 30 /api/data,/api/other
   ```
4. The bot will DM you a `.txt` file with the generated keys.

---
## Roles & Restrictions

- Define roles in MongoDB (`RoleModel`). Example:
  ```js
  {
    name: 'premium',
    minIntervalSeconds: 1,
    maxMonthlyUsage: 5000
  }
  ```
- Assign roles to API keys. Restrictions (rate limits, endpoints, etc.) are enforced dynamically per role.

---
## Error Responses

- `401 { error: 'API key missing' }`
- `401 { error: 'Invalid API key' }`
- `401 { error: 'API key expired' }`
- `429 { error: 'Requests must be at least X seconds apart' }`
- `429 { error: 'Monthly quota exceeded' }`
- `401 { error: 'Endpoint not allowed for your role' }`
- `401 { error: 'Insufficient permissions' }`

---
## How to Sell API Keys

You can sell API keys generated by this package using platforms like [Sellpass](https://sellpass.io), [Gumroad](https://gumroad.com), or [LemonSqueezy](https://lemonsqueezy.com):

1. **Generate keys** using the CLI or Discord bot and save the `.txt` file.
2. **Upload the keys** as "license keys" or "digital products" to your chosen platform.
3. **Configure automatic delivery** so buyers receive a key upon purchase.
4. **Rotate and replenish** your key stock as needed.

> **Tip:** Never expose your MongoDB or backend credentials to buyers. Only deliver the API key string.

---
## Best Practices

- **Store keys securely**: Never expose API keys in client-side code.
- **Rotate keys**: Expire and regenerate keys regularly.
- **Use roles**: Assign roles to group users and manage restrictions centrally.
- **Monitor usage**: Track and alert on suspicious or excessive usage.
- **Keep dependencies updated**: Regularly update this package and its peer dependencies.

---
## Example Usage

```typescript
// See example.ts for a full working demo
import { createApiKeyMiddlewareWithConnection, allowRoles } from 'express-api-key';
app.use(createApiKeyMiddlewareWithConnection(mongoose));
app.get('/data', (req, res) => res.json({ ok: true }));
app.get('/admin', allowRoles(['mega']), (req, res) => res.json({ admin: true }));
```
## License
MIT

---

# express-api-key

A robust, reusable Express middleware for API key authentication, role-based access control, and rate limiting. Includes a Discord bot for key generation and a flexible MongoDB schema for scalable API protection.

---

## Installation

```bash
npm install express-api-key
```

> **Peer dependencies:** Your project provides `express` and `mongoose` (8.16+ or 9).

---

## Quick Start

### 1. Configure MongoDB Models

Ensure your MongoDB instance is running and your models are set up as in `src/models/ApiKey.ts` and `src/models/Role.ts`.

### 2. Integrate Middleware

```typescript
import express from 'express';
import mongoose from 'mongoose';
import { createApiKeyMiddleware } from 'express-api-key';

const app = express();
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/your-db');

app.use(createApiKeyMiddleware({ headerName: 'x-api-key' }));

app.get('/protected', (req, res) => {
  res.json({ message: 'You are authenticated!', apiKey: (req as any).apiKeyDoc });
});
```

---

## API Key Generation (Discord Bot)

1. Set up your Discord bot token and authorized user IDs as environment variables:
   - `DISCORD_TOKEN=your-bot-token`
   - `AUTHORIZED_USER_IDS=comma,separated,discord,ids`
2. Run the bot:
   ```bash
   node dist/discord/bot.js
   ```
3. Use the command in Discord:
   ```
   !genkeys <count> <role> <daysValid> <endpoints>
   # Example: !genkeys 5 premium 30 /api/data,/api/other
   ```
4. The bot will DM you a `.txt` file with the generated keys.

---

## Roles & Restrictions

- Define roles in MongoDB (`RoleModel`). Example:
  ```js
  {
    name: 'premium',
    allowedEndpoints: ['/data', '/premium'],
    minIntervalSeconds: 1,
    maxMonthlyUsage: 5000,
    permissions: [{ endpoint: '/premium', method: 'GET' }]
  }
  ```
- Assign roles to API keys. Restrictions (rate limits, endpoints, etc.) are enforced dynamically per role.

---

## Error Responses

- `401 { error: 'API key missing' }`
- `401 { error: 'Invalid API key' }`
- `401 { error: 'API key expired' }`
- `429 { error: 'Requests must be at least X seconds apart' }`
- `429 { error: 'Monthly quota exceeded' }`
- `401 { error: 'Endpoint not allowed for your role' }`
- `401 { error: 'Insufficient permissions' }`

---

## Best Practices

- **Store keys securely**: Never expose API keys in client-side code.
- **Rotate keys**: Expire and regenerate keys regularly.
- **Use roles**: Assign roles to group users and manage restrictions centrally.
- **Monitor usage**: Track and alert on suspicious or excessive usage.
- **Keep dependencies updated**: Regularly update this package and its peer dependencies.

---

## Example Usage

```typescript
// See example.ts for a full working demo
app.use(createApiKeyMiddleware());
app.get('/data', (req, res) => res.json({ ok: true }));
```

---

## License
MIT
