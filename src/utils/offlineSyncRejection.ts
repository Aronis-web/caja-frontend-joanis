/**
 * Rechazos de sincronizacion offline que no se arreglan reintentando.
 *
 * El backend responde REJECTED por venta cuando su token no sirve: no existe,
 * es de otra caja o vencio. Antes la caja la marcaba FAILED y la volvia a mandar
 * en cada sincronizacion, para siempre y sin avisar. Ahora queda REJECTED
 * ("requiere atencion"): no se reintenta y el cajero la ve en el panel.
 * Cualquier otro error (red, lote, codigo desconocido) sigue reintentandose.
 */
export const PERMANENT_SYNC_REJECTION_CODES = [
  'TOKEN_NOT_FOUND',
  'TOKEN_WRONG_REGISTER',
  'TOKEN_EXPIRED',
] as const;

export const isPermanentSyncRejection = (result: {
  status?: string;
  errorCode?: string;
}): boolean =>
  result.status === 'REJECTED' &&
  !!result.errorCode &&
  (PERMANENT_SYNC_REJECTION_CODES as readonly string[]).includes(result.errorCode);
