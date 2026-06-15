"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const subscriptionPanel_1 = require("./subscriptionPanel");
// No subscription → empty string (panel hidden)
assert_1.default.strictEqual((0, subscriptionPanel_1.renderSubscriptionPanel)(null, '/dashboard'), '');
const data = {
    subscriptionId: 'I-1', status: 'active', requestsAmount: 500000, price: 190,
    balance: 1234567, capTotal: 2000000, used: 765433,
    currentPeriodEnd: '2026-07-15T00:00:00.000Z', graceEndsAt: null,
    pendingChange: null, expiresAt: '2026-07-18T00:00:00.000Z',
};
const html = (0, subscriptionPanel_1.renderSubscriptionPanel)(data, '/dashboard');
assert_1.default.ok(html.includes('Subscription'), 'has heading');
assert_1.default.ok(html.includes('1,234,567'), 'shows balance formatted');
assert_1.default.ok(html.includes('500,000') || html.includes('500000'), 'shows monthly tokens');
assert_1.default.ok(html.includes('/dashboard/subscription/change'), 'change form posts to route');
assert_1.default.ok(html.includes('/dashboard/subscription/cancel'), 'cancel form posts to route');
// Cancelled → shows grace, no cancel button
const cancelled = { ...data, status: 'cancelled', graceEndsAt: '2026-10-13T00:00:00.000Z' };
const chtml = (0, subscriptionPanel_1.renderSubscriptionPanel)(cancelled, '/dashboard');
assert_1.default.ok(chtml.toLowerCase().includes('grace') || chtml.includes('2026'), 'shows grace info');
assert_1.default.ok(!chtml.includes('/dashboard/subscription/cancel'), 'no cancel button when already cancelled');
// Pending change shown
const pending = { ...data, pendingChange: { requestsAmount: 1000000, price: 380 } };
assert_1.default.ok((0, subscriptionPanel_1.renderSubscriptionPanel)(pending, '/dashboard').includes('1,000,000'), 'shows pending change amount');
console.log('PASS: subscriptionPanel');
