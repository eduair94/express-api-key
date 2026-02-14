import * as fs from 'fs';
import * as path from 'path';
import { ComputedDashboardData } from './types';

// Cache templates in memory for performance
const templateCache: Map<string, string> = new Map();

/**
 * Loads a template file from the templates directory
 */
function loadTemplate(templateName: string): string {
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName)!;
  }

  const templatePath = path.join(__dirname, 'templates', templateName);
  const template = fs.readFileSync(templatePath, 'utf-8');
  templateCache.set(templateName, template);
  return template;
}

/**
 * Simple template engine - replaces {{placeholder}} with values
 */
function render(template: string, data: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = data[key];
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  });
}

/**
 * Generates the allowed endpoints HTML section
 */
function generateAllowedEndpointsSection(allowedEndpoints?: string[]): string {
  if (!allowedEndpoints || allowedEndpoints.length === 0) {
    return '';
  }

  const tags = allowedEndpoints.map(ep => `
    <span class="permission-tag">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      ${escapeHtml(ep)}
    </span>
  `).join('');

  return `
    <h4 style="margin-top:24px;margin-bottom:12px;font-size:14px;color:var(--text-secondary);">Allowed Endpoints</h4>
    <div class="permissions-list">
      ${tags}
    </div>
  `;
}

/**
 * Generates the insights section HTML
 */
function generateInsightsContent(data: ComputedDashboardData): string {
  const insights: string[] = [];

  // Usage insight
  if (Number(data.usagePercent) >= 80) {
    insights.push(`
      <div class="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
        <div class="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-red-100 dark:bg-red-900/40 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-semibold text-red-700 dark:text-red-400">High Usage Alert</h4>
          <p class="text-sm text-red-600 dark:text-red-300 mt-1">You've used ${data.usagePercent}% of your monthly quota. Consider upgrading your plan or optimizing API calls.</p>
        </div>
      </div>
    `);
  } else {
    insights.push(`
      <div class="flex items-start gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
        <div class="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-semibold text-emerald-700 dark:text-emerald-400">Usage Looking Good</h4>
          <p class="text-sm text-emerald-600 dark:text-emerald-300 mt-1">You're within healthy usage limits. Keep up the efficient API usage!</p>
        </div>
      </div>
    `);
  }

  // Key expiring insight
  if (data.keyExpiresDays !== null && data.keyExpiresDays <= 7 && data.keyExpiresDays > 0) {
    insights.push(`
      <div class="flex items-start gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
        <div class="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-amber-100 dark:bg-amber-900/40 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-semibold text-amber-700 dark:text-amber-400">Key Expiring Soon</h4>
          <p class="text-sm text-amber-600 dark:text-amber-300 mt-1">Your API key will expire in ${data.keyExpiresDays} days. Contact support to renew your key.</p>
        </div>
      </div>
    `);
  }

  // Quota reset insight
  if (data.renewalDays !== null && data.renewalDays <= 5) {
    insights.push(`
      <div class="flex items-start gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
        <div class="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-amber-100 dark:bg-amber-900/40 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-semibold text-amber-700 dark:text-amber-400">Quota Reset Coming</h4>
          <p class="text-sm text-amber-600 dark:text-amber-300 mt-1">Your usage quota will reset in ${data.renewalDays} days. Plan your API usage accordingly.</p>
        </div>
      </div>
    `);
  }

  // Pro tip (always shown)
  insights.push(`
    <div class="flex items-start gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl">
      <div class="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <h4 class="font-semibold text-indigo-700 dark:text-indigo-400">Pro Tip</h4>
        <p class="text-sm text-indigo-600 dark:text-indigo-300 mt-1">Implement caching on your end to reduce API calls and maximize your quota efficiency.</p>
      </div>
    </div>
  `);

  return insights.join('');
}

/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Formats a date for display
 */
function formatDate(date: Date | string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return 'Never';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', options);
}

/**
 * Formats a date with month, day, year
 */
function formatDateLong(date: Date | string | null): string {
  if (!date) return 'Not yet';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Renders the main dashboard HTML
 */
export function renderDashboard(data: ComputedDashboardData, dashboardPath: string = '/dashboard'): string {
  const template = loadTemplate('dashboard.html');

  // Prepare template variables
  const keyStatusText = data.keyExpiresDays !== null 
    ? (data.keyExpiresDays <= 0 ? 'Expired' : 'Active') 
    : 'Not activated';

  const usageStatusText = data.usageStatus === 'critical' 
    ? 'Critical' 
    : data.usageStatus === 'warning' 
      ? 'High Usage' 
      : 'Healthy';

  const keyExpiringSoonBadge = data.keyExpiresDays !== null && data.keyExpiresDays <= 7 
    ? '<span class="status-badge warning"><span class="status-dot"></span>Expiring Soon</span>' 
    : '';

  const keyExpiresDaysDisplay = data.keyExpiresDays !== null 
    ? (data.keyExpiresDays <= 0 ? 'Expired' : `${data.keyExpiresDays} <span style="font-size:18px;font-weight:400;">days</span>`)
    : '—';

  const keyExpiresDateFormatted = data.keyExpiresAt && data.keyExpiresAt !== 'Api key not used yet'
    ? formatDateLong(data.keyExpiresAt as string)
    : 'Activate to start countdown';

  const templateData: Record<string, string | number | null | undefined> = {
    // Paths
    logoutPath: `${dashboardPath}/logout`,
    cssPath: `${dashboardPath}/css`,

    // API Key info
    key: escapeHtml(data.key),
    role: escapeHtml(data.role),
    keyStatus: data.keyStatus,
    keyStatusText,

    // Usage stats
    requestCountMonth: data.requestCountMonth.toLocaleString(),
    remaining: data.remaining.toLocaleString(),
    usagePercent: data.usagePercent,
    monthlyCap: data.monthlyCap.toLocaleString(),
    usageStatus: data.usageStatus,
    usageStatusText,

    // Renewal info
    renewalDaysDisplay: data.renewalDays !== null ? data.renewalDays.toString() : '—',
    renewalDateDisplay: data.renewalDate ? formatDateLong(data.renewalDate) : 'Not started yet',

    // Key expiration
    keyExpiringSoonBadge,
    keyExpiresDaysDisplay,
    keyExpiresDateDisplay: keyExpiresDateFormatted,

    // Rate limit
    minIntervalSeconds: data.roleInfo?.minIntervalSeconds ?? 2,

    // Details - must match template placeholders
    lastUsedAtDisplay: formatDate(data.lastUsedAt),
    requestCountStartDisplay: data.requestCountStart ? formatDate(data.requestCountStart) : 'Not yet',
    daysValidDisplay: data.daysValid ? `${data.daysValid} days from first use` : 'Unlimited',
    createdAtDisplay: data.createdAt ? formatDate(data.createdAt) : 'Unknown',

    // Dynamic sections
    allowedEndpointsSection: generateAllowedEndpointsSection(data.roleInfo?.allowedEndpoints),
    insightsContent: generateInsightsContent(data),

    // Footer
    lastUpdated: new Date().toLocaleString(),
  };

  return render(template, templateData);
}

/**
 * Renders an error page
 */
export function renderErrorPage(options: {
  title: string;
  icon: string;
  heading: string;
  message: string;
}): string {
  const template = loadTemplate('error.html');
  return render(template, options);
}

/**
 * Renders the "API Key Required" error page
 */
export function renderApiKeyRequiredPage(headerName: string): string {
  return renderErrorPage({
    title: 'API Key Required',
    icon: '🔑',
    heading: 'API Key Required',
    message: `Please include your API key in the <code>${escapeHtml(headerName)}</code> header to access the dashboard.`,
  });
}

/**
 * Renders the "Invalid API Key" error page
 */
export function renderInvalidApiKeyPage(): string {
  return renderErrorPage({
    title: 'Invalid API Key',
    icon: '❌',
    heading: 'Invalid API Key',
    message: 'The provided API key was not found. Please check your key and try again.',
  });
}

/**
 * Renders the login page for dashboard authentication
 */
export function renderLoginPage(options: {
  error?: string;
  dashboardPath?: string;
} = {}): string {
  const template = loadTemplate('login.html');
  
  const errorDisplay = options.error 
    ? `<div class="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
        <p class="text-red-400 text-sm text-center">${escapeHtml(options.error)}</p>
      </div>`
    : '';
  
  return render(template, {
    errorMessage: errorDisplay,
    dashboardPath: options.dashboardPath || '/dashboard',
  });
}
