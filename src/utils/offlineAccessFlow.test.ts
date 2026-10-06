import {
  createOfflineAccessFlow,
  PENDING_OFFLINE_ACCESS_KEY,
  type ClaimResponse,
  type OfflineAccessFlowDeps,
} from './offlineAccessFlow';

const assertEqual = <T>(actual: T, expected: T, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message} (esperado: ${String(expected)}, recibido: ${String(actual)})`);
  }
};

const build = (claim: () => Promise<ClaimResponse>) => {
  const store = new Map<string, string>();
  const saved: { token: string; code: string }[] = [];
  const sentSecrets: string[] = [];
  const deps: OfflineAccessFlowDeps = {
    storage: {
      get: async (key) => store.get(key) ?? null,
      set: async (key, value) => {
        store.set(key, value);
      },
      delete: async (key) => {
        store.delete(key);
      },
    },
    randomBytes: (length) => new Uint8Array(length).fill(7),
    encode: (bytes) => `secret-${bytes.length}`,
    requestAccess: async (_id, body) => {
      sentSecrets.push(body.claimSecret);
      return { requestId: 'req-1' };
    },
    claimAccess: async () => claim(),
    saveDeviceToken: async (token, register) => {
      saved.push({ token, code: register.code });
    },
  };
  return { flow: createOfflineAccessFlow(deps), store, saved, sentSecrets };
};

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

const run = async () => {
  const register = { id: 'cr-1', code: 'CAJA-02' };

  // Sin solicitud guardada
  let ctx = build(async () => ({ status: 'PENDING' }));
  assertEqual((await ctx.flow.check()).state, 'NONE', 'sin solicitud');

  // Solicitud pendiente: guarda el codigo y lo manda una vez
  await ctx.flow.request(register, 'PC Comas');
  assertEqual(ctx.sentSecrets[0], 'secret-32', 'manda el codigo de 32 bytes');
  assertEqual(ctx.store.has(PENDING_OFFLINE_ACCESS_KEY), true, 'guarda la solicitud');
  assertEqual((await ctx.flow.check()).state, 'PENDING', 'sigue pendiente');
  assertEqual(ctx.store.has(PENDING_OFFLINE_ACCESS_KEY), true, 'pendiente no borra');

  // Aprobada: guarda el token y borra la solicitud
  ctx = build(async () => ({
    status: 'DELIVERED',
    deviceToken: 'tok',
    cashRegisterId: 'cr-1',
    cashRegisterCode: 'CAJA-02',
  }));
  await ctx.flow.request(register);
  let state = await ctx.flow.check();
  assertEqual(state.state, 'DELIVERED', 'entregado');
  assertEqual(ctx.saved[0]?.token, 'tok', 'guarda el token');
  assertEqual(ctx.store.has(PENDING_OFFLINE_ACCESS_KEY), false, 'borra la solicitud');

  // Token de otra caja: no se guarda
  ctx = build(async () => ({
    status: 'DELIVERED',
    deviceToken: 'tok',
    cashRegisterId: 'cr-otra',
    cashRegisterCode: 'CAJA-09',
  }));
  await ctx.flow.request(register);
  state = await ctx.flow.check();
  assertEqual(state.state, 'EXPIRED', 'token de otra caja');
  assertEqual(ctx.saved.length, 0, 'no guarda token ajeno');

  // Rechazada
  ctx = build(async () => ({ status: 'REJECTED' }));
  await ctx.flow.request(register);
  assertEqual((await ctx.flow.check()).state, 'REJECTED', 'rechazada');
  assertEqual(ctx.store.has(PENDING_OFFLINE_ACCESS_KEY), false, 'rechazada borra');

  // Ya entregada o reemplazada (409/404/403): pedir de nuevo
  for (const status of [403, 404, 409]) {
    ctx = build(async () => {
      throw httpError(status);
    });
    await ctx.flow.request(register);
    assertEqual((await ctx.flow.check()).state, 'EXPIRED', `HTTP ${status} expira`);
    assertEqual(ctx.store.has(PENDING_OFFLINE_ACCESS_KEY), false, `HTTP ${status} borra`);
  }

  // Sin red o 500: conserva la solicitud para reintentar
  ctx = build(async () => {
    throw httpError(500);
  });
  await ctx.flow.request(register);
  let threw = false;
  try {
    await ctx.flow.check();
  } catch {
    threw = true;
  }
  assertEqual(threw, true, '500 propaga el error');
  assertEqual(ctx.store.has(PENDING_OFFLINE_ACCESS_KEY), true, '500 conserva la solicitud');

  console.log('✅ offlineAccessFlow: 9 escenarios OK');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
