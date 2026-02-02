"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const allowRoles_1 = require("./middleware/allowRoles");
const apiKeyAuth_1 = require("./middleware/apiKeyAuth");
const ApiKey_1 = require("./models/ApiKey");
const Role_1 = require("./models/Role");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Connect to MongoDB (adjust URI as needed)
mongoose_1.default.connect("mongodb://localhost:27017/express-api-key-demo");
// Use the API key middleware globally with dashboard enabled
app.use((0, apiKeyAuth_1.createApiKeyMiddlewareWithConnection)(mongoose_1.default, {
    exposeDashboard: true,
    dashboardPath: "/dashboard",
    exposeStatsEndpoint: true,
    sessionSecret: "your-secret-key-change-in-production", // Change this in production!
}));
// Example protected route
app.get("/data", (req, res) => {
    res.json({ message: "You have access to /data!", apiKey: req.apiKeyDoc });
});
// Example admin-only route
app.get("/mega", (0, allowRoles_1.allowRoles)(["mega"]), (req, res) => {
    const apiKeyDoc = req.apiKeyDoc;
    res.json({ message: "Welcome, admin!", apiKey: apiKeyDoc });
});
// Example endpoint for testing restrictions
app.get("/premium", (req, res) => {
    const apiKeyDoc = req.apiKeyDoc;
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
    await Role_1.RoleModel.deleteMany({});
    await ApiKey_1.ApiKeyModel.deleteMany({});
    await Role_1.RoleModel.create([
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
    await ApiKey_1.ApiKeyModel.create([
        { key: "ADMIN_KEY", role: "mega" },
        { key: "PRO_KEY", role: "pro" },
    ]);
}
// Usage:
// curl -H "x-api-key: ADMIN_KEY" http://localhost:3000/admin
// curl -H "x-api-key: PREMIUM_KEY" http://localhost:3000/premium
// curl -H "x-api-key: FREE_KEY" http://localhost:3000/data
