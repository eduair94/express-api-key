import type { Request, Response } from 'express'
import type { Model } from 'mongoose'

export const USAGE_ACCOUNTING_RETENTION_DAYS = 90
const DAY_MS = 86_400_000
const CATEGORY = /^[a-z][a-z0-9_-]{0,31}$/

/** Server-owned labels only: never configure customer or request identifiers. */
export interface UsageAccountingOptions {
  categories: readonly string[]
  /** Synchronous classifier; an absent, invalid or throwing result becomes unknown. */
  category?: (req: Request, res: Response) => unknown
}

export interface UsageAccountingDay {
  day: string
  debitedCredits: number
  categories: Record<string, number>
}

/** Internal accounting, excluded from normal queries and document serialization. */
export interface UsageAccountingRecord {
  version: 1
  totalDebitedCredits: number
  firstRecordedDay: string
  lastRecordedDay: string
  /** A clock rollback must not overwrite a newer day occupying the same slot. */
  outOfWindowDebits: number
  /** Slot = UTC epoch day modulo 90. Filter by day when reporting a window. */
  daily: Record<string, UsageAccountingDay>
}

export interface UsageAccountingConfig {
  categories: readonly string[]
  category?: UsageAccountingOptions['category']
}

export function configureUsageAccounting(
  options: UsageAccountingOptions | undefined,
): UsageAccountingConfig | undefined {
  if (options === undefined) return undefined
  if (!options || typeof options !== 'object' || !Array.isArray(options.categories) ||
      options.categories.length > 31 ||
      options.categories.some((name) => typeof name !== 'string' || !CATEGORY.test(name)) ||
      (options.category !== undefined && typeof options.category !== 'function')) {
    throw new Error('usageAccounting requires at most 31 fixed categories and an optional synchronous classifier')
  }
  const categories = Object.freeze([...new Set([...options.categories, 'unknown'])])
  return Object.freeze({ categories, category: options.category })
}

export function usageCategory(config: UsageAccountingConfig, req: Request, res: Response): string {
  try {
    const value = config.category?.(req, res)
    if (typeof value === 'string' && config.categories.includes(value)) return value
    // A mistaken async classifier cannot create an unhandled rejection.
    if (value && typeof (value as PromiseLike<unknown>).then === 'function') {
      void Promise.resolve(value).catch(() => {})
    }
  } catch {
    // Never log a request, a returned value or the classifier's exception.
  }
  return 'unknown'
}

const objectOrEmpty = (value: string) => ({
  $cond: [{ $eq: [{ $type: value }, 'object'] }, value, {}],
})
const nonNegativeCounter = (value: string) => ({
  $cond: [{ $and: [{ $isNumber: value }, { $gte: [value, 0] }] }, value, 0],
})

/**
 * MongoDB 4.2+ expressions only. All increments read the current document,
 * including under concurrent calls; there is no read/modify/write in JS.
 */
export function usageDebitPipeline(
  config: UsageAccountingConfig,
  category: string,
  completedAt: Date,
): Record<string, unknown>[] {
  const time = completedAt.getTime()
  if (!Number.isFinite(time) || completedAt.getUTCFullYear() < 0 || completedAt.getUTCFullYear() > 9999) {
    throw new Error('Invalid usage accounting date')
  }
  const day = completedAt.toISOString().slice(0, 10)
  const epochDay = Math.floor(time / DAY_MS)
  const slot = String(((epochDay % USAGE_ACCOUNTING_RETENTION_DAYS) + USAGE_ACCOUNTING_RETENTION_DAYS) % USAGE_ACCOUNTING_RETENTION_DAYS)
  const field = '$usageAccounting'
  const bucket = `${field}.daily.${slot}`
  const sameDay = { $eq: [`${bucket}.day`, day] }
  const newerSlot = { $gt: [{ $ifNull: [`${bucket}.day`, ''] }, day] }
  const chosen = config.categories.includes(category) ? category : 'unknown'
  const namedCategories = config.categories.filter((name) => name !== 'unknown')
  const previousCategories = {
    $cond: [sameDay, { $objectToArray: objectOrEmpty(`${bucket}.categories`) }, []],
  }
  // Retired labels fold into unknown. Even configuration changes cannot grow
  // a bucket beyond the configured labels plus unknown, or lose its total.
  const categories = {
    $arrayToObject: {
      $filter: {
        input: config.categories.map((name) => ({
          k: name,
          v: {
            $add: [
              {
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: previousCategories,
                        as: 'entry',
                        cond: name === 'unknown'
                          ? { $not: [{ $in: ['$$entry.k', namedCategories] }] }
                          : { $eq: ['$$entry.k', name] },
                      },
                    },
                    as: 'entry',
                    in: nonNegativeCounter('$$entry.v'),
                  },
                },
              },
              name === chosen ? 1 : 0,
            ],
          },
        })),
        as: 'entry',
        cond: { $gt: ['$$entry.v', 0] },
      },
    },
  }
  const daily = {
    $arrayToObject: {
      $filter: {
        input: { $objectToArray: objectOrEmpty(`${field}.daily`) },
        as: 'entry',
        cond: { $in: ['$$entry.k', Array.from({ length: USAGE_ACCOUNTING_RETENTION_DAYS }, (_, i) => String(i))] },
      },
    },
  }
  return [{
    $set: {
      // Match $inc: a missing counter starts at zero; null/non-numeric values
      // still fail the whole write instead of silently repairing billing.
      requestCountMonth: {
        $add: [{
          $cond: [
            { $eq: [{ $type: '$requestCountMonth' }, 'missing'] },
            0,
            { $cond: [{ $isNumber: '$requestCountMonth' }, '$requestCountMonth', 'invalid-counter'] },
          ],
        }, 1],
      },
      usageAccounting: {
        version: 1,
        totalDebitedCredits: { $add: [nonNegativeCounter(`${field}.totalDebitedCredits`), 1] },
        firstRecordedDay: { $ifNull: [`${field}.firstRecordedDay`, day] },
        lastRecordedDay: { $max: [{ $ifNull: [`${field}.lastRecordedDay`, day] }, day] },
        outOfWindowDebits: { $add: [nonNegativeCounter(`${field}.outOfWindowDebits`), { $cond: [newerSlot, 1, 0] }] },
        daily: {
          $mergeObjects: [daily, {
            [slot]: {
              $cond: [newerSlot, bucket, {
                day,
                debitedCredits: { $add: [{ $cond: [sameDay, nonNegativeCounter(`${bucket}.debitedCredits`), 0] }, 1] },
                categories,
              }],
            },
          }],
        },
      },
    },
  }]
}

export type DebitWriteOutcome = 'confirmed' | 'not_applied' | 'unacknowledged' | 'failed'

/** One attempt only. A lost acknowledgement must never trigger another debit. */
export async function persistUsageDebit(
  model: Model<any>,
  key: string,
  config: UsageAccountingConfig | undefined,
  category: string,
  completedAt: Date,
): Promise<DebitWriteOutcome> {
  try {
    const result = config
      ? await model.updateOne({ key }, usageDebitPipeline(config, category, completedAt), { updatePipeline: true })
      : await model.updateOne({ key }, { $inc: { requestCountMonth: 1 } })
    if (!result.acknowledged) return 'unacknowledged'
    return result.matchedCount === 1 && result.modifiedCount === 1 ? 'confirmed' : 'not_applied'
  } catch {
    return 'failed'
  }
}
