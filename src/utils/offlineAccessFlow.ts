/**
 * Solicitud de acceso offline de la caja.
 *
 * 1. La caja genera un codigo de retiro aleatorio, lo guarda en el almacen
 *    seguro y manda solo la solicitud (el servidor guarda el hash del codigo).
 * 2. Un administrador aprueba en el admin (Configuracion > Otros).
 * 3. La caja retira su device token con el codigo, una sola vez, y lo guarda.
 *    El token no pasa por ninguna persona.
 *
 * Las dependencias se inyectan para poder probarlo sin la app.
 */

export interface PendingOfflineAccess {
  requestId: string;
  claimSecret: string;
  cashRegisterId: string;
  cashRegisterCode: string;
  requestedAt: string;
}

export type OfflineAccessState =
  | { state: 'NONE' }
  | { state: 'PENDING'; pending: PendingOfflineAccess }
  | { state: 'REJECTED' }
  | { state: 'DELIVERED'; cashRegisterCode: string }
  | { state: 'EXPIRED'; reason: string };

export type ClaimResponse =
  | { status: 'PENDING' }
  | { status: 'REJECTED' }
  | { status: 'DELIVERED'; deviceToken: string; cashRegisterId: string; cashRegisterCode: string };

export interface OfflineAccessFlowDeps {
  storage: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  randomBytes: (length: number) => Uint8Array;
  encode: (bytes: Uint8Array) => string;
  requestAccess: (
    cashRegisterId: string,
    body: { claimSecret: string; deviceLabel?: string }
  ) => Promise<{ requestId: string }>;
  claimAccess: (
    cashRegisterId: string,
    body: { requestId: string; claimSecret: string }
  ) => Promise<ClaimResponse>;
  saveDeviceToken: (token: string, register: { id: string; code: string }) => Promise<void>;
  now?: () => Date;
}

export const PENDING_OFFLINE_ACCESS_KEY = 'pos.offlineAccessRequest';

/** Errores del servidor que invalidan la solicitud guardada (hay que pedir otra). */
const FINAL_STATUSES = new Set([403, 404, 409]);

export const createOfflineAccessFlow = (deps: OfflineAccessFlowDeps) => {
  const now = deps.now ?? (() => new Date());

  const getPending = async (): Promise<PendingOfflineAccess | null> => {
    const raw = await deps.storage.get(PENDING_OFFLINE_ACCESS_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as PendingOfflineAccess;
      return parsed?.requestId && parsed?.claimSecret && parsed?.cashRegisterId ? parsed : null;
    } catch {
      return null;
    }
  };

  const clearPending = () => deps.storage.delete(PENDING_OFFLINE_ACCESS_KEY);

  const request = async (
    register: { id: string; code: string },
    deviceLabel?: string
  ): Promise<PendingOfflineAccess> => {
    const claimSecret = deps.encode(deps.randomBytes(32));
    const { requestId } = await deps.requestAccess(register.id, { claimSecret, deviceLabel });
    const pending: PendingOfflineAccess = {
      requestId,
      claimSecret,
      cashRegisterId: register.id,
      cashRegisterCode: register.code,
      requestedAt: now().toISOString(),
    };
    await deps.storage.set(PENDING_OFFLINE_ACCESS_KEY, JSON.stringify(pending));
    return pending;
  };

  /** Consulta la solicitud guardada y, si fue aprobada, guarda el token. */
  const check = async (): Promise<OfflineAccessState> => {
    const pending = await getPending();
    if (!pending) return { state: 'NONE' };

    let response: ClaimResponse;
    try {
      response = await deps.claimAccess(pending.cashRegisterId, {
        requestId: pending.requestId,
        claimSecret: pending.claimSecret,
      });
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status !== undefined && FINAL_STATUSES.has(status)) {
        await clearPending();
        return {
          state: 'EXPIRED',
          reason: error instanceof Error ? error.message : 'La solicitud ya no es valida.',
        };
      }
      throw error;
    }

    if (response.status === 'PENDING') return { state: 'PENDING', pending };
    if (response.status !== 'DELIVERED') {
      await clearPending();
      return { state: 'REJECTED' };
    }
    if (response.cashRegisterId !== pending.cashRegisterId) {
      await clearPending();
      return { state: 'EXPIRED', reason: 'El token recibido no corresponde a esta caja.' };
    }
    await deps.saveDeviceToken(response.deviceToken, {
      id: response.cashRegisterId,
      code: response.cashRegisterCode,
    });
    await clearPending();
    return { state: 'DELIVERED', cashRegisterCode: response.cashRegisterCode };
  };

  return { request, check, getPending, clearPending };
};
