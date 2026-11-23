export const TODAY = () => new Date().toISOString().slice(0, 10);
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CENTS = 999_999_999_999_999_999n;
export function cents(raw: string | null | undefined) {
  if (raw == null) return null;
  const match = /^(0|[1-9]\d*)(?:[.,](\d{1,2}))?$/.exec(String(raw).trim());
  return match ? BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0')) : null;
}
export function decimal(value: bigint) {
  const absolute = value < 0n ? -value : value;
  return (value < 0n ? '-' : '') + (absolute / 100n).toString() + '.' + (absolute % 100n).toString().padStart(2, '0');
}
export function money(input: string | bigint | null | undefined, currency = 'AOA') {
  const value = typeof input === 'bigint' ? input : cents(input);
  if (value === null) return '—';
  const [whole, fraction] = decimal(value).split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') + ',' + fraction + ' ' + (currency === 'AOA' ? 'Kz' : currency);
}
export function amount(input: string, positive = false) {
  const value = cents(input);
  if (value === null || value > MAX_CENTS || (positive && value === 0n)) throw new Error('Enter a valid amount with up to two decimal places.');
  return decimal(value);
}
export function percent(input: string) {
  const value = input.trim().replace(',', '.');
  if (!/^(0|[1-9]\d{0,2})(\.\d{1,4})?$/.test(value)) throw new Error('Enter a percentage from 0 to 999.9999.');
  return value;
}
export function validDate(value: string) {
  const timestamp = Date.parse(value + 'T00:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}
export function human(value: string) { return value.toLowerCase().replaceAll('_', ' ').replace(/^./, first => first.toUpperCase()); }
export function effective(row: { effectiveFrom: string; effectiveTo: string | null }, date: string) {
  return row.effectiveFrom <= date && (!row.effectiveTo || row.effectiveTo >= date);
}
export function jsonConfig(input: string) {
  if (!input.trim()) return {};
  let value: unknown;
  try { value = JSON.parse(input); } catch { throw new Error('Rules must be valid JSON.'); }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Rules must be a JSON object.');
  return value as Record<string, unknown>;
}
