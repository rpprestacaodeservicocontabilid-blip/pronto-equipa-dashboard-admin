export const subscriptionSections = [
  { path: 'overview', title: 'Subscriptions overview', group: 'Overview', view: 'report' },
  { path: 'plans', title: 'Commercial plans and versions', group: 'Catalogue', view: 'plans' },
  { path: 'features', title: 'Feature catalogue', group: 'Catalogue', view: 'features' },
  { path: 'limits', title: 'Plan limits and prices', group: 'Catalogue', view: 'plans' },
  { path: 'directory', title: 'All subscriptions', group: 'Subscriptions', view: 'subscriptions' },
  { path: 'active', title: 'Active subscriptions', group: 'Subscriptions', view: 'subscriptions', status: 'ACTIVE' },
  { path: 'trials', title: 'Trial periods', group: 'Subscriptions', view: 'subscriptions', status: 'TRIALING' },
  { path: 'pending-payment', title: 'Pending payment', group: 'Subscriptions', view: 'subscriptions', status: 'PENDING_PAYMENT' },
  { path: 'cancelled', title: 'Cancelled subscriptions', group: 'Subscriptions', view: 'subscriptions', status: 'CANCELLED' },
  { path: 'changes', title: 'Plan changes', group: 'Operations', view: 'records', resource: 'changes' },
  { path: 'renewals', title: 'Renewals and billing periods', group: 'Operations', view: 'records', resource: 'periods' },
  { path: 'usage', title: 'Usage and quotas', group: 'Operations', view: 'records', resource: 'usage' },
  { path: 'overrides', title: 'Commercial exceptions', group: 'Operations', view: 'records', resource: 'overrides' },
  { path: 'grace', title: 'Grace periods', group: 'Access restrictions', view: 'subscriptions', status: 'GRACE_PERIOD' },
  { path: 'suspended', title: 'Suspended subscriptions', group: 'Access restrictions', view: 'subscriptions', status: 'SUSPENDED' },
  { path: 'alerts', title: 'Subscription alerts', group: 'Oversight', view: 'records', resource: 'alerts' },
  { path: 'history', title: 'Subscription history', group: 'Oversight', view: 'records', resource: 'history' },
  { path: 'reports', title: 'Commercial reports', group: 'Oversight', view: 'report' },
  { path: 'policies', title: 'Commercial policies', group: 'Settings', view: 'policy' },
] as const;

export interface SubscriptionSection {
  path: string; title: string; group: string; view: string; status?: string; resource?: string;
}
