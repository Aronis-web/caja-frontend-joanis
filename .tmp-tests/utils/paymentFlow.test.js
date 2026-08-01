"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const paymentFlow_1 = require("./paymentFlow");
const makeMethod = (id, name, code, extras = {}) => ({
    id,
    name,
    code,
    isActive: true,
    ...extras,
});
const cashMethod = makeMethod('cash', 'Efectivo', 'CASH', { isCash: true });
const izipayMethod = makeMethod('izipay', 'Izipay', 'IZIPAY_CARD', { isIzipay: true });
const yapeMethod = makeMethod('yape', 'Yape', 'YAPE');
const methods = [cashMethod, izipayMethod, yapeMethod];
const assert = (condition, message) => {
    if (!condition) {
        throw new Error(message);
    }
};
const assertEqual = (actual, expected, message) => {
    if (actual !== expected) {
        throw new Error(`${message}. Esperado: ${String(expected)}, actual: ${String(actual)}`);
    }
};
const sumAmounts = (payments) => payments.reduce((sum, payment) => sum + payment.amountCents, 0);
const run = () => {
    // 1) Conversión a centavos robusta
    assertEqual((0, paymentFlow_1.toCents)(10), 1000, 'toCents debe convertir 10 a 1000');
    assertEqual((0, paymentFlow_1.toCents)(10.015), 1002, 'toCents debe redondear correctamente');
    assertEqual((0, paymentFlow_1.toCents)(Number.NaN), 0, 'toCents debe devolver 0 para NaN');
    // 2) Cálculo de restante
    assertEqual((0, paymentFlow_1.calculateRemainingCents)(100, 40), 6000, 'Restante en centavos incorrecto');
    assertEqual((0, paymentFlow_1.calculateRemaining)(100, 40), 60, 'Restante decimal incorrecto');
    assertEqual((0, paymentFlow_1.calculateRemainingCents)(100, 120), 0, 'Restante no debe ser negativo');
    // 3) Validación IZIPAY
    assert((0, paymentFlow_1.isIzipayAmountValid)(50, 100, 40), 'IZIPAY debería permitir monto dentro de restante');
    assert(!(0, paymentFlow_1.isIzipayAmountValid)(70, 100, 40), 'IZIPAY no debe permitir exceder restante');
    // 4) Pago único efectivo -> enviar total exacto
    {
        const cartPayments = [{ paymentMethodId: cashMethod.id, amount: 150 }];
        const processed = (0, paymentFlow_1.buildSalePayments)(123.45, cartPayments, methods, 'TEST-CASH-ONLY');
        assertEqual(processed.length, 1, 'Debe existir un solo pago procesado');
        assertEqual(processed[0].amountCents, 12345, 'Efectivo único debe ajustarse al total venta');
    }
    // 5) Tarjeta + efectivo -> efectivo se ajusta al restante
    {
        const cartPayments = [
            { paymentMethodId: izipayMethod.id, amount: 60 },
            { paymentMethodId: cashMethod.id, amount: 80 },
        ];
        const processed = (0, paymentFlow_1.buildSalePayments)(100, cartPayments, methods, 'TEST-MIXED');
        assertEqual(processed[0].amountCents, 6000, 'Tarjeta debe mantener monto válido');
        assertEqual(processed[1].amountCents, 4000, 'Efectivo debe ajustarse al restante');
        assertEqual(sumAmounts(processed), 10000, 'Suma de pagos no debe exceder total');
    }
    // 6) Tarjeta excedida -> clamp al restante
    {
        const cartPayments = [
            { paymentMethodId: izipayMethod.id, amount: 120 },
            { paymentMethodId: cashMethod.id, amount: 50 },
        ];
        const processed = (0, paymentFlow_1.buildSalePayments)(100, cartPayments, methods, 'TEST-IZIPAY-OVER');
        assertEqual(processed[0].amountCents, 10000, 'IZIPAY debe ajustarse al restante');
        assertEqual(processed[1].amountCents, 0, 'Segundo pago debe quedar en cero si no hay restante');
        assertEqual(sumAmounts(processed), 10000, 'No debe superar total de venta');
    }
    // 7) Múltiples métodos y decimales complejos
    {
        const cartPayments = [
            { paymentMethodId: yapeMethod.id, amount: 33.33 },
            { paymentMethodId: izipayMethod.id, amount: 33.34 },
            { paymentMethodId: cashMethod.id, amount: 50.0 },
        ];
        const processed = (0, paymentFlow_1.buildSalePayments)(100, cartPayments, methods, 'TEST-ROUNDING');
        assertEqual(processed[0].amountCents, 3333, 'Yape debe mantener su redondeo');
        assertEqual(processed[1].amountCents, 3334, 'Izipay debe mantener su redondeo');
        assertEqual(processed[2].amountCents, 3333, 'Efectivo debe completar exacto restante');
        assertEqual(sumAmounts(processed), 10000, 'Total debe cerrar exactamente en 10000 centavos');
    }
    // 8) Datos amplios: 100 pagos pequeños
    {
        const cartPayments = [];
        for (let i = 0; i < 100; i += 1) {
            cartPayments.push({
                paymentMethodId: i % 2 === 0 ? yapeMethod.id : cashMethod.id,
                amount: 1.11,
            });
        }
        const processed = (0, paymentFlow_1.buildSalePayments)(100, cartPayments, methods, 'TEST-MANY-PAYMENTS');
        const totalProcessed = sumAmounts(processed);
        assert(totalProcessed <= 10000, 'Con muchos pagos no debe exceder total');
        assertEqual(processed.length, 100, 'Debe preservar cantidad de pagos procesados');
        assert(processed.every((payment) => payment.amountCents >= 0), 'Ningún pago procesado debe ser negativo');
    }
    console.log('✅ paymentFlow tests: OK (8 suites)');
};
run();
