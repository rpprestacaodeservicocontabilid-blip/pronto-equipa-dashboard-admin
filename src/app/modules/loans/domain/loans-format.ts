const CURRENCY = 'Kz';
const DECIMAL = /^(0|[1-9]\d*)(?:[.,](\d{1,2}))?$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cents(input: string | null | undefined): bigint | null {
  const match = DECIMAL.exec(String(input ?? '').trim());
  return match ? BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0')) : null;
}

export function decimal(value: bigint) {
  const magnitude = value < 0n ? -value : value;
  return (value < 0n ? '-' : '') + magnitude / 100n + '.' + String(magnitude % 100n).padStart(2, '0');
}

export function amount(input: string, allowZero = false) {
  const value = cents(input);
  if (value === null || value > 999_999_999_999_999n || (!allowZero && value === 0n)) {
    throw new Error('Enter a valid amount in Kz with up to two decimal places.');
  }
  return decimal(value);
}

export function money(value: string | bigint | null | undefined, currency = 'AOA') {
  if (value == null) return '—';
  const parsed = typeof value === 'bigint' ? value : cents(value);
  if (parsed === null) return '—';
  const [whole, fraction] = decimal(parsed).split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') + ',' + fraction + ' ' + (currency === 'AOA' ? CURRENCY : currency);
}

export function label(value: string) {
  return value === 'BIWEEKLY' ? 'Every two weeks' : value.toLowerCase().replaceAll('_', ' ').replace(/^./, initial => initial.toUpperCase());
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function validDate(value: string) {
  const millis = Date.parse(value + 'T00:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(millis) && new Date(millis).toISOString().slice(0, 10) === value;
}

