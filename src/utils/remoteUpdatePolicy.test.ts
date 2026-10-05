import {
  compareVersions,
  decideRemoteUpdateStep,
  type RemoteUpdateInputs,
} from './remoteUpdatePolicy';

const assertEqual = <T>(actual: T, expected: T, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message} (esperado: ${String(expected)}, recibido: ${String(actual)})`);
  }
};

const base = (overrides: Partial<RemoteUpdateInputs> = {}): RemoteUpdateInputs => ({
  command: { id: 'c1', force: false, minVersion: null },
  currentVersion: '0.0.70',
  check: { done: false, available: false },
  downloading: false,
  downloaded: false,
  saleInProgress: false,
  pendingSales: 0,
  ...overrides,
});

const step = (input: RemoteUpdateInputs) => {
  const result = decideRemoteUpdateStep(input);
  return result.action === 'report' ? `report:${result.state}` : result.action;
};

assertEqual(compareVersions('0.0.72', '0.0.9'), 1, 'compara numericamente');
assertEqual(step(base({ command: null })), 'idle', 'sin orden');
assertEqual(step(base()), 'check', 'primero busca la actualizacion');
assertEqual(
  step(base({ check: { done: true, available: true, latestVersion: '0.0.72' } })),
  'download',
  'hay version nueva: descarga'
);
assertEqual(step(base({ downloading: true })), 'report:downloading', 'descargando');
assertEqual(step(base({ downloaded: true })), 'report:downloaded', 'sin forzar: espera al cierre');
assertEqual(
  step(base({ check: { done: true, available: false } })),
  'report:up-to-date',
  'ya esta al dia'
);
assertEqual(
  step(
    base({
      command: { id: 'c1', force: false, minVersion: '0.0.75' },
      check: { done: true, available: false, latestVersion: '0.0.72' },
    })
  ),
  'report:error',
  'version minima no publicada'
);
assertEqual(
  step(base({ command: { id: 'c1', force: true, minVersion: '0.0.70' } })),
  'report:up-to-date',
  'ya tiene la version minima'
);

const forced = { id: 'c1', force: true, minVersion: null };
assertEqual(
  step(base({ command: forced, downloaded: true, saleInProgress: true })),
  'report:waiting',
  'forzar espera la venta en curso'
);
assertEqual(
  step(base({ command: forced, downloaded: true, pendingSales: 3 })),
  'report:waiting',
  'forzar espera las ventas offline'
);
assertEqual(step(base({ command: forced, downloaded: true })), 'countdown', 'forzar instala');

console.log('✅ remoteUpdatePolicy: 12 casos OK');
