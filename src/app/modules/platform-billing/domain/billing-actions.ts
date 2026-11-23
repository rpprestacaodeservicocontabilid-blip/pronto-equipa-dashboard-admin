import { BillingLine, BillingRecord } from './billing.models';

export interface Field {
  name: string;
  label: string;
  type?: 'number' | 'email' | 'date' | 'textarea' | 'select';
  options?: string[];
  min?: number;
  max?: number;
  pattern?: string;
  default?: string | number;
}
export interface BillingAction {
  id: string;
  title: string;
  path: (record?: BillingRecord) => string;
  method?: 'PUT';
  fields?: Field[];
  lines?: true;
  key?: true;
  confirmation?: string;
  body?: Record<string, unknown>;
}
export type FormValues = Record<string, string | number | null>;
export const newBillingLine = (): BillingLine => ({
  description: '', quantity: 1, unitPrice: '', discount: '0.00', taxBasisPoints: null, taxRuleVersion: '',
});

const currency: Field = { name: 'currency', label: 'Currency (ISO code)', pattern: '[A-Z]{3}', default: 'AOA', max: 3 };
const amount: Field = { name: 'amount', label: 'Amount', pattern: '[0-9]{1,12}(\\.[0-9]{1,2})?', max: 15 };
const identifier = (name: string, label: string): Field => ({
  name, label, pattern: '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', max: 36,
});
const reason: Field = { name: 'reason', label: 'Reason', type: 'textarea', max: 2000 };
const date = (name: string, label: string): Field => ({ name, label, type: 'date' });
const integer = (name: string, label: string, min: number, max: number, initial?: number): Field => ({
  name, label, type: 'number', min, max, default: initial,
});
const identity: Field[] = [
  { name: 'name', label: 'Legal name', max: 200 }, { name: 'taxId', label: 'Tax ID', max: 80 },
  { name: 'address', label: 'Fiscal address', max: 500 }, { name: 'email', label: 'Billing email', type: 'email', max: 254 },
];
const evidence: Field = { name: 'evidence', label: 'Bank or provider evidence reference', type: 'textarea', max: 2000 };
const collection = (route: string) => () => route;
const transition = (route: string, verb: string) => (record?: BillingRecord) =>
  route + '/' + encodeURIComponent(record!.id) + '/' + verb;

const updateAccount: BillingAction = { id: 'account', title: 'Save billing details', path: collection('account'), method: 'PUT', fields: identity };

export const mainActions: Readonly<Record<string, BillingAction>> = {
  invoices: {
    id: 'draft', title: 'Create invoice draft', path: collection('invoices'), fields: [currency, date('dueAt', 'Payment due date')],
    lines: true, key: true,
  },
  schedules: {
    id: 'schedule', title: 'Create schedule', path: collection('schedules'), key: true, lines: true,
    fields: [identifier('subscriptionId', 'Subscription ID'), currency, date('nextAt', 'First invoice date'),
      integer('intervalMonths', 'Interval (months)', 1, 12, 1), integer('dueDays', 'Payment term (days)', 0, 365, 7)],
  },
  statements: {
    id: 'statement', title: 'Import bank entries', path: collection('statements'), key: true, fields: [
      { name: 'entries', label: 'Bank entries (reference, amount, currency, date)', type: 'textarea' },
    ],
  },
  'tax-rules': {
    id: 'tax', title: 'Create tax version', path: collection('tax-rules'),
    fields: [{ name: 'version', label: 'Version', max: 100 }, integer('basisPoints', 'Rate in basis points', 0, 10000),
      date('validFrom', 'Effective from'), date('validUntil', 'Effective until inclusive'), { name: 'legalReference', label: 'Validated fiscal reference', max: 1000 }],
    confirmation: 'This tax version is immutable once saved.',
  },
  series: {
    id: 'series', title: 'Configure document series', path: collection('series'),
    fields: [{ name: 'documentType', label: 'Document type', type: 'select', options: ['FT', 'RC', 'NC', 'ND'], default: 'FT' },
      { name: 'prefix', label: 'Series prefix', max: 40 }, ...identity,
      { name: 'validationReference', label: 'Series validation reference', max: 200 }],
    confirmation: 'Check the issuer and validation reference. A configured series is immutable.',
  },
  'billing-accounts': updateAccount,
};

const actions = {
  issue: { id: 'issue', title: 'Issue invoice', path: transition('invoices', 'issue'), confirmation: 'The issue operation assigns a permanent document number using the company’s validated series.' },
  payment: { id: 'payment', title: 'Record payment', path: collection('payments'), fields: [
    amount, { name: 'provider', label: 'Bank or provider', max: 80 }, { name: 'reference', label: 'External transaction reference', max: 120 },
  ] },
  confirm: { id: 'confirm', title: 'Confirm payment', path: transition('payments', 'confirm'), fields: [evidence],
    confirmation: 'Confirm the amount and reference against bank or provider evidence before registering receipt.' },
  credit: { id: 'credit', title: 'Issue credit note', path: collection('credit-notes'), fields: [amount, reason], key: true,
    confirmation: 'The credit note reduces the outstanding balance and creates a numbered document.' },
  debit: { id: 'debit', title: 'Issue debit note', path: collection('debit-notes'), fields: [reason], lines: true, key: true,
    confirmation: 'The debit note creates a separate numbered document linked to the original invoice.' },
  refund: { id: 'refund', title: 'Request refund', path: collection('refunds'), fields: [amount, reason], key: true },
  approve: { id: 'approve', title: 'Approve refund', path: transition('refunds', 'decision'), body: { approve: true },
    confirmation: 'Confirm eligibility and the amount against the original payment.' },
  reject: { id: 'reject', title: 'Reject refund', path: transition('refunds', 'decision'), body: { approve: false },
    confirmation: 'Reject this request and release its reserved refund amount.' },
  execute: { id: 'execute', title: 'Record refund completion', path: transition('refunds', 'execute'), fields: [evidence],
    confirmation: 'Use the evidence of the completed bank or provider transfer for this refund.' },
  match: { id: 'match', title: 'Reconcile entry', path: collection('reconciliation'), fields: [identifier('paymentId', 'Confirmed payment ID')],
    confirmation: 'Check the company, amount and external movement reference before matching.' },
  cancel: { id: 'cancel', title: 'Cancel schedule', path: transition('schedules', 'cancel'), confirmation: 'Future invoices for this schedule will stop.' },
  retry: { id: 'retry', title: 'Retry failed event', path: transition('events', 'retry'), confirmation: 'This places the event back in the processing queue.' },
} satisfies Record<string, BillingAction>;

export function actionsFor(record: BillingRecord, actor?: string): BillingAction[] {
  switch (record.kind) {
    case 'INVOICE':
      if (record.status === 'DRAFT') return [actions.issue];
      if (record.status === 'ISSUED' || record.status === 'PARTIALLY_PAID') return [actions.payment, actions.credit, actions.debit];
      return record.status === 'PAID' ? [actions.debit] : [];
    case 'PAYMENT':
      if (record.status === 'PENDING' && actor && String(record.data['requestedBy']) !== actor) return [actions.confirm];
      return record.status === 'CONFIRMED' ? [actions.refund] : [];
    case 'REFUND':
      if (record.status === 'REQUESTED' && actor && String(record.data['requestedBy']) !== actor) return [actions.approve, actions.reject];
      return record.status === 'APPROVED' ? [actions.execute] : [];
    case 'BANK_ENTRY': return record.status === 'UNMATCHED' ? [actions.match] : [];
    case 'ACCOUNT': return [updateAccount];
    case 'OUTBOX': return record.status === 'DEAD' ? [actions.retry] : [];
    case 'SCHEDULE': return record.status === 'ACTIVE' ? [actions.cancel] : [];
    default: return [];
  }
}

const atLuanda = (date: string, end = false) => new Date(date + (end ? 'T23:59:59.999+01:00' : 'T00:00:00+01:00')).toISOString();
const amountPattern = /^\d{1,12}(?:\.\d{1,2})?$/;
export function actionBody(action: BillingAction, values: FormValues, lines: BillingLine[], operationKey: string, record?: BillingRecord) {
  const body: Record<string, unknown> = { ...action.body };
  for (const field of action.fields ?? []) {
    const value = values[field.name];
    if (value === null || value === undefined || String(value).trim() === '') throw new Error('Complete the required fields.');
    body[field.name] = field.type === 'date' ? atLuanda(String(value), field.name === 'dueAt' || field.name === 'validUntil')
      : typeof value === 'string' ? value.trim() : value;
  }
  if (action.key) body['operationKey'] = operationKey;
  if (action.lines) {
    if (!lines.every(line => line.description.trim() && line.taxRuleVersion.trim() && amountPattern.test(line.unitPrice)
      && amountPattern.test(line.discount) && Number(line.discount) <= Number(line.unitPrice) * Number(line.quantity)
      && Number.isInteger(line.quantity) && Number(line.quantity) > 0
      && Number.isInteger(line.taxBasisPoints) && Number(line.taxBasisPoints) >= 0 && Number(line.taxBasisPoints) <= 10000)) {
      throw new Error('Check the description, quantity, prices and tax version of each line.');
    }
    body['lines'] = lines.map(line => ({ ...line, description: line.description.trim(), taxRuleVersion: line.taxRuleVersion.trim() }));
  }
  if (record && ['debit', 'credit', 'payment'].includes(action.id)) body['invoiceId'] = record.id;
  if (record && action.id === 'payment') body['currency'] = record.data['currency'];
  if (record && action.id === 'refund') body['paymentId'] = record.id;
  if (record && action.id === 'match') body['entryId'] = record.id;
  if (action.id === 'series') {
    body['issuer'] = Object.fromEntries(identity.map(field => [field.name, body[field.name]]));
    for (const field of identity) delete body[field.name];
  }
  if (action.id === 'statement') {
    const source = String(body['entries']).split(/\r?\n/).filter(line => line.trim());
    if (source.length > 1000) throw new Error('Import up to 1,000 movements per statement.');
    body['entries'] = source.map((line, index) => {
      const [reference, amount, currency, date, extra] = line.split(/[,\t]/).map(value => value.trim());
      if (!reference || reference.length > 200 || !amountPattern.test(amount) || !/^[A-Z]{3}$/.test(currency)
        || !/^\d{4}-\d{2}-\d{2}$/.test(date) || extra !== undefined) {
        throw new Error('Check the reference, amount, currency and ISO date on line ' + (index + 1) + '.');
      }
      return { reference, amount, currency, occurredAt: atLuanda(date) };
    });
  }
  return body;
}
