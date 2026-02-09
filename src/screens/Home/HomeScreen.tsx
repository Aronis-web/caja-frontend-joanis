import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import { Ionicons } from '@expo/vector-icons';

interface HomeScreenProps {
  navigation: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  useScreenTracking('HomeScreen', 'HomeScreen');

  const { user, logout } = useAuthStore();
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  const handleLogout = async () => {
    await logout();
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.backgroundPattern}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <View style={styles.circle3} />
      </View>

      <View
        style={[
          styles.content,
          isTablet && styles.contentTablet,
          isTablet && isLandscape && styles.contentTabletLandscape,
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatarPlaceholder, isTablet && styles.avatarPlaceholderTablet]}>
              <Text style={[styles.avatarText, isTablet && styles.avatarTextTablet]}>
                {user?.name ? getUserInitials(user.name) : 'U'}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.welcomeText, isTablet && styles.welcomeTextTablet]}>
                Bienvenido
              </Text>
              <Text style={[styles.userName, isTablet && styles.userNameTablet]}>
                {user?.name || 'Usuario'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#FF6B6B" />
          </TouchableOpacity>
        </View>

        {/* Main Content - Blank */}
        <View style={styles.mainContent}>
          <View style={styles.emptyState}>
            <Ionicons name="home-outline" size={80} color="#DCC8FF" />
            <Text style={[styles.emptyTitle, isTablet && styles.emptyTitleTablet]}>
              Página de Inicio
            </Text>
            <Text style={[styles.emptySubtitle, isTablet && styles.emptySubtitleTablet]}>
              Esta es tu página principal
            </Text>
          </View>
        </View>
      </View>
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
    opacity: 0.05,
    top: -100,
    right: -100,
  },
  circle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#1ECAD0',
    opacity: 0.05,
    bottom: -50,
    left: -50,
  },
  circle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#DCC8FF',
    opacity: 0.05,
    top: '50%',
    right: -75,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  contentTablet: {
    paddingHorizontal: 48,
  },
  contentTabletLandscape: {
    paddingHorizontal: 64,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#DCC8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarPlaceholderTablet: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2A44',
  },
  avatarTextTablet: {
    fontSize: 22,
  },
  userInfo: {
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 14,
    color: '#4B587C',
  },
  welcomeTextTablet: {
    fontSize: 16,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2A44',
  },
  userNameTablet: {
    fontSize: 22,
  },
  logoutButton: {
    padding: 8,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2A44',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyTitleTablet: {
    fontSize: 32,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#4B587C',
    textAlign: 'center',
  },
  emptySubtitleTablet: {
    fontSize: 18,
  },
});

export default HomeScreen;
