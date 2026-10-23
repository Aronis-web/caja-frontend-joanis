import {
  buildFallbackVoucher,
  getVoucherCopies,
  maskPan,
  parseVoucher,
  voucherCopyToHtml,
} from './pinpadVoucher';

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
};

// Ejemplo de compra (especificación Izipay 4.3, recortado): copia comercio, corte, copia cliente.
const compra =
  'A CANCELO CON TARJ. MASTERCARD\rAAP:L12340 REF:2230 LOTE:0004\rATARJ:*****7490(L) S/ 5.20\r' +
  '\u000eA\rA IZIPAY\rACOMPRAS 14JUL21 12:18\rB TOTAL S/ 5.20\r2\u001b \rA ACEPTO PAGAR\rA\r';
const copias = parseVoucher(compra);
assert(copias.length === 2, 'dos copias separadas por 0x0E');
assert(
  copias[0][0].format === 'NORMAL' && copias[0][0].text === ' CANCELO CON TARJ. MASTERCARD',
  'quita código A'
);
assert(
  copias[1].some((l) => l.format === 'DOUBLE' && l.text === ' TOTAL S/ 5.20'),
  'código B doble'
);
assert(
  copias[1].some((l) => l.format === 'BLANK'),
  'línea en blanco 2+ESC'
);
assert(copias[1][0].text === '' && copias[1][1].text === ' IZIPAY', 'línea "A" vacía se conserva');

// Separadores escapados (como vienen en algunos logs)
assert(parseVoucher('AUNO\\rADOS\\u000EATRES').length === 2, 'escapados');

// Imagen DCC
const img = parseVoucher('A HOLA\r2\u001cBDCCOK.BMP\r');
assert(img[0][1].format === 'IMAGE' && img[0][1].text === 'DCCOK.BMP', 'imagen');

// C/D resaltados
assert(parseVoucher('CMENSAJE EMISOR\r')[0][0].bold === true, 'C en negrita');

// Código desconocido: línea tal cual
assert(parseVoucher('XYZ\r')[0][0].text === 'XYZ', 'código desconocido');

// PAN
assert(maskPan('4557880612345678') === '455788******5678', 'enmascara PAN');
assert(maskPan('577752******7490') === '577752******7490', 'PAN ya enmascarado intacto');
assert(
  parseVoucher('A ID: 0714121825002230\r')[0][0].text === ' ID: 0714121825002230',
  'no altera el ID de transacción del host'
);

// Sin print_data: voucher mínimo
const fb = getVoucherCopies({ card: '4557880612345678', approval_code: '123456', amount: '1050' });
assert(fb.length === 1, 'fallback una copia');
assert(
  fb[0].some((l) => l.text === 'TOTAL S/ 10.50'),
  'fallback monto'
);
assert(
  fb[0].some((l) => l.text === 'TARJ: 455788******5678'),
  'fallback tarjeta enmascarada'
);
assert(
  buildFallbackVoucher({ ecr_transaccion: '06' }).some((l) => l.text === 'ANULACION'),
  'fallback anulación'
);

// HTML
const html = voucherCopyToHtml(parseVoucher('A<b>VENTA</b>\rBTOTAL\r')[0], { reprint: true });
assert(html.includes('&lt;b&gt;VENTA&lt;/b&gt;'), 'escapa HTML');
assert(html.includes('*** REIMPRESION ***'), 'cabecera reimpresión');
assert(html.includes('class="l d"'), 'clase doble tamaño');

console.log('pinpadVoucher tests OK');
