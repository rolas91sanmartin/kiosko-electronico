import { useEffect, useRef, useState } from 'react';
import type { Employee } from '../../shared/contracts';
import { errorMessage } from '../../application/formatters';
import { CameraIcon, CheckIcon, CloseIcon, ScanIcon, ShieldIcon, UserIcon } from '../components/Icons';

interface Props { onClose(): void }
type Step = 'barcode' | 'camera' | 'preview' | 'success';

export function PhotoEnrollmentModal({ onClose }: Props) {
  const scannerRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState<Step>('barcode');
  const [barcode, setBarcode] = useState('');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [token, setToken] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };
  const close = () => { stopCamera(); onClose(); };

  useEffect(() => {
    if (step === 'barcode') setTimeout(() => scannerRef.current?.focus(), 30);
  }, [step]);

  useEffect(() => {
    if (step !== 'camera') return;
    let canceled = false;
    const start = async () => {
      try {
        setBusy(true); setError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false
        });
        if (canceled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (caught) {
        setError(`No se pudo abrir la cámara: ${errorMessage(caught)}`);
      } finally { setBusy(false); }
    };
    void start();
    return () => { canceled = true; stopCamera(); };
  }, [step]);

  const authenticate = async () => {
    if (!barcode.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const authorization = await window.kiosk.photos.authenticate(barcode);
      setEmployee(authorization.employee);
      setToken(authorization.token);
      setBarcode('');
      setStep('camera');
    } catch (caught) {
      setError(errorMessage(caught).replace(/^Error invoking remote method '[^']+':\s*/i, ''));
      setBarcode('');
      setTimeout(() => scannerRef.current?.focus(), 30);
    } finally { setBusy(false); }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return setError('La cámara todavía no está lista.');
    const sourceHeight = video.videoHeight;
    const sourceWidth = Math.min(video.videoWidth, sourceHeight * 0.75);
    const sourceX = (video.videoWidth - sourceWidth) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const context = canvas.getContext('2d');
    if (!context) return setError('No se pudo preparar la captura.');
    context.drawImage(video, sourceX, 0, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    setPreview(canvas.toDataURL('image/jpeg', 0.9));
    stopCamera();
    setStep('preview');
  };

  const save = async () => {
    if (!preview || !token || busy) return;
    setBusy(true); setError(null);
    try {
      const updated = await window.kiosk.photos.save(token, preview);
      setEmployee(updated);
      setStep('success');
    } catch (caught) {
      setError(errorMessage(caught).replace(/^Error invoking remote method '[^']+':\s*/i, ''));
    } finally { setBusy(false); }
  };

  const restart = () => {
    stopCamera(); setEmployee(null); setToken(''); setPreview(null); setBarcode(''); setError(null); setStep('barcode');
  };

  return <div className="photo-enrollment-backdrop" role="dialog" aria-modal="true" aria-label="Tomar o actualizar fotografía" onMouseDown={(event) => event.stopPropagation()}>
    <section className="photo-enrollment-modal">
      <header><div className="photo-title-icon"><CameraIcon /></div><div><h2>Tomar o actualizar foto</h2><p>Registro fotográfico del empleado</p></div><button className="payment-close" aria-label="Cerrar" onClick={close}><CloseIcon /></button></header>

      {step === 'barcode' && <div className="photo-step photo-barcode-step">
        <div className="security-badge"><ShieldIcon /></div>
        <span className="step-number">AUTENTICACIÓN REQUERIDA</span>
        <h3>Escanee su carnet</h3>
        <p>Antes de usar la cámara validaremos que el empleado exista en RRHH.</p>
        <label className="payment-scanner"><ScanIcon /><input ref={scannerRef} value={barcode} onChange={(event) => setBarcode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void authenticate(); }} placeholder="Esperando código de barras…" autoComplete="off"/><span className={busy ? 'spinner small' : ''}>{busy ? '' : 'Enter'}</span></label>
        {error && <div className="payment-error">{error}</div>}
      </div>}

      {step === 'camera' && employee && <div className="photo-step photo-camera-step">
        <div className="photo-employee-row"><div className="face-thumb">{employee.photoDataUrl ? <img src={employee.photoDataUrl} alt="Foto actual"/> : <UserIcon />}</div><div><b>{employee.name}</b><span>Código {employee.code} · Nómina {employee.payrollCode}</span></div><em>{employee.photoDataUrl ? 'La foto actual será reemplazada' : 'Empleado sin foto registrada'}</em></div>
        <div className="photo-camera-frame"><video ref={videoRef} muted playsInline/><div className="portrait-guide"><i/><i/><i/><i/></div>{busy && <div className="camera-loading"><span className="spinner"/><p>Abriendo cámara…</p></div>}</div>
        <p className="photo-guidance">Mire de frente, mantenga buena iluminación y coloque el rostro dentro del marco.</p>
        {error && <div className="payment-error">{error}</div>}
        <div className="photo-modal-actions"><button className="payment-secondary" onClick={restart}>Cancelar</button><button className="photo-capture-button" disabled={busy || Boolean(error)} onClick={capture}><CameraIcon />Tomar foto</button></div>
      </div>}

      {step === 'preview' && employee && preview && <div className="photo-step photo-preview-step">
        <span className="step-number">CONFIRME LA FOTOGRAFÍA</span>
        <h3>{employee.name}</h3>
        <img className="captured-photo" src={preview} alt="Nueva fotografía capturada"/>
        <p>Se guardará como <strong>{Number(employee.code)}.JPG</strong> y se actualizará el registro en RRHH.</p>
        {error && <div className="payment-error">{error}</div>}
        <div className="photo-modal-actions"><button className="payment-secondary" disabled={busy} onClick={() => { setPreview(null); setError(null); setStep('camera'); }}>Tomar otra</button><button className="photo-save-button" disabled={busy} onClick={() => void save()}>{busy ? <span className="spinner small"/> : <CheckIcon/>}{busy ? 'Guardando…' : 'Guardar fotografía'}</button></div>
      </div>}

      {step === 'success' && employee && <div className="photo-step photo-success-step">
        <div className="success-seal"><CheckIcon /></div><span className="step-number">FOTOGRAFÍA ACTUALIZADA</span><h3>Registro completado</h3>
        {employee.photoDataUrl && <img className="saved-photo" src={employee.photoDataUrl} alt="Fotografía guardada"/>}
        <p>La imagen de <strong>{employee.name}</strong> fue guardada en el directorio configurado y vinculada en RRHH.</p>
        <button className="payment-primary" onClick={close}>Finalizar</button>
      </div>}
    </section>
  </div>;
}
