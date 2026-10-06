import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DiagnosticLog } from '../domain/contracts';
import { kioskApi } from '../infrastructure/api';
import { listLocalLogs } from '../infrastructure/secureDatabase';
import { ActionButton, Message, Panel } from './components';
import { colors } from './theme';

export function LogsScreen({ onBack }: { onBack(): void }) {
  const [logs, setLogs] = useState<DiagnosticLog[]>([]), [error, setError] = useState<string | null>(null);
  const load = async () => { try { const [local, api] = await Promise.all([listLocalLogs(), kioskApi.logs.recent()]); setLogs([...local.map(item => ({ ...item, source: 'mobile' as const })), ...api.map(item => ({ ...item, source: 'api' as const }))].sort((a, b) => b.at.localeCompare(a.at))); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); } };
  useEffect(() => { void load(); }, []);
  return <View style={styles.page}><View style={styles.header}><ActionButton icon="arrow-back" label="Volver" secondary onPress={onBack}/><Text style={styles.title}>Diagnóstico y logs</Text><ActionButton icon="refresh" label="Actualizar" onPress={() => void load()}/></View>{error && <Message text={error}/>}<ScrollView contentContainerStyle={styles.content}>{logs.map((entry, index) => <Panel key={`${entry.at}-${index}`} style={styles.entry}><Text style={[styles.level, entry.level === 'error' && styles.error]}>{entry.source.toUpperCase()} · {entry.level.toUpperCase()}</Text><Text style={styles.event}>{entry.event}</Text><Text style={styles.detail}>{entry.detail || 'Sin detalle'}</Text><Text style={styles.date}>{new Date(entry.at).toLocaleString()}</Text></Panel>)}</ScrollView></View>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.bg }, header: { minHeight: 72, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff' }, title: { flex: 1, fontSize: 22, fontWeight: '900', color: colors.ink }, content: { padding: 14, gap: 8 }, entry: { padding: 12 }, level: { color: colors.green, fontWeight: '900', fontSize: 10 }, error: { color: colors.red }, event: { color: colors.ink, fontWeight: '800', marginTop: 3 }, detail: { color: colors.muted, marginTop: 3 }, date: { color: colors.muted, fontSize: 10, marginTop: 5 } });
