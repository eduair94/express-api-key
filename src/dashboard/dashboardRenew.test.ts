import assert from 'assert'
import { renderDashboard } from './renderer'
import { ComputedDashboardData } from './types'

const CHECKOUT = 'https://sub.example/'
const base: ComputedDashboardData = {
  key: 'wapi_test',
  role: 'pro',
  requestCountMonth: 100_000,
  requestCountStart: null,
  lastUsedAt: null,
  keyExpiresAt: new Date(Date.now() + 40 * 86400_000).toISOString(),
  roleInfo: null,
  daysValid: 120,
  createdAt: null,
  hasPerKeyQuota: true,
  monthlyCap: 500_000,
  usagePercent: '20.0',
  remaining: 400_000,
  renewalDays: null,
  renewalDate: null,
  keyExpiresDays: 40,
  usageStatus: 'healthy',
  keyStatus: 'healthy',
}
// null = no checkout configured (undefined would pick the default).
const render = (over: Partial<ComputedDashboardData> = {}, renewUrl: string | null = CHECKOUT) =>
  renderDashboard({ ...base, ...over }, '/dashboard', '/docs', renewUrl ?? undefined)

// ── "Add credits" in the header, the key only in the link's fragment ──────
{
  const html = render()
  assert.ok(html.includes('id="addCreditsLink"'), 'header button')
  assert.ok(
    html.includes('href="https://sub.example/?mode=renew&amp;src=dashboard#key=wapi_test"'),
    'renewal link, attribute-escaped'
  )
  assert.ok(html.includes('Add credits'))
  assert.ok(html.includes('rel="noopener noreferrer"'))
  assert.ok(!html.includes('id="keyAlert"'), 'a healthy key gets no alert')
}

// ── no checkout configured: the dashboard reads as before ─────────────────
{
  const html = render({}, null)
  assert.ok(!html.includes('id="addCreditsLink"'))
  assert.ok(!html.includes('mode=renew'))
  const expiring = render({ keyExpiresDays: 3, keyStatus: 'warning' }, null)
  assert.ok(expiring.includes('Contact support to renew your key.'))
}

// ── expiring soon: renew from here, not "contact support" ─────────────────
{
  const html = render({ keyExpiresDays: 3, keyStatus: 'warning' })
  assert.ok(html.includes('Key Expiring Soon'))
  assert.ok(!html.includes('Contact support to renew'))
  assert.ok(html.includes('Renew now'))
}

// ── high usage: add credits from the insight ───────────────────────────────
{
  const html = render({ usagePercent: '85.0', usageStatus: 'warning', remaining: 75_000 })
  assert.ok(html.includes('High Usage Alert'))
  assert.match(html, /High Usage Alert[\s\S]*Add credits/)
}

// ── expired or spent: a banner above the stats says what to do ────────────
{
  const expired = render({ keyExpiresDays: -2, keyStatus: 'critical' })
  assert.ok(expired.includes('id="keyAlert"'))
  assert.match(expired, /This API key has expired/)
  assert.match(expired, /id="keyAlert"[\s\S]*Renew now/)

  const spent = render({ remaining: 0, usagePercent: '100.0', usageStatus: 'critical' })
  assert.ok(spent.includes('id="keyAlert"'))
  assert.match(spent, /No requests left on this key/)
  assert.match(spent, /id="keyAlert"[\s\S]*Add credits/)

  // A role-based quota refills by itself: nothing to buy.
  const roleSpent = render({ remaining: 0, hasPerKeyQuota: false })
  assert.ok(!roleSpent.includes('id="keyAlert"'))

  // Without a checkout the banner still explains, without a button.
  const noUrl = render({ keyExpiresDays: -2, keyStatus: 'critical' }, null)
  assert.ok(noUrl.includes('id="keyAlert"'))
  assert.ok(!/id="keyAlert"[\s\S]*mode=renew/.test(noUrl))
}

// ── a revoked key (refunded or charged back): nothing to buy, say why ────
{
  const html = render({ revoked: true, keyExpiresDays: 3, keyStatus: 'warning', usagePercent: '90.0' })
  assert.ok(!html.includes('id="addCreditsLink"'), 'no "Add credits" on a revoked key')
  assert.ok(!html.includes('mode=renew'), 'no renewal link anywhere')
  assert.ok(html.includes('id="keyAlert"'))
  assert.match(html, /This API key was revoked/)
  assert.match(html, /Contact support/)
}

// ── a key that is not URL- or HTML-safe never breaks out of the attribute ─
{
  const html = render({ key: 'a"b<c>&d' })
  assert.ok(!html.includes('a"b<c'), 'raw key never in markup')
  assert.ok(html.includes('#key=a%22b%3Cc%3E%26d'))
}

console.log('PASS: dashboardRenew')
