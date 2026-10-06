import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { receiptSecuritySettings } from '../infrastructure/settings';
import { errorMessage } from '../application/formatters';
import { Message, Panel } from './components';
import { colors } from './theme';

export function ReceiptSecuritySettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void receiptSecuritySettings.load().then(value => { if (active) setEnabled(value); })
      .catch(caught => { if (active) setError(errorMessage(caught)); });
    return () => { active = false; };
  }, []);
  const save = async (value: boolean) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await receiptSecuritySettings.save(value); setEnabled(value); }
    catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  };
  return <Panel style={styles.panel}>
    <View style={styles.row}>
      <View style={styles.copy}><Text style={styles.title}>Reconocimiento facial para comprobantes</Text>
        <Text style={styles.detail}>{busy ? 'Guardando…' : enabled === null ? 'Configuración no disponible.' : enabled ? 'Activado: carnet y validación del rostro.' : 'Desactivado: acceso únicamente con el escáner de carnet.'}</Text>
        <Text style={styles.detail}>Esta configuración se guarda en este dispositivo.</Text>
      </View>
      <Switch accessibilityLabel="Reconocimiento facial para comprobantes" value={enabled === true} disabled={busy || (enabled === null && !error)} onValueChange={value => void save(value)} />
    </View>
    {error && <Message text={error} />}
  </Panel>;
}

const styles = StyleSheet.create({
  panel: { marginHorizontal: 16, marginTop: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1 }, title: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  detail: { color: colors.muted, marginTop: 4 }
});
