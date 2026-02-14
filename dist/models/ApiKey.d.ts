import { Document, Schema } from "mongoose";
export interface IApiKey extends Document {
    key: string;
    role: string;
    createdAt: Date;
    daysValid: number;
    lastUsedAt?: Date;
    requestCountMonth: number;
    requestCountStart?: Date;
    maxMonthlyUsage?: number | null;
    minIntervalSeconds?: number | null;
    expiresAt?: Date | null;
}
export declare const ApiKeySchema: Schema<IApiKey, import("mongoose").Model<IApiKey, any, any, any, Document<unknown, any, IApiKey, any> & IApiKey & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IApiKey, Document<unknown, {}, import("mongoose").FlatRecord<IApiKey>, {}> & import("mongoose").FlatRecord<IApiKey> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
export declare const ApiKeyModel: import("mongoose").Model<IApiKey, {}, {}, {}, Document<unknown, {}, IApiKey, {}> & IApiKey & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
