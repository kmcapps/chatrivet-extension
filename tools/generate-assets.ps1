Add-Type -AssemblyName System.Drawing

function New-RoundedPath {
  param([float] $X, [float] $Y, [float] $Width, [float] $Height, [float] $Radius)

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-ChatRivetMark {
  param($Graphics, [float] $X, [float] $Y, [float] $Size)

  $scale = $Size / 128
  $navy = [System.Drawing.Color]::FromArgb(255, 10, 28, 53)
  $bubble = [System.Drawing.Color]::FromArgb(255, 234, 247, 255)
  $rivet = [System.Drawing.Color]::FromArgb(255, 67, 215, 201)
  $bar = [System.Drawing.Color]::FromArgb(255, 114, 145, 174)

  $panelPath = New-RoundedPath ($X + 16 * $scale) ($Y + 16 * $scale) (96 * $scale) (96 * $scale) (24 * $scale)
  $Graphics.FillPath((New-Object System.Drawing.SolidBrush $navy), $panelPath)

  $bubblePath = New-RoundedPath ($X + 31 * $scale) ($Y + 38 * $scale) (64 * $scale) (45 * $scale) (14 * $scale)
  $Graphics.FillPath((New-Object System.Drawing.SolidBrush $bubble), $bubblePath)
  $tail = [System.Drawing.PointF[]] @(
    (New-Object System.Drawing.PointF ($X + 47 * $scale), ($Y + 78 * $scale)),
    (New-Object System.Drawing.PointF ($X + 44 * $scale), ($Y + 93 * $scale)),
    (New-Object System.Drawing.PointF ($X + 61 * $scale), ($Y + 81 * $scale))
  )
  $Graphics.FillPolygon((New-Object System.Drawing.SolidBrush $bubble), $tail)

  $Graphics.FillEllipse((New-Object System.Drawing.SolidBrush $rivet), $X + 75 * $scale, $Y + 68 * $scale, 23 * $scale, 23 * $scale)
  $Graphics.FillEllipse((New-Object System.Drawing.SolidBrush $navy), $X + 81 * $scale, $Y + 74 * $scale, 11 * $scale, 11 * $scale)

  $barHeight = [Math]::Max(2 * $scale, 1)
  foreach ($spec in @(@(43, 49, 31), @(43, 58, 24), @(43, 67, 17))) {
    $barPath = New-RoundedPath ($X + $spec[0] * $scale) ($Y + $spec[1] * $scale) ($spec[2] * $scale) $barHeight ($barHeight / 2)
    $Graphics.FillPath((New-Object System.Drawing.SolidBrush $bar), $barPath)
  }
}

function Save-Icon {
  param([string] $Path, [int] $Size)

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)
  Draw-ChatRivetMark $graphics 0 0 $Size
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

$root = Split-Path -Parent $PSScriptRoot
$icons = Join-Path $root 'icons'
$storeAssets = Join-Path $root 'store-assets'
New-Item -ItemType Directory -Force -Path $icons, $storeAssets | Out-Null

foreach ($size in 16, 32, 48, 128) {
  Save-Icon (Join-Path $icons ("icon-{0}.png" -f $size)) $size
}

$promoPath = Join-Path $storeAssets 'chatrivet-small-promo-440x280.png'
$promo = New-Object System.Drawing.Bitmap 440, 280
$graphics = [System.Drawing.Graphics]::FromImage($promo)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$background = New-Object System.Drawing.Drawing2D.LinearGradientBrush ([System.Drawing.Rectangle]::new(0, 0, 440, 280)), ([System.Drawing.Color]::FromArgb(255, 7, 22, 43)), ([System.Drawing.Color]::FromArgb(255, 20, 49, 80)), 0
$graphics.FillRectangle($background, 0, 0, 440, 280)
$graphics.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(35, 67, 215, 201))), 5, 20, 250, 250)
Draw-ChatRivetMark $graphics 36 64 152
$font = New-Object System.Drawing.Font 'Segoe UI', 33, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$graphics.DrawString('ChatRivet', $font, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 242, 248, 255))), (New-Object System.Drawing.PointF 204, 119))
$promo.Save($promoPath, [System.Drawing.Imaging.ImageFormat]::Png)
$font.Dispose()
$graphics.Dispose()
$promo.Dispose()
