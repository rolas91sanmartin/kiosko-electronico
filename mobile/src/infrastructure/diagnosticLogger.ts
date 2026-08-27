const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function safeDetails(details: Record<string, unknown>) {
  return Object.entries(details).reduce<Record<string, string | number | boolean | null>>((result, [key, value]) => {
    if (typeof value === 'string') result[key] = value.slice(0, 160);
    else if (typeof value === 'number' || typeof value === 'boolean' || value === null) result[key] = value;
    else result[key] = String(value).slice(0, 160);
    return result;
  }, {});
}

export function diagnostic(scope: string, event: string, details: Record<string, unknown> = {}) {
  console.info(`KIOSK_DIAG ${sessionId} ${scope}.${event} ${JSON.stringify(safeDetails(details))}`);
}

diagnostic('APP', 'javascript_session_started');
