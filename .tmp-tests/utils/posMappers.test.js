"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const posMappers_1 = require("./posMappers");
const assert = (condition, message) => {
    if (!condition) {
        throw new Error(message);
    }
};
const assertEqual = (actual, expected, message) => {
    assert(actual === expected, `${message} (esperado: ${String(expected)}, recibido: ${String(actual)})`);
};
const makeOfflineProduct = (overrides = {}) => ({
    id: 'prod-1',
    sku: 'SKU-001',
    barcode: '7501234567890',
    name: 'Producto de prueba',
    categoryName: 'Categoría A',
    salePriceCents: 1599,
    taxType: 'GRAVADO',
    serverStock: 10,
    localStock: 8,
    unitOfMeasure: 'UND',
    imageUrl: 'https://example.com/img.png',
    syncId: 'sync-1',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
});
const run = () => {
    // 1) cashCentsToSoles: conversiones básicas
    assertEqual((0, posMappers_1.cashCentsToSoles)(0), 0, 'cashCentsToSoles(0) debe ser 0');
    assertEqual((0, posMappers_1.cashCentsToSoles)(100), 1, 'cashCentsToSoles(100) debe ser 1');
    assertEqual((0, posMappers_1.cashCentsToSoles)(12345), 123.45, 'cashCentsToSoles(12345) debe ser 123.45');
    assertEqual((0, posMappers_1.cashCentsToSoles)(-500), -5, 'cashCentsToSoles negativo debe respetar signo');
    // 2) cashCentsToSoles: null/undefined/NaN → 0 (regresión bug currentBalance)
    assertEqual((0, posMappers_1.cashCentsToSoles)(undefined), 0, 'undefined debe devolver 0');
    assertEqual((0, posMappers_1.cashCentsToSoles)(null), 0, 'null debe devolver 0');
    assertEqual((0, posMappers_1.cashCentsToSoles)(Number.NaN), 0, 'NaN debe devolver 0');
    assertEqual((0, posMappers_1.cashCentsToSoles)(Number.POSITIVE_INFINITY), 0, 'Infinity no es finito, debe devolver 0');
    // 3) mapOfflineProductToProduct: campos requeridos preservados
    {
        const offline = makeOfflineProduct();
        const product = (0, posMappers_1.mapOfflineProductToProduct)(offline);
        assertEqual(product.id, 'prod-1', 'id debe preservarse');
        assertEqual(product.name, 'Producto de prueba', 'name debe preservarse');
        assertEqual(product.sku, 'SKU-001', 'sku debe preservarse');
        assertEqual(product.barcode, '7501234567890', 'barcode debe preservarse');
        assertEqual(product.salePriceCents, 1599, 'salePriceCents debe preservarse');
        assertEqual(product.price, 15.99, 'price debe convertirse de céntimos');
        assertEqual(product.stock, 8, 'stock debe usar localStock');
        assertEqual(product.availableStock, 8, 'availableStock debe usar localStock');
        assertEqual(product.taxType, 'GRAVADO', 'taxType debe preservarse');
        assertEqual(product.taxRate, 18, 'taxRate=18 cuando GRAVADO');
        assertEqual(product.isActive, true, 'isActive debe ser true');
    }
    // 4) mapOfflineProductToProduct: null → undefined (regresión TS)
    {
        const offline = makeOfflineProduct({
            sku: null,
            barcode: null,
            categoryName: null,
            imageUrl: null,
        });
        const product = (0, posMappers_1.mapOfflineProductToProduct)(offline);
        assertEqual(product.sku, undefined, 'sku null debe mapear a undefined');
        assertEqual(product.barcode, undefined, 'barcode null debe mapear a undefined');
        assertEqual(product.categoryName, undefined, 'categoryName null debe mapear a undefined');
        assertEqual(product.imageUrl, undefined, 'imageUrl null debe mapear a undefined');
        assertEqual(product.code, undefined, 'code debe ser undefined cuando sku y barcode son null');
    }
    // 5) mapOfflineProductToProduct: code = sku ?? barcode
    {
        const onlyBarcode = (0, posMappers_1.mapOfflineProductToProduct)(makeOfflineProduct({ sku: null, barcode: '111' }));
        assertEqual(onlyBarcode.code, '111', 'code debe caer en barcode cuando sku es null');
        const onlySku = (0, posMappers_1.mapOfflineProductToProduct)(makeOfflineProduct({ sku: 'ABC', barcode: null }));
        assertEqual(onlySku.code, 'ABC', 'code debe usar sku cuando está presente');
    }
    // 6) mapOfflineProductToProduct: taxRate=0 para no-GRAVADO
    {
        const exonerado = (0, posMappers_1.mapOfflineProductToProduct)(makeOfflineProduct({ taxType: 'EXONERADO' }));
        assertEqual(exonerado.taxRate, 0, 'taxRate=0 cuando EXONERADO');
        const inafecto = (0, posMappers_1.mapOfflineProductToProduct)(makeOfflineProduct({ taxType: 'INAFECTO' }));
        assertEqual(inafecto.taxRate, 0, 'taxRate=0 cuando INAFECTO');
    }
    // 7) imageUrl undefined original (no null) se preserva como undefined
    {
        const offline = makeOfflineProduct({ imageUrl: undefined });
        const product = (0, posMappers_1.mapOfflineProductToProduct)(offline);
        assertEqual(product.imageUrl, undefined, 'imageUrl undefined debe seguir undefined');
    }
    console.log('✅ posMappers tests: OK (7 suites)');
};
run();
