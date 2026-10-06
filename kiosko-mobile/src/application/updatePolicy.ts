export interface UpdateStatus {
  required: boolean;
  available: boolean;
  downloaded: boolean;
  downloading: boolean;
  version?: string;
  versionCode?: number;
  error?: string;
}

// A failed or stale check must never unlock a detected update in this process.
// A newly installed binary starts a fresh process and native code compares version codes.
export function mergeUpdateStatus(previous: UpdateStatus, next: UpdateStatus): UpdateStatus {
  return { ...next, required: previous.required || next.required };
}
