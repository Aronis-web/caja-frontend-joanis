"use strict";
/**
 * Secure Storage Utility
 *
 * Wrapper around expo-secure-store for encrypted storage of sensitive data.
 * Falls back to AsyncStorage in development/web environments.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSecureItem = setSecureItem;
exports.getSecureItem = getSecureItem;
exports.deleteSecureItem = deleteSecureItem;
exports.hasSecureItem = hasSecureItem;
exports.clearAllSecureItems = clearAllSecureItems;
const SecureStore = __importStar(require("expo-secure-store"));
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const react_native_1 = require("react-native");
const isSecureStoreAvailable = react_native_1.Platform.OS === 'ios' || react_native_1.Platform.OS === 'android';
async function setSecureItem(key, value) {
    try {
        console.log(`🔐 [SecureStorage] Guardando item: ${key} (usando ${isSecureStoreAvailable ? 'SecureStore' : 'AsyncStorage'})`);
        if (isSecureStoreAvailable) {
            await SecureStore.setItemAsync(key, value);
        }
        else {
            await async_storage_1.default.setItem(`secure:${key}`, value);
        }
        console.log(`✅ [SecureStorage] Item guardado: ${key}`);
    }
    catch (error) {
        console.error(`❌ [SecureStorage] Error storing secure item ${key}:`, error);
        throw error;
    }
}
async function getSecureItem(key) {
    try {
        console.log(`🔍 [SecureStorage] Obteniendo item: ${key}`);
        let value;
        if (isSecureStoreAvailable) {
            value = await SecureStore.getItemAsync(key);
        }
        else {
            value = await async_storage_1.default.getItem(`secure:${key}`);
        }
        console.log(`${value ? '✅' : 'ℹ️'} [SecureStorage] Item ${key}: ${value ? 'encontrado' : 'no encontrado'}`);
        return value;
    }
    catch (error) {
        console.error(`❌ [SecureStorage] Error retrieving secure item ${key}:`, error);
        return null;
    }
}
async function deleteSecureItem(key) {
    try {
        if (isSecureStoreAvailable) {
            await SecureStore.deleteItemAsync(key);
        }
        else {
            await async_storage_1.default.removeItem(`secure:${key}`);
        }
    }
    catch (error) {
        console.error(`Error deleting secure item ${key}:`, error);
        throw error;
    }
}
async function hasSecureItem(key) {
    try {
        const value = await getSecureItem(key);
        return value !== null;
    }
    catch (_error) {
        return false;
    }
}
async function clearAllSecureItems(keys) {
    try {
        await Promise.all(keys.map((key) => deleteSecureItem(key)));
    }
    catch (error) {
        console.error('Error clearing secure items:', error);
        throw error;
    }
}
exports.default = {
    setItem: setSecureItem,
    getItem: getSecureItem,
    deleteItem: deleteSecureItem,
    hasItem: hasSecureItem,
    clearAll: clearAllSecureItems,
};
