import { isPermanentSyncRejection } from './offlineSyncRejection';

const assertEqual = <T>(actual: T, expected: T, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message} (esperado: ${String(expected)}, recibido: ${String(actual)})`);
  }
};

assertEqual(
  isPermanentSyncRejection({ status: 'REJECTED', errorCode: 'TOKEN_EXPIRED' }),
  true,
  'token vencido no se reintenta'
);
assertEqual(
  isPermanentSyncRejection({ status: 'REJECTED', errorCode: 'TOKEN_NOT_FOUND' }),
  true,
  'token inexistente no se reintenta'
);
assertEqual(
  isPermanentSyncRejection({ status: 'REJECTED', errorCode: 'TOKEN_WRONG_REGISTER' }),
  true,
  'token de otra caja no se reintenta'
);
assertEqual(
  isPermanentSyncRejection({ status: 'REJECTED', errorCode: 'ALGO_NUEVO' }),
  false,
  'codigo desconocido se sigue reintentando'
);
assertEqual(
  isPermanentSyncRejection({ status: 'REJECTED' }),
  false,
  'rechazo sin codigo se sigue reintentando'
);
assertEqual(
  isPermanentSyncRejection({ status: 'QUEUED', errorCode: 'TOKEN_EXPIRED' }),
  false,
  'solo aplica a REJECTED'
);

console.log('✅ offlineSyncRejection: 6 casos OK');
