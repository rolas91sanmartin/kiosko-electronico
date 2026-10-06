export interface NfcTag { id: string; technologies: string[]; raw?: string }
export interface NfcConfig { enabled: boolean; mode: 'auto' | 'android' | 'usb' }
export type NfcProviderType = 'android' | 'usb' | 'unavailable';
