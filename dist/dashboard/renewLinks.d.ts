/**
 * Links from the dashboard to the checkout that renews the key on show.
 *
 * Contract with the checkout (paylix-subscription's portal): `?mode=renew`
 * opens it in renewal mode, `&autorenew=1` switches PayPal auto-renew on, and
 * the key is taken from the URL fragment (`#key=…`). A fragment is never sent
 * to a server — not to the checkout's, not in a Referer header — and the
 * checkout removes it from the address bar as it loads.
 */
export interface RenewLinkOptions {
    /** Ask the checkout to switch auto-renew on. */
    autoRenew?: boolean;
    /** Where the visit came from, for the checkout's analytics (default "dashboard"). */
    src?: string;
}
/**
 * The checkout URL for renewing `key`, or null when there is no usable
 * checkout URL (unset, malformed, or not http/https) or no key — the caller
 * then shows no link rather than a broken one.
 */
export declare function buildRenewUrl(renewUrl: string | null | undefined, key: string, opts?: RenewLinkOptions): string | null;
