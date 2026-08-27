import { useEffect, useRef, useState } from 'react';
import type { Employee, PayrollEnvelopeRow, PayrollPage, PayrollPeriod } from '../../shared/contracts';
import { errorMessage } from '../../application/formatters';
import { createPayrollTransferCode } from '../../application/payroll-transfer';
import { CameraIcon, CheckIcon, CloseIcon, EyeIcon, MailIcon, PrintIcon, ReceiptIcon, ScanIcon, ShieldIcon, UserIcon } from '../components/Icons';

interface Props { faceMatchThreshold: number; faceRequiredMatches: number; onClose(): void }
type Step = 'barcode' | 'face' | 'payrolls' | 'actions' | 'envelope' | 'transfer';
interface FacePoint { x: number; y: number }
let modelsPromise: Promise<void> | null = null;

function pointDistance(a: FacePoint, b: FacePoint) { return Math.hypot(a.x - b.x, a.y - b.y); }
function normalizedHeadOffset(landmarks: any) {
  const jaw = landmarks.getJawOutline() as FacePoint[];
  const nose = landmarks.getNose() as FacePoint[];
  const faceWidth = Math.max(pointDistance(jaw[0], jaw[16]), 0.001);
  return (nose[3].x - (jaw[0].x + jaw[16].x) / 2) / faceWidth;
}
function challengeInstruction(phase = 0) {
  return phase === 0 ? 'Gire la cabeza hacia un lado' : 'Mire al frente y manténgase quieto';
}
function loadFaceModels() {
  if (!window.faceapi) return Promise.reject(new Error('El motor de reconocimiento facial no está disponible.'));
  if (!modelsPromise) {
    modelsPromise = Promise.all([
      window.faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
      window.faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
      window.faceapi.nets.faceRecognitionNet.loadFromUri('./models')
    ]).then(() => undefined).catch((error) => { modelsPromise = null; throw error; });
  }
  return modelsPromise;
}
function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo preparar la fotografía registrada.')); image.src = source;
  });
}
function clean(value: unknown) { return String(value ?? '').trim(); }
function amount(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
const money = new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function PayrollEnvelope({ rows, period, onBack }: { rows: PayrollEnvelopeRow[]; period: PayrollPeriod; onBack(): void }) {
  const first = rows[0];
  const incomes = rows.filter((row) => clean(row.RotDeveng) && amount(row.valor) !== 0);
  const deductions = rows.filter((row) => clean(row.RotDeduc) && amount(row.Valoded) !== 0);
  const totalIncome = incomes.reduce((total, row) => total + amount(row.valor), 0);
  const totalDeductions = deductions.reduce((total, row) => total + amount(row.Valoded), 0);
  const debtBalance = deductions.reduce((total, row) => total + amount(row.saldo), 0);
  return <div className="envelope-step">
    <div className="envelope-toolbar"><button className="payment-secondary" onClick={onBack}>← Volver a planillas</button><span>Comprobante de pago</span></div>
    <article className="pay-envelope">
      <div className="envelope-heading"><strong>INDUSTRIAL COMERCIAL SANMARTIN PLANILLA DEL {period.from} AL {period.to}</strong><div>Sobre No <b>1</b></div></div>
      <p className="envelope-employee">EMPLEADO: <b>{first.cod_Empleado} {clean(first.nom_empleado)} {clean(first.ape_empleado)}</b> | INSS: {clean(first.numero_inss)}</p>
      <p className="envelope-job">Cargo: {clean(first.des_cargo)} <span>Área: {clean(first.des_dependencia)}</span></p>
      <div className="worked-days"><b>DÍAS LABORADOS</b><span>{money.format(amount(first.Dias_laborados))}</span></div>
      <div className="envelope-columns">
        <section><h4>INGRESOS</h4>{incomes.map((row, index) => <div className="envelope-line" key={`income-${index}`}><span>{clean(row.RotDeveng)}</span><b>{money.format(amount(row.valor))}</b></div>)}<div className="envelope-total"><span>TOTAL INGRESOS</span><b>{money.format(totalIncome)}</b></div><div className="envelope-total"><span>SALDO DE DEUDA</span><b>{money.format(debtBalance)}</b></div></section>
        <section><h4>DEDUCCIONES</h4>{deductions.map((row, index) => <div className="envelope-line" key={`deduction-${index}`}><span>{clean(row.RotDeduc)}</span><b>{money.format(amount(row.Valoded))}</b></div>)}<div className="envelope-total"><span>TOTAL DEDUCCIONES</span><b>{money.format(totalDeductions)}</b></div><div className="envelope-line envelope-net"><span>INGRESO NETO</span><b>{money.format(totalIncome - totalDeductions)}</b></div></section>
      </div>
      <div className="cut-line"><span>CORTAR AQUÍ</span></div>
    </article>
  </div>;
}

function PayrollTransferCode({ value, period, onBack }: { value: string; period: PayrollPeriod; onBack(): void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void import('bwip-js/browser').then(({ default: bwipjs }) => {
      if (!active || !canvasRef.current) return;
      const options = Object.assign(
        { bcid: 'pdf417', text: value, scale: 3, height: 18, paddingwidth: 10, paddingheight: 10 },
        { columns: 10, eclevel: 4 }
      );
      bwipjs.toCanvas(canvasRef.current, options);
    }).catch((caught) => { if (active) setRenderError(errorMessage(caught)); });
    return () => { active = false; };
  }, [value]);
  return <div className="transfer-step">
    <button className="actions-back" onClick={onBack}>← Volver a opciones</button>
    <span className="step-number">PLANILLA {period.consecutive}</span>
    <h3>Escanear sobre</h3>
    <p>Abra la app móvil, coloque el código completo dentro del marco y espere a que enfoque.</p>
    <div className="pdf417-card">
      {renderError ? <div className="payment-error">{renderError}</div> : <canvas ref={canvasRef} aria-label="Código del comprobante"/>}
    </div>
    <small>Mantenga la pantalla limpia y sin reflejos. Si no lo detecta, aleje el teléfono entre 30 y 50 cm o gírelo horizontalmente.</small>
  </div>;
}

export function PaymentAuthenticationModal({ faceMatchThreshold, faceRequiredMatches, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null), scannerRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null), stoppedRef = useRef(false);
  const [step, setStep] = useState<Step>('barcode');
  const [barcode, setBarcode] = useState('');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Escanee su código de barras para continuar');
  const [error, setError] = useState<string | null>(null);
  const [matchCount, setMatchCount] = useState(0), [livenessCount, setLivenessCount] = useState(0);
  const [livenessLabel, setLivenessLabel] = useState('El giro de cabeza iniciará después de confirmar su rostro');
  const [payrollPage, setPayrollPage] = useState<PayrollPage | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);
  const [envelopeRows, setEnvelopeRows] = useState<PayrollEnvelopeRow[]>([]);
  const [transferCode, setTransferCode] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const stopCamera = () => { stoppedRef.current = true; streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; };
  const close = () => { stopCamera(); onClose(); };
  const showPayrolls = async (page = 1) => {
    stopCamera(); setStep('payrolls'); setBusy(true); setError(null);
    try { setPayrollPage(await window.kiosk.payments.payrolls(page)); }
    catch (caught) { setError(errorMessage(caught).replace(/^Error invoking remote method '[^']+':\s*/i, '')); }
    finally { setBusy(false); }
  };
  const showEnvelope = async (period: PayrollPeriod) => {
    if (!employee || busy) return;
    setBusy(true); setError(null);
    try {
      const rows = await window.kiosk.payments.envelope(employee.code, period.consecutive);
      if (!rows.length) throw new Error('Este empleado no tiene comprobante en la planilla seleccionada.');
      setSelectedPeriod(period); setEnvelopeRows(rows); setStep('envelope');
    } catch (caught) { setError(errorMessage(caught).replace(/^Error invoking remote method '[^']+':\s*/i, '')); }
    finally { setBusy(false); }
  };
  const selectPeriod = (period: PayrollPeriod) => {
    setSelectedPeriod(period); setEnvelopeRows([]); setError(null); setActionNotice(null); setStep('actions');
  };
  const printEnvelope = async () => {
    if (!employee || !selectedPeriod || busy) return;
    setBusy(true); setError(null); setActionNotice(null);
    try {
      const result = await window.kiosk.payments.print(employee.code, selectedPeriod);
      setActionNotice(`Comprobante enviado directamente a ${result.printerName}.`);
    } catch (caught) { setError(errorMessage(caught).replace(/^Error invoking remote method '[^']+':\s*/i, '')); }
    finally { setBusy(false); }
  };
  const showTransferCode = async () => {
    if (!employee || !selectedPeriod || busy) return;
    setBusy(true); setError(null); setActionNotice(null);
    try {
      const rows = await window.kiosk.payments.envelope(employee.code, selectedPeriod.consecutive);
      if (!rows.length) throw new Error('Este empleado no tiene comprobante en la planilla seleccionada.');
      setTransferCode(await createPayrollTransferCode(employee, selectedPeriod, rows));
      setStep('transfer');
    } catch (caught) { setError(errorMessage(caught).replace(/^Error invoking remote method '[^']+':\s*/i, '')); }
    finally { setBusy(false); }
  };

  useEffect(() => { void loadFaceModels().catch(() => undefined); }, []);
  useEffect(() => { if (step === 'barcode') setTimeout(() => scannerRef.current?.focus(), 30); }, [step]);
  useEffect(() => {
    if (step !== 'face' || !employee?.photoDataUrl) return;
    stoppedRef.current = false; let timer: number | undefined;
    const verify = async () => {
      try {
        setBusy(true); setStatus('Abriendo cámara y preparando verificación…');
        const options = new window.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
        const referencePromise = (async () => {
          await loadFaceModels(); const image = await loadImage(employee.photoDataUrl!);
          const reference = await window.faceapi.detectSingleFace(image, options).withFaceLandmarks().withFaceDescriptor();
          if (!reference) throw new Error('La fotografía registrada no contiene un rostro reconocible.');
          return reference;
        })();
        const cameraPromise = (async () => {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 }, facingMode: 'user' }, audio: false });
          if (stoppedRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
          streamRef.current = stream;
          if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        })();
        const [reference] = await Promise.all([referencePromise, cameraPromise]);
        if (stoppedRef.current) return;
        setBusy(false); setStatus('Mire de frente a la cámara');
        let consecutive = 0, yawTotal = 0, baselineYaw = 0;
        let identityVerified = false, challengePhase = 0, challengeFrames = 0;
        const resetVerification = () => {
          consecutive = 0; identityVerified = false; yawTotal = 0; challengePhase = 0; challengeFrames = 0;
          setMatchCount(0); setLivenessCount(0); setLivenessLabel('El giro de cabeza iniciará después de confirmar su rostro');
        };
        const completeChallenge = () => {
          challengePhase = 0; challengeFrames = 0; setLivenessCount(1); void showPayrolls(1); return true;
        };
        const inspectLiveness = (face: any) => {
          const yawDelta = Math.abs(normalizedHeadOffset(face.landmarks) - baselineYaw);
          if (challengePhase === 0) { challengeFrames = yawDelta > 0.1 ? challengeFrames + 1 : 0; if (challengeFrames >= 2) { challengePhase = 1; challengeFrames = 0; setStatus(challengeInstruction(1)); setLivenessLabel('Regrese al frente y manténgase quieto'); } }
          else { challengeFrames = yawDelta < 0.085 ? 1 : 0; if (challengeFrames >= 1) return completeChallenge(); }
          return false;
        };
        const inspect = async () => {
          if (stoppedRef.current || !videoRef.current) return;
          try {
            if (!identityVerified) {
              const faces = await window.faceapi.detectAllFaces(videoRef.current, options).withFaceLandmarks().withFaceDescriptors();
              if (faces.length !== 1) { resetVerification(); setStatus(faces.length > 1 ? 'Solo debe aparecer una persona' : 'Ubique su rostro dentro del marco'); }
              else if (window.faceapi.euclideanDistance(reference.descriptor, faces[0].descriptor) <= faceMatchThreshold) {
                consecutive += 1; yawTotal += normalizedHeadOffset(faces[0].landmarks); setMatchCount(consecutive); setStatus(`Confirmando identidad ${consecutive}/${faceRequiredMatches}`);
                if (consecutive >= faceRequiredMatches) { identityVerified = true; baselineYaw = yawTotal / consecutive; const instruction = challengeInstruction(); setStatus(instruction); setLivenessLabel(`Prueba de vida: ${instruction}`); }
              } else { resetVerification(); setStatus('El rostro no coincide con la fotografía registrada'); }
            } else {
              const faces = await window.faceapi.detectAllFaces(videoRef.current, options).withFaceLandmarks();
              if (faces.length === 1 && inspectLiveness(faces[0])) return;
              if (faces.length !== 1) setStatus(faces.length > 1 ? 'Solo debe aparecer una persona' : 'Mantenga el rostro dentro del marco');
            }
          } catch { setStatus('No se pudo analizar el cuadro. Intente nuevamente.'); }
          timer = window.setTimeout(inspect, identityVerified ? 60 : 140);
        };
        void inspect();
      } catch (caught) { setBusy(false); setError(errorMessage(caught)); setStatus('No fue posible completar la verificación facial'); }
    };
    void verify(); return () => { if (timer) window.clearTimeout(timer); stopCamera(); };
  }, [step, employee, faceMatchThreshold, faceRequiredMatches]);

  const authenticate = async () => {
    if (!barcode.trim() || busy) return;
    setBusy(true); setError(null); setStatus('Validando empleado…');
    try {
      const [result] = await Promise.all([window.kiosk.payments.authenticate(barcode), loadFaceModels()]);
      if (!result.photoDataUrl) throw new Error('El empleado no tiene una fotografía registrada para validar su rostro.');
      setEmployee(result); setBarcode(''); setStep('face');
    } catch (caught) { setError(errorMessage(caught).replace(/^Error invoking remote method '[^']+':\s*/i, '')); setStatus('Escanee nuevamente su código de barras'); setBarcode(''); setTimeout(() => scannerRef.current?.focus(), 30); }
    finally { setBusy(false); }
  };
  const restart = () => {
    stopCamera(); setEmployee(null); setBarcode(''); setError(null); setActionNotice(null); setMatchCount(0); setLivenessCount(0); setPayrollPage(null); setSelectedPeriod(null); setEnvelopeRows([]); setTransferCode(''); setLivenessLabel('El giro de cabeza iniciará después de confirmar su rostro'); setStatus('Escanee su código de barras para continuar'); setStep('barcode');
  };
  const totalPages = payrollPage ? Math.max(1, Math.ceil(payrollPage.totalRecords / payrollPage.pageSize)) : 1;

  return <div className="payment-auth-backdrop" role="dialog" aria-modal="true" aria-label="Autenticación de comprobante de pago" onMouseDown={(event) => event.stopPropagation()}>
    <section className={`payment-auth-modal ${step === 'payrolls' || step === 'actions' || step === 'envelope' || step === 'transfer' ? 'wide' : ''}`}>
      <header><div className="payment-title-icon"><ReceiptIcon /></div><div><h2>Comprobante de pago</h2><p>Autenticación segura y consulta de planillas</p></div><button className="payment-close" aria-label="Cerrar" onClick={close}><CloseIcon /></button></header>
      {step === 'barcode' && <div className="payment-step barcode-step"><div className="security-badge"><ShieldIcon /></div><span className="step-number">PASO 1 DE 2</span><h3>Identifique su gafete</h3><p>Escanee su código de barras para validar que está registrado como empleado.</p><label className="payment-scanner"><ScanIcon /><input ref={scannerRef} value={barcode} onChange={(event) => setBarcode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void authenticate(); }} placeholder="Esperando código de barras…" autoComplete="off"/><span className={busy ? 'spinner small' : ''}>{busy ? '' : 'Enter'}</span></label><div className="payment-status">{status}</div>{error && <div className="payment-error">{error}</div>}</div>}
      {step === 'face' && employee && <div className="payment-step face-step"><span className="step-number">PASO 2 DE 2</span><div className="face-employee"><div className="face-thumb">{employee.photoDataUrl ? <img src={employee.photoDataUrl} alt="Foto registrada"/> : <UserIcon />}</div><div><b>{employee.name}</b><span>Código {employee.code} validado</span></div></div><div className="camera-frame"><video ref={videoRef} muted playsInline/><div className="face-guide"><i/><i/><i/><i/></div>{busy && <div className="camera-loading"><span className="spinner"/><p>{status}</p></div>}</div><div className="facial-status"><CameraIcon/><div><b>{status}</b><span>Coincidencias de identidad: {matchCount}/{faceRequiredMatches}</span></div></div><div className="liveness-status"><ShieldIcon/><div><b>{livenessLabel}</b><span>Prueba de vida: {livenessCount}/1</span></div><div className="liveness-dots"><i className={livenessCount >= 1 ? 'complete' : ''}/></div></div>{error && <div className="payment-error">{error}</div>}<button className="payment-secondary" onClick={restart}>Usar otro empleado</button></div>}
      {step === 'payrolls' && employee && <div className="payroll-step"><div className="payroll-success"><CheckIcon/><div><b>Identidad verificada</b><span>{employee.name} · Código {employee.code}</span></div><button onClick={restart}>Cambiar empleado</button></div><div className="payroll-title"><div><span className="step-number">SELECCIONE UNA PLANILLA</span><h3>Comprobantes disponibles</h3></div>{payrollPage && <small>{payrollPage.totalRecords} planillas</small>}</div><div className="payroll-grid"><div className="payroll-grid-head"><span>Rango de fecha</span><span>Consecutivo</span><span/></div>{payrollPage?.periods.map((period) => <button className="payroll-row" key={period.consecutive} disabled={busy} onClick={() => selectPeriod(period)}><span>{period.from} — {period.to}</span><b>{period.consecutive}</b><em>Seleccionar →</em></button>)}{!busy && payrollPage?.periods.length === 0 && <p className="payroll-empty">No se encontraron planillas.</p>}{busy && <div className="payroll-loading"><span className="spinner"/> Consultando…</div>}</div>{error && <div className="payment-error">{error}</div>}{payrollPage && <div className="payroll-pagination"><button disabled={busy || payrollPage.page <= 1} onClick={() => void showPayrolls(payrollPage.page - 1)}>Anterior</button><span>Página {payrollPage.page} de {totalPages}</span><button disabled={busy || payrollPage.page >= totalPages} onClick={() => void showPayrolls(payrollPage.page + 1)}>Siguiente</button></div>}</div>}
      {step === 'actions' && employee && selectedPeriod && <div className="payment-actions-step"><button className="actions-back" onClick={() => { setError(null); setActionNotice(null); setStep('payrolls'); }}>← Volver a planillas</button><span className="step-number">PLANILLA {selectedPeriod.consecutive}</span><h3>¿Qué desea hacer?</h3><p>{selectedPeriod.from} — {selectedPeriod.to}</p><div className="payment-action-grid"><button disabled={busy} onClick={() => void printEnvelope()}><PrintIcon/><b>{busy ? 'Imprimiendo…' : 'Imprimir'}</b><span>Enviar directamente a la impresora ticketera</span></button><button disabled={busy} onClick={() => void showEnvelope(selectedPeriod)}><EyeIcon/><b>Ver comprobante</b><span>Consultar el detalle en pantalla</span></button><button disabled={busy} onClick={() => void showTransferCode()}><ScanIcon/><b>{busy ? 'Preparando…' : 'Escanear sobre'}</b><span>Generar Código para guardarlo en la app móvil</span></button><button disabled className="pending"><MailIcon/><b>Enviar por correo</b><span>Pendiente de configurar el servicio de correo</span><em>PRÓXIMAMENTE</em></button></div>{actionNotice && <div className="payment-action-success"><CheckIcon/>{actionNotice}</div>}{error && <div className="payment-error">{error}</div>}</div>}
      {step === 'envelope' && selectedPeriod && envelopeRows.length > 0 && <PayrollEnvelope rows={envelopeRows} period={selectedPeriod} onBack={() => { setError(null); setStep('actions'); }}/>} 
      {step === 'transfer' && selectedPeriod && transferCode && <PayrollTransferCode value={transferCode} period={selectedPeriod} onBack={() => { setError(null); setStep('actions'); }}/>} 
    </section>
  </div>;
}
