# Kiosko Mobile

Réplica Android del kiosco Electron con Expo SDK 57 y React Native. No depende de `window.electronAPI`; todas las operaciones de RRHH, impresión, correo y firma pasan por `kiosko-api`.

## Funciones migradas

- Entrada/salida con lector físico, teclado o cámara.
- Sonidos nativos de bienvenida y despedida.
- Consulta de comprobantes por escáner de carnet, con reconocimiento facial opcional activado por RRHH.
- Vista responsive e impresión RAW ESC/POS directa por USB, con la impresión de Kiosko API como fallback.
- Captura frontal y actualización de fotografías.
- Reportes de asistencia y exportación PDF.
- URL y clave de API guardadas con SecureStore.
- PDF417 firmado con Ed25519, correo SMTP, caché/logs en SQLite cifrado con SQLCipher.
- Interfaz adaptable a portrait, landscape y tablet.

## Ejecutar

1. Inicie `kiosko-api` en una computadora visible desde la red Wi-Fi/LAN.
2. Ejecute `npm install`.
3. Ejecute `npm run android` o instale el APK generado en Android.
4. En Configuración indique `http://IP-DE-LA-PC:3000/api` y la clave de API.

SQLCipher y la integración SAT KT21LC requieren un APK propio: no funcionan en Expo Go.

### Actualizaciones obligatorias de Google Play

La app consulta Google Play al abrir, al volver al primer plano y cada cinco minutos mientras está activa. Al detectar una versión superior, reemplaza todas las pantallas operativas por un bloqueo de actualización. Cancelar el diálogo de Google Play no permite volver al kiosko. El requisito se conserva en Android entre reinicios y sin conexión, hasta instalar un `versionCode` igual o superior al detectado.

El usuario pulsa **Descargar actualización**, acepta el diálogo de Google Play y, al terminar, pulsa **Instalar y reiniciar**. El panel está también en **Configuración → Actualizaciones**; durante el bloqueo solo está disponible la sección de actualizaciones de Configuración. Si Play solo permite el flujo inmediato, Google Play gestiona directamente la instalación y el reinicio. La descarga se consulta cada tres segundos durante el bloqueo. **Abrir Google Play** ofrece una alternativa cuando falla la actualización integrada.

Sin una actualización previamente detectada, un error de conexión no bloquea el funcionamiento; no se interpreta como una versión nueva. La detección depende de la disponibilidad real para la cuenta, dispositivo y canal de distribución, no simplemente de subir un archivo a Play Console.

La integración nativa está en `plugins/play-update/PlayUpdatePackage.kt`. El plugin `plugins/withPlayUpdate.cjs` registra el módulo y la dependencia oficial al ejecutar Expo prebuild. Requiere recompilar el APK; Expo Go no incorpora este módulo.

Prueba de publicación:

1. Publicar una compilación con esta integración en un canal de pruebas de Google Play e instalarla desde Play con una cuenta autorizada.
2. Publicar otra compilación con un `versionCode` mayor, el mismo application ID y firma compatible. Mantener sincronizados `app.json` y `android/app/build.gradle` si se compila directamente con Gradle.
3. Comprobar detección al abrir y regresar a la app, cancelar la descarga y verificar el bloqueo, cerrar/reabrir sin conexión y comprobar que sigue bloqueada.
4. Descargar; verificar **Instalar y reiniciar** en el bloqueo y en su sección Configuración. Instalar y comprobar que el nuevo binario permite operar.
5. Verificar también pérdida de conexión y reintento, actualización desde Play y disponibilidad por canal/despliegue gradual.

La compilación instalada antes de incorporar este cambio no puede mostrar el bloqueo nuevo.

### AAB firmado para Google Play

Identificador: `com.sanmartin.kiosko`. La firma release usa la clave de carga local indicada en `.signing/upload.properties`; no usa la clave debug. La carpeta `.signing/` está excluida de Git. Conservar una copia segura de toda esa carpeta (clave privada y credenciales) para futuras publicaciones; subir a Play Console únicamente el AAB.

La clave se crea una sola vez para una aplicación nueva con `./scripts/create-upload-key.ps1`. No ejecutar para sustituir una clave ya registrada en Google Play. Para generar el AAB con esa misma clave:

```powershell
./scripts/build-aab.ps1
```

Requiere Node en PATH, JAVA_HOME y ANDROID_HOME. Si es necesario, pasar `-NodeDirectory 'ruta/al/directorio/de/node'`. El script copia el AAB firmado a `artifacts/` y verifica su firma. Mantener `version` y `android.versionCode` de `app.json` sincronizados con `versionName` y `versionCode` en `android/app/build.gradle`, aumentando el código en cada nueva carga. El plugin `withReleaseSigning.cjs` conserva la configuración de firma al regenerar Android con Expo prebuild.

### Seguridad de RRHH

En el acceso administrativo, ingrese a **Seguridad de RRHH** con las credenciales
autorizadas. Allí puede actualizar fotografías y activar **Reconocimiento facial
para comprobantes**. La opción se guarda en el dispositivo y comienza desactivada.
Desactivada, el empleado accede a las planillas escaneando un carnet válido, sin
exigir fotografía ni mostrar la entrada manual de códigos. Activada, después del
carnet se exige fotografía registrada y validación facial con prueba de vida.
Los cambios se aplican al abrir nuevamente Comprobante. Si la configuración no
puede leerse, la app bloquea el acceso hasta que se pueda cargar o corregir en RRHH.

### Desarrollo con ADB reverse

Con el kiosco conectado y autorizado en ADB, ejecute desde `kiosko-mobile`:

```powershell
npm start
```

El script instala el APK debug de `artifacts` si la app no está instalada (puede indicar otro con `KIOSKO_DEBUG_APK`). Una app release existente no se reemplaza automáticamente. Selecciona un puerto libre desde `8081`, aplica `adb reverse` para ese puerto y la API (`3000`), configura `debug_http_host` conservando las demás preferencias y abre el APK cuando Metro responde. Expo se inicia en modo development build. Puede fijar un puerto con `npm start -- --port 8083`; si está ocupado se informa el error sin cambiarlo. Inicie la API por separado y configure `http://127.0.0.1:3000/api` cuando use reverse.

Si hay varios dispositivos, seleccione el serial real antes de iniciar:

```powershell
$env:ANDROID_SERIAL = '192.168.101.227:5555'
npm start
```

Para ADB por red, conecte primero el equipo con `adb connect IP:5555`. ADB se busca en el SDK indicado por `ANDROID_HOME`/`ANDROID_SDK_ROOT`, en las ubicaciones habituales del SDK o en `PATH`. Si se pierde la conexión, vuelva a ejecutar `npm start`. El comando independiente `npm run android:reverse` usa los puertos predeterminados `8081` y `3000`.

En algunos Android antiguos, `reverse` por TCP/IP devuelve `more than one device/emulator` incluso con el serial seleccionado. Ante ese error, `npm start` inicia Metro por LAN y configura automáticamente la IP y el puerto en el APK mediante ADB. Para la API use la dirección mostrada en consola: `http://IP-DE-LA-PC:3000/api`. Ambos equipos deben compartir red y los puertos deben ser accesibles. `npm run start:lan` fuerza este modo y también requiere ADB para configurar y abrir la app. Para seleccionar la IP de la PC manualmente use `KIOSKO_DEV_HOST`. Para mantener `localhost` y reverse, conecte el kiosco por USB y seleccione su serial USB con `ANDROID_SERIAL`.

## Hardware SAT KT21LC

La fachada `KioskHardware` ofrece diagnóstico, scanner HID global, impresora USB ESC/POS, cámaras Camera2/Expo y NFC Android. En **Configuración > Diagnóstico de hardware** se muestran Android/API/ABI, USB VID/PID, interfaces/endpoints, cámaras y NFC. Desde allí se guarda la impresora detectada y se prueban todos los periféricos.

### Perfil físico verificado en el SAT RK3288

- Android 8.1/API 27, `armeabi-v7a`, pantalla física 1080×1920 vertical.
- Impresora Masung USB: VID `0x0519`, PID `0x2013`, clase Printer, Bulk OUT.
- Cámara USB Realtek: VID `0x0BDA`, PID `0x5842`; Android la publica como cámara frontal ID `0`.
- NFC ACS ACR1251: VID `0x072F`, PID `0x221A`, dos interfaces CCID Smart Card. Android no publica un `NfcAdapter`, por lo que requiere integración USB CCID para operar.
- El lector óptico integrado no aparece como HID USB. El firmware expone `/dev/ttyS1`, `/dev/ttyS3` y `/dev/ttyS4` con acceso para la app. Diagnóstico permite seleccionar y probar cada UART sin fijar un puerto no verificado.

Para evitar `more than one device/emulator`, utilice siempre el serial ADB real del kiosco:

```powershell
adb -s 192.168.101.227:5555 install -r android/app/build/outputs/apk/debug/app-debug.apk
adb -s 192.168.101.227:5555 shell am start -n com.sanmartin.kiosko/.MainActivity
```

Configuración local predeterminada:

```json
{
  "scanner": { "enabled": true, "mode": "auto", "suffix": "ENTER", "characterTimeoutMs": 80 },
  "printer": { "enabled": true, "mode": "auto", "vendorId": null, "productId": null, "paperWidth": 80, "encoding": "cp850", "timeoutMs": 5000 },
  "camera": { "enabled": true, "preferred": "front", "allowExternal": true },
  "nfc": { "enabled": true, "mode": "auto" }
}
```

`printer.mode=auto` intenta USB local y, ante cualquier fallo, conserva la impresión existente mediante `kiosko-api`. Los VID/PID nunca se inventan: se descubren y guardan desde diagnóstico.

La cámara UVC y el NFC USB quedan deliberadamente sin protocolo hasta confirmar que Android no los exponga como Camera2/NfcAdapter y obtener su identificación real. No ejecute `expo prebuild --clean`: el directorio Android contiene el módulo Kotlin propio y ahora forma parte del código fuente.

## Diagnóstico mediante ADB en el SAT

### Instalación autónoma (sin Metro)

El APK `debug` es para desarrollo. Para dejar el kiosco funcionando sin Metro, compile e instale `release`, que incluye `assets/index.android.bundle`:

```powershell
cd android
$env:NODE_ENV = 'production'
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=armeabi-v7a --max-workers=1 --no-daemon
adb -s 192.168.101.227:5555 install -r app/build/outputs/apk/release/app-release.apk
```

No desinstale la app: `install -r` conserva su configuración y datos. La firma release actual es de desarrollo; debe sustituirse por una llave privada para distribución definitiva. El arranque no necesita Metro, pero las consultas continúan requiriendo Kiosko API.

```powershell
adb devices -l
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
adb shell getprop ro.product.cpu.abilist
adb shell dumpsys usb
adb shell dumpsys media.camera
adb shell dumpsys nfc
adb logcat -s ReactNativeJS AndroidRuntime UsbHostManager
```

Build validado:

```powershell
npm run typecheck
npm test
cd android
.\gradlew.bat assembleDebug
```

### Comandos npm para nuevas publicaciones

- `npm run android:aab`: aumenta el versionCode en app.json y android/app/build.gradle y genera el AAB firmado en artifacts/.
- `npm run android:aab:retry`: compila con el mismo código, sin aumentarlo. Usar para reintentar una compilación fallida.
- `npm run android:version-code`: aumenta únicamente el código; después usar android:aab:retry para compilarlo.

La versión visible permanece igual. Si falla la compilación, el código incrementado se conserva. El comando rechaza versiones desincronizadas. No ejecutar dos compilaciones de publicación simultáneamente. La firma reutiliza la clave existente de .signing/.
