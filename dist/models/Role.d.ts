import { Document } from "mongoose";
export interface IRole extends Document {
    name: string;
    minIntervalSeconds?: number;
    maxMonthlyUsage?: number;
}
export declare const RoleModel: import("mongoose").Model<IRole, {}, {}, {}, Document<unknown, {}, IRole, {}> & IRole & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
