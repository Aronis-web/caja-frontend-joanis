import type { Product, ProductVariantOption, SaleItem } from '../types/pos';
import type { OfflineProduct } from '../types/offline';

/**
 * Reglas de variantes (color) en la caja.
 *
 * En el backend, cada producto tiene en el almacen un saldo "del producto"
 * (sin variante) y un saldo propio por cada variante con tracksStock=true.
 * Las variantes descriptivas (tracksStock=false) no tienen saldo: se venden
 * contra el saldo del producto y el backend las colapsa a null al vender.
 *
 * Por eso en la caja una linea del carrito se identifica por
 * (productId, variantId) y solo conserva variantId si la variante lleva stock
 * propio. Asi dos colores con stock propio son dos lineas con su propio tope,
 * y las descriptivas comparten la linea (y el tope) del producto.
 */

/** Etiqueta de la opcion "sin variante" en el selector de color. */
export const NO_VARIANT_LABEL = 'Sin variante';

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Variantes con saldo propio del producto. */
export const getTrackedVariants = (product: Product): ProductVariantOption[] =>
  (product.variants || []).filter((v) => v.tracksStock);

/**
 * Stock total del producto (saldo del producto + variantes). Es el que decide
 * si el producto se muestra en la busqueda.
 */
export const getProductTotalStock = (product: Product): number => {
  if (typeof product.totalAvailableStock === 'number') {
    return product.totalAvailableStock;
  }
  return toNumber(product.stock ?? product.availableStock);
};

/**
 * Variante efectiva de un resultado: solo la de una variante con stock propio.
 * Una variante descriptiva o desconocida se trata como el producto (null).
 */
export const getEffectiveVariant = (product: Product): ProductVariantOption | null => {
  if (!product.variantId) return null;
  const variant = (product.variants || []).find((v) => v.variantId === product.variantId);
  return variant && variant.tracksStock ? variant : null;
};

/**
 * true cuando hay que preguntar el color antes de agregar: el producto tiene
 * variantes con stock propio y el resultado no trae una variante resuelta.
 */
export const requiresVariantSelection = (product: Product): boolean =>
  !getEffectiveVariant(product) && getTrackedVariants(product).length > 0;

/**
 * Saldo del producto sin variante. La busqueda online y el catalogo offline
 * lo envian en `availableStock` cuando no hay variante resuelta.
 */
const getProductLevelStock = (product: Product): number => {
  if (getEffectiveVariant(product)) {
    // El resultado viene resuelto a una variante: el saldo del producto es
    // el total menos lo que esta en variantes con stock propio.
    const inVariants = getTrackedVariants(product).reduce(
      (sum, v) => sum + toNumber(v.availableStock),
      0
    );
    return Math.max(0, getProductTotalStock(product) - inVariants);
  }
  return toNumber(product.availableStock ?? product.stock);
};

/**
 * Devuelve el producto listo para el carrito en la dimension indicada:
 * variantId/variantName y stock de esa variante, o del producto si es null.
 */
export const withVariant = (product: Product, variantId: string | null): Product => {
  const variant = variantId
    ? getTrackedVariants(product).find((v) => v.variantId === variantId) || null
    : null;
  const stock = variant ? toNumber(variant.availableStock) : getProductLevelStock(product);
  return {
    ...product,
    variantId: variant ? variant.variantId : null,
    variantName: variant ? variant.name : null,
    stock,
    availableStock: stock,
  };
};

/**
 * Normaliza un resultado de busqueda/escaneo a una linea vendible: conserva la
 * variante resuelta solo si lleva stock propio; si no, nivel producto.
 */
export const toSellableProduct = (product: Product): Product =>
  withVariant(product, getEffectiveVariant(product)?.variantId ?? null);

/**
 * Opciones del selector de color: una por variante con stock propio y una
 * "sin variante" si el producto tiene saldo propio. Solo las que tienen stock.
 */
export const buildVariantChoices = (product: Product): Product[] => {
  const choices: Product[] = [];
  const productLevel = withVariant(product, null);
  if ((productLevel.stock ?? 0) > 0) {
    choices.push(productLevel);
  }
  for (const variant of getTrackedVariants(product)) {
    const choice = withVariant(product, variant.variantId);
    if ((choice.stock ?? 0) > 0) {
      choices.push(choice);
    }
  }
  return choices;
};

/** Misma linea de carrito: mismo producto y misma variante (null = producto). */
export const isSameCartLine = (
  item: Pick<SaleItem, 'productId' | 'variantId'>,
  productId: string,
  variantId: string | null | undefined
): boolean => item.productId === productId && (item.variantId ?? null) === (variantId ?? null);

/** Clave estable de una linea (para listas y selectores). */
export const cartLineKey = (productId: string, variantId?: string | null): string =>
  `${productId}:${variantId ?? ''}`;

/** "Producto - Variante", igual que la descripcion que guarda el backend. */
export const formatLineName = (name: string | undefined, variantName?: string | null): string => {
  const base = name || '';
  return variantName ? `${base} - ${variantName}` : base;
};

/** Variantes del catalogo offline al formato de busqueda POS. */
export const mapOfflineVariants = (p: OfflineProduct): ProductVariantOption[] =>
  (p.variants || []).map((v) => ({
    variantId: v.id,
    name: v.name,
    sku: v.sku,
    barcode: v.barcode,
    tracksStock: v.tracksStock,
    availableStock: v.tracksStock ? v.localStock : null,
  }));

/** Stock total local (producto + variantes con stock propio). */
export const getOfflineTotalStock = (p: OfflineProduct): number =>
  toNumber(p.localStock) +
  (p.variants || [])
    .filter((v) => v.tracksStock)
    .reduce((sum, v) => sum + toNumber(v.localStock), 0);
