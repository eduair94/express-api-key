import { Mongoose } from "mongoose";
import { IApiKey } from "../models/ApiKey";
export interface ApiKeyMiddlewareOptions {
    headerName?: string;
    exposeStatsEndpoint?: boolean;
    statsEndpointPath?: string;
    countOnly200?: boolean;
    exposeDashboard?: boolean;
    dashboardPath?: string;
    docsUrl?: string;
    sessionSecret?: string;
    sessionExpiry?: number;
    exposeStatusPage?: boolean;
    statusPagePath?: string;
    /** Enable the customer Subscription panel + manage routes on the dashboard. */
    subscriptionsEnabled?: boolean;
    /** Base URL of the paylix-subscription API (e.g. https://whatsapp-sub.checkleaked.com). */
    subscriptionApiBaseUrl?: string;
    /** Shared secret sent as x-internal-secret to the subscription API. */
    subscriptionInternalSecret?: string;
    /**
     * Checkout page that renews keys (e.g. https://whatsapp-sub.checkleaked.com/).
     * When set, the dashboard shows "Add credits" / "Renew now" links to
     * `<renewUrl>?mode=renew#key=<key>` and, with subscriptionsEnabled, a
     * "Turn on auto-renew" link (`&autorenew=1`). The key travels in the URL
     * fragment, which browsers never send to a server. Unset = no such links.
     */
    renewUrl?: string;
}
export declare function createApiKeyMiddlewareWithConnection(mongoose: Mongoose, options?: ApiKeyMiddlewareOptions): import("express-serve-static-core").Router;
/**
 * Options for renewing an API key's quota and expiration.
 */
export interface RenewalOptions {
    /** Number of requests to ADD to the current per-key maxMonthlyUsage */
    additionalRequests: number;
    /** Days to extend the key's expiration (default: 30) */
    additionalDays?: number;
    /** Whether to reset requestCountMonth to 0 (default: false — only resets automatically if the key is expired) */
    resetUsageCount?: boolean;
}
/**
 * Creates a renewal function bound to a Mongoose connection.
 * The returned function can be called from external services (e.g. payment webhook handlers)
 * to safely extend a key's quota and expiration.
 *
 * @example
 * ```ts
 * const renewApiKey = createRenewalFunction(mongoose);
 *
 * // In a payment webhook handler:
 * const renewed = await renewApiKey('user-api-key-here', {
 *   additionalRequests: 500000,
 *   additionalDays: 30,
 * });
 * ```
 */
export declare function createRenewalFunction(mongoose: Mongoose): (key: string, options: RenewalOptions) => Promise<(import("mongoose").Document<unknown, {}, IApiKey, {}, import("mongoose").DefaultSchemaOptions> & IApiKey & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | null>;
