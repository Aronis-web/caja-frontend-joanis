import { createMigratingStore, type KeyValueStore } from './electronSecureStore';

const assertEqual = <T>(actual: T, expected: T, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message} (esperado: ${String(expected)}, recibido: ${String(actual)})`);
  }
};

const memory = (): KeyValueStore & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return {
    map,
    get: async (key) => map.get(key) ?? null,
    set: async (key, value) => {
      map.set(key, value);
    },
    delete: async (key) => {
      map.delete(key);
    },
  };
};

const run = async () => {
  const secure = memory();
  const legacy = memory();
  const store = createMigratingStore(secure, legacy);

  legacy.map.set('secure:x', 'viejo');
  assertEqual(await store.get('secure:x'), 'viejo', 'lee el valor viejo');
  assertEqual(secure.map.get('secure:x'), 'viejo', 'lo migra al almacen cifrado');
  assertEqual(legacy.map.has('secure:x'), false, 'borra el valor viejo');

  await store.set('y', 'nuevo');
  assertEqual(await store.get('y'), 'nuevo', 'lee lo guardado');

  legacy.map.set('y', 'basura');
  assertEqual(await store.get('y'), 'nuevo', 'el cifrado tiene prioridad');

  await store.delete('y');
  assertEqual(await store.get('y'), null, 'borrado en ambos');
  assertEqual(legacy.map.has('y'), false, 'borra tambien el viejo');

  assertEqual(await store.get('nada'), null, 'clave inexistente');
  console.log('✅ electronSecureStore: 7 casos OK');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
