import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthGate } from './src/presentation/AuthGate';
import { EnvelopeListScreen } from './src/presentation/EnvelopeListScreen';
import { ScannerScreen } from './src/presentation/ScannerScreen';
import { initializeDatabase } from './src/infrastructure/envelopeRepository';
import { colors } from './src/presentation/theme';

type Tab = 'envelopes' | 'scanner';

function Application() {
  const [tab, setTab] = useState<Tab>('envelopes');
  const [revision, setRevision] = useState(0);
  const insets = useSafeAreaInsets();
  const handleSaved = useCallback(() => { setRevision((value) => value + 1); setTab('envelopes'); }, []);
  useEffect(() => { void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); }, []);
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <StatusBar barStyle="light-content" backgroundColor={colors.navy}/>
    <View style={styles.header}>
      <View style={styles.logo}><Image source={require('./assets/brand-symbol.png')} style={styles.logoImage} accessibilityLabel="Carnes San Martín"/></View>
      <View><Text style={styles.title}>Mis comprobantes</Text><Text style={styles.subtitle}>Sobres de pago sin conexión</Text></View>
    </View>
    <View style={styles.content}>
      {tab === 'envelopes'
        ? <EnvelopeListScreen revision={revision}/>
        : <ScannerScreen onSaved={handleSaved}/>} 
    </View>
    <View style={[styles.tabs, { height: 70 + insets.bottom, paddingBottom: insets.bottom }]}>
      <TabButton active={tab === 'envelopes'} icon="documents-outline" label="Sobres" onPress={() => setTab('envelopes')}/>
      <TabButton active={tab === 'scanner'} icon="scan-outline" label="Escanear" onPress={() => setTab('scanner')}/>
    </View>
  </SafeAreaView>;
}

function TabButton({ active, icon, label, onPress }: { active: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; onPress(): void }) {
  return <Pressable accessibilityRole="button" style={styles.tab} onPress={onPress}>
    <Ionicons name={icon} size={24} color={active ? colors.green : colors.muted}/>
    <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
  </Pressable>;
}

export default function App() {
  return <SafeAreaProvider>
    <SQLiteProvider databaseName="payroll-envelopes.db" onInit={initializeDatabase}>
      <AuthGate><Application/></AuthGate>
    </SQLiteProvider>
  </SafeAreaProvider>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  header: { height: 78, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.navy },
  logo: { width: 46, height: 46, padding: 5, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' },
  logoImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  title: { color: 'white', fontSize: 22, fontWeight: '800' },
  subtitle: { marginTop: 2, color: '#b8cbd5', fontSize: 12 },
  content: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: 'white' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  tabLabelActive: { color: colors.green }
});
