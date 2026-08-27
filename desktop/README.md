# Kiosko Electronico

Réplica del sistema `Control_Empleados` construida con Electron, Vite, React y TypeScript. Conserva el flujo original de lectura de código, búsqueda de empleado, fotografía, detección automática de entrada/salida, sonido, confirmación y reportes PDF. También incorpora autenticación para comprobantes de pago mediante código de barras y comparación facial local.

## Configuración

1. Copie `config/kiosk.config.example.json` como `config/kiosk.config.json`.
2. Complete la contraseña y, si aplica, cambie servidor, PC o directorio de fotografías.
3. Instale dependencias con `npm install`.
4. Inicie desarrollo con `npm run dev`.

Para producción también puede colocar `kiosk.config.json` junto al ejecutable instalado. Las variables `KIOSK_DB_*`, `KIOSK_PC_ID`, `KIOSK_PHOTO_DIRECTORY` y `KIOSK_TIMEZONE` tienen prioridad como valores predeterminados.

## Comandos

- `npm run dev`: Vite + Electron con recarga.
- `npm run typecheck`: validación TypeScript.
- `npm test`: pruebas.
- `npm run build`: compilación.
- `npm run dist`: instalador NSIS para Windows.

El acceso a reportes está disponible desde el botón superior o con `Ctrl+Shift+R`.

## Autenticación de comprobantes

El botón **Comprobante de pago** valida primero al empleado mediante `sp_Entrada_Salida` con el filtro `EMPLEADO`. Después compara localmente la fotografía registrada con la cámara y ejecuta una prueba de vida rápida: girar la cabeza hacia un lado y regresar al centro. Requiere una cámara disponible y una fotografía frontal reconocible. Las imágenes de la cámara no se guardan ni se envían a servicios externos.

`faceMatchThreshold` controla la distancia máxima aceptada (un valor menor es más estricto) y `faceRequiredMatches` la cantidad de coincidencias consecutivas. La prueba de vida dificulta el uso de una fotografía estática, pero no sustituye una solución certificada contra videos, máscaras o deepfakes sofisticados.

## Registro de fotografías

**Tomar o actualizar foto** exige autenticación por carnet, abre la cámara y permite confirmar la captura. La imagen se guarda como `{codigo}.JPG` dentro de `kiosk.photoDirectory`, y `Empleados.foto` se actualiza con ese nombre de archivo. Si ya existe una imagen, se reemplaza. El guardado conserva una copia temporal y restaura el archivo anterior si la actualización de RRHH falla.

## Comprobantes de pago

Después de validar carnet, rostro y una prueba de vida rápida mediante giro de cabeza, el kiosco consulta `Estadisticas` con la opción 4 y muestra dos planillas por página (rango de fecha y consecutivo). La planilla elegida se envía a `SobreDevDedDet` con nómina 1, el empleado autenticado y `onlyOneEmploye = 1`; el resultado se presenta como sobre de pago con ingresos, deducciones, saldo e ingreso neto.

Al seleccionar una planilla aparecen **Imprimir**, **Ver comprobante** y **Enviar por correo**. La impresión consulta nuevamente el sobre y lo envía sin diálogo a la Epson TM-U220IIB configurada en `kiosk.receiptPrinterName`; si la cola cambia de nombre, se busca una única coincidencia mediante `kiosk.receiptPrinterModel`. El ticket usa rollo de 76 mm y un área imprimible de 63.4 mm. El envío por correo queda visible y deshabilitado hasta configurar el servicio de correo.

La opción **Escanear sobre** consulta el comprobante y genera un PDF417 con el empleado, rango, consecutivo, ingresos, deducciones, saldo y días laborados. El contenido usa el formato versionado `SM1`, compresión local y una huella SHA-256 para detectar lecturas incompletas o datos dañados. La app móvil hermana lo almacena en SQLite sin consumir endpoints.

## Estructura

- `electron/application`: casos de uso del proceso principal.
- `electron/infrastructure`: SQL Server y recursos del sistema operativo.
- `src/application`: utilidades de aplicación del renderer.
- `src/presentation`: pantallas y componentes React.
- `src/shared`: contratos tipados del puente IPC.

El renderer está aislado (`contextIsolation`, `sandbox`, sin `nodeIntegration`) y todas las consultas usan parámetros del driver SQL Server.
