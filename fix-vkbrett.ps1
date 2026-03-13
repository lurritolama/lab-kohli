Add-Type -AssemblyName System.Drawing

$src = 'C:\Users\lurri\Desktop\Lab Kohli\VK-Brett.jpg'
$img = [System.Drawing.Image]::FromFile($src)
Write-Host "Original: $($img.Width)x$($img.Height)"

# Rotate 90 degrees clockwise (photo was taken sideways)
$img.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone)
Write-Host "After rotate: $($img.Width)x$($img.Height)"

$rotated = New-Object System.Drawing.Bitmap($img)
$img.Dispose()

# Rotated image is now 2146x1353
# Crop top 60% to focus on the product (distribution boxes)
$cropW = $rotated.Width
$cropH = $rotated.Height
$startY = [int]($cropH * 0.08)
$endY = [int]($cropH * 0.68)
$newH = $endY - $startY

$cropRect = New-Object System.Drawing.Rectangle(0, $startY, $cropW, $newH)
$cropped = $rotated.Clone($cropRect, $rotated.PixelFormat)
$rotated.Dispose()

Write-Host "Cropped: $($cropped.Width)x$($cropped.Height)"

# Scale down to 800px wide
$maxW = 800
$scale = $maxW / $cropped.Width
$newW = $maxW
$newH2 = [int]($cropped.Height * $scale)

$final = New-Object System.Drawing.Bitmap($newW, $newH2)
$g = [System.Drawing.Graphics]::FromImage($final)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($cropped, 0, 0, $newW, $newH2)
$g.Dispose()
$cropped.Dispose()

Write-Host "Final: $($final.Width)x$($final.Height)"

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 85L)
$outPath = 'C:\Users\lurri\Desktop\Lab Kohli\VK-Brett-fixed.jpg'
$final.Save($outPath, $jpegCodec, $encoderParams)
$final.Dispose()
Write-Host "Saved to VK-Brett-fixed.jpg"
