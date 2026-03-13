# Convert fixed image to base64
$imgPath = 'C:\Users\lurri\Desktop\Lab Kohli\VK-Brett-fixed.jpg'
$bytes = [System.IO.File]::ReadAllBytes($imgPath)
$b64 = [Convert]::ToBase64String($bytes)
$dataUri = "data:image/jpeg;base64,$b64"

Write-Host "Base64 length: $($b64.Length)"

# Read the HTML file
$htmlPath = 'C:\Users\lurri\Desktop\Lab Kohli\index.html'
$html = [System.IO.File]::ReadAllText($htmlPath, [System.Text.Encoding]::UTF8)

# Find the current image src for product 1 (VK-Brett) - starts with data:image/jpeg;base64,
# The products array has image: "data:image/jpeg;base64,..."
# We need to find and replace just the base64 data inside the first image: "..." in products

# Find start of first image data URI in products array
$marker = 'img: "data:image/jpeg;base64,'
$startIdx = $html.IndexOf($marker)
if ($startIdx -lt 0) {
    Write-Host "ERROR: Could not find image marker in HTML"
    exit 1
}

Write-Host "Found image marker at index: $startIdx"

# Find the closing quote of the image value
$dataUriStart = $startIdx + 'img: "'.Length
$closeQuote = $html.IndexOf('"', $dataUriStart)
if ($closeQuote -lt 0) {
    Write-Host "ERROR: Could not find closing quote"
    exit 1
}

Write-Host "Data URI start: $dataUriStart, closing quote: $closeQuote"
Write-Host "Old data length: $($closeQuote - $dataUriStart)"

# Replace the old data URI with the new one
$before = $html.Substring(0, $dataUriStart)
$after = $html.Substring($closeQuote)
$newHtml = $before + $dataUri + $after

Write-Host "New HTML length: $($newHtml.Length)"

[System.IO.File]::WriteAllText($htmlPath, $newHtml, [System.Text.Encoding]::UTF8)
Write-Host "Done! HTML updated."
