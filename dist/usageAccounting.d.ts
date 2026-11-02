import type { Request, Response } from 'express';
import type { Model } from 'mongoose';
export declare const USAGE_ACCOUNTING_RETENTION_DAYS = 90;
/** Server-owned labels only: never configure customer or request identifiers. */
export interface UsageAccountingOptions {
    categories: readonly string[];
    /** Synchronous classifier; an absent, invalid or throwing result becomes unknown. */
    category?: (req: Request, res: Response) => unknown;
}
export interface UsageAccountingDay {
    day: string;
    debitedCredits: number;
    categories: Record<string, number>;
}
/** Internal accounting, excluded from normal queries and document serialization. */
export interface UsageAccountingRecord {
    version: 1;
    totalDebitedCredits: number;
    firstRecordedDay: string;
    lastRecordedDay: string;
    /** A clock rollback must not overwrite a newer day occupying the same slot. */
    outOfWindowDebits: number;
    /** Slot = UTC epoch day modulo 90. Filter by day when reporting a window. */
    daily: Record<string, UsageAccountingDay>;
}
export interface UsageAccountingConfig {
    categories: readonly string[];
    category?: UsageAccountingOptions['category'];
}
export declare function configureUsageAccounting(options: UsageAccountingOptions | undefined): UsageAccountingConfig | undefined;
export declare function usageCategory(config: UsageAccountingConfig, req: Request, res: Response): string;
/**
 * MongoDB 4.2+ expressions only. All increments read the current document,
 * including under concurrent calls; there is no read/modify/write in JS.
 */
export declare function usageDebitPipeline(config: UsageAccountingConfig, category: string, completedAt: Date): Record<string, unknown>[];
export type DebitWriteOutcome = 'confirmed' | 'not_applied' | 'unacknowledged' | 'failed';
/** One attempt only. A lost acknowledgement must never trigger another debit. */
export declare function persistUsageDebit(model: Model<any>, key: string, config: UsageAccountingConfig | undefined, category: string, completedAt: Date): Promise<DebitWriteOutcome>;
