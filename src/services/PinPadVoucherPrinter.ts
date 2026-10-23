/**
 * Impresión del voucher del PinPad Izipay en la ticketera de la caja.
 * Usa el mismo canal que el ticket de venta: Electron `printHTML` (térmica directa)
 * y, en navegador, la ventana de impresión. Cada parte (refrendo / voucher cliente) va en
 * un trabajo aparte para que la térmica corte entre ellas.
 */

import { Platform } from 'react-native';
import {
  getVoucherCopies,
  voucherCopyToHtml,
  type PinPadVoucherOptions,
  type PinPadVoucherSource,
} from '@/utils/pinpadVoucher';

type ElectronPrintAPI = {
  printHTML?: (html: string, filename: string) => Promise<{ success: boolean; error?: string }>;
};

// Evita imprimir dos veces el mismo voucher por doble toque o re-render.
const inFlight = new Set<string>();

export async function printPinPadVoucher(
  source: PinPadVoucherSource,
  options: PinPadVoucherOptions = {}
): Promise<boolean> {
  const key = `${source.ecr_transaccion ?? ''}|${source.approval_code ?? ''}|${source.ecr_data_adicional ?? ''}|${options.reprint ? 'R' : ''}`;
  if (inFlight.has(key)) return false;
  inFlight.add(key);
  try {
    const htmls = getVoucherCopies(source, options).map((copy) => voucherCopyToHtml(copy, options));
    const tag = `${source.ecr_transaccion || 'tx'}_${source.approval_code || Date.now()}`.replace(
      /[^a-zA-Z0-9_]/g,
      '_'
    );

    const electronAPI =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? (window as unknown as { electronAPI?: ElectronPrintAPI }).electronAPI
        : undefined;

    if (electronAPI?.printHTML) {
      for (let i = 0; i < htmls.length; i++) {
        const result = await electronAPI.printHTML(htmls[i], `voucher_izipay_${tag}_${i + 1}.pdf`);
        if (!result?.success) {
          console.error('❌ [PINPAD] Error imprimiendo voucher:', result?.error);
          return false;
        }
      }
      console.log(`✅ [PINPAD] Voucher impreso (${htmls.length} copia/s)`);
      return true;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (!printWindow) {
        console.error('❌ [PINPAD] No se pudo abrir ventana para imprimir voucher');
        return false;
      }
      // En navegador: todas las copias en una ventana, con salto de página entre ellas.
      const bodies = htmls.map((h) => h.slice(h.indexOf('<body>') + 6, h.indexOf('</body>')));
      printWindow.document.write(
        htmls[0].split('<body>')[0] +
          `<body>${bodies.join('<div style="page-break-after:always"></div>')}</body></html>`
      );
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 250);
      return true;
    }

    console.warn('⚠️ [PINPAD] Impresión de voucher soportada solo en web/electron.');
    return false;
  } catch (error) {
    console.error('❌ [PINPAD] Error imprimiendo voucher:', error);
    return false;
  } finally {
    setTimeout(() => inFlight.delete(key), 3000);
  }
}
