import { AppUpdates } from './src/presentation/AppUpdates';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { AdminRole, AppStatus } from './src/domain/contracts';
import { kioskApi } from './src/infrastructure/api';
import { AttendanceScreen } from './src/presentation/AttendanceScreen';
import { PaymentModal } from './src/presentation/PaymentModal';
import { PhotoModal } from './src/presentation/PhotoModal';
import { ReportsScreen } from './src/presentation/ReportsScreen';
import { SettingsScreen } from './src/presentation/SettingsScreen';
import { LogsScreen } from './src/presentation/LogsScreen';
import { HardwareDiagnosticsScreen } from './src/presentation/HardwareDiagnosticsScreen';
import { AdminAuthModal } from './src/presentation/AdminAuthModal';
import { KioskHardware } from './src/hardware/KioskHardware';
import { initializeSecureDatabase, logEvent } from './src/infrastructure/secureDatabase';
import { colors } from './src/presentation/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 450, fade: true });

type Screen = 'attendance' | 'reports' | 'settings' | 'logs' | 'hardware';
const fallback: AppStatus = { ready: false, message: 'Configure la conexión con Kiosko API.', kiosk: { timezone: 'America/Guatemala', autoRegisterDelayMs: 250, confirmationDurationMs: 1500, faceMatchThreshold: .52, faceRequiredMatches: 3, receiptPrinterName: 'EPSON TM-U220II Receipt', emailEnabled: false } };

export default function App() {
  const [screen, setScreen] = useState<Screen>('attendance');
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [payments, setPayments] = useState(false), [photos, setPhotos] = useState(false);
  const [authRole, setAuthRole] = useState<AdminRole | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => { void SplashScreen.hideAsync(); }, 900);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => { void initializeSecureDatabase().then(() => logEvent('app.started')).then(async () => { try { await KioskHardware.initialize(); } catch (error) { await logEvent('[HARDWARE] initialization failed', error instanceof Error ? error.message : String(error), 'error'); } return kioskApi.app.status(); }).then(value => { setStatus(value); if (!value.ready) setScreen('settings'); }).catch(() => { setStatus(fallback); setScreen('settings'); }); return () => { void KioskHardware.shutdown(); }; }, []);
  const idle = !payments && !photos;
  return <SafeAreaProvider><SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}><StatusBar style="dark" hidden /><AppUpdates>{!status ? <View style={styles.loading}><Image source={require('./assets/brand-symbol.png')} style={styles.loadingLogo}/><Text style={styles.loadingTitle}>Kiosko Electrónico</Text><Text style={styles.loadingSubtitle}>Carnes San Martín</Text><ActivityIndicator style={styles.loadingIndicator} size="large" color={colors.brand} /></View> : screen === 'settings' ? <SettingsScreen onBack={() => setScreen('attendance')} onHardware={() => setScreen('hardware')} onLogs={() => setScreen('logs')} onDone={value => { setStatus(value); setScreen('attendance'); }} /> : screen === 'hardware' ? <HardwareDiagnosticsScreen onBack={() => setScreen('settings')}/> : screen === 'reports' ? <ReportsScreen onBack={() => { setPhotos(false); kioskApi.auth.clear(); setScreen('attendance'); }} onPhotos={() => setPhotos(true)} /> : screen === 'logs' ? <LogsScreen onBack={() => setScreen('settings')}/> : <AttendanceScreen active={idle} status={status} onReports={() => setAuthRole('RRHH')} onSettings={() => setAuthRole('TI_ADMIN')} onPayments={() => setPayments(true)} />}<PaymentModal visible={payments} status={status ?? fallback} onClose={() => setPayments(false)} /><PhotoModal visible={screen === 'reports' && photos} onClose={() => setPhotos(false)} /><AdminAuthModal role={authRole} onCancel={() => setAuthRole(null)} onAuthorized={role => { setAuthRole(null); setScreen(role === 'RRHH' ? 'reports' : 'settings'); }}/></AppUpdates></SafeAreaView></SafeAreaProvider>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  loadingLogo: { width: 210, height: 210, resizeMode: 'contain' },
  loadingTitle: { marginTop: 24, color: colors.navy, fontSize: 36, fontWeight: '900' },
  loadingSubtitle: { marginTop: 8, color: colors.muted, fontSize: 20 },
  loadingIndicator: { marginTop: 30 },
});
