const wholeAmount = new Intl.NumberFormat('pt-AO');
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const timeStamp = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Luanda',
});

export function payrollDate(value: string | null | undefined, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : (withTime ? timeStamp : shortDate).format(date);
}

export function payrollMoney(value: string | number | null | undefined, currency?: string) {
  if (value == null) return '—';
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value));
  if (!match) return '—';
  const [, sign, whole, fraction] = match;
  const symbol = currency === 'AOA' ? 'Kz' : currency;
  return sign + wholeAmount.format(BigInt(whole)) + ',' + (fraction || '').padEnd(2, '0') + (symbol ? ' ' + symbol : '');
}

export function payrollCents(amount: string | number) {
  const [whole, fraction = ''] = String(amount).split('.');
  const absolute = BigInt(whole.replace(/^-/, '')) * 100n + BigInt(fraction.padEnd(2, '0'));
  return whole.startsWith('-') ? -absolute : absolute;
}

export function centsAmount(amount: bigint) {
  const absolute = amount < 0 ? -amount : amount;
  return (amount < 0 ? '-' : '') + absolute / 100n + '.' + String(absolute % 100n).padStart(2, '0');
}

export function payrollLabel(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/^./, initial => initial.toUpperCase());
}

export function isPayrollId(id: string) {
  return /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id);
}
