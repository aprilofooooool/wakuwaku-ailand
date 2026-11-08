param(
  [string]$Src = 'assets-src/characters',
  [string]$Dst = 'assets/characters',
  [int]$Size = 512
)
# Shrinks every PNG under $Src into $Dst (same relative path), keeping aspect ratio and transparency.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not [System.IO.Path]::IsPathRooted($Src)) { $Src = Join-Path $root $Src }
if (-not [System.IO.Path]::IsPathRooted($Dst)) { $Dst = Join-Path $root $Dst }
if (-not (Test-Path $Src)) { Write-Host "source not found: $Src"; exit 1 }
$Src = (Resolve-Path $Src).Path

$count = 0
$total = 0
foreach ($file in Get-ChildItem -Path $Src -Filter *.png -Recurse) {
  $relative = $file.FullName.Substring($Src.Length).TrimStart('\')
  $out = Join-Path $Dst $relative
  $outDir = Split-Path $out -Parent
  if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

  $img = [System.Drawing.Image]::FromFile($file.FullName)
  $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $scale = [Math]::Min($Size / $img.Width, $Size / $img.Height)
    $w = [int][Math]::Round($img.Width * $scale)
    $h = [int][Math]::Round($img.Height * $scale)
    $x = [int][Math]::Floor(($Size - $w) / 2)
    $y = [int][Math]::Floor(($Size - $h) / 2)
    # ImageAttributes with WrapModeTileFlipXY avoids a faint edge halo from bicubic sampling.
    $attr = New-Object System.Drawing.Imaging.ImageAttributes
    $attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
    $g.DrawImage($img, (New-Object System.Drawing.Rectangle($x, $y, $w, $h)), 0, 0, $img.Width, $img.Height, [System.Drawing.GraphicsUnit]::Pixel, $attr)
    $attr.Dispose()
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $g.Dispose(); $bmp.Dispose(); $img.Dispose()
  }
  $count++
  $total += (Get-Item $out).Length
}
Write-Host "resized $count file(s), total $total bytes -> $Dst"
exit 0
