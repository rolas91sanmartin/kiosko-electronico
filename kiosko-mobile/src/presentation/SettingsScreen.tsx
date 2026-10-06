import { UpdatePanel } from './AppUpdates';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { AppStatus } from '../domain/contracts';
import { errorMessage } from '../application/formatters';
import { kioskApi } from '../infrastructure/api';
import { loadSettings, saveSettings } from '../infrastructure/settings';
import { ActionButton, Field, Message, Panel } from './components';
import { colors } from './theme';

export function SettingsScreen({ onDone, onHardware, onLogs, onBack }: { onDone(status: AppStatus): void; onHardware(): void; onLogs(): void; onBack(): void }) {
  const [apiUrl, setApiUrl] = useState(''), [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null);
  useEffect(() => { void loadSettings().then(settings => { setApiUrl(settings.apiUrl); setApiKey(settings.apiKey); }); }, []);
  const connect = async () => { setBusy(true); setMessage(null); try { await saveSettings(apiUrl, apiKey); await kioskApi.health(); const status = await kioskApi.app.status(); if (!status.ready) setMessage(status.message || 'La API respondió, pero SQL Server no está configurado.'); else onDone(status); } catch (caught) { setMessage(errorMessage(caught)); } finally { setBusy(false); } };
  return <ScrollView contentContainerStyle={styles.page}><Panel style={styles.card}><ActionButton style={styles.back} icon="arrow-back" label="Atrás" secondary onPress={onBack}/><Text style={styles.title}>Conexión con Kiosko API</Text><Text style={styles.copy}>Agrega los campos requeridos</Text><Text style={styles.label}>URL de la API</Text><Field value={apiUrl} onChangeText={setApiUrl} placeholder="http://192.168.1.100:3000/api" /><Text style={styles.label}>Clave de API</Text><Field value={apiKey} onChangeText={setApiKey} placeholder="ApiKey" secureTextEntry />{message && <Message text={message} tone="warning" />}<ActionButton icon="wifi" label={busy ? 'Comprobando…' : 'Guardar y probar conexión'} disabled={busy || !apiUrl.trim()} onPress={() => void connect()} /><ActionButton icon="hardware-chip" label="Diagnóstico de hardware" secondary onPress={onHardware}/><ActionButton icon="reader-outline" label="Diagnóstico y logs" secondary onPress={onLogs}/><UpdatePanel /></Panel></ScrollView>;
}
const styles = StyleSheet.create({ page: { flexGrow: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }, card: { width: '100%', maxWidth: 600, gap: 12 }, back: { alignSelf: 'flex-start' }, title: { fontSize: 25, fontWeight: '900', color: colors.ink }, copy: { color: colors.muted, lineHeight: 20 }, label: { fontSize: 12, fontWeight: '700', color: colors.navy } });
