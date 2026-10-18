/**
 * The dashboard login takes an API key typed by a person: only a plain
 * string is ever looked up. The body parsers turn `apiKey[$regex]=^0f` (form)
 * or `{"apiKey":{"$regex":"^0f"}}` (JSON) into an operator object; passed to
 * `findOne({ key })` it matched stored keys, and "500 when a key matches /
 * 401 when none does" read them out one character at a time.
 *
 * The refusals happen before any database call, so no database is needed.
 */
import assert from 'assert'
import express from 'express'
import mongoose from 'mongoose'
import request from 'supertest'
import { createApiKeyMiddlewareWithConnection } from './apiKeyAuth'

async function main() {
  // Never connected: any query would buffer until the test times out.
  const conn = new mongoose.Mongoose()
  conn.set('bufferCommands', false)
  const app = express()
  app.use(
    createApiKeyMiddlewareWithConnection(conn, {
      exposeDashboard: true,
      sessionSecret: 'test-secret',
    }),
  )

  for (const body of [
    'apiKey[$regex]=%5E0f',
    'apiKey[$ne]=x',
    'apiKey[]=a&apiKey[]=b',
  ]) {
    const res = await request(app)
      .post('/dashboard/login')
      .type('form')
      .send(body)
    assert.strictEqual(res.status, 400, body)
    assert.match(res.text, /API key is required/, body)
  }
  for (const apiKey of [{ $regex: '^0f' }, { $ne: null }, ['a'], 123, true]) {
    const res = await request(app).post('/dashboard/login').send({ apiKey })
    assert.strictEqual(res.status, 400, JSON.stringify(apiKey))
  }
  const missing = await request(app).post('/dashboard/login').type('form').send('')
  assert.strictEqual(missing.status, 400)

  // A key far longer than any issued one is refused the same way.
  const long = await request(app)
    .post('/dashboard/login')
    .type('form')
    .send(`apiKey=${'a'.repeat(201)}`)
  assert.strictEqual(long.status, 400)

  console.log('PASS: dashboardLogin')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
