export type ReportCell = string | number | null | undefined | { amount: string; currency?: string };
export type ReportDocument = { title: string; company: string; headings: string[]; rows: ReportCell[][]; note?: string };

const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
function escapeXml(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/[&<>"']/g, character => XML_ESCAPES[character]);
}

export function excelWorkbook(report: ReportDocument) {
  const rows: ReportCell[][] = [[report.title], [report.company], report.headings, ...report.rows];
  const cells = rows.map(row => '<Row>' + row.map(cell => {
    const value = typeof cell === 'object' && cell ? cell.amount : cell;
    const numeric = typeof value === 'number' || (typeof cell === 'object' && cell && /^\d{1,13}(?:\.\d{1,2})?$/.test(cell.amount));
    return '<Cell><Data ss:Type="' + (numeric ? 'Number' : 'String') + '">' + escapeXml(String(value ?? '')) + '</Data></Cell>';
  }).join('') + '</Row>').join('');
  return '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    '<Worksheet ss:Name="Report"><Table>' + cells + '</Table></Worksheet></Workbook>';
}

export function downloadWorkbook(filename: string, report: ReportDocument) {
  const url = URL.createObjectURL(new Blob([excelWorkbook(report)], { type: 'application/vnd.ms-excel' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename + '.xml';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printReport(report: ReportDocument, formatAmount: (amount: string, currency?: string) => string) {
  const frame = document.createElement('iframe');
  frame.className = 'sr-only';
  frame.title = 'Printable report';
  document.body.append(frame);
  const printDocument = frame.contentDocument;
  if (!printDocument || !frame.contentWindow) { frame.remove(); return; }

  const append = (parent: HTMLElement, tag: string, text: string) => {
    const element = printDocument.createElement(tag);
    element.textContent = text;
    parent.append(element);
    return element;
  };
  printDocument.documentElement.lang = 'en';
  printDocument.title = report.title;
  append(printDocument.head, 'style', '@page{margin:16mm}body{font:12px system-ui;color:#101828}table{border-collapse:collapse;width:100%}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:start;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}');
  const body = printDocument.body;
  append(body, 'h1', report.title);
  append(body, 'p', report.company);
  if (report.note) append(body, 'p', report.note);
  const table = printDocument.createElement('table');
  const heading = table.createTHead().insertRow();
  report.headings.forEach(cell => append(heading, 'th', cell).setAttribute('scope', 'col'));
  const rows = table.createTBody();
  for (const row of report.rows) {
    const tr = rows.insertRow();
    row.forEach(cell => append(tr, 'td', typeof cell === 'object' && cell ? formatAmount(cell.amount, cell.currency) : String(cell ?? '—')));
  }
  body.append(table);
  const window = frame.contentWindow;
  window.addEventListener('afterprint', () => frame.remove(), { once: true });
  window.focus();
  window.print();
}
