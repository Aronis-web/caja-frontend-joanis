/**
 * Reporte de la caja y órdenes de actualización desde el admin (solo escritorio).
 *
 * Cada 3 min (30 s mientras haya una orden) la caja reporta con su device token
 * su versión y su cola offline a /pos/devices/:id/heartbeat, y aplica la orden
 * que venga en la respuesta según remoteUpdatePolicy. Si la caja no tiene
 * acceso offline aprobado no reporta nada.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme, useThemedStyles, type Theme } from '@/design-system';
import { usePOSStore } from '@/store/pos';
import { config } from '@/utils/config';
import { deviceTokenService } from '@/services/DeviceTokenService';
import { offlineDatabase } from '@/services/OfflineDatabase';
import {
  decideRemoteUpdateStep,
  type RemoteUpdateCommand,
  type RemoteUpdateState,
} from '@/utils/remoteUpdatePolicy';

const IDLE_INTERVAL_MS = 3 * 60_000;
const ACTIVE_INTERVAL_MS = 30_000;
const COUNTDOWN_SECONDS = 60;

interface DesktopUpdaterApi {
  isElectron?: boolean;
  platform?: string;
  getUpdateState?: () => Promise<{
    currentVersion: string;
    downloaded: boolean;
    latestVersion: string | null;
  }>;
  checkForUpdates?: () => Promise<{
    updateAvailable: boolean;
    latestVersion?: string;
    updateDownloaded?: boolean;
    error?: string;
  }>;
  downloadUpdate?: () => Promise<{ success: boolean; error?: string; message?: string }>;
  installUpdate?: () => Promise<{ success: boolean; message?: string }>;
}

const desktopApi = (): DesktopUpdaterApi | null => {
  const api = (globalThis as { electronAPI?: DesktopUpdaterApi }).electronAPI;
  return api?.isElectron && api.getUpdateState ? api : null;
};

interface Report {
  commandId: string;
  state: RemoteUpdateState | 'installing';
  error?: string;
}

const isSaleInProgress = () => {
  const { cartItems, cartPayments } = usePOSStore.getState();
  return (cartItems?.length ?? 0) > 0 || (cartPayments?.length ?? 0) > 0;
};

export default function RemoteUpdateManager() {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [countdown, setCountdown] = useState<number | null>(null);
  const commandRef = useRef<RemoteUpdateCommand | null>(null);
  const checkRef = useRef<{
    commandId: string | null;
    done: boolean;
    available: boolean;
    latestVersion?: string | null;
    error?: string | null;
  }>({ commandId: null, done: false, available: false });
  const downloadingRef = useRef(false);
  const reportRef = useRef<Report | null>(null);
  const busyRef = useRef(false);

  const sendHeartbeat = useCallback(async (api: DesktopUpdaterApi) => {
    const register = await deviceTokenService.getProvisionedCashRegister();
    const token = await deviceTokenService.get();
    if (!register || !token) return null;

    const updater = await api.getUpdateState!();
    let pendingSales = 0;
    let rejectedSales = 0;
    if (offlineDatabase.isReady()) {
      pendingSales = await offlineDatabase.getPendingSalesCount().catch(() => 0);
      rejectedSales = await offlineDatabase.getRejectedSalesCount().catch(() => 0);
    }

    const response = await fetch(`${config.API_URL}/pos/devices/${register.id}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-id': config.APP_ID,
        'X-Cash-Register-Id': register.id,
        'X-Device-Token': token,
      },
      body: JSON.stringify({
        appVersion: updater.currentVersion,
        platform: api.platform,
        latestAvailableVersion: updater.latestVersion ?? undefined,
        pendingSales,
        rejectedSales,
        update: reportRef.current ?? undefined,
      }),
    });
    if (!response.ok) {
      // 403/404: caja sin acceso aprobado o endpoint aun no desplegado.
      return null;
    }
    const body = (await response.json()) as { command: RemoteUpdateCommand | null };
    return { command: body.command, updater, pendingSales };
  }, []);

  const tick = useCallback(async () => {
    const api = desktopApi();
    if (!api || busyRef.current) return;
    busyRef.current = true;
    try {
      const result = await sendHeartbeat(api);
      if (!result) return;
      const { command, updater, pendingSales } = result;
      commandRef.current = command;
      if (!command) {
        reportRef.current = null;
        return;
      }
      if (checkRef.current.commandId !== command.id) {
        checkRef.current = { commandId: command.id, done: false, available: false };
      }

      const step = decideRemoteUpdateStep({
        command,
        currentVersion: updater.currentVersion,
        check: checkRef.current,
        downloading: downloadingRef.current,
        downloaded: updater.downloaded,
        saleInProgress: isSaleInProgress(),
        pendingSales,
      });

      switch (step.action) {
        case 'report':
          reportRef.current = { commandId: command.id, state: step.state, error: step.error };
          break;
        case 'check': {
          const checked = await api.checkForUpdates!();
          checkRef.current = {
            commandId: command.id,
            done: true,
            available: !!checked.updateAvailable || !!checked.updateDownloaded,
            latestVersion: checked.latestVersion ?? null,
            error: checked.error ?? null,
          };
          break;
        }
        case 'download':
          downloadingRef.current = true;
          reportRef.current = { commandId: command.id, state: 'downloading' };
          void api.downloadUpdate!()
            .then((res) => {
              if (!res.success) {
                reportRef.current = {
                  commandId: command.id,
                  state: 'error',
                  error: res.error || res.message || 'No se pudo descargar',
                };
                checkRef.current = { commandId: null, done: false, available: false };
              }
            })
            .finally(() => {
              downloadingRef.current = false;
            });
          break;
        case 'countdown':
          setCountdown((value) => value ?? COUNTDOWN_SECONDS);
          break;
        default:
          break;
      }
    } catch (error) {
      console.warn('⚠️ [RemoteUpdate] Error en el reporte:', error);
    } finally {
      busyRef.current = false;
    }
  }, [sendHeartbeat]);

  // Bucle de reporte: más frecuente mientras haya una orden.
  useEffect(() => {
    if (!desktopApi()) return;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const loop = async () => {
      await tick();
      if (stopped) return;
      timer = setTimeout(loop, commandRef.current ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS);
    };
    timer = setTimeout(loop, 15_000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [tick]);

  const install = useCallback(async () => {
    const api = desktopApi();
    const command = commandRef.current;
    setCountdown(null);
    if (!api || !command) return;
    if (isSaleInProgress()) {
      reportRef.current = { commandId: command.id, state: 'waiting', error: 'Venta en curso' };
      return;
    }
    reportRef.current = { commandId: command.id, state: 'installing' };
    await sendHeartbeat(api).catch(() => null);
    await api.installUpdate!();
  }, [sendHeartbeat]);

  // Cuenta regresiva: se cancela si empieza una venta.
  useEffect(() => {
    if (countdown === null) return;
    if (isSaleInProgress()) {
      setCountdown(null);
      return;
    }
    if (countdown <= 0) {
      void install();
      return;
    }
    const timer = setTimeout(() => setCountdown((value) => (value ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, install]);

  if (countdown === null) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Actualización obligatoria</Text>
          <Text style={styles.body}>
            Un administrador ordenó actualizar CajaGrit. Se instalará en {countdown} s y la app se
            volverá a abrir sola.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => void install()}>
            <Text style={styles.buttonText}>Instalar ahora</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            Si empiezas una venta, la actualización espera a que termines.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      padding: 20,
    },
    title: { fontSize: 18, fontWeight: '700', color: theme.color.text.heading, marginBottom: 8 },
    body: { color: theme.color.text.body, marginBottom: 16 },
    button: {
      backgroundColor: theme.color.brand.primary,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
    buttonText: { color: theme.color.text.onAction, fontWeight: '700' },
    hint: { marginTop: 10, color: theme.color.text.muted, fontSize: 12 },
  });
