import assert from 'assert'
import { renderSubscriptionPanel, SubscriptionPanelData } from './subscriptionPanel'

// No subscription → empty string (panel hidden)
assert.strictEqual(renderSubscriptionPanel(null, '/dashboard'), '')

const data: SubscriptionPanelData = {
  subscriptionId: 'I-1', status: 'active', requestsAmount: 500000, price: 190,
  balance: 1234567, capTotal: 2000000, used: 765433,
  currentPeriodEnd: '2026-07-15T00:00:00.000Z', graceEndsAt: null,
  pendingChange: null, expiresAt: '2026-07-18T00:00:00.000Z',
}
const html = renderSubscriptionPanel(data, '/dashboard')
assert.ok(html.includes('Subscription'), 'has heading')
assert.ok(html.includes('1,234,567'), 'shows balance formatted')
assert.ok(html.includes('500,000') || html.includes('500000'), 'shows monthly tokens')
assert.ok(html.includes('/dashboard/subscription/change'), 'change form posts to route')
assert.ok(html.includes('/dashboard/subscription/cancel'), 'cancel form posts to route')

// Cancelled → shows grace, no cancel button
const cancelled: SubscriptionPanelData = { ...data, status: 'cancelled', graceEndsAt: '2026-10-13T00:00:00.000Z' }
const chtml = renderSubscriptionPanel(cancelled, '/dashboard')
assert.ok(chtml.toLowerCase().includes('grace') || chtml.includes('2026'), 'shows grace info')
assert.ok(!chtml.includes('/dashboard/subscription/cancel'), 'no cancel button when already cancelled')

// Pending change shown
const pending: SubscriptionPanelData = { ...data, pendingChange: { requestsAmount: 1000000, price: 380 } }
assert.ok(renderSubscriptionPanel(pending, '/dashboard').includes('1,000,000'), 'shows pending change amount')

console.log('PASS: subscriptionPanel')
