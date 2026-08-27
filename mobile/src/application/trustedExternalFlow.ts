import { diagnostic } from '../infrastructure/diagnosticLogger';

let scannerActive = false;

export function setTrustedScannerActive(active: boolean) {
  scannerActive = active;
  diagnostic('SECURITY', 'trusted_scanner_changed', { active });
}

export function isTrustedScannerActive() {
  return scannerActive;
}
