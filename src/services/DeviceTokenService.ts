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

import { setSecureItem, getSecureItem, deleteSecureItem } from '@/utils/secureStorage';
import { decodeJwtPayload } from '@/utils/cryptoOffline';

const DEVICE_TOKEN_KEY = 'pos.deviceToken';
const DEVICE_CASH_REGISTER_KEY = 'pos.deviceCashRegister';

export interface DeviceTokenClaims {
  cashRegisterId: string;
  cashRegisterCode: string;
  exp: number;
  iat?: number;
  sub?: string;
  [key: string]: unknown;
}

export interface ProvisionedCashRegister {
  id: string;
  code: string;
}

class DeviceTokenService {
  private cached: string | null = null;
  private loaded = false;
  private cachedRegister: ProvisionedCashRegister | null = null;
  private registerLoaded = false;

  async get(): Promise<string | null> {
    if (this.loaded) return this.cached;
    this.cached = await getSecureItem(DEVICE_TOKEN_KEY);
    this.loaded = true;
    return this.cached;
  }

  async getClaims(): Promise<DeviceTokenClaims | null> {
    const token = await this.get();
    if (!token) return null;
    return decodeJwtPayload<DeviceTokenClaims>(token);
  }

  async set(token: string): Promise<void> {
    if (!token || typeof token !== 'string') {
      throw new Error('DeviceTokenService.set: token vacío');
    }
    await setSecureItem(DEVICE_TOKEN_KEY, token);
    this.cached = token;
    this.loaded = true;
    console.log('🔐 [DeviceToken] Token de caja almacenado');
  }

  async clear(): Promise<void> {
    await deleteSecureItem(DEVICE_TOKEN_KEY);
    await deleteSecureItem(DEVICE_CASH_REGISTER_KEY);
    this.cached = null;
    this.loaded = true;
    this.cachedRegister = null;
    this.registerLoaded = true;
    console.log('🗑️ [DeviceToken] Token y caja del device eliminados');
  }

  async isProvisioned(): Promise<boolean> {
    return (await this.get()) !== null;
  }

  /**
   * Empareja el deviceToken con la caja a la que pertenece. Vive en el device
   * (sobrevive logout) y es la fuente de verdad para el login offline.
   */
  async setProvisionedCashRegister(register: ProvisionedCashRegister): Promise<void> {
    if (!register?.id || !register?.code) {
      throw new Error('DeviceTokenService.setProvisionedCashRegister: id/code vacíos');
    }
    await setSecureItem(DEVICE_CASH_REGISTER_KEY, JSON.stringify(register));
    this.cachedRegister = register;
    this.registerLoaded = true;
    console.log('🔐 [DeviceToken] Caja provisionada:', register.code);
  }

  async getProvisionedCashRegister(): Promise<ProvisionedCashRegister | null> {
    if (this.registerLoaded) return this.cachedRegister;
    const raw = await getSecureItem(DEVICE_CASH_REGISTER_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as ProvisionedCashRegister;
        if (parsed?.id && parsed?.code) {
          this.cachedRegister = parsed;
        }
      } catch {
        this.cachedRegister = null;
      }
    }
    this.registerLoaded = true;
    return this.cachedRegister;
  }

  /**
   * Invalida el caché en memoria (útil tras un clearAllData).
   */
  invalidateCache(): void {
    this.cached = null;
    this.loaded = false;
    this.cachedRegister = null;
    this.registerLoaded = false;
  }
}

export const deviceTokenService = new DeviceTokenService();
