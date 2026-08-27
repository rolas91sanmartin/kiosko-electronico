import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Modal, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parsePayrollCode } from '../application/payrollCode';
import { setTrustedScannerActive } from '../application/trustedExternalFlow';
import { diagnostic } from '../infrastructure/diagnosticLogger';
import { saveEnvelope } from '../infrastructure/envelopeRepository';
import { colors } from './theme';

type ScannerMode = 'choice' | 'integrated';

async function lockPortrait() {
  await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
}

async function lockLandscape() {
  await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
}

export function ScannerScreen({ onSaved }: { onSaved(): void }) {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScannerMode>('choice');
  const [launchingGoogle, setLaunchingGoogle] = useState(false);
  const processing = useRef(false);

  const returnToChoice = useCallback(async () => {
    diagnostic('SCANNER', 'returning_to_choice');
    setMode('choice');
    await lockPortrait();
  }, []);

  const processCode = useCallback(async (data: string, source: 'google' | 'integrated') => {
    if (processing.current) { diagnostic('SCANNER', 'result_ignored_processing', { source }); return; }
    diagnostic('SCANNER', 'processing_started', { source, payloadLength: data.length });
    processing.current = true;
    try {
      const { envelope, checksum } = await parsePayrollCode(data);
      diagnostic('SCANNER', 'payload_validated', { source });
      await saveEnvelope(db, envelope, checksum);
      diagnostic('SCANNER', 'envelope_saved', { source });
      await lockPortrait();
      Alert.alert('Comprobante guardado', `Planilla ${envelope.payroll.consecutive} almacenada en este dispositivo.`, [{ text: 'Ver sobres', onPress: onSaved }]);
    } catch (caught) {
      diagnostic('SCANNER', 'processing_failed', { source, error: caught instanceof Error ? caught.message : String(caught) });
      const error = caught instanceof Error ? caught.message : 'No se pudo leer el comprobante.';
      Alert.alert('Código no válido', error, [{ text: 'Intentar nuevamente', onPress: () => { processing.current = false; } }]);
    }
  }, [db, onSaved]);

  useEffect(() => {
    diagnostic('SCANNER', 'selector_mounted');
    void lockPortrait();
    const subscription = CameraView.onModernBarcodeScanned(({ data }) => {
      diagnostic('SCANNER', 'google_result', { payloadLength: data.length });
      void processCode(data, 'google');
    });
    return () => {
      diagnostic('SCANNER', 'selector_unmounted');
      subscription.remove();
      setTrustedScannerActive(false);
      void lockPortrait();
    };
  }, [processCode]);

  useEffect(() => {
    if (mode !== 'integrated') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      void returnToChoice();
      return true;
    });
    return () => subscription.remove();
  }, [mode, returnToChoice]);

  const startIntegrated = async () => {
    diagnostic('SCANNER', 'integrated_requested', { permission: permission?.granted ?? false });
    let granted = permission?.granted ?? false;
    if (!granted) granted = (await requestPermission()).granted;
    if (!granted) {
      diagnostic('SCANNER', 'integrated_permission_denied');
      Alert.alert('Permiso de cámara', 'Debe permitir el uso de la cámara para abrir el lector integrado.');
      return;
    }
    await lockLandscape();
    diagnostic('SCANNER', 'integrated_started');
    setMode('integrated');
  };

  const startGoogle = async () => {
    diagnostic('SCANNER', 'google_requested', { available: CameraView.isModernBarcodeScannerAvailable });
    if (!CameraView.isModernBarcodeScannerAvailable) {
      Alert.alert('Lector no disponible', 'Este teléfono no tiene disponible el lector nativo de Google. Use el lector integrado.');
      return;
    }
    setLaunchingGoogle(true);
    processing.current = false;
    setTrustedScannerActive(true);
    try {
      await lockLandscape();
      diagnostic('SCANNER', 'google_launch_started');
      await CameraView.launchScanner({ barcodeTypes: ['pdf417'] });
      diagnostic('SCANNER', 'google_launch_resolved');
    } catch (caught) {
      diagnostic('SCANNER', 'google_launch_failed', { error: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      await lockPortrait();
      setLaunchingGoogle(false);
      setTimeout(() => setTrustedScannerActive(false), 700);
      diagnostic('SCANNER', 'google_flow_finished');
    }
  };

  if (mode === 'integrated') {
    const scan = ({ data }: BarcodeScanningResult) => {
      diagnostic('SCANNER', 'integrated_result', { payloadLength: data.length });
      void processCode(data, 'integrated');
    };
    return <Modal visible animationType="fade" presentationStyle="fullScreen" hardwareAccelerated
      statusBarTranslucent navigationBarTranslucent supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={() => void returnToChoice()}>
      <StatusBar hidden/>
      <View style={styles.cameraScreen}>
        <CameraView style={StyleSheet.absoluteFill} facing="back" autofocus="off" zoom={0}
          barcodeScannerSettings={{ barcodeTypes: ['pdf417'] }} onBarcodeScanned={scan}
          onCameraReady={() => diagnostic('SCANNER', 'integrated_camera_ready')}
          onMountError={({ message }) => { diagnostic('SCANNER', 'integrated_camera_error', { error: message }); Alert.alert('No se pudo iniciar la cámara', message); }}/>
        <View style={styles.scanGuide} pointerEvents="none">
          <View style={styles.guideFrame}>
            <GuideCorner position="tl"/><GuideCorner position="tr"/><GuideCorner position="bl"/><GuideCorner position="br"/>
            <View style={styles.guideCenterLine}/>
          </View>
          <View style={styles.guideLabel}>
            <Ionicons name="barcode-outline" size={21} color={colors.mint}/>
            <Text style={styles.guideText}>Coloque la camara en posición horizontal</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver a lectores"
          style={[styles.backButton, { top: Math.max(14, insets.top + 8), left: Math.max(14, insets.left + 8) }]}
          onPress={() => void returnToChoice()}>
          <Ionicons name="arrow-back" size={25} color="white"/>
        </Pressable>
      </View>
    </Modal>;
  }

  return <View style={styles.choiceScreen}>
    <Text style={styles.eyebrow}>ESCANEAR COMPROBANTE</Text>
    <Text style={styles.heading}>Seleccione un lector</Text>
    <Text style={styles.description}>Ambos lectores se abrirán automáticamente en orientación horizontal.</Text>
    <View style={styles.options}>
      <Pressable disabled={launchingGoogle} style={({ pressed }) => [styles.option, pressed && styles.optionPressed]} onPress={() => void startGoogle()}>
        <View style={[styles.optionIcon, styles.googleIcon]}><Ionicons name="scan-outline" size={42} color="white"/></View>
        <Text style={styles.optionTitle}>{launchingGoogle ? 'Abriendo…' : 'Lector de Google'}</Text>
        <Text style={styles.optionCopy}>Lector nativo optimizado del dispositivo</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.option, pressed && styles.optionPressed]} onPress={() => void startIntegrated()}>
        <View style={[styles.optionIcon, styles.integratedIcon]}><Ionicons name="camera-outline" size={42} color="white"/></View>
        <Text style={styles.optionTitle}>Lector integrado</Text>
        <Text style={styles.optionCopy}>Escaneo continuo dentro de la aplicación</Text>
      </Pressable>
    </View>
  </View>;
}

function GuideCorner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  return <View style={[
    styles.guideCorner,
    position.includes('t') ? styles.guideTop : styles.guideBottom,
    position.includes('l') ? styles.guideLeft : styles.guideRight
  ]}/>;
}

const styles = StyleSheet.create({
  choiceScreen: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  eyebrow: { color: colors.green, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  heading: { marginTop: 7, color: colors.text, fontSize: 27, fontWeight: '800', textAlign: 'center' },
  description: { marginTop: 7, maxWidth: 360, color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  options: { width: '100%', maxWidth: 520, marginTop: 28, flexDirection: 'row', gap: 15 },
  option: { flex: 1, aspectRatio: 0.9, minHeight: 190, padding: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 22, backgroundColor: 'white', shadowColor: '#173b4e', shadowOpacity: 0.11, shadowRadius: 15, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  optionPressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  optionIcon: { width: 74, height: 74, marginBottom: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  googleIcon: { backgroundColor: colors.green }, integratedIcon: { backgroundColor: '#17677b' },
  optionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  optionCopy: { marginTop: 7, color: colors.muted, fontSize: 10, lineHeight: 14, textAlign: 'center' },
  cameraScreen: { flex: 1, backgroundColor: '#07151d' },
  scanGuide: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  guideFrame: { width: '78%', maxWidth: 920, aspectRatio: 3.5, position: 'relative', borderRadius: 18, backgroundColor: '#07151d12' },
  guideCorner: { width: 54, height: 54, position: 'absolute', borderColor: colors.mint },
  guideTop: { top: 0, borderTopWidth: 5 }, guideBottom: { bottom: 0, borderBottomWidth: 5 },
  guideLeft: { left: 0, borderLeftWidth: 5 }, guideRight: { right: 0, borderRightWidth: 5 },
  guideCenterLine: { position: 'absolute', left: 32, right: 32, top: '50%', height: 2, borderRadius: 2, backgroundColor: '#65dfbd80' },
  guideLabel: { marginTop: 20, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 99, backgroundColor: '#0d293dde' },
  guideText: { color: 'white', fontSize: 12, fontWeight: '700' },
  backButton: { position: 'absolute', width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#0d293ddd' }
});
