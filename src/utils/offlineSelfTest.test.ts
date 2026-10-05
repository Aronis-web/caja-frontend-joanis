import { runOfflineSelfTest, type OfflineSelfTestDeps } from './offlineSelfTest';

const assertEqual = <T>(actual: T, expected: T, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message} (esperado: ${String(expected)}, recibido: ${String(actual)})`);
  }
};

const NOW = Date.parse('2026-10-05T23:00:00.000Z');

const healthy = (overrides: Partial<OfflineSelfTestDeps> = {}): OfflineSelfTestDeps => ({
  cashRegisterId: 'cr-1',
  isOnline: true,
  isDbReady: () => true,
  getProvisionedCashRegister: async () => ({ id: 'cr-1', code: 'CAJA-02' }),
  hasDeviceToken: async () => true,
  pingWithDeviceToken: async () => undefined,
  getProductCount: async () => 12000,
  getLastProductSyncAt: async () => '2026-10-05T20:00:00.000Z',
  getAvailableTokenCount: async () => 900,
  getOfflineUserCount: async () => 8,
  getPendingSalesCount: async () => 0,
  getRejectedSalesCount: async () => 0,
  now: () => NOW,
  ...overrides,
});

const statusOf = (checks: { key: string; status: string }[], key: string) =>
  checks.find((c) => c.key === key)?.status;

const run = async () => {
  let checks = await runOfflineSelfTest(healthy());
  assertEqual(checks.length, 7, 'caja sana revisa 7 puntos');
  assertEqual(
    checks.every((c) => c.status === 'ok'),
    true,
    'caja sana sale todo ok'
  );

  checks = await runOfflineSelfTest(healthy({ cashRegisterId: null }));
  assertEqual(statusOf(checks, 'caja'), 'fail', 'sin caja seleccionada falla');

  checks = await runOfflineSelfTest(healthy({ hasDeviceToken: async () => false }));
  assertEqual(statusOf(checks, 'vinculo'), 'fail', 'sin token falla la vinculacion');
  assertEqual(statusOf(checks, 'servidor'), undefined, 'sin token no llama al servidor');

  checks = await runOfflineSelfTest(
    healthy({ getProvisionedCashRegister: async () => ({ id: 'cr-9', code: 'CAJA-09' }) })
  );
  assertEqual(statusOf(checks, 'vinculo'), 'fail', 'token de otra caja falla');

  checks = await runOfflineSelfTest(
    healthy({
      pingWithDeviceToken: async () => {
        throw new Error('HTTP 401: Invalid device token');
      },
    })
  );
  assertEqual(statusOf(checks, 'servidor'), 'fail', 'token rechazado por el servidor falla');

  checks = await runOfflineSelfTest(healthy({ isOnline: false }));
  assertEqual(statusOf(checks, 'servidor'), 'warn', 'sin internet no se verifica el token');

  checks = await runOfflineSelfTest(
    healthy({
      getProductCount: async () => 0,
      getAvailableTokenCount: async () => 40,
      getOfflineUserCount: async () => null,
      getRejectedSalesCount: async () => 2,
    })
  );
  assertEqual(statusOf(checks, 'catalogo'), 'fail', 'catalogo vacio falla');
  assertEqual(statusOf(checks, 'tokens'), 'warn', 'pocos tokens avisa');
  assertEqual(statusOf(checks, 'usuarios'), 'warn', 'sin bundle avisa');
  assertEqual(statusOf(checks, 'cola'), 'warn', 'ventas rechazadas avisan');

  checks = await runOfflineSelfTest(
    healthy({ getLastProductSyncAt: async () => '2026-10-03T10:00:00.000Z' })
  );
  assertEqual(statusOf(checks, 'catalogo'), 'warn', 'catalogo viejo avisa');

  console.log('✅ offlineSelfTest: 8 escenarios OK');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
