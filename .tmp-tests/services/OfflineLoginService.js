"use strict";
/**
 * Offline Login Service
 *
 * Verifica credenciales contra el bundle descifrado, emite un JWT HS256 firmado
 * con el deviceToken, registra eventos de login y mantiene la sesión offline activa.
 *
 * Ver POS_OFFLINE.MD secciones 5.2, 5.3, 5.5 y 7.1.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.offlineLoginService = void 0;
const hash_wasm_1 = require("hash-wasm");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const OfflineDatabase_1 = require("./OfflineDatabase");
const DeviceTokenService_1 = require("./DeviceTokenService");
const OfflineUsersBundleService_1 = require("./OfflineUsersBundleService");
const cryptoOffline_1 = require("@/utils/cryptoOffline");
const secureStorage_1 = require("@/utils/secureStorage");
const OFFLINE_SESSION_KEY = 'pos.offlineSession';
const JWT_TTL_SECONDS = 10 * 60 * 60; // 10 horas, encaja con un turno de caja
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos
/**
 * Verifica un password contra un hash en formato PHC, eligiendo el algoritmo según el prefix.
 * Soporta argon2id/argon2i/argon2d (spec POS_OFFLINE.MD 5.2) y bcrypt ($2a/$2b/$2y) como fallback
 * mientras el backend migre todos los bundles a argon2id.
 */
async function verifyPasswordHash(input, hash) {
    if (hash.startsWith('$argon2')) {
        return (0, hash_wasm_1.argon2Verify)({ password: input, hash });
    }
    if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
        return bcryptjs_1.default.compare(input, hash);
    }
    throw new Error(`Formato de hash no soportado: prefix="${hash.slice(0, 12)}"`);
}
class OfflineLoginService {
    constructor() {
        this.currentSession = null;
        this.attempts = new Map();
    }
    /**
     * Verifica credenciales (password o PIN) contra el bundle local y, si son válidas,
     * emite un JWT HS256 firmado con el deviceToken y persiste la sesión.
     */
    async verifyCredentials(params) {
        const { cashRegisterId, cashRegisterCode, email, password, pin } = params;
        const method = pin ? 'PIN' : 'PASSWORD';
        const bundle = await OfflineUsersBundleService_1.offlineUsersBundleService.getDecryptedBundle(cashRegisterId);
        if (!bundle) {
            await this.recordLoginEvent({
                userId: 'unknown',
                bundleId: 'none',
                method,
                success: false,
                failureReason: 'USER_NOT_FOUND',
            });
            return { ok: false, reason: 'USER_NOT_FOUND' };
        }
        if (new Date(bundle.expiresAt).getTime() < Date.now()) {
            await this.recordLoginEvent({
                userId: 'unknown',
                bundleId: bundle.bundleId,
                method,
                success: false,
                failureReason: 'BUNDLE_EXPIRED',
            });
            return { ok: false, reason: 'BUNDLE_EXPIRED' };
        }
        const user = bundle.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user) {
            await this.recordLoginEvent({
                userId: 'unknown',
                bundleId: bundle.bundleId,
                method,
                success: false,
                failureReason: 'USER_NOT_FOUND',
            });
            return { ok: false, reason: 'USER_NOT_FOUND' };
        }
        if (!user.isActive) {
            await this.recordLoginEvent({
                userId: user.id,
                bundleId: bundle.bundleId,
                method,
                success: false,
                failureReason: 'USER_INACTIVE',
            });
            return { ok: false, reason: 'USER_INACTIVE' };
        }
        if (user.pinLockedUntil && new Date(user.pinLockedUntil).getTime() > Date.now()) {
            await this.recordLoginEvent({
                userId: user.id,
                bundleId: bundle.bundleId,
                method,
                success: false,
                failureReason: 'PIN_LOCKED',
            });
            return { ok: false, reason: 'PIN_LOCKED', lockedUntil: user.pinLockedUntil };
        }
        const localLock = this.attempts.get(user.id);
        if (localLock?.lockedUntil && new Date(localLock.lockedUntil).getTime() > Date.now()) {
            await this.recordLoginEvent({
                userId: user.id,
                bundleId: bundle.bundleId,
                method,
                success: false,
                failureReason: 'TOO_MANY_ATTEMPTS',
            });
            return { ok: false, reason: 'TOO_MANY_ATTEMPTS', lockedUntil: localLock.lockedUntil };
        }
        // Verificación argon2id
        const hash = method === 'PIN' ? user.pinHash : user.passwordHash;
        const input = method === 'PIN' ? pin : password;
        if (!hash || !input) {
            const reason = method === 'PIN' ? 'BAD_PIN' : 'BAD_PASSWORD';
            await this.recordLoginEvent({
                userId: user.id,
                bundleId: bundle.bundleId,
                method,
                success: false,
                failureReason: reason,
            });
            return { ok: false, reason };
        }
        let ok = false;
        try {
            ok = await verifyPasswordHash(input, hash);
        }
        catch (e) {
            const prefix = typeof hash === 'string' ? hash.slice(0, 12) : '(no-string)';
            console.error(`❌ [OfflineLogin] verifyPasswordHash falló (hash.prefix="${prefix}" length=${hash?.length ?? 0}):`, e);
            ok = false;
        }
        if (!ok) {
            const reason = method === 'PIN' ? 'BAD_PIN' : 'BAD_PASSWORD';
            const state = this.registerFailure(user.id);
            await this.recordLoginEvent({
                userId: user.id,
                bundleId: bundle.bundleId,
                method,
                success: false,
                failureReason: reason,
            });
            if (state.lockedUntil) {
                return { ok: false, reason: 'TOO_MANY_ATTEMPTS', lockedUntil: state.lockedUntil };
            }
            return { ok: false, reason };
        }
        this.attempts.delete(user.id);
        const session = await this.issueSession(user, bundle.bundleId, cashRegisterId, cashRegisterCode, method);
        await this.recordLoginEvent({
            userId: user.id,
            bundleId: bundle.bundleId,
            method,
            success: true,
        });
        this.currentSession = session;
        await (0, secureStorage_1.setSecureItem)(OFFLINE_SESSION_KEY, JSON.stringify(session));
        console.log(`✅ [OfflineLogin] Sesión offline emitida para ${user.email} (${method})`);
        return { ok: true, session };
    }
    /**
     * Restaura la sesión offline previa desde storage seguro (sin re-verificar credenciales).
     * Verifica el `exp` y la firma HS256 con el deviceToken para detectar tampering.
     */
    async restoreSession() {
        if (this.currentSession)
            return this.currentSession;
        const raw = await (0, secureStorage_1.getSecureItem)(OFFLINE_SESSION_KEY);
        if (!raw)
            return null;
        try {
            const session = JSON.parse(raw);
            if (session.payload.exp * 1000 < Date.now()) {
                await (0, secureStorage_1.deleteSecureItem)(OFFLINE_SESSION_KEY);
                return null;
            }
            const deviceToken = await DeviceTokenService_1.deviceTokenService.get();
            if (!deviceToken) {
                await (0, secureStorage_1.deleteSecureItem)(OFFLINE_SESSION_KEY);
                return null;
            }
            const verified = await (0, cryptoOffline_1.verifyJwtHs256)(session.jwt, deviceToken);
            if (!verified) {
                console.warn('⚠️ [OfflineLogin] Firma del JWT offline inválida; descartando sesión');
                await (0, secureStorage_1.deleteSecureItem)(OFFLINE_SESSION_KEY);
                return null;
            }
            this.currentSession = session;
            return session;
        }
        catch {
            return null;
        }
    }
    /**
     * Devuelve la sesión offline activa en memoria (sin tocar storage).
     */
    getCurrentSession() {
        return this.currentSession;
    }
    /**
     * Devuelve el JWT offline para inyectarlo como X-Offline-Session.
     */
    getCurrentJwt() {
        return this.currentSession?.jwt ?? null;
    }
    /**
     * Cierra la sesión offline.
     */
    async logout() {
        this.currentSession = null;
        await (0, secureStorage_1.deleteSecureItem)(OFFLINE_SESSION_KEY);
        console.log('🔒 [OfflineLogin] Sesión offline cerrada');
    }
    /**
     * Encola un evento de login para sincronizar al volver online.
     */
    async recordLoginEvent(event) {
        await OfflineDatabase_1.offlineDatabase.initialize();
        const fullEvent = {
            id: crypto.randomUUID(),
            occurredAt: new Date().toISOString(),
            syncStatus: 'PENDING',
            ...event,
        };
        await OfflineDatabase_1.offlineDatabase.saveLoginEvent(fullEvent);
    }
    // ============ PRIVADOS ============
    async issueSession(user, bundleId, cashRegisterId, cashRegisterCode, method) {
        const deviceToken = await DeviceTokenService_1.deviceTokenService.get();
        if (!deviceToken) {
            throw new Error('No hay deviceToken para firmar el JWT offline');
        }
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            sub: user.id,
            cashRegisterId,
            cashRegisterCode,
            bundleId,
            method,
            offline: true,
            iat: now,
            exp: now + JWT_TTL_SECONDS,
        };
        const jwt = await (0, cryptoOffline_1.signJwtHs256)(payload, deviceToken);
        return {
            jwt,
            payload,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                roles: user.roles,
                permissions: user.permissions,
            },
        };
    }
    registerFailure(userId) {
        const prev = this.attempts.get(userId);
        const failed = (prev?.failedAttempts ?? 0) + 1;
        const lockedUntil = failed >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS).toISOString() : null;
        const next = {
            userId,
            failedAttempts: failed,
            lockedUntil,
            lastAttemptAt: new Date().toISOString(),
        };
        this.attempts.set(userId, next);
        return next;
    }
}
exports.offlineLoginService = new OfflineLoginService();
