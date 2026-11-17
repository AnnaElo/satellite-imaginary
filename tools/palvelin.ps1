# Pieni paikallinen www-palvelin ilman asennuksia (Windows PowerShell).
param([int]$Port = 8000)
$root = Split-Path -Parent $PSScriptRoot
$types = @{ ".html"="text/html; charset=utf-8"; ".js"="text/javascript"; ".css"="text/css"; ".json"="application/json";
  ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".png"="image/png"; ".svg"="image/svg+xml"; ".xml"="application/xml";
  ".wasm"="application/wasm"; ".glb"="model/gltf-binary"; ".ktx2"="image/ktx2"; ".txt"="text/plain" }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "Esitys osoitteessa http://localhost:$Port  (sulje ikkuna lopettaaksesi)"
while ($l.IsListening) {
  $c = $l.GetContext()
  $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath).TrimStart('/')
  if ($p -eq "") { $p = "index.html" }
  $f = [IO.Path]::GetFullPath((Join-Path $root $p))
  if ($f.StartsWith($root) -and (Test-Path $f -PathType Leaf)) {
    $ext = [IO.Path]::GetExtension($f).ToLower()
    $c.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { "application/octet-stream" })
    $b = [IO.File]::ReadAllBytes($f)
    $c.Response.ContentLength64 = $b.Length
    $c.Response.OutputStream.Write($b, 0, $b.Length)
  } else { $c.Response.StatusCode = 404 }
  $c.Response.Close()
}
