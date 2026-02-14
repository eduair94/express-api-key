import { Document, Schema } from 'mongoose';
export interface ISession extends Document {
    token: string;
    apiKey: string;
    createdAt: Date;
    expiresAt: Date;
}
export declare const SessionSchema: Schema<ISession, import("mongoose").Model<ISession, any, any, any, Document<unknown, any, ISession, any> & ISession & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ISession, Document<unknown, {}, import("mongoose").FlatRecord<ISession>, {}> & import("mongoose").FlatRecord<ISession> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
