"use strict";
/**
 * Offline Users Bundle Service
 *
 * Descarga el bundle cifrado de usuarios (GET /pos/offline-catalog/:id/users),
 * lo almacena en la BD local y lo descifra bajo demanda para verificar credenciales.
 *
 * Ver POS_OFFLINE.MD secciones 4.2 y 5.1.
 */
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
exports.offlineUsersBundleService = void 0;
const OfflineDatabase_1 = require("./OfflineDatabase");
const DeviceTokenService_1 = require("./DeviceTokenService");
const cryptoOffline_1 = require("@/utils/cryptoOffline");
class OfflineUsersBundleService {
    constructor() {
        this.requestFn = null;
        // Cache del bundle descifrado por bundleId (en memoria, no persistido)
        this.decryptedCache = new Map();
    }
    /**
     * Inyecta la función de request HTTP (provista por OfflineSyncService para reusar
     * la lógica de headers, x-app-id, x-company-id, X-Cash-Register-Id, etc.).
     */
    setRequestFn(fn) {
        this.requestFn = fn;
    }
    /**
     * Descarga el bundle cifrado desde el backend y lo guarda en la BD local.
     * Si el backend responde 403, deshabilita el login offline (feature off).
     */
    async downloadBundle(cashRegisterId) {
        if (!this.requestFn) {
            // Forzar instanciación del sync service para que inyecte la requestFn en su constructor.
            await Promise.resolve().then(() => __importStar(require('./OfflineSyncService')));
        }
        if (!this.requestFn) {
            throw new Error('OfflineUsersBundleService: requestFn no inyectada');
        }
        await OfflineDatabase_1.offlineDatabase.initialize();
        const deviceToken = await DeviceTokenService_1.deviceTokenService.get();
        if (!deviceToken) {
            console.warn('⚠️ [UsersBundle] No hay deviceToken; no se puede descargar el bundle');
            return { ok: false, reason: 'NO_DEVICE_TOKEN' };
        }
        try {
            const bundle = await this.requestFn(`/pos/offline-catalog/${cashRegisterId}/users`, {}, cashRegisterId);
            if (!bundle || !bundle.ciphertext || !bundle.iv || !bundle.authTag) {
                console.warn('⚠️ [UsersBundle] Respuesta inválida del backend');
                return { ok: false, reason: 'NOT_FOUND' };
            }
            await OfflineDatabase_1.offlineDatabase.saveUsersBundle(cashRegisterId, bundle);
            this.decryptedCache.delete(bundle.bundleId);
            console.log(`✅ [UsersBundle] Bundle descargado (${bundle.userCount} usuarios, expira ${bundle.expiresAt})`);
            return { ok: true, bundle };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
                console.warn('ℹ️ [UsersBundle] Feature de login offline desactivada (403)');
                return { ok: false, reason: 'FEATURE_OFF', error };
            }
            if (msg.includes('404')) {
                return { ok: false, reason: 'NOT_FOUND', error };
            }
            console.error('❌ [UsersBundle] Error descargando bundle:', error);
            return { ok: false, reason: 'NETWORK_ERROR', error };
        }
    }
    /**
     * Devuelve el bundle descifrado vigente para la caja, o null si no existe.
     * Lanza si el bundle está manipulado o el deviceToken no corresponde.
     */
    async getDecryptedBundle(cashRegisterId) {
        await OfflineDatabase_1.offlineDatabase.initialize();
        const encrypted = await OfflineDatabase_1.offlineDatabase.getUsersBundle(cashRegisterId);
        if (!encrypted)
            return null;
        const cached = this.decryptedCache.get(encrypted.bundleId);
        if (cached)
            return cached;
        const deviceToken = await DeviceTokenService_1.deviceTokenService.get();
        if (!deviceToken) {
            console.warn('⚠️ [UsersBundle] No hay deviceToken; no se puede descifrar el bundle');
            return null;
        }
        // Defensa en profundidad: si el backend declara "sha256:<hex>", validar
        // contra el sha256 del ciphertext antes de descifrar. No bloquea (AES-GCM
        // ya autentica con authTag) pero permite detectar corrupción local temprano.
        if (encrypted.checksum?.startsWith('sha256:')) {
            const expected = encrypted.checksum.slice('sha256:'.length).toLowerCase();
            const actual = await (0, cryptoOffline_1.sha256Hex)(encrypted.ciphertext);
            if (expected !== actual) {
                console.warn(`⚠️ [UsersBundle] Checksum del bundle no coincide (esperado=${expected.slice(0, 12)}… actual=${actual.slice(0, 12)}…)`);
            }
        }
        const key = await (0, cryptoOffline_1.hkdfSha256)(deviceToken, encrypted.salt, encrypted.info, 32);
        const plaintext = await (0, cryptoOffline_1.aesGcmDecrypt)(key, encrypted.iv, encrypted.ciphertext, encrypted.authTag);
        let parsed;
        try {
            parsed = JSON.parse((0, cryptoOffline_1.bytesToUtf8)(plaintext));
        }
        catch {
            throw new Error('Bundle de usuarios corrupto: JSON inválido tras descifrado');
        }
        const decrypted = {
            bundleId: encrypted.bundleId,
            cashRegisterId,
            generatedAt: encrypted.generatedAt,
            expiresAt: encrypted.expiresAt,
            keyVersion: encrypted.keyVersion,
            users: parsed.users || [],
        };
        this.decryptedCache.set(encrypted.bundleId, decrypted);
        return decrypted;
    }
    /**
     * True si el bundle vigente está dentro de su expiresAt.
     */
    async isBundleValid(cashRegisterId) {
        await OfflineDatabase_1.offlineDatabase.initialize();
        const encrypted = await OfflineDatabase_1.offlineDatabase.getUsersBundle(cashRegisterId);
        if (!encrypted)
            return false;
        return new Date(encrypted.expiresAt).getTime() > Date.now();
    }
    /**
     * Elimina el bundle local (logout total / unprovisioning).
     */
    async clear(cashRegisterId) {
        await OfflineDatabase_1.offlineDatabase.initialize();
        await OfflineDatabase_1.offlineDatabase.clearUsersBundle(cashRegisterId);
        this.decryptedCache.clear();
    }
}
exports.offlineUsersBundleService = new OfflineUsersBundleService();
