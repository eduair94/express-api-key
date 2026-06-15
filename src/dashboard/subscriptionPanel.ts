/**
 * Pure renderer for the dashboard "Subscription" section.
 * Returns '' when there is no subscription (panel hidden). No IO.
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

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m] as string))
}
function n(x: number): string { return x.toLocaleString('en-US') }
function d(x: string | null): string {
  if (!x) return '—'
  const dt = new Date(x)
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function renderSubscriptionPanel(data: SubscriptionPanelData | null, dashboardPath: string): string {
  if (!data) return ''
  const active = data.status === 'active'
  const cancelledOrEnding = data.status === 'cancelled' || data.status === 'expired'

  const pendingRow = data.pendingChange
    ? `<p style="margin:6px 0;color:var(--text-secondary,#64748b);font-size:13px;">
         Pending change next cycle: <strong>${n(data.pendingChange.requestsAmount)}</strong> tokens
         ($${data.pendingChange.price.toFixed(2)}/cycle)
       </p>`
    : ''

  const graceRow = data.graceEndsAt
    ? `<p style="margin:6px 0;color:#b45309;font-size:13px;">
         Cancelled — tokens usable through <strong>${d(data.graceEndsAt)}</strong>
       </p>`
    : ''

  const changeForm = active
    ? `<form method="POST" action="${esc(dashboardPath)}/subscription/change" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
         <label style="font-size:13px;">New monthly tokens:
           <input type="number" name="requestsAmount" min="50000" step="50000" value="${data.requestsAmount}"
             style="margin-left:6px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;width:140px;">
         </label>
         <button type="submit" style="padding:8px 14px;border:0;border-radius:8px;background:#4f46e5;color:#fff;cursor:pointer;">Change (next cycle)</button>
       </form>
       <p style="font-size:12px;color:var(--text-secondary,#64748b);margin-top:4px;">An increase may require re-approval on PayPal.</p>`
    : ''

  const cancelForm = active && !cancelledOrEnding
    ? `<form method="POST" action="${esc(dashboardPath)}/subscription/cancel" style="margin-top:8px;"
             onsubmit="return confirm('Cancel subscription? Remaining tokens stay usable for the grace period.');">
         <button type="submit" style="padding:8px 14px;border:1px solid #ef4444;border-radius:8px;background:transparent;color:#ef4444;cursor:pointer;">Cancel subscription</button>
       </form>`
    : ''

  return `
  <div class="card animate-fade-in" style="margin-top:24px;padding:20px;border:1px solid #e2e8f0;border-radius:16px;">
    <h3 style="margin:0 0 12px;font-size:18px;display:flex;align-items:center;gap:8px;">🔁 Subscription</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;">
      <div><p style="font-size:12px;color:#64748b;text-transform:uppercase;">Status</p><p style="font-size:18px;font-weight:700;">${esc(data.status)}</p></div>
      <div><p style="font-size:12px;color:#64748b;text-transform:uppercase;">Tokens / cycle</p><p style="font-size:18px;font-weight:700;">${n(data.requestsAmount)}</p></div>
      <div><p style="font-size:12px;color:#64748b;text-transform:uppercase;">Balance</p><p style="font-size:18px;font-weight:700;">${n(data.balance)}</p></div>
      <div><p style="font-size:12px;color:#64748b;text-transform:uppercase;">Next billing</p><p style="font-size:18px;font-weight:700;">${d(data.currentPeriodEnd)}</p></div>
    </div>
    ${pendingRow}
    ${graceRow}
    ${changeForm}
    ${cancelForm}
  </div>`
}
