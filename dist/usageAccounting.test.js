"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/** Local MongoDB only. No production connection, external request or API checks. */
const strict_1 = __importDefault(require("node:assert/strict"));
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
const usageAccounting_1 = require("./usageAccounting");
// Run the same real-Mongo tests with the oldest supported Mongoose 8 and 9.
// Load the chosen version before the library's schemas are created.
const mongoose = require(process.argv.includes('--mongoose8') ? 'mongoose8' : 'mongoose');
if (process.argv.includes('--mongoose8')) {
    require.cache[require.resolve('mongoose')] = require.cache[require.resolve('mongoose8')];
}
const { createApiKeyMiddlewareWithConnection, createRenewalFunction } = require('./middleware/apiKeyAuth');
const DAY = 86400000;
const AT = new Date('2026-11-02T12:00:00Z');
const SENTINEL = 'fictional-private-regression-sentinel';
const config = (0, usageAccounting_1.configureUsageAccounting)({ categories: ['number', 'bulk'] });
const dayBucket = (record, day) => Object.values(record.daily).find((bucket) => bucket.day === day);
async function main() {
    var _a, _b, _c, _d;
    strict_1.default.equal((0, usageAccounting_1.configureUsageAccounting)(undefined), undefined);
    for (const invalid of [null, true, {}, { categories: 'number' }, { categories: Array(32).fill('a') },
        { categories: ['phone.123'] }, { categories: ['123'] }, { categories: ['$field'] },
        { categories: ['a'.repeat(33)] }, { categories: ['name@example.test'] },
        { categories: [], category: 'not-a-function' }]) {
        strict_1.default.throws(() => (0, usageAccounting_1.configureUsageAccounting)(invalid), /usageAccounting requires/);
    }
    const labels = ['number'];
    const copied = (0, usageAccounting_1.configureUsageAccounting)({ categories: labels });
    labels.push('unexpected');
    strict_1.default.deepEqual(copied.categories, ['number', 'unknown']);
    for (const result of [SENTINEL, 123, {}, null, undefined]) {
        strict_1.default.equal((0, usageAccounting_1.usageCategory)((0, usageAccounting_1.configureUsageAccounting)({ categories: ['number'], category: () => result }), {}, {}), 'unknown');
    }
    strict_1.default.equal((0, usageAccounting_1.usageCategory)((0, usageAccounting_1.configureUsageAccounting)({ categories: [], category: () => { throw new Error(SENTINEL); } }), {}, {}), 'unknown');
    strict_1.default.equal((0, usageAccounting_1.usageCategory)((0, usageAccounting_1.configureUsageAccounting)({ categories: [], category: () => Promise.reject(new Error(SENTINEL)) }), {}, {}), 'unknown');
    strict_1.default.throws(() => (0, usageAccounting_1.usageDebitPipeline)(config, 'number', new Date(NaN)), /Invalid usage/);
    const mongo = await mongodb_memory_server_1.MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { ip: '127.0.0.1' } });
    const connection = new mongoose.Mongoose();
    const warnings = [];
    const oldWarn = console.warn;
    console.warn = (...args) => { warnings.push(args.map(String).join(' ')); };
    try {
        strict_1.default.match(mongo.getUri(), /^mongodb:\/\/127\.0\.0\.1:/);
        await connection.connect(mongo.getUri(), { dbName: 'usage_accounting_test' });
        const app = (0, express_1.default)();
        app.use(createApiKeyMiddlewareWithConnection(connection, {
            exposeStatsEndpoint: true,
            exposeDashboard: true,
            sessionSecret: 'usage-test-session-secret',
            usageAccounting: { categories: ['number', 'bulk'], category: (req) => req.path === '/bulk' ? 'bulk' : 'number' },
        }));
        app.get('/status/:code', (req, res) => res.status(Number(req.params.code)).end());
        app.post('/bulk', (_req, res) => res.json({ results: Array(1000).fill({ exists: true }) }));
        app.get('/doc', (req, res) => res.json(req.apiKeyDoc));
        app.get('/abort', (_req, res) => res.destroy());
        const model = connection.models.ApiKey;
        await model.init();
        await connection.models.Role.create({ name: 'paid', maxMonthlyUsage: 10000, minIntervalSeconds: 0 });
        const seed = async (key, fields = {}) => {
            await model.create({ key, role: 'paid', requestCountMonth: 0, requestCountStart: new Date(),
                expiresAt: new Date(Date.now() + 365 * DAY), maxMonthlyUsage: 1000000, minIntervalSeconds: 0, ...fields });
        };
        const read = async (key) => (await model.collection.findOne({ key }));
        const debit = (key, label = 'number', at = AT) => (0, usageAccounting_1.persistUsageDebit)(model, key, config, label, at);
        // Same-document increments survive concurrent writes without lost counts.
        await seed('usage-concurrent');
        strict_1.default.ok((await Promise.all(Array.from({ length: 80 }, (_, i) => debit('usage-concurrent', i % 2 ? 'number' : 'bulk')))).every((result) => result === 'confirmed'));
        let stored = await read('usage-concurrent');
        strict_1.default.equal(stored.requestCountMonth, 80);
        strict_1.default.equal(stored.usageAccounting.totalDebitedCredits, 80);
        strict_1.default.deepEqual((_a = dayBucket(stored.usageAccounting, '2026-11-02')) === null || _a === void 0 ? void 0 : _a.categories, { number: 40, bulk: 40 });
        // First-use/monthly resets and explicit renewals affect quota only.
        await model.updateOne({ key: 'usage-concurrent' }, { $set: { requestCountMonth: 0, requestCountStart: new Date() } });
        await debit('usage-concurrent');
        strict_1.default.equal((await read('usage-concurrent')).usageAccounting.totalDebitedCredits, 81);
        const renew = createRenewalFunction(connection);
        await renew('usage-concurrent', { additionalRequests: 10, resetUsageCount: true });
        strict_1.default.equal((await read('usage-concurrent')).requestCountMonth, 0);
        await Promise.all([
            ...Array.from({ length: 30 }, () => debit('usage-concurrent')),
            renew('usage-concurrent', { additionalRequests: 10, resetUsageCount: true }),
        ]);
        stored = await read('usage-concurrent');
        strict_1.default.equal(stored.usageAccounting.totalDebitedCredits, 111);
        strict_1.default.equal((_b = dayBucket(stored.usageAccounting, '2026-11-02')) === null || _b === void 0 ? void 0 : _b.debitedCredits, 111);
        // Ring rollover, UTC midnight and a clock rollback cannot erase newer data.
        await seed('usage-ring');
        for (let i = 0; i < 181; i++)
            await debit('usage-ring', 'number', new Date(AT.getTime() + i * DAY));
        stored = await read('usage-ring');
        strict_1.default.equal(stored.usageAccounting.totalDebitedCredits, 181);
        strict_1.default.equal(Object.keys(stored.usageAccounting.daily).length, 90);
        strict_1.default.equal(Object.values(stored.usageAccounting.daily).reduce((sum, bucket) => sum + bucket.debitedCredits, 0), 90);
        strict_1.default.equal(dayBucket(stored.usageAccounting, '2026-11-02'), undefined);
        const ringBefore = stored.usageAccounting.daily;
        await debit('usage-ring', 'number', AT);
        stored = await read('usage-ring');
        strict_1.default.equal(stored.usageAccounting.totalDebitedCredits, 182);
        strict_1.default.equal(stored.usageAccounting.outOfWindowDebits, 1);
        strict_1.default.deepEqual(stored.usageAccounting.daily, ringBefore);
        await seed('usage-midnight');
        await debit('usage-midnight', 'number', new Date('2026-11-02T23:59:59.999Z'));
        await debit('usage-midnight', 'bulk', new Date('2026-11-03T00:00:00.000Z'));
        strict_1.default.equal(Object.keys((await read('usage-midnight')).usageAccounting.daily).length, 2);
        // Changing the allowlist remains bounded; retired counts become unknown.
        const oldCategories = Array.from({ length: 31 }, (_, i) => `old_${i}`);
        const fullConfig = (0, usageAccounting_1.configureUsageAccounting)({ categories: oldCategories });
        await seed('usage-categories');
        await Promise.all([...oldCategories, 'unknown'].map((category) => (0, usageAccounting_1.persistUsageDebit)(model, 'usage-categories', fullConfig, category, AT)));
        await debit('usage-categories', SENTINEL);
        stored = await read('usage-categories');
        strict_1.default.deepEqual((_c = dayBucket(stored.usageAccounting, '2026-11-02')) === null || _c === void 0 ? void 0 : _c.categories, { unknown: 33 });
        strict_1.default.equal(stored.usageAccounting.totalDebitedCredits, 33);
        strict_1.default.ok(!JSON.stringify(stored.usageAccounting).includes(SENTINEL));
        // Worst-case bounded fixture: 90 buckets × 32 long labels, not one row per call.
        const maximumCategories = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`category_${i}_`.padEnd(32, 'x'), Number.MAX_SAFE_INTEGER]));
        maximumCategories.unknown = Number.MAX_SAFE_INTEGER;
        const maximumRecord = { version: 1, totalDebitedCredits: 1, firstRecordedDay: '2026-01-01',
            lastRecordedDay: '2026-11-02', outOfWindowDebits: 0,
            daily: Object.fromEntries(Array.from({ length: 90 }, (_, i) => [String(i), {
                    day: '2026-11-02', debitedCredits: 1, categories: maximumCategories,
                }])) };
        const accountingBytes = mongoose.mongo.BSON.calculateObjectSize(maximumRecord);
        strict_1.default.ok(accountingBytes < 256 * 1024, `accounting field is bounded: ${accountingBytes}`);
        // No new billing rule for absent/null/date/string counters.
        for (const [label, value] of [['null', null], ['date', new Date()], ['text', '7']]) {
            const key = `usage-invalid-${label}`;
            await model.collection.insertOne({ key, role: 'paid', requestCountMonth: value });
            strict_1.default.equal(await debit(key), 'failed');
            strict_1.default.equal(await (0, usageAccounting_1.persistUsageDebit)(model, key, undefined, 'unknown', AT), 'failed');
            strict_1.default.equal((await read(key)).usageAccounting, undefined);
        }
        await model.collection.insertOne({ key: 'usage-missing-counter', role: 'paid' });
        strict_1.default.equal(await debit('usage-missing-counter'), 'confirmed');
        strict_1.default.equal((await read('usage-missing-counter')).requestCountMonth, 1);
        strict_1.default.equal(await debit('usage-nonexistent'), 'not_applied');
        // A committed write whose acknowledgement is lost is never retried.
        await seed('usage-lost-ack');
        let calls = 0;
        const lostAck = { updateOne: async (...args) => {
                calls++;
                await model.updateOne(...args);
                throw new Error(SENTINEL);
            } };
        strict_1.default.equal(await (0, usageAccounting_1.persistUsageDebit)(lostAck, 'usage-lost-ack', config, 'number', AT), 'failed');
        strict_1.default.equal(calls, 1);
        stored = await read('usage-lost-ack');
        strict_1.default.equal(stored.requestCountMonth, 1);
        strict_1.default.equal(stored.usageAccounting.totalDebitedCredits, 1);
        for (const [result, outcome] of [
            [{ acknowledged: false }, 'unacknowledged'],
            [{ acknowledged: true, matchedCount: 0, modifiedCount: 0 }, 'not_applied'],
        ]) {
            let attempts = 0;
            const fake = { updateOne: async () => { attempts++; return result; } };
            strict_1.default.equal(await (0, usageAccounting_1.persistUsageDebit)(fake, 'fixture-key', config, 'number', AT), outcome);
            strict_1.default.equal(attempts, 1);
        }
        // Await the asynchronous finish write in HTTP tests, without changing response timing.
        const writes = [];
        const updateOne = model.updateOne.bind(model);
        model.updateOne = ((...args) => {
            const write = updateOne(...args).exec();
            writes.push(write);
            return write;
        });
        const drain = async () => {
            await new Promise((resolve) => setImmediate(resolve));
            await Promise.allSettled(writes.splice(0));
        };
        const get = async (key, code) => {
            const response = await (0, supertest_1.default)(app).get(`/status/${code}`).set('x-api-key', key);
            await drain();
            return response;
        };
        await seed('usage-statuses');
        for (const code of [200, 201, 204, 302, 400, 403, 404, 429, 500, 503]) {
            strict_1.default.equal((await get('usage-statuses', code)).status, code);
        }
        stored = await read('usage-statuses');
        strict_1.default.equal(stored.requestCountMonth, 1);
        strict_1.default.equal(stored.usageAccounting.totalDebitedCredits, 1);
        // Retrying the HTTP call is another request under existing billing rules.
        await get('usage-statuses', 200);
        strict_1.default.equal((await read('usage-statuses')).usageAccounting.totalDebitedCredits, 2);
        await (0, supertest_1.default)(app).post('/bulk').set('x-api-key', 'usage-statuses').send({ count: 1000 }).expect(200);
        await drain();
        stored = await read('usage-statuses');
        strict_1.default.equal(stored.requestCountMonth, 3, 'a bulk response still costs one credit');
        strict_1.default.equal((_d = dayBucket(stored.usageAccounting, new Date().toISOString().slice(0, 10))) === null || _d === void 0 ? void 0 : _d.categories.bulk, 1);
        const allStatuses = (0, express_1.default)();
        allStatuses.use(createApiKeyMiddlewareWithConnection(connection, { countOnly200: false, usageAccounting: { categories: [] } }));
        allStatuses.get('/status/:code', (req, res) => res.status(Number(req.params.code)).end());
        await seed('usage-all-statuses');
        for (const code of [200, 201, 204, 302, 400, 403, 404, 429, 500, 503]) {
            await (0, supertest_1.default)(allStatuses).get(`/status/${code}`).set('x-api-key', 'usage-all-statuses').expect(code);
            await drain();
        }
        strict_1.default.equal((await read('usage-all-statuses')).usageAccounting.totalDebitedCredits, 10);
        // Missing/expired/spent keys and aborted responses never reach a debit.
        await (0, supertest_1.default)(app).get('/status/200').expect(401);
        await (0, supertest_1.default)(app).get('/status/200').set('x-api-key', 'not-a-key').expect(401);
        await seed('usage-expired', { expiresAt: new Date(Date.now() - DAY) });
        await get('usage-expired', 200).then((response) => strict_1.default.equal(response.status, 401));
        await seed('usage-spent', { requestCountMonth: 1, maxMonthlyUsage: 1 });
        await get('usage-spent', 200).then((response) => strict_1.default.equal(response.status, 429));
        await seed('usage-zero-cap', { maxMonthlyUsage: 0 });
        await get('usage-zero-cap', 200).then((response) => strict_1.default.equal(response.status, 429));
        await seed('usage-abort');
        await strict_1.default.rejects((0, supertest_1.default)(app).get('/abort').set('x-api-key', 'usage-abort'));
        await drain();
        for (const key of ['usage-expired', 'usage-spent', 'usage-zero-cap', 'usage-abort']) {
            strict_1.default.equal((await read(key)).usageAccounting, undefined);
        }
        // Real first-use and role-window reset paths do not reset the accounting.
        await seed('usage-role', { maxMonthlyUsage: null, requestCountMonth: 20,
            requestCountStart: new Date(Date.now() - 31 * DAY) });
        await debit('usage-role');
        await get('usage-role', 200).then((response) => strict_1.default.equal(response.status, 200));
        stored = await read('usage-role');
        strict_1.default.equal(stored.requestCountMonth, 1);
        strict_1.default.equal(stored.usageAccounting.totalDebitedCredits, 2);
        await seed('usage-first', { requestCountStart: undefined });
        await get('usage-first', 200).then((response) => strict_1.default.equal(response.status, 200));
        strict_1.default.equal((await read('usage-first')).usageAccounting.totalDebitedCredits, 1);
        // Opt-out remains the original $inc and creates no accounting fields.
        const legacyApp = (0, express_1.default)();
        legacyApp.use(createApiKeyMiddlewareWithConnection(connection));
        legacyApp.get('/ok', (_req, res) => res.end());
        await seed('usage-legacy');
        await (0, supertest_1.default)(legacyApp).get('/ok').set('x-api-key', 'usage-legacy').expect(200);
        await drain();
        stored = await read('usage-legacy');
        strict_1.default.equal(stored.requestCountMonth, 1);
        strict_1.default.equal(stored.usageAccounting, undefined);
        // Normal reads exclude the ledger. Explicit internal reads do not expose it
        // through document serialization; raw/aggregate access is deliberately explicit.
        strict_1.default.equal((await model.findOne({ key: 'usage-statuses' })).usageAccounting, undefined);
        strict_1.default.equal((await model.findOne({ key: 'usage-statuses' }).lean()).usageAccounting, undefined);
        const selected = await model.findOne({ key: 'usage-statuses' }).select('+usageAccounting');
        strict_1.default.ok(selected.usageAccounting);
        strict_1.default.equal(selected.toJSON().usageAccounting, undefined);
        strict_1.default.equal(selected.toObject().usageAccounting, undefined);
        strict_1.default.ok((await read('usage-statuses')).usageAccounting);
        const aggregate = await model.aggregate([
            { $match: { key: 'usage-statuses' } },
            { $group: { _id: null, totalDebitedCredits: { $sum: '$usageAccounting.totalDebitedCredits' } } },
            { $project: { _id: 0, totalDebitedCredits: 1 } },
        ]);
        strict_1.default.deepEqual(aggregate, [{ totalDebitedCredits: 3 }]);
        const stats = await (0, supertest_1.default)(app).get('/api-key-stats').set('x-api-key', 'usage-statuses').expect(200);
        const dashboard = await (0, supertest_1.default)(app).get('/dashboard').set('x-api-key', 'usage-statuses').expect(200);
        const serialized = await (0, supertest_1.default)(app).get('/doc').set('x-api-key', 'usage-statuses').expect(200);
        await drain();
        for (const body of [stats.text, dashboard.text, serialized.text]) {
            strict_1.default.ok(!body.includes('usageAccounting'));
            strict_1.default.ok(!body.includes('totalDebitedCredits'));
            strict_1.default.ok(!body.includes('outOfWindowDebits'));
        }
        // Async finish failures are handled, bounded, secret-free and never retried.
        await seed('usage-write-error');
        let failedWrites = 0;
        model.updateOne = (() => { failedWrites++; throw new Error(SENTINEL); });
        await get('usage-write-error', 200).then((response) => strict_1.default.equal(response.status, 200));
        await get('usage-write-error', 200).then((response) => strict_1.default.equal(response.status, 200));
        strict_1.default.equal(failedWrites, 2);
        strict_1.default.equal((await read('usage-write-error')).usageAccounting, undefined);
        strict_1.default.equal(warnings.filter((line) => line.includes('usage debit failed')).length, 1);
        strict_1.default.ok(!warnings.join('\n').includes(SENTINEL));
        model.updateOne = updateOne;
        console.log(`PASS: usageAccounting — Mongoose ${mongoose.version}, MongoDB 8.2.6; atomicity, HTTP billing, retention, privacy and failure tests (${accountingBytes} bytes at bounded fixture size)`);
    }
    finally {
        console.warn = oldWarn;
        await connection.disconnect();
        await mongo.stop();
    }
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
