/**
 * Decide qué hacer con una orden de actualización que llegó desde el admin.
 *
 * - "Actualizar": descarga en segundo plano; se instala al cerrar CajaGrit
 *   (o con el botón Instalar de Configuración > Actualizaciones).
 * - "Forzar": además instala sola, pero nunca con una venta en curso ni con
 *   ventas offline sin subir; entonces muestra una cuenta regresiva.
 */

export interface RemoteUpdateCommand {
  id: string;
  force: boolean;
  minVersion: string | null;
}

export type RemoteUpdateState = 'up-to-date' | 'downloading' | 'downloaded' | 'waiting' | 'error';

export interface RemoteUpdateInputs {
  command: RemoteUpdateCommand | null;
  currentVersion: string;
  check: {
    done: boolean;
    available: boolean;
    latestVersion?: string | null;
    error?: string | null;
  };
  downloading: boolean;
  downloaded: boolean;
  saleInProgress: boolean;
  pendingSales: number;
}

export type RemoteUpdateStep =
  | { action: 'idle' }
  | { action: 'check' }
  | { action: 'download' }
  | { action: 'countdown' }
  | { action: 'report'; state: RemoteUpdateState; error?: string };

export const compareVersions = (a?: string | null, b?: string | null): number | null => {
  const parse = (value?: string | null) => {
    const match = String(value ?? '')
      .trim()
      .match(/^v?(\d+)\.(\d+)\.(\d+)/);
    return match ? match.slice(1, 4).map(Number) : null;
  };
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
};

export const decideRemoteUpdateStep = (input: RemoteUpdateInputs): RemoteUpdateStep => {
  const { command } = input;
  if (!command) return { action: 'idle' };

  if (
    command.minVersion &&
    (compareVersions(input.currentVersion, command.minVersion) ?? -1) >= 0
  ) {
    return { action: 'report', state: 'up-to-date' };
  }

  if (input.downloaded) {
    if (!command.force) return { action: 'report', state: 'downloaded' };
    if (input.saleInProgress) {
      return { action: 'report', state: 'waiting', error: 'Venta en curso' };
    }
    if (input.pendingSales > 0) {
      return {
        action: 'report',
        state: 'waiting',
        error: `${input.pendingSales} venta(s) offline sin subir`,
      };
    }
    return { action: 'countdown' };
  }

  if (input.downloading) return { action: 'report', state: 'downloading' };
  if (!input.check.done) return { action: 'check' };
  if (input.check.error) return { action: 'report', state: 'error', error: input.check.error };

  if (!input.check.available) {
    if (command.minVersion) {
      return {
        action: 'report',
        state: 'error',
        error: `La versión ${command.minVersion} aún no está publicada (última: ${
          input.check.latestVersion ?? input.currentVersion
        })`,
      };
    }
    return { action: 'report', state: 'up-to-date' };
  }

  return { action: 'download' };
};
