/**
 * Voucher del PinPad Izipay (Verifone P400).
 *
 * Formato de `print_data` (PMP-API Rest Especificaciones Técnicas v2.3, sección 6):
 * - Cada línea termina en CR (0x0D) y empieza con un código de formato:
 *   'A' normal (38 col), 'B' doble tamaño (19 col), 'C'/'D' inversos (se tratan como A/B).
 * - '2' + ESC (0x1B) = línea en blanco; '2' + FS (0x1C) + tipo + archivo = imagen
 *   (p.ej. DCCOK.BMP para Visa DCC).
 * - 0x0E = corte de papel entre la copia comercio y la copia cliente.
 *
 * Cada copia se imprime como un trabajo aparte en la ticketera (80 mm) para que la
 * térmica corte entre copias. Si el host no envía `print_data`, se arma un voucher
 * mínimo con los campos de la respuesta (con la tarjeta enmascarada).
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
  merchantName?: string;
  transactionAt?: Date;
  reprint?: boolean;
}

export type VoucherLineFormat = 'NORMAL' | 'DOUBLE' | 'BLANK' | 'IMAGE';
export interface VoucherLine {
  format: VoucherLineFormat;
  text: string;
}
export type VoucherCopy = VoucherLine[];

export const VOUCHER_NORMAL_COLUMNS = 38;
export const VOUCHER_DOUBLE_COLUMNS = 19;

const CUT = '\x0e';
const BLANK_MARK = '\x1b';
const IMAGE_MARK = '\x1c';
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\x00-\x08\x0b-\x1f\x7f]/g;

/** Enmascara cualquier secuencia de 13-19 dígitos que parezca un PAN completo. */
export function maskPan(value: string): string {
  return value.replace(
    /\b(\d{6})(\d{3,9})(\d{4})\b/g,
    (_m, a: string, mid: string, b: string) => `${a}${'*'.repeat(mid.length)}${b}`
  );
}

function parseLine(raw: string): VoucherLine {
  if (raw.length === 0) return { format: 'BLANK', text: '' };
  const body = raw.slice(1);
  switch (raw[0]) {
    case 'A':
    case 'C':
      return { format: 'NORMAL', text: body };
    case 'B':
    case 'D':
      return { format: 'DOUBLE', text: body };
    case '2':
      if (body.startsWith(IMAGE_MARK)) {
        // FS + tipo de imagen + nombre de archivo
        return { format: 'IMAGE', text: body.slice(2).replace(CONTROL_RE, '').trim() };
      }
      return { format: 'BLANK', text: '' };
    default:
      // Código no reconocido: se imprime la línea completa.
      return { format: 'NORMAL', text: raw };
  }
}

/** Divide `print_data` en copias (por el corte 0x0E) y líneas con su formato. */
export function parseVoucher(printData?: string | null): VoucherCopy[] {
  if (!printData || typeof printData !== 'string') return [];
  // Algunos logs/serializaciones traen los separadores escapados.
  const text = printData.replace(/\\u000[eE]/g, CUT).replace(/\\r\\n|\\r|\\n/g, '\r');
  return text
    .split(CUT)
    .map((chunk) => {
      const raws = chunk.split(/\r\n|\r|\n/);
      while (raws.length && raws[0] === '') raws.shift();
      while (raws.length && raws[raws.length - 1] === '') raws.pop();
      return raws.map((raw) => {
        const line = parseLine(raw);
        if (line.format === 'BLANK') return line;
        const clean = line.text.replace(BLANK_MARK, '').replace(CONTROL_RE, '').replace(/\s+$/, '');
        // El host ya enmascara la tarjeta; no se toca (el ID de transacción también tiene 16 dígitos).
        return { ...line, text: clean };
      });
    })
    .filter((copy) => copy.some((l) => l.format !== 'BLANK' && l.text.trim() !== ''));
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const formatDateTime = (d: Date) =>
  `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** Voucher mínimo (una copia) cuando el host no envía `print_data`. */
export function buildFallbackVoucher(
  source: PinPadVoucherSource,
  options: PinPadVoucherOptions = {}
): VoucherCopy {
  const amountNum = source.amount ? parseInt(source.amount, 10) / 100 : NaN;
  const currency = source.currency_code === '840' ? 'US$' : 'S/';
  const n = (text: string): VoucherLine => ({ format: 'NORMAL', text });
  const lines: VoucherLine[] = [
    n('IZIPAY'),
    ...(options.merchantName ? [n(options.merchantName)] : []),
    n(source.ecr_transaccion === '06' ? 'ANULACION' : 'VENTA'),
    n(formatDateTime(options.transactionAt ?? new Date())),
    ...(source.merchant_id ? [n(`COMERCIO: ${source.merchant_id}`)] : []),
    ...(source.card ? [n(`TARJ: ${maskPan(String(source.card))}`)] : []),
    ...(source.approval_code || source.ecr_data_adicional
      ? [n(`AP:${source.approval_code ?? ''} REF:${source.ecr_data_adicional ?? ''}`)]
      : []),
    { format: 'BLANK', text: '' },
    ...(Number.isFinite(amountNum)
      ? [{ format: 'DOUBLE' as const, text: `TOTAL ${currency} ${amountNum.toFixed(2)}` }]
      : []),
  ];
  return lines;
}

/** Copias a imprimir: las de `print_data`, o el voucher mínimo si no vino. */
export function getVoucherCopies(
  source: PinPadVoucherSource,
  options: PinPadVoucherOptions = {}
): VoucherCopy[] {
  const copies = parseVoucher(source.print_data);
  return copies.length ? copies : [buildFallbackVoucher(source, options)];
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderLine(line: VoucherLine): string {
  switch (line.format) {
    case 'BLANK':
      return '<div class="l">&nbsp;</div>';
    case 'IMAGE':
      return `<div class="l img">[${escapeHtml(line.text || 'IMAGEN')}]</div>`;
    case 'DOUBLE':
      return `<div class="l d">${escapeHtml(line.text) || '&nbsp;'}</div>`;
    default:
      return `<div class="l">${escapeHtml(line.text) || '&nbsp;'}</div>`;
  }
}

/** HTML de 80 mm de UNA copia, listo para `electronAPI.printHTML`. */
export function voucherCopyToHtml(copy: VoucherCopy, options: PinPadVoucherOptions = {}): string {
  const lines = options.reprint
    ? [{ format: 'NORMAL' as const, text: '*** REIMPRESION ***' }, ...copy]
    : copy;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Voucher Izipay</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 72mm; padding: 3mm 0 6mm; margin: 0 auto; background: #fff; color: #000; }
  .l { font-family: 'Courier New', 'Lucida Console', monospace; font-size: 3.1mm; line-height: 1.25;
       white-space: pre-wrap; word-break: break-all; }
  .d { font-size: 6.2mm; font-weight: bold; line-height: 1.15; }
  .img { text-align: center; font-weight: bold; }
</style>
</head>
<body>
${lines.map(renderLine).join('\n')}
</body>
</html>`;
}
