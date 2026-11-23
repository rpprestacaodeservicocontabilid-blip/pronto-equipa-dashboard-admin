import { spreadsheet } from './leave-export';

describe('Leave Excel export', () => {
  it('creates an Open XML workbook and preserves untrusted input as a text cell', () => {
    const workbook = spreadsheet(['Employee', 'Days'], [['=1+1 & <sample>', 4]]);
    const view = new DataView(workbook);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(workbook.byteLength - 22, true)).toBe(0x06054b50);
    const contents = new TextDecoder().decode(workbook);
    expect(contents).toContain('xl/worksheets/sheet1.xml');
    expect(contents).toContain('<t xml:space="preserve">=1+1 &amp; &lt;sample&gt;</t>');
    expect(contents).toContain('<c t="n"><v>4</v></c>');
  });
});
