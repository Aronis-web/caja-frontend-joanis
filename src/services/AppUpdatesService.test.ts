// eslint-disable-next-line @typescript-eslint/no-require-imports
const ModuleLib = require('module');
import type { AppRelease, CheckUpdateResponse } from '../types/appUpdates';

const FAKE_API_URL = 'https://api.example.test';
const FAKE_APP_ID = '00000000-0000-4000-8000-000000000001';

// Mock @/utils/config antes de cargar el SUT para no arrastrar react-native.
const mocks: Record<string, unknown> = {
  '@/utils/config': {
    config: { API_URL: FAKE_API_URL, APP_ID: FAKE_APP_ID },
  },
};

const origLoad = ModuleLib._load;
ModuleLib._load = function (request: string, parent: unknown, ...rest: unknown[]) {
  if (request in mocks) return mocks[request];
  return origLoad.call(this, request, parent, ...rest);
};

// ============ fetch mock ============
type FetchCall = { url: string; init: RequestInit | undefined };
const calls: FetchCall[] = [];
let nextResponse: {
  ok: boolean;
  status: number;
  body: unknown;
  throwOnJson?: boolean;
} = { ok: true, status: 200, body: {} };

(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (
  url: string,
  init?: RequestInit
) => {
  calls.push({ url, init });
  return {
    ok: nextResponse.ok,
    status: nextResponse.status,
    json: async () => {
      if (nextResponse.throwOnJson) throw new Error('invalid json');
      return nextResponse.body;
    },
  } as Response;
}) as unknown as typeof fetch;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sut = require('./AppUpdatesService') as typeof import('./AppUpdatesService');
const { appUpdatesService } = sut;

// ============ helpers ============
const assert = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(msg);
};
const assertEqual = <T>(actual: T, expected: T, msg: string) => {
  assert(
    actual === expected,
    `${msg} (esperado: ${String(expected)}, recibido: ${String(actual)})`
  );
};
const resetCalls = () => {
  calls.length = 0;
};

const run = async () => {
  // 1) check(): construye query con appId/platform/currentVersion y manda headers
  resetCalls();
  const checkBody: CheckUpdateResponse = {
    updateAvailable: true,
    currentVersion: '1.0.0',
    latestVersion: '1.0.1',
    downloadUrl: 'https://other-host/file.exe',
  };
  nextResponse = { ok: true, status: 200, body: checkBody };
  const checkRes = await appUpdatesService.check({
    appId: 'pos',
    platform: 'windows',
    currentVersion: '1.0.0',
  });
  assertEqual(calls.length, 1, 'check() debe hacer 1 fetch');
  const checkUrl = calls[0].url;
  assert(
    checkUrl.startsWith(`${FAKE_API_URL}/api/pos/app-updates/check?`),
    `URL de check incorrecta: ${checkUrl}`
  );
  assert(checkUrl.includes('appId=pos'), 'check debe incluir appId=pos');
  assert(checkUrl.includes('platform=windows'), 'check debe incluir platform=windows');
  assert(
    checkUrl.includes('currentVersion=1.0.0'),
    'check debe incluir currentVersion=1.0.0'
  );
  const headers = calls[0].init?.headers as Record<string, string>;
  assertEqual(headers['x-app-id'], FAKE_APP_ID, 'debe enviar header x-app-id');
  assertEqual(headers['Accept'], 'application/json', 'debe enviar Accept JSON');
  assertEqual(checkRes.updateAvailable, true, 'updateAvailable parseado');
  assertEqual(checkRes.latestVersion, '1.0.1', 'latestVersion parseado');

  // 2) check(): error HTTP usa message del body y expone status
  resetCalls();
  nextResponse = {
    ok: false,
    status: 404,
    body: { statusCode: 404, message: 'Archivo no encontrado', error: 'Not Found' },
  };
  let caught: (Error & { status?: number }) | null = null;
  try {
    await appUpdatesService.check({ appId: 'pos', platform: 'android', currentVersion: '1' });
  } catch (e) {
    caught = e as Error & { status?: number };
  }
  assert(caught !== null, 'check() debe lanzar en HTTP error');
  assertEqual(caught!.message, 'Archivo no encontrado', 'mensaje viene del body');
  assertEqual(caught!.status, 404, 'status expuesto en el error');

  // 3) check(): error HTTP con body invalido cae a "HTTP <status>"
  resetCalls();
  nextResponse = { ok: false, status: 500, body: {}, throwOnJson: true };
  let caught2: Error | null = null;
  try {
    await appUpdatesService.check({ appId: 'pos', platform: 'ios', currentVersion: '1' });
  } catch (e) {
    caught2 = e as Error;
  }
  assertEqual(caught2!.message, 'HTTP 500', 'fallback HTTP <status> cuando body invalido');

  // 4) latestAll() golpea /latest
  resetCalls();
  const releasesBody: AppRelease[] = [
    { appId: 'pos', platform: 'windows', version: '1.0.1', downloadUrl: 'x' },
  ];
  nextResponse = { ok: true, status: 200, body: releasesBody };
  const all = await appUpdatesService.latestAll();
  assertEqual(calls[0].url, `${FAKE_API_URL}/api/pos/app-updates/latest`, 'URL latestAll');
  assertEqual(all.length, 1, 'latestAll parseado');

  // 5) latest(appId, platform) codifica path params
  resetCalls();
  nextResponse = { ok: true, status: 200, body: releasesBody[0] };
  await appUpdatesService.latest('po s', 'windows');
  assertEqual(
    calls[0].url,
    `${FAKE_API_URL}/api/pos/app-updates/latest/po%20s/windows`,
    'URL latest debe encode-uri'
  );

  // 6) releases(appId) sin filtro y con filtro de plataforma
  resetCalls();
  nextResponse = { ok: true, status: 200, body: releasesBody };
  await appUpdatesService.releases('pos');
  assertEqual(calls[0].url, `${FAKE_API_URL}/api/pos/app-updates/releases/pos`, 'releases sin filtro');
  resetCalls();
  nextResponse = { ok: true, status: 200, body: releasesBody };
  await appUpdatesService.releases('pos', 'android');
  assertEqual(
    calls[0].url,
    `${FAKE_API_URL}/api/pos/app-updates/releases/pos?platform=android`,
    'releases con filtro'
  );

  // 7) buildDownloadUrl()
  const dl = appUpdatesService.buildDownloadUrl('pos', 'android', '1.0.29');
  assertEqual(
    dl,
    `${FAKE_API_URL}/api/pos/app-updates/download/pos/android/1.0.29`,
    'buildDownloadUrl debe usar svc-pos'
  );

  console.log('✅ AppUpdatesService tests: OK (7 suites)');
};

run().catch((err) => {
  console.error('❌ AppUpdatesService tests:', err);
  process.exit(1);
});
