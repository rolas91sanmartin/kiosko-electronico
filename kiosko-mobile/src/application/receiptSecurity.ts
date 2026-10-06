const KEY = 'kiosko-receipt-face-enabled-v1';

interface PreferenceStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

export function receiptSecurity(store: PreferenceStore) {
  return {
    async load(): Promise<boolean> {
      const value = await store.getItemAsync(KEY);
      if (value === null || value === 'false') return false;
      if (value === 'true') return true;
      throw new Error('La configuración de reconocimiento facial no es válida. Revísela en Seguridad de RRHH.');
    },
    async save(enabled: boolean): Promise<void> {
      await store.setItemAsync(KEY, String(enabled));
    }
  };
}

export function receiptAccessStep(faceEnabled: boolean, photoDataUrl: string | null): 'face' | 'payrolls' {
  if (!faceEnabled) return 'payrolls';
  if (!photoDataUrl) throw new Error('El empleado no tiene fotografía registrada para validar su rostro.');
  return 'face';
}
