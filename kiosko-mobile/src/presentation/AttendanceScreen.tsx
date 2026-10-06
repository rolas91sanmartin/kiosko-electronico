import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { AppStatus, AttendanceLookup, MovementKind } from '../domain/contracts';
import { errorMessage } from '../application/formatters';
import { kioskApi } from '../infrastructure/api';
import { ActionButton, Field, Message, Panel } from './components';
import { colors } from './theme';
import { KioskHardware } from '../hardware/KioskHardware';

export function AttendanceScreen({ active, status, onReports, onSettings, onPayments }: { active: boolean; status: AppStatus; onReports(): void; onSettings(): void; onPayments(): void }) {
  const { width, height } = useWindowDimensions();
  const portrait = height > width;
  const kioskPortrait = portrait && width >= 700;
  const compactPortrait = portrait && !kioskPortrait;
  const [barcode, setBarcode] = useState('');
  const [lookup, setLookup] = useState<AttendanceLookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(status.ready ? null : status.message || 'API sin configurar');
  const [confirmation, setConfirmation] = useState<MovementKind | null>(null);
  const [adminMenu, setAdminMenu] = useState(false);
  const [clock, setClock] = useState(new Date());
  const running = useRef(false);
  const welcome = useAudioPlayer(require('../../assets/audio/Bienvenido.wav'));
  const goodbye = useAudioPlayer(require('../../assets/audio/Adios.wav'));

  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 500); return () => clearInterval(timer); }, []);
  const reset = () => { running.current = false; setBarcode(''); setLookup(null); setBusy(false); setConfirmation(null); };
  const process = async (value = barcode) => {
    if (!value.trim() || running.current || !status.ready) return;
    running.current = true; setBusy(true); setMessage(null);
    try {
      const result = await kioskApi.attendance.lookup(value);
      setLookup(result);
      await new Promise(resolve => setTimeout(resolve, status.kiosk.autoRegisterDelayMs));
      await kioskApi.attendance.register(result.employee.code, result.nextMovement);
      setBusy(false); setConfirmation(result.nextMovementLabel);
      const player = result.nextMovement === 1 ? welcome : goodbye;
      void player.seekTo(0).then(() => player.play());
      setTimeout(reset, status.kiosk.confirmationDurationMs);
    } catch (error) { setMessage(errorMessage(error)); reset(); }
  };
  useEffect(() => { if (!active) return; return KioskHardware.scanner.subscribe(result => { setBarcode(result.value); void process(result.value); }); }, [active, status.ready]);
  // The attendance clock must reflect Android's configured time and timezone.
  const time = new Intl.DateTimeFormat('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(clock);
  const date = new Intl.DateTimeFormat('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(clock);
  const year = clock.getFullYear();

  return <View style={styles.page}>
    <View style={[styles.header, portrait && styles.headerPortrait, kioskPortrait && styles.headerKiosk]}><Image source={require('../../assets/brand-symbol.png')} style={[styles.logo, kioskPortrait && styles.logoKiosk]} /><View style={{ flex: 1 }}><Text style={[styles.title, compactPortrait && styles.titlePortrait, kioskPortrait && styles.titleKiosk]}>Kiosko Electrónico</Text><Text style={[styles.muted, kioskPortrait && styles.mutedKiosk]}>Registro de entrada y salida</Text></View>{!portrait && <View style={styles.clock}><Text style={styles.time}>{time}</Text><Text style={styles.muted}>{date}</Text></View>}<Pressable accessibilityLabel="Abrir menú administrativo" hitSlop={12} style={[styles.menuTrigger, kioskPortrait && styles.menuTriggerKiosk]} onPress={() => setAdminMenu(true)}><Ionicons name="menu" size={kioskPortrait ? 40 : 29} color={colors.brand} /></Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.body, portrait && styles.bodyPortrait, kioskPortrait && styles.bodyKiosk]}>
      {portrait && <View style={[styles.mobileClock, kioskPortrait && styles.mobileClockKiosk]}><Text style={[styles.time, kioskPortrait && styles.timeKiosk]}>{time}</Text><Text style={[styles.muted, kioskPortrait && styles.mutedKiosk]}>{date}</Text></View>}
      <Panel style={[styles.photoPanel, portrait && styles.photoPanelPortrait, kioskPortrait && styles.photoPanelKiosk]}>{lookup?.employee.photoDataUrl ? <Image source={{ uri: lookup.employee.photoDataUrl }} style={styles.photo} /> : <View style={styles.placeholder}><Ionicons name="person" size={kioskPortrait ? 104 : portrait ? 62 : 88} color="#9baab3" /><Text style={[styles.muted, kioskPortrait && styles.mutedKiosk]}>{lookup ? 'Fotografía no disponible' : 'Esperando empleado'}</Text></View>}</Panel>
      <View style={[styles.content, kioskPortrait && styles.contentKiosk]}><Text style={[styles.ready, kioskPortrait && styles.readyKiosk]}>{busy ? 'Procesando marcación…' : '● Lector listo'}</Text><Panel><Text style={[styles.eyebrow, kioskPortrait && styles.eyebrowKiosk]}>EMPLEADO</Text><Text style={[styles.employee, kioskPortrait && styles.employeeKiosk]}>{lookup?.employee.name || 'Escanee o escriba el código del carnet'}</Text><Text style={[styles.muted, kioskPortrait && styles.mutedKiosk]}>{lookup ? `Código ${lookup.employee.code}` : 'El registro se realizará automáticamente'}</Text></Panel><View style={[styles.movement, kioskPortrait && styles.movementKiosk, { backgroundColor: lookup?.nextMovement === 2 ? '#fff0ea' : '#e4f6ee' }]}><Ionicons name={lookup ? 'checkmark-circle' : 'scan'} size={kioskPortrait ? 58 : 42} color={lookup?.nextMovement === 2 ? colors.orange : colors.green} /><View><Text style={[styles.muted, kioskPortrait && styles.mutedKiosk]}>{lookup ? 'Movimiento detectado' : 'Listo para escanear'}</Text><Text style={[styles.movementText, kioskPortrait && styles.movementTextKiosk]}>{lookup?.nextMovementLabel || 'Entrada / Salida'}</Text></View></View>
        <View style={[styles.inputRow, compactPortrait && styles.wrap]}><View style={styles.input}><Field value={barcode} onChangeText={setBarcode} placeholder="Código de barras" onSubmitEditing={() => void process()} autoFocus={!kioskPortrait} /></View><ActionButton icon="checkmark" label="Registrar" onPress={() => void process()} disabled={busy} /></View>
        {message && <Message text={message} tone={status.ready ? 'error' : 'warning'} />}
        <View style={[styles.actions, compactPortrait && styles.actionsPortrait]}><ActionButton style={styles.action} icon="receipt" label="Comprobante" onPress={onPayments} /></View>
      </View>
    </ScrollView>
    <Text style={[styles.footer, kioskPortrait && styles.footerKiosk]}>© {year} Carnes San Martín. Todos los derechos reservados · Desarrollado por TI</Text>
    <Modal visible={Boolean(confirmation)} transparent animationType="fade"><View style={styles.confirmBackdrop}><View style={styles.confirm}><Ionicons name="checkmark-circle" size={78} color={colors.green} /><Text style={styles.confirmTitle}>{confirmation === 'Entrada' ? '¡Bienvenido!' : '¡Adiós, buen viaje!'}</Text><Text>{confirmation} registrada correctamente</Text></View></View></Modal>
    <Modal visible={adminMenu} transparent animationType="fade" onRequestClose={() => setAdminMenu(false)}><View style={styles.menuOverlay}><Pressable style={StyleSheet.absoluteFill} onPress={() => setAdminMenu(false)}/><View style={[styles.adminMenu, kioskPortrait && styles.adminMenuKiosk]}><Text style={[styles.menuTitle, kioskPortrait && styles.menuTitleKiosk]}>Acceso administrativo</Text><Pressable style={styles.menuItem} onPress={() => { setAdminMenu(false); onReports(); }}><View style={styles.menuIcon}><Ionicons name="bar-chart" size={kioskPortrait ? 31 : 23} color={colors.brand}/></View><View style={styles.menuCopy}><Text style={[styles.menuLabel, kioskPortrait && styles.menuLabelKiosk]}>Seguridad de RRHH</Text><Text style={[styles.muted, kioskPortrait && styles.mutedKiosk]}>Acceso exclusivo para RRHH</Text></View><Ionicons name="chevron-forward" size={24} color={colors.muted}/></Pressable><Pressable style={styles.menuItem} onPress={() => { setAdminMenu(false); onSettings(); }}><View style={styles.menuIcon}><Ionicons name="settings" size={kioskPortrait ? 31 : 23} color={colors.brand}/></View><View style={styles.menuCopy}><Text style={[styles.menuLabel, kioskPortrait && styles.menuLabelKiosk]}>Configuración</Text><Text style={[styles.muted, kioskPortrait && styles.mutedKiosk]}>Acceso exclusivo para TI Admin</Text></View><Ionicons name="chevron-forward" size={24} color={colors.muted}/></Pressable></View></View></Modal>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg }, header: { height: 82, backgroundColor: '#fff', paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 15, borderBottomWidth: 1, borderColor: colors.line },
  logo: { width: 54, height: 54, resizeMode: 'contain' }, title: { fontSize: 23, fontWeight: '800', color: colors.ink }, muted: { color: colors.muted, fontSize: 12 }, clock: { alignItems: 'flex-end', marginRight: 18 }, time: { fontSize: 24, fontWeight: '800', color: colors.navy },
  body: { flexGrow: 1, flexDirection: 'row', padding: 22, gap: 22 }, bodyPortrait: { flexDirection: 'column', padding: 14, gap: 12 }, photoPanel: { width: '34%', minHeight: 300, padding: 0, overflow: 'hidden' }, photoPanelPortrait: { width: '100%', height: 230, minHeight: 230 }, photo: { width: '100%', height: '100%', resizeMode: 'cover' }, placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.soft },
  content: { flex: 1, gap: 12 }, ready: { color: colors.green, fontWeight: '700' }, eyebrow: { fontSize: 11, fontWeight: '800', color: colors.blue }, employee: { fontSize: 24, fontWeight: '800', color: colors.ink, marginVertical: 8 },
  movement: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 13, borderRadius: 14 }, movementText: { fontSize: 21, fontWeight: '800', color: colors.ink }, inputRow: { flexDirection: 'row', gap: 9 }, input: { flex: 1, minWidth: 190 }, wrap: { flexWrap: 'wrap' }, actions: { flexDirection: 'row', gap: 10 }, actionsPortrait: { flexDirection: 'column' }, footer: { height: 30, textAlign: 'center', color: colors.muted },
  headerPortrait: { height: 70, paddingHorizontal: 14, gap: 10 }, titlePortrait: { fontSize: 19 }, mobileClock: { alignItems: 'center' },
  headerKiosk: { height: 116, paddingHorizontal: 30, gap: 22 }, logoKiosk: { width: 78, height: 78 }, titleKiosk: { fontSize: 34 }, mutedKiosk: { fontSize: 18 },
  bodyKiosk: { padding: 28, gap: 20 }, mobileClockKiosk: { gap: 5, paddingVertical: 8 }, timeKiosk: { fontSize: 43 }, photoPanelKiosk: { height: 380, minHeight: 380 },
  contentKiosk: { gap: 18 }, readyKiosk: { fontSize: 19 }, eyebrowKiosk: { fontSize: 16 }, employeeKiosk: { fontSize: 32, marginVertical: 12 },
  movementKiosk: { padding: 22, borderRadius: 20, gap: 20 }, movementTextKiosk: { fontSize: 28 }, action: { flex: 1 }, footerKiosk: { height: 46, fontSize: 17, textAlignVertical: 'center' },
  menuTrigger: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: '#F3A7B1' }, menuTriggerKiosk: { width: 66, height: 66, borderRadius: 19 },
  menuOverlay: { flex: 1, backgroundColor: '#10263355' }, adminMenu: { position: 'absolute', top: 74, right: 14, width: 330, padding: 14, gap: 8, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, elevation: 12, shadowColor: '#000', shadowOpacity: .18, shadowRadius: 16 }, adminMenuKiosk: { top: 120, right: 28, width: 480, padding: 20, gap: 12 },
  menuTitle: { color: colors.muted, fontSize: 12, fontWeight: '900', marginHorizontal: 8, marginBottom: 2, textTransform: 'uppercase' }, menuTitleKiosk: { fontSize: 16 }, menuItem: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: colors.brandSoft }, menuIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#fff' }, menuCopy: { flex: 1 }, menuLabel: { color: colors.ink, fontWeight: '900', fontSize: 16 }, menuLabelKiosk: { fontSize: 23 },
  confirmBackdrop: { flex: 1, backgroundColor: '#0009', alignItems: 'center', justifyContent: 'center', padding: 18 }, confirm: { width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 22, alignItems: 'center', padding: 32, gap: 8 }, confirmTitle: { fontSize: 30, fontWeight: '900', color: colors.ink }
});
