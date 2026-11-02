/** Local MongoDB only. No production connection, external request or API checks. */
import assert from 'node:assert/strict'
import express from 'express'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import type { Model } from 'mongoose'
import {
  configureUsageAccounting, persistUsageDebit, usageCategory, usageDebitPipeline,
  UsageAccountingRecord,
} from './usageAccounting'

// Run the same real-Mongo tests with the oldest supported Mongoose 8 and 9.
// Load the chosen version before the library's schemas are created.
const mongoose: typeof import('mongoose') = require(process.argv.includes('--mongoose8') ? 'mongoose8' : 'mongoose')
if (process.argv.includes('--mongoose8')) {
  require.cache[require.resolve('mongoose')] = require.cache[require.resolve('mongoose8')]
}
const { createApiKeyMiddlewareWithConnection, createRenewalFunction } = require('./middleware/apiKeyAuth') as typeof import('./middleware/apiKeyAuth')

const DAY = 86_400_000
const AT = new Date('2026-11-02T12:00:00Z')
const SENTINEL = 'fictional-private-regression-sentinel'
const config = configureUsageAccounting({ categories: ['number', 'bulk'] })!
const dayBucket = (record: UsageAccountingRecord, day: string) => Object.values(record.daily).find((bucket) => bucket.day === day)

async function main() {
  assert.equal(configureUsageAccounting(undefined), undefined)
  for (const invalid of [null, true, {}, { categories: 'number' }, { categories: Array(32).fill('a') },
    { categories: ['phone.123'] }, { categories: ['123'] }, { categories: ['$field'] },
    { categories: ['a'.repeat(33)] }, { categories: ['name@example.test'] },
    { categories: [], category: 'not-a-function' }]) {
    assert.throws(() => configureUsageAccounting(invalid as any), /usageAccounting requires/)
  }
  const labels = ['number']
  const copied = configureUsageAccounting({ categories: labels })!
  labels.push('unexpected')
  assert.deepEqual(copied.categories, ['number', 'unknown'])
  for (const result of [SENTINEL, 123, {}, null, undefined]) {
    assert.equal(usageCategory(configureUsageAccounting({ categories: ['number'], category: () => result })!, {} as any, {} as any), 'unknown')
  }
  assert.equal(usageCategory(configureUsageAccounting({ categories: [], category: () => { throw new Error(SENTINEL) } })!, {} as any, {} as any), 'unknown')
  assert.equal(usageCategory(configureUsageAccounting({ categories: [], category: () => Promise.reject(new Error(SENTINEL)) })!, {} as any, {} as any), 'unknown')
  assert.throws(() => usageDebitPipeline(config, 'number', new Date(NaN)), /Invalid usage/)

  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { ip: '127.0.0.1' } })
  const connection = new mongoose.Mongoose()
  const warnings: string[] = []
  const oldWarn = console.warn
  console.warn = (...args) => { warnings.push(args.map(String).join(' ')) }
  try {
    assert.match(mongo.getUri(), /^mongodb:\/\/127\.0\.0\.1:/)
    await connection.connect(mongo.getUri(), { dbName: 'usage_accounting_test' })
    const app = express()
    app.use(createApiKeyMiddlewareWithConnection(connection, {
      exposeStatsEndpoint: true,
      exposeDashboard: true,
      sessionSecret: 'usage-test-session-secret',
      usageAccounting: { categories: ['number', 'bulk'], category: (req) => req.path === '/bulk' ? 'bulk' : 'number' },
    }))
    app.get('/status/:code', (req, res) => res.status(Number(req.params.code)).end())
    app.post('/bulk', (_req, res) => res.json({ results: Array(1000).fill({ exists: true }) }))
    app.get('/doc', (req, res) => res.json((req as any).apiKeyDoc))
    app.get('/abort', (_req, res) => res.destroy())
    const model = connection.models.ApiKey as Model<any>
    await model.init()
    await connection.models.Role.create({ name: 'paid', maxMonthlyUsage: 10000, minIntervalSeconds: 0 })
    const seed = async (key: string, fields: Record<string, unknown> = {}) => {
      await model.create({ key, role: 'paid', requestCountMonth: 0, requestCountStart: new Date(),
        expiresAt: new Date(Date.now() + 365 * DAY), maxMonthlyUsage: 1_000_000, minIntervalSeconds: 0, ...fields })
    }
    const read = async (key: string) => (await model.collection.findOne({ key }))!
    const debit = (key: string, label = 'number', at = AT) => persistUsageDebit(model, key, config, label, at)

    // Same-document increments survive concurrent writes without lost counts.
    await seed('usage-concurrent')
    assert.ok((await Promise.all(Array.from({ length: 80 }, (_, i) => debit('usage-concurrent', i % 2 ? 'number' : 'bulk')))).every((result) => result === 'confirmed'))
    let stored = await read('usage-concurrent')
    assert.equal(stored.requestCountMonth, 80)
    assert.equal(stored.usageAccounting.totalDebitedCredits, 80)
    assert.deepEqual(dayBucket(stored.usageAccounting, '2026-11-02')?.categories, { number: 40, bulk: 40 })

    // First-use/monthly resets and explicit renewals affect quota only.
    await model.updateOne({ key: 'usage-concurrent' }, { $set: { requestCountMonth: 0, requestCountStart: new Date() } })
    await debit('usage-concurrent')
    assert.equal((await read('usage-concurrent')).usageAccounting.totalDebitedCredits, 81)
    const renew = createRenewalFunction(connection)
    await renew('usage-concurrent', { additionalRequests: 10, resetUsageCount: true })
    assert.equal((await read('usage-concurrent')).requestCountMonth, 0)
    await Promise.all([
      ...Array.from({ length: 30 }, () => debit('usage-concurrent')),
      renew('usage-concurrent', { additionalRequests: 10, resetUsageCount: true }),
    ])
    stored = await read('usage-concurrent')
    assert.equal(stored.usageAccounting.totalDebitedCredits, 111)
    assert.equal(dayBucket(stored.usageAccounting, '2026-11-02')?.debitedCredits, 111)

    // Ring rollover, UTC midnight and a clock rollback cannot erase newer data.
    await seed('usage-ring')
    for (let i = 0; i < 181; i++) await debit('usage-ring', 'number', new Date(AT.getTime() + i * DAY))
    stored = await read('usage-ring')
    assert.equal(stored.usageAccounting.totalDebitedCredits, 181)
    assert.equal(Object.keys(stored.usageAccounting.daily).length, 90)
    assert.equal(Object.values(stored.usageAccounting.daily).reduce((sum: number, bucket: any) => sum + bucket.debitedCredits, 0), 90)
    assert.equal(dayBucket(stored.usageAccounting, '2026-11-02'), undefined)
    const ringBefore = stored.usageAccounting.daily
    await debit('usage-ring', 'number', AT)
    stored = await read('usage-ring')
    assert.equal(stored.usageAccounting.totalDebitedCredits, 182)
    assert.equal(stored.usageAccounting.outOfWindowDebits, 1)
    assert.deepEqual(stored.usageAccounting.daily, ringBefore)
    await seed('usage-midnight')
    await debit('usage-midnight', 'number', new Date('2026-11-02T23:59:59.999Z'))
    await debit('usage-midnight', 'bulk', new Date('2026-11-03T00:00:00.000Z'))
    assert.equal(Object.keys((await read('usage-midnight')).usageAccounting.daily).length, 2)

    // Changing the allowlist remains bounded; retired counts become unknown.
    const oldCategories = Array.from({ length: 31 }, (_, i) => `old_${i}`)
    const fullConfig = configureUsageAccounting({ categories: oldCategories })!
    await seed('usage-categories')
    await Promise.all([...oldCategories, 'unknown'].map((category) => persistUsageDebit(model, 'usage-categories', fullConfig, category, AT)))
    await debit('usage-categories', SENTINEL)
    stored = await read('usage-categories')
    assert.deepEqual(dayBucket(stored.usageAccounting, '2026-11-02')?.categories, { unknown: 33 })
    assert.equal(stored.usageAccounting.totalDebitedCredits, 33)
    assert.ok(!JSON.stringify(stored.usageAccounting).includes(SENTINEL))

    // Worst-case bounded fixture: 90 buckets × 32 long labels, not one row per call.
    const maximumCategories = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`category_${i}_`.padEnd(32, 'x'), Number.MAX_SAFE_INTEGER]))
    maximumCategories.unknown = Number.MAX_SAFE_INTEGER
    const maximumRecord = { version: 1, totalDebitedCredits: 1, firstRecordedDay: '2026-01-01',
      lastRecordedDay: '2026-11-02', outOfWindowDebits: 0,
      daily: Object.fromEntries(Array.from({ length: 90 }, (_, i) => [String(i), {
        day: '2026-11-02', debitedCredits: 1, categories: maximumCategories,
      }])) }
    const accountingBytes = mongoose.mongo.BSON.calculateObjectSize(maximumRecord)
    assert.ok(accountingBytes < 256 * 1024, `accounting field is bounded: ${accountingBytes}`)

    // No new billing rule for absent/null/date/string counters.
    for (const [label, value] of [['null', null], ['date', new Date()], ['text', '7']] as const) {
      const key = `usage-invalid-${label}`
      await model.collection.insertOne({ key, role: 'paid', requestCountMonth: value })
      assert.equal(await debit(key), 'failed')
      assert.equal(await persistUsageDebit(model, key, undefined, 'unknown', AT), 'failed')
      assert.equal((await read(key)).usageAccounting, undefined)
    }
    await model.collection.insertOne({ key: 'usage-missing-counter', role: 'paid' })
    assert.equal(await debit('usage-missing-counter'), 'confirmed')
    assert.equal((await read('usage-missing-counter')).requestCountMonth, 1)
    assert.equal(await debit('usage-nonexistent'), 'not_applied')

    // A committed write whose acknowledgement is lost is never retried.
    await seed('usage-lost-ack')
    let calls = 0
    const lostAck = { updateOne: async (...args: any[]) => {
      calls++
      await (model.updateOne as any)(...args)
      throw new Error(SENTINEL)
    } } as unknown as Model<any>
    assert.equal(await persistUsageDebit(lostAck, 'usage-lost-ack', config, 'number', AT), 'failed')
    assert.equal(calls, 1)
    stored = await read('usage-lost-ack')
    assert.equal(stored.requestCountMonth, 1)
    assert.equal(stored.usageAccounting.totalDebitedCredits, 1)
    for (const [result, outcome] of [
      [{ acknowledged: false }, 'unacknowledged'],
      [{ acknowledged: true, matchedCount: 0, modifiedCount: 0 }, 'not_applied'],
    ] as const) {
      let attempts = 0
      const fake = { updateOne: async () => { attempts++; return result } } as unknown as Model<any>
      assert.equal(await persistUsageDebit(fake, 'fixture-key', config, 'number', AT), outcome)
      assert.equal(attempts, 1)
    }

    // Await the asynchronous finish write in HTTP tests, without changing response timing.
    const writes: Promise<unknown>[] = []
    const updateOne = model.updateOne.bind(model)
    model.updateOne = ((...args: any[]) => {
      const write = (updateOne as any)(...args).exec()
      writes.push(write)
      return write
    }) as any
    const drain = async () => {
      await new Promise<void>((resolve) => setImmediate(resolve))
      await Promise.allSettled(writes.splice(0))
    }
    const get = async (key: string, code: number) => {
      const response = await request(app).get(`/status/${code}`).set('x-api-key', key)
      await drain()
      return response
    }
    await seed('usage-statuses')
    for (const code of [200, 201, 204, 302, 400, 403, 404, 429, 500, 503]) {
      assert.equal((await get('usage-statuses', code)).status, code)
    }
    stored = await read('usage-statuses')
    assert.equal(stored.requestCountMonth, 1)
    assert.equal(stored.usageAccounting.totalDebitedCredits, 1)
    // Retrying the HTTP call is another request under existing billing rules.
    await get('usage-statuses', 200)
    assert.equal((await read('usage-statuses')).usageAccounting.totalDebitedCredits, 2)
    await request(app).post('/bulk').set('x-api-key', 'usage-statuses').send({ count: 1000 }).expect(200)
    await drain()
    stored = await read('usage-statuses')
    assert.equal(stored.requestCountMonth, 3, 'a bulk response still costs one credit')
    assert.equal(dayBucket(stored.usageAccounting, new Date().toISOString().slice(0, 10))?.categories.bulk, 1)

    const allStatuses = express()
    allStatuses.use(createApiKeyMiddlewareWithConnection(connection, { countOnly200: false, usageAccounting: { categories: [] } }))
    allStatuses.get('/status/:code', (req, res) => res.status(Number(req.params.code)).end())
    await seed('usage-all-statuses')
    for (const code of [200, 201, 204, 302, 400, 403, 404, 429, 500, 503]) {
      await request(allStatuses).get(`/status/${code}`).set('x-api-key', 'usage-all-statuses').expect(code)
      await drain()
    }
    assert.equal((await read('usage-all-statuses')).usageAccounting.totalDebitedCredits, 10)

    // Missing/expired/spent keys and aborted responses never reach a debit.
    await request(app).get('/status/200').expect(401)
    await request(app).get('/status/200').set('x-api-key', 'not-a-key').expect(401)
    await seed('usage-expired', { expiresAt: new Date(Date.now() - DAY) })
    await get('usage-expired', 200).then((response) => assert.equal(response.status, 401))
    await seed('usage-spent', { requestCountMonth: 1, maxMonthlyUsage: 1 })
    await get('usage-spent', 200).then((response) => assert.equal(response.status, 429))
    await seed('usage-zero-cap', { maxMonthlyUsage: 0 })
    await get('usage-zero-cap', 200).then((response) => assert.equal(response.status, 429))
    await seed('usage-abort')
    await assert.rejects(request(app).get('/abort').set('x-api-key', 'usage-abort'))
    await drain()
    for (const key of ['usage-expired', 'usage-spent', 'usage-zero-cap', 'usage-abort']) {
      assert.equal((await read(key)).usageAccounting, undefined)
    }

    // Real first-use and role-window reset paths do not reset the accounting.
    await seed('usage-role', { maxMonthlyUsage: null, requestCountMonth: 20,
      requestCountStart: new Date(Date.now() - 31 * DAY) })
    await debit('usage-role')
    await get('usage-role', 200).then((response) => assert.equal(response.status, 200))
    stored = await read('usage-role')
    assert.equal(stored.requestCountMonth, 1)
    assert.equal(stored.usageAccounting.totalDebitedCredits, 2)
    await seed('usage-first', { requestCountStart: undefined })
    await get('usage-first', 200).then((response) => assert.equal(response.status, 200))
    assert.equal((await read('usage-first')).usageAccounting.totalDebitedCredits, 1)

    // Opt-out remains the original $inc and creates no accounting fields.
    const legacyApp = express()
    legacyApp.use(createApiKeyMiddlewareWithConnection(connection))
    legacyApp.get('/ok', (_req, res) => res.end())
    await seed('usage-legacy')
    await request(legacyApp).get('/ok').set('x-api-key', 'usage-legacy').expect(200)
    await drain()
    stored = await read('usage-legacy')
    assert.equal(stored.requestCountMonth, 1)
    assert.equal(stored.usageAccounting, undefined)

    // Normal reads exclude the ledger. Explicit internal reads do not expose it
    // through document serialization; raw/aggregate access is deliberately explicit.
    assert.equal((await model.findOne({ key: 'usage-statuses' })).usageAccounting, undefined)
    assert.equal((await model.findOne({ key: 'usage-statuses' }).lean())!.usageAccounting, undefined)
    const selected = await model.findOne({ key: 'usage-statuses' }).select('+usageAccounting')
    assert.ok(selected!.usageAccounting)
    assert.equal(selected!.toJSON().usageAccounting, undefined)
    assert.equal(selected!.toObject().usageAccounting, undefined)
    assert.ok((await read('usage-statuses')).usageAccounting)
    const aggregate = await model.aggregate([
      { $match: { key: 'usage-statuses' } },
      { $group: { _id: null, totalDebitedCredits: { $sum: '$usageAccounting.totalDebitedCredits' } } },
      { $project: { _id: 0, totalDebitedCredits: 1 } },
    ])
    assert.deepEqual(aggregate, [{ totalDebitedCredits: 3 }])
    const stats = await request(app).get('/api-key-stats').set('x-api-key', 'usage-statuses').expect(200)
    const dashboard = await request(app).get('/dashboard').set('x-api-key', 'usage-statuses').expect(200)
    const serialized = await request(app).get('/doc').set('x-api-key', 'usage-statuses').expect(200)
    await drain()
    for (const body of [stats.text, dashboard.text, serialized.text]) {
      assert.ok(!body.includes('usageAccounting'))
      assert.ok(!body.includes('totalDebitedCredits'))
      assert.ok(!body.includes('outOfWindowDebits'))
    }

    // Async finish failures are handled, bounded, secret-free and never retried.
    await seed('usage-write-error')
    let failedWrites = 0
    model.updateOne = (() => { failedWrites++; throw new Error(SENTINEL) }) as any
    await get('usage-write-error', 200).then((response) => assert.equal(response.status, 200))
    await get('usage-write-error', 200).then((response) => assert.equal(response.status, 200))
    assert.equal(failedWrites, 2)
    assert.equal((await read('usage-write-error')).usageAccounting, undefined)
    assert.equal(warnings.filter((line) => line.includes('usage debit failed')).length, 1)
    assert.ok(!warnings.join('\n').includes(SENTINEL))
    model.updateOne = updateOne

    console.log(`PASS: usageAccounting — Mongoose ${mongoose.version}, MongoDB 8.2.6; atomicity, HTTP billing, retention, privacy and failure tests (${accountingBytes} bytes at bounded fixture size)`)
  } finally {
    console.warn = oldWarn
    await connection.disconnect()
    await mongo.stop()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
