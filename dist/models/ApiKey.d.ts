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
export declare const ApiKeySchema: Schema<IApiKey, import("mongoose").Model<IApiKey, any, any, any, any, any, IApiKey>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IApiKey, Document<unknown, {}, IApiKey, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IApiKey & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<import("mongoose").Types.ObjectId, IApiKey, Document<unknown, {}, IApiKey, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IApiKey & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    key?: import("mongoose").SchemaDefinitionProperty<string, IApiKey, Document<unknown, {}, IApiKey, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IApiKey & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    role?: import("mongoose").SchemaDefinitionProperty<string, IApiKey, Document<unknown, {}, IApiKey, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IApiKey & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    createdAt?: import("mongoose").SchemaDefinitionProperty<Date, IApiKey, Document<unknown, {}, IApiKey, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IApiKey & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    daysValid?: import("mongoose").SchemaDefinitionProperty<number, IApiKey, Document<unknown, {}, IApiKey, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IApiKey & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    lastUsedAt?: import("mongoose").SchemaDefinitionProperty<Date | undefined, IApiKey, Document<unknown, {}, IApiKey, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IApiKey & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    requestCountMonth?: import("mongoose").SchemaDefinitionProperty<number, IApiKey, Document<unknown, {}, IApiKey, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IApiKey & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    requestCountStart?: import("mongoose").SchemaDefinitionProperty<Date | undefined, IApiKey, Document<unknown, {}, IApiKey, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IApiKey & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    maxMonthlyUsage?: import("mongoose").SchemaDefinitionProperty<number | null | undefined, IApiKey, Document<unknown, {}, IApiKey, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IApiKey & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    minIntervalSeconds?: import("mongoose").SchemaDefinitionProperty<number | null | undefined, IApiKey, Document<unknown, {}, IApiKey, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IApiKey & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    expiresAt?: import("mongoose").SchemaDefinitionProperty<Date | null | undefined, IApiKey, Document<unknown, {}, IApiKey, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IApiKey & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IApiKey>;
export declare const ApiKeyModel: import("mongoose").Model<IApiKey, {}, {}, {}, Document<unknown, {}, IApiKey, {}, import("mongoose").DefaultSchemaOptions> & IApiKey & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IApiKey>;
