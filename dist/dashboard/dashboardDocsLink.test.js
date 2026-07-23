"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const renderer_1 = require("./renderer");
const data = {
    key: 'wapi_test',
    role: 'pro',
    requestCountMonth: 0,
    requestCountStart: null,
    lastUsedAt: null,
    keyExpiresAt: null,
    roleInfo: null,
    daysValid: 120,
    createdAt: null,
    hasPerKeyQuota: true,
    monthlyCap: 500000,
    usagePercent: '0',
    remaining: 500000,
    renewalDays: null,
    renewalDate: null,
    keyExpiresDays: 120,
    usageStatus: 'healthy',
    keyStatus: 'healthy',
};
const defaultHtml = (0, renderer_1.renderDashboard)(data);
assert_1.default.ok(defaultHtml.includes('href="/docs"'), 'links to default docs route');
assert_1.default.ok(defaultHtml.includes('API Docs'), 'shows the API Docs label');
assert_1.default.ok(defaultHtml.includes('rel="noopener noreferrer"'), 'protects the new tab from opener access');
const customHtml = (0, renderer_1.renderDashboard)(data, '/account', 'https://api.example.com/docs?source=dashboard&view=full');
assert_1.default.ok(customHtml.includes('href="https://api.example.com/docs?source=dashboard&amp;view=full"'), 'supports and escapes a configured documentation URL');
console.log('PASS: dashboardDocsLink');
