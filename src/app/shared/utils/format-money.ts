export function money(value: string | number, currency?: string): string {
  const text = String(value);
  const parts = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!parts || !currency || !/^[A-Z]{3}$/.test(currency)) return [text, currency].filter(Boolean).join(' ');
  const integer = BigInt(parts[1] + parts[2]);
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency, currencyDisplay: 'code',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).formatToParts(integer === 0n && parts[1] ? -0 : integer)
    .map(part => part.type === 'fraction' ? (parts[3] ?? '').padEnd(2, '0') : part.value).join('');
}
