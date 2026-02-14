export interface IApiKey {
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
    save?: () => Promise<void>;
}
export interface IRole {
    name: string;
    minIntervalSeconds?: number;
    maxMonthlyUsage?: number;
}
export interface IApiKeyRoleDatabase {
    findApiKey(key: string): Promise<IApiKey | null>;
    findRole(name: string): Promise<IRole | null>;
}
