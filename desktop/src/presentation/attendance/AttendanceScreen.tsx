import { useCallback, useEffect, useRef, useState } from 'react';
import type { AttendanceLookup, MovementKind } from '../../shared/contracts';
import { errorMessage } from '../../application/formatters';
import { Alert } from '../components/Alert';
import { CameraIcon, CheckIcon, ReceiptIcon, RefreshIcon, ReportIcon, ScanIcon, UserIcon } from '../components/Icons';
import { PaymentAuthenticationModal } from '../payments/PaymentAuthenticationModal';
import { PhotoEnrollmentModal } from '../photos/PhotoEnrollmentModal';

interface Props { onOpenReports(): void }

export function AttendanceScreen({ onOpenReports }: Props) {
  const scanner = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const [barcode, setBarcode] = useState('');
  const [lookup, setLookup] = useState<AttendanceLookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<MovementKind | null>(null);
  const [clock, setClock] = useState(new Date());
  const [configured, setConfigured] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(() => new URLSearchParams(window.location.search).get('payment') === '1');
  const [photoEnrollmentOpen, setPhotoEnrollmentOpen] = useState(() => new URLSearchParams(window.location.search).get('photo') === '1');
  const [settings, setSettings] = useState({ timezone: 'America/Guatemala', autoRegisterDelayMs: 250, confirmationDurationMs: 1500, faceMatchThreshold: 0.52, faceRequiredMatches: 3 });

  const focusScanner = useCallback(() => setTimeout(() => scanner.current?.focus(), 0), []);
  const reset = useCallback(() => {
    running.current = false;
    setBarcode('');
    setLookup(null);
    setBusy(false);
    setConfirmation(null);
    focusScanner();
  }, [focusScanner]);

  useEffect(() => {
    focusScanner();
    const interval = window.setInterval(() => setClock(new Date()), 500);
    if (window.kiosk) {
      void window.kiosk.app.getConfigurationStatus().then((status) => {
        setConfigured(status.ready);
        setSettings(status.kiosk);
        if (!status.ready && status.message) setMessage(status.message);
      });
    }
    return () => window.clearInterval(interval);
  }, [focusScanner]);

  const processBarcode = async () => {
    if (!barcode.trim() || running.current || !configured) return;
    running.current = true;
    setBusy(true);
    try {
      const result = await window.kiosk.attendance.lookup(barcode);
      setLookup(result);
      await new Promise((resolve) => setTimeout(resolve, settings.autoRegisterDelayMs));
      await window.kiosk.attendance.register(result.employee.code, result.nextMovement);
      setBusy(false);
      setConfirmation(result.nextMovementLabel);
      const audio = new Audio(result.nextMovement === 1 ? './audio/Bienvenido.wav' : './audio/Adios.wav');
      void audio.play().catch(() => undefined);
      window.setTimeout(reset, settings.confirmationDurationMs);
    } catch (error) {
      setMessage(errorMessage(error).replace(/^Error invoking remote method '[^']+':\s*/i, ''));
      reset();
    }
  };

  const time = new Intl.DateTimeFormat('es-GT', {
    timeZone: settings.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  }).format(clock);
  const date = new Intl.DateTimeFormat('es-GT', {
    timeZone: settings.timezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(clock);

  return <main className="attendance-shell" onMouseDown={() => { if (!paymentOpen && !photoEnrollmentOpen) focusScanner(); }}>
    <input
      ref={scanner}
      className="scanner-capture"
      value={barcode}
      onChange={(event) => setBarcode(event.target.value)}
      onKeyDown={(event) => { if (event.key === 'Enter') void processBarcode(); }}
      autoComplete="off"
      aria-label="Código de barras"
    />

    <header className="topbar">
      <div className="brand-mark"><img src="./brand-symbol.png" alt="Carnes San Martín" /></div>
      <div className="brand-copy"><h1>Kiosko Electrónico</h1><p>Registro de entrada y salida</p></div>
      <div className="clock-block"><strong>{time}</strong><span>{date}</span></div>
      <button className="icon-button reports-access" title="Reportes (Ctrl+Shift+R)" onClick={(e) => { e.stopPropagation(); onOpenReports(); }}><ReportIcon /></button>
    </header>

    <section className="attendance-content">
      <div className="scan-status">
        <span className={`status-dot ${busy ? 'busy' : ''}`} />
        {busy ? 'Procesando marcación…' : 'Lector listo'}
        {barcode && <span className="barcode-preview">{barcode.replace(/./g, '•')}</span>}
      </div>

      <div className="attendance-grid">
        <section className="photo-card">
          {lookup?.employee.photoDataUrl
            ? <img src={lookup.employee.photoDataUrl} alt={`Fotografía de ${lookup.employee.name}`} />
            : <div className="photo-placeholder"><UserIcon /><span>{lookup ? 'Fotografía no disponible' : 'Esperando empleado'}</span></div>}
          {busy && <div className="photo-loading"><span className="spinner" /></div>}
        </section>

        <section className="employee-panel">
          <div className="employee-card">
            <p className="eyebrow">Empleado</p>
            <h2>{lookup?.employee.name || 'Acerque su código al lector'}</h2>
            <div className="employee-code">{lookup ? `Código ${lookup.employee.code}` : 'El registro se realizará automáticamente'}</div>
          </div>

          <div className={`movement-card ${lookup?.nextMovementLabel.toLowerCase() ?? ''}`}>
            <div className="movement-icon">{lookup ? <CheckIcon /> : <ScanIcon />}</div>
            <div><span>{lookup ? 'Movimiento detectado' : 'Listo para escanear'}</span><strong>{lookup?.nextMovementLabel ?? 'Entrada / Salida'}</strong></div>
          </div>

          <div className="attendance-actions">
            <button className="photo-button" onClick={(event) => { event.stopPropagation(); setPhotoEnrollmentOpen(true); }}><CameraIcon />Tomar o actualizar foto</button>
            <button className="payment-button" onClick={(event) => { event.stopPropagation(); setPaymentOpen(true); }}><ReceiptIcon />Comprobante de pago</button>
            <button className="clear-button" onClick={(event) => { event.stopPropagation(); reset(); }}><RefreshIcon />Limpiar</button>
          </div>
        </section>
      </div>
    </section>

    <footer><span className="online-dot" />Sistema de asistencia activo</footer>

    {confirmation && <div className="confirmation-backdrop"><div className={`confirmation-card ${confirmation.toLowerCase()}`}><div className="confirmation-check"><CheckIcon /></div><h2>{confirmation === 'Entrada' ? '¡Bienvenido!' : '¡Adiós, buen viaje!'}</h2><p>{confirmation} registrada correctamente</p></div></div>}
    {paymentOpen && <PaymentAuthenticationModal faceMatchThreshold={settings.faceMatchThreshold} faceRequiredMatches={settings.faceRequiredMatches} onClose={() => { setPaymentOpen(false); focusScanner(); }} />}
    {photoEnrollmentOpen && <PhotoEnrollmentModal onClose={() => { setPhotoEnrollmentOpen(false); focusScanner(); }} />}
    {message && <Alert message={message} tone={configured ? 'error' : 'warning'} onClose={() => { setMessage(null); focusScanner(); }} />}
  </main>;
}
