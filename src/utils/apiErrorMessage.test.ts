import { buildApiErrorMessage } from './apiErrorMessage';

const assertEqual = <T>(actual: T, expected: T, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message} (esperado: ${String(expected)}, recibido: ${String(actual)})`);
  }
};

assertEqual(
  buildApiErrorMessage(
    {
      message: 'Stock insuficiente',
      errors: [
        'Producto TOALLITAS HUMEDAS 100+5 UND (2950): Stock insuficiente. Disponible: 0, Solicitado: 3',
      ],
      unavailableProducts: [{ productId: 'p1', available: 0, requested: 3, missing: 3 }],
    },
    400
  ),
  'Stock insuficiente\nProducto TOALLITAS HUMEDAS 100+5 UND (2950): Stock insuficiente. Disponible: 0, Solicitado: 3',
  'stock insuficiente muestra el producto que falta'
);

assertEqual(
  buildApiErrorMessage({ message: 'Caja cerrada' }, 400),
  'Caja cerrada',
  'mensaje simple sin detalle'
);

assertEqual(
  buildApiErrorMessage(
    { message: ['quantity must not be less than 0.01', 'items should not be empty'] },
    400
  ),
  'quantity must not be less than 0.01\nitems should not be empty',
  'errores de validacion uno por linea'
);

assertEqual(buildApiErrorMessage({}, 502), 'HTTP error! status: 502', 'sin cuerpo');
assertEqual(buildApiErrorMessage(null, 500), 'HTTP error! status: 500', 'cuerpo nulo');

console.log('✅ apiErrorMessage: 5 casos OK');
