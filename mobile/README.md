# Mis Comprobantes San Martín

Aplicación Expo/React Native totalmente offline para recibir sobres de pago desde el kiosco de escritorio mediante PDF417.

## Flujo

1. La aplicación exige reconocimiento facial configurado en el teléfono.
2. En **Escanear**, la cámara lee el PDF417 generado por Electron.
3. Se valida la versión y la huella SHA-256 para detectar errores de lectura o datos dañados.
4. El sobre se guarda en SQLite; escanearlo nuevamente actualiza el registro sin duplicarlo.
5. En **Sobres**, se muestra la lista por rango de fecha y consecutivo. Al tocar una fila se abre el comprobante completo.

No consume endpoints. La autenticación protege el acceso local con la biometría del dispositivo; no compara el rostro con la fotografía laboral del empleado y no guarda imágenes de la cámara.

El escáner ofrece tres estrategias: lector nativo optimizado de Google/Apple, análisis continuo de cámara y análisis de una captura en resolución completa. Esto mejora la compatibilidad con cámaras económicas y deja un respaldo para dispositivos sin el lector nativo.

La huella incluida comprueba integridad accidental, pero no es una firma digital de la empresa. Si se requiere impedir comprobantes fabricados por terceros, el siguiente paso es firmarlos en Electron con una clave privada y verificar esa firma en el móvil con una clave pública.

## Desarrollo

- `npm start`: iniciar Expo.
- `npm run android`: abrir en Android.
- `npm run ios`: abrir en iOS desde macOS.
- `npx tsc --noEmit`: validar TypeScript.

Para probar Face ID en iOS se necesita un development build; Expo Go no admite Face ID. El equipo debe tener autenticación facial fuerte registrada. En Android, el soporte depende del nivel biométrico del fabricante.
