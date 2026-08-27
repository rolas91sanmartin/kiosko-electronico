export function formatSqlDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Ocurrió un error inesperado.';
}

export function todayIso(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts();
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
