import type { CameraView } from 'expo-camera';
import type { CameraProvider, CapturedImage } from './CameraTypes';
import { NativeHardware } from '../native';

interface CameraReference { current: CameraView | null }
export class ExpoCameraProvider implements CameraProvider {
  constructor(private reference: CameraReference) {}
  async initialize() { if (!this.reference.current) throw new Error('CAMERA_NOT_READY'); }
  async getDevices() { return (await NativeHardware.getHardwareDiagnostics()).cameras; }
  async capture(): Promise<CapturedImage> {
    const photo = await this.reference.current?.takePictureAsync({ base64: true, quality: .85, shutterSound: false, skipProcessing: false });
    if (!photo) throw new Error('CAMERA_CAPTURE_FAILED');
    return { uri: photo.uri, base64: photo.base64, width: photo.width, height: photo.height };
  }
  async release() { /* Expo owns the camera lifecycle. */ }
}
