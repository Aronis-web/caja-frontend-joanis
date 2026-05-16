import type { PaymentMethod, SalePayment } from '../types/pos';

export interface ProcessedSalePayment {
  paymentMethodId: string;
  amountCents: number;
  referenceNumber: string;
  notes: string;
}

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
    const isIzipay = paymentMethod?.code?.includes('IZIPAY') || paymentMethod?.isIzipay;
    const isCash = paymentMethod?.code === 'CASH' || paymentMethod?.isCash;

    let amountCents = Math.max(0, toCents(payment.amount));

    if (isIzipay && amountCents > remainingCents) {
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
    remainingCents = Math.max(0, remainingCents - amountCents);

    return {
      paymentMethodId: payment.paymentMethodId,
      amountCents,
      referenceNumber: `${referencePrefix}-${index}`,
      notes: paymentMethod?.name || 'Pago',
    };
  });
};
