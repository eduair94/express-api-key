import assert from 'assert'
import {
  parseSubscriptionStatus,
  renderSubscriptionPanel,
  SubscriptionPanelData,
} from './subscriptionPanel'

const AUTO_URL = 'https://sub.example/?mode=renew&autorenew=1#key=k'

// Nothing known → empty string (panel hidden)
assert.strictEqual(renderSubscriptionPanel(null, '/dashboard', AUTO_URL), '')

const data: SubscriptionPanelData = {
  subscriptionId: 'I-1', status: 'active', requestsAmount: 500000, price: 190,
  balance: 1234567, capTotal: 2000000, used: 765433,
  currentPeriodEnd: '2026-07-15T00:00:00.000Z', graceEndsAt: null,
  pendingChange: null, expiresAt: '2026-07-18T00:00:00.000Z',
}

// ── active: details, change, turn off ─────────────────────────────────────
{
  const html = renderSubscriptionPanel({ kind: 'subscription', data }, '/dashboard', AUTO_URL)
  assert.ok(html.includes('Auto-renew'), 'has heading')
  assert.ok(html.includes('>On<'), 'on badge')
  assert.ok(html.includes('1,234,567'), 'shows balance formatted')
  assert.ok(html.includes('500,000'), 'shows tokens per cycle')
  assert.ok(html.includes('$190.00'), 'shows the price per cycle')
  assert.ok(html.includes('/dashboard/subscription/change'), 'change form posts to route')
  assert.ok(html.includes('/dashboard/subscription/cancel'), 'cancel form posts to route')
  assert.ok(html.includes('Turn off auto-renew'))
  assert.ok(!html.includes('Turn on auto-renew'))
}

// ── cancelled: grace, no cancel, and a way back when allowed ──────────────
{
  const cancelled: SubscriptionPanelData = { ...data, status: 'cancelled', graceEndsAt: '2026-10-13T00:00:00.000Z' }
  const html = renderSubscriptionPanel(
    { kind: 'subscription', data: cancelled, offer: { available: true, message: null } },
    '/dashboard',
    AUTO_URL
  )
  assert.ok(html.includes('October 13, 2026'), 'shows when the remaining requests lapse')
  assert.ok(!html.includes('/dashboard/subscription/cancel'), 'no cancel button when already cancelled')
  assert.ok(html.includes('Turn auto-renew back on'))
  assert.ok(html.includes('href="https://sub.example/?mode=renew&amp;autorenew=1#key=k"'))

  const closing = renderSubscriptionPanel(
    { kind: 'subscription', data: cancelled, offer: { available: false, message: 'Still closing <b>' } },
    '/dashboard',
    AUTO_URL
  )
  assert.ok(!closing.includes('Turn auto-renew back on'))
  assert.ok(closing.includes('Still closing &lt;b&gt;'), 'reason shown, escaped')
}

// ── suspended: PayPal stopped, the customer is told who can restart it ────
{
  const html = renderSubscriptionPanel({ kind: 'subscription', data: { ...data, status: 'suspended' } }, '/dashboard', AUTO_URL)
  assert.ok(html.includes('>Paused<'))
  assert.match(html, /PayPal could not collect/)
}

// ── pending change shown ───────────────────────────────────────────────────
assert.ok(
  renderSubscriptionPanel({ kind: 'subscription', data: { ...data, pendingChange: { requestsAmount: 1000000, price: 380 } } }, '/dashboard', null)
    .includes('1,000,000'),
  'shows pending change amount'
)

// ── no subscription: offer it, or say why not ──────────────────────────────
{
  const html = renderSubscriptionPanel(
    { kind: 'none', offer: { available: true, message: null }, cycleDays: 30 },
    '/dashboard',
    AUTO_URL
  )
  assert.ok(html.includes('>Off<'))
  assert.ok(html.includes('every 30 days'))
  assert.ok(html.includes('Turn on auto-renew'))
  assert.ok(html.includes('href="https://sub.example/?mode=renew&amp;autorenew=1#key=k"'))
  assert.ok(html.includes('target="_blank"'))

  const blocked = renderSubscriptionPanel(
    { kind: 'none', offer: { available: false, message: 'Auto-renew includes 4 req/s and this key runs at 8 req/s.' }, cycleDays: 30 },
    '/dashboard',
    AUTO_URL
  )
  assert.ok(blocked.includes('Auto-renew includes 4 req/s'))
  assert.ok(!blocked.includes('Turn on auto-renew'))

  // No checkout to send the customer to: nothing to offer, no panel.
  assert.strictEqual(
    renderSubscriptionPanel({ kind: 'none', offer: { available: true, message: null }, cycleDays: 30 }, '/dashboard', null),
    ''
  )
}

// ── the change form sells what the service sells ──────────────────────────
{
  const spotify = renderSubscriptionPanel(
    { kind: 'subscription', data, bounds: { min: 20_000, step: 10_000 } },
    '/dashboard',
    AUTO_URL
  )
  assert.ok(spotify.includes('min="20000" step="10000"'), "the service's own bounds")
  const older = renderSubscriptionPanel({ kind: 'subscription', data }, '/dashboard', AUTO_URL)
  assert.ok(older.includes('min="50000" step="50000"'), 'an older service: the previous bounds')
}

// ── parsing what the subscription service answers ─────────────────────────
{
  const parsed = parseSubscriptionStatus({ success: true, data, requestBounds: { min: 20_000, step: 10_000 } })
  assert.deepStrictEqual(parsed && parsed.kind === 'subscription' && parsed.bounds, { min: 20_000, step: 10_000 })
  for (const bad of [{ min: -1, step: 10 }, { min: 10, step: 0 }, { min: 'x', step: 10 }, null, 'nope'])
    assert.strictEqual(
      (parseSubscriptionStatus({ success: true, data, requestBounds: bad }) as any).bounds,
      null,
      JSON.stringify(bad)
    )
}
{
  assert.deepStrictEqual(
    parseSubscriptionStatus({ success: true, data, autoRenew: { available: false, reason: 'already_active', message: 'x' } }),
    { kind: 'subscription', data, offer: { available: false, message: 'x' }, bounds: null }
  )
  assert.deepStrictEqual(
    parseSubscriptionStatus({ success: false, code: 'NO_SUBSCRIPTION', autoRenew: { available: true, reason: null, message: null }, cycleDays: 30 }),
    { kind: 'none', offer: { available: true, message: null }, cycleDays: 30 }
  )
  // An older service: no code, no offer → nothing to show.
  assert.strictEqual(parseSubscriptionStatus({ success: false, error: 'No subscription found for this API key' }), null)
  // An older service with a subscription: shown, no offer.
  assert.deepStrictEqual(parseSubscriptionStatus({ success: true, data }), { kind: 'subscription', data, offer: null, bounds: null })
  assert.strictEqual(parseSubscriptionStatus({ success: false, code: 'KEY_NOT_FOUND' }), null)
  for (const junk of [null, undefined, 'x', 1, [], { success: true }])
    assert.strictEqual(parseSubscriptionStatus(junk), null, JSON.stringify(junk))
  // Odd cycle values fall back to 30.
  const odd = parseSubscriptionStatus({ success: false, code: 'NO_SUBSCRIPTION', autoRenew: { available: true }, cycleDays: -1 })
  assert.deepStrictEqual(odd, { kind: 'none', offer: { available: true, message: null }, cycleDays: 30 })
}

console.log('PASS: subscriptionPanel')
