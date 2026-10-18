/**
 * Pure renderer for the dashboard's "Auto-renew" section (PayPal
 * subscriptions sold by the subscription service). No IO: the middleware
 * fetches the status, `parseSubscriptionStatus` reads it, this draws it.
 */

export interface SubscriptionPanelData {
  subscriptionId: string
  status: 'pending' | 'active' | 'cancelled' | 'suspended' | 'expired'
  requestsAmount: number
  price: number
  balance: number
  capTotal: number
  used: number
  currentPeriodEnd: string | null
  graceEndsAt: string | null
  pendingChange: { requestsAmount: number; price: number } | null
  expiresAt: string | null
}

/** Whether a new auto-renew can be started on the key, and if not, why. */
export interface AutoRenewOffer {
  available: boolean
  /** Customer-facing reason when unavailable. */
  message: string | null
}

export type SubscriptionPanelInput =
  | { kind: 'subscription'; data: SubscriptionPanelData; offer?: AutoRenewOffer | null }
  | { kind: 'none'; offer: AutoRenewOffer; cycleDays: number }

function parseOffer(v: unknown): AutoRenewOffer | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as { available?: unknown; message?: unknown }
  return {
    available: o.available === true,
    message: typeof o.message === 'string' && o.message ? o.message : null,
  }
}

/**
 * What the subscription service's `GET /api/subscription/status` answered:
 * a subscription (`success` + `data`), none (`code: NO_SUBSCRIPTION` with the
 * offer), or nothing to show (unknown key, an error, an older service that
 * cannot say whether auto-renew is possible).
 */
export function parseSubscriptionStatus(json: unknown): SubscriptionPanelInput | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null
  const j = json as { success?: unknown; data?: unknown; code?: unknown; autoRenew?: unknown; cycleDays?: unknown }
  const offer = parseOffer(j.autoRenew)
  if (j.success === true && j.data && typeof j.data === 'object' && !Array.isArray(j.data)) {
    return { kind: 'subscription', data: j.data as SubscriptionPanelData, offer }
  }
  if (j.success === false && j.code === 'NO_SUBSCRIPTION' && offer) {
    const cycle = Number(j.cycleDays)
    return { kind: 'none', offer, cycleDays: Number.isFinite(cycle) && cycle > 0 ? cycle : 30 }
  }
  return null
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m] as string))
}
function n(x: unknown): string {
  const v = Number(x)
  return Number.isFinite(v) ? v.toLocaleString('en-US') : '—'
}
function money(x: unknown): string {
  const v = Number(x)
  return Number.isFinite(v) ? `$${v.toFixed(2)}` : '—'
}
/** "October 13, 2026" — in UTC, the clock the subscription service keeps. */
function d(x: string | null): string {
  if (!x) return '—'
  const dt = new Date(x)
  return isNaN(dt.getTime())
    ? '—'
    : dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

const CARD = 'bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 mb-6 animate-fade-in'
const BUTTON_PRIMARY =
  'inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors focus-ring'
const ICON = `<div class="p-3 bg-slate-100 dark:bg-slate-700 rounded-xl flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      </div>`

const BADGES = {
  on: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  paused: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  off: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}
function badge(tone: keyof typeof BADGES, text: string): string {
  return `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${BADGES[tone]}">${text}</span>`
}

function header(badgeHtml: string, lead: string, action = ''): string {
  return `
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-start gap-3 min-w-0">
        ${ICON}
        <div class="min-w-0">
          <h3 id="autoRenewHeading" class="text-lg font-semibold flex items-center gap-2">Auto-renew ${badgeHtml}</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">${lead}</p>
        </div>
      </div>
      ${action}
    </div>`
}

function turnOnLink(url: string, label: string): string {
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="${BUTTON_PRIMARY}">${label}</a>`
}

/** No subscription: offer one, or say why the key cannot have one. */
function renderOff(input: { offer: AutoRenewOffer; cycleDays: number }, autoRenewUrl: string | null): string {
  if (!autoRenewUrl) return ''
  const { offer, cycleDays } = input
  const lead =
    `Never run out of requests: PayPal recharges this key every ${n(cycleDays)} days with the amount you choose. ` +
    'Same key, no code changes. Turn it off anytime.'
  const action = offer.available ? turnOnLink(autoRenewUrl, 'Turn on auto-renew') : ''
  const reason =
    !offer.available && offer.message
      ? `<p class="mt-4 text-sm text-amber-700 dark:text-amber-400">${esc(offer.message)}</p>`
      : ''
  return `
  <section class="${CARD}" aria-labelledby="autoRenewHeading">
    ${header(badge('off', 'Off'), lead, action)}
    ${reason}
  </section>`
}

function stat(label: string, value: string): string {
  return `<div class="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
        <p class="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">${label}</p>
        <p class="font-semibold mt-1">${value}</p>
      </div>`
}

function renderSubscription(
  data: SubscriptionPanelData,
  offer: AutoRenewOffer | null,
  dashboardPath: string,
  autoRenewUrl: string | null,
): string {
  const active = data.status === 'active'
  const suspended = data.status === 'suspended'
  const ended = data.status === 'cancelled' || data.status === 'expired'

  let badgeHtml = badge('on', 'On')
  let lead = `PayPal charges ${money(data.price)} each cycle and adds ${n(data.requestsAmount)} requests to this key.`
  if (suspended) {
    badgeHtml = badge('paused', 'Paused')
    lead = 'PayPal could not collect the last payment and paused auto-renew. Contact support and we will restart it.'
  } else if (ended) {
    badgeHtml = badge('off', 'Off')
    lead = data.graceEndsAt
      ? `Auto-renew was turned off. The requests left on this key stay usable through <strong>${d(data.graceEndsAt)}</strong>.`
      : 'Auto-renew was turned off.'
  } else if (!active) {
    lead = 'Waiting for PayPal to confirm the first payment.'
  }

  const backOn =
    ended && autoRenewUrl && offer?.available ? turnOnLink(autoRenewUrl, 'Turn auto-renew back on') : ''
  const reason =
    ended && offer && !offer.available && offer.message
      ? `<p class="mt-4 text-sm text-amber-700 dark:text-amber-400">${esc(offer.message)}</p>`
      : ''

  const stats = ended
    ? ''
    : `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      ${stat('Requests per cycle', n(data.requestsAmount))}
      ${stat('Price per cycle', money(data.price))}
      ${stat('Balance', n(data.balance))}
      ${stat('Next charge', d(data.currentPeriodEnd))}
    </div>`

  const pendingRow = data.pendingChange
    ? `<p class="mt-4 text-sm text-slate-500 dark:text-slate-400">
         Pending change next cycle: <strong>${n(data.pendingChange.requestsAmount)}</strong> requests
         (${money(data.pendingChange.price)}/cycle)
       </p>`
    : ''

  const changeForm = active
    ? `<form method="POST" action="${esc(dashboardPath)}/subscription/change" class="mt-6 flex flex-wrap items-end gap-3">
         <label class="text-sm">
           <span class="block text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Requests per cycle</span>
           <input type="number" name="requestsAmount" min="50000" step="50000" value="${esc(String(data.requestsAmount))}"
             class="w-40 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus-ring">
         </label>
         <button type="submit" class="${BUTTON_PRIMARY}">Change from next cycle</button>
       </form>
       <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">A higher amount may ask you to approve the new price on PayPal.</p>`
    : ''

  const cancelForm = active || suspended
    ? `<form method="POST" action="${esc(dashboardPath)}/subscription/cancel" class="mt-4"
             onsubmit="return confirm('Turn off auto-renew? The requests left on this key stay usable for the grace period.');">
         <button type="submit" class="inline-flex items-center px-4 py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors focus-ring">Turn off auto-renew</button>
       </form>`
    : ''

  return `
  <section class="${CARD}" aria-labelledby="autoRenewHeading">
    ${header(badgeHtml, lead, backOn)}
    ${reason}
    ${stats}
    ${pendingRow}
    ${changeForm}
    ${cancelForm}
  </section>`
}

/**
 * The section's HTML, or '' when there is nothing to show. `autoRenewUrl`
 * is the checkout link that starts auto-renew for this key (null when no
 * checkout is configured: then a key without a subscription shows nothing).
 */
export function renderSubscriptionPanel(
  input: SubscriptionPanelInput | null,
  dashboardPath: string,
  autoRenewUrl: string | null,
): string {
  if (!input) return ''
  if (input.kind === 'none') return renderOff(input, autoRenewUrl)
  return renderSubscription(input.data, input.offer ?? null, dashboardPath, autoRenewUrl)
}
