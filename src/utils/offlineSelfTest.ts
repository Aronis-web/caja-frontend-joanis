/**
 * Prueba del modo offline de la caja (boton "Probar modo offline").
 *
 * Revisa, sin vender ni tocar datos, lo que la caja necesita para operar sin
 * internet: base local, vinculacion (device token), que el servidor acepte el
 * token, catalogo, tokens de venta, usuarios para login offline y la cola de
 * ventas. Las dependencias se inyectan para poder probarlo sin la app.
 */
export type OfflineCheckStatus = 'ok' | 'warn' | 'fail';

export interface OfflineCheck {
  key: string;
  label: string;
  status: OfflineCheckStatus;
  detail: string;
}

export interface OfflineSelfTestDeps {
  cashRegisterId: string | null;
  isOnline: boolean;
  isDbReady: () => boolean;
  getProvisionedCashRegister: () => Promise<{ id: string; code: string } | null>;
  hasDeviceToken: () => Promise<boolean>;
  /** Llamada real con el device token; debe lanzar si el servidor lo rechaza. */
  pingWithDeviceToken: (cashRegisterId: string) => Promise<void>;
  getProductCount: () => Promise<number>;
  getLastProductSyncAt: () => Promise<string | null>;
  getAvailableTokenCount: () => Promise<number>;
  getOfflineUserCount: (cashRegisterId: string) => Promise<number | null>;
  getPendingSalesCount: () => Promise<number>;
  getRejectedSalesCount: () => Promise<number>;
  now?: () => number;
}

const LOW_TOKENS = 100;
const STALE_CATALOG_MS = 24 * 60 * 60 * 1000;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const runOfflineSelfTest = async (deps: OfflineSelfTestDeps): Promise<OfflineCheck[]> => {
  const now = deps.now ?? Date.now;
  const checks: OfflineCheck[] = [];
  const add = (key: string, label: string, status: OfflineCheckStatus, detail: string) =>
    checks.push({ key, label, status, detail });

  if (!deps.cashRegisterId) {
    add('caja', 'Caja seleccionada', 'fail', 'Selecciona y abre una caja antes de probar.');
    return checks;
  }
  const cashRegisterId = deps.cashRegisterId;

  if (!deps.isDbReady()) {
    add('db', 'Base de datos offline', 'fail', 'No esta inicializada. Reinicia CajaGrit.');
    return checks;
  }
  add('db', 'Base de datos offline', 'ok', 'Lista.');

  const hasToken = await deps.hasDeviceToken();
  const provisioned = await deps.getProvisionedCashRegister();
  if (!hasToken) {
    add('vinculo', 'Caja vinculada', 'fail', 'Sin device token: usa "Solicitar acceso offline".');
  } else if (provisioned && provisioned.id !== cashRegisterId) {
    add(
      'vinculo',
      'Caja vinculada',
      'fail',
      `El token es de la caja ${provisioned.code}, no de la seleccionada. Vuelve a vincular.`
    );
  } else {
    add(
      'vinculo',
      'Caja vinculada',
      'ok',
      provisioned ? `Vinculada a ${provisioned.code}.` : 'Si.'
    );
  }

  if (!deps.isOnline) {
    add('servidor', 'Servidor acepta el token', 'warn', 'Sin conexion: no se pudo verificar.');
  } else if (hasToken) {
    try {
      await deps.pingWithDeviceToken(cashRegisterId);
      add('servidor', 'Servidor acepta el token', 'ok', 'El backend respondio con este token.');
    } catch (error) {
      add('servidor', 'Servidor acepta el token', 'fail', message(error));
    }
  }

  const products = await deps.getProductCount();
  const lastSync = await deps.getLastProductSyncAt();
  if (products === 0) {
    add(
      'catalogo',
      'Catalogo offline',
      'fail',
      'Sin productos: ejecuta la sincronizacion completa.'
    );
  } else if (!lastSync || now() - new Date(lastSync).getTime() > STALE_CATALOG_MS) {
    add(
      'catalogo',
      'Catalogo offline',
      'warn',
      `${products} productos, pero la ultima sincronizacion tiene mas de un dia.`
    );
  } else {
    add('catalogo', 'Catalogo offline', 'ok', `${products} productos.`);
  }

  const tokens = await deps.getAvailableTokenCount();
  if (tokens === 0) {
    add('tokens', 'Tokens de venta offline', 'fail', 'Sin tokens: no se puede vender offline.');
  } else if (tokens < LOW_TOKENS) {
    add('tokens', 'Tokens de venta offline', 'warn', `Quedan ${tokens}: repon tokens.`);
  } else {
    add('tokens', 'Tokens de venta offline', 'ok', `${tokens} disponibles.`);
  }

  try {
    const users = await deps.getOfflineUserCount(cashRegisterId);
    if (users === null) {
      add('usuarios', 'Login offline', 'warn', 'Sin usuarios descargados: descarga el bundle.');
    } else if (users === 0) {
      add('usuarios', 'Login offline', 'warn', 'El bundle no trae usuarios.');
    } else {
      add('usuarios', 'Login offline', 'ok', `${users} usuarios pueden entrar sin internet.`);
    }
  } catch (error) {
    add('usuarios', 'Login offline', 'fail', `No se pudo leer el bundle: ${message(error)}`);
  }

  const pending = await deps.getPendingSalesCount();
  const rejected = await deps.getRejectedSalesCount();
  if (rejected > 0) {
    add(
      'cola',
      'Ventas offline',
      'warn',
      `${rejected} requieren atencion y ${pending} pendientes de sincronizar.`
    );
  } else {
    add(
      'cola',
      'Ventas offline',
      'ok',
      pending > 0 ? `${pending} pendientes de sincronizar.` : 'Nada pendiente.'
    );
  }

  return checks;
};
