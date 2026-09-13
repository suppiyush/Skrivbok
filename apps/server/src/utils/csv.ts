/**
 * CSV for spreadsheets.
 *
 * RFC 4180 quoting, plus two things a spreadsheet needs that the RFC does not
 * mention:
 *
 *   - A byte-order mark, without which Excel reads UTF-8 as the local code page
 *     and turns every accented author name into mojibake.
 *   - Formula neutralising. A cell that begins with `=`, `+`, `-` or `@` is
 *     evaluated as a formula when the file is opened, and these cells hold text
 *     the user typed — or pasted from a paper's abstract. A leading apostrophe
 *     makes the spreadsheet show it as text (OWASP's CSV-injection advice).
 */

/** U+FEFF, spelled by code point so the source holds no invisible character. */
const BOM = String.fromCharCode(0xfeff);

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: string[][]): string {
  return `${BOM}${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
