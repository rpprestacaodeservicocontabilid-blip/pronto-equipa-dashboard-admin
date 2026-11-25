export const notificationChannels = ['IN_APP', 'EMAIL', 'SMS'] as const;
export type NotificationChannel = typeof notificationChannels[number];
export type InboxFilter = '' | 'UNREAD' | 'READ' | 'ARCHIVED';
export const notificationCategories = [
  'SYSTEM', 'SECURITY', 'ONBOARDING', 'EMPLOYEE', 'CONTRACT', 'LEAVE', 'ATTENDANCE', 'LOAN',
  'PAYROLL', 'PAYSLIP', 'PAYMENT', 'SUBSCRIPTION', 'BILLING', 'DOCUMENT', 'SUPPORT', 'APPROVAL',
  'REMINDER', 'ANNOUNCEMENT',
] as const;
export const manualCategories = ['SYSTEM', 'ANNOUNCEMENT', 'REMINDER'] as const;
export const notificationLabel = (value: string) =>
  value === 'SMS' ? value : value.toLowerCase().replaceAll('_', ' ').replace(/^./, first => first.toUpperCase());

export interface NotificationCompany { id: number; name: string }
export interface NotificationPage<T> { items: T[]; page: number; limit: number; total: number }
export interface NotificationRecord {
  id: string;
  status: string;
  kind: string;
  createdAt: string;
  updatedAt: string;
  period?: string;
  data: Record<string, unknown>;
}
export interface InboxItem {
  id: string;
  createdAt: string;
  data: { subject: string; body: string; category?: string; readState: Exclude<InboxFilter, ''>; readAt?: string };
}
export interface NotificationPreference { category: string; channel: NotificationChannel; enabled: boolean }
export interface NotificationProviderView { channel: NotificationChannel; configured: boolean; recipientsAvailable: boolean }
export interface NotificationReport {
  messages: number;
  totalDeliveries: number;
  byStatus: Record<string, number>;
  byChannel: Record<string, number>;
}
export interface NotificationSettings { retentionDays: number; cleanupEnabled: boolean; dailyQuota: number }
export interface NotificationPolicy { code: string; category: string; mandatory: boolean; version: number }
export interface TemplatePreview { subject: string; bodyText: string; version: number }
export const templateKeys = (...chunks: string[]) => [...new Set(chunks.flatMap(chunk =>
  [...chunk.matchAll(/\{\{([a-zA-Z0-9_.]+)\}\}/g)].map(match => match[1])))];
