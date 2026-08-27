interface AlertProps {
  title?: string;
  message: string;
  tone?: 'error' | 'warning';
  onClose(): void;
}

export function Alert({ title = 'Kiosko Electrónico', message, tone = 'error', onClose }: AlertProps) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <div className={`alert-dialog ${tone}`} role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
      <div className="alert-symbol">!</div>
      <div><h2>{title}</h2><p>{message}</p></div>
      <button className="button primary" autoFocus onClick={onClose}>Aceptar</button>
    </div>
  </div>;
}
