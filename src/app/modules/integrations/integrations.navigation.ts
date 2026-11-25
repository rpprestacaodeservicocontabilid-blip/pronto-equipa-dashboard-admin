export type IntegrationSource = 'PAYMENTS' | 'NOTIFICATIONS' | 'AI';
export interface IntegrationSection {
  path: string;
  title: string;
  source?: IntegrationSource;
  ownerPath?: string;
  ownerGrant?: string;
}
export const INTEGRATION_SECTIONS: readonly IntegrationSection[] = [
  { path: 'overview', title: 'Overview' },
  { path: 'catalogue', title: 'Provider catalogue' },
  { path: 'payment-providers', title: 'Salary payment providers', source: 'PAYMENTS', ownerPath: '/payments/providers',
    ownerGrant: 'payments.platform.integrations.read' },
  { path: 'delivery-channels', title: 'Notification channels', source: 'NOTIFICATIONS', ownerPath: '/notifications/providers',
    ownerGrant: 'platform:notifications:providers:read' },
  { path: 'ai-providers', title: 'AI providers', source: 'AI', ownerPath: '/ai-assistant/providers' },
];
