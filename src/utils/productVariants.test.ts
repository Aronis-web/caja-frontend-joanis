import type { Product } from '../types/pos';
import type { OfflineProduct } from '../types/offline';
import { mapOfflineProductToProduct } from './posMappers';
import {
  buildVariantChoices,
  formatLineName,
  getProductTotalStock,
  isSameCartLine,
  requiresVariantSelection,
  toSellableProduct,
} from './productVariants';

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertEqual = <T>(actual: T, expected: T, message: string) => {
  assert(
    actual === expected,
    `${message} (esperado: ${String(expected)}, recibido: ${String(actual)})`
  );
};

// Polo con 2 en saldo del producto, Rojo con stock propio (5), Azul con stock
// propio (0) y Verde descriptivo. Tal como lo devuelve la busqueda POS.
const makePolo = (overrides: Partial<Product> = {}): Product => ({
  id: 'polo',
  name: 'Polo Basico',
  price: 25,
  stock: 2,
  availableStock: 2,
  totalAvailableStock: 7,
  variants: [
    {
      variantId: 'rojo',
      name: 'Rojo',
      sku: null,
      barcode: '775',
      tracksStock: true,
      availableStock: 5,
    },
    { variantId: 'azul', name: 'Azul', tracksStock: true, availableStock: 0 },
    { variantId: 'verde', name: 'Verde', tracksStock: false, availableStock: null },
  ],
  ...overrides,
});

const makeOffline = (overrides: Partial<OfflineProduct> = {}): OfflineProduct => ({
  id: 'polo',
  sku: 'POLO-1',
  barcode: null,
  name: 'Polo Basico',
  categoryName: null,
  salePriceCents: 2500,
  taxType: 'GRAVADO',
  serverStock: 2,
  localStock: 2,
  unitOfMeasure: null,
  syncId: 'sync-1',
  updatedAt: '2026-01-01T00:00:00.000Z',
  variants: [
    {
      id: 'rojo',
      name: 'Rojo',
      sku: null,
      barcode: '775',
      tracksStock: true,
      serverStock: 5,
      localStock: 4,
    },
    {
      id: 'verde',
      name: 'Verde',
      sku: null,
      barcode: null,
      tracksStock: false,
      serverStock: 0,
      localStock: 0,
    },
  ],
  ...overrides,
});

const run = () => {
  // 1) Sin variantes: comportamiento de siempre
  const plain: Product = { id: 'p', name: 'Gaseosa', stock: 3, availableStock: 3 };
  assert(!requiresVariantSelection(plain), 'sin variantes no se pregunta color');
  assertEqual(getProductTotalStock(plain), 3, 'total sin variantes = stock');
  const plainLine = toSellableProduct(plain);
  assertEqual(plainLine.variantId, null, 'sin variantes la linea va sin variante');
  assertEqual(plainLine.stock, 3, 'sin variantes conserva su stock');

  // 2) Producto con variantes con stock propio y sin variante resuelta
  const polo = makePolo();
  assert(requiresVariantSelection(polo), 'con variantes con stock se pregunta color');
  assertEqual(getProductTotalStock(polo), 7, 'total = producto + variantes');

  // 3) Opciones: producto (2) y Rojo (5). Azul sin stock y Verde descriptivo no.
  const choices = buildVariantChoices(polo);
  assertEqual(choices.length, 2, 'dos opciones con stock');
  assertEqual(choices[0].variantId, null, 'primera opcion = sin variante');
  assertEqual(choices[0].stock, 2, 'sin variante usa el saldo del producto');
  assertEqual(choices[1].variantId, 'rojo', 'segunda opcion = Rojo');
  assertEqual(choices[1].variantName, 'Rojo', 'Rojo lleva su nombre');
  assertEqual(choices[1].stock, 5, 'Rojo usa su saldo propio');
  assert(!requiresVariantSelection(choices[1]), 'una opcion elegida no vuelve a preguntar');

  // 4) Todo el stock en variantes: no hay opcion "sin variante"
  const onlyVariants = buildVariantChoices(
    makePolo({ stock: 0, availableStock: 0, totalAvailableStock: 5 })
  );
  assertEqual(onlyVariants.length, 1, 'solo la variante con stock');
  assertEqual(onlyVariants[0].variantId, 'rojo', 'solo Rojo');

  // 5) Escaneo del codigo de Rojo: el backend trae variantId y su stock
  const scannedRojo = makePolo({ variantId: 'rojo', variantName: 'Rojo', availableStock: 5 });
  assert(!requiresVariantSelection(scannedRojo), 'variante resuelta no pregunta');
  const rojoLine = toSellableProduct(scannedRojo);
  assertEqual(rojoLine.variantId, 'rojo', 'escaneo conserva Rojo');
  assertEqual(rojoLine.stock, 5, 'escaneo usa stock de Rojo');

  // 6) Escaneo de una variante descriptiva: se vende como producto
  const scannedVerde = makePolo({ variantId: 'verde', variantName: 'Verde' });
  const verdeLine = toSellableProduct(scannedVerde);
  assertEqual(verdeLine.variantId, null, 'descriptiva se colapsa a producto');
  assertEqual(verdeLine.stock, 2, 'descriptiva usa saldo del producto');
  assert(requiresVariantSelection(scannedVerde), 'descriptiva con colores con stock pregunta');

  // 7) Lineas del carrito por (producto, variante)
  assert(isSameCartLine({ productId: 'polo' }, 'polo', null), 'undefined == null');
  assert(
    isSameCartLine({ productId: 'polo', variantId: 'rojo' }, 'polo', 'rojo'),
    'misma variante = misma linea'
  );
  assert(
    !isSameCartLine({ productId: 'polo', variantId: 'rojo' }, 'polo', null),
    'variante y producto son lineas distintas'
  );

  // 8) Descripcion de linea
  assertEqual(formatLineName('Polo', 'Rojo'), 'Polo - Rojo', 'nombre con variante');
  assertEqual(formatLineName('Polo', null), 'Polo', 'nombre sin variante');

  // 9) Offline: stock local de variantes y variante resuelta por codigo
  const offline = mapOfflineProductToProduct(makeOffline());
  assertEqual(offline.availableStock, 2, 'offline availableStock = saldo producto');
  assertEqual(offline.totalAvailableStock, 6, 'offline total = 2 + Rojo 4 (Verde no suma)');
  assert(requiresVariantSelection(offline), 'offline con variantes pregunta color');
  const offlineScanned = mapOfflineProductToProduct(makeOffline({ resolvedVariantId: 'rojo' }));
  const offlineRojo = toSellableProduct(offlineScanned);
  assertEqual(offlineRojo.variantId, 'rojo', 'offline escaneo resuelve Rojo');
  assertEqual(offlineRojo.stock, 4, 'offline Rojo usa su stock local');
  const offlineProductLevel = buildVariantChoices(offlineScanned)[0];
  assertEqual(offlineProductLevel.stock, 2, 'offline sin variante sigue siendo 2');

  console.log('✅ productVariants tests: OK (9 suites)');
};

run();
