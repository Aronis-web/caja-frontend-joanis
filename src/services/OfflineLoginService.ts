/**
 * Offline Login Service
 *
 * Verifica credenciales contra el bundle descifrado, emite un JWT HS256 firmado
 * con el deviceToken, registra eventos de login y mantiene la sesión offline activa.
 *
 * Ver POS_OFFLINE.MD secciones 5.2, 5.3, 5.5 y 7.1.
 */

import { argon2Verify } from 'hash-wasm';
import bcrypt from 'bcryptjs';
import { offlineDatabase } from './OfflineDatabase';
import { deviceTokenService } from './DeviceTokenService';
import { offlineUsersBundleService } from './OfflineUsersBundleService';
import { signJwtHs256, verifyJwtHs256 } from '@/utils/cryptoOffline';
import { setSecureItem, getSecureItem, deleteSecureItem } from '@/utils/secureStorage';
import type {
  OfflineJwtPayload,
  OfflineLoginAttemptState,
  OfflineLoginEvent,
  OfflineLoginMethod,
  OfflineLoginResult,
  OfflineSession,
  OfflineUser,
} from '@/types/offlineAuth';

const OFFLINE_SESSION_KEY = 'pos.offlineSession';
const JWT_TTL_SECONDS = 10 * 60 * 60; // 10 horas, encaja con un turno de caja
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos

/**
 * Verifica un password contra un hash en formato PHC, eligiendo el algoritmo según el prefix.
 * Soporta argon2id/argon2i/argon2d (spec POS_OFFLINE.MD 5.2) y bcrypt ($2a/$2b/$2y) como fallback
 * mientras el backend migre todos los bundles a argon2id.
 */
async function verifyPasswordHash(input: string, hash: string): Promise<boolean> {
  if (hash.startsWith('$argon2')) {
    return argon2Verify({ password: input, hash });
  }
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    return bcrypt.compare(input, hash);
  }
  throw new Error(`Formato de hash no soportado: prefix="${hash.slice(0, 12)}"`);
}

class OfflineLoginService {
  private currentSession: OfflineSession | null = null;
  private attempts: Map<string, OfflineLoginAttemptState> = new Map();

  /**
   * Verifica credenciales (password o PIN) contra el bundle local y, si son válidas,
   * emite un JWT HS256 firmado con el deviceToken y persiste la sesión.
   */
  async verifyCredentials(params: {
    cashRegisterId: string;
    cashRegisterCode: string;
    email: string;
    password?: string;
    pin?: string;
  }): Promise<OfflineLoginResult> {
    const { cashRegisterId, cashRegisterCode, email, password, pin } = params;
    const method: OfflineLoginMethod = pin ? 'PIN' : 'PASSWORD';

    const bundle = await offlineUsersBundleService.getDecryptedBundle(cashRegisterId);
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
    } catch (e) {
      const prefix = typeof hash === 'string' ? hash.slice(0, 12) : '(no-string)';
      console.error(
        `❌ [OfflineLogin] verifyPasswordHash falló (hash.prefix="${prefix}" length=${hash?.length ?? 0}):`,
        e
      );
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
    const session = await this.issueSession(
      user,
      bundle.bundleId,
      cashRegisterId,
      cashRegisterCode,
      method
    );
    await this.recordLoginEvent({
      userId: user.id,
      bundleId: bundle.bundleId,
      method,
      success: true,
    });

    this.currentSession = session;
    await setSecureItem(OFFLINE_SESSION_KEY, JSON.stringify(session));
    console.log(`✅ [OfflineLogin] Sesión offline emitida para ${user.email} (${method})`);
    return { ok: true, session };
  }

  /**
   * Restaura la sesión offline previa desde storage seguro (sin re-verificar credenciales).
   * Verifica el `exp` y la firma HS256 con el deviceToken para detectar tampering.
   */
  async restoreSession(): Promise<OfflineSession | null> {
    if (this.currentSession) return this.currentSession;
    const raw = await getSecureItem(OFFLINE_SESSION_KEY);
    if (!raw) return null;
    try {
      const session = JSON.parse(raw) as OfflineSession;
      if (session.payload.exp * 1000 < Date.now()) {
        await deleteSecureItem(OFFLINE_SESSION_KEY);
        return null;
      }
      const deviceToken = await deviceTokenService.get();
      if (!deviceToken) {
        await deleteSecureItem(OFFLINE_SESSION_KEY);
        return null;
      }
      const verified = await verifyJwtHs256<OfflineJwtPayload>(session.jwt, deviceToken);
      if (!verified) {
        console.warn('⚠️ [OfflineLogin] Firma del JWT offline inválida; descartando sesión');
        await deleteSecureItem(OFFLINE_SESSION_KEY);
        return null;
      }
      this.currentSession = session;
      return session;
    } catch {
      return null;
    }
  }

  /**
   * Devuelve la sesión offline activa en memoria (sin tocar storage).
   */
  getCurrentSession(): OfflineSession | null {
    return this.currentSession;
  }

  /**
   * Devuelve el JWT offline para inyectarlo como X-Offline-Session.
   */
  getCurrentJwt(): string | null {
    return this.currentSession?.jwt ?? null;
  }

  /**
   * Cierra la sesión offline.
   */
  async logout(): Promise<void> {
    this.currentSession = null;
    await deleteSecureItem(OFFLINE_SESSION_KEY);
    console.log('🔒 [OfflineLogin] Sesión offline cerrada');
  }

  /**
   * Encola un evento de login para sincronizar al volver online.
   */
  async recordLoginEvent(
    event: Omit<OfflineLoginEvent, 'id' | 'occurredAt' | 'syncStatus'>
  ): Promise<void> {
    await offlineDatabase.initialize();
    const fullEvent: OfflineLoginEvent = {
      id: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      syncStatus: 'PENDING',
      ...event,
    };
    await offlineDatabase.saveLoginEvent(fullEvent);
  }

  // ============ PRIVADOS ============

  private async issueSession(
    user: OfflineUser,
    bundleId: string,
    cashRegisterId: string,
    cashRegisterCode: string,
    method: OfflineLoginMethod
  ): Promise<OfflineSession> {
    const deviceToken = await deviceTokenService.get();
    if (!deviceToken) {
      throw new Error('No hay deviceToken para firmar el JWT offline');
    }

    const now = Math.floor(Date.now() / 1000);
    const payload: OfflineJwtPayload = {
      sub: user.id,
      cashRegisterId,
      cashRegisterCode,
      bundleId,
      method,
      offline: true,
      iat: now,
      exp: now + JWT_TTL_SECONDS,
    };

    const jwt = await signJwtHs256(payload, deviceToken);

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

  private registerFailure(userId: string): OfflineLoginAttemptState {
    const prev = this.attempts.get(userId);
    const failed = (prev?.failedAttempts ?? 0) + 1;
    const lockedUntil =
      failed >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS).toISOString() : null;
    const next: OfflineLoginAttemptState = {
      userId,
      failedAttempts: failed,
      lockedUntil,
      lastAttemptAt: new Date().toISOString(),
    };
    this.attempts.set(userId, next);
    return next;
  }
}

export const offlineLoginService = new OfflineLoginService();
