/// <reference types="vite/client" />

import type { KioskApi } from './shared/contracts';

declare global {
  interface Window {
    kiosk: KioskApi;
    faceapi: any;
  }
}

export {};
