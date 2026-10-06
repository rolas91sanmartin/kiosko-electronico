import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import type { AppStatus, Employee, PayrollEnvelopeRow, PayrollPage, PayrollPeriod, SignedPayrollTransfer } from '../domain/contracts';
import { amount, clean, errorMessage, money } from '../application/formatters';
import { kioskApi } from '../infrastructure/api';
import { cacheReceipt, logEvent } from '../infrastructure/secureDatabase';
import { ActionButton, Field, Message, Panel } from './components';
import { colors } from './theme';
import { FaceVerification } from './FaceVerification';
import { KioskHardware } from '../hardware/KioskHardware';
import { receiptSecuritySettings } from '../infrastructure/settings';
import { receiptAccessStep } from '../application/receiptSecurity';

type Step = 'barcode' | 'face' | 'payrolls' | 'actions' | 'envelope' | 'transfer';

export function PaymentModal({ visible, status, onClose }: { visible: boolean; status: AppStatus; onClose(): void }) {
  const { width, height } = useWindowDimensions();
  const portrait = height > width;
  const kiosk = width >= 700;
  const compactPortrait = portrait && !kiosk;
  const [step, setStep] = useState<Step>('barcode');
  const [faceEnabled, setFaceEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    setFaceEnabled(null);
    if (!visible) return;
    let active = true;
    void receiptSecuritySettings.load().then(value => { if (active) setFaceEnabled(value); })
      .catch(caught => { if (active) setError(errorMessage(caught)); });
    return () => { active = false; };
  }, [visible]);
  const [barcode, setBarcode] = useState('');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [page, setPage] = useState<PayrollPage | null>(null);
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [rows, setRows] = useState<PayrollEnvelopeRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [transfer, setTransfer] = useState<SignedPayrollTransfer | null>(null);
  const scannerInput = useRef<TextInput>(null);
  const authenticating = useRef(false);
  const accessRequest = useRef(0);
  useEffect(() => {
    if (!visible) { accessRequest.current += 1; return; }
    if (step !== 'barcode' || faceEnabled === null || busy) return;
    // A React Native Modal has its own Android window. HID readers need an
    // input in that window; MainActivity's scanner listener is not sufficient.
    const focusTimer = setTimeout(() => scannerInput.current?.focus(), 100);
    return () => clearTimeout(focusTimer);
  }, [visible, step, faceEnabled, busy]);

  const close = () => { accessRequest.current += 1; authenticating.current = false; setBusy(false); setStep('barcode'); setBarcode(''); setEmployee(null); setPage(null); setRows([]); setError(null); setNotice(null); setTransfer(null); onClose(); };
  const loadPayrolls = async (number = 1) => {
    const request = accessRequest.current;
    setBusy(true); setError(null); setStep('payrolls');
    try { const result = await kioskApi.payments.payrolls(number); if (request === accessRequest.current) setPage(result); }
    catch (caught) { if (request === accessRequest.current) setError(errorMessage(caught)); }
    finally { if (request === accessRequest.current) setBusy(false); }
  };
  const authenticate = async (value = barcode) => {
    if (!visible || step !== 'barcode' || !value.trim() || busy || authenticating.current || faceEnabled === null) return;
    authenticating.current = true;
    const request = ++accessRequest.current;
    setBusy(true); setError(null);
    try {
      const result = await kioskApi.payments.authenticate(value.trim());
      if (request !== accessRequest.current) return;
      const nextStep = receiptAccessStep(faceEnabled, result.photoDataUrl);
      setEmployee(result); setBarcode('');
      if (nextStep === 'face') setStep('face');
      else await loadPayrolls(1);
    } catch (caught) { if (request === accessRequest.current) { setError(errorMessage(caught)); setBarcode(''); } }
    finally { if (request === accessRequest.current) { authenticating.current = false; setBusy(false); } }
  };
  useEffect(() => { if (!visible || step !== 'barcode' || faceEnabled === null) return; return KioskHardware.scanner.subscribe(result => { setBarcode(result.value); void authenticate(result.value); }); }, [visible, step, busy, faceEnabled]);
  const choose = async (selected: PayrollPeriod) => { if (!employee) return; setBusy(true); setError(null); try { const data = await kioskApi.payments.envelope(employee.code, employee.payrollCode, selected.consecutive); if (!data.length) throw new Error('No hay comprobante para esta planilla.'); setRows(data); setPeriod(selected); await cacheReceipt(employee.code, selected, data); setStep('actions'); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } };
  const print = async () => { if (!period || !employee) return; setBusy(true); setError(null); setNotice(null); try { const result = await KioskHardware.printer.printReceipt({ employee, period, rows }, () => kioskApi.payments.print(employee.code, employee.payrollCode, period)); setNotice('Se ha impreso correctamente.'); await logEvent('payment.printed', `${employee.code}:${employee.payrollCode}:${period.consecutive}:${result.source}`); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } };
  const sendEmail = async () => { if (!period || !employee || !email.trim()) return; setBusy(true); setError(null); try { await kioskApi.payments.email(employee.code, employee.payrollCode, period, email.trim()); setNotice(`Comprobante enviado a ${email.trim()}.`); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } };
  const showTransfer = async () => { if (!period || !employee) return; setBusy(true); setError(null); try { setTransfer(await kioskApi.payments.transfer(employee.code, employee.payrollCode, period)); setStep('transfer'); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } };
  const totalPages = page ? Math.max(1, Math.ceil(page.totalRecords / page.pageSize)) : 1;

  return <Modal visible={visible} animationType="slide" onShow={() => scannerInput.current?.focus()} onRequestClose={close}><View style={styles.page}><View style={[styles.header, kiosk && styles.headerKiosk]}><Ionicons name="receipt" size={kiosk ? 42 : 30} color={colors.navy} /><View style={{ flex: 1 }}><Text style={[styles.title, kiosk && styles.titleKiosk]}>Comprobante de pago</Text><Text style={[styles.muted, kiosk && styles.mutedKiosk]}>{faceEnabled === null ? 'Cargando configuración de acceso…' : faceEnabled ? 'Acceso con código de barras y reconocimiento facial' : 'Acceso con escáner o escritura manual'}</Text></View><Pressable hitSlop={12} onPress={close}><Ionicons name="close" size={kiosk ? 42 : 32} color={colors.ink} /></Pressable></View>
    {step === 'barcode' && <View style={styles.center}><Panel style={[styles.auth, kiosk && styles.authKiosk]}><Ionicons name="shield-checkmark" size={kiosk ? 88 : 60} color={colors.green} /><Text style={[styles.step, kiosk && styles.stepKiosk]}>{faceEnabled ? 'PASO 1 DE 2' : 'IDENTIFICACIÓN'}</Text><Text style={[styles.heading, kiosk && styles.headingKiosk]}>Identifique su carnet</Text><Text style={[styles.muted, kiosk && styles.mutedKiosk]}>{faceEnabled === null ? 'Espere mientras se carga la configuración de acceso.' : faceEnabled ? 'Escanee el carnet o escriba el código de barras. Luego se comparará su rostro con la fotografía registrada.' : 'Escanee el carnet o escriba el código de barras para consultar sus comprobantes.'}</Text>{faceEnabled !== null && <TextInput ref={scannerInput} value={barcode} onChangeText={setBarcode} placeholder="Escanee o escriba el código de barras" accessibilityLabel="Código de barras" autoFocus showSoftInputOnFocus contextMenuHidden={false} autoCorrect={false} autoCapitalize="none" returnKeyType="done" submitBehavior="submit" selectTextOnFocus editable={!busy} onSubmitEditing={event => void authenticate(event.nativeEvent.text)} style={[styles.scannerInput, kiosk && styles.scannerInputKiosk]} />}{faceEnabled !== null && <View style={styles.row}><ActionButton icon="checkmark" label={busy ? 'Validando…' : 'Continuar'} onPress={() => void authenticate()} disabled={busy || !barcode.trim()} /></View>}{error && <Message text={error} />}</Panel></View>}
    {step === 'face' && employee && <FaceVerification employee={employee} threshold={status.kiosk.faceMatchThreshold} requiredMatches={status.kiosk.faceRequiredMatches} onCancel={() => { setEmployee(null); setStep('barcode'); }} onVerified={() => void loadPayrolls(1)}/>}
    {step === 'payrolls' && employee && <ScrollView contentContainerStyle={styles.content}><Panel style={styles.employee}><View style={styles.avatar}>{employee.photoDataUrl ? <Image source={{ uri: employee.photoDataUrl }} style={styles.avatarImage} /> : <Ionicons name="person" size={35} color={colors.muted} />}</View><View><Text style={styles.heading}>{employee.name}</Text><Text style={styles.muted}>Código {employee.code} · acceso autorizado</Text></View></Panel><Text style={styles.sectionTitle}>Seleccione una planilla</Text>{busy && <ActivityIndicator accessibilityLabel="Cargando planillas" size="large" color={colors.brand} />}{!busy && !page && error && <ActionButton icon="refresh" label="Reintentar cargar planillas" onPress={() => void loadPayrolls(1)} />}{!busy && page && page.periods.length === 0 && <Text style={styles.muted}>No hay planillas disponibles.</Text>}{page?.periods.map(item => <Pressable key={item.consecutive} onPress={() => void choose(item)} style={styles.period}><View><Text style={styles.periodDate}>{item.from} — {item.to}</Text><Text style={styles.muted}>Consecutivo {item.consecutive}</Text></View><Ionicons name="chevron-forward" size={24} color={colors.blue} /></Pressable>)}{error && <Message text={error} />}<View style={styles.pagination}><ActionButton icon="chevron-back" label="Anterior" secondary disabled={!page || page.page <= 1 || busy} onPress={() => void loadPayrolls((page?.page || 2) - 1)} /><Text>Página {page?.page || 1} de {totalPages}</Text><ActionButton icon="chevron-forward" label="Siguiente" secondary disabled={!page || page.page >= totalPages || busy} onPress={() => void loadPayrolls((page?.page || 0) + 1)} /></View></ScrollView>}
    {step === 'actions' && period && <ScrollView contentContainerStyle={[styles.center, compactPortrait && styles.centerPortrait]}><Panel style={[styles.actionPanel, compactPortrait && styles.actionPanelPortrait]}><Text style={[styles.step, kiosk && styles.stepKiosk]}>PLANILLA {period.consecutive}</Text><Text style={[styles.heading, styles.actionHeading, kiosk && styles.headingKiosk]}>{period.from} — {period.to}</Text><Text style={[styles.muted, styles.actionHint, kiosk && styles.mutedKiosk]}>Elija qué desea hacer.</Text><View style={[styles.actionGrid, compactPortrait && styles.actionGridPortrait]}><ActionButton style={[styles.actionButton, compactPortrait && styles.actionButtonPortrait]} icon="print" label={busy ? 'Imprimiendo…' : 'Imprimir'} onPress={() => void print()} disabled={busy}/><ActionButton style={[styles.actionButton, compactPortrait && styles.actionButtonPortrait]} icon="eye" label="Ver comprobante" secondary onPress={() => setStep('envelope')} /><ActionButton style={[styles.actionButton, compactPortrait && styles.actionButtonPortrait]} icon="scan" label="Escanear sobre" secondary onPress={() => void showTransfer()} disabled={busy}/></View><View style={[styles.emailRow, compactPortrait && styles.emailRowPortrait]}><View style={[styles.emailField, compactPortrait && styles.emailFieldPortrait]}><Field value={email} onChangeText={setEmail} placeholder="Correo del empleado"/></View><ActionButton style={[styles.emailButton, compactPortrait && styles.actionButtonPortrait]} icon="mail" label={busy ? 'Enviando…' : 'Enviar por correo'} secondary={!status.kiosk.emailEnabled} disabled={busy || !status.kiosk.emailEnabled || !email.trim()} onPress={() => void sendEmail()}/></View>{notice && <Message text={notice} tone="success"/>}{error && <Message text={error} />}<ActionButton style={[styles.backButton, compactPortrait && styles.actionButtonPortrait]} icon="chevron-back" label="Volver a planillas" secondary onPress={() => setStep('payrolls')} /></Panel></ScrollView>}
    {step === 'envelope' && period && rows.length > 0 && <Envelope rows={rows} period={period} onBack={() => setStep('actions')} onPrint={() => void print()} />}
    {step === 'transfer' && transfer && period && <ScrollView contentContainerStyle={styles.transfer}><ActionButton icon="chevron-back" label="Volver a opciones" secondary onPress={() => setStep('actions')}/><Text style={styles.step}>PLANILLA {period.consecutive}</Text><Text style={styles.heading}>Escanear sobre</Text><Text style={styles.muted}>Código PDF417 firmado digitalmente por Kiosko API.</Text><Image source={{ uri: transfer.barcodeDataUrl }} style={styles.barcode} resizeMode="contain"/><Text style={styles.signature}>Firma Ed25519 · clave {transfer.keyId}</Text></ScrollView>}
  </View></Modal>;
}

function Envelope({ rows, period, onBack, onPrint }: { rows: PayrollEnvelopeRow[]; period: PayrollPeriod; onBack(): void; onPrint(): void }) {
  const { width, height } = useWindowDimensions();
  const portrait = height > width;
  const first = rows[0], incomes = rows.filter(row => clean(row.RotDeveng) && amount(row.valor)), deductions = rows.filter(row => clean(row.RotDeduc) && amount(row.Valoded));
  const income = incomes.reduce((sum, row) => sum + amount(row.valor), 0), deduction = deductions.reduce((sum, row) => sum + amount(row.Valoded), 0);
  const debt = deductions.reduce((sum, row) => sum + amount(row.saldo), 0);
  return <ScrollView contentContainerStyle={styles.content}><View style={styles.row}><ActionButton icon="chevron-back" label="Volver" secondary onPress={onBack} /><ActionButton icon="print" label="Imprimir" onPress={onPrint} /></View><Panel><View style={[styles.receiptHeading, portrait && styles.receiptHeadingPortrait]}><Text style={[styles.heading, styles.company]}>INDUSTRIAL COMERCIAL SANMARTIN PLANILLA DEL {period.from} AL {period.to}</Text><Text>Sobre No  1</Text></View><Text style={styles.employeeLine}>EMPLEADO: {first.cod_Empleado} {clean(first.nom_empleado)} {clean(first.ape_empleado)} | INSS: {clean(first.numero_inss)}</Text><Text style={styles.blue}>Cargo: {clean(first.des_cargo)} · Área: {clean(first.des_dependencia)}</Text><Text style={styles.worked}>DÍAS LABORADOS  {money.format(amount(first.Dias_laborados))}</Text><View style={[styles.columns, portrait && styles.columnsPortrait]}><View style={{ flex: 1 }}><Text style={styles.columnTitle}>INGRESOS</Text>{incomes.map((row, i) => <Line key={i} label={clean(row.RotDeveng)} value={amount(row.valor)} />)}<Line label="TOTAL INGRESOS" value={income} total /><Line label="SALDO DE DEUDA" value={debt} total /></View><View style={{ flex: 1 }}><Text style={styles.columnTitle}>DEDUCCIONES</Text>{deductions.map((row, i) => <Line key={i} label={clean(row.RotDeduc)} value={amount(row.Valoded)} />)}<Line label="TOTAL DEDUCCIONES" value={deduction} total /><Line label="INGRESO NETO" value={income - deduction} total /></View></View><Text style={styles.cut}>────────────────── CORTAR AQUÍ</Text></Panel></ScrollView>;
}
function Line({ label, value, total }: { label: string; value: number; total?: boolean }) { return <View style={[styles.line, total && { borderTopWidth: 2 }]}><Text style={total && { fontWeight: '800' }}>{label}</Text><Text style={{ fontWeight: '800' }}>{money.format(value)}</Text></View>; }

const styles = StyleSheet.create({
  scannerInput: { width: '100%', minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 14, color: colors.ink, fontSize: 15 },
  scannerInputKiosk: { minHeight: 64, fontSize: 20 },
  page: { flex: 1, backgroundColor: colors.bg }, header: { height: 78, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: colors.line }, title: { fontSize: 22, fontWeight: '800', color: colors.ink }, muted: { color: colors.muted },
  headerKiosk: { height: 112, gap: 20, paddingHorizontal: 30 }, titleKiosk: { fontSize: 32 }, mutedKiosk: { fontSize: 18, lineHeight: 25 },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 22 }, centerPortrait: { justifyContent: 'flex-start', paddingHorizontal: 18, paddingVertical: 28 }, auth: { width: '100%', maxWidth: 520, alignItems: 'center', gap: 14 }, step: { color: colors.blue, fontWeight: '800', fontSize: 12 }, heading: { fontSize: 20, color: colors.ink, fontWeight: '800' }, row: { flexDirection: 'row', gap: 10, alignItems: 'center' }, content: { padding: 22, gap: 12 },
  authKiosk: { maxWidth: 760, gap: 24 }, stepKiosk: { fontSize: 17 }, headingKiosk: { fontSize: 30 },
  employee: { flexDirection: 'row', alignItems: 'center', gap: 14 }, avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatarImage: { width: '100%', height: '100%' }, sectionTitle: { fontSize: 22, fontWeight: '800', color: colors.ink, marginTop: 5 }, period: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, periodDate: { fontSize: 16, fontWeight: '700', color: colors.ink }, pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15 },
  actionPanel: { width: '100%', maxWidth: 760, alignItems: 'center', gap: 18, padding: 24 }, actionPanelPortrait: { maxWidth: 620, paddingHorizontal: 20, paddingVertical: 26 }, actionHeading: { textAlign: 'center', fontSize: 22 }, actionHint: { textAlign: 'center' }, actionGrid: { width: '100%', flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }, actionGridPortrait: { flexDirection: 'column', flexWrap: 'nowrap' }, actionButton: { width: 210, minHeight: 56 }, actionButtonPortrait: { width: '100%', maxWidth: 440, alignSelf: 'center' }, emailRow: { width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }, emailRowPortrait: { flexDirection: 'column' }, emailField: { flex: 1, minWidth: 210, maxWidth: 440 }, emailFieldPortrait: { flex: 0, width: '100%' }, emailButton: { minHeight: 52 }, backButton: { minHeight: 52, minWidth: 210 }, employeeLine: { fontWeight: '800', marginVertical: 14 }, columns: { flexDirection: 'row', gap: 24, marginTop: 14 }, columnsPortrait: { flexDirection: 'column' }, columnTitle: { fontWeight: '900', color: '#0000ee', textDecorationLine: 'underline', paddingBottom: 5 }, line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.line }, receiptHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 14 }, receiptHeadingPortrait: { flexDirection: 'column' }, company: { color: '#0000ee', flex: 1 }, blue: { color: '#0000ee' }, worked: { textAlign: 'right', fontWeight: '800', marginVertical: 18 }, cut: { textAlign: 'right', marginTop: 20, fontWeight: '800' }, transfer: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 18, gap: 12 }, barcode: { width: '100%', maxWidth: 900, height: 260, backgroundColor: '#fff' }, signature: { color: colors.muted, fontSize: 11 }
});
