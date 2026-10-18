"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const renewLinks_1 = require("./renewLinks");
const KEY = `wapi_${'ab'.repeat(32)}`;
const keyOf = (url) => new URLSearchParams(new URL(url).hash.slice(1)).get('key');
// The key rides in the fragment only: browsers never send it to a server.
{
    const url = (0, renewLinks_1.buildRenewUrl)('https://whatsapp-sub.checkleaked.com/', KEY);
    assert_1.default.ok(url);
    const u = new URL(url);
    assert_1.default.strictEqual(`${u.origin}${u.pathname}`, 'https://whatsapp-sub.checkleaked.com/');
    assert_1.default.strictEqual(u.searchParams.get('mode'), 'renew');
    assert_1.default.strictEqual(u.searchParams.get('src'), 'dashboard');
    assert_1.default.strictEqual(u.searchParams.get('autorenew'), null);
    assert_1.default.ok(!u.search.includes(KEY), 'never in the query string');
    assert_1.default.strictEqual(keyOf(url), KEY);
}
// The auto-renew call to action, on a checkout URL with its own query.
{
    const url = (0, renewLinks_1.buildRenewUrl)('https://x.example/checkout?lang=es', KEY, {
        autoRenew: true,
        src: 'dashboard_autorenew',
    });
    const u = new URL(url);
    assert_1.default.strictEqual(u.pathname, '/checkout');
    assert_1.default.strictEqual(u.searchParams.get('lang'), 'es', 'keeps the configured query');
    assert_1.default.strictEqual(u.searchParams.get('mode'), 'renew');
    assert_1.default.strictEqual(u.searchParams.get('autorenew'), '1');
    assert_1.default.strictEqual(u.searchParams.get('src'), 'dashboard_autorenew');
    assert_1.default.strictEqual(keyOf(url), KEY);
}
// Characters that mean something in a URL survive the round trip.
assert_1.default.strictEqual(keyOf((0, renewLinks_1.buildRenewUrl)('https://x.example/', 'a&b=c#d+e')), 'a&b=c#d+e');
// A fragment already on the configured URL is replaced, not appended to.
assert_1.default.strictEqual(keyOf((0, renewLinks_1.buildRenewUrl)('https://x.example/#pricing', KEY)), KEY);
assert_1.default.ok(!(0, renewLinks_1.buildRenewUrl)('https://x.example/#pricing', KEY).includes('pricing'));
// No usable checkout URL (or no key): no link at all rather than a broken one.
for (const bad of ['', '   ', 'javascript:alert(1)', 'ftp://x.example/', 'not a url', undefined, null]) {
    assert_1.default.strictEqual((0, renewLinks_1.buildRenewUrl)(bad, KEY), null, String(bad));
}
assert_1.default.strictEqual((0, renewLinks_1.buildRenewUrl)('https://x.example/', ''), null);
console.log('PASS: renewLinks');
