export interface AiColumn {
  readonly key: string;
  readonly title: string;
  readonly format?: 'date' | 'number' | 'boolean' | 'status' | 'reference';
}

export interface AiSection {
  readonly path: string;
  readonly title: string;
  readonly group: string;
  readonly endpoint: string;
  readonly scope?: 'company' | 'optional';
  readonly month?: boolean;
  readonly columns: readonly AiColumn[];
}

const column = (key: string, title: string, format?: AiColumn['format']): AiColumn => ({ key, title, format });
const status = column('status', 'Status', 'status');
const reference = column('id', 'Reference', 'reference');
const created = column('createdAt', 'Created', 'date');
const provider = column('providerId', 'Provider', 'reference');
const model = column('modelId', 'Model', 'reference');

export const AI_SECTIONS: readonly AiSection[] = [
  { path: 'overview', title: $localize`:@@ui-thnxru:Overview`, group: 'Overview', endpoint: 'dashboard', scope: 'optional', month: true, columns: [] },
  { path: 'conversations', title: 'Conversations', group: 'Assistant', endpoint: 'conversations', scope: 'company', columns: [reference, status, created, column('lastMessageAt', 'Last message', 'date')] },
  { path: 'sessions', title: 'Session history', group: 'Assistant', endpoint: 'sessions', scope: 'company', columns: [reference, column('conversationId', 'Conversation', 'reference'), status, model, column('citationCount', 'Citations', 'number'), created] },
  { path: 'providers', title: 'Providers', group: 'AI models', endpoint: 'providers', columns: [column('name', 'Provider'), column('code', 'Code'), status, column('timeoutMs', 'Timeout (ms)', 'number'), column('priority', 'Priority', 'number')] },
  { path: 'models', title: 'Model configurations', group: 'AI models', endpoint: 'models', columns: [column('displayName', 'Model'), column('modelCode', 'Code'), provider, status, column('isDefault', 'Default', 'boolean'), column('currency', 'Currency')] },
  { path: 'prompts', title: 'Versions and publication', group: 'Prompts', endpoint: 'prompts', columns: [column('templateCode', 'Template'), column('version', 'Version', 'number'), status, created, column('publishedAt', 'Published', 'date')] },
  { path: 'tools', title: 'Catalogue and permissions', group: 'Tools', endpoint: 'tools', columns: [column('name', 'Tool'), column('version', 'Version'), column('riskLevel', 'Risk', 'status'), status, column('requiredPermissions', 'Required permissions'), column('requiresApproval', 'Approval required', 'boolean')] },
  { path: 'tool-executions', title: 'Tool executions', group: 'Tools', endpoint: 'tool-executions', scope: 'company', columns: [reference, column('toolName', 'Tool'), status, column('startedAt', 'Started', 'date'), column('finishedAt', 'Finished', 'date')] },
  { path: 'knowledge', title: 'Sources and documents', group: 'Knowledge base', endpoint: 'knowledge/sources', scope: 'optional', columns: [reference, column('sourceType', 'Type'), column('classification', 'Classification'), status, column('documentCount', 'Documents', 'number'), column('chunkCount', 'Chunks', 'number'), column('lastIndexedAt', 'Last indexed', 'date')] },
  { path: 'indexing-jobs', title: 'Indexing jobs', group: 'Knowledge base', endpoint: 'knowledge/indexing-jobs', scope: 'company', columns: [reference, column('sourceId', 'Source', 'reference'), column('kind', 'Kind'), status, column('attempts', 'Attempts', 'number'), created] },
  { path: 'approvals', title: 'Proposals and approvals', group: 'Automation', endpoint: 'actions/approvals', scope: 'company', columns: [reference, column('toolName', 'Tool'), column('riskLevel', 'Risk', 'status'), status, column('expiresAt', 'Expires', 'date'), created] },
  { path: 'incidents', title: 'Safety incidents', group: 'Safety', endpoint: 'safety-incidents', scope: 'company', columns: [reference, column('category', 'Category', 'status'), column('severity', 'Severity', 'status'), status, created] },
  { path: 'usage', title: 'Requests, tokens and quotas', group: 'Usage', endpoint: 'usage', scope: 'company', month: true, columns: [column('period', 'Month'), column('usedMessages', 'Messages', 'number'), column('quotaMessages', 'Message quota', 'number'), column('usedTokens', 'Tokens', 'number'), column('quotaTokens', 'Token quota', 'number'), column('usedToolExecutions', 'Tool executions', 'number'), column('quotaToolExecutions', 'Tool quota', 'number')] },
  { path: 'costs', title: 'Costs by provider and model', group: 'Costs', endpoint: 'costs', scope: 'company', month: true, columns: [provider, model, column('currency', 'Currency'), column('amount', 'Cost', 'number'), column('estimated', 'Estimated', 'boolean')] },
  { path: 'evaluations', title: 'Quality evaluations', group: 'Evaluations', endpoint: 'evaluations', columns: [column('code', 'Evaluation'), column('version', 'Version', 'number'), status, column('lastScore', 'Last score', 'number'), column('lastRunAt', 'Last run', 'date')] },
  { path: 'feedback', title: 'Feedback', group: 'Evaluations', endpoint: 'feedback', scope: 'company', columns: [reference, column('rating', 'Rating', 'number'), column('category', 'Category'), created] },
  { path: 'performance', title: 'Model performance', group: 'Reports', endpoint: 'performance', scope: 'company', columns: [reference, provider, model, status, column('latencyMs', 'Latency (ms)', 'number'), column('fallbackUsed', 'Fallback used', 'boolean'), created] },
  { path: 'audit', title: 'Administrative audit', group: 'Audit', endpoint: 'audit', columns: [column('action', 'Event'), column('entityType', 'Entity'), column('entityId', 'Reference', 'reference'), column('actorUserId', 'Administrator'), created] },
  { path: 'settings', title: 'Safety policy versions', group: 'Settings', endpoint: 'settings', columns: [column('scopeKey', 'Scope'), column('version', 'Version', 'number'), status, column('updatedAt', 'Updated', 'date')] },
];
