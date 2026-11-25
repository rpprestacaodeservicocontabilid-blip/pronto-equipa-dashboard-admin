export const OPERATIONS_SECTIONS = [
  { path: 'overview', title: 'Overview', endpoint: 'overview' },
  { path: 'services', title: 'Service health', endpoint: 'overview' },
  { path: 'infrastructure', title: 'API process', endpoint: 'overview' },
  { path: 'queues', title: 'Queues and job counts', endpoint: 'queues' },
  { path: 'workers', title: 'Local workers', endpoint: 'queues' },
  { path: 'scheduled-jobs', title: 'Scheduled jobs', endpoint: 'scheduled-jobs' },
] as const;

export type OperationsSection = (typeof OPERATIONS_SECTIONS)[number];
