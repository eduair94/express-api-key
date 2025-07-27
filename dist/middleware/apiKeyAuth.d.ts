export interface ApiKeyMiddlewareOptions {
    headerName?: string;
    exposeStatsEndpoint?: boolean;
    statsEndpointPath?: string;
}
export declare function createApiKeyMiddleware(options?: ApiKeyMiddlewareOptions): import("express-serve-static-core").Router;
