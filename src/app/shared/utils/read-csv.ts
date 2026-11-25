export type ImportSheet = { columns: string[]; rows: string[][] };

export function readCsv(source: string, maximumRows = 5000): ImportSheet {
  const content = source.replace(/^\uFEFF/, '');
  const header = content.split(/\r?\n/, 1)[0];
  const delimiter = header.replace(/"(?:[^"]|"")*"/g, '').includes(';') ? ';' : ',';
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let closed = false;
  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    if (quoted) {
      if (char === '"' && content[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === delimiter || char === '\r' || char === '\n') {
      row.push(cell.trim());
      cell = '';
      closed = false;
      if (char !== delimiter) {
        if (char === '\r' && content[index + 1] === '\n') index++;
        if (row.some(Boolean)) lines.push(row);
        row = [];
      }
    } else if (char === '"' && !cell && !closed) {
      quoted = true;
    } else if (closed || char === '"') {
      throw new Error('Invalid quotation in the CSV file.');
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error('The CSV contains an unclosed quoted field.');
  row.push(cell.trim());
  if (row.some(Boolean)) lines.push(row);
  const [columns, ...rows] = lines;
  if (!columns || columns.length < 3 || !rows.length) throw new Error('Use a CSV with a header and at least one row.');
  if (rows.length > maximumRows) throw new Error('Import up to ' + maximumRows.toLocaleString('en-US') + ' rows per file.');
  return { columns, rows };
}
