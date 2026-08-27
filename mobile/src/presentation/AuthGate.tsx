import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { isTrustedScannerActive } from '../application/trustedExternalFlow';
import { diagnostic } from '../infrastructure/diagnosticLogger';
import { colors } from './theme';

export function AuthGate({ children }: { children: ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState('Confirme su rostro para acceder a sus comprobantes.');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  const authenticate = useCallback(async () => {
    if (running.current) { diagnostic('AUTH', 'authenticate_skipped_running'); return; }
    diagnostic('AUTH', 'authenticate_started');
    running.current = true; setBusy(true);
    try {
      const [hardware, enrolled, methods] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync()
      ]);
      diagnostic('AUTH', 'capabilities_checked', { hardware, enrolled, facial: methods.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) });
      if (!hardware || !enrolled || !methods.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setMessage('Este dispositivo no tiene reconocimiento facial configurado. Registre su rostro en la seguridad del teléfono.');
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Acceder a mis comprobantes', cancelLabel: 'Cancelar',
        disableDeviceFallback: true, biometricsSecurityLevel: 'strong'
      });
      diagnostic('AUTH', 'authenticate_result', { success: result.success, error: result.success ? '' : result.error });
      if (result.success) setAuthorized(true);
      else setMessage('No se confirmó el rostro. Toque el botón para intentarlo nuevamente.');
    } catch (caught) {
      diagnostic('AUTH', 'authenticate_exception', { error: caught instanceof Error ? caught.message : String(caught) });
      setMessage('No fue posible iniciar la autenticación facial.');
    }
    finally { running.current = false; setBusy(false); }
  }, []);

  useEffect(() => {
    diagnostic('AUTH', 'gate_mounted');
    void authenticate();
    return () => diagnostic('AUTH', 'gate_unmounted');
  }, [authenticate]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const trustedScanner = isTrustedScannerActive();
      diagnostic('AUTH', 'app_state_changed', { state, authorized, trustedScanner });
      if ((state === 'background' || state === 'inactive') && !trustedScanner) {
        diagnostic('AUTH', 'authorization_revoked', { reason: state });
        setAuthorized(false);
      }
      if (state === 'active' && !authorized && !trustedScanner) void authenticate();
    });
    return () => subscription.remove();
  }, [authorized, authenticate]);

  if (authorized) return children;
  return <View style={styles.container}>
    <View style={styles.icon}><Image source={require('../../assets/brand-symbol.png')} style={styles.brandLogo} accessibilityLabel="Carnes San Martín"/></View>
    <Text style={styles.title}>Acceso protegido</Text><Text style={styles.message}>{message}</Text>
    <Pressable disabled={busy} style={styles.button} onPress={() => void authenticate()}>
      <Ionicons name="person-circle-outline" size={21} color="white"/><Text style={styles.buttonText}>{busy ? 'Verificando…' : 'Verificar rostro'}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy },
  icon: { width: 108, height: 108, padding: 12, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' },
  brandLogo: { width: '100%', height: '100%', resizeMode: 'contain' },
  title: { marginTop: 24, color: 'white', fontSize: 27, fontWeight: '800' },
  message: { marginTop: 10, maxWidth: 330, color: '#c7d6dd', textAlign: 'center', lineHeight: 21 },
  button: { marginTop: 28, paddingVertical: 14, paddingHorizontal: 22, flexDirection: 'row', gap: 8, borderRadius: 13, backgroundColor: colors.green },
  buttonText: { color: 'white', fontWeight: '800' }
});
