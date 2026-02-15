import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store/auth';

// Type Definitions
import {
  AuthStackParamList,
  SelectionStackParamList,
  MainStackParamList,
} from '@/types/navigation';
import { AUTH_ROUTES, SELECTION_ROUTES, MAIN_ROUTES } from '@/constants/routes';

// Screens
import LoginScreen from '@/screens/Auth/LoginScreen';
import CompanySelectionScreen from '@/screens/Selection/CompanySelectionScreen';
import SiteSelectionScreen from '@/screens/Selection/SiteSelectionScreen';
import HomeScreen from '@/screens/Home/HomeScreen';

const AuthStackNavigator = createNativeStackNavigator<AuthStackParamList>();
const SelectionStackNavigator = createNativeStackNavigator<SelectionStackParamList>();
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

const SelectionStack = React.memo(function SelectionStack() {
  return (
    <SelectionStackNavigator.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={SELECTION_ROUTES.COMPANY_SELECTION}
    >
      <SelectionStackNavigator.Screen
        name={SELECTION_ROUTES.COMPANY_SELECTION}
        component={CompanySelectionScreen}
      />
      <SelectionStackNavigator.Screen
        name={SELECTION_ROUTES.SITE_SELECTION}
        component={SiteSelectionScreen}
      />
    </SelectionStackNavigator.Navigator>
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
  const { isAuthenticated, currentCompany, currentSite } = useAuthStore();

  // Not authenticated -> Login
  if (!isAuthenticated) {
    return (
      <NavigationContainer>
        <AuthStack />
      </NavigationContainer>
    );
  }

  // Authenticated but no company selected -> Company Selection
  if (!currentCompany) {
    return (
      <NavigationContainer>
        <SelectionStack />
      </NavigationContainer>
    );
  }

  // Authenticated with company but no site selected -> Site Selection
  if (!currentSite) {
    return (
      <NavigationContainer>
        <SelectionStack />
      </NavigationContainer>
    );
  }

  // Authenticated with company and site -> Main App
  return (
    <NavigationContainer>
      <MainStack />
    </NavigationContainer>
  );
};
