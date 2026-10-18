"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const renderer_1 = require("./renderer");
const CHECKOUT = 'https://sub.example/';
const base = {
    key: 'wapi_test',
    role: 'pro',
    requestCountMonth: 100000,
    requestCountStart: null,
    lastUsedAt: null,
    keyExpiresAt: new Date(Date.now() + 40 * 86400000).toISOString(),
    roleInfo: null,
    daysValid: 120,
    createdAt: null,
    hasPerKeyQuota: true,
    monthlyCap: 500000,
    usagePercent: '20.0',
    remaining: 400000,
    renewalDays: null,
    renewalDate: null,
    keyExpiresDays: 40,
    usageStatus: 'healthy',
    keyStatus: 'healthy',
};
// null = no checkout configured (undefined would pick the default).
const render = (over = {}, renewUrl = CHECKOUT) => (0, renderer_1.renderDashboard)({ ...base, ...over }, '/dashboard', '/docs', renewUrl !== null && renewUrl !== void 0 ? renewUrl : undefined);
// ── "Add credits" in the header, the key only in the link's fragment ──────
{
    const html = render();
    assert_1.default.ok(html.includes('id="addCreditsLink"'), 'header button');
    assert_1.default.ok(html.includes('href="https://sub.example/?mode=renew&amp;src=dashboard#key=wapi_test"'), 'renewal link, attribute-escaped');
    assert_1.default.ok(html.includes('Add credits'));
    assert_1.default.ok(html.includes('rel="noopener noreferrer"'));
    assert_1.default.ok(!html.includes('id="keyAlert"'), 'a healthy key gets no alert');
}
// ── no checkout configured: the dashboard reads as before ─────────────────
{
    const html = render({}, null);
    assert_1.default.ok(!html.includes('id="addCreditsLink"'));
    assert_1.default.ok(!html.includes('mode=renew'));
    const expiring = render({ keyExpiresDays: 3, keyStatus: 'warning' }, null);
    assert_1.default.ok(expiring.includes('Contact support to renew your key.'));
}
// ── expiring soon: renew from here, not "contact support" ─────────────────
{
    const html = render({ keyExpiresDays: 3, keyStatus: 'warning' });
    assert_1.default.ok(html.includes('Key Expiring Soon'));
    assert_1.default.ok(!html.includes('Contact support to renew'));
    assert_1.default.ok(html.includes('Renew now'));
}
// ── high usage: add credits from the insight ───────────────────────────────
{
    const html = render({ usagePercent: '85.0', usageStatus: 'warning', remaining: 75000 });
    assert_1.default.ok(html.includes('High Usage Alert'));
    assert_1.default.match(html, /High Usage Alert[\s\S]*Add credits/);
}
// ── expired or spent: a banner above the stats says what to do ────────────
{
    const expired = render({ keyExpiresDays: -2, keyStatus: 'critical' });
    assert_1.default.ok(expired.includes('id="keyAlert"'));
    assert_1.default.match(expired, /This API key has expired/);
    assert_1.default.match(expired, /id="keyAlert"[\s\S]*Renew now/);
    const spent = render({ remaining: 0, usagePercent: '100.0', usageStatus: 'critical' });
    assert_1.default.ok(spent.includes('id="keyAlert"'));
    assert_1.default.match(spent, /No requests left on this key/);
    assert_1.default.match(spent, /id="keyAlert"[\s\S]*Add credits/);
    // A role-based quota refills by itself: nothing to buy.
    const roleSpent = render({ remaining: 0, hasPerKeyQuota: false });
    assert_1.default.ok(!roleSpent.includes('id="keyAlert"'));
    // Without a checkout the banner still explains, without a button.
    const noUrl = render({ keyExpiresDays: -2, keyStatus: 'critical' }, null);
    assert_1.default.ok(noUrl.includes('id="keyAlert"'));
    assert_1.default.ok(!/id="keyAlert"[\s\S]*mode=renew/.test(noUrl));
}
// ── a revoked key (refunded or charged back): nothing to buy, say why ────
{
    const html = render({ revoked: true, keyExpiresDays: 3, keyStatus: 'warning', usagePercent: '90.0' });
    assert_1.default.ok(!html.includes('id="addCreditsLink"'), 'no "Add credits" on a revoked key');
    assert_1.default.ok(!html.includes('mode=renew'), 'no renewal link anywhere');
    assert_1.default.ok(html.includes('id="keyAlert"'));
    assert_1.default.match(html, /This API key was revoked/);
    assert_1.default.match(html, /Contact support/);
}
// ── a key that is not URL- or HTML-safe never breaks out of the attribute ─
{
    const html = render({ key: 'a"b<c>&d' });
    assert_1.default.ok(!html.includes('a"b<c'), 'raw key never in markup');
    assert_1.default.ok(html.includes('#key=a%22b%3Cc%3E%26d'));
}
console.log('PASS: dashboardRenew');
