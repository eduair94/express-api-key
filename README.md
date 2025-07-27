
# express-api-key

A robust, reusable Express middleware for API key authentication, role-based access control, and rate limiting. Includes a Discord bot for key generation and a flexible MongoDB schema for scalable API protection.

---

## Installation

```bash
npm install express-api-key
```

> **Peer dependencies:** You must also install `express`, `mongoose`, and `rate-limiter-flexible` in your project.

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
