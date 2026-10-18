/**
 * Pure renderer for the dashboard's "Auto-renew" section (PayPal
 * subscriptions sold by the subscription service). No IO: the middleware
 * fetches the status, `parseSubscriptionStatus` reads it, this draws it.
 */
export interface SubscriptionPanelData {
    subscriptionId: string;
    status: 'pending' | 'active' | 'cancelled' | 'suspended' | 'expired';
    requestsAmount: number;
    price: number;
    balance: number;
    capTotal: number;
    used: number;
    currentPeriodEnd: string | null;
    graceEndsAt: string | null;
    pendingChange: {
        requestsAmount: number;
        price: number;
    } | null;
    expiresAt: string | null;
}
/** Whether a new auto-renew can be started on the key, and if not, why. */
export interface AutoRenewOffer {
    available: boolean;
    /** Customer-facing reason when unavailable. */
    message: string | null;
}
export type SubscriptionPanelInput = {
    kind: 'subscription';
    data: SubscriptionPanelData;
    offer?: AutoRenewOffer | null;
} | {
    kind: 'none';
    offer: AutoRenewOffer;
    cycleDays: number;
};
/**
 * What the subscription service's `GET /api/subscription/status` answered:
 * a subscription (`success` + `data`), none (`code: NO_SUBSCRIPTION` with the
 * offer), or nothing to show (unknown key, an error, an older service that
 * cannot say whether auto-renew is possible).
 */
export declare function parseSubscriptionStatus(json: unknown): SubscriptionPanelInput | null;
/**
 * The section's HTML, or '' when there is nothing to show. `autoRenewUrl`
 * is the checkout link that starts auto-renew for this key (null when no
 * checkout is configured: then a key without a subscription shows nothing).
 */
export declare function renderSubscriptionPanel(input: SubscriptionPanelInput | null, dashboardPath: string, autoRenewUrl: string | null): string;
