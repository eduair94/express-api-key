import { Mongoose } from "mongoose";
export interface ApiKeyMiddlewareOptions {
    headerName?: string;
    exposeStatsEndpoint?: boolean;
    statsEndpointPath?: string;
    countOnly200?: boolean;
    exposeDashboard?: boolean;
    dashboardPath?: string;
    sessionSecret?: string;
    sessionExpiry?: number;
}
export declare function createApiKeyMiddlewareWithConnection(mongoose: Mongoose, options?: ApiKeyMiddlewareOptions): import("express-serve-static-core").Router;
