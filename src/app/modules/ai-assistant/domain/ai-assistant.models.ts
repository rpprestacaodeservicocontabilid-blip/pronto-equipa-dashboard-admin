export type AiValue = string | number | boolean | string[] | null;
export type AiRow = Record<string, AiValue> & { id: string | number };

export interface AiPage<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface AiCompany { id: number; name: string }

export interface AiProviderInput {
  code: string;
  name: string;
  status: string;
  timeoutMs: number;
  priority: number;
}

export interface AiModelInput {
  providerId: string;
  modelCode: string;
  displayName: string;
  status: string;
  isDefault: boolean;
  temperature: number | null;
  maxOutputTokens: number | null;
  currency: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
}

export interface AiPromptInput { templateCode: string; content: string }
export interface AiPrompt extends AiPromptInput { id: string; version: number; status: string }

export interface AiEvaluationCase { name: string; expectedBehaviour: string }
export interface AiEvaluationInput { code: string; cases: AiEvaluationCase[] }
export type AiIncidentStatus = 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
