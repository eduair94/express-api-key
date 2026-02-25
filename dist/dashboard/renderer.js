"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDashboard = renderDashboard;
exports.renderErrorPage = renderErrorPage;
exports.renderApiKeyRequiredPage = renderApiKeyRequiredPage;
exports.renderInvalidApiKeyPage = renderInvalidApiKeyPage;
exports.renderLoginPage = renderLoginPage;
exports.renderStatusPage = renderStatusPage;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Cache templates in memory for performance
const templateCache = new Map();
/**
 * Loads a template file from the templates directory
 */
function loadTemplate(templateName) {
    if (templateCache.has(templateName)) {
        return templateCache.get(templateName);
    }
    const templatePath = path.join(__dirname, 'templates', templateName);
    const template = fs.readFileSync(templatePath, 'utf-8');
    templateCache.set(templateName, template);
    return template;
}
/**
 * Simple template engine - replaces {{placeholder}} with values
 */
function render(template, data) {
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
function generateAllowedEndpointsSection(allowedEndpoints) {
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
function generateInsightsContent(data) {
    const insights = [];
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
    }
    else {
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
function escapeHtml(text) {
    const map = {
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
function formatDate(date, options) {
    if (!date)
        return 'Never';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-US', options);
}
/**
 * Formats a date with month, day, year
 */
function formatDateLong(date) {
    if (!date)
        return 'Not yet';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
/**
 * Renders the main dashboard HTML
 */
function renderDashboard(data, dashboardPath = '/dashboard') {
    var _a, _b, _c;
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
        ? formatDateLong(data.keyExpiresAt)
        : 'Activate to start countdown';
    const templateData = {
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
        renewalDaysDisplay: data.hasPerKeyQuota
            ? '—'
            : (data.renewalDays !== null ? data.renewalDays.toString() : '—'),
        renewalDateDisplay: data.hasPerKeyQuota
            ? 'Manual renewal only'
            : (data.renewalDate ? formatDateLong(data.renewalDate) : 'Not started yet'),
        // Key expiration
        keyExpiringSoonBadge,
        keyExpiresDaysDisplay,
        keyExpiresDateDisplay: keyExpiresDateFormatted,
        // Rate limit
        minIntervalSeconds: (_b = (_a = data.roleInfo) === null || _a === void 0 ? void 0 : _a.minIntervalSeconds) !== null && _b !== void 0 ? _b : 2,
        // Details - must match template placeholders
        lastUsedAtDisplay: formatDate(data.lastUsedAt),
        requestCountStartDisplay: data.requestCountStart ? formatDate(data.requestCountStart) : 'Not yet',
        daysValidDisplay: data.daysValid ? `${data.daysValid} days from first use` : 'Unlimited',
        createdAtDisplay: data.createdAt ? formatDate(data.createdAt) : 'Unknown',
        // Dynamic sections
        allowedEndpointsSection: generateAllowedEndpointsSection((_c = data.roleInfo) === null || _c === void 0 ? void 0 : _c.allowedEndpoints),
        insightsContent: generateInsightsContent(data),
        // Footer
        lastUpdated: new Date().toLocaleString(),
    };
    return render(template, templateData);
}
/**
 * Renders an error page
 */
function renderErrorPage(options) {
    const template = loadTemplate('error.html');
    return render(template, options);
}
/**
 * Renders the "API Key Required" error page
 */
function renderApiKeyRequiredPage(headerName) {
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
function renderInvalidApiKeyPage() {
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
function renderLoginPage(options = {}) {
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
/**
 * Generates a role card HTML for the status page
 */
function generateRoleCard(role, index) {
    var _a, _b;
    const name = escapeHtml(role.name || 'Unknown');
    const rateLimit = (_a = role.minIntervalSeconds) !== null && _a !== void 0 ? _a : 2;
    const monthlyQuota = (_b = role.maxMonthlyUsage) !== null && _b !== void 0 ? _b : 10000;
    const responseLatency = role.responseLatency;
    const timeout = role.timeout;
    const concurrency = role.concurrency;
    const batchLimit = role.batchLimit;
    const batchTTL = role.batchTTL;
    const staggerClass = `stagger-${(index % 4) + 1}`;
    const metrics = [
        {
            label: 'Rate Limit',
            value: `${rateLimit}s`,
            sublabel: 'Min interval between requests',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>`,
            color: 'indigo',
        },
        {
            label: 'Monthly Quota',
            value: monthlyQuota.toLocaleString(),
            sublabel: 'Requests per month',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>`,
            color: 'blue',
        },
        {
            label: 'Response Latency',
            value: responseLatency != null ? `${responseLatency}ms` : '—',
            sublabel: responseLatency != null ? 'Max response time' : 'No limit configured',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
            color: 'emerald',
        },
        {
            label: 'Timeout',
            value: timeout != null ? `${timeout}s` : '—',
            sublabel: timeout != null ? 'Request timeout' : 'No limit configured',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.25 9v6m-4.5 0V9M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
            color: 'amber',
        },
        {
            label: 'Concurrency',
            value: concurrency != null ? `${concurrency}` : '—',
            sublabel: concurrency != null ? 'Max concurrent requests' : 'No limit configured',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122" /></svg>`,
            color: 'purple',
        },
        {
            label: 'Batch Limit',
            value: batchLimit != null ? `${batchLimit}` : '—',
            sublabel: batchLimit != null ? 'Max items per batch' : 'No limit configured',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>`,
            color: 'rose',
        },
        {
            label: 'TTL (Batch)',
            value: batchTTL != null ? `${batchTTL}s` : '—',
            sublabel: batchTTL != null ? 'Batch time-to-live' : 'No limit configured',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
            color: 'cyan',
        },
    ];
    const metricsHtml = metrics.map(m => {
        const colorMap = {
            indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-500', iconBg: 'bg-indigo-100 dark:bg-indigo-900/40' },
            blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-500', iconBg: 'bg-blue-100 dark:bg-blue-900/40' },
            emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-500', iconBg: 'bg-emerald-100 dark:bg-emerald-900/40' },
            amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-500', iconBg: 'bg-amber-100 dark:bg-amber-900/40' },
            purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-500', iconBg: 'bg-purple-100 dark:bg-purple-900/40' },
            rose: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-500', iconBg: 'bg-rose-100 dark:bg-rose-900/40' },
            cyan: { bg: 'bg-cyan-50 dark:bg-cyan-900/20', text: 'text-cyan-500', iconBg: 'bg-cyan-100 dark:bg-cyan-900/40' },
        };
        const c = colorMap[m.color] || colorMap.indigo;
        const isConfigured = m.value !== '—';
        const opacity = isConfigured ? '' : 'opacity-50';
        return `
      <div class="flex items-center gap-3 p-3 ${c.bg} rounded-xl ${opacity}">
        <div class="flex-shrink-0 w-9 h-9 flex items-center justify-center ${c.iconBg} rounded-lg ${c.text}">
          ${m.icon}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">${m.label}</p>
          <p class="text-lg font-bold mt-0.5">${m.value}</p>
          <p class="text-xs text-slate-400 dark:text-slate-500">${m.sublabel}</p>
        </div>
      </div>
    `;
    }).join('');
    // Allowed endpoints section
    let endpointsHtml = '';
    if (role.allowedEndpoints && role.allowedEndpoints.length > 0) {
        const tags = role.allowedEndpoints.map((ep) => `
      <span class="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-600 rounded text-xs font-mono">
        ${escapeHtml(ep)}
      </span>
    `).join('');
        endpointsHtml = `
      <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
        <p class="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Allowed Endpoints</p>
        <div class="flex flex-wrap gap-1.5">${tags}</div>
      </div>
    `;
    }
    return `
    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden card-hover animate-fade-in ${staggerClass}">
      <div class="gradient-primary p-5">
        <h3 class="text-xl font-bold text-white flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          ${name}
        </h3>
      </div>
      <div class="p-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${metricsHtml}
        </div>
        ${endpointsHtml}
      </div>
    </div>
  `;
}
/**
 * Renders the public status page showing all roles and their limits
 */
function renderStatusPage(roles, statusPagePath = '/status') {
    const template = loadTemplate('status.html');
    let rolesContent = '';
    if (roles.length === 0) {
        rolesContent = `
      <div class="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-slate-700 text-center animate-fade-in">
        <p class="text-slate-500 dark:text-slate-400">No roles have been configured yet.</p>
      </div>
    `;
    }
    else {
        const cards = roles.map((role, i) => generateRoleCard(role, i)).join('');
        rolesContent = `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        ${cards}
      </div>
    `;
    }
    return render(template, {
        cssPath: `${statusPagePath}/css`,
        rolesContent,
        lastUpdated: new Date().toLocaleString(),
    });
}
