import type { Product } from '../types/pos';
import type { OfflineProduct } from '../types/offline';

/**
 * Convierte un valor de céntimos (entero) a soles (decimal).
 * Devuelve 0 cuando el valor es null/undefined/NaN.
 */
export const cashCentsToSoles = (cents: number | null | undefined): number => {
  if (cents == null || !Number.isFinite(cents)) return 0;
  return cents / 100;
};

/**
 * Mapea un OfflineProduct (campos opcionales como `null`) al tipo Product
 * (campos opcionales como `undefined`). Centraliza la conversión usada por
 * la búsqueda offline de productos en NewSaleScreen.
 */
export const mapOfflineProductToProduct = (p: OfflineProduct): Product => ({
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
