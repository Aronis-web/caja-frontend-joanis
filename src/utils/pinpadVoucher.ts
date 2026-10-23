/**
 * Voucher del PinPad Izipay (Verifone P400).
 *
 * El gateway devuelve el texto del voucher en `print_data`. Aquí se normaliza
 * a líneas y se arma el HTML de 80 mm que imprime la ticketera de la caja
 * (mismo canal `electronAPI.printHTML` que el ticket de venta).
 * Si el host no envía `print_data`, se arma un voucher mínimo con los campos
 * de la respuesta (tarjeta enmascarada, autorización, monto).
 */

export interface PinPadVoucherSource {
  print_data?: string;
  response_code?: string;
  message?: string;
  card?: string;
  approval_code?: string;
  amount?: string;
  currency_code?: string;
  merchant_id?: string;
  ecr_data_adicional?: string;
  ecr_transaccion?: string;
  [key: string]: unknown;
}

export interface PinPadVoucherOptions {
  copyLabel?: string; // p.ej. 'COPIA CLIENTE'
  merchantName?: string;
  transactionAt?: Date;
  reprint?: boolean;
}

// Secuencias ESC/POS habituales (ESC @ inicializar; ESC/GS + comando + parámetro binario)
// y caracteres de control que no se imprimen en HTML.
const ESC_POS_RE = /\x1b@|[\x1b\x1d][!-~][\x00-\x1f]?/g;
const CONTROL_RE = /[\x00-\x08\x0b\x0e-\x1f\x7f]/g;

/**
 * Convierte `print_data` en líneas imprimibles.
 * Acepta saltos reales (\r\n, \n, \r, \f), saltos escapados ("\\n") y,
 * si viene en una sola línea, el separador "|" que usan algunos hosts.
 */
export function extractVoucherLines(printData?: string | null): string[] {
  if (!printData || typeof printData !== 'string') return [];
  let text = printData.replace(/\\r\\n|\\n|\\r/g, '\n');
  text = text.replace(ESC_POS_RE, '').replace(/\f/g, '\n');
  let lines = text.split(/\r\n|\n|\r/);
  if (lines.length === 1 && lines[0].includes('|')) {
    lines = lines[0].split('|');
  }
  lines = lines.map((l) => l.replace(CONTROL_RE, '').replace(/\t/g, '    ').replace(/\s+$/, ''));
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const formatDateTime = (d: Date) =>
  `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

/** Enmascara cualquier secuencia de 13-19 dígitos que parezca un PAN completo. */
export function maskPan(value: string): string {
  return value.replace(/\b(\d{6})(\d{3,9})(\d{4})\b/g, (_m, a, mid, b) => `${a}${'*'.repeat(mid.length)}${b}`);
}

/** Voucher mínimo cuando el host no envía `print_data`. */
export function buildFallbackVoucherLines(
  source: PinPadVoucherSource,
  options: PinPadVoucherOptions = {}
): string[] {
  const amountNum = source.amount ? parseInt(source.amount, 10) / 100 : NaN;
  const currency = source.currency_code === '840' ? 'US$' : 'S/';
  const isVoid = source.ecr_transaccion === '06';
  const lines = [
    'IZIPAY',
    options.merchantName || '',
    isVoid ? 'ANULACION' : 'VENTA',
    '',
    `FECHA: ${formatDateTime(options.transactionAt ?? new Date())}`,
    source.merchant_id ? `COMERCIO: ${source.merchant_id}` : '',
    source.card ? `TARJETA: ${maskPan(String(source.card))}` : '',
    source.ecr_data_adicional ? `REF: ${source.ecr_data_adicional}` : '',
    source.approval_code ? `AUTORIZACION: ${source.approval_code}` : '',
    '',
    Number.isFinite(amountNum) ? `TOTAL: ${currency} ${amountNum.toFixed(2)}` : '',
    '',
    source.message ? String(source.message).toUpperCase() : '',
  ];
  return lines.filter((l, i) => l !== '' || (i > 0 && lines[i - 1] !== ''));
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Líneas del voucher: `print_data` si viene, si no el voucher mínimo. PAN siempre enmascarado. */
export function getVoucherLines(
  source: PinPadVoucherSource,
  options: PinPadVoucherOptions = {}
): string[] {
  const fromHost = extractVoucherLines(source.print_data);
  const lines = fromHost.length ? fromHost : buildFallbackVoucherLines(source, options);
  return lines.map(maskPan);
}

/** HTML de 80 mm listo para `electronAPI.printHTML`. */
export function buildPinPadVoucherHtml(
  source: PinPadVoucherSource,
  options: PinPadVoucherOptions = {}
): string {
  // El texto del host ya viene alineado por columnas: se imprime tal cual a la izquierda.
  // El voucher mínimo se centra.
  const fromHost = extractVoucherLines(source.print_data).length > 0;
  const lines = getVoucherLines(source, options);
  const header: string[] = [];
  if (options.reprint) header.push('*** REIMPRESION ***');
  if (options.copyLabel) header.push(options.copyLabel);
  const toDivs = (arr: string[]) =>
    arr.map((l) => `<div class="l">${escapeHtml(l) || '&nbsp;'}</div>`).join('\n');
  const body =
    (header.length ? `<div class="c">${toDivs(header)}</div><div class="l">&nbsp;</div>\n` : '') +
    `<div class="${fromHost ? 'v' : 'c'}">${toDivs(lines)}</div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Voucher Izipay</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 80mm; padding: 4mm 3mm 8mm; font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #000; background: #fff; }
  .l { white-space: pre; line-height: 1.35; overflow: hidden; }
  .c { text-align: center; }
  .v { text-align: left; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}
