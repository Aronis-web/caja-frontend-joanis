/**
 * PinPadOrphansModal
 * Compuerta de reconciliación previa al cierre de caja: lista los cobros PinPad
 * (Izipay/Openpay) aprobados que aún no están asociados a una venta y permite
 * anularlos con motivo. Mientras haya al menos un cobro huérfano el cierre
 * queda bloqueado.
 */

import React, { useCallback, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useThemedStyles, type Theme } from '@/design-system';
import type { OrphanPinPadOperation, PinPadProvider } from '@/types/pos';

interface PinPadOrphansModalProps {
  visible: boolean;
  orphans: OrphanPinPadOperation[];
  totalCents: number;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => Promise<void> | void;
  onVoid: (provider: PinPadProvider, id: string, reason: string) => Promise<boolean>;
  onClose: () => void;
  /**
   * Se invoca cuando el usuario decide continuar tras resolver todos los cobros
   * huérfanos (count === 0). Reintenta el flujo de cierre de caja.
   */
  onProceed: () => void;
}

const formatSoles = (cents: number): string =>
  `S/ ${(Math.round(cents) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

export const PinPadOrphansModal: React.FC<PinPadOrphansModalProps> = ({
  visible,
  orphans,
  totalCents,
  isLoading,
  error,
  onRefresh,
  onVoid,
  onClose,
  onProceed,
}) => {
  const styles = useThemedStyles(createStyles);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const handleVoid = useCallback(
    async (op: OrphanPinPadOperation) => {
      const reason = (reasonById[op.id] || '').trim();
      if (!reason) {
        Alert.alert('Motivo requerido', 'Debe indicar un motivo para anular el cobro.');
        return;
      }
      try {
        setVoidingId(op.id);
        const voided = await onVoid(op.provider, op.id, reason);
        if (!voided) {
          Alert.alert(
            'No se pudo anular',
            'El cobro ya no estaba en estado UNCONSUMED (puede haber sido consumido o anulado).'
          );
        }
        setReasonById((prev) => {
          const next = { ...prev };
          delete next[op.id];
          return next;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al anular el cobro';
        Alert.alert('Error', msg);
      } finally {
        setVoidingId(null);
      }
    },
    [onVoid, reasonById]
  );

  const canProceed = !isLoading && orphans.length === 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Cobros PinPad sin venta</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar">
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            {orphans.length > 0
              ? `Hay ${orphans.length} cobro(s) aprobado(s) sin venta por ${formatSoles(totalCents)}. Debe asociarlos a una venta o anularlos con motivo antes de cerrar caja.`
              : 'No hay cobros PinPad sin venta. Puede continuar con el cierre.'}
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Consultando cobros huérfanos...</Text>
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {orphans.map((op) => {
                const isVoiding = voidingId === op.id;
                return (
                  <View key={op.id} style={styles.item}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemAmount}>{formatSoles(op.amountCents)}</Text>
                      <Text style={styles.itemProvider}>{op.provider}</Text>
                    </View>
                    <Text style={styles.itemMeta}>
                      {op.cardLast4 ? `Tarjeta ****${op.cardLast4}  ` : ''}
                      {op.approvalCode ? `Aut: ${op.approvalCode}  ` : ''}
                      {op.operationNumber ? `Op: ${op.operationNumber}` : ''}
                    </Text>
                    <TextInput
                      style={styles.reasonInput}
                      placeholder="Motivo de anulación (obligatorio)"
                      value={reasonById[op.id] || ''}
                      onChangeText={(t) => setReasonById((prev) => ({ ...prev, [op.id]: t }))}
                      editable={!isVoiding}
                      multiline
                    />
                    <TouchableOpacity
                      style={[styles.voidButton, isVoiding && styles.voidButtonDisabled]}
                      onPress={() => handleVoid(op)}
                      disabled={isVoiding}
                    >
                      {isVoiding ? (
                        <ActivityIndicator />
                      ) : (
                        <Text style={styles.voidButtonText}>Anular con motivo</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void onRefresh()}>
              <Text style={styles.secondaryButtonText}>Actualizar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Cerrar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, !canProceed && styles.primaryButtonDisabled]}
              onPress={onProceed}
              disabled={!canProceed}
            >
              <Text style={styles.primaryButtonText}>Continuar cierre</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[3],
    },
    container: {
      width: '100%',
      maxWidth: 640,
      maxHeight: '90%',
      backgroundColor: theme.color.background.default,
      borderRadius: 12,
      padding: theme.space[4],
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[2],
    },
    title: { fontSize: 18, fontWeight: '700', color: theme.color.text.default },
    close: { fontSize: 20, color: theme.color.text.muted, paddingHorizontal: 8 },
    subtitle: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginBottom: theme.space[3],
    },
    errorText: {
      color: theme.color.text.critical ?? '#c00',
      marginBottom: theme.space[2],
      fontSize: 13,
    },
    loadingBox: {
      paddingVertical: theme.space[4],
      alignItems: 'center',
      gap: theme.space[2],
    },
    loadingText: { color: theme.color.text.muted, marginTop: 8 },
    list: { maxHeight: 360, marginBottom: theme.space[3] },
    listContent: { gap: theme.space[3] },
    item: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: 8,
      padding: theme.space[3],
      gap: theme.space[2],
      backgroundColor: theme.color.background.subtle,
    },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    itemAmount: { fontSize: 16, fontWeight: '700', color: theme.color.text.default },
    itemProvider: {
      fontSize: 12,
      color: theme.color.text.muted,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    itemMeta: { fontSize: 12, color: theme.color.text.muted },
    reasonInput: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: 6,
      padding: theme.space[2],
      minHeight: 44,
      color: theme.color.text.default,
      backgroundColor: theme.color.background.default,
    },
    voidButton: {
      alignSelf: 'flex-end',
      backgroundColor: theme.color.text.critical ?? '#c00',
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: 6,
    },
    voidButtonDisabled: { opacity: 0.6 },
    voidButtonText: { color: '#fff', fontWeight: '600' },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.space[2],
      marginTop: theme.space[2],
    },
    secondaryButton: {
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    secondaryButtonText: { color: theme.color.text.default, fontWeight: '600' },
    primaryButton: {
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      borderRadius: 6,
      backgroundColor: theme.color.text.link,
    },
    primaryButtonDisabled: { opacity: 0.5 },
    primaryButtonText: { color: '#fff', fontWeight: '700' },
  });
