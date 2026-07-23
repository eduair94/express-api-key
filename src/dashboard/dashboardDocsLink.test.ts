import assert from 'assert'
import { renderDashboard } from './renderer'
import { ComputedDashboardData } from './types'

const data: ComputedDashboardData = {
  key: 'wapi_test',
  role: 'pro',
  requestCountMonth: 0,
  requestCountStart: null,
  lastUsedAt: null,
  keyExpiresAt: null,
  roleInfo: null,
  daysValid: 120,
  createdAt: null,
  hasPerKeyQuota: true,
  monthlyCap: 500_000,
  usagePercent: '0',
  remaining: 500_000,
  renewalDays: null,
  renewalDate: null,
  keyExpiresDays: 120,
  usageStatus: 'healthy',
  keyStatus: 'healthy',
}

const defaultHtml = renderDashboard(data)
assert.ok(defaultHtml.includes('href="/docs"'), 'links to default docs route')
assert.ok(defaultHtml.includes('API Docs'), 'shows the API Docs label')
assert.ok(
  defaultHtml.includes('rel="noopener noreferrer"'),
  'protects the new tab from opener access',
)

const customHtml = renderDashboard(
  data,
  '/account',
  'https://api.example.com/docs?source=dashboard&view=full',
)
assert.ok(
  customHtml.includes(
    'href="https://api.example.com/docs?source=dashboard&amp;view=full"',
  ),
  'supports and escapes a configured documentation URL',
)

console.log('PASS: dashboardDocsLink')
