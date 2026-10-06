const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const executable = process.platform === 'win32' ? 'adb.exe' : 'adb';
const sdkRoots = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
  process.env.HOME && join(process.env.HOME, 'Library', 'Android', 'sdk'),
  process.env.HOME && join(process.env.HOME, 'Android', 'Sdk'),
].filter(Boolean);
const adb = sdkRoots.map((root) => join(root, 'platform-tools', executable)).find(existsSync) || executable;

function run(args, options = {}) {
  const result = spawnSync(adb, args, { encoding: 'utf8', windowsHide: true, timeout: 120000, ...options });
  if (result.error) {
    throw new Error(`No se pudo ejecutar ADB. Instale Android SDK Platform-Tools y configure ANDROID_HOME o PATH. ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `ADB terminó con código ${result.status}.`);
  }
  return result.stdout;
}

function selectDevice() {
  const devices = run(['devices']).split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter(([, state]) => state === 'device')
    .map(([serial]) => serial);
  const serial = process.env.ANDROID_SERIAL || (devices.length === 1 ? devices[0] : undefined);
  if (!serial) {
    throw new Error(devices.length
      ? `Hay varios dispositivos: ${devices.join(', ')}. Configure ANDROID_SERIAL con el serial del kiosco.`
      : 'No hay dispositivos ADB disponibles. Conecte el kiosco y autorice la depuración USB; para conexión por red ejecute adb connect IP:5555.');
  }
  if (!devices.includes(serial)) {
    throw new Error(`El dispositivo ${serial} no está conectado o autorizado en ADB.`);
  }
  return serial;
}

function configureReverse(serial = selectDevice(), metroPort = 8081) {
  for (const port of [metroPort, 3000]) {
    try {
      run(['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);
    } catch (error) {
      if (serial.includes(':') && /more than one device\/emulator/i.test(error.message)) {
        error.code = 'REVERSE_OVER_TCP_UNSUPPORTED';
        error.message = `ADB seleccionó ${serial}, pero Android rechazó reverse por TCP/IP: ${error.message}`;
      }
      throw error;
    }
    console.log(`${serial}: reverse tcp:${port} → tcp:${port}`);
  }
}

module.exports = { configureReverse, selectDevice, run };

if (require.main === module) {
  try {
    configureReverse();
  } catch (error) {
    console.error(error.message);
    if (error.code === 'REVERSE_OVER_TCP_UNSUPPORTED') {
      console.error('Conecte por USB para usar reverse o ejecute npm run start:lan para conectar por red.');
    }
    process.exitCode = 1;
  }
}
