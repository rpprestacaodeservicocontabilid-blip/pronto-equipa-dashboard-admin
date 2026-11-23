type Cell = string | number;
const encoder = new TextEncoder();

function escapeMarkup(value: Cell) {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
  return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/[&<>"']/g, character => entities[character]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Uint8Array) {
  let checksum = 0xffffffff;
  for (const value of bytes) checksum = CRC_TABLE[(checksum ^ value) & 255] ^ (checksum >>> 8);
  return (checksum ^ 0xffffffff) >>> 0;
}

// Office Open XML packages are ZIP archives. Use stored entries so export needs no compression dependency.
function storedZip(files: Record<string, string>): ArrayBuffer {
  const items = Object.entries(files).map(([name, contents]) => ({ name: encoder.encode(name), data: encoder.encode(contents) }));
  const contentSize = items.reduce((size, item) => size + 30 + item.name.length + item.data.length, 0);
  const directorySize = items.reduce((size, item) => size + 46 + item.name.length, 0);
  const buffer = new ArrayBuffer(contentSize + directorySize + 22);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const word = (offset: number, value: number) => view.setUint16(offset, value, true);
  const number = (offset: number, value: number) => view.setUint32(offset, value, true);
  let local = 0;
  let directory = contentSize;
  for (const { name, data } of items) {
    const checksum = crc32(data);
    number(local, 0x04034b50);
    word(local + 4, 20);
    word(local + 12, 33);
    number(local + 14, checksum);
    number(local + 18, data.length);
    number(local + 22, data.length);
    word(local + 26, name.length);
    bytes.set(name, local + 30);
    bytes.set(data, local + 30 + name.length);

    number(directory, 0x02014b50);
    word(directory + 4, 20);
    word(directory + 6, 20);
    word(directory + 14, 33);
    number(directory + 16, checksum);
    number(directory + 20, data.length);
    number(directory + 24, data.length);
    word(directory + 28, name.length);
    number(directory + 42, local);
    bytes.set(name, directory + 46);
    local += 30 + name.length + data.length;
    directory += 46 + name.length;
  }
  number(directory, 0x06054b50);
  word(directory + 8, items.length);
  word(directory + 10, items.length);
  number(directory + 12, directorySize);
  number(directory + 16, contentSize);
  return buffer;
}

export function spreadsheet(headings: string[], rows: readonly Cell[][]) {
  const sheet = [headings, ...rows].map(row => '<row>' + row.map(value => typeof value === 'number' && Number.isFinite(value)
    ? '<c t="n"><v>' + value + '</v></c>'
    : '<c t="inlineStr"><is><t xml:space="preserve">' + escapeMarkup(value) + '</t></is></c>').join('') + '</row>').join('');
  const NS = 'http://schemas.openxmlformats.org/';
  const office = NS + 'officeDocument/2006/relationships';
  const spreadsheet = NS + 'spreadsheetml/2006/main';
  const pkg = NS + 'package/2006/relationships';
  return storedZip({
    '[Content_Types].xml': '<Types xmlns="' + NS + 'package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="' + pkg + '"><Relationship Id="workbook" Type="' + office + '/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<workbook xmlns="' + spreadsheet + '" xmlns:r="' + office + '"><sheets><sheet name="Leave report" sheetId="1" r:id="sheet"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="' + pkg + '"><Relationship Id="sheet" Type="' + office + '/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': '<worksheet xmlns="' + spreadsheet + '"><sheetData>' + sheet + '</sheetData></worksheet>',
  });
}

export function downloadSpreadsheet(headings: string[], rows: readonly Cell[][]) {
  const file = new Blob([spreadsheet(headings, rows)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'leave-report.xlsx';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printLeaveReport(title: string, company: string, headings: string[], rows: readonly Cell[][], summary: string) {
  const frame = document.createElement('iframe');
  frame.title = 'Printable leave report';
  frame.className = 'sr-only';
  const columns = headings.map(value => '<th scope="col">' + escapeMarkup(value) + '</th>').join('');
  const body = rows.map(row => '<tr>' + row.map(value => '<td>' + escapeMarkup(value) + '</td>').join('') + '</tr>').join('');
  frame.srcdoc = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + escapeMarkup(title) +
    '</title><style>@page{margin:16mm}body{font:12pt system-ui,sans-serif}table{width:100%;border-collapse:collapse}' +
    'th,td{border:1px solid #999;padding:6px;text-align:start}th{background:#eee}thead{display:table-header-group}tr{break-inside:avoid}</style></head><body><h1>' +
    escapeMarkup(title) + '</h1><p>' + escapeMarkup(company) + '</p><p>' + escapeMarkup(summary) +
    '</p><table><thead><tr>' + columns + '</tr></thead><tbody>' + body + '</tbody></table></body></html>';
  frame.addEventListener('load', () => {
    const output = frame.contentWindow;
    if (!output) { frame.remove(); return; }
    output.addEventListener('afterprint', () => frame.remove(), { once: true });
    output.focus();
    output.print();
  }, { once: true });
  document.body.append(frame);
}
