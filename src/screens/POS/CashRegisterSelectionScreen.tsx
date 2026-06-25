/**
 * Cash Register Selection Screen
 * Allows user to select a cash register after company and site selection
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/auth';
import { usePOSStore } from '@/store/pos';
import type { CashRegister } from '@/types/pos';
import { ROUTES } from '@/constants/routes';
import {
  Badge,
  Body,
  Card,
  Caption,
  EmptyState,
  Heading,
  Title,
  useTheme,
  useThemedStyles,
  type BadgeVariant,
  type Theme,
} from '@/design-system';

export default function CashRegisterSelectionScreen() {
  const navigation = useNavigation();
  const currentSite = useAuthStore((state) => state.currentSite);
  const currentCompany = useAuthStore((state) => state.currentCompany);
  const user = useAuthStore((state) => state.user);
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);

  const { loadCashRegistersBySite, setSelectedCashRegister, loadPaymentMethods } = usePOSStore();

  // Verificar si el usuario ya tiene una caja activa
  const userActiveCashRegister = cashRegisters.find(
    (cr) => cr.currentSessionId && cr.currentUserId === user?.id
  );

  useEffect(() => {
    loadCashRegisters();
    loadPaymentMethods();
  }, []);

  const loadCashRegisters = async () => {
    if (!currentSite) {
      Alert.alert('Error', 'No se ha seleccionado una sede');
      return;
    }

    try {
      setLoading(true);
      const registers = await loadCashRegistersBySite(currentSite.id);
      // Filter by status === 'ACTIVE' (API returns status, not isActive)
      setCashRegisters(registers.filter((r) => r.status === 'ACTIVE'));
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar las cajas registradoras');
    } finally {
      setLoading(false);
    }
  };

  // Verifica si la caja está abierta por otra persona
  const isOpenByOtherUser = (cashRegister: CashRegister): boolean => {
    return !!(
      cashRegister.currentSessionId &&
      cashRegister.currentUserId &&
      cashRegister.currentUserId !== user?.id
    );
  };

  // Verifica si el usuario tiene otra caja activa (diferente a esta)
  const userHasAnotherActiveCashRegister = (cashRegister: CashRegister): boolean => {
    return !!(userActiveCashRegister && userActiveCashRegister.id !== cashRegister.id);
  };

  const handleSelectCashRegister = async (cashRegister: CashRegister) => {
    // Validar si la caja está abierta por otra persona
    if (isOpenByOtherUser(cashRegister)) {
      Alert.alert(
        'Caja no disponible',
        'Esta caja está siendo utilizada por otro usuario. Solo puedes acceder a cajas cerradas o que hayas abierto tú mismo.'
      );
      return;
    }

    // Validar si el usuario ya tiene otra caja activa
    if (userHasAnotherActiveCashRegister(cashRegister)) {
      Alert.alert(
        'Ya tienes una caja activa',
        `Debes cerrar tu sesión en "${userActiveCashRegister?.name}" antes de poder acceder a otra caja.`
      );
      return;
    }

    try {
      await setSelectedCashRegister(cashRegister);
      // Navegar explícitamente al dashboard para evitar arrastrar una ruta previa (ej. NewSale)
      navigation.navigate(ROUTES.POS_DASHBOARD as never);
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la caja');
    }
  };

  const renderCashRegister = ({ item }: { item: CashRegister }) => {
    const blockedByOther = isOpenByOtherUser(item);
    const blockedByActiveSession = userHasAnotherActiveCashRegister(item);
    const isOpenByMe = item.currentSessionId && item.currentUserId === user?.id;
    const isBlocked = blockedByOther || blockedByActiveSession;

    const getStatusVariant = (): BadgeVariant => {
      if (isBlocked) return 'danger';
      if (isOpenByMe) return 'info';
      if (item.currentSessionId) return 'success';
      return 'default';
    };

    const getStatusLabel = () => {
      if (blockedByOther) return 'OCUPADA';
      if (isOpenByMe) return 'MI CAJA';
      if (item.currentSessionId) return 'ABIERTA';
      return 'CERRADA';
    };

    const getBlockedMessage = () => {
      if (blockedByOther) return '🔒 En uso por otro usuario';
      if (blockedByActiveSession) return '⚠️ Ya tienes otra caja activa';
      return null;
    };

    return (
      <Card
        variant="elevated"
        padding="medium"
        onPress={() => handleSelectCashRegister(item)}
        disabled={isBlocked}
        style={isBlocked ? styles.cardBlocked : undefined}
      >
        <View style={styles.cardHeader}>
          <Title size="small" color={isBlocked ? 'muted' : 'heading'} style={styles.cardTitle}>
            {item.name}
          </Title>
          <Badge label={getStatusLabel()} variant={getStatusVariant()} size="small" pill />
        </View>
        <Body size="small" color={isBlocked ? 'subtle' : 'muted'}>
          Código: {item.code}
        </Body>
        {item.emissionPoint && (
          <Caption color={isBlocked ? 'subtle' : 'muted'} style={styles.cardDetail}>
            Punto de Emisión: {item.emissionPoint.code} - {item.emissionPoint.description}
          </Caption>
        )}
        {getBlockedMessage() && (
          <Body size="small" color="danger" style={styles.blockedMessage}>
            {getBlockedMessage()}
          </Body>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.color.action.primary.background} />
          <Body size="medium" color="muted" style={styles.loadingText}>
            Cargando cajas...
          </Body>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Heading size="medium" color="heading">
          Seleccionar Caja
        </Heading>
        <Body size="small" color="muted">
          {currentCompany?.name}
        </Body>
        <Body size="small" color="muted">
          {currentSite?.name}
        </Body>
      </View>

      {cashRegisters.length === 0 ? (
        <EmptyState
          icon="albums-outline"
          title="No hay cajas registradoras disponibles"
          description="Contacte al administrador para configurar una caja"
        />
      ) : (
        <FlatList
          data={cashRegisters}
          renderItem={renderCashRegister}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      backgroundColor: theme.color.surface.base,
      padding: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      gap: theme.space[1],
    },
    loadingText: {
      marginTop: theme.space[3],
    },
    listContainer: {
      padding: theme.space[4],
      gap: theme.space[3],
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[2],
      gap: theme.space[2],
    },
    cardTitle: {
      flex: 1,
    },
    cardDetail: {
      marginTop: theme.space[1],
    },
    cardBlocked: {
      opacity: 0.65,
    },
    blockedMessage: {
      marginTop: theme.space[2],
    },
  });
