$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path $PSScriptRoot -Parent
$signingDirectory = Join-Path $projectDirectory '.signing'
$keystore = Join-Path $signingDirectory 'kiosko-upload.jks'
$properties = Join-Path $signingDirectory 'upload.properties'
if ((Test-Path -LiteralPath $keystore) -or (Test-Path -LiteralPath $properties)) {
    throw 'Signing files already exist. Reuse or configure the existing key; this script never overwrites it.'
}
$keytool = Join-Path $env:JAVA_HOME 'bin/keytool.exe'
if (!(Test-Path -LiteralPath $keytool)) { throw 'Set JAVA_HOME to a JDK with keytool.' }
New-Item -ItemType Directory -Path $signingDirectory -Force | Out-Null
$randomBytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($randomBytes)
$rng.Dispose()
$secret = [Convert]::ToBase64String($randomBytes)
$env:KIOSKO_UPLOAD_PASSWORD = $secret
try {
    & $keytool -genkeypair -noprompt -storetype JKS -keystore $keystore -alias kiosko-upload -keyalg RSA -keysize 3072 -sigalg SHA256withRSA -validity 10000 -dname 'CN=Kiosko Upload, OU=Mobile, O=Carnes San Martin, C=GT' -storepass:env KIOSKO_UPLOAD_PASSWORD -keypass:env KIOSKO_UPLOAD_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw 'Upload key creation failed.' }
    $content = "storeFile=.signing/kiosko-upload.jks`nstorePassword=$secret`nkeyAlias=kiosko-upload`nkeyPassword=$secret`n"
    [System.IO.File]::WriteAllText($properties, $content, [System.Text.UTF8Encoding]::new($false))
    & $keytool -exportcert -rfc -keystore $keystore -alias kiosko-upload -storepass:env KIOSKO_UPLOAD_PASSWORD -file (Join-Path $signingDirectory 'upload-certificate.pem')
    if ($LASTEXITCODE -ne 0) { throw 'Certificate export failed.' }
    Write-Output 'Upload key and local credentials created in .signing. Back up this directory securely.'
} finally {
    Remove-Item Env:KIOSKO_UPLOAD_PASSWORD -ErrorAction SilentlyContinue
    $secret = $null
    $content = $null
}
