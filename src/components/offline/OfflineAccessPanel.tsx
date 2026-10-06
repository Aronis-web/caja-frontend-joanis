/**
 * Panel de acceso offline de la caja (pestaña Offline de Configuración).
 *
 * - "Solicitar acceso offline": la caja pide acceso; un administrador lo
 *   aprueba en el admin (Configuración > Otros) y la caja retira su token
 *   directamente. Nadie copia ni pega el token.
 * - "Probar modo offline": revisa, sin vender, que la caja pueda operar sin
 *   internet.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles, type Theme } from '@/design-system';
import { useOfflineStore } from '@/store/offline';
import { posService } from '@/services/POSService';
import { deviceTokenService } from '@/services/DeviceTokenService';
import { offlineDatabase } from '@/services/OfflineDatabase';
import { offlineSyncService } from '@/services/OfflineSyncService';
import { offlineUsersBundleService } from '@/services/OfflineUsersBundleService';
import { setSecureItem, getSecureItem, deleteSecureItem } from '@/utils/secureStorage';
import { bytesToBase64Url } from '@/utils/cryptoOffline';
import { createOfflineAccessFlow, type PendingOfflineAccess } from '@/utils/offlineAccessFlow';
import { runOfflineSelfTest, type OfflineCheck } from '@/utils/offlineSelfTest';

const POLL_MS = 15_000;

interface Props {
  cashRegister: { id: string; code: string } | null;
  provisioned: boolean;
  onProvisioned: () => void;
}

const offlineAccessFlow = createOfflineAccessFlow({
  storage: { get: getSecureItem, set: setSecureItem, delete: deleteSecureItem },
  randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
  encode: bytesToBase64Url,
  requestAccess: (id, body) => posService.requestOfflineAccess(id, body),
  claimAccess: (id, body) => posService.claimOfflineAccess(id, body),
  saveDeviceToken: async (token, register) => {
    await deviceTokenService.set(token);
    await deviceTokenService.setProvisionedCashRegister(register);
  },
});

const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Ocurrió un error inesperado';

export default function OfflineAccessPanel({ cashRegister, provisioned, onProvisioned }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const isOnline = useOfflineStore((state) => state.connectionStatus === 'ONLINE');
  const [pending, setPending] = useState<PendingOfflineAccess | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [checks, setChecks] = useState<OfflineCheck[] | null>(null);

  const finishDelivery = useCallback(
    async (code: string) => {
      onProvisioned();
      setInfo(`Acceso offline activado para la caja ${code}. Descargando usuarios...`);
      const bundle = await offlineUsersBundleService.downloadBundle(cashRegister?.id ?? '');
      setInfo(
        bundle.ok
          ? `Acceso offline activado para la caja ${code} con ${bundle.bundle.userCount} usuarios.`
          : `Acceso offline activado para la caja ${code}. Descarga los usuarios cuando haya conexión.`
      );
    },
    [cashRegister?.id, onProvisioned]
  );

  const check = useCallback(
    async (silent: boolean) => {
      try {
        const result = await offlineAccessFlow.check();
        switch (result.state) {
          case 'NONE':
            setPending(null);
            break;
          case 'PENDING':
            setPending(result.pending);
            if (!silent) setInfo('Todavía no la aprueban. Pide a un administrador que la revise.');
            break;
          case 'REJECTED':
            setPending(null);
            setInfo('Un administrador rechazó la solicitud.');
            break;
          case 'EXPIRED':
            setPending(null);
            setInfo(`${result.reason} Vuelve a solicitar el acceso.`);
            break;
          case 'DELIVERED':
            setPending(null);
            await finishDelivery(result.cashRegisterCode);
            break;
        }
      } catch (error) {
        if (!silent) setInfo(`No se pudo revisar la solicitud: ${message(error)}`);
      }
    },
    [finishDelivery]
  );

  // Al abrir: recuperar una solicitud en curso.
  useEffect(() => {
    void offlineAccessFlow.getPending().then(setPending);
  }, []);

  // Mientras haya una solicitud pendiente y conexión, revisar cada 15 s.
  useEffect(() => {
    if (!pending || !isOnline) return;
    const timer = setInterval(() => void check(true), POLL_MS);
    return () => clearInterval(timer);
  }, [pending, isOnline, check]);

  const handleRequest = useCallback(async () => {
    if (!cashRegister) {
      setInfo('Selecciona y abre la caja antes de solicitar el acceso.');
      return;
    }
    setBusy(true);
    setInfo(null);
    try {
      const label = Platform.OS === 'web' ? 'CajaGrit escritorio' : `CajaGrit ${Platform.OS}`;
      setPending(await offlineAccessFlow.request(cashRegister, label));
      setInfo(
        'Solicitud enviada. Un administrador debe aprobarla en Configuración > Otros > Acceso offline de cajas.'
      );
    } catch (error) {
      setInfo(`No se pudo enviar la solicitud: ${message(error)}`);
    } finally {
      setBusy(false);
    }
  }, [cashRegister]);

  const handleCheck = useCallback(async () => {
    setBusy(true);
    await check(false);
    setBusy(false);
  }, [check]);

  const handleSelfTest = useCallback(async () => {
    setTesting(true);
    try {
      setChecks(
        await runOfflineSelfTest({
          cashRegisterId: cashRegister?.id ?? null,
          isOnline,
          isDbReady: () => offlineDatabase.isReady(),
          getProvisionedCashRegister: () => deviceTokenService.getProvisionedCashRegister(),
          hasDeviceToken: () => deviceTokenService.isProvisioned(),
          pingWithDeviceToken: (id) => offlineSyncService.syncStock(id),
          getProductCount: () => offlineDatabase.getProductCount(),
          getLastProductSyncAt: async () => {
            const [full, delta] = await Promise.all([
              offlineDatabase.getLastSync('FULL'),
              offlineDatabase.getLastSync('DELTA'),
            ]);
            const times = [full?.timestamp, delta?.timestamp].filter(Boolean) as string[];
            return times.sort().pop() ?? null;
          },
          getAvailableTokenCount: () => offlineDatabase.getAvailableTokenCount(),
          getOfflineUserCount: async (id) => {
            const bundle = await offlineUsersBundleService.getDecryptedBundle(id);
            return bundle ? bundle.users.length : null;
          },
          getPendingSalesCount: () => offlineDatabase.getPendingSalesCount(),
          getRejectedSalesCount: () => offlineDatabase.getRejectedSalesCount(),
        })
      );
    } catch (error) {
      setChecks([{ key: 'error', label: 'Prueba', status: 'fail', detail: message(error) }]);
    } finally {
      setTesting(false);
    }
  }, [cashRegister?.id, isOnline]);

  const summary = useMemo(() => {
    if (!checks) return null;
    if (checks.some((c) => c.status === 'fail'))
      return 'La caja NO está lista para vender offline.';
    if (checks.some((c) => c.status === 'warn')) return 'La caja puede vender offline, con avisos.';
    return 'La caja está lista para vender offline.';
  }, [checks]);

  const iconFor = (status: OfflineCheck['status']) =>
    status === 'ok'
      ? { name: 'checkmark-circle' as const, color: theme.color.text.success }
      : status === 'warn'
        ? { name: 'alert-circle' as const, color: theme.color.text.warning }
        : { name: 'close-circle' as const, color: theme.color.text.danger };

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.title}>📶 Acceso offline</Text>
        {provisioned ? (
          <Text style={styles.helper}>
            Esta caja ya tiene acceso offline. Si cambiaste de equipo, vuelve a solicitarlo.
          </Text>
        ) : pending ? (
          <Text style={styles.helper}>
            Solicitud enviada para la caja {pending.cashRegisterCode} el{' '}
            {new Date(pending.requestedAt).toLocaleString()}. Esperando aprobación de un
            administrador (Configuración &gt; Otros &gt; Acceso offline de cajas).
          </Text>
        ) : (
          <Text style={styles.helper}>
            Pide acceso para que esta caja pueda vender sin internet. Un administrador lo aprueba
            desde el admin y el acceso llega directo a esta caja.
          </Text>
        )}

        {pending ? (
          <TouchableOpacity
            style={[styles.button, busy && styles.disabled]}
            onPress={handleCheck}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={theme.color.text.onAction} />
            ) : (
              <Text style={styles.buttonText}>Revisar estado</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, (busy || !isOnline) && styles.disabled]}
            onPress={handleRequest}
            disabled={busy || !isOnline}
          >
            {busy ? (
              <ActivityIndicator color={theme.color.text.onAction} />
            ) : (
              <Text style={styles.buttonText}>
                {provisioned ? 'Solicitar acceso de nuevo' : 'Solicitar acceso offline'}
              </Text>
            )}
          </TouchableOpacity>
        )}
        {info && <Text style={styles.info}>{info}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>🧪 Probar modo offline</Text>
        <Text style={styles.helper}>
          Revisa sin vender que la caja tenga lo necesario para operar sin internet.
        </Text>
        <TouchableOpacity
          style={[styles.button, styles.secondary, testing && styles.disabled]}
          onPress={handleSelfTest}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator color={theme.color.text.body} />
          ) : (
            <Text style={styles.secondaryText}>Probar modo offline</Text>
          )}
        </TouchableOpacity>
        {summary && <Text style={styles.summary}>{summary}</Text>}
        {checks?.map((item) => {
          const icon = iconFor(item.status);
          return (
            <View key={item.key} style={styles.checkRow}>
              <Ionicons name={icon.name} size={18} color={icon.color} />
              <View style={styles.checkText}>
                <Text style={styles.checkLabel}>{item.label}</Text>
                <Text style={styles.checkDetail}>{item.detail}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      padding: 16,
      marginBottom: 16,
    },
    title: { fontSize: 16, fontWeight: '700', color: theme.color.text.heading, marginBottom: 6 },
    helper: { color: theme.color.text.muted, marginBottom: 12 },
    button: {
      backgroundColor: theme.color.brand.primary,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 4,
    },
    buttonText: { color: theme.color.text.onAction, fontWeight: '700' },
    secondary: {
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    secondaryText: { color: theme.color.text.body, fontWeight: '700' },
    disabled: { opacity: 0.5 },
    info: { marginTop: 10, color: theme.color.text.body },
    summary: { marginTop: 12, fontWeight: '700', color: theme.color.text.heading },
    checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
    checkText: { flex: 1 },
    checkLabel: { fontWeight: '600', color: theme.color.text.body },
    checkDetail: { color: theme.color.text.muted },
  });
