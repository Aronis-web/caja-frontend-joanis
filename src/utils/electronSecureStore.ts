/**
 * Almacen seguro en Electron: cifrado con safeStorage en un archivo de userData
 * (ver electron.js). Antes se usaba localStorage en texto plano, que ademas se
 * perdia al reiniciar la app; los valores viejos se migran al leerlos.
 */

export interface KeyValueStore {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
}

export interface ElectronSecureStoreBridge extends KeyValueStore {
  isAvailable: () => Promise<boolean>;
}

export const getElectronSecureStoreBridge = (): ElectronSecureStoreBridge | null => {
  const api = (globalThis as { electronAPI?: { secureStore?: ElectronSecureStoreBridge } })
    .electronAPI;
  return api?.secureStore ?? null;
};

/** Usa el almacen cifrado y migra desde `legacy` los valores que solo existan alli. */
export const createMigratingStore = (
  secure: KeyValueStore,
  legacy: KeyValueStore
): KeyValueStore => ({
  get: async (key) => {
    const value = await secure.get(key);
    if (value !== null && value !== undefined) return value;
    const old = await legacy.get(key);
    if (old === null || old === undefined) return null;
    await secure.set(key, old);
    await legacy.delete(key);
    return old;
  },
  set: async (key, value) => {
    await secure.set(key, value);
    await legacy.delete(key);
  },
  delete: async (key) => {
    await secure.delete(key);
    await legacy.delete(key);
  },
});
