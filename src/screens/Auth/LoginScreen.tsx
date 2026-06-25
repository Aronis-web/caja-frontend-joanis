import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth';
import { config } from '@/utils/config';
import secureStorage from '@/utils/secureStorage';
import { networkMonitor } from '@/services/NetworkMonitor';
import { deviceTokenService } from '@/services/DeviceTokenService';
import {
  Button,
  Input,
  Body,
  Caption,
  Heading,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@/design-system';
import packageJson from '../../../package.json';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loginMode, setLoginMode] = useState<'password' | 'pin'>('password');
  const [rememberMe, setRememberMe] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => networkMonitor.getStatus());
  const [isProvisioned, setIsProvisioned] = useState<boolean>(false);
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const { loginWithCredentials, loginOffline, isLoading, error, clearError } = useAuthStore();

  const passwordRef = useRef<TextInput>(null);
  const pinRef = useRef<TextInput>(null);

  useEffect(() => {
    (async () => {
      const [storedRemember, storedEmail, provisioned] = await Promise.all([
        secureStorage.getItem(config.STORAGE_KEYS.REMEMBER_ME),
        AsyncStorage.getItem(config.STORAGE_KEYS.LAST_EMAIL),
        deviceTokenService.isProvisioned(),
      ]);
      if (storedRemember === 'true') {
        setRememberMe(true);
      }
      if (storedEmail) {
        setEmail(storedEmail);
      }
      setIsProvisioned(provisioned);
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe((online) => setIsOnline(online));
    void networkMonitor.checkConnectivity();
    return () => {
      unsubscribe();
    };
  }, []);

  const isWide = width >= 600;
  const offlineLoginAvailable = !isOnline && isProvisioned;

  const handleLogin = async () => {
    if (isLoading) return;
    if (!email) return;

    if (offlineLoginAvailable) {
      const credential = loginMode === 'pin' ? pin : password;
      if (!credential) return;
      console.log('🔑 Iniciando login OFFLINE...');
      await loginOffline({
        email,
        password: loginMode === 'password' ? password : undefined,
        pin: loginMode === 'pin' ? pin : undefined,
      });
      return;
    }

    if (!password) return;
    console.log('🔑 Iniciando proceso de login...');
    await loginWithCredentials(email, password, rememberMe);
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (error) clearError();
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (error) clearError();
  };

  const handlePinChange = (text: string) => {
    setPin(text.replace(/[^0-9]/g, '').slice(0, 8));
    if (error) clearError();
  };

  const canSubmit =
    !!email &&
    !isLoading &&
    (offlineLoginAvailable ? (loginMode === 'pin' ? pin.length >= 4 : !!password) : !!password);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.column, isWide && styles.columnWide]}>
            <View style={styles.brandBlock}>
              <View style={styles.logoMark}>
                <Heading size="medium" color="onAction" style={styles.logoMarkText}>
                  CG
                </Heading>
              </View>
              <Heading size="large" color="heading" style={styles.brandName}>
                Caja Grit
              </Heading>
            </View>

            <View style={styles.intro}>
              <Heading size="medium" color="heading" align="center" style={styles.title}>
                Iniciá sesión
              </Heading>
              <Body size="medium" color="muted" align="center">
                {offlineLoginAvailable
                  ? 'Ingresá tus credenciales para continuar (modo offline).'
                  : 'Ingresá tus credenciales para continuar.'}
              </Body>
            </View>

            {!isOnline && (
              <View style={isProvisioned ? styles.offlineBanner : styles.warningBanner}>
                <Ionicons
                  name={isProvisioned ? 'cloud-offline' : 'warning'}
                  size={18}
                  color={isProvisioned ? theme.color.text.warning : theme.color.text.danger}
                />
                <Body
                  size="small"
                  color={isProvisioned ? 'warning' : 'danger'}
                  style={styles.bannerText}
                >
                  {isProvisioned
                    ? 'Sin conexión: vas a iniciar sesión en modo offline contra esta caja.'
                    : 'Sin conexión y caja sin provisionar. Conectate para iniciar sesión.'}
                </Body>
              </View>
            )}

            <View style={styles.form}>
              <Input
                label="Correo electrónico"
                placeholder="correo@empresa.com"
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                size="medium"
                containerStyle={styles.field}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() =>
                  offlineLoginAvailable && loginMode === 'pin'
                    ? pinRef.current?.focus()
                    : passwordRef.current?.focus()
                }
              />

              {offlineLoginAvailable && loginMode === 'pin' ? (
                <Input
                  ref={pinRef}
                  label="PIN"
                  placeholder="••••"
                  value={pin}
                  onChangeText={handlePinChange}
                  keyboardType="number-pad"
                  secureTextEntry
                  autoCorrect={false}
                  size="medium"
                  containerStyle={styles.field}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
              ) : (
                <Input
                  ref={passwordRef}
                  label="Contraseña"
                  placeholder="••••••••"
                  value={password}
                  onChangeText={handlePasswordChange}
                  secureTextEntry
                  autoCorrect={false}
                  size="medium"
                  containerStyle={styles.field}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
              )}

              {offlineLoginAvailable && (
                <TouchableOpacity
                  style={styles.modeSwitch}
                  onPress={() => {
                    setLoginMode((prev) => (prev === 'password' ? 'pin' : 'password'));
                    if (error) clearError();
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="swap-horizontal" size={16} color={theme.color.text.link} />
                  <Body size="small" color="link" style={styles.modeSwitchText}>
                    {loginMode === 'password' ? 'Usar PIN' : 'Usar contraseña'}
                  </Body>
                </TouchableOpacity>
              )}

              {!offlineLoginAvailable && (
                <TouchableOpacity
                  style={styles.rememberRow}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && (
                      <Ionicons name="checkmark" size={14} color={theme.color.text.onAction} />
                    )}
                  </View>
                  <Body size="small" color="muted">
                    Mantener sesión iniciada
                  </Body>
                </TouchableOpacity>
              )}

              <Button
                title={offlineLoginAvailable ? 'Iniciar sesión offline' : 'Iniciar sesión'}
                onPress={handleLogin}
                loading={isLoading}
                disabled={!canSubmit}
                size="medium"
                fullWidth
                style={styles.submitButton}
              />

              {error && !isLoading && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color={theme.color.text.danger} />
                  <Body size="small" color="danger" style={styles.errorText}>
                    {error}
                  </Body>
                </View>
              )}
            </View>
          </View>

          <View style={styles.footer}>
            <Caption color="subtle">v{packageJson.version}</Caption>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.canvas,
    },
    flex: { flex: 1 },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[10],
    },
    column: {
      width: '100%',
      maxWidth: 360,
      alignSelf: 'center',
    },
    columnWide: {
      maxWidth: 380,
    },
    brandBlock: {
      alignItems: 'center',
      marginBottom: theme.space[8],
    },
    logoMark: {
      width: 72,
      height: 72,
      borderRadius: theme.radii['2xl'],
      backgroundColor: theme.color.action.primary.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.space[4],
    },
    logoMarkText: {
      fontWeight: '800',
      letterSpacing: 1,
    },
    brandName: {
      fontWeight: '700',
    },
    intro: {
      marginBottom: theme.space[8],
      alignItems: 'center',
    },
    title: {
      marginBottom: theme.space[2],
    },
    form: {},
    field: {
      marginBottom: theme.space[4],
    },
    rememberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.space[1],
      marginBottom: theme.space[2],
    },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: theme.radii.sm,
      borderWidth: 1.5,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[2],
    },
    checkboxChecked: {
      backgroundColor: theme.color.action.primary.background,
      borderColor: theme.color.action.primary.background,
    },
    submitButton: {
      marginTop: theme.space[6],
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.state.danger.background,
      borderRadius: theme.radii.md,
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      marginTop: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.state.danger.border,
    },
    errorText: {
      marginLeft: theme.space[2],
      flex: 1,
    },
    offlineBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.state.warning.background,
      borderRadius: theme.radii.md,
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      marginBottom: theme.space[6],
      borderWidth: 1,
      borderColor: theme.color.state.warning.border,
    },
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.state.danger.background,
      borderRadius: theme.radii.md,
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      marginBottom: theme.space[6],
      borderWidth: 1,
      borderColor: theme.color.state.danger.border,
    },
    bannerText: {
      marginLeft: theme.space[2],
      flex: 1,
    },
    modeSwitch: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.space[1],
      marginBottom: theme.space[2],
    },
    modeSwitchText: {
      marginLeft: theme.space[2],
    },
    footer: {
      alignItems: 'center',
      paddingTop: theme.space[8],
    },
  });

export default LoginScreen;
