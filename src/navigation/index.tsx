import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store/auth';

// Type Definitions
import { AuthStackParamList, MainStackParamList } from '@/types/navigation';
import { AUTH_ROUTES, MAIN_ROUTES } from '@/constants/routes';

// Screens
import LoginScreen from '@/screens/Auth/LoginScreen';
import HomeScreen from '@/screens/Home/HomeScreen';

const AuthStackNavigator = createNativeStackNavigator<AuthStackParamList>();
const MainStackNavigator = createNativeStackNavigator<MainStackParamList>();

const AuthStack = React.memo(function AuthStack() {
  return (
    <AuthStackNavigator.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={AUTH_ROUTES.LOGIN}
    >
      <AuthStackNavigator.Screen name={AUTH_ROUTES.LOGIN} component={LoginScreen} />
    </AuthStackNavigator.Navigator>
  );
});

const MainStack = React.memo(function MainStack() {
  return (
    <MainStackNavigator.Navigator screenOptions={{ headerShown: false }}>
      <MainStackNavigator.Screen name={MAIN_ROUTES.HOME} component={HomeScreen} />
    </MainStackNavigator.Navigator>
  );
});

export const Navigation = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <NavigationContainer>{isAuthenticated ? <MainStack /> : <AuthStack />}</NavigationContainer>
  );
};
