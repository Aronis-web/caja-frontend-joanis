"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSalePayments = exports.isIzipayAmountValid = exports.calculateRemaining = exports.calculateRemainingCents = exports.toCents = void 0;
const toCents = (amount) => {
    if (!Number.isFinite(amount))
        return 0;
    return Math.round(amount * 100);
};
exports.toCents = toCents;
const calculateRemainingCents = (total, paid) => Math.max(0, (0, exports.toCents)(total) - (0, exports.toCents)(paid));
exports.calculateRemainingCents = calculateRemainingCents;
const calculateRemaining = (total, paid) => (0, exports.calculateRemainingCents)(total, paid) / 100;
exports.calculateRemaining = calculateRemaining;
const isIzipayAmountValid = (amount, total, paid) => (0, exports.toCents)(amount) <= (0, exports.calculateRemainingCents)(total, paid);
exports.isIzipayAmountValid = isIzipayAmountValid;
const buildSalePayments = (total, cartPayments, paymentMethods, referencePrefix = `PAY-${Date.now()}`) => {
    const totalCents = (0, exports.toCents)(total);
    let remainingCents = totalCents;
    return cartPayments.map((payment, index) => {
        const paymentMethod = paymentMethods.find((pm) => pm.id === payment.paymentMethodId);
        const isIzipay = paymentMethod?.code?.includes('IZIPAY') || paymentMethod?.isIzipay;
        const isCash = paymentMethod?.code === 'CASH' || paymentMethod?.isCash;
        let amountCents = Math.max(0, (0, exports.toCents)(payment.amount));
        if (isIzipay && amountCents > remainingCents) {
            amountCents = remainingCents;
        }
        if (isCash) {
            if (cartPayments.length > 1) {
                amountCents = Math.min(amountCents, remainingCents);
            }
            else {
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
exports.buildSalePayments = buildSalePayments;
