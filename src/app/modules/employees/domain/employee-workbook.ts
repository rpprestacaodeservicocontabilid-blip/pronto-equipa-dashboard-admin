import { ImportSheet } from '../../../shared/utils/read-csv';

const xmlLimit = 4 * 1024 * 1024;
const relationNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

interface ZipEntry { method: number; flags: number; length: number; size: number; offset: number }

class WorkbookArchive {
  private readonly bytes: DataView;
  private readonly entries = new Map<string, ZipEntry>();

  constructor(buffer: ArrayBuffer) {
    this.bytes = new DataView(buffer);
    const end = this.endOfDirectory();
    const count = this.bytes.getUint16(end + 10, true);
    let offset = this.bytes.getUint32(end + 16, true);
    if (count > 1000 || offset > end || this.bytes.getUint16(end + 4, true) !== 0 || this.bytes.getUint16(end + 6, true) !== 0) {
      throw new Error($localize`:@@employees-the-excel-workbook-has-an-unsupported-archive-structure:The Excel workbook has an unsupported archive structure.`);
    }
    for (let i = 0; i < count; i++) {
      if (offset + 46 > end || this.bytes.getUint32(offset, true) !== 0x02014b50) throw new Error($localize`:@@employees-invalid-excel-archive:Invalid Excel archive.`);
      const nameLength = this.bytes.getUint16(offset + 28, true);
      const next = offset + 46 + nameLength + this.bytes.getUint16(offset + 30, true) + this.bytes.getUint16(offset + 32, true);
      if (next > end) throw new Error($localize`:@@employees-invalid-excel-archive-entry:Invalid Excel archive entry.`);
      const name = new TextDecoder().decode(this.view(offset + 46, nameLength));
      if (this.entries.has(name)) throw new Error($localize`:@@employees-duplicate-excel-archive-entry:Duplicate Excel archive entry.`);
      this.entries.set(name, {
        flags: this.bytes.getUint16(offset + 8, true), method: this.bytes.getUint16(offset + 10, true),
        length: this.bytes.getUint32(offset + 20, true), size: this.bytes.getUint32(offset + 24, true),
        offset: this.bytes.getUint32(offset + 42, true),
      });
      offset = next;
    }
  }

  has(path: string) { return this.entries.has(path); }

  async xml(path: string) {
    const entry = this.entries.get(path);
    if (!entry || (entry.flags & 1) || entry.size > xmlLimit || ![0, 8].includes(entry.method) ||
      entry.offset + 30 > this.bytes.byteLength || this.bytes.getUint32(entry.offset, true) !== 0x04034b50) {
      throw new Error($localize`:@@employees-excel-sheet-is-missing-encrypted-or-exceeds-the-allowed-size:Excel sheet is missing, encrypted or exceeds the allowed size.`);
    }
    const start = entry.offset + 30 + this.bytes.getUint16(entry.offset + 26, true) + this.bytes.getUint16(entry.offset + 28, true);
    if (start + entry.length > this.bytes.byteLength) throw new Error($localize`:@@employees-invalid-excel-archive-entry:Invalid Excel archive entry.`);
    const content = this.view(start, entry.length);
    const decoder = new TextDecoder();
    let text = '';
    if (entry.method === 0) {
      if (entry.length !== entry.size) throw new Error($localize`:@@employees-invalid-excel-archive-entry-size:Invalid Excel archive entry size.`);
      text = decoder.decode(content);
    } else {
      const reader = new Blob([content]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
      let bytes = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > entry.size) throw new Error($localize`:@@employees-excel-sheet-exceeds-its-declared-size:Excel sheet exceeds its declared size.`);
          text += decoder.decode(value, { stream: true });
        }
        if (bytes !== entry.size) throw new Error($localize`:@@employees-invalid-excel-archive-entry-size:Invalid Excel archive entry size.`);
        text += decoder.decode();
      } finally { await reader.cancel(); }
    }
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(text)) throw new Error($localize`:@@employees-unsupported-excel-xml:Unsupported Excel XML.`);
    const document = new DOMParser().parseFromString(text, 'application/xml');
    if (document.getElementsByTagName('parsererror').length) throw new Error($localize`:@@employees-the-excel-workbook-contains-invalid-xml:The Excel workbook contains invalid XML.`);
    return document;
  }

  private view(start: number, length: number) {
    return new Uint8Array(this.bytes.buffer as ArrayBuffer, start, length);
  }

  private endOfDirectory() {
    for (let i = this.bytes.byteLength - 22; i >= Math.max(0, this.bytes.byteLength - 65557); i--) {
      if (this.bytes.getUint32(i, true) === 0x06054b50 && i + 22 + this.bytes.getUint16(i + 20, true) === this.bytes.byteLength) return i;
    }
    throw new Error($localize`:@@employees-choose-a-valid-xlsx-workbook:Choose a valid .xlsx workbook.`);
  }
}

function elements(parent: Document | Element, name: string) {
  return Array.from(parent.getElementsByTagNameNS('*', name));
}
function sheetDate(raw: string, date1904: boolean) {
  if (!/^\d+(?:\.0+)?$/.test(raw)) return raw;
  const days = Number(raw);
  if (!Number.isSafeInteger(days) || days > 2958465 || (!date1904 && days === 60)) return raw;
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, days < 60 ? 31 : 30);
  return new Date(epoch + days * 86400000).toISOString().slice(0, 10);
}

export async function readEmployeeWorkbook(buffer: ArrayBuffer): Promise<ImportSheet> {
  const archive = new WorkbookArchive(buffer);
  const [workbook, relations] = await Promise.all([archive.xml('xl/workbook.xml'), archive.xml('xl/_rels/workbook.xml.rels')]);
  const firstSheet = elements(workbook, 'sheet')[0];
  const relationId = firstSheet?.getAttributeNS(relationNamespace, 'id') ?? firstSheet?.getAttribute('r:id');
  const relation = elements(relations, 'Relationship').find(item => item.getAttribute('Id') === relationId);
  const target = relation?.getAttribute('Target') ?? '';
  const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
  if (relation?.getAttribute('TargetMode') === 'External' || !/^xl\/worksheets\/[\w.-]+\.xml$/.test(path)) {
    throw new Error($localize`:@@employees-the-first-excel-worksheet-is-unavailable:The first Excel worksheet is unavailable.`);
  }
  const sheet = await archive.xml(path);
  const strings = archive.has('xl/sharedStrings.xml')
    ? elements(await archive.xml('xl/sharedStrings.xml'), 'si').map(item => elements(item, 't').map(text => text.textContent).join(''))
    : [];
  const date1904 = ['1', 'true'].includes(elements(workbook, 'workbookPr')[0]?.getAttribute('date1904') ?? '');
  const values: string[][] = [];
  for (const row of elements(sheet, 'row')) {
    const cells: string[] = [];
    for (const cell of elements(row, 'c')) {
      const letters = /^[A-Z]{1,2}(?=\d)/.exec(cell.getAttribute('r') ?? '')?.[0];
      if (!letters) continue;
      const column = [...letters].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1;
      if (column >= 64) throw new Error($localize`:@@employees-use-up-to-64-columns-in-the-first-worksheet:Use up to 64 columns in the first worksheet.`);
      const type = cell.getAttribute('t');
      const raw = elements(cell, 'v')[0]?.textContent ?? '';
      const value = type === 's' ? strings[Number(raw)] ?? '' :
        type === 'inlineStr' ? elements(cell, 't').map(text => text.textContent).join('') : raw;
      const dateField = ['admissionDate', 'dateOfBirth'].includes(values[0]?.[column]);
      cells[column] = (dateField && (!type || type === 'n') ? sheetDate(value, date1904) : value).trim();
    }
    if (cells.some(Boolean)) values.push(cells);
    if (values.length > 501) throw new Error($localize`:@@employees-import-up-to-500-rows-per-file:Import up to 500 rows per file.`);
  }
  const [headers, ...rows] = values;
  if (!headers?.length || !rows.length) throw new Error($localize`:@@employees-use-a-worksheet-with-a-header-and-at-least-one-row:Use a worksheet with a header and at least one row.`);
  const columns = Array.from(headers, value => value ?? '');
  if (columns.some(value => !value)) throw new Error($localize`:@@employees-give-every-excel-column-a-header:Give every Excel column a header.`);
  return { columns, rows: rows.map(row => row.length > columns.length
    ? Array.from(row, value => value ?? '') : columns.map((_, index) => row[index] ?? '')) };
}
