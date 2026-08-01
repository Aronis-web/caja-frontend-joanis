import type { PaymentMethod, PinPadProvider, SalePayment } from '../types/pos';

export interface ProcessedSalePayment {
  paymentMethodId: string;
  amountCents: number;
  referenceNumber: string;
  notes: string;
  // Presentes solo cuando el pago proviene de un cobro PinPad ya registrado.
  pinpadOperationId?: string;
  pinpadProvider?: PinPadProvider;
}

/**
 * Deriva el proveedor PinPad a partir del codigo del metodo de pago.
 * Convencion del backend: familia OPENPAY_* -> OPENPAY; el resto (IZIPAY_*) -> IZIPAY.
 */
export const derivePinPadProvider = (code?: string | null): PinPadProvider =>
  code && code.toUpperCase().includes('OPENPAY') ? 'OPENPAY' : 'IZIPAY';

/**
 * Indica si un metodo de pago corresponde a una tarjeta procesada por PinPad
 * (Izipay u Openpay). El flujo PinPad se activa solo si ADEMAS el terminal
 * fisico esta detectado (isPinPadAvailable).
 */
export const isPinPadCardMethod = (method?: PaymentMethod | null): boolean => {
  if (!method) return false;
  const code = method.code?.toUpperCase() || '';
  return code.includes('IZIPAY') || code.includes('OPENPAY') || !!method.isIzipay;
};

export const toCents = (amount: number): number => {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
};

export const calculateRemainingCents = (total: number, paid: number): number =>
  Math.max(0, toCents(total) - toCents(paid));

export const calculateRemaining = (total: number, paid: number): number =>
  calculateRemainingCents(total, paid) / 100;

export const isIzipayAmountValid = (amount: number, total: number, paid: number): boolean =>
  toCents(amount) <= calculateRemainingCents(total, paid);

export const buildSalePayments = (
  total: number,
  cartPayments: SalePayment[],
  paymentMethods: PaymentMethod[],
  referencePrefix = `PAY-${Date.now()}`
): ProcessedSalePayment[] => {
  const totalCents = toCents(total);
  let remainingCents = totalCents;

  return cartPayments.map((payment, index) => {
    const paymentMethod = paymentMethods.find((pm) => pm.id === payment.paymentMethodId);
    const isCard = isPinPadCardMethod(paymentMethod);
    const isCash = paymentMethod?.code === 'CASH' || paymentMethod?.isCash;
    const hasPinpadOperation = !!payment.pinpadOperationId;

    let amountCents = Math.max(0, toCents(payment.amount));

    // Si el pago viene atado a un cobro PinPad ya registrado, el backend
    // valida que amountCents coincida EXACTAMENTE con el registrado.
    // No lo recortamos: si algo esta mal, es mejor que la venta falle
    // explicitamente que consumir un cobro con monto distinto.
    if (!hasPinpadOperation) {
      if (isCard && amountCents > remainingCents) {
        amountCents = remainingCents;
      }

      if (isCash) {
        if (cartPayments.length > 1) {
          amountCents = Math.min(amountCents, remainingCents);
        } else {
          amountCents = totalCents;
        }
      }

      amountCents = Math.max(0, Math.min(amountCents, remainingCents));
    }

    remainingCents = Math.max(0, remainingCents - amountCents);

    const processed: ProcessedSalePayment = {
      paymentMethodId: payment.paymentMethodId,
      amountCents,
      // Con cobro PinPad, el backend usa approvalCode/operationNumber como
      // referencia si no se envia una explicita. Enviamos el approvalCode
      // cuando lo tenemos, para trazabilidad.
      referenceNumber:
        payment.approvalCode || (hasPinpadOperation ? '' : `${referencePrefix}-${index}`),
      notes: paymentMethod?.name || 'Pago',
    };

    if (hasPinpadOperation) {
      processed.pinpadOperationId = payment.pinpadOperationId;
      processed.pinpadProvider =
        payment.pinpadProvider ?? derivePinPadProvider(paymentMethod?.code);
    }

    return processed;
  });
};
