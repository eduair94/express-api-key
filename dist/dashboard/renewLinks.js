"use strict";
/**
 * Links from the dashboard to the checkout that renews the key on show.
 *
 * Contract with the checkout (paylix-subscription's portal): `?mode=renew`
 * opens it in renewal mode, `&autorenew=1` switches PayPal auto-renew on, and
 * the key is taken from the URL fragment (`#key=…`). A fragment is never sent
 * to a server — not to the checkout's, not in a Referer header — and the
 * checkout removes it from the address bar as it loads.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRenewUrl = buildRenewUrl;
/**
 * The checkout URL for renewing `key`, or null when there is no usable
 * checkout URL (unset, malformed, or not http/https) or no key — the caller
 * then shows no link rather than a broken one.
 */
function buildRenewUrl(renewUrl, key, opts = {}) {
    if (typeof renewUrl !== 'string' || !renewUrl.trim() || !key)
        return null;
    let url;
    try {
        url = new URL(renewUrl.trim());
    }
    catch (_a) {
        return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:')
        return null;
    url.searchParams.set('mode', 'renew');
    if (opts.autoRenew)
        url.searchParams.set('autorenew', '1');
    url.searchParams.set('src', opts.src || 'dashboard');
    url.hash = `key=${encodeURIComponent(key)}`;
    return url.toString();
}
