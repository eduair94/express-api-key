"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const subscriptionPanel_1 = require("./subscriptionPanel");
const AUTO_URL = 'https://sub.example/?mode=renew&autorenew=1#key=k';
// Nothing known → empty string (panel hidden)
assert_1.default.strictEqual((0, subscriptionPanel_1.renderSubscriptionPanel)(null, '/dashboard', AUTO_URL), '');
const data = {
    subscriptionId: 'I-1', status: 'active', requestsAmount: 500000, price: 190,
    balance: 1234567, capTotal: 2000000, used: 765433,
    currentPeriodEnd: '2026-07-15T00:00:00.000Z', graceEndsAt: null,
    pendingChange: null, expiresAt: '2026-07-18T00:00:00.000Z',
};
// ── active: details, change, turn off ─────────────────────────────────────
{
    const html = (0, subscriptionPanel_1.renderSubscriptionPanel)({ kind: 'subscription', data }, '/dashboard', AUTO_URL);
    assert_1.default.ok(html.includes('Auto-renew'), 'has heading');
    assert_1.default.ok(html.includes('>On<'), 'on badge');
    assert_1.default.ok(html.includes('1,234,567'), 'shows balance formatted');
    assert_1.default.ok(html.includes('500,000'), 'shows tokens per cycle');
    assert_1.default.ok(html.includes('$190.00'), 'shows the price per cycle');
    assert_1.default.ok(html.includes('/dashboard/subscription/change'), 'change form posts to route');
    assert_1.default.ok(html.includes('/dashboard/subscription/cancel'), 'cancel form posts to route');
    assert_1.default.ok(html.includes('Turn off auto-renew'));
    assert_1.default.ok(!html.includes('Turn on auto-renew'));
}
// ── cancelled: grace, no cancel, and a way back when allowed ──────────────
{
    const cancelled = { ...data, status: 'cancelled', graceEndsAt: '2026-10-13T00:00:00.000Z' };
    const html = (0, subscriptionPanel_1.renderSubscriptionPanel)({ kind: 'subscription', data: cancelled, offer: { available: true, message: null } }, '/dashboard', AUTO_URL);
    assert_1.default.ok(html.includes('October 13, 2026'), 'shows when the remaining requests lapse');
    assert_1.default.ok(!html.includes('/dashboard/subscription/cancel'), 'no cancel button when already cancelled');
    assert_1.default.ok(html.includes('Turn auto-renew back on'));
    assert_1.default.ok(html.includes('href="https://sub.example/?mode=renew&amp;autorenew=1#key=k"'));
    const closing = (0, subscriptionPanel_1.renderSubscriptionPanel)({ kind: 'subscription', data: cancelled, offer: { available: false, message: 'Still closing <b>' } }, '/dashboard', AUTO_URL);
    assert_1.default.ok(!closing.includes('Turn auto-renew back on'));
    assert_1.default.ok(closing.includes('Still closing &lt;b&gt;'), 'reason shown, escaped');
}
// ── suspended: PayPal stopped, the customer is told who can restart it ────
{
    const html = (0, subscriptionPanel_1.renderSubscriptionPanel)({ kind: 'subscription', data: { ...data, status: 'suspended' } }, '/dashboard', AUTO_URL);
    assert_1.default.ok(html.includes('>Paused<'));
    assert_1.default.match(html, /PayPal could not collect/);
}
// ── pending change shown ───────────────────────────────────────────────────
assert_1.default.ok((0, subscriptionPanel_1.renderSubscriptionPanel)({ kind: 'subscription', data: { ...data, pendingChange: { requestsAmount: 1000000, price: 380 } } }, '/dashboard', null)
    .includes('1,000,000'), 'shows pending change amount');
// ── no subscription: offer it, or say why not ──────────────────────────────
{
    const html = (0, subscriptionPanel_1.renderSubscriptionPanel)({ kind: 'none', offer: { available: true, message: null }, cycleDays: 30 }, '/dashboard', AUTO_URL);
    assert_1.default.ok(html.includes('>Off<'));
    assert_1.default.ok(html.includes('every 30 days'));
    assert_1.default.ok(html.includes('Turn on auto-renew'));
    assert_1.default.ok(html.includes('href="https://sub.example/?mode=renew&amp;autorenew=1#key=k"'));
    assert_1.default.ok(html.includes('target="_blank"'));
    const blocked = (0, subscriptionPanel_1.renderSubscriptionPanel)({ kind: 'none', offer: { available: false, message: 'Auto-renew includes 4 req/s and this key runs at 8 req/s.' }, cycleDays: 30 }, '/dashboard', AUTO_URL);
    assert_1.default.ok(blocked.includes('Auto-renew includes 4 req/s'));
    assert_1.default.ok(!blocked.includes('Turn on auto-renew'));
    // No checkout to send the customer to: nothing to offer, no panel.
    assert_1.default.strictEqual((0, subscriptionPanel_1.renderSubscriptionPanel)({ kind: 'none', offer: { available: true, message: null }, cycleDays: 30 }, '/dashboard', null), '');
}
// ── parsing what the subscription service answers ─────────────────────────
{
    assert_1.default.deepStrictEqual((0, subscriptionPanel_1.parseSubscriptionStatus)({ success: true, data, autoRenew: { available: false, reason: 'already_active', message: 'x' } }), { kind: 'subscription', data, offer: { available: false, message: 'x' } });
    assert_1.default.deepStrictEqual((0, subscriptionPanel_1.parseSubscriptionStatus)({ success: false, code: 'NO_SUBSCRIPTION', autoRenew: { available: true, reason: null, message: null }, cycleDays: 30 }), { kind: 'none', offer: { available: true, message: null }, cycleDays: 30 });
    // An older service: no code, no offer → nothing to show.
    assert_1.default.strictEqual((0, subscriptionPanel_1.parseSubscriptionStatus)({ success: false, error: 'No subscription found for this API key' }), null);
    // An older service with a subscription: shown, no offer.
    assert_1.default.deepStrictEqual((0, subscriptionPanel_1.parseSubscriptionStatus)({ success: true, data }), { kind: 'subscription', data, offer: null });
    assert_1.default.strictEqual((0, subscriptionPanel_1.parseSubscriptionStatus)({ success: false, code: 'KEY_NOT_FOUND' }), null);
    for (const junk of [null, undefined, 'x', 1, [], { success: true }])
        assert_1.default.strictEqual((0, subscriptionPanel_1.parseSubscriptionStatus)(junk), null, JSON.stringify(junk));
    // Odd cycle values fall back to 30.
    const odd = (0, subscriptionPanel_1.parseSubscriptionStatus)({ success: false, code: 'NO_SUBSCRIPTION', autoRenew: { available: true }, cycleDays: -1 });
    assert_1.default.deepStrictEqual(odd, { kind: 'none', offer: { available: true, message: null }, cycleDays: 30 });
}
console.log('PASS: subscriptionPanel');
