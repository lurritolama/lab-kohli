$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://+:8765/')
$listener.Start()
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' } | Select-Object -First 1).IPAddress
Write-Host "Server running at http://localhost:8765/"
Write-Host "Im WLAN erreichbar unter: http://${localIP}:8765/"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $path = $request.Url.LocalPath.TrimStart('/')
    if ($path -eq '' -or $path -eq '/') { $path = 'index.html' }
    $filePath = Join-Path 'C:\Users\lurri\Desktop\Lab Kohli' $path
    if (Test-Path $filePath) {
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentLength64 = $bytes.Length
        if ($filePath -match '\.html$') { $response.ContentType = 'text/html; charset=utf-8' }
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $response.StatusCode = 404
    }
    $response.Close()
}
