"use strict";
/**
 * Device Token Service
 *
 * Almacena de forma segura el X-Device-Token de la caja (validez 1 año).
 * Ver POS_OFFLINE.MD seccion 3.
 *
 * El token se inyecta automáticamente en /pos/* desde OfflineSyncService.
 * El provisioning (cómo llega el token al POS por primera vez) queda fuera
 * de este servicio: cualquier flujo puede llamar a `set()`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceTokenService = void 0;
const secureStorage_1 = require("@/utils/secureStorage");
const cryptoOffline_1 = require("@/utils/cryptoOffline");
const DEVICE_TOKEN_KEY = 'pos.deviceToken';
const DEVICE_CASH_REGISTER_KEY = 'pos.deviceCashRegister';
class DeviceTokenService {
    constructor() {
        this.cached = null;
        this.loaded = false;
        this.cachedRegister = null;
        this.registerLoaded = false;
    }
    async get() {
        if (this.loaded)
            return this.cached;
        this.cached = await (0, secureStorage_1.getSecureItem)(DEVICE_TOKEN_KEY);
        this.loaded = true;
        return this.cached;
    }
    async getClaims() {
        const token = await this.get();
        if (!token)
            return null;
        return (0, cryptoOffline_1.decodeJwtPayload)(token);
    }
    async set(token) {
        if (!token || typeof token !== 'string') {
            throw new Error('DeviceTokenService.set: token vacío');
        }
        await (0, secureStorage_1.setSecureItem)(DEVICE_TOKEN_KEY, token);
        this.cached = token;
        this.loaded = true;
        console.log('🔐 [DeviceToken] Token de caja almacenado');
    }
    async clear() {
        await (0, secureStorage_1.deleteSecureItem)(DEVICE_TOKEN_KEY);
        await (0, secureStorage_1.deleteSecureItem)(DEVICE_CASH_REGISTER_KEY);
        this.cached = null;
        this.loaded = true;
        this.cachedRegister = null;
        this.registerLoaded = true;
        console.log('🗑️ [DeviceToken] Token y caja del device eliminados');
    }
    async isProvisioned() {
        return (await this.get()) !== null;
    }
    /**
     * Empareja el deviceToken con la caja a la que pertenece. Vive en el device
     * (sobrevive logout) y es la fuente de verdad para el login offline.
     */
    async setProvisionedCashRegister(register) {
        if (!register?.id || !register?.code) {
            throw new Error('DeviceTokenService.setProvisionedCashRegister: id/code vacíos');
        }
        await (0, secureStorage_1.setSecureItem)(DEVICE_CASH_REGISTER_KEY, JSON.stringify(register));
        this.cachedRegister = register;
        this.registerLoaded = true;
        console.log('🔐 [DeviceToken] Caja provisionada:', register.code);
    }
    async getProvisionedCashRegister() {
        if (this.registerLoaded)
            return this.cachedRegister;
        const raw = await (0, secureStorage_1.getSecureItem)(DEVICE_CASH_REGISTER_KEY);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed?.id && parsed?.code) {
                    this.cachedRegister = parsed;
                }
            }
            catch {
                this.cachedRegister = null;
            }
        }
        this.registerLoaded = true;
        return this.cachedRegister;
    }
    /**
     * Invalida el caché en memoria (útil tras un clearAllData).
     */
    invalidateCache() {
        this.cached = null;
        this.loaded = false;
        this.cachedRegister = null;
        this.registerLoaded = false;
    }
}
exports.deviceTokenService = new DeviceTokenService();
