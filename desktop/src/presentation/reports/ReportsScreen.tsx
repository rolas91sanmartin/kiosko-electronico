import { useEffect, useMemo, useState } from 'react';
import type { CatalogItem, ReportEmployee, ReportFilters } from '../../shared/contracts';
import { errorMessage, formatSqlDate, todayIso } from '../../application/formatters';
import { Alert } from '../components/Alert';
import { ArrowIcon, CheckIcon, ReportIcon } from '../components/Icons';

interface Props { onBack(): void }

function Checklist({ items, selected, onChange, empty }: { items: CatalogItem[]; selected: string[]; onChange(codes: string[]): void; empty: string }) {
  if (!items.length) return <div className="checklist-empty">{empty}</div>;
  return <div className="checklist">
    {items.map((item) => <label key={item.code}><input type="checkbox" checked={selected.includes(item.code)} onChange={(e) => onChange(e.target.checked ? [...selected, item.code] : selected.filter((code) => code !== item.code))}/><span><CheckIcon /></span><b>{item.description}</b></label>)}
  </div>;
}

export function ReportsScreen({ onBack }: Props) {
  const today = todayIso();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [payrolls, setPayrolls] = useState<CatalogItem[]>([]);
  const [dependencies, setDependencies] = useState<CatalogItem[]>([]);
  const [payrollCodes, setPayrollCodes] = useState<string[]>([]);
  const [dependencyCodes, setDependencyCodes] = useState<string[]>([]);
  const [employees, setEmployees] = useState<ReportEmployee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [includeExitTime, setIncludeExitTime] = useState(false);
  const [reportRows, setReportRows] = useState<Record<string, unknown>[]>([]);
  const [tab, setTab] = useState<'filters' | 'report'>('filters');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const baseFilters = (): ReportFilters => ({ from: formatSqlDate(from), to: formatSqlDate(to), payrollCodes, dependencyCodes, search });
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try { await work(); } catch (error) { setMessage(errorMessage(error).replace(/^Error invoking remote method '[^']+':\s*/i, '')); } finally { setBusy(false); }
  };

  const loadPayrolls = () => run(async () => {
    const rows = await window.kiosk.reports.payrolls();
    setPayrolls(rows); setPayrollCodes(rows.map((row) => row.code));
  });
  const loadDependencies = () => {
    if (!payrollCodes.length) return setMessage('Debe seleccionar al menos una nómina');
    void run(async () => { const rows = await window.kiosk.reports.dependencies(payrollCodes); setDependencies(rows); setDependencyCodes(rows.map((row) => row.code)); });
  };
  const loadEmployees = () => {
    if (!payrollCodes.length) return setMessage('Debe seleccionar al menos una nómina');
    if (!dependencyCodes.length) return setMessage('Debe seleccionar al menos una dependencia');
    void run(async () => { const rows = await window.kiosk.reports.employees(baseFilters()); setEmployees(rows); setSelectedEmployees(rows.map((row) => String(row.Codigo))); });
  };
  const generate = () => {
    if (!employees.length) return setMessage('No hay empleados en la lista');
    if (!selectedEmployees.length) return setMessage('Debe seleccionar al menos un empleado');
    void run(async () => {
      const rows = await window.kiosk.reports.generate({ ...baseFilters(), employeeCodes: selectedEmployees, includeExitTime, search: undefined });
      setReportRows(rows); setTab('report');
    });
  };

  useEffect(() => {
    if (!search || !payrollCodes.length || !dependencyCodes.length) return;
    const timer = window.setTimeout(() => void run(async () => {
      const rows = await window.kiosk.reports.employees(baseFilters());
      setEmployees(rows); setSelectedEmployees(rows.map((row) => String(row.Codigo)));
    }), 350);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const employeeColumns = useMemo(() => employees.length ? Object.keys(employees[0]).filter((key) => key !== 'Seleccionar') : [], [employees]);
  const reportColumns = useMemo(() => reportRows.length ? Object.keys(reportRows[0]) : [], [reportRows]);
  const allSelected = employees.length > 0 && selectedEmployees.length === employees.length;

  return <main className="reports-shell">
    <header className="reports-header">
      <button className="back-button" onClick={onBack}><ArrowIcon />Volver al kiosco</button>
      <div><ReportIcon /><span><h1>Reportes de asistencia</h1><p>Entrada y salida de empleados</p></span></div>
      <div className="tab-switch"><button className={tab === 'filters' ? 'active' : ''} onClick={() => setTab('filters')}>Filtros</button><button className={tab === 'report' ? 'active' : ''} onClick={() => setTab('report')}>Reporte <small>{reportRows.length}</small></button></div>
    </header>

    {tab === 'filters' ? <div className="reports-body">
      <aside className="filters-panel">
        <section><h3>Rango de fechas</h3><div className="date-grid"><label>Fecha inicial<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label>Fecha final<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label></div></section>
        <section><div className="section-heading"><h3>Nóminas</h3><button onClick={loadPayrolls}>Cargar nóminas</button></div><Checklist items={payrolls} selected={payrollCodes} onChange={setPayrollCodes} empty="Cargue las nóminas para comenzar" /></section>
        <section><div className="section-heading"><h3>Dependencias</h3><button onClick={loadDependencies}>Cargar dependencias</button></div><Checklist items={dependencies} selected={dependencyCodes} onChange={setDependencyCodes} empty="Seleccione una nómina y cargue dependencias" /></section>
      </aside>

      <section className="employees-panel">
        <div className="employee-toolbar"><div><h2>Empleados</h2><p>{employees.length} empleados encontrados</p></div><button className="button secondary" onClick={loadEmployees}>Cargar empleados</button></div>
        <label className="search-field"><span>Buscar por nombre, apellido o código</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Escriba para filtrar…" /></label>
        <div className="table-wrap">
          <table><thead><tr><th className="select-cell"><input type="checkbox" checked={allSelected} onChange={(e) => setSelectedEmployees(e.target.checked ? employees.map((row) => String(row.Codigo)) : [])} /></th>{employeeColumns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody>{employees.map((row, index) => { const code = String(row.Codigo); return <tr key={`${code}-${index}`}><td className="select-cell"><input type="checkbox" checked={selectedEmployees.includes(code)} onChange={(e) => setSelectedEmployees(e.target.checked ? [...selectedEmployees, code] : selectedEmployees.filter((value) => value !== code))}/></td>{employeeColumns.map((column) => <td key={column}>{String(row[column] ?? '')}</td>)}</tr>; })}</tbody></table>
          {!employees.length && <div className="table-empty"><ReportIcon /><p>No hay empleados cargados</p><span>Complete los filtros y seleccione “Cargar empleados”.</span></div>}
        </div>
        <div className="report-actions"><label><input type="checkbox" checked={includeExitTime} onChange={(e) => setIncludeExitTime(e.target.checked)} />Con hora de salida</label><button className="button primary" onClick={generate}>Generar reporte</button></div>
      </section>
    </div> : <section className="report-result">
      <div className="result-toolbar"><div><h2>Entrada/Salida de Empleados</h2><p>{reportRows.length} registros</p></div><button className="button primary" disabled={!reportRows.length} onClick={() => void run(async () => { const result = await window.kiosk.reports.exportPdf(reportRows); if (!result.canceled) setMessage('PDF exportado correctamente'); })}>Exportar PDF</button></div>
      <div className="table-wrap report-table"><table><thead><tr>{reportColumns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{reportRows.map((row, index) => <tr key={index}>{reportColumns.map((column) => <td key={column}>{String(row[column] ?? '')}</td>)}</tr>)}</tbody></table>{!reportRows.length && <div className="table-empty"><ReportIcon /><p>No hay datos en el reporte</p><span>Vuelva a filtros y genere un reporte.</span></div>}</div>
    </section>}
    {busy && <div className="busy-overlay"><span className="spinner"/><p>Consultando información…</p></div>}
    {message && <Alert title="Reportes" message={message} onClose={() => setMessage(null)} />}
  </main>;
}
