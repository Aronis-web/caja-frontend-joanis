/**
 * Impresión del voucher del PinPad Izipay en la ticketera de la caja.
 * Usa el mismo canal que el ticket de venta: Electron `printHTML` (térmica directa)
 * y, en navegador, la ventana de impresión.
 */

import { Platform } from 'react-native';
import {
  buildPinPadVoucherHtml,
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
  const key = `${source.approval_code ?? ''}|${source.ecr_data_adicional ?? ''}|${options.copyLabel ?? ''}|${options.reprint ? 'R' : ''}`;
  if (inFlight.has(key)) return false;
  inFlight.add(key);
  try {
    const html = buildPinPadVoucherHtml(source, options);
    const filename = `voucher_izipay_${(source.approval_code || Date.now()).toString().replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    const electronAPI =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? (window as unknown as { electronAPI?: ElectronPrintAPI }).electronAPI
        : undefined;

    if (electronAPI?.printHTML) {
      const result = await electronAPI.printHTML(html, filename);
      if (!result?.success) {
        console.error('❌ [PINPAD] Error imprimiendo voucher:', result?.error);
        return false;
      }
      console.log('✅ [PINPAD] Voucher impreso');
      return true;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (!printWindow) {
        console.error('❌ [PINPAD] No se pudo abrir ventana para imprimir voucher');
        return false;
      }
      printWindow.document.write(html);
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
