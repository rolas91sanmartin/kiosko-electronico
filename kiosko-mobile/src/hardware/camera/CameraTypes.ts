export interface CameraDevice { id: string; facing: 'front' | 'back' | 'external' | 'unknown'; external: boolean; hardwareLevel: number }
export interface CapturedImage { uri: string; base64?: string; width?: number; height?: number }
export interface CameraConfig { enabled: boolean; preferred: 'front' | 'external' | 'back'; allowExternal: boolean }
export interface CameraProvider {
  initialize(): Promise<void>;
  getDevices(): Promise<CameraDevice[]>;
  capture(): Promise<CapturedImage>;
  release(): Promise<void>;
}
