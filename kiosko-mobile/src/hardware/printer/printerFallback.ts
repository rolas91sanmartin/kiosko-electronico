export async function withPrinterFallback<T>(mode: 'local' | 'api' | 'auto', local: () => Promise<T>, api: () => Promise<T>) {
  if (mode === 'api') return api();
  try { return await local(); } catch (error) { if (mode === 'local') throw error; return api(); }
}
