/**
 * Offline Auth Types
 * Tipos para el bundle de usuarios cifrado, login offline y JWT HS256 offline.
 * Ver POS_OFFLINE.MD secciones 4.2, 5, 7.1.
 */

// ============ BUNDLE CIFRADO (respuesta cruda del backend) ============

export interface EncryptedUsersBundle {
  alg: 'AES-256-GCM';
  iv: string; // base64url, 12 bytes
  authTag: string; // base64url, 16 bytes
  ciphertext: string; // base64url
  bundleId: string;
  userCount: number;
  checksum: string;
  keyVersion: number;
  generatedAt: string;
  expiresAt: string;
  nextRefreshMs: number;
  salt: string; // cashRegisterId
  info: string; // "pos-offline-users-v1"
}

// ============ BUNDLE DESCIFRADO ============

export type OfflineLoginMethod = 'PASSWORD' | 'PIN';

export interface OfflineUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string; // argon2id
  pinHash: string | null; // argon2id
  hasPin: boolean;
  roles: string[];
  permissions: string[];
  isActive: boolean;
  updatedAt: string;
  pinLockedUntil: string | null;
}

export interface DecryptedUsersBundle {
  bundleId: string;
  cashRegisterId: string;
  generatedAt: string;
  expiresAt: string;
  keyVersion: number;
  users: OfflineUser[];
}

// ============ EVENTOS DE LOGIN OFFLINE ============

export type OfflineLoginFailureReason =
  | 'BAD_PASSWORD'
  | 'BAD_PIN'
  | 'USER_NOT_FOUND'
  | 'USER_INACTIVE'
  | 'PIN_LOCKED'
  | 'BUNDLE_EXPIRED'
  | 'TOO_MANY_ATTEMPTS';

export interface OfflineLoginEvent {
  id: string; // uuid local para idempotencia
  userId: string;
  bundleId: string;
  occurredAt: string;
  method: OfflineLoginMethod;
  success: boolean;
  failureReason?: OfflineLoginFailureReason;
  syncStatus: 'PENDING' | 'SYNCED';
}

// ============ JWT OFFLINE (HS256, firmado con device-token) ============

export interface OfflineJwtPayload {
  sub: string; // user.id
  cashRegisterId: string;
  cashRegisterCode: string;
  bundleId: string;
  method: OfflineLoginMethod;
  offline: true;
  iat: number; // segundos epoch
  exp: number; // segundos epoch
}

// ============ SESIÓN OFFLINE ACTIVA EN EL CLIENTE ============

export interface OfflineSession {
  jwt: string;
  payload: OfflineJwtPayload;
  user: Pick<OfflineUser, 'id' | 'email' | 'firstName' | 'lastName' | 'roles' | 'permissions'>;
}

// ============ RESULTADO DE VERIFICACIÓN DE CREDENCIALES ============

export type OfflineLoginResult =
  | { ok: true; session: OfflineSession }
  | { ok: false; reason: OfflineLoginFailureReason; lockedUntil?: string };

// ============ INTENTOS FALLIDOS (estado local) ============

export interface OfflineLoginAttemptState {
  userId: string;
  failedAttempts: number;
  lockedUntil: string | null;
  lastAttemptAt: string;
}
