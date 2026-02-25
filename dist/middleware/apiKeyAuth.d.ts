import { Mongoose } from "mongoose";
import { IApiKey } from "../models/ApiKey";
export interface ApiKeyMiddlewareOptions {
    headerName?: string;
    exposeStatsEndpoint?: boolean;
    statsEndpointPath?: string;
    countOnly200?: boolean;
    exposeDashboard?: boolean;
    dashboardPath?: string;
    sessionSecret?: string;
    sessionExpiry?: number;
    exposeStatusPage?: boolean;
    statusPagePath?: string;
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
export declare function createRenewalFunction(mongoose: Mongoose): (key: string, options: RenewalOptions) => Promise<(import("mongoose").Document<unknown, {}, IApiKey, {}> & IApiKey & Required<{
    _id: unknown;
}> & {
    __v: number;
}) | null>;
