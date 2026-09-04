import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

function browserStorage() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

export async function getStoredValue(key: string) {
  if (Platform.OS === 'web') return browserStorage()?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

export async function setStoredValue(key: string, value: string) {
  if (Platform.OS === 'web') browserStorage()?.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}

export async function deleteStoredValue(key: string) {
  if (Platform.OS === 'web') browserStorage()?.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}
