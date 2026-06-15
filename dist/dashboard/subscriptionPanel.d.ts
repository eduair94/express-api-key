/**
 * Pure renderer for the dashboard "Subscription" section.
 * Returns '' when there is no subscription (panel hidden). No IO.
 */
export interface SubscriptionPanelData {
    subscriptionId: string;
    status: 'pending' | 'active' | 'cancelled' | 'suspended' | 'expired';
    requestsAmount: number;
    price: number;
    balance: number;
    capTotal: number;
    used: number;
    currentPeriodEnd: string | null;
    graceEndsAt: string | null;
    pendingChange: {
        requestsAmount: number;
        price: number;
    } | null;
    expiresAt: string | null;
}
export declare function renderSubscriptionPanel(data: SubscriptionPanelData | null, dashboardPath: string): string;
