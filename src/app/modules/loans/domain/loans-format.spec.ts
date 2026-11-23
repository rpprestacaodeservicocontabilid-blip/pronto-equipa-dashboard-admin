import { excelWorkbook } from '../../../shared/utils/report-documents';
import { amount, cents, money } from './loans-format';

describe('Loan money and export', () => {
  it('preserves exact cents for local decimal input and portfolio totals', () => {
    expect(amount('120000,95')).toBe('120000.95');
    expect(cents('9999999999999.99')).toBe(999_999_999_999_999n);
    expect(money('10000000000000.01')).toBe('10\u202f000\u202f000\u202f000\u202f000,01 Kz');
    expect(() => amount('1,005')).toThrow();
    expect(() => amount('10000000000000.00')).toThrow();
  });

  it('keeps untrusted references as text in the Excel workbook', () => {
    const xml = excelWorkbook({ title: 'Loans', company: 'A & B', headings: ['Reference', 'Amount (Kz)'],
      rows: [['=CMD("<a>")', { amount: '120000.95' }]] });
    expect(xml).toContain('A &amp; B');
    expect(xml).toContain('<Data ss:Type="String">=CMD(&quot;&lt;a&gt;&quot;)</Data>');
    expect(xml).toContain('<Data ss:Type="Number">120000.95</Data>');
    expect(xml).not.toContain('ss:Formula');
  });
});
