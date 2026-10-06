const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

async function main() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'kiosko-deploy-'));
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  const env = {
    ...process.env, NODE_ENV: 'production', PORT: String(port), SWAGGER_ENABLED: 'false',
    KIOSK_CONFIG_FILE: path.join(temporary, 'absent.json'),
    KIOSK_LOG_FILE: path.join(temporary, 'requests.jsonl'),
    KIOSK_API_KEY: 'smoke-test-key', KIOSK_DB_SERVER: '127.0.0.1',
    KIOSK_DB_NAME: 'smoke', KIOSK_DB_USER: 'smoke', KIOSK_DB_PASSWORD: 'smoke',
  };
  let output = '';
  const child = spawn(process.execPath, ['dist/main.js'], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const closed = once(child, 'close');
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const base = `http://127.0.0.1:${port}/api`;
  try {
    let healthy = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(output);
      try {
        const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(500) });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true, service: 'kiosko-api' });
        healthy = true;
        break;
      } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.ok(healthy, `API did not start: ${output}`);
    assert.equal((await fetch(`${base}/app/configuration-status`)).status, 401);
    const engine = await fetch(`${base}/face/engine`, { headers: { 'x-api-key': env.KIOSK_API_KEY } });
    assert.equal(engine.status, 200);
    assert.match(await engine.text(), /html/i);
    assert.equal((await fetch(`${base}/face-assets/models/tiny_face_detector_model-weights_manifest.json`)).status, 200);
    assert.equal((await fetch(`${base}/docs`)).status, 404);
  } finally {
    child.kill('SIGTERM');
    await closed;
    await fs.rm(temporary, { recursive: true, force: true });
  }
  const invalid = spawn(process.execPath, ['dist/main.js'], {
    env: { ...env, KIOSK_API_KEY: 'CAMBIAR_API_KEY' }, windowsHide: true, stdio: 'pipe',
  });
  let errorOutput = '';
  invalid.stdout.resume();
  invalid.stderr.on('data', chunk => { errorOutput += chunk; });
  const timeout = setTimeout(() => invalid.kill(), 10000);
  const [code] = await once(invalid, 'close');
  clearTimeout(timeout);
  assert.notEqual(code, 0);
  assert.match(errorOutput, /Configure las variables de producción: KIOSK_API_KEY/);
  console.log('Deploy smoke test passed. SQL Server and physical printing are not exercised.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
