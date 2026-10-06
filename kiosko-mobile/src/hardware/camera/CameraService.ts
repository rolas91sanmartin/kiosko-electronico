import { logEvent } from '../../infrastructure/secureDatabase';
import { NativeHardware } from '../native';
import type { CameraConfig, CameraDevice, CameraProvider, CapturedImage } from './CameraTypes';

export class CameraService {
  private provider?: CameraProvider;
  constructor(private config: CameraConfig) {}
  configure(config: CameraConfig) { this.config = config; }
  registerProvider(provider: CameraProvider) { this.provider = provider; return () => { if (this.provider === provider) this.provider = undefined; }; }
  async getAvailableCameras() { return (await NativeHardware.getHardwareDiagnostics()).cameras; }
  async selectedCamera(): Promise<CameraDevice | null> {
    const devices = await this.getAvailableCameras();
    return devices.find(item => item.facing === this.config.preferred)
      || (this.config.allowExternal ? devices.find(item => item.external) : undefined)
      || devices.find(item => item.facing === 'front') || devices[0] || null;
  }
  async capture(): Promise<CapturedImage> {
    if (!this.config.enabled || !this.provider) throw new Error('CAMERA_PROVIDER_UNAVAILABLE');
    const image = await this.provider.capture(); void logEvent('[HARDWARE][CAMERA] capture', `${image.width || 0}x${image.height || 0}`); return image;
  }
  async release() { await this.provider?.release(); this.provider = undefined; }
}

export class UvcCameraProvider implements CameraProvider {
  async initialize() { throw new Error('UVC_NOT_IMPLEMENTED: la cámara no fue identificada aún como dispositivo UVC.'); }
  async getDevices(): Promise<CameraDevice[]> { return []; }
  async capture(): Promise<CapturedImage> { throw new Error('UVC_NOT_IMPLEMENTED'); }
  async release() { /* no resources */ }
}
