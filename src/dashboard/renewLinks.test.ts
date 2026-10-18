import assert from 'assert'
import { buildRenewUrl } from './renewLinks'

const KEY = `wapi_${'ab'.repeat(32)}`
const keyOf = (url: string) => new URLSearchParams(new URL(url).hash.slice(1)).get('key')

// The key rides in the fragment only: browsers never send it to a server.
{
  const url = buildRenewUrl('https://whatsapp-sub.checkleaked.com/', KEY)
  assert.ok(url)
  const u = new URL(url!)
  assert.strictEqual(`${u.origin}${u.pathname}`, 'https://whatsapp-sub.checkleaked.com/')
  assert.strictEqual(u.searchParams.get('mode'), 'renew')
  assert.strictEqual(u.searchParams.get('src'), 'dashboard')
  assert.strictEqual(u.searchParams.get('autorenew'), null)
  assert.ok(!u.search.includes(KEY), 'never in the query string')
  assert.strictEqual(keyOf(url!), KEY)
}

// The auto-renew call to action, on a checkout URL with its own query.
{
  const url = buildRenewUrl('https://x.example/checkout?lang=es', KEY, {
    autoRenew: true,
    src: 'dashboard_autorenew',
  })
  const u = new URL(url!)
  assert.strictEqual(u.pathname, '/checkout')
  assert.strictEqual(u.searchParams.get('lang'), 'es', 'keeps the configured query')
  assert.strictEqual(u.searchParams.get('mode'), 'renew')
  assert.strictEqual(u.searchParams.get('autorenew'), '1')
  assert.strictEqual(u.searchParams.get('src'), 'dashboard_autorenew')
  assert.strictEqual(keyOf(url!), KEY)
}

// Characters that mean something in a URL survive the round trip.
assert.strictEqual(keyOf(buildRenewUrl('https://x.example/', 'a&b=c#d+e')!), 'a&b=c#d+e')

// A fragment already on the configured URL is replaced, not appended to.
assert.strictEqual(keyOf(buildRenewUrl('https://x.example/#pricing', KEY)!), KEY)
assert.ok(!buildRenewUrl('https://x.example/#pricing', KEY)!.includes('pricing'))

// No usable checkout URL (or no key): no link at all rather than a broken one.
for (const bad of ['', '   ', 'javascript:alert(1)', 'ftp://x.example/', 'not a url', undefined, null]) {
  assert.strictEqual(buildRenewUrl(bad as any, KEY), null, String(bad))
}
assert.strictEqual(buildRenewUrl('https://x.example/', ''), null)

console.log('PASS: renewLinks')
