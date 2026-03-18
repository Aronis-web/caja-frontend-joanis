/**
 * Secure Storage Utility
 *
 * Wrapper around expo-secure-store for encrypted storage of sensitive data.
 * Falls back to AsyncStorage in development/web environments.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const isSecureStoreAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    console.log(`🔐 [SecureStorage] Guardando item: ${key} (usando ${isSecureStoreAvailable ? 'SecureStore' : 'AsyncStorage'})`);
    if (isSecureStoreAvailable) {
      await SecureStore.setItemAsync(key, value);
    } else {
      await AsyncStorage.setItem(`secure:${key}`, value);
    }
    console.log(`✅ [SecureStorage] Item guardado: ${key}`);
  } catch (error) {
    console.error(`❌ [SecureStorage] Error storing secure item ${key}:`, error);
    throw error;
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    console.log(`🔍 [SecureStorage] Obteniendo item: ${key}`);
    let value;
    if (isSecureStoreAvailable) {
      value = await SecureStore.getItemAsync(key);
    } else {
      value = await AsyncStorage.getItem(`secure:${key}`);
    }
    console.log(`${value ? '✅' : 'ℹ️'} [SecureStorage] Item ${key}: ${value ? 'encontrado' : 'no encontrado'}`);
    return value;
  } catch (error) {
    console.error(`❌ [SecureStorage] Error retrieving secure item ${key}:`, error);
    return null;
  }
}

export async function deleteSecureItem(key: string): Promise<void> {
  try {
    if (isSecureStoreAvailable) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await AsyncStorage.removeItem(`secure:${key}`);
    }
  } catch (error) {
    console.error(`Error deleting secure item ${key}:`, error);
    throw error;
  }
}

export async function hasSecureItem(key: string): Promise<boolean> {
  try {
    const value = await getSecureItem(key);
    return value !== null;
  } catch (_error) {
    return false;
  }
}

export async function clearAllSecureItems(keys: string[]): Promise<void> {
  try {
    await Promise.all(keys.map((key) => deleteSecureItem(key)));
  } catch (error) {
    console.error('Error clearing secure items:', error);
    throw error;
  }
}

export default {
  setItem: setSecureItem,
  getItem: getSecureItem,
  deleteItem: deleteSecureItem,
  hasItem: hasSecureItem,
  clearAll: clearAllSecureItems,
};
