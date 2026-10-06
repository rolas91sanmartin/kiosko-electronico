import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { Employee } from '../domain/contracts';
import { errorMessage } from '../application/formatters';
import { kioskApi } from '../infrastructure/api';
import { ActionButton, Field, Message, Panel } from './components';
import { colors } from './theme';
import { KioskHardware } from '../hardware/KioskHardware';
import { ExpoCameraProvider } from '../hardware/camera/ExpoCameraProvider';

type Step = 'barcode' | 'camera' | 'preview' | 'success';
export function PhotoModal({ visible, onClose }: { visible: boolean; onClose(): void }) {
  const { width, height } = useWindowDimensions();
  const portrait = height > width;
  const kiosk = width >= 700;
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraFacing, setCameraFacing] = useState<CameraType>('front');
  const [step, setStep] = useState<Step>('barcode');
  const [barcode, setBarcode] = useState('');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [token, setToken] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => { setStep('barcode'); setBarcode(''); setEmployee(null); setToken(''); setPreview(null); setError(null); onClose(); };
  const authenticate = async (value = barcode) => { if (!value.trim() || busy) return; setBusy(true); setError(null); try { const auth = await kioskApi.photos.authenticate(value); setEmployee(auth.employee); setToken(auth.token); setStep('camera'); if (!permission?.granted) await requestPermission(); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } };
  useEffect(() => { if (!visible || step !== 'barcode') return; return KioskHardware.scanner.subscribe(result => { setBarcode(result.value); void authenticate(result.value); }); }, [visible, step, busy]);
  useEffect(() => { if (!visible || step !== 'camera') return; return KioskHardware.camera.registerProvider(new ExpoCameraProvider(cameraRef)); }, [visible, step]);
  useEffect(() => { if (visible && step === 'camera') void KioskHardware.camera.selectedCamera().then(device => setCameraFacing(device?.facing === 'front' ? 'front' : 'back')).catch(() => setCameraFacing('front')); }, [visible, step]);
  const capture = async () => { if (!cameraRef.current || busy) return; setBusy(true); setError(null); try { const photo = await KioskHardware.camera.capture(); if (!photo.base64) throw new Error('La cámara no devolvió una imagen.'); setPreview(`data:image/jpeg;base64,${photo.base64}`); setStep('preview'); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } };
  const save = async () => { if (!preview || !token || busy) return; setBusy(true); setError(null); try { setEmployee(await kioskApi.photos.save(token, preview)); setStep('success'); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } };

  return <Modal visible={visible} animationType="slide" onRequestClose={close}><View style={styles.page}><View style={[styles.header, kiosk && styles.headerKiosk]}><Ionicons name="camera" size={kiosk ? 42 : 30} color={colors.navy} /><View style={{ flex: 1 }}><Text style={[styles.title, kiosk && styles.titleKiosk]}>Tomar o actualizar fotografía</Text><Text style={[styles.muted, kiosk && styles.mutedKiosk]}>Registro fotográfico del empleado</Text></View><Pressable hitSlop={12} onPress={close}><Ionicons name="close" size={kiosk ? 42 : 32} color={colors.ink} /></Pressable></View>
    {step === 'barcode' && <View style={styles.center}><Panel style={[styles.card, kiosk && styles.cardKiosk]}><Ionicons name="id-card" size={kiosk ? 86 : 58} color={colors.green} /><Text style={[styles.heading, kiosk && styles.headingKiosk]}>Escanee el carnet</Text><Text style={[styles.muted, kiosk && styles.mutedKiosk]}>Use el lector del dispositivo. La API verificará que el empleado exista en RRHH antes de abrir la cámara para tomar la fotografía.</Text><Field value={barcode} onChangeText={setBarcode} placeholder="Código de barras" onSubmitEditing={() => void authenticate()} autoFocus={!kiosk} /><View style={styles.row}><ActionButton icon="checkmark" label={busy ? 'Validando…' : 'Continuar'} disabled={busy} onPress={() => void authenticate()} /></View>{error && <Message text={error} />}</Panel></View>}
    {step === 'camera' && employee && <ScrollView contentContainerStyle={[styles.cameraLayout, portrait && styles.cameraLayoutPortrait]}><Panel style={[styles.employee, portrait && styles.employeePortrait]}><View style={styles.avatar}>{employee.photoDataUrl ? <Image source={{ uri: employee.photoDataUrl }} style={styles.avatarImage} /> : <Ionicons name="person" size={40} color={colors.muted} />}</View><Text style={styles.heading}>{employee.name}</Text><Text style={styles.muted}>Código {employee.code} · Nómina {employee.payrollCode}</Text></Panel><View style={[styles.cameraBox, portrait && styles.cameraBoxPortrait]}>{permission?.granted ? <CameraView ref={cameraRef} style={[StyleSheet.absoluteFill, styles.cameraRotated]} facing={cameraFacing} mirror={false} /> : <View style={styles.permission}><Text style={{ color: '#fff' }}>Se necesita permiso para usar la cámara.</Text><ActionButton icon="camera" label="Dar permiso" onPress={() => void requestPermission()} /></View>}<View style={styles.faceFrame} /></View><View style={styles.row}><ActionButton icon="chevron-back" label="Cancelar" secondary onPress={() => setStep('barcode')} /><ActionButton icon="camera" label={busy ? 'Capturando…' : 'Tomar foto'} disabled={busy || !permission?.granted} onPress={() => void capture()} /></View>{error && <Message text={error} />}</ScrollView>}
    {step === 'preview' && employee && preview && <ScrollView contentContainerStyle={[styles.previewLayout, portrait && styles.previewLayoutPortrait]}><Image source={{ uri: preview }} style={[styles.preview, portrait && styles.previewPortrait]} /><Panel style={styles.previewInfo}><Text style={styles.heading}>Confirme la fotografía</Text><Text style={styles.muted}>{employee.name}</Text><Text>Se guardará como {Number(employee.code)}.JPG y se actualizará el registro en RRHH.</Text>{error && <Message text={error} />}<View style={styles.row}><ActionButton icon="camera-reverse" label="Tomar otra" secondary onPress={() => { setPreview(null); setStep('camera'); }} /><ActionButton icon="save" label={busy ? 'Guardando…' : 'Guardar'} disabled={busy} onPress={() => void save()} /></View></Panel></ScrollView>}
    {step === 'success' && employee && <View style={styles.center}><Panel style={styles.card}><Ionicons name="checkmark-circle" size={76} color={colors.green} /><Text style={styles.heading}>Fotografía actualizada</Text>{employee.photoDataUrl && <Image source={{ uri: employee.photoDataUrl }} style={styles.saved} />}<Text style={styles.muted}>El archivo fue guardado por Kiosko API y vinculado en RRHH.</Text><ActionButton icon="checkmark" label="Finalizar" onPress={close} /></Panel></View>}
  </View></Modal>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg }, header: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: colors.line }, title: { fontSize: 22, fontWeight: '800', color: colors.ink }, muted: { color: colors.muted }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 }, card: { width: '100%', maxWidth: 530, alignItems: 'center', gap: 15 }, heading: { fontSize: 20, fontWeight: '800', color: colors.ink }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  headerKiosk: { minHeight: 112, gap: 20, paddingHorizontal: 30 }, titleKiosk: { fontSize: 32 }, mutedKiosk: { fontSize: 18, lineHeight: 25 }, cardKiosk: { maxWidth: 760, gap: 24 }, headingKiosk: { fontSize: 30 },
  cameraLayout: { flexGrow: 1, flexDirection: 'row', padding: 22, gap: 18, alignItems: 'center' }, cameraLayoutPortrait: { flexDirection: 'column', alignItems: 'stretch', padding: 14 }, employee: { width: 220, alignItems: 'center', gap: 8 }, employeePortrait: { width: '100%' }, avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.soft, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, avatarImage: { width: '100%', height: '100%' }, cameraBox: { flex: 1, alignSelf: 'stretch', minHeight: 300, borderRadius: 18, overflow: 'hidden', backgroundColor: '#07151d' }, cameraBoxPortrait: { height: 390, flex: 0 }, cameraRotated: { transform: [{ rotate: '180deg' }] }, permission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }, faceFrame: { position: 'absolute', left: '30%', top: '10%', width: '40%', height: '80%', borderWidth: 3, borderColor: '#6ee4b3', borderRadius: 100 },
  previewLayout: { flexGrow: 1, flexDirection: 'row', padding: 25, gap: 25, justifyContent: 'center' }, previewLayoutPortrait: { flexDirection: 'column', alignItems: 'center', padding: 14 }, preview: { flex: 1, aspectRatio: .75, borderRadius: 18 }, previewPortrait: { flex: 0, width: '75%', height: 390 }, previewInfo: { width: '100%', maxWidth: 410, justifyContent: 'center', gap: 18 }, saved: { width: 170, height: 220, borderRadius: 14 }
});
