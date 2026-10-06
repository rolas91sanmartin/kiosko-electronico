import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { Employee } from '../domain/contracts';
import { loadSettings } from '../infrastructure/settings';
import { logEvent } from '../infrastructure/secureDatabase';
import { ActionButton, Message } from './components';
import { colors } from './theme';
import { KioskHardware } from '../hardware/KioskHardware';
import { ExpoCameraProvider } from '../hardware/camera/ExpoCameraProvider';

interface Props { employee: Employee; threshold: number; requiredMatches: number; onVerified(): void; onCancel(): void }

export function FaceVerification({ employee, threshold, requiredMatches, onVerified, onCancel }: Props) {
  const camera = useRef<CameraView>(null);
  const web = useRef<WebView>(null);
  const capturing = useRef(false);
  const completed = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [engineUrl, setEngineUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelsReady, setModelsReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('front');
  const [status, setStatus] = useState('Preparando reconocimiento facial…');
  const [matches, setMatches] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void loadSettings().then(settings => { setEngineUrl(`${settings.apiUrl}/face/engine`); setApiKey(settings.apiKey); }); }, []);
  useEffect(() => { if (!permission && permission !== null) return; if (!permission?.granted) void requestPermission(); }, [permission, requestPermission]);
  useEffect(() => KioskHardware.camera.registerProvider(new ExpoCameraProvider(camera)), []);
  useEffect(() => { void KioskHardware.camera.selectedCamera().then(device => setCameraFacing(device?.facing === 'front' ? 'front' : 'back')).catch(() => setCameraFacing('front')); }, []);
  useEffect(() => {
    if (!modelsReady || !cameraReady || !employee.photoDataUrl || completed.current) return;
    const timer = setInterval(async () => {
      if (capturing.current || completed.current || !camera.current) return;
      capturing.current = true;
      try {
        const shot = await camera.current.takePictureAsync({ base64: true, quality: .45, shutterSound: false, skipProcessing: false });
        if (shot?.base64) web.current?.postMessage(JSON.stringify({ type: 'frame', image: `data:image/jpeg;base64,${shot.base64}` }));
      } finally { capturing.current = false; }
    }, 850);
    return () => clearInterval(timer);
  }, [modelsReady, cameraReady, employee.photoDataUrl]);

  const message = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type: string; status?: string; matches?: number; message?: string };
      if (data.type === 'models-ready' && employee.photoDataUrl) {
        setModelsReady(true);
        web.current?.postMessage(JSON.stringify({ type: 'initialize', reference: employee.photoDataUrl, threshold, required: requiredMatches }));
      } else if (data.type === 'ready') setStatus('Mantenga el rostro dentro del marco');
      else if (data.type === 'progress') { setStatus(data.status || 'Verificando…'); setMatches(data.matches || 0); }
      else if (data.type === 'verified' && !completed.current) { completed.current = true; void logEvent('face.verified', employee.code); onVerified(); }
      else if (data.type === 'error') { setError(data.message || 'No se pudo verificar el rostro.'); void logEvent('face.error', data.message, 'error'); }
    } catch { setError('El motor facial devolvió una respuesta inválida.'); }
  };

  if (!employee.photoDataUrl) return <View style={styles.center}><Message text="El empleado no tiene fotografía registrada para comparar su rostro."/><ActionButton icon="arrow-back" label="Usar otro empleado" secondary onPress={onCancel}/></View>;
  return <View style={styles.layout}>
    <View style={styles.cameraBox}>{permission?.granted ? <CameraView ref={camera} style={[StyleSheet.absoluteFill, styles.cameraRotated]} facing={cameraFacing} mirror={false} onCameraReady={() => setCameraReady(true)} /> : <View style={styles.center}><Text style={styles.white}>Autorice el uso de la cámara.</Text><ActionButton icon="camera" label="Dar permiso" onPress={() => void requestPermission()}/></View>}<View style={styles.faceFrame}/></View>
    <View style={styles.info}><Text style={styles.name}>{employee.name}</Text><Text style={styles.status}>{status}</Text><Text style={styles.counter}>Coincidencias de identidad: {matches}/{requiredMatches}</Text>{(!modelsReady || !cameraReady) && <ActivityIndicator color={colors.green}/>}{error && <Message text={error}/>}<ActionButton icon="arrow-back" label="Usar otro empleado" secondary onPress={onCancel}/></View>
    {engineUrl ? <WebView ref={web} source={{ uri: engineUrl, headers: apiKey ? { 'x-api-key': apiKey } : undefined }} onMessage={message} javaScriptEnabled domStorageEnabled style={styles.engine}/> : null}
  </View>;
}

const styles = StyleSheet.create({
  layout: { flex: 1, padding: 18, gap: 14 }, cameraBox: { flex: 1, minHeight: 260, overflow: 'hidden', borderRadius: 18, backgroundColor: '#07151d' }, cameraRotated: { transform: [{ rotate: '180deg' }] }, faceFrame: { position: 'absolute', left: '29%', top: '10%', width: '42%', height: '80%', borderWidth: 3, borderColor: '#6ee4b3', borderRadius: 150 }, info: { alignItems: 'center', gap: 7 }, name: { color: colors.ink, fontSize: 18, fontWeight: '800' }, status: { color: colors.green, fontWeight: '800' }, counter: { color: colors.muted }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 }, white: { color: '#fff' }, engine: { position: 'absolute', width: 1, height: 1, opacity: .01 }
});
