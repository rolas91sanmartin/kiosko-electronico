export interface ScannerResult { value: string; timestamp: number; deviceId?: number }
export interface ScannerConfig { enabled: boolean; mode: 'auto' | 'hid' | 'serial' | 'usb'; suffix: 'ENTER'; characterTimeoutMs: number; serialPort: string | null }
export interface HardwareKeyEvent { character: string; keyCode: number; timestamp: number; deviceId: number; external: boolean }
