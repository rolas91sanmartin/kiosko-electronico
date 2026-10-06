import * as SecureStore from 'expo-secure-store';
import { receiptSecurity } from '../application/receiptSecurity';
import { defaultHardwareConfig, normalizeHardwareConfig, type HardwareConfig } from '../hardware/HardwareConfig';

const URL_KEY = 'kiosko-api-url';
const API_KEY = 'kiosko-api-key';
const HARDWARE_KEY = 'kiosko-hardware-config-v1';
export const receiptSecuritySettings = receiptSecurity(SecureStore);
export const defaultApiUrl = 'https://lh8v0t3j-3000.use2.devtunnels.ms/api';

export async function loadSettings() {
  return { apiUrl: (await SecureStore.getItemAsync(URL_KEY)) || defaultApiUrl, apiKey: (await SecureStore.getItemAsync(API_KEY)) || '' };
}
export async function saveSettings(apiUrl: string, apiKey: string) {
  await Promise.all([SecureStore.setItemAsync(URL_KEY, apiUrl.replace(/\/+$/, '')), SecureStore.setItemAsync(API_KEY, apiKey)]);
}
export async function loadHardwareConfig(): Promise<HardwareConfig> {
  const stored = await SecureStore.getItemAsync(HARDWARE_KEY);
  if (!stored) return defaultHardwareConfig;
  try { return normalizeHardwareConfig(JSON.parse(stored) as Partial<HardwareConfig>); } catch { return defaultHardwareConfig; }
}
export async function saveHardwareConfig(config: HardwareConfig) {
  const normalized = normalizeHardwareConfig(config);
  await SecureStore.setItemAsync(HARDWARE_KEY, JSON.stringify(normalized));
  return normalized;
}
