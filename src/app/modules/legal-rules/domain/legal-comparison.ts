import type { LegalVersion } from './legal.models';

function flatten(value: unknown, prefix: string, fields: Map<string, string>) {
  if (Array.isArray(value)) {
    if (!value.length) fields.set(prefix, '[]');
    value.forEach((item, index) => flatten(item, prefix + '[' + (index + 1) + ']', fields));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) flatten(item, prefix ? prefix + '.' + key : key, fields);
  } else if (value !== undefined) fields.set(prefix, value === null ? '—' : String(value));
}

export function compareVersions(baseline: LegalVersion, proposal: LegalVersion) {
  const left = new Map<string, string>();
  const right = new Map<string, string>();
  const content = (item: LegalVersion) => ({
    companyId: item.companyId, effectiveFrom: item.effectiveFrom, effectiveTo: item.effectiveTo,
    sourceReference: item.sourceReference, evidenceReference: item.evidenceReference, rules: item.rules, governance: item.governance,
  });
  flatten(content(baseline), '', left);
  flatten(content(proposal), '', right);
  return [...new Set([...left.keys(), ...right.keys()])].sort().filter(key => left.get(key) !== right.get(key))
    .map(key => ({ key, baseline: left.get(key) ?? '—', proposal: right.get(key) ?? '—' }));
}
