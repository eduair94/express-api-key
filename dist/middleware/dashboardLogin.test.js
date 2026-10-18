"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * The dashboard login takes an API key typed by a person: only a plain
 * string is ever looked up. The body parsers turn `apiKey[$regex]=^0f` (form)
 * or `{"apiKey":{"$regex":"^0f"}}` (JSON) into an operator object; passed to
 * `findOne({ key })` it matched stored keys, and "500 when a key matches /
 * 401 when none does" read them out one character at a time.
 *
 * The refusals happen before any database call, so no database is needed.
 */
const assert_1 = __importDefault(require("assert"));
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const supertest_1 = __importDefault(require("supertest"));
const apiKeyAuth_1 = require("./apiKeyAuth");
async function main() {
    // Never connected: any query would buffer until the test times out.
    const conn = new mongoose_1.default.Mongoose();
    conn.set('bufferCommands', false);
    const app = (0, express_1.default)();
    app.use((0, apiKeyAuth_1.createApiKeyMiddlewareWithConnection)(conn, {
        exposeDashboard: true,
        sessionSecret: 'test-secret',
    }));
    for (const body of [
        'apiKey[$regex]=%5E0f',
        'apiKey[$ne]=x',
        'apiKey[]=a&apiKey[]=b',
    ]) {
        const res = await (0, supertest_1.default)(app)
            .post('/dashboard/login')
            .type('form')
            .send(body);
        assert_1.default.strictEqual(res.status, 400, body);
        assert_1.default.match(res.text, /API key is required/, body);
    }
    for (const apiKey of [{ $regex: '^0f' }, { $ne: null }, ['a'], 123, true]) {
        const res = await (0, supertest_1.default)(app).post('/dashboard/login').send({ apiKey });
        assert_1.default.strictEqual(res.status, 400, JSON.stringify(apiKey));
    }
    const missing = await (0, supertest_1.default)(app).post('/dashboard/login').type('form').send('');
    assert_1.default.strictEqual(missing.status, 400);
    // A key far longer than any issued one is refused the same way.
    const long = await (0, supertest_1.default)(app)
        .post('/dashboard/login')
        .type('form')
        .send(`apiKey=${'a'.repeat(201)}`);
    assert_1.default.strictEqual(long.status, 400);
    console.log('PASS: dashboardLogin');
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
