/**
 * Dashboard data types for API Key statistics
 */
export interface DashboardData {
    key: string;
    role: string | null;
    requestCountMonth: number | null;
    requestCountStart: Date | null;
    lastUsedAt: Date | null;
    keyExpiresAt: Date | string | null;
    roleInfo: RoleInfo | null;
    daysValid: number | null;
    createdAt: Date | null;
}
export interface RoleInfo {
    name: string;
    maxMonthlyUsage?: number;
    minIntervalSeconds?: number;
    allowedEndpoints?: string[];
    [key: string]: any;
}
export interface ComputedDashboardData {
    key: string;
    role: string;
    requestCountMonth: number;
    requestCountStart: Date | null;
    lastUsedAt: Date | null;
    keyExpiresAt: Date | string | null;
    roleInfo: RoleInfo | null;
    daysValid: number | null;
    createdAt: Date | null;
    monthlyCap: number;
    usagePercent: string;
    remaining: number;
    renewalDays: number | null;
    renewalDate: string | null;
    keyExpiresDays: number | null;
    usageStatus: 'healthy' | 'warning' | 'critical';
    keyStatus: 'healthy' | 'warning' | 'critical';
}
