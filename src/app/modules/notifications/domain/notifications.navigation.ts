export const notificationGrant = (key: string) => 'platform:notifications:' + key;
export const NOTIFICATIONS_ACCESS = notificationGrant('access');
export interface NotificationsSection {
  path: string;
  title: string;
  group: string;
  endpoint: string;
  permission: string;
  view: 'list' | 'report' | 'providers' | 'settings' | 'policy';
  status?: string;
  platformOnly?: boolean;
  columns?: ReadonlyArray<{ key: string; title: string }>;
}
const list = (path: string, title: string, group: string, endpoint: string, permission: string,
  columns: Record<string, string>, status?: string): NotificationsSection =>
  ({ path, title, group, endpoint, permission, view: 'list', status, columns: Object.entries(columns).map(([key, title]) => ({ key, title })) });
const messages = { category: 'Category', templateCode: 'Template', channels: 'Channels', recipientCount: 'Recipients', scheduledAt: 'Scheduled' };
const deliveries = { channel: 'Channel', messageId: 'Notification', attempts: 'Attempts', scheduledAt: 'Scheduled' };
export const NOTIFICATION_SECTIONS: readonly NotificationsSection[] = [
  { path: 'overview', title: 'Notifications overview', group: 'Overview', endpoint: 'dashboard', permission: 'reports:read', view: 'report' },
  list('messages', 'All notifications', 'Notifications', 'messages', 'campaigns:read', messages),
  list('pending', 'Pending notifications', 'Notifications', 'messages', 'campaigns:read', messages, 'PENDING'),
  list('processed', 'Processed notifications', 'Notifications', 'messages', 'campaigns:read', messages, 'COMPLETED'),
  list('incomplete', 'Partially completed notifications', 'Notifications', 'messages', 'campaigns:read', messages, 'PARTIALLY_COMPLETED'),
  list('campaigns', 'Campaigns', 'Campaigns', 'campaigns', 'campaigns:read', messages),
  list('templates', 'Message templates', 'Templates', 'templates', 'templates:read', { code: 'Code', category: 'Category', subject: 'Subject', version: 'Version' }),
  { path: 'channels', title: 'Channel availability', group: 'Channels', endpoint: 'providers', permission: 'providers:read', view: 'providers', platformOnly: true },
  { path: 'providers', title: 'Delivery providers', group: 'Channels', endpoint: 'providers', permission: 'providers:read', view: 'providers', platformOnly: true },
  list('rules', 'Automatic rules', 'Rules', 'rules', 'rules:read', { code: 'Code', eventType: 'Event', template: 'Template', category: 'Category', channels: 'Channels' }),
  list('scheduled', 'Scheduled sends', 'Scheduling', 'messages', 'campaigns:read', messages, 'SCHEDULED'),
  list('cancelled', 'Cancelled sends', 'Scheduling', 'messages', 'campaigns:read', messages, 'CANCELLED'),
  list('deliveries', 'All deliveries', 'Deliveries', 'deliveries', 'deliveries:read', deliveries),
  list('failures', 'Permanent failures', 'Deliveries', 'deliveries', 'deliveries:read', deliveries, 'FAILED_PERMANENT'),
  list('unknown', 'Unconfirmed deliveries', 'Deliveries', 'deliveries', 'deliveries:read', deliveries, 'UNKNOWN'),
  { path: 'policies', title: 'Category and mandatory policy', group: 'Preferences', endpoint: 'preferences-policy', permission: 'templates:read', view: 'policy' },
  list('quotas', 'Daily quotas', 'Quotas', 'quotas', 'quotas:read', { period: 'Period (UTC)', used: 'Consumed units' }),
  { path: 'reports', title: 'Delivery reports', group: 'Reports', endpoint: 'reports', permission: 'reports:read', view: 'report' },
  list('audit', 'Notification audit', 'Audit', 'audit', 'audit:read', { action: 'Action', actor: 'Actor', id: 'Reference' }),
  { path: 'settings', title: 'Retention and defaults', group: 'Settings', endpoint: 'settings', permission: 'providers:read', view: 'settings', platformOnly: true },
];
