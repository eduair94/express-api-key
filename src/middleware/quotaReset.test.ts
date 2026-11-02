/** Deterministic request interleavings against local MongoDB; no production data. */
import assert from 'node:assert/strict'
import express from 'express'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import type { Model } from 'mongoose'
import { configureUsageAccounting, persistUsageDebit } from '../usageAccounting'

const mongoose: typeof import('mongoose') = require(process.argv.includes('--mongoose8') ? 'mongoose8' : 'mongoose')
if (process.argv.includes('--mongoose8')) {
  require.cache[require.resolve('mongoose')] = require.cache[require.resolve('mongoose8')]
}
const { createApiKeyMiddlewareWithConnection, createRenewalFunction } = require('./apiKeyAuth') as typeof import('./apiKeyAuth')
const DAY = 86_400_000
const config = configureUsageAccounting({ categories: ['request'] })!
const gate = () => {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer!: NodeJS.Timeout
  try {
    return await Promise.race([promise, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Local reset test interleaving timed out')), 10_000)
    })])
  } finally { clearTimeout(timer) }
}

async function main() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { ip: '127.0.0.1' } })
  const connection = new mongoose.Mongoose()
  try {
    assert.match(mongo.getUri(), /^mongodb:\/\/127\.0\.0\.1:/)
    await connection.connect(mongo.getUri(), { dbName: 'quota_reset_test' })
    const makeApp = (accounting = true) => {
      const app = express()
      app.use(createApiKeyMiddlewareWithConnection(connection, accounting
        ? { usageAccounting: { categories: ['request'], category: () => 'request' } } : {}))
      app.get('/ok', (_req, res) => res.end())
      app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(500).end())
      return app
    }
    const app = makeApp()
    const legacyApp = makeApp(false)
    const model = connection.models.ApiKey as Model<any>
    const roles = connection.models.Role as Model<any>
    await model.init()
    await roles.create([
      { name: 'normal', maxMonthlyUsage: 1000, minIntervalSeconds: 0 },
      { name: 'blocked', maxMonthlyUsage: 0, minIntervalSeconds: 0 },
    ])
    const oldStart = new Date(Date.now() - 31 * DAY)
    const future = new Date(Date.now() + 365 * DAY)
    const seed = async (key: string, fields: Record<string, unknown> = {}) => {
      // Raw inserts keep missing fields missing, so Mongoose hydration is tested.
      const document: Record<string, any> = { key, role: 'normal', requestCountMonth: 100,
        requestCountStart: oldStart, maxMonthlyUsage: null, daysValid: 60,
        expiresAt: future, minIntervalSeconds: 0, active: false, ...fields }
      for (const field of Object.keys(document)) if (document[field] === undefined) delete document[field]
      await model.collection.insertOne(document)
      // Existing accounting survives every reset; create it through the real debit.
      await persistUsageDebit(model, key, config, 'request', new Date())
      await model.collection.updateOne({ key }, { $set: { requestCountMonth: document.requestCountMonth } })
    }
    const read = async (key: string) => (await model.collection.findOne({ key }))!
    const updateOne = model.updateOne.bind(model)
    const findOneAndUpdate = model.findOneAndUpdate.bind(model)
    const roleFindOne = roles.findOne.bind(roles)
    let afterDebit: (() => void) | undefined
    const writes: Promise<unknown>[] = []
    model.updateOne = ((...args: any[]) => {
      const write = (updateOne as any)(...args).exec().then((result: any) => {
        if (Array.isArray(args[1]) || args[1]?.$inc?.requestCountMonth === 1) afterDebit?.()
        return result
      })
      writes.push(write)
      return write
    }) as any
    const drain = async () => {
      await new Promise<void>((resolve) => setImmediate(resolve))
      await Promise.all(writes.splice(0))
    }
    const get = async (key: string, target = app) => {
      const response = await request(target).get('/ok').set('x-api-key', key)
      await drain()
      return response
    }
    let cases = 0

    // Both requests read the old window. B's role lookup waits for A's actual
    // persisted finish debit, then resumes its stale reset before the rate check.
    const resetRace = async (key: string, fields: Record<string, unknown>, accounting = true) => {
      await seed(key, fields)
      const firstAtRole = gate(), secondAtRole = gate(), debitDone = gate()
      afterDebit = debitDone.release
      let lookups = 0
      roles.findOne = ((...args: any[]) => {
        const query = (roleFindOne as any)(...args)
        const execute = query.exec.bind(query)
        query.exec = async () => {
          const index = ++lookups
          if (index === 1) { firstAtRole.release(); await secondAtRole.promise }
          if (index === 2) { secondAtRole.release(); await debitDone.promise }
          return execute()
        }
        return query
      }) as any
      try {
        const first = get(key, accounting ? app : legacyApp)
        await bounded(firstAtRole.promise)
        const second = get(key, accounting ? app : legacyApp)
        const responses = await bounded(Promise.all([first, second]))
        assert.deepEqual(responses.map((response) => response.status), [200, 429], key)
        const stored = await read(key)
        assert.equal(stored.requestCountMonth, 1, key)
        assert.equal(stored.usageAccounting.totalDebitedCredits, accounting ? 2 : 1, key)
        assert.equal(stored.active, false, 'unrelated consumer fields remain untouched')
        assert.ok(lookups >= 3, 'CAS loser reloads the current role')
        if (fields.maxMonthlyUsage === 1) {
          assert.equal(responses[1].body.error, 'Monthly quota exceeded')
          assert.equal(responses[1].headers['x-ratelimit-requests-remaining'], '0')
        }
        cases++
      } finally {
        firstAtRole.release(); secondAtRole.release(); debitDone.release()
        afterDebit = undefined
        roles.findOne = roleFindOne
      }
    }
    await resetRace('monthly-race', { minIntervalSeconds: 2 })
    await resetRace('paid-null-race', { requestCountStart: null, requestCountMonth: 0, maxMonthlyUsage: 1000, minIntervalSeconds: 2 })
    await resetRace('paid-missing-race', { requestCountStart: undefined, requestCountMonth: 0, maxMonthlyUsage: 1000, minIntervalSeconds: 2 })
    await resetRace('quota-loser', { requestCountStart: null, requestCountMonth: 0, maxMonthlyUsage: 1 })
    await resetRace('legacy-missing-defaults', { requestCountStart: undefined, requestCountMonth: 0,
      maxMonthlyUsage: undefined, daysValid: undefined, expiresAt: undefined, minIntervalSeconds: 2 })
    await resetRace('opt-out-race', { minIntervalSeconds: 2 }, false)

    // A concurrent renewal/policy update happens after the request's snapshot,
    // before its reset. Only the first role read is intercepted; retries are real.
    const mutateBeforeReset = async (key: string, mutate: () => Promise<unknown>) => {
      let changed = false
      roles.findOne = ((...args: any[]) => {
        const query = (roleFindOne as any)(...args)
        const execute = query.exec.bind(query)
        query.exec = async () => {
          if (!changed) { changed = true; await mutate() }
          return execute()
        }
        return query
      }) as any
      try { return await bounded(get(key)) } finally { roles.findOne = roleFindOne }
    }
    const renew = createRenewalFunction(connection)
    for (const actualRenewal of [true, false]) {
      const key = actualRenewal ? 'concurrent-renewal' : 'concurrent-cap-only'
      await seed(key)
      const response = await mutateBeforeReset(key, async () => {
        if (actualRenewal) await renew(key, { additionalRequests: 1000 })
        else await model.collection.updateOne({ key }, { $set: { maxMonthlyUsage: 1000 } })
        await persistUsageDebit(model, key, config, 'request', new Date())
      })
      assert.equal(response.status, 200)
      const stored = await read(key)
      assert.equal(stored.requestCountStart.getTime(), oldStart.getTime(), key)
      assert.equal(stored.requestCountMonth, 102, key)
      assert.equal(stored.maxMonthlyUsage, 1000, key)
      assert.equal(stored.usageAccounting.totalDebitedCredits, 3, key)
      cases++
    }

    for (const field of ['expiresAt', 'daysValid'] as const) {
      const key = `concurrent-expiration-${field}`
      await seed(key, field === 'daysValid' ? { expiresAt: null } : {})
      const response = await mutateBeforeReset(key, () => model.collection.updateOne({ key }, {
        $set: { [field]: field === 'expiresAt' ? new Date(Date.now() - DAY) : 1 },
      }))
      assert.equal(response.status, 401)
      const stored = await read(key)
      assert.equal(stored.requestCountMonth, 100)
      assert.equal(stored.requestCountStart.getTime(), oldStart.getTime())
      assert.equal(stored.usageAccounting.totalDebitedCredits, 1)
      cases++
    }
    // null means no relative expiration; missing hydrates to the 30-day default.
    // A null CAS must not also match a field concurrently removed from MongoDB.
    await seed('null-to-missing-expiration', { expiresAt: null, daysValid: null })
    const missingExpiration = await mutateBeforeReset('null-to-missing-expiration', () => model.collection.updateOne(
      { key: 'null-to-missing-expiration' }, { $unset: { daysValid: '' } }))
    assert.equal(missingExpiration.status, 401)
    assert.equal((await read('null-to-missing-expiration')).requestCountMonth, 100)
    assert.equal((await read('null-to-missing-expiration')).requestCountStart.getTime(), oldStart.getTime())
    assert.equal((await read('null-to-missing-expiration')).usageAccounting.totalDebitedCredits, 1)
    cases++
    await seed('concurrent-role')
    const changedRole = await mutateBeforeReset('concurrent-role', () => model.collection.updateOne(
      { key: 'concurrent-role' }, { $set: { role: 'blocked' } }))
    assert.equal(changedRole.status, 429)
    assert.equal(changedRole.headers['x-ratelimit-requests-limit'], '0')
    assert.equal((await read('concurrent-role')).usageAccounting.totalDebitedCredits, 1)
    cases++
    await seed('concurrent-deletion')
    assert.equal((await mutateBeforeReset('concurrent-deletion', () => model.collection.deleteOne({ key: 'concurrent-deletion' }))).status, 401)
    cases++

    // Same key text reissued to a different document must not accept the old CAS.
    await seed('concurrent-replacement')
    const oldDocument = await read('concurrent-replacement')
    let replacementResets = 0
    model.findOneAndUpdate = ((...args: any[]) => {
      if (args[1]?.$set?.requestCountMonth === 0) replacementResets++
      return (findOneAndUpdate as any)(...args)
    }) as any
    const replaced = await mutateBeforeReset('concurrent-replacement', async () => {
      await model.collection.deleteOne({ key: 'concurrent-replacement' })
      const { _id: _oldId, ...fields } = oldDocument
      await model.collection.insertOne(fields)
    })
    model.findOneAndUpdate = findOneAndUpdate
    assert.equal(replaced.status, 200)
    assert.equal(replacementResets, 2, 'the old _id CAS misses before the new document resets')
    assert.notEqual(String((await read('concurrent-replacement'))._id), String(oldDocument._id))
    assert.equal((await read('concurrent-replacement')).requestCountMonth, 1)
    assert.equal((await read('concurrent-replacement')).usageAccounting.totalDebitedCredits, 2)
    cases++

    // Preserve absolute/relative expiration precedence, nullable legacy fields,
    // positive paid caps that never roll, and the existing cap-zero rejection.
    for (const [key, fields, status, expectedUsed] of [
      ['relative-valid', { expiresAt: null, daysValid: 60 }, 200, 1],
      ['relative-expired', { expiresAt: null, daysValid: 30 }, 401, 100],
      ['nullable-role', { expiresAt: null, daysValid: null, maxMonthlyUsage: null }, 200, 1],
      ['missing-cap-window', { maxMonthlyUsage: undefined, daysValid: undefined }, 200, 1],
      ['paid-window', { maxMonthlyUsage: 1000 }, 200, 101],
      ['zero-cap', { maxMonthlyUsage: 0 }, 429, 0],
    ] as const) {
      await seed(key, fields)
      assert.equal((await bounded(get(key))).status, status, key)
      const stored = await read(key)
      assert.equal(stored.requestCountMonth, expectedUsed, key)
      assert.equal(stored.usageAccounting.totalDebitedCredits, status === 200 ? 2 : 1, key)
      cases++
    }

    // Noncanonical BSON can hydrate to a valid-looking type but never match the
    // typed CAS. Fail safely after a bounded number of attempts, without a debit.
    for (const [key, fields] of [
      ['legacy-string-days', { daysValid: '30', requestCountStart: null }],
      ['legacy-string-expiry', { expiresAt: future.toISOString(), requestCountStart: null }],
    ] as const) {
      await seed(key, fields)
      let attempts = 0
      model.findOneAndUpdate = ((...args: any[]) => {
        if (args[1]?.$set?.requestCountMonth === 0) attempts++
        return (findOneAndUpdate as any)(...args)
      }) as any
      try {
        assert.equal((await bounded(get(key))).status, 503)
        assert.equal(attempts, 3)
        const stored = await read(key)
        assert.equal(stored.requestCountMonth, 100)
        assert.equal(stored.requestCountStart, null)
        assert.equal(stored.usageAccounting.totalDebitedCredits, 1)
        cases++
      } finally { model.findOneAndUpdate = findOneAndUpdate }
    }
    await seed('continuous-renewals', { requestCountStart: null, maxMonthlyUsage: 1000 })
    let conflicts = 0
    model.findOneAndUpdate = ((...args: any[]) => {
      const query = (findOneAndUpdate as any)(...args)
      const execute = query.exec.bind(query)
      query.exec = async () => {
        conflicts++
        await model.collection.updateOne({ key: 'continuous-renewals' }, { $inc: { maxMonthlyUsage: 1 } })
        return execute()
      }
      return query
    }) as any
    try {
      assert.equal((await bounded(get('continuous-renewals'))).status, 503)
      assert.equal(conflicts, 3)
      const stored = await read('continuous-renewals')
      assert.equal(stored.requestCountMonth, 100)
      assert.equal(stored.requestCountStart, null)
      assert.equal(stored.maxMonthlyUsage, 1003)
      assert.equal(stored.usageAccounting.totalDebitedCredits, 1)
      cases++
    } finally { model.findOneAndUpdate = findOneAndUpdate }

    // The last conflict can also resolve the window: use that final fresh state
    // (including its exhausted quota) rather than return a needless reset error.
    await seed('third-winner', { requestCountStart: null, maxMonthlyUsage: 1000 })
    let thirdAttempts = 0
    model.findOneAndUpdate = ((...args: any[]) => {
      const query = (findOneAndUpdate as any)(...args)
      if (args[1]?.$set?.requestCountMonth !== 0) return query
      const execute = query.exec.bind(query)
      query.exec = async () => {
        thirdAttempts++
        await model.collection.updateOne({ key: 'third-winner' }, thirdAttempts < 3
          ? { $inc: { maxMonthlyUsage: 1 } }
          : { $set: { maxMonthlyUsage: 1, requestCountMonth: 1, requestCountStart: new Date() } })
        return execute()
      }
      return query
    }) as any
    try {
      const response = await bounded(get('third-winner'))
      assert.equal(response.status, 429)
      assert.equal(response.body.error, 'Monthly quota exceeded')
      assert.equal(thirdAttempts, 3)
      assert.equal((await read('third-winner')).requestCountMonth, 1)
      assert.equal((await read('third-winner')).usageAccounting.totalDebitedCredits, 1)
      cases++
    } finally { model.findOneAndUpdate = findOneAndUpdate }

    // A reset committed before its acknowledgement is lost is not retried.
    await seed('reset-lost-ack')
    let resets = 0
    model.findOneAndUpdate = ((...args: any[]) => {
      const query = (findOneAndUpdate as any)(...args)
      if (args[1]?.$set?.requestCountMonth !== 0) return query
      const execute = query.exec.bind(query)
      query.exec = async () => {
        resets++
        await execute()
        throw new Error('fictional-local-reset-ack-error')
      }
      return query
    }) as any
    assert.equal((await get('reset-lost-ack')).status, 500)
    assert.equal(resets, 1)
    assert.equal((await read('reset-lost-ack')).requestCountMonth, 0)
    assert.equal((await read('reset-lost-ack')).usageAccounting.totalDebitedCredits, 1)
    model.findOneAndUpdate = findOneAndUpdate
    cases++
    console.log(`PASS: quotaReset — ${cases} deterministic cases; Mongoose ${mongoose.version}, MongoDB 8.2.6`)
  } finally {
    await connection.disconnect()
    await mongo.stop()
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
