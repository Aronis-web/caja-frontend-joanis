import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store/auth';
import { usePOSStore } from '@/store/pos';

// Type Definitions
import {
  AuthStackParamList,
  SelectionStackParamList,
  POSStackParamList,
  MainStackParamList,
} from '@/types/navigation';
import { AUTH_ROUTES, SELECTION_ROUTES, POS_ROUTES, MAIN_ROUTES } from '@/constants/routes';

// Screens
import LoginScreen from '@/screens/Auth/LoginScreen';
import CompanySelectionScreen from '@/screens/Selection/CompanySelectionScreen';
import SiteSelectionScreen from '@/screens/Selection/SiteSelectionScreen';
import CashRegisterSelectionScreen from '@/screens/POS/CashRegisterSelectionScreen';
import POSDashboardScreen from '@/screens/POS/POSDashboardScreen';
import OpenSessionScreen from '@/screens/POS/OpenSessionScreen';
import CloseSessionScreen from '@/screens/POS/CloseSessionScreen';
import NewSaleScreen from '@/screens/POS/NewSaleScreen';
import SaleDetailScreen from '@/screens/POS/SaleDetailScreen';
import CashTransactionScreen from '@/screens/POS/CashTransactionScreen';
import HomeScreen from '@/screens/Home/HomeScreen';

const AuthStackNavigator = createNativeStackNavigator<AuthStackParamList>();
const SelectionStackNavigator = createNativeStackNavigator<SelectionStackParamList>();
const POSStackNavigator = createNativeStackNavigator<POSStackParamList>();
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
      <SelectionStackNavigator.Screen
        name={SELECTION_ROUTES.CASH_REGISTER_SELECTION}
        component={CashRegisterSelectionScreen}
      />
    </SelectionStackNavigator.Navigator>
  );
});

const POSStack = React.memo(function POSStack() {
  return (
    <POSStackNavigator.Navigator
      screenOptions={{ headerShown: true }}
      initialRouteName={POS_ROUTES.POS_DASHBOARD}
    >
      <POSStackNavigator.Screen
        name={POS_ROUTES.POS_DASHBOARD}
        component={POSDashboardScreen}
        options={{ title: 'POS - Dashboard' }}
      />
      <POSStackNavigator.Screen
        name={POS_ROUTES.OPEN_SESSION}
        component={OpenSessionScreen}
        options={{ title: 'Abrir Sesión' }}
      />
      <POSStackNavigator.Screen
        name={POS_ROUTES.CLOSE_SESSION}
        component={CloseSessionScreen}
        options={{ title: 'Cerrar Sesión' }}
      />
      <POSStackNavigator.Screen
        name={POS_ROUTES.NEW_SALE}
        component={NewSaleScreen}
        options={{ title: 'Nueva Venta', headerShown: false }}
      />
      <POSStackNavigator.Screen
        name={POS_ROUTES.SALE_DETAIL}
        component={SaleDetailScreen}
        options={{ title: 'Detalle de Venta' }}
      />
      <POSStackNavigator.Screen
        name={POS_ROUTES.CASH_TRANSACTION}
        component={CashTransactionScreen}
        options={{ title: 'Transacción de Efectivo' }}
      />
    </POSStackNavigator.Navigator>
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
  const { selectedCashRegister } = usePOSStore();

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

  // Authenticated with company and site but no cash register selected -> Cash Register Selection
  if (!selectedCashRegister) {
    return (
      <NavigationContainer>
        <SelectionStack />
      </NavigationContainer>
    );
  }

  // Authenticated with company, site, and cash register -> POS App
  return (
    <NavigationContainer>
      <POSStack />
    </NavigationContainer>
  );
};
