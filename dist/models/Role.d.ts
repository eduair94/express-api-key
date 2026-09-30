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
export declare const RoleSchema: Schema<IRole, import("mongoose").Model<IRole, any, any, any, any, any, IRole>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IRole, Document<unknown, {}, IRole, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IRole & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<import("mongoose").Types.ObjectId, IRole, Document<unknown, {}, IRole, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IRole & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    name?: import("mongoose").SchemaDefinitionProperty<string, IRole, Document<unknown, {}, IRole, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IRole & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    minIntervalSeconds?: import("mongoose").SchemaDefinitionProperty<number | undefined, IRole, Document<unknown, {}, IRole, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IRole & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    maxMonthlyUsage?: import("mongoose").SchemaDefinitionProperty<number | undefined, IRole, Document<unknown, {}, IRole, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IRole & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    allowedEndpoints?: import("mongoose").SchemaDefinitionProperty<string[] | undefined, IRole, Document<unknown, {}, IRole, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IRole & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    responseLatency?: import("mongoose").SchemaDefinitionProperty<number | undefined, IRole, Document<unknown, {}, IRole, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IRole & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    timeout?: import("mongoose").SchemaDefinitionProperty<number | undefined, IRole, Document<unknown, {}, IRole, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IRole & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    concurrency?: import("mongoose").SchemaDefinitionProperty<number | undefined, IRole, Document<unknown, {}, IRole, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IRole & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    batchLimit?: import("mongoose").SchemaDefinitionProperty<number | undefined, IRole, Document<unknown, {}, IRole, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IRole & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    batchTTL?: import("mongoose").SchemaDefinitionProperty<number | undefined, IRole, Document<unknown, {}, IRole, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IRole & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IRole>;
export declare const RoleModel: import("mongoose").Model<IRole, {}, {}, {}, Document<unknown, {}, IRole, {}, import("mongoose").DefaultSchemaOptions> & IRole & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IRole>;
