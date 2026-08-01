"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ModuleLib = require('module');
const cryptoOfflineReal = __importStar(require("../utils/cryptoOffline"));
// ============ Mocks compartidos (mutables entre suites) ============
const recordedEvents = [];
const secureStorage = new Map();
let argon2Accepted = new Set();
let currentBundle = null;
let deviceTokenValue = 'test-device-token';
const mocks = {
    '@/utils/cryptoOffline': cryptoOfflineReal,
    '@/utils/secureStorage': {
        setSecureItem: async (k, v) => {
            secureStorage.set(k, v);
        },
        getSecureItem: async (k) => secureStorage.get(k) ?? null,
        deleteSecureItem: async (k) => {
            secureStorage.delete(k);
        },
    },
    './OfflineDatabase': {
        offlineDatabase: {
            initialize: async () => { },
            saveLoginEvent: async (e) => {
                recordedEvents.push(e);
            },
        },
    },
    './DeviceTokenService': {
        deviceTokenService: { get: async () => deviceTokenValue },
    },
    './OfflineUsersBundleService': {
        offlineUsersBundleService: { getDecryptedBundle: async () => currentBundle },
    },
    'hash-wasm': {
        argon2Verify: async ({ password, hash }) => argon2Accepted.has(`${password}|${hash}`),
    },
    bcryptjs: { compare: async () => false },
};
// Instalar interceptor de require ANTES de cargar el SUT
const origLoad = ModuleLib._load;
ModuleLib._load = function (request, parent, ...rest) {
    if (request in mocks)
        return mocks[request];
    return origLoad.call(this, request, parent, ...rest);
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sut = require('./OfflineLoginService');
const { offlineLoginService } = sut;
// ============ helpers ============
const assert = (cond, msg) => {
    if (!cond)
        throw new Error(msg);
};
const assertEqual = (actual, expected, msg) => {
    if (actual !== expected) {
        throw new Error(`${msg} (esperado: ${String(expected)}, recibido: ${String(actual)})`);
    }
};
const makeBundle = (overrides = {}) => ({
    bundleId: 'bundle-1',
    cashRegisterId: 'register-1',
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    keyVersion: 1,
    users: [
        {
            id: 'user-1',
            email: 'cashier@test.com',
            firstName: 'Test',
            lastName: 'Cashier',
            passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$abc$def',
            pinHash: '$argon2id$v=19$m=65536,t=3,p=4$xyz$uvw',
            hasPin: true,
            roles: ['CASHIER'],
            permissions: ['POS_READ'],
            isActive: true,
            updatedAt: new Date().toISOString(),
            pinLockedUntil: null,
        },
    ],
    ...overrides,
});
const baseParams = {
    cashRegisterId: 'register-1',
    cashRegisterCode: 'CR001',
    email: 'cashier@test.com',
};
const reset = async () => {
    recordedEvents.length = 0;
    secureStorage.clear();
    argon2Accepted = new Set();
    deviceTokenValue = 'test-device-token';
    await offlineLoginService.logout();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    offlineLoginService.attempts = new Map();
};
async function run() {
    // 1) Sin bundle → USER_NOT_FOUND y se registra evento
    await reset();
    currentBundle = null;
    let res = await offlineLoginService.verifyCredentials({ ...baseParams, password: 'p' });
    assert(!res.ok && res.reason === 'USER_NOT_FOUND', '1) sin bundle → USER_NOT_FOUND');
    assertEqual(recordedEvents.length, 1, '1) evento registrado');
    assertEqual(recordedEvents[0].failureReason, 'USER_NOT_FOUND', '1) failureReason correcto');
    assertEqual(recordedEvents[0].success, false, '1) success=false');
    // 2) Bundle expirado → BUNDLE_EXPIRED
    await reset();
    currentBundle = makeBundle({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    res = await offlineLoginService.verifyCredentials({ ...baseParams, password: 'p' });
    assert(!res.ok && res.reason === 'BUNDLE_EXPIRED', '2) BUNDLE_EXPIRED retornado');
    assertEqual(recordedEvents[0].failureReason, 'BUNDLE_EXPIRED', '2) failureReason correcto');
    // 3) Usuario no existe en el bundle → USER_NOT_FOUND
    await reset();
    currentBundle = makeBundle();
    res = await offlineLoginService.verifyCredentials({
        ...baseParams,
        email: 'unknown@test.com',
        password: 'p',
    });
    assert(!res.ok && res.reason === 'USER_NOT_FOUND', '3) usuario desconocido → USER_NOT_FOUND');
    assertEqual(recordedEvents[0].failureReason, 'USER_NOT_FOUND', '3) failureReason correcto');
    // 4) Usuario inactivo → USER_INACTIVE
    await reset();
    const inactive = makeBundle();
    inactive.users[0].isActive = false;
    currentBundle = inactive;
    res = await offlineLoginService.verifyCredentials({ ...baseParams, password: 'p' });
    assert(!res.ok && res.reason === 'USER_INACTIVE', '4) USER_INACTIVE retornado');
    // 5) pinLockedUntil del bundle activo → PIN_LOCKED
    await reset();
    const lockedBundle = makeBundle();
    lockedBundle.users[0].pinLockedUntil = new Date(Date.now() + 60000).toISOString();
    currentBundle = lockedBundle;
    res = await offlineLoginService.verifyCredentials({ ...baseParams, pin: '1234' });
    assert(!res.ok && res.reason === 'PIN_LOCKED', '5) PIN_LOCKED retornado');
    assertEqual(recordedEvents[0].method, 'PIN', '5) method=PIN en el evento');
    // 6) Password correcto → sesión emitida y JWT firmado con deviceToken
    await reset();
    currentBundle = makeBundle();
    argon2Accepted.add(`correct|${currentBundle.users[0].passwordHash}`);
    res = await offlineLoginService.verifyCredentials({ ...baseParams, password: 'correct' });
    assert(res.ok, '6) login OK');
    if (res.ok) {
        assertEqual(res.session.user.email, 'cashier@test.com', '6) session.user.email');
        assertEqual(res.session.payload.method, 'PASSWORD', '6) session.payload.method=PASSWORD');
        assertEqual(res.session.payload.cashRegisterCode, 'CR001', '6) cashRegisterCode propagado');
        assertEqual(res.session.jwt.split('.').length, 3, '6) JWT con 3 segmentos');
        const verified = await cryptoOfflineReal.verifyJwtHs256(res.session.jwt, 'test-device-token');
        assert(verified !== null, '6) JWT verificable con el deviceToken usado para firmar');
    }
    assert(recordedEvents.some((e) => e.success && e.method === 'PASSWORD'), '6) evento de login success registrado');
    assert(secureStorage.has('pos.offlineSession'), '6) sesión persistida en secureStorage');
    // 7) 5 intentos fallidos consecutivos → TOO_MANY_ATTEMPTS (lock local)
    await reset();
    currentBundle = makeBundle();
    let lastRes = null;
    for (let i = 0; i < 5; i++) {
        lastRes = await offlineLoginService.verifyCredentials({ ...baseParams, password: 'wrong' });
    }
    assert(lastRes !== null && !lastRes.ok && lastRes.reason === 'TOO_MANY_ATTEMPTS', '7) 5to intento → TOO_MANY_ATTEMPTS');
    // 6 intento sigue bloqueado y registra evento TOO_MANY_ATTEMPTS sin ejecutar argon2
    const sixth = await offlineLoginService.verifyCredentials({ ...baseParams, password: 'correct' });
    assert(!sixth.ok && sixth.reason === 'TOO_MANY_ATTEMPTS', '7) 6to intento sigue bloqueado pese a password correcto');
    // 8) restoreSession devuelve la sesión persistida y verifica firma
    await reset();
    currentBundle = makeBundle();
    argon2Accepted.add(`correct|${currentBundle.users[0].passwordHash}`);
    await offlineLoginService.verifyCredentials({ ...baseParams, password: 'correct' });
    // forzar relectura desde storage simulando un proceso nuevo
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    offlineLoginService.currentSession = null;
    const restored = await offlineLoginService.restoreSession();
    assert(restored !== null && restored.user.email === 'cashier@test.com', '8) restoreSession devuelve sesión válida');
    // 9) restoreSession descarta JWT con firma inválida y limpia storage
    await reset();
    const fakeSession = {
        jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4IiwiZXhwIjo5OTk5OTk5OTk5fQ.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        payload: {
            sub: 'x',
            cashRegisterId: 'r',
            cashRegisterCode: 'C',
            bundleId: 'b',
            method: 'PASSWORD',
            offline: true,
            iat: 0,
            exp: 9999999999,
        },
        user: {
            id: 'x',
            email: 'x@x.com',
            firstName: 'X',
            lastName: 'X',
            roles: [],
            permissions: [],
        },
    };
    secureStorage.set('pos.offlineSession', JSON.stringify(fakeSession));
    const tamperedRestored = await offlineLoginService.restoreSession();
    assertEqual(tamperedRestored, null, '9) JWT con firma inválida → null');
    assert(!secureStorage.has('pos.offlineSession'), '9) storage limpiado tras rechazar firma');
    // 10) restoreSession descarta sesión expirada
    await reset();
    const expiredSession = { ...fakeSession, payload: { ...fakeSession.payload, exp: 1 } };
    secureStorage.set('pos.offlineSession', JSON.stringify(expiredSession));
    const expiredRestored = await offlineLoginService.restoreSession();
    assertEqual(expiredRestored, null, '10) sesión expirada → null');
    assert(!secureStorage.has('pos.offlineSession'), '10) storage limpiado tras expiración');
    // 11) logout limpia in-memory y storage
    await reset();
    currentBundle = makeBundle();
    argon2Accepted.add(`correct|${currentBundle.users[0].passwordHash}`);
    await offlineLoginService.verifyCredentials({ ...baseParams, password: 'correct' });
    await offlineLoginService.logout();
    assertEqual(offlineLoginService.getCurrentSession(), null, '11) currentSession null');
    assertEqual(offlineLoginService.getCurrentJwt(), null, '11) currentJwt null');
    assert(!secureStorage.has('pos.offlineSession'), '11) storage limpiado tras logout');
    console.log('✅ OfflineLoginService tests: OK (11 suites)');
}
run().catch((e) => {
    console.error(e);
    process.exit(1);
});
