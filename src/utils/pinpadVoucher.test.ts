import {
  buildPinPadVoucherHtml,
  extractVoucherLines,
  getVoucherLines,
  maskPan,
} from './pinpadVoucher';

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
};

// Saltos reales, escapados, form feed y separador "|"
assert(extractVoucherLines('A\r\nB\nC').join(',') === 'A,B,C', 'saltos reales');
assert(extractVoucherLines('A\\nB').join(',') === 'A,B', 'saltos escapados');
assert(extractVoucherLines('A\fB').join(',') === 'A,B', 'form feed');
assert(extractVoucherLines('A|B|C').join(',') === 'A,B,C', 'separador pipe');
assert(extractVoucherLines('\n\nA\n\n').join(',') === 'A', 'recorta vacías al borde');
assert(extractVoucherLines('\x1b@HOLA\x1d!\x00X').join(',') === 'HOLAX', 'quita ESC/POS');
assert(extractVoucherLines(undefined).length === 0, 'sin print_data');

// PAN
assert(maskPan('4557880612345678') === '455788******5678', 'enmascara PAN');
assert(maskPan('577752******7490') === '577752******7490', 'PAN ya enmascarado intacto');

// Fallback sin print_data
const fb = getVoucherLines({
  response_code: '00',
  card: '4557880612345678',
  approval_code: '123456',
  amount: '1050',
  currency_code: '604',
  merchant_id: '4078370',
});
assert(fb.includes('TOTAL: S/ 10.50'), 'fallback monto');
assert(fb.includes('TARJETA: 455788******5678'), 'fallback tarjeta enmascarada');

// HTML
const html = buildPinPadVoucherHtml(
  { print_data: 'IZIPAY\n<b>VENTA</b>' },
  { copyLabel: 'COPIA CLIENTE', reprint: true }
);
assert(html.includes('&lt;b&gt;VENTA&lt;/b&gt;'), 'escapa HTML');
assert(html.includes('*** REIMPRESION ***') && html.includes('COPIA CLIENTE'), 'cabecera');
assert(html.includes('class="v"'), 'texto del host alineado a la izquierda');

console.log('pinpadVoucher tests OK');
