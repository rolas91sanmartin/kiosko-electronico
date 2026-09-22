# Kiosko API

API NestJS para la aplicación `kiosko-mobile`. Conserva las llamadas SQL Server del proyecto Electron.

## Configuración

1. Copie `config/kiosk.config.example.json` como `config/kiosk.config.json` y configure SQL Server, fotos, impresora, API y SMTP. También puede usar `.env`; las variables de entorno tienen prioridad.
2. Ejecute `npm install`.
3. Ejecute `npm run start:dev` durante desarrollo o `npm run build && npm start` en producción.

La API escucha en `0.0.0.0:3000` y publica sus rutas bajo `/api`. El teléfono debe poder alcanzar la computadora por la red local; no use `localhost` en el teléfono.

## Swagger

Con la API ejecutándose, abra `http://localhost:3000/api/docs`. Use el botón **Authorize** para establecer el encabezado `x-api-key` cuando `KIOSK_API_KEY` esté configurada. Puede desactivar la documentación con `SWAGGER_ENABLED=false`.

## Acceso administrativo

Los endpoints de reportes requieren el rol `RRHH` y los logs requieren `TI_ADMIN`. Configure las cuentas en la sección `auth` de `config/kiosk.config.json` o mediante `KIOSK_RRHH_USER`, `KIOSK_RRHH_PASSWORD`, `KIOSK_TI_ADMIN_USER` y `KIOSK_TI_ADMIN_PASSWORD`. Las solicitudes usan HTTP Basic junto con `x-api-key`; en producción la API debe publicarse detrás de HTTPS porque Basic no cifra las credenciales.
