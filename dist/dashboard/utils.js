"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDashboardData = computeDashboardData;
/**
 * Computes derived values from raw dashboard data
 */
function computeDashboardData(data) {
    var _a;
    const { key, role, requestCountMonth, requestCountStart, lastUsedAt, keyExpiresAt, roleInfo, daysValid, createdAt, } = data;
    const monthlyCap = (_a = roleInfo === null || roleInfo === void 0 ? void 0 : roleInfo.maxMonthlyUsage) !== null && _a !== void 0 ? _a : 10000;
    const usagePercent = Math.min(100, ((requestCountMonth !== null && requestCountMonth !== void 0 ? requestCountMonth : 0) / monthlyCap) * 100).toFixed(1);
    const remaining = Math.max(0, monthlyCap - (requestCountMonth !== null && requestCountMonth !== void 0 ? requestCountMonth : 0));
    // Calculate renewal days
    let renewalDays = null;
    let renewalDate = null;
    if (requestCountStart) {
        const start = new Date(requestCountStart);
        const renewAt = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
        renewalDate = renewAt.toISOString();
        renewalDays = Math.max(0, Math.ceil((renewAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    }
    // Calculate key expiration days
    let keyExpiresDays = null;
    if (keyExpiresAt && keyExpiresAt !== "Api key not used yet") {
        keyExpiresDays = Math.ceil((new Date(keyExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    }
    // Status indicators
    const usageStatus = Number(usagePercent) >= 90 ? "critical" : Number(usagePercent) >= 70 ? "warning" : "healthy";
    const keyStatus = keyExpiresDays !== null && keyExpiresDays <= 0
        ? "critical"
        : keyExpiresDays !== null && keyExpiresDays <= 7
            ? "warning"
            : "healthy";
    return {
        key,
        role: role || "Standard",
        requestCountMonth: requestCountMonth !== null && requestCountMonth !== void 0 ? requestCountMonth : 0,
        requestCountStart,
        lastUsedAt,
        keyExpiresAt,
        roleInfo,
        daysValid,
        createdAt,
        monthlyCap,
        usagePercent,
        remaining,
        renewalDays,
        renewalDate,
        keyExpiresDays,
        usageStatus,
        keyStatus,
    };
}
