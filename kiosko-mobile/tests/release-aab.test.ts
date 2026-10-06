import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const { updateVersionCode } = createRequire(import.meta.url)('../scripts/release-aab.cjs');

function fixture(t: { after(fn: () => void): void }, code = 1, nativeCode = code) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kiosko-release-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'android/app'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'app.json'), JSON.stringify({ expo: { version: '1.0.0', android: { versionCode: code } } }));
  fs.writeFileSync(path.join(directory, 'android/app/build.gradle'), `android {\r\n defaultConfig {\r\n  versionCode ${nativeCode}\r\n  versionName "1.0.0"\r\n }\r\n}\r\n`);
  return directory;
}
test('release increments both version codes and keeps versionName', t => {
  const directory = fixture(t);
  assert.equal(updateVersionCode(directory), 2);
  const config = JSON.parse(fs.readFileSync(path.join(directory, 'app.json'), 'utf8'));
  assert.equal(config.expo.android.versionCode, 2);
  assert.equal(config.expo.version, '1.0.0');
  assert.match(fs.readFileSync(path.join(directory, 'android/app/build.gradle'), 'utf8'), /versionCode 2\r\n/);
  assert.equal(updateVersionCode(directory), 3);
});
test('retry preserves version code and files', t => {
  const directory = fixture(t, 9);
  const original = fs.readFileSync(path.join(directory, 'app.json'), 'utf8');
  assert.equal(updateVersionCode(directory, false), 9);
  assert.equal(fs.readFileSync(path.join(directory, 'app.json'), 'utf8'), original);
});
test('mismatch refuses to change either version', t => {
  const directory = fixture(t, 3, 7);
  assert.throws(() => updateVersionCode(directory), /no coinciden/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'app.json'), 'utf8')).expo.android.versionCode, 3);
});
test('version code cannot exceed Play limit', t => {
  assert.throws(() => updateVersionCode(fixture(t, 2100000000)), /límite/);
});
