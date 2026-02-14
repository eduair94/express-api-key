import { ComputedDashboardData } from './types';
/**
 * Renders the main dashboard HTML
 */
export declare function renderDashboard(data: ComputedDashboardData, dashboardPath?: string): string;
/**
 * Renders an error page
 */
export declare function renderErrorPage(options: {
    title: string;
    icon: string;
    heading: string;
    message: string;
}): string;
/**
 * Renders the "API Key Required" error page
 */
export declare function renderApiKeyRequiredPage(headerName: string): string;
/**
 * Renders the "Invalid API Key" error page
 */
export declare function renderInvalidApiKeyPage(): string;
/**
 * Renders the login page for dashboard authentication
 */
export declare function renderLoginPage(options?: {
    error?: string;
    dashboardPath?: string;
}): string;
