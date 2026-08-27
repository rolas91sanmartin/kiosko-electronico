import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StoredEnvelope } from '../domain/payroll';
import { colors } from './theme';

const money = new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function EnvelopeView({ stored, onBack }: { stored: StoredEnvelope; onBack(): void }) {
  const { envelope } = stored;
  const totalIncome = envelope.incomes.reduce((total, line) => total + line.amount, 0);
  const totalDeductions = envelope.deductions.reduce((total, line) => total + line.amount, 0);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Pressable style={styles.back} onPress={onBack}><Ionicons name="arrow-back" size={18} color={colors.text}/><Text style={styles.backText}>Volver a sobres</Text></Pressable>
    <View style={styles.paper}>
      <View style={styles.heading}>
        <Text style={styles.company}>INDUSTRIAL COMERCIAL SANMARTIN PLANILLA DEL {envelope.payroll.from} AL {envelope.payroll.to}</Text>
        <Text style={styles.receipt}>Sobre No  {envelope.payroll.receiptNumber}</Text>
      </View>
      <Text style={styles.employee}>EMPLEADO:  <Text style={styles.bold}>{envelope.employee.code} {envelope.employee.name}</Text> | INSS: {envelope.employee.socialSecurityNumber}</Text>
      <Text style={styles.job}>Cargo: {envelope.employee.role}  Área: {envelope.employee.area}</Text>
      <View style={styles.days}><Text style={styles.bold}>DÍAS LABORADOS</Text><Text>{money.format(envelope.employee.workedDays)}</Text></View>
      <Section title="INGRESOS" lines={envelope.incomes}/>
      <AmountRow label="TOTAL INGRESOS" value={totalIncome} bold/>
      <AmountRow label="SALDO DE DEUDA" value={envelope.debtBalance} bold/>
      <View style={styles.divider}/>
      <Section title="DEDUCCIONES" lines={envelope.deductions}/>
      <AmountRow label="TOTAL DEDUCCIONES" value={totalDeductions} bold/>
      <AmountRow label="INGRESO NETO" value={totalIncome - totalDeductions} bold/>
      <View style={styles.cut}><View style={styles.cutLine}/><Text style={styles.cutText}>CORTAR AQUÍ</Text></View>
    </View>
  </ScrollView>;
}

function Section({ title, lines }: { title: string; lines: Array<{ label: string; amount: number }> }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>
    {lines.map((line, index) => <AmountRow key={`${title}-${index}-${line.label}`} label={line.label} value={line.amount}/>) }
    {!lines.length && <Text style={styles.empty}>Sin conceptos</Text>}
  </View>;
}

function AmountRow({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return <View style={styles.row}><Text numberOfLines={2} style={[styles.rowLabel, bold && styles.bold]}>{label}</Text><Text style={[styles.value, bold && styles.bold]}>{money.format(value)}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 14, paddingBottom: 30 },
  back: { alignSelf: 'flex-start', marginBottom: 12, paddingVertical: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: 'white' },
  backText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  paper: { padding: 20, borderWidth: 1, borderColor: '#aeb4b8', backgroundColor: 'white', shadowColor: '#20313c', shadowOpacity: .12, shadowRadius: 10, elevation: 3 },
  heading: { gap: 10 }, company: { color: colors.blue, fontFamily: 'serif', fontSize: 15, lineHeight: 21 },
  receipt: { color: '#050505', fontSize: 16, textAlign: 'right' },
  employee: { marginTop: 17, color: '#080808', fontFamily: 'serif', fontSize: 14, lineHeight: 21 },
  job: { marginTop: 12, color: colors.blue, fontFamily: 'serif', fontSize: 14, lineHeight: 20 },
  days: { marginTop: 24, marginBottom: 20, flexDirection: 'row', justifyContent: 'flex-end', gap: 28 },
  section: { marginTop: 7 }, sectionTitle: { marginBottom: 15, color: colors.blue, fontSize: 15, textDecorationLine: 'underline' },
  row: { minHeight: 31, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { flex: 1, color: '#080808', fontSize: 14 }, value: { color: '#080808', fontSize: 14, fontVariant: ['tabular-nums'] },
  bold: { fontWeight: '800' }, empty: { marginBottom: 12, color: colors.muted, fontStyle: 'italic' },
  divider: { height: 1, marginVertical: 17, backgroundColor: '#c6c6c6' },
  cut: { marginTop: 18, flexDirection: 'row', alignItems: 'center' }, cutLine: { flex: 1, height: 2, backgroundColor: '#111' }, cutText: { marginLeft: 8, color: '#111', fontSize: 11 }
});
