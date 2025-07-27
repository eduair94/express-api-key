import { Mongoose } from "mongoose";
export interface ApiKeyMiddlewareOptions {
    headerName?: string;
    exposeStatsEndpoint?: boolean;
    statsEndpointPath?: string;
}
export declare function createApiKeyMiddlewareWithConnection(mongoose: Mongoose, options?: ApiKeyMiddlewareOptions): import("express-serve-static-core").Router;
