/**
 * Secure Storage Utility
 *
 * Wrapper around expo-secure-store for encrypted storage of sensitive data.
 * Falls back to AsyncStorage in development/web environments.
 *
 * IMPORTANT: Use this ONLY for sensitive data (tokens, credentials).
 * For non-sensitive data, use AsyncStorage directly.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Check if SecureStore is available on this platform
 * SecureStore is only available on iOS and Android
 */
const isSecureStoreAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Securely store a value
 * @param key - Storage key
 * @param value - Value to store
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    if (isSecureStoreAvailable) {
      await SecureStore.setItemAsync(key, value);
    } else {
      // Fallback to AsyncStorage for web/other platforms
      // Note: This is NOT encrypted, only use in development
      await AsyncStorage.setItem(`secure:${key}`, value);
    }
  } catch (error) {
    console.error(`Error storing secure item ${key}:`, error);
    throw error;
  }
}

/**
 * Retrieve a securely stored value
 * @param key - Storage key
 * @returns The stored value or null if not found
 */
export async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (isSecureStoreAvailable) {
      return await SecureStore.getItemAsync(key);
    } else {
      // Fallback to AsyncStorage for web/other platforms
      return await AsyncStorage.getItem(`secure:${key}`);
    }
  } catch (error) {
    console.error(`Error retrieving secure item ${key}:`, error);
    return null;
  }
}

/**
 * Remove a securely stored value
 * @param key - Storage key
 */
export async function deleteSecureItem(key: string): Promise<void> {
  try {
    if (isSecureStoreAvailable) {
      await SecureStore.deleteItemAsync(key);
    } else {
      // Fallback to AsyncStorage for web/other platforms
      await AsyncStorage.removeItem(`secure:${key}`);
    }
  } catch (error) {
    console.error(`Error deleting secure item ${key}:`, error);
    throw error;
  }
}

/**
 * Check if a secure item exists
 * @param key - Storage key
 * @returns true if the item exists, false otherwise
 */
export async function hasSecureItem(key: string): Promise<boolean> {
  try {
    const value = await getSecureItem(key);
    return value !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Clear all secure items (use with caution)
 * Note: This only clears items stored through this utility
 */
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
