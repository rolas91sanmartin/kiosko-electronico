const { spawn } = require('node:child_process');
const { dirname, join, resolve } = require('node:path');
const { existsSync } = require('node:fs');
const net = require('node:net');
const dgram = require('node:dgram');
const { configureReverse, selectDevice, run } = require('./android-reverse.cjs');
const appId = 'com.sanmartin.kiosko';
const project = resolve(__dirname, '..');

async function choosePort(requested) {
  for (let port = requested || 8081; port < (requested ? requested + 1 : 8181); port++) {
    let free = true;
    for (const host of [undefined, 'localhost', '127.0.0.1']) {
      const available = await new Promise((done, reject) => {
      const server = net.createServer();
      server.once('error', (error) => error.code === 'EADDRINUSE' ? done(false) : reject(error));
      server.listen({ port, host, exclusive: true }, () => server.close(() => done(true)));
      });
      if (!available) { free = false; break; }
    }
    if (free) return port;
  }
  throw new Error('No hay puerto disponible. Cierre el Metro anterior o use npm start -- --port PUERTO.');
}

async function lanAddress(serial) {
  if (process.env.KIOSKO_DEV_HOST) {
    if (!net.isIPv4(process.env.KIOSKO_DEV_HOST)) throw new Error('KIOSKO_DEV_HOST debe ser la IPv4 de esta PC.');
    return process.env.KIOSKO_DEV_HOST;
  }
  const deviceIp = serial.split(':')[0];
  if (!net.isIPv4(deviceIp)) throw new Error('Configure KIOSKO_DEV_HOST con la IPv4 de esta PC para usar LAN.');
  return new Promise((done, reject) => {
    const socket = dgram.createSocket('udp4');
    socket.once('error', (error) => { socket.close(); reject(error); });
    socket.connect(5555, deviceIp, () => {
      const address = socket.address().address;
      socket.close();
      done(address);
    });
  });
}

function setDevHost(serial, address) {
  if (!/^[\d.]+:\d+$/.test(address)) throw new Error('Direccion de Metro no valida.');
  run(['-s', serial, 'shell', 'am', 'force-stop', appId]);
  const file = `shared_prefs/${appId}_preferences.xml`;
  let xml = run(['-s', serial, 'shell', `run-as ${appId} sh -c 'if [ -f ${file} ]; then cat ${file}; else printf "<map></map>"; fi'`]);
  xml = xml.replace(/<map\s*\/>/, '<map></map>');
  if (!/<map(?:\s|>)/.test(xml) || !xml.includes('</map>')) throw new Error('Preferencias Android no validas; no se modificaron.');
  xml = xml.replace(/<string\s+name=["']debug_http_host["'][^>]*>[\s\S]*?<\/string>\s*/g, '');
  xml = xml.replace('</map>', `<string name="debug_http_host">${address}</string>\n</map>`);
  run(['-s', serial, 'shell', `run-as ${appId} sh -c 'mkdir -p shared_prefs && if [ -f ${file} ]; then cp ${file} ${file}.codex.bak; fi && cat > ${file}.tmp && mv ${file}.tmp ${file}'`], { input: xml });
}

async function main() {
  const args = process.argv.slice(2);
  let requested;
  let forceLan = false;
  const extra = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port') {
      requested = Number(args[++i]);
      if (!Number.isInteger(requested) || requested < 1 || requested > 65535) throw new Error('Puerto no valido.');
    } else if (args[i] === '--lan') forceLan = true;
    else if (args[i] === '--clear') extra.push('--clear');
    else throw new Error(`Opcion no soportada: ${args[i]}. Use --port, --lan o --clear.`);
  }
  const serial = selectDevice();
  console.log(`Kiosco seleccionado: ${serial}`);
  if (!run(['-s', serial, 'shell', 'pm', 'list', 'packages', appId]).split(/\r?\n/).includes(`package:${appId}`)) {
    const abi = run(['-s', serial, 'shell', 'getprop', 'ro.product.cpu.abilist']).trim();
    const apk = process.env.KIOSKO_DEBUG_APK || join(project, 'artifacts',
      abi.split(',').includes('armeabi-v7a') ? 'kiosko-mobile-sat-uart-debug.apk' : 'kiosko-mobile-debug-universal.apk');
    if (!existsSync(apk)) throw new Error('Falta el APK de desarrollo. Ejecute npm run android o configure KIOSKO_DEBUG_APK.');
    console.log(`Instalando APK de desarrollo: ${apk}`);
    const output = run(['-s', serial, 'install', '-r', apk]);
    if (!output.includes('Success')) throw new Error(`No se pudo instalar el APK: ${output}`);
  }
  try { run(['-s', serial, 'shell', 'run-as', appId, 'id']); }
  catch { throw new Error('El APK instalado no permite depuracion. Instale un APK debug con npm run android; no desinstale la app para conservar sus datos.'); }
  const port = await choosePort(requested);
  let useLan = forceLan;
  if (!useLan) {
    try { configureReverse(serial, port); }
    catch (error) {
      if (error.code !== 'REVERSE_OVER_TCP_UNSUPPORTED') throw error;
      console.warn(error.message);
      useLan = true;
    }
  }
  const address = useLan ? await lanAddress(serial) : '127.0.0.1';
  setDevHost(serial, `${address}:${port}`);
  console.log(`Metro: ${address}:${port}. Abriendo el APK cuando Metro este listo.`);
  if (useLan) console.log(`API por LAN: http://${address}:3000/api (inicie kiosko-api por separado).`);
  const cli = join(dirname(require.resolve('expo/package.json')), 'bin', 'cli');
  const child = spawn(process.execPath, [cli, 'start', '--dev-client', useLan ? '--lan' : '--localhost', '--port', String(port), ...extra], {
    cwd: project, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    env: { ...process.env, CI: 'false', ANDROID_SERIAL: serial, REACT_NATIVE_PACKAGER_HOSTNAME: address },
  });
  // Pipe output to avoid interactive port changes while keeping Metro file watching enabled.
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  let exited = false;
  let failed = false;
  child.once('exit', (code) => { exited = true; process.exitCode = failed ? 1 : code ?? 1; });
  child.once('error', (error) => { exited = true; console.error(error.message); process.exitCode = 1; });
  const stop = () => child.kill();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    const deadline = Date.now() + 120000;
    while (!exited && Date.now() < deadline) {
      let ready = false;
      try {
        const response = await fetch(`http://127.0.0.1:${port}/status`, { signal: AbortSignal.timeout(1000) });
        ready = (await response.text()).trim() === 'packager-status:running';
      } catch {}
      if (ready) {
        const output = run(['-s', serial, 'shell', 'am', 'start', '-W', '-n', `${appId}/.MainActivity`]);
        if (/Error:|Exception/i.test(output)) throw new Error(output);
        console.log(`Kiosko abierto en ${serial}.`);
        return;
      }
      await new Promise((done) => setTimeout(done, 500));
    }
    if (!exited) throw new Error('Metro no respondio en 120 segundos.');
  } catch (error) {
    failed = true;
    child.kill();
    throw error;
  }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { choosePort, lanAddress, setDevHost };
