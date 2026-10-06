# Kiosko API

API NestJS para `kiosko-mobile`, con SQL Server externo.

## Desarrollo

Use Node.js 22. Ejecute `npm ci` y `npm run start:dev`. Puede copiar
`config/kiosk.config.example.json` a `config/kiosk.config.json`; las variables
de entorno tienen prioridad. Para desarrollo local use `NODE_ENV=development`
y rutas locales para fotos, logs y claves.

La API escucha en `0.0.0.0:3000` bajo `/api`. Swagger está en `/api/docs`
cuando `SWAGGER_ENABLED` no es `false`. El cliente usa el encabezado `x-api-key`.
Los reportes requieren además HTTP Basic con la cuenta `RRHH`; los logs,
la cuenta `TI_ADMIN`. Publique siempre con HTTPS.

## Despliegue en Coolify

1. Suba estos cambios al repositorio y conecte la rama en una aplicación de Coolify.
2. Configure:

   | Campo | Valor |
   | --- | --- |
   | Build Pack | Dockerfile |
   | Base Directory | `/kiosko-api` |
   | Dockerfile Location | `/Dockerfile` |
   | Ports Exposes | `3000` |
   | Dominio | Su dominio HTTPS para la API |

   No necesita comandos personalizados de build/start ni publicar el puerto 3000
   directamente en el host. El Dockerfile arranca `node dist/main.js` como usuario
   `node` (UID/GID 1000), con dependencias de producción y los assets faciales.
3. Agregue las variables de `.env.example` como variables de **runtime** en Coolify.
   Sustituya todos los valores `CAMBIAR_*`. La API rechaza el arranque en producción
   si faltan la clave API o las credenciales/host/nombre de SQL Server.
   Configure las cuentas administrativas si usará reportes o logs. Configure SMTP
   si necesita correos. Mantenga `SWAGGER_ENABLED=false` salvo que necesite documentación.
   No agregue secretos como build arguments. Desactive **Build Variable** para
   las variables de runtime, especialmente las claves y contraseñas.
   La etapa de compilación usa `npm ci --include=dev` para disponer del CLI de
   NestJS incluso si el entorno de construcción recibe `NODE_ENV=production`.
4. En Persistent Storage agregue un volumen con destino **`/app/data`**.
   Conserva fotos, logs y claves Ed25519. Si usa un bind mount, prepare previamente
   la carpeta del servidor con permisos de escritura para **1000:1000**.
   Haga copias de seguridad del volumen y mantenga una sola réplica: las sesiones
   de fotografías se guardan en memoria y las claves se generan al primer uso.
5. Asegure conectividad desde el servidor Coolify hacia SQL Server en el puerto
   configurado (normalmente 1433), mediante red privada/VPN si corresponde.
   Use la base existente con sus tablas y procedimientos; este proyecto no los crea.
   `localhost` apuntaría al propio contenedor. Los valores TLS del ejemplo requieren
   un certificado válido de SQL Server; adáptelos a la configuración de su servidor.
6. Despliegue. El Dockerfile incluye health check `GET /api/health` sin autenticación.
   Debe responder `200` con `{"ok":true,"service":"kiosko-api"}`. Este endpoint
   comprueba el proceso HTTP, no SQL. Verifique después
   `GET /api/app/configuration-status` con `x-api-key`: debe devolver `ready: true`.
7. Configure la aplicación cliente con el dominio público y la misma clave API.
   Compruebe consulta de empleados, fotografías y las funciones que vaya a utilizar.

Referencia: [despliegue con Dockerfile en Coolify](https://coolify.io/docs/applications/builds/dockerfile).

### Migración desde Windows

- Las rutas UNC (`\\servidor\carpeta`) no funcionan como rutas locales en Linux.
  Copie las fotos existentes a `/app/data/photos`, o monte el recurso SMB en el
  host Linux y use un bind mount hacia ese directorio. La API necesita escritura
  para guardar fotografías. Prepare el montaje y sus permisos antes del despliegue.
- Copie **ambos** archivos de firma existentes desde `config/` a `/app/data/keys/`
  conservando sus nombres si debe mantener la identidad de firma actual. Si no
  existen, se genera un par al crear la primera transferencia. No elimine el volumen
  entre despliegues ni almacene estas claves en Git.
- La impresión RAW por `powershell.exe` y el spooler Windows **no funciona en Coolify/Linux**.
  El endpoint de impresión seguirá sin estar disponible en ese entorno. Si necesita
  esa función, requiere un servicio de impresión en Windows o una integración de
  impresión de red adicional. Desplegar la API no da acceso a la impresora USB local.

## Verificación local

```sh
npm ci
npm run typecheck
npm test
npm run test:deploy
```

`test:deploy` compila y arranca el proceso de producción en un puerto temporal,
con credenciales ficticias, sin usar SQL Server. Comprueba health, protección por
API key, assets faciales, Swagger desactivado y validación de variables obligatorias.

Para probar la imagen, desde la raíz del repositorio:

```sh
docker build -t kiosko-api:local ./kiosko-api
docker run --rm --name kiosko-api-local --env-file ./kiosko-api/.env -p 3000:3000 -v kiosko-api-data:/app/data kiosko-api:local
```

Prepare antes `kiosko-api/.env` a partir del ejemplo con valores reales. No se copia
al contexto Docker. Para producción fuera de Docker: `npm run build` y
`npm run start:prod` (configure rutas persistentes adecuadas al host).
