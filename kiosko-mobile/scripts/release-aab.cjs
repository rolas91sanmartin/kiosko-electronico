const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function updateVersionCode(projectDirectory, bump = true) {
  const appPath = path.join(projectDirectory, 'app.json');
  const gradlePath = path.join(projectDirectory, 'android/app/build.gradle');
  const appText = fs.readFileSync(appPath, 'utf8');
  const gradleText = fs.readFileSync(gradlePath, 'utf8');
  const app = JSON.parse(appText);
  const matches = [...gradleText.matchAll(/^(\s*versionCode\s+)(\d+)(\s*(?:\/\/[^\r\n]*)?)$/gm)];
  const code = app.expo?.android?.versionCode;
  if (!Number.isInteger(code) || code < 1 || code > 2100000000 || matches.length !== 1) {
    throw new Error('No se pudo determinar un versionCode válido en app.json y build.gradle.');
  }
  if (Number(matches[0][2]) !== code) {
    throw new Error('Los versionCode de app.json y build.gradle no coinciden. Corríjalos antes de compilar.');
  }
  const versionName = gradleText.match(/^\s*versionName\s+["']([^"']+)["']/m)?.[1];
  if (versionName !== app.expo.version) throw new Error('expo.version y versionName no coinciden.');
  if (!bump) return code;
  if (code === 2100000000) throw new Error('Se alcanzó el límite de versionCode de Google Play.');
  const next = code + 1;
  app.expo.android.versionCode = next;
  const newline = appText.includes('\r\n') ? '\r\n' : '\n';
  const nextApp = JSON.stringify(app, null, 2).replace(/\n/g, newline) + newline;
  const nextGradle = gradleText.replace(/^(\s*versionCode\s+)\d+(\s*(?:\/\/[^\r\n]*)?)$/m, (_, prefix, suffix) => `${prefix}${next}${suffix}`);
  fs.writeFileSync(appPath, nextApp);
  try { fs.writeFileSync(gradlePath, nextGradle); }
  catch (error) { fs.writeFileSync(appPath, appText); throw error; }
  return next;
}

function main(args) {
  if (args.some(arg => !['--no-bump', '--bump-only'].includes(arg)) || (args.includes('--no-bump') && args.includes('--bump-only'))) {
    throw new Error('Use android:aab, android:aab:retry o android:version-code.');
  }
  const projectDirectory = path.resolve(__dirname, '..');
  const bumpOnly = args.includes('--bump-only');
  if (!bumpOnly) {
    if (process.platform !== 'win32') throw new Error('La compilación firmada actual requiere Windows y PowerShell.');
    if (!fs.existsSync(path.join(projectDirectory, '.signing/upload.properties'))) throw new Error('Falta configurar .signing/upload.properties.');
    if (!process.env.JAVA_HOME || !fs.existsSync(path.join(process.env.JAVA_HOME, 'bin/jarsigner.exe'))) throw new Error('Configure JAVA_HOME con un JDK.');
  }
  const code = updateVersionCode(projectDirectory, !args.includes('--no-bump'));
  console.log(`versionCode: ${code} (app.json y build.gradle sincronizados)`);
  if (bumpOnly) return;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'build-aab.ps1'), '-NodeDirectory', path.dirname(process.execPath)], {
    cwd: projectDirectory, stdio: 'inherit', windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    console.error('No se completó el AAB. Se conserva el versionCode; reintente con npm run android:aab:retry.');
    if (result.error) console.error(result.error.message);
    process.exitCode = result.status || 1;
  }
}

module.exports = { updateVersionCode };
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
