"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapOfflineProductToProduct = exports.cashCentsToSoles = void 0;
/**
 * Convierte un valor de céntimos (entero) a soles (decimal).
 * Devuelve 0 cuando el valor es null/undefined/NaN.
 */
const cashCentsToSoles = (cents) => {
    if (cents == null || !Number.isFinite(cents))
        return 0;
    return cents / 100;
};
exports.cashCentsToSoles = cashCentsToSoles;
/**
 * Mapea un OfflineProduct (campos opcionales como `null`) al tipo Product
 * (campos opcionales como `undefined`). Centraliza la conversión usada por
 * la búsqueda offline de productos en NewSaleScreen.
 */
const mapOfflineProductToProduct = (p) => ({
    id: p.id,
    sku: p.sku ?? undefined,
    barcode: p.barcode ?? undefined,
    name: p.name,
    code: p.sku ?? p.barcode ?? undefined,
    categoryName: p.categoryName ?? undefined,
    salePriceCents: p.salePriceCents,
    price: p.salePriceCents / 100,
    stock: p.localStock,
    availableStock: p.localStock,
    taxType: p.taxType,
    taxRate: p.taxType === 'GRAVADO' ? 18 : 0,
    imageUrl: p.imageUrl ?? undefined,
    isActive: true,
});
exports.mapOfflineProductToProduct = mapOfflineProductToProduct;
