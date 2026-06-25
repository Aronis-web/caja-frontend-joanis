/**
 * Offline Users Bundle Service
 *
 * Descarga el bundle cifrado de usuarios (GET /pos/offline-catalog/:id/users),
 * lo almacena en la BD local y lo descifra bajo demanda para verificar credenciales.
 *
 * Ver POS_OFFLINE.MD secciones 4.2 y 5.1.
 */

import { offlineDatabase } from './OfflineDatabase';
import { deviceTokenService } from './DeviceTokenService';
import { hkdfSha256, aesGcmDecrypt, bytesToUtf8, sha256Hex } from '@/utils/cryptoOffline';
import type { EncryptedUsersBundle, DecryptedUsersBundle, OfflineUser } from '@/types/offlineAuth';

export type BundleDownloadResult =
  | { ok: true; bundle: EncryptedUsersBundle }
  | {
      ok: false;
      reason: 'FEATURE_OFF' | 'NOT_FOUND' | 'NO_DEVICE_TOKEN' | 'NETWORK_ERROR';
      error?: unknown;
    };

interface RequestFn {
  <T>(endpoint: string, options: RequestInit, cashRegisterId: string): Promise<T>;
}

class OfflineUsersBundleService {
  private requestFn: RequestFn | null = null;
  // Cache del bundle descifrado por bundleId (en memoria, no persistido)
  private decryptedCache: Map<string, DecryptedUsersBundle> = new Map();

  /**
   * Inyecta la función de request HTTP (provista por OfflineSyncService para reusar
   * la lógica de headers, x-app-id, x-company-id, X-Cash-Register-Id, etc.).
   */
  setRequestFn(fn: RequestFn): void {
    this.requestFn = fn;
  }

  /**
   * Descarga el bundle cifrado desde el backend y lo guarda en la BD local.
   * Si el backend responde 403, deshabilita el login offline (feature off).
   */
  async downloadBundle(cashRegisterId: string): Promise<BundleDownloadResult> {
    if (!this.requestFn) {
      // Forzar instanciación del sync service para que inyecte la requestFn en su constructor.
      await import('./OfflineSyncService');
    }
    if (!this.requestFn) {
      throw new Error('OfflineUsersBundleService: requestFn no inyectada');
    }

    await offlineDatabase.initialize();

    const deviceToken = await deviceTokenService.get();
    if (!deviceToken) {
      console.warn('⚠️ [UsersBundle] No hay deviceToken; no se puede descargar el bundle');
      return { ok: false, reason: 'NO_DEVICE_TOKEN' };
    }

    try {
      const bundle = await this.requestFn<EncryptedUsersBundle>(
        `/pos/offline-catalog/${cashRegisterId}/users`,
        {},
        cashRegisterId
      );

      if (!bundle || !bundle.ciphertext || !bundle.iv || !bundle.authTag) {
        console.warn('⚠️ [UsersBundle] Respuesta inválida del backend');
        return { ok: false, reason: 'NOT_FOUND' };
      }

      await offlineDatabase.saveUsersBundle(cashRegisterId, bundle);
      this.decryptedCache.delete(bundle.bundleId);
      console.log(
        `✅ [UsersBundle] Bundle descargado (${bundle.userCount} usuarios, expira ${bundle.expiresAt})`
      );
      return { ok: true, bundle };
    } catch (error) {
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
  async getDecryptedBundle(cashRegisterId: string): Promise<DecryptedUsersBundle | null> {
    await offlineDatabase.initialize();
    const encrypted = await offlineDatabase.getUsersBundle(cashRegisterId);
    if (!encrypted) return null;

    const cached = this.decryptedCache.get(encrypted.bundleId);
    if (cached) return cached;

    const deviceToken = await deviceTokenService.get();
    if (!deviceToken) {
      console.warn('⚠️ [UsersBundle] No hay deviceToken; no se puede descifrar el bundle');
      return null;
    }

    // Defensa en profundidad: si el backend declara "sha256:<hex>", validar
    // contra el sha256 del ciphertext antes de descifrar. No bloquea (AES-GCM
    // ya autentica con authTag) pero permite detectar corrupción local temprano.
    if (encrypted.checksum?.startsWith('sha256:')) {
      const expected = encrypted.checksum.slice('sha256:'.length).toLowerCase();
      const actual = await sha256Hex(encrypted.ciphertext);
      if (expected !== actual) {
        console.warn(
          `⚠️ [UsersBundle] Checksum del bundle no coincide (esperado=${expected.slice(0, 12)}… actual=${actual.slice(0, 12)}…)`
        );
      }
    }

    const key = await hkdfSha256(deviceToken, encrypted.salt, encrypted.info, 32);
    const plaintext = await aesGcmDecrypt(
      key,
      encrypted.iv,
      encrypted.ciphertext,
      encrypted.authTag
    );

    let parsed: { users: OfflineUser[] };
    try {
      parsed = JSON.parse(bytesToUtf8(plaintext));
    } catch {
      throw new Error('Bundle de usuarios corrupto: JSON inválido tras descifrado');
    }

    const decrypted: DecryptedUsersBundle = {
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
  async isBundleValid(cashRegisterId: string): Promise<boolean> {
    await offlineDatabase.initialize();
    const encrypted = await offlineDatabase.getUsersBundle(cashRegisterId);
    if (!encrypted) return false;
    return new Date(encrypted.expiresAt).getTime() > Date.now();
  }

  /**
   * Elimina el bundle local (logout total / unprovisioning).
   */
  async clear(cashRegisterId: string): Promise<void> {
    await offlineDatabase.initialize();
    await offlineDatabase.clearUsersBundle(cashRegisterId);
    this.decryptedCache.clear();
  }
}

export const offlineUsersBundleService = new OfflineUsersBundleService();
