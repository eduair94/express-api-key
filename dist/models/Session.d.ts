import { Document, Schema } from 'mongoose';
export interface ISession extends Document {
    token: string;
    apiKey: string;
    createdAt: Date;
    expiresAt: Date;
}
export declare const SessionSchema: Schema<ISession, import("mongoose").Model<ISession, any, any, any, any, any, ISession>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ISession, Document<unknown, {}, ISession, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<ISession & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<import("mongoose").Types.ObjectId, ISession, Document<unknown, {}, ISession, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ISession & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    token?: import("mongoose").SchemaDefinitionProperty<string, ISession, Document<unknown, {}, ISession, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ISession & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    apiKey?: import("mongoose").SchemaDefinitionProperty<string, ISession, Document<unknown, {}, ISession, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ISession & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    createdAt?: import("mongoose").SchemaDefinitionProperty<Date, ISession, Document<unknown, {}, ISession, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ISession & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    expiresAt?: import("mongoose").SchemaDefinitionProperty<Date, ISession, Document<unknown, {}, ISession, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ISession & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, ISession>;
