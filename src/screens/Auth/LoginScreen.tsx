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

interface LoginScreenProps {
  navigation?: any;
}

export const LoginScreen: React.FC<LoginScreenProps> = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { width, height } = useWindowDimensions();

  const { loginWithCredentials, isLoading, error } = useAuthStore();

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

      console.log('✅ Login exitoso');
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
                  CG
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
              Inicia sesión en Caja Grit
            </Text>
          </View>

          <View
            style={[
              styles.form,
              isTablet && styles.formTablet,
              isTablet && isLandscape && styles.formLandscape,
            ]}
          >
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, isTablet && styles.inputLabelTablet]}>
                Correo electrónico
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  isTablet && styles.inputWrapperTablet,
                  isTablet && isLandscape && styles.inputWrapperLandscape,
                ]}
              >
                <TextInput
                  style={[
                    styles.input,
                    isTablet && styles.inputTablet,
                    isTablet && isLandscape && styles.inputLandscape,
                  ]}
                  placeholder="correo@empresa.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, isTablet && styles.inputLabelTablet]}>
                Contraseña
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  isTablet && styles.inputWrapperTablet,
                  isTablet && isLandscape && styles.inputWrapperLandscape,
                ]}
              >
                <TextInput
                  style={[
                    styles.input,
                    styles.inputWithIcon,
                    isTablet && styles.inputTablet,
                    isTablet && isLandscape && styles.inputLandscape,
                  ]}
                  placeholder="Ingresa tu contraseña"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.rememberMeContainer}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxChecked,
                    isTablet && styles.checkboxTablet,
                  ]}
                >
                  {rememberMe && (
                    <Ionicons name="checkmark" size={isTablet ? 18 : 16} color="#FFFFFF" />
                  )}
                </View>
                <Text style={[styles.rememberMeText, isTablet && styles.rememberMeTextTablet]}>
                  Mantener sesión iniciada
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                isLoading && styles.buttonDisabled,
                isTablet && styles.buttonTablet,
                isTablet && isLandscape && styles.buttonLandscape,
              ]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.9}
            >
              <View style={[styles.buttonInner, isLoading && styles.buttonInnerDisabled]}>
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[styles.buttonText, isTablet && styles.buttonTextTablet]}>
                    Iniciar Sesión
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, isTablet && styles.footerTextTablet]}>
              © 2024 Caja Grit
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    top: -100,
    right: -100,
  },
  circle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(139, 92, 246, 0.06)',
    bottom: 100,
    left: -50,
  },
  circle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    top: '50%',
    right: 50,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoInner: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
  },
  form: {
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  input: {
    width: '100%',
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  inputWithIcon: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: '100%',
  },
  rememberMeContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  checkboxTablet: {
    width: 24,
    height: 24,
    borderRadius: 7,
    marginRight: 12,
  },
  rememberMeText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  rememberMeTextTablet: {
    fontSize: 16,
  },
  button: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    marginTop: 20,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonInner: {
    flex: 1,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonInnerDisabled: {
    backgroundColor: '#94A3B8',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  // Tablet styles
  contentTablet: {
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  logoInnerTablet: {
    width: 100,
    height: 100,
    borderRadius: 28,
  },
  logoTablet: {
    fontSize: 40,
  },
  titleTablet: {
    fontSize: 38,
  },
  subtitleTablet: {
    fontSize: 18,
  },
  formTablet: {
    marginBottom: 48,
  },
  inputLabelTablet: {
    fontSize: 16,
  },
  inputWrapperTablet: {
    borderRadius: 14,
  },
  inputTablet: {
    height: 60,
    fontSize: 18,
    paddingHorizontal: 20,
  },
  buttonTablet: {
    height: 60,
    borderRadius: 14,
  },
  buttonTextTablet: {
    fontSize: 18,
  },
  footerTextTablet: {
    fontSize: 14,
  },
  // Landscape styles
  contentTabletLandscape: {
    maxWidth: 700,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  headerLandscape: {
    marginBottom: 12,
    paddingTop: 0,
  },
  logoInnerLandscape: {
    width: 70,
    height: 70,
    borderRadius: 20,
  },
  logoLandscape: {
    fontSize: 30,
  },
  titleLandscape: {
    fontSize: 28,
    marginTop: 12,
  },
  subtitleLandscape: {
    fontSize: 15,
    marginTop: 6,
  },
  formLandscape: {
    marginBottom: 20,
  },
  inputWrapperLandscape: {
    borderRadius: 12,
  },
  inputLandscape: {
    height: 50,
    fontSize: 16,
    paddingHorizontal: 18,
  },
  buttonLandscape: {
    height: 50,
    borderRadius: 12,
    marginTop: 16,
  },
});

export default LoginScreen;
