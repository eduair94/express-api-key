import express from "express";
import mongoose from "mongoose";
import { allowRoles } from "./middleware/allowRoles";
import { createApiKeyMiddlewareWithConnection } from "./middleware/apiKeyAuth";
import { ApiKeyModel } from "./models/ApiKey";
import { RoleModel } from "./models/Role";

const app = express();
app.use(express.json());

// Connect to MongoDB (adjust URI as needed)
mongoose.connect("mongodb://localhost:27017/express-api-key-demo");

// Use the API key middleware globally
app.use(createApiKeyMiddlewareWithConnection(mongoose));
// Example protected route
app.get("/data", (req, res) => {
  res.json({ message: "You have access to /data!", apiKey: (req as any).apiKeyDoc });
});

// Example admin-only route
app.get("/mega", allowRoles(["mega"]), (req, res) => {
  const apiKeyDoc = (req as any).apiKeyDoc;
  res.json({ message: "Welcome, admin!", apiKey: apiKeyDoc });
});

// Example endpoint for testing restrictions
app.get("/premium", (req, res) => {
  const apiKeyDoc = (req as any).apiKeyDoc;
  res.json({ message: "Welcome, premium user!" });
});

// Start server
dbInit().then(() => {
  app.listen(3000, () => {
    console.log("Example app listening on port 3000");
  });
});

// Seed roles and keys for demo
async function dbInit() {
  await RoleModel.deleteMany({});
  await ApiKeyModel.deleteMany({});
  await RoleModel.create([
    {
      name: "pro",
      minIntervalSeconds: 1,
      maxMonthlyUsage: 5000,
    },
    {
      name: "ultra",
      minIntervalSeconds: 0.5,
      maxMonthlyUsage: 50000,
    },
    {
      name: "mega",
      minIntervalSeconds: 0.5,
      maxMonthlyUsage: 500000,
    },
  ]);
  await ApiKeyModel.create([
    { key: "ADMIN_KEY", role: "mega" },
    { key: "PRO_KEY", role: "pro" },
  ]);
}

// Usage:
// curl -H "x-api-key: ADMIN_KEY" http://localhost:3000/admin
// curl -H "x-api-key: PREMIUM_KEY" http://localhost:3000/premium
// curl -H "x-api-key: FREE_KEY" http://localhost:3000/data
