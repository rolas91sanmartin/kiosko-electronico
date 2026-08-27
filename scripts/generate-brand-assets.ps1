param(
  [string]$WorkspaceRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $WorkspaceRoot 'branding\carnes-san-martin-symbol.png'
$source = [System.Drawing.Bitmap]::FromFile($sourcePath)

function New-Canvas([int]$size, [System.Drawing.Color]$background) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bitmap.SetResolution(144, 144)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear($background)
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Save-Png($bitmap, [string]$path) {
  $directory = Split-Path -Parent $path
  [System.IO.Directory]::CreateDirectory($directory) | Out-Null
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function New-SquareIcon([string]$path, [int]$size, [double]$logoRatio, [bool]$transparent) {
  $background = if ($transparent) { [System.Drawing.Color]::Transparent } else { [System.Drawing.Color]::White }
  $canvas = New-Canvas $size $background
  $logoSize = [int][Math]::Round($size * $logoRatio)
  $offset = [int][Math]::Round(($size - $logoSize) / 2)
  $canvas.Graphics.DrawImage($source, $offset, $offset, $logoSize, $logoSize)
  $canvas.Graphics.Dispose()
  Save-Png $canvas.Bitmap $path
  $canvas.Bitmap.Dispose()
}

function New-RoundIcon([string]$path, [int]$size) {
  $canvas = New-Canvas $size ([System.Drawing.Color]::Transparent)
  $canvas.Graphics.FillEllipse([System.Drawing.Brushes]::White, 0, 0, $size - 1, $size - 1)
  $logoSize = [int][Math]::Round($size * .84)
  $offset = [int][Math]::Round(($size - $logoSize) / 2)
  $canvas.Graphics.DrawImage($source, $offset, $offset, $logoSize, $logoSize)
  $canvas.Graphics.Dispose()
  Save-Png $canvas.Bitmap $path
  $canvas.Bitmap.Dispose()
}

function New-SolidIcon([string]$path, [int]$size, [System.Drawing.Color]$color) {
  $canvas = New-Canvas $size $color
  $canvas.Graphics.Dispose()
  Save-Png $canvas.Bitmap $path
  $canvas.Bitmap.Dispose()
}

# Shared UI mark and desktop/web assets.
Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $WorkspaceRoot 'desktop\public\brand-symbol.png') -Force
Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $WorkspaceRoot 'mobile\assets\brand-symbol.png') -Force
New-SquareIcon (Join-Path $WorkspaceRoot 'desktop\build\icon.png') 1024 .90 $false
New-SquareIcon (Join-Path $WorkspaceRoot 'desktop\public\app-icon.png') 512 .90 $false
New-SquareIcon (Join-Path $WorkspaceRoot 'mobile\assets\icon.png') 1024 .90 $false
New-SquareIcon (Join-Path $WorkspaceRoot 'mobile\assets\ios-icon.png') 1024 .90 $false
New-SquareIcon (Join-Path $WorkspaceRoot 'mobile\assets\favicon.png') 192 .90 $false
New-SquareIcon (Join-Path $WorkspaceRoot 'mobile\assets\splash-icon.png') 512 .72 $true

# Android adaptive icon source layers. The smaller foreground stays inside the safe zone.
New-SquareIcon (Join-Path $WorkspaceRoot 'mobile\assets\android-icon-foreground.png') 1024 .72 $true
New-SquareIcon (Join-Path $WorkspaceRoot 'mobile\assets\android-icon-monochrome.png') 1024 .72 $true
New-SolidIcon (Join-Path $WorkspaceRoot 'mobile\assets\android-icon-background.png') 1024 ([System.Drawing.Color]::White)

# Existing native Android project resources, so local Gradle builds receive the same brand.
$densities = @{
  'mdpi' = 48
  'hdpi' = 72
  'xhdpi' = 96
  'xxhdpi' = 144
  'xxxhdpi' = 192
}
foreach ($density in $densities.Keys) {
  $legacySize = $densities[$density]
  $adaptiveSize = [int][Math]::Round($legacySize * 2.25)
  $directory = Join-Path $WorkspaceRoot "mobile\android\app\src\main\res\mipmap-$density"
  New-SquareIcon (Join-Path $directory 'ic_launcher.png') $legacySize .90 $false
  New-RoundIcon (Join-Path $directory 'ic_launcher_round.png') $legacySize
  New-SquareIcon (Join-Path $directory 'ic_launcher_foreground.png') $adaptiveSize .72 $true
  New-SquareIcon (Join-Path $directory 'ic_launcher_monochrome.png') $adaptiveSize .72 $true
  New-SolidIcon (Join-Path $directory 'ic_launcher_background.png') $adaptiveSize ([System.Drawing.Color]::White)
}

$splashSizes = @{
  'mdpi' = 288
  'hdpi' = 432
  'xhdpi' = 576
  'xxhdpi' = 864
  'xxxhdpi' = 1152
}
foreach ($density in $splashSizes.Keys) {
  $directory = Join-Path $WorkspaceRoot "mobile\android\app\src\main\res\drawable-$density"
  New-SquareIcon (Join-Path $directory 'splashscreen_logo.png') $splashSizes[$density] .72 $true
}

$source.Dispose()
