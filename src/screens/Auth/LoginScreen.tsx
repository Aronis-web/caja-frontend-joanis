import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { AUTH_ROUTES } from '@/constants/routes';

interface LoginScreenProps {
  navigation: any;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { width, height } = useWindowDimensions();

  const { loginWithCredentials, isLoading, error, isAuthenticated } = useAuthStore();
  const { clearTenantContext } = useTenantStore();

  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    try {
      console.log('🔑 Iniciando proceso de login...');
      const success = await loginWithCredentials(email, password, rememberMe);

      if (!success) {
        console.log('❌ Login falló');
        Alert.alert('Error', error || 'Credenciales incorrectas');
        return;
      }

      console.log('✅ Login exitoso, limpiando contexto de tenant...');
      await clearTenantContext();

      console.log('✅ Login completado - La navegación se manejará automáticamente');
    } catch (error) {
      console.error('❌ Error en handleLogin:', error);
      Alert.alert('Error', 'No se pudo conectar al servidor');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.backgroundPattern}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <View style={styles.circle3} />
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View
          style={[
            styles.content,
            isTablet && styles.contentTablet,
            isTablet && isLandscape && styles.contentTabletLandscape,
          ]}
        >
          <View style={[styles.header, isTablet && isLandscape && styles.headerLandscape]}>
            <View style={styles.logoContainer}>
              <View
                style={[
                  styles.logoInner,
                  isTablet && styles.logoInnerTablet,
                  isTablet && isLandscape && styles.logoInnerLandscape,
                ]}
              >
                <Text
                  style={[
                    styles.logo,
                    isTablet && styles.logoTablet,
                    isTablet && isLandscape && styles.logoLandscape,
                  ]}
                >
                  CJ
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.title,
                isTablet && styles.titleTablet,
                isTablet && isLandscape && styles.titleLandscape,
              ]}
            >
              Bienvenido
            </Text>
            <Text
              style={[
                styles.subtitle,
                isTablet && styles.subtitleTablet,
                isTablet && isLandscape && styles.subtitleLandscape,
              ]}
            >
              Inicia sesión para continuar
            </Text>
          </View>

          <View style={[styles.form, isTablet && styles.formTablet]}>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#4B587C" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                placeholder="Correo electrónico"
                placeholderTextColor="#9E9E9E"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#4B587C"
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                placeholder="Contraseña"
                placeholderTextColor="#9E9E9E"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color="#4B587C"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={styles.rememberMeContainer}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                </View>
                <Text style={styles.rememberMeText}>Recordarme</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.loginButton,
                isTablet && styles.loginButtonTablet,
                isLoading && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={[
                    styles.loginButtonText,
                    isTablet && styles.loginButtonTextTablet,
                  ]}
                >
                  Iniciar Sesión
                </Text>
              )}
            </TouchableOpacity>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#FF6B6B" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backgroundPattern: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  circle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#DCC8FF',
    opacity: 0.1,
    top: -100,
    right: -100,
  },
  circle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#1ECAD0',
    opacity: 0.1,
    bottom: -50,
    left: -50,
  },
  circle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#DCC8FF',
    opacity: 0.1,
    top: '50%',
    left: -75,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  contentTablet: {
    paddingHorizontal: 48,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  contentTabletLandscape: {
    maxWidth: 500,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  headerLandscape: {
    marginBottom: 30,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DCC8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInnerTablet: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  logoInnerLandscape: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2A44',
  },
  logoTablet: {
    fontSize: 40,
  },
  logoLandscape: {
    fontSize: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2A44',
    marginBottom: 8,
  },
  titleTablet: {
    fontSize: 36,
  },
  titleLandscape: {
    fontSize: 32,
  },
  subtitle: {
    fontSize: 16,
    color: '#4B587C',
  },
  subtitleTablet: {
    fontSize: 18,
  },
  subtitleLandscape: {
    fontSize: 16,
  },
  form: {
    width: '100%',
  },
  formTablet: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F2A44',
  },
  inputTablet: {
    fontSize: 18,
  },
  eyeIcon: {
    padding: 8,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#DCC8FF',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#DCC8FF',
    borderColor: '#DCC8FF',
  },
  rememberMeText: {
    fontSize: 14,
    color: '#4B587C',
  },
  loginButton: {
    backgroundColor: '#1ECAD0',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1ECAD0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonTablet: {
    height: 64,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loginButtonTextTablet: {
    fontSize: 18,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#FF6B6B',
    marginLeft: 8,
    flex: 1,
  },
});

export default LoginScreen;
