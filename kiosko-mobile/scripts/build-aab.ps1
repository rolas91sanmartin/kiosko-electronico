param([string]$NodeDirectory)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path $PSScriptRoot -Parent
if (!(Test-Path -LiteralPath (Join-Path $projectDirectory '.signing/upload.properties'))) {
    throw 'Configure .signing/upload.properties first. For a new app only, run scripts/create-upload-key.ps1.'
}
$previousPath = $env:PATH
$previousNodeEnv = $env:NODE_ENV
try {
    if ($NodeDirectory) { $env:PATH = "$NodeDirectory;$env:PATH" }
    $env:NODE_ENV = 'production'
    Push-Location (Join-Path $projectDirectory 'android')
    try {
        & .\gradlew.bat :app:bundleRelease --console=plain
        if ($LASTEXITCODE -ne 0) { throw 'AAB build failed.' }
    } finally { Pop-Location }
    $appConfig = Get-Content -LiteralPath (Join-Path $projectDirectory 'app.json') -Raw | ConvertFrom-Json
    $artifactDirectory = Join-Path $projectDirectory 'artifacts'
    New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
    $destination = Join-Path $artifactDirectory "kiosko-mobile-$($appConfig.expo.version)-$($appConfig.expo.android.versionCode)-signed.aab"
    Copy-Item -LiteralPath (Join-Path $projectDirectory 'android/app/build/outputs/bundle/release/app-release.aab') -Destination $destination
    $verification = & (Join-Path $env:JAVA_HOME 'bin/jarsigner.exe') '-J-Duser.language=en' -verify $destination 2>&1
    if ($LASTEXITCODE -ne 0 -or ($verification -join "`n") -notmatch 'jar verified\.') { throw 'AAB signature verification failed.' }
    Write-Output "Signed AAB: $destination"
    Get-FileHash -LiteralPath $destination -Algorithm SHA256
} finally {
    $env:PATH = $previousPath
    $env:NODE_ENV = $previousNodeEnv
}
