import { Document, Schema } from "mongoose";
export interface IRole extends Document {
    name: string;
    minIntervalSeconds?: number;
    maxMonthlyUsage?: number;
    allowedEndpoints?: string[];
    /** Maximum response latency in milliseconds (informational, displayed on status page) */
    responseLatency?: number;
    /** Request timeout in seconds */
    timeout?: number;
    /** Maximum concurrent requests allowed */
    concurrency?: number;
    /** Maximum number of items per batch request */
    batchLimit?: number;
    /** Time-to-live for batch requests in seconds */
    batchTTL?: number;
}
export declare const RoleSchema: Schema<IRole, import("mongoose").Model<IRole, any, any, any, Document<unknown, any, IRole, any> & IRole & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IRole, Document<unknown, {}, import("mongoose").FlatRecord<IRole>, {}> & import("mongoose").FlatRecord<IRole> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
export declare const RoleModel: import("mongoose").Model<IRole, {}, {}, {}, Document<unknown, {}, IRole, {}> & IRole & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
