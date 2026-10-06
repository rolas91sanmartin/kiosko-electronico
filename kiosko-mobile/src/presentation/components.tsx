import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from './theme';

export function ActionButton({ icon, label, onPress, secondary, disabled, style }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress(): void; secondary?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const { width } = useWindowDimensions();
  const kiosk = width >= 700;
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, kiosk && styles.buttonKiosk, secondary && styles.secondary, style, (pressed || disabled) && styles.dim]}><Ionicons name={icon} size={kiosk ? 27 : 20} color={secondary ? colors.brandDark : '#fff'} /><Text style={[styles.buttonText, kiosk && styles.buttonTextKiosk, secondary && styles.secondaryText]}>{label}</Text></Pressable>;
}
export function Panel({ children, style }: { children: ReactNode; style?: object }) { const { width } = useWindowDimensions(); return <View style={[styles.panel, width >= 700 && styles.panelKiosk, style]}>{children}</View>; }
export function Field({ value, onChangeText, placeholder, secureTextEntry, onSubmitEditing, autoFocus, showSoftInputOnFocus = true }: { value: string; onChangeText(value: string): void; placeholder?: string; secureTextEntry?: boolean; onSubmitEditing?: () => void; autoFocus?: boolean; showSoftInputOnFocus?: boolean }) {
  const { width } = useWindowDimensions();
  return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#8797a1" secureTextEntry={secureTextEntry} onSubmitEditing={onSubmitEditing} autoFocus={autoFocus} showSoftInputOnFocus={showSoftInputOnFocus} style={[styles.field, width >= 700 && styles.fieldKiosk]} autoCapitalize="none" />;
}
export function Message({ text, tone = 'error' }: { text: string; tone?: 'error' | 'success' | 'warning' }) { return <View style={[styles.message, { backgroundColor: tone === 'success' ? '#e4f6ee' : tone === 'warning' ? '#fff4df' : '#fdeaea' }]}><Text style={{ color: tone === 'success' ? colors.green : tone === 'warning' ? '#8b5b12' : colors.red }}>{text}</Text></View>; }

const styles = StyleSheet.create({
  button: { minHeight: 46, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonKiosk: { minHeight: 64, paddingHorizontal: 28, borderRadius: 14, gap: 12 },
  secondary: { backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: '#F3A7B1' }, secondaryText: { color: colors.brandDark }, dim: { opacity: .55 }, buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  buttonTextKiosk: { fontSize: 19 },
  panel: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 18 },
  panelKiosk: { borderRadius: 22, padding: 26 },
  field: { minHeight: 48, borderWidth: 1, borderColor: '#c8d4db', borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 14, color: colors.ink, fontSize: 15 },
  fieldKiosk: { minHeight: 64, borderRadius: 14, paddingHorizontal: 20, fontSize: 20 },
  message: { padding: 12, borderRadius: 9, marginVertical: 8 }
});
