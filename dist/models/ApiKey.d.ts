import { Document } from "mongoose";
export interface IApiKey extends Document {
    key: string;
    role: string;
    createdAt: Date;
    daysValid: number;
    lastUsedAt?: Date;
    requestCountMonth: number;
    requestCountStart?: Date;
}
export declare const ApiKeyModel: import("mongoose").Model<IApiKey, {}, {}, {}, Document<unknown, {}, IApiKey, {}> & IApiKey & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
