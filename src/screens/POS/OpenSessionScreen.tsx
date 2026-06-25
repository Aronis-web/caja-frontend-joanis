/**
 * Open Session Screen
 * Allows user to open a new cash register session
 */

import React, { useState } from 'react';
import { View, StyleSheet, TextInput, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/auth';
import { usePOSStore } from '@/store/pos';
import { ROUTES } from '@/constants/routes';
import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Label,
  Title,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@/design-system';

export default function OpenSessionScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const { selectedCashRegister, openSession, isLoading } = usePOSStore();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [openingBalance, setOpeningBalance] = useState('');
  const [notes, setNotes] = useState('');

  const handleOpenSession = async () => {
    if (!selectedCashRegister || !user) {
      console.error('❌ Error: Información de caja o usuario no disponible');
      return;
    }

    const balance = parseFloat(openingBalance);
    if (isNaN(balance) || balance < 0) {
      console.error('❌ Error: El balance de apertura debe ser un número válido mayor o igual a 0');
      return;
    }

    try {
      console.log('🔄 Iniciando apertura de sesión...');
      console.log('📊 Balance inicial:', balance);
      console.log('🏪 Caja registradora:', selectedCashRegister.name);

      await openSession(
        selectedCashRegister.id,
        user.id,
        balance,
        notes || `Apertura de caja - ${new Date().toLocaleDateString('es-PE')}`
      );

      console.log('✅ Sesión abierta exitosamente');
      console.log('🔙 Navegando a Nueva Venta...');

      // Navegar a Nueva Venta
      navigation.navigate(ROUTES.NEW_SALE as never);
    } catch (error) {
      console.error('❌ Error al abrir sesión:', error);
      console.error(
        '❌ Mensaje de error:',
        error instanceof Error ? error.message : 'Error desconocido'
      );
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Heading size="medium" color="heading">
          Abrir Caja
        </Heading>
        <Body size="small" color="muted">
          {selectedCashRegister?.name}
        </Body>
      </View>

      <View style={styles.form}>
        <Card variant="elevated" padding="medium" style={styles.infoCard}>
          <Body size="small" color="muted">
            Usuario:
          </Body>
          <Body size="small" color="heading" style={styles.infoValue}>
            {user?.name}
          </Body>
        </Card>

        <Card variant="elevated" padding="medium" style={styles.infoCard}>
          <Body size="small" color="muted">
            Fecha y Hora:
          </Body>
          <Body size="small" color="heading" style={styles.infoValue}>
            {new Date().toLocaleString('es-PE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Body>
        </Card>

        <View style={styles.inputGroup}>
          <Label size="medium" color="heading" style={styles.label}>
            Balance de Apertura{' '}
            <Title size="small" color="danger">
              *
            </Title>
          </Label>
          <View style={styles.currencyInput}>
            <Title size="small" color="heading" style={styles.currencySymbol}>
              S/
            </Title>
            <TextInput
              style={styles.input}
              value={openingBalance}
              onChangeText={setOpeningBalance}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.color.text.placeholder}
            />
          </View>
          <Caption color="subtle" style={styles.hint}>
            Ingrese el monto en efectivo con el que inicia la caja
          </Caption>
        </View>

        <View style={styles.inputGroup}>
          <Label size="medium" color="heading" style={styles.label}>
            Notas (Opcional)
          </Label>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Ej: Apertura turno mañana"
            placeholderTextColor={theme.color.text.placeholder}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="Cancelar"
            variant="outline"
            onPress={() => navigation.goBack()}
            disabled={isLoading}
            fullWidth
            style={styles.button}
          />
          <Button
            title="Abrir Caja"
            variant="primary"
            onPress={handleOpenSession}
            disabled={isLoading || !openingBalance}
            loading={isLoading}
            fullWidth
            style={styles.button}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    header: {
      backgroundColor: theme.color.surface.base,
      padding: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      gap: theme.space[1],
    },
    form: {
      padding: theme.space[4],
    },
    infoCard: {
      marginBottom: theme.space[3],
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    infoValue: {
      fontWeight: '600',
    },
    inputGroup: {
      marginBottom: theme.space[5],
    },
    label: {
      marginBottom: theme.space[2],
    },
    currencyInput: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    currencySymbol: {
      paddingLeft: theme.space[4],
      paddingRight: theme.space[2],
    },
    input: {
      flex: 1,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.md,
      padding: theme.space[3.5],
      fontSize: 16,
      color: theme.color.text.body,
    },
    textArea: {
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      height: 80,
      textAlignVertical: 'top',
    },
    hint: {
      marginTop: theme.space[1],
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: theme.space[3],
      marginTop: theme.space[6],
    },
    button: {
      flex: 1,
    },
  });
