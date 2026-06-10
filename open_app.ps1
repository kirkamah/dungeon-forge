param([string]$Browser = '')

$url = 'http://localhost:5173'

for ($i = 0; $i -lt 60; $i++) {
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1
        if ($r.StatusCode -eq 200) { break }
    } catch { }
    Start-Sleep -Milliseconds 500
}

if ($Browser -and (Test-Path $Browser)) {
    $userData = Join-Path $env:LOCALAPPDATA 'DungeonForgeChrome'
    Start-Process -FilePath $Browser -ArgumentList @(
        "--app=$url",
        '--window-size=1400,900',
        "--user-data-dir=$userData",
        '--no-first-run',
        '--no-default-browser-check'
    )
} else {
    Start-Process $url
}
