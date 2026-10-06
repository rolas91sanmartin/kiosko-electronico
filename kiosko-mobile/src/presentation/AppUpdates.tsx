import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Linking, NativeModules, Platform, ScrollView, Text, View } from 'react-native';
import { mergeUpdateStatus, type UpdateStatus } from '../application/updatePolicy';
import { ActionButton, Message, Panel } from './components';
import { colors } from './theme';

interface UpdateBridge { check(): Promise<UpdateStatus>; install(): Promise<void> }
const bridge: UpdateBridge | undefined = Platform.OS === 'android' ? NativeModules.PlayUpdate : undefined;
const initial: UpdateStatus = { required: false, available: false, downloaded: false, downloading: false };
function useUpdates() {
  const [status, setStatus] = useState(initial);
  const [checking, setChecking] = useState(Boolean(bridge));
  const [ready, setReady] = useState(!bridge);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const check = useCallback(async () => {
    if (!bridge || inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    try { const next = await bridge.check(); setStatus(previous => mergeUpdateStatus(previous, next)); }
    catch { setStatus(previous => ({ ...previous, error: 'No se pudo comprobar la actualización. Vuelva a intentar.' })); }
    finally { inFlight.current = false; setChecking(false); setReady(true); }
  }, []);
  useEffect(() => {
    void check();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void check(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void check(); }, status.required ? 3000 : 5 * 60 * 1000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [check, status.required]);
  const install = async () => {
    if (!bridge || busy) return;
    setBusy(true);
    let error: string | undefined;
    try { await bridge.install(); }
    catch (caught) { error = caught instanceof Error ? caught.message : 'No se pudo actualizar. Vuelva a intentar.'; }
    finally {
      await check();
      if (error) setStatus(previous => ({ ...previous, error }));
      setBusy(false);
    }
  };
  return { status, checking, ready, busy, check, install };
}
const UpdateContext = createContext<ReturnType<typeof useUpdates> | null>(null);

export function UpdatePanel() {
  const update = useContext(UpdateContext);
  if (!update) return null;
  const { status, checking, busy } = update;
  return <View style={{ gap: 12 }}>
    <Text style={{ fontSize: 23, fontWeight: '800', color: colors.ink }}>Actualizaciones</Text>
    {status.version && <Text>Versión instalada: {status.version} ({status.versionCode})</Text>}
    <Text>{!bridge ? 'Las actualizaciones de Google Play requieren la compilación Android con el módulo de actualización.' : status.required ? 'Debe actualizar la aplicación para continuar utilizando el kiosko.' : checking ? 'Consultando Google Play…' : status.error ? 'No se pudo verificar si hay una nueva versión.' : 'La aplicación está actualizada.'}</Text>
    {status.error && <Message text={status.error} tone="warning" />}
    {status.downloading && <Text>Descargando actualización… Espere a que termine para instalar y reiniciar.</Text>}
    {status.downloaded && <Message text="La actualización está lista. Instale y reinicie para continuar." tone="success" />}
    <ActionButton icon="download-outline" label={busy ? 'Actualizando…' : status.downloading ? 'Descargando…' : status.downloaded ? 'Instalar y reiniciar' : 'Descargar actualización'} disabled={!bridge || busy || status.downloading || (!status.required && !status.available)} onPress={() => void update.install()} />
    <ActionButton icon="refresh" label={checking ? 'Comprobando…' : 'Buscar actualizaciones'} secondary disabled={!bridge || checking || busy} onPress={() => void update.check()} />
    {status.required && <ActionButton icon="open-outline" label="Abrir Google Play" secondary onPress={() => { void Linking.openURL('https://play.google.com/store/apps/details?id=com.sanmartin.kiosko').catch(() => undefined); }} />}
  </View>;
}

export function AppUpdates({ children }: { children: ReactNode }) {
  const update = useUpdates();
  const [settings, setSettings] = useState(false);
  return <UpdateContext.Provider value={update}>{!update.ready ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}><ActivityIndicator color={colors.brand} /><Text>Buscando actualizaciones…</Text></View> : update.status.required ? <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}><Panel style={{ width: '100%', maxWidth: 600, gap: 20 }}><Text style={{ fontSize: 28, fontWeight: '900', color: colors.navy }}>{settings ? 'Configuración' : 'Actualización obligatoria'}</Text><UpdatePanel /><ActionButton icon={settings ? 'arrow-back' : 'settings-outline'} label={settings ? 'Volver' : 'Configuración'} secondary onPress={() => setSettings(value => !value)} /></Panel></ScrollView> : children}</UpdateContext.Provider>;
}
