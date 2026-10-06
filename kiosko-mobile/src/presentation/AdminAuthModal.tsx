import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { AdminRole } from '../domain/contracts';
import { errorMessage } from '../application/formatters';
import { kioskApi } from '../infrastructure/api';
import { ActionButton, Field, Message, Panel } from './components';
import { colors } from './theme';

export function AdminAuthModal({ role, onCancel, onAuthorized }: { role: AdminRole | null; onCancel(): void; onAuthorized(role: AdminRole): void }) {
  const { width } = useWindowDimensions();
  const kiosk = width >= 700;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setUsername(''); setPassword(''); setError(null); setBusy(false); }, [role]);
  const login = async () => {
    if (!role || !username.trim() || !password || busy) return;
    setBusy(true); setError(null);
    try { await kioskApi.auth.login(username.trim(), password, role); onAuthorized(role); }
    catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  };
  const label = role === 'RRHH' ? 'RRHH' : 'TI Admin';
  return <Modal visible={Boolean(role)} transparent animationType="fade" onRequestClose={onCancel}><View style={styles.backdrop}><Panel style={[styles.card, kiosk && styles.cardKiosk]}><View style={styles.header}><View style={styles.icon}><Ionicons name={role === 'RRHH' ? 'bar-chart' : 'settings'} size={kiosk ? 42 : 30} color={colors.brand} /></View><View style={styles.headerText}><Text style={[styles.title, kiosk && styles.titleKiosk]}>Acceso {label}</Text><Text style={[styles.copy, kiosk && styles.copyKiosk]}>Ingrese las credenciales autorizadas.</Text></View><Pressable hitSlop={12} onPress={onCancel}><Ionicons name="close" size={kiosk ? 40 : 30} color={colors.ink}/></Pressable></View><Text style={styles.label}>Usuario</Text><Field value={username} onChangeText={setUsername} placeholder={`Usuario ${label}`} autoFocus /><Text style={styles.label}>Contraseña</Text><Field value={password} onChangeText={setPassword} placeholder="Contraseña" secureTextEntry onSubmitEditing={() => void login()} />{error && <Message text={error}/>}<View style={styles.actions}><ActionButton style={styles.action} icon="close" label="Cancelar" secondary onPress={onCancel}/><ActionButton style={styles.action} icon="lock-open" label={busy ? 'Validando…' : 'Ingresar'} disabled={busy || !username.trim() || !password} onPress={() => void login()}/></View></Panel></View></Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, padding: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#102633B8' },
  card: { width: '100%', maxWidth: 520, gap: 13 }, cardKiosk: { maxWidth: 720, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 }, headerText: { flex: 1 }, icon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 23, fontWeight: '900', color: colors.ink }, titleKiosk: { fontSize: 33 }, copy: { color: colors.muted }, copyKiosk: { fontSize: 18, marginTop: 4 }, label: { color: colors.navy, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10 }, action: { flex: 1 }
});
