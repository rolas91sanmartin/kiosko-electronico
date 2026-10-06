import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../application/formatters';
import { KioskHardware } from '../hardware/KioskHardware';
import type { NfcTag } from '../hardware/nfc/NfcTypes';
import type { HardwareDiagnostics, UsbDeviceInfo } from '../hardware/usb/UsbDeviceTypes';
import { loadHardwareConfig, saveHardwareConfig } from '../infrastructure/settings';
import { logEvent } from '../infrastructure/secureDatabase';
import { ActionButton, Message, Panel } from './components';
import { colors } from './theme';

export function HardwareDiagnosticsScreen({ onBack }: { onBack(): void }) {
  const [diagnostics, setDiagnostics] = useState<HardwareDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState('Ninguno'), [lastTag, setLastTag] = useState<NfcTag | null>(null);
  const [cameraVisible, setCameraVisible] = useState(false), [cameraFacing, setCameraFacing] = useState<CameraType>('front');
  const [permission, requestPermission] = useCameraPermissions();
  const run = async (task: () => Promise<void>) => { setError(null); setNotice(null); try { await task(); } catch (caught) { setError(errorMessage(caught)); } };
  const refresh = () => run(async () => {
    const value = await KioskHardware.diagnostics(); setDiagnostics(value);
    await Promise.all(value.usbDevices.map(device => logEvent('[HARDWARE][USB] device detected', `VID=${device.vendorId} PID=${device.productId} class=${device.deviceClass}`)));
  });
  useEffect(() => { void refresh(); const scan = KioskHardware.scanner.subscribe(result => setLastScan(`${result.value} (${new Date(result.timestamp).toLocaleTimeString()})`)); const tag = KioskHardware.nfc.subscribe(setLastTag); return () => { scan(); tag(); void KioskHardware.nfc.stop(); }; }, []);

  const usePrinter = (device: UsbDeviceInfo) => run(async () => {
    const config = await loadHardwareConfig(); config.printer.vendorId = device.vendorId; config.printer.productId = device.productId;
    const saved = await saveHardwareConfig(config); KioskHardware.printer.configure(saved.printer); setNotice(`Impresora guardada: VID ${device.vendorId} / PID ${device.productId}`); await refresh();
  });
  const useSerialScanner = (serialPort: string) => run(async () => {
    const config = await loadHardwareConfig();
    config.scanner.mode = 'auto'; config.scanner.serialPort = serialPort;
    const saved = await saveHardwareConfig(config); KioskHardware.scanner.configure(saved.scanner);
    setLastScan('Esperando lectura…'); setNotice(`Escáner serial activo en ${serialPort}. Presente un código al lector.`);
  });
  const testPrinter = () => run(async () => { await KioskHardware.printer.printTest(); setNotice('Prueba enviada a la impresora USB.'); });
  const testCamera = () => run(async () => { const selected = await KioskHardware.camera.selectedCamera(); setCameraFacing(selected?.facing === 'front' ? 'front' : 'back'); if (!permission?.granted) await requestPermission(); setCameraVisible(true); });
  const testNfc = () => run(async () => { const available = await KioskHardware.nfc.start(); setNotice(available ? 'Acerque una tarjeta NFC.' : 'Android no expone un adaptador NFC estándar. Revise los dispositivos USB.'); });

  return <View style={styles.page}><View style={styles.header}><ActionButton icon="arrow-back" label="Volver" secondary onPress={onBack}/><View style={{ flex: 1 }}><Text style={styles.title}>Diagnóstico de hardware</Text><Text style={styles.muted}>SAT KT21LC · desarrollo y configuración</Text></View><ActionButton icon="refresh" label="Actualizar" onPress={() => void refresh()}/></View>
    <ScrollView contentContainerStyle={styles.content}>{error && <Message text={error}/>}{notice && <Message text={notice} tone="success"/>}
      <Section title="ANDROID">{diagnostics ? <Text>{diagnostics.android.manufacturer} {diagnostics.android.model}{'\n'}Android {diagnostics.android.version} · API {diagnostics.android.sdk}{'\n'}ABI: {diagnostics.android.abi}{'\n'}Incluidas: {diagnostics.android.supportedAbis.join(', ')}</Text> : <Text>Cargando…</Text>}</Section>
      <Section title={`USB DEVICES (${diagnostics?.usbDevices.length || 0})`}>{diagnostics?.usbDevices.map(device => <Panel key={device.deviceId} style={styles.device}><Text style={styles.deviceTitle}>{device.productName || device.deviceName}</Text><Text>VID {device.vendorId} ({hex(device.vendorId)}) · PID {device.productId} ({hex(device.productId)}) · Clase {device.deviceClass}</Text><Text>{device.manufacturerName || 'Fabricante no disponible'} · Permiso: {device.permission ? 'sí' : 'no'} · HID: {device.hid ? 'sí' : 'no'}</Text>{device.interfaces.map((item, interfaceIndex) => <Text key={`${device.deviceId}-${item.id}-${interfaceIndex}`} style={styles.detail}>Interfaz {item.id}: clase {item.interfaceClass}, subclase {item.interfaceSubclass}, protocolo {item.interfaceProtocol}{'\n'}Endpoints: {item.endpoints.map(endpoint => `${endpoint.address}/${endpoint.type}/${endpoint.direction}/${endpoint.maxPacketSize}`).join(', ') || 'ninguno'}</Text>)}{device.interfaces.some(item => item.interfaceClass === 7 || item.endpoints.some(endpoint => endpoint.type === 2 && endpoint.direction === 0)) && <ActionButton icon="save" label="Usar como impresora" secondary onPress={() => void usePrinter(device)}/>}</Panel>)}</Section>
      <Section title="SCANNER"><Text>HID USB detectados: {diagnostics?.usbDevices.filter(device => device.hid).length || 0}{`\n`}Puertos seriales: {diagnostics?.serialPorts.join(', ') || 'ninguno'}{`\n`}Última lectura: {lastScan}</Text><Text style={styles.hint}>El lector óptico SAT no aparece como teclado USB. Seleccione un puerto UART y presente un código; la lectura termina por ENTER/CR/LF o por pausa.</Text>{diagnostics?.serialPorts.map(port => <ActionButton key={port} icon="git-compare" label={`Usar y probar ${port}`} secondary onPress={() => void useSerialScanner(port)}/>)}<ActionButton icon="scan" label="Probar scanner HID" secondary onPress={() => { setLastScan('Esperando lectura…'); setNotice('Escanee ahora cualquier Code128, QR o PDF417 configurado en el lector físico.'); }}/></Section>
      <Section title="PRINTER"><Text>Impresora USB candidata: {diagnostics?.usbDevices.some(device => device.interfaces.some(item => item.interfaceClass === 7)) ? 'sí' : 'no'}</Text><Text style={styles.hint}>La prueba imprime texto ASCII y una franja negra. Si ambos salen blancos, revise el lado térmico del papel y el cierre del cabezal.</Text><ActionButton icon="print" label="Imprimir texto + franja negra" onPress={() => void testPrinter()}/></Section>
      <Section title="CAMERA"><Text>{diagnostics?.cameras.map(camera => `${camera.id}: ${camera.facing}${camera.external ? ' (externa)' : ''}`).join('\n') || 'No encontrada mediante Camera2'}</Text><ActionButton icon="camera" label="Probar cámara" onPress={() => void testCamera()}/></Section>
      <Section title="NFC"><Text>Android NFC: {diagnostics?.nfc.available ? 'disponible' : 'no disponible'} · {diagnostics?.nfc.enabled ? 'encendido' : 'apagado'}{`\n`}CCID USB candidato: {diagnostics?.usbDevices.some(device => device.interfaces.some(item => item.interfaceClass === 11)) ? 'sí' : 'no'}{`\n`}Última etiqueta: {lastTag ? `${lastTag.id} (${lastTag.technologies.join(', ')})` : 'ninguna'}</Text><ActionButton icon="wifi" label="Probar NFC" onPress={() => void testNfc()}/></Section>
    </ScrollView>
    <Modal visible={cameraVisible} onRequestClose={() => setCameraVisible(false)}><View style={styles.camera}>{permission?.granted && <CameraView style={[StyleSheet.absoluteFill, styles.cameraRotated]} facing={cameraFacing} mirror={false}/>}<View style={styles.cameraFrame}/><Pressable style={styles.cameraClose} onPress={() => setCameraVisible(false)}><Ionicons name="close" size={32} color="#fff"/><Text style={{color:'#fff'}}>Cerrar prueba</Text></Pressable></View></Modal>
  </View>;
}
function Section({ title, children }: { title: string; children: ReactNode }) { return <Panel style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</Panel>; }
function hex(value: number) { return `0x${value.toString(16).padStart(4, '0').toUpperCase()}`; }
const styles = StyleSheet.create({ page:{flex:1,backgroundColor:colors.bg},header:{minHeight:74,padding:12,flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#fff'},title:{fontSize:21,fontWeight:'900',color:colors.ink},muted:{color:colors.muted},content:{padding:14,gap:12},section:{gap:9},sectionTitle:{color:colors.green,fontSize:13,fontWeight:'900'},device:{padding:10,gap:6,backgroundColor:colors.soft},deviceTitle:{fontWeight:'900',color:colors.ink},detail:{fontSize:11,color:colors.muted},hint:{fontSize:11,color:colors.muted},camera:{flex:1,backgroundColor:'#000'},cameraRotated:{transform:[{rotate:'180deg'}]},cameraFrame:{position:'absolute',left:'15%',top:'15%',width:'70%',height:'70%',borderWidth:3,borderColor:colors.green,borderRadius:20},cameraClose:{position:'absolute',right:24,top:24,flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#0009',padding:12,borderRadius:12} });
