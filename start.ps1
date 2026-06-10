$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$Host.UI.RawUI.WindowTitle = 'Dungeon Forge'

function Pause-OnExit {
    Write-Host ''
    Write-Host 'Press Enter to close...' -ForegroundColor DarkGray
    try { Read-Host | Out-Null } catch { }
}

Write-Host ''
Write-Host '  Dungeon Forge' -ForegroundColor Yellow
Write-Host '  --------------' -ForegroundColor DarkYellow
Write-Host ''

# --- Find a Chromium browser ---
$candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

# --- Window geometry: centred on primary monitor's working area ---
$winW = 1400
$winH = 900
$posX = 100
$posY = 60
try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    $wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    if ($wa.Width  -lt $winW) { $winW = $wa.Width  - 40 }
    if ($wa.Height -lt $winH) { $winH = $wa.Height - 40 }
    $posX = [int]($wa.X + ($wa.Width  - $winW) / 2)
    $posY = [int]($wa.Y + ($wa.Height - $winH) / 2)
} catch { }

function Open-AppWindow {
    param($url, $browser, $winW, $winH, $posX, $posY)
    if ($browser -and (Test-Path $browser)) {
        $userData = Join-Path $env:LOCALAPPDATA 'DungeonForgeChrome'
        Start-Process -FilePath $browser -ArgumentList @(
            "--app=$url",
            "--window-size=$winW,$winH",
            "--window-position=$posX,$posY",
            "--user-data-dir=$userData",
            '--no-first-run',
            '--no-default-browser-check'
        ) | Out-Null
    } else {
        Start-Process $url | Out-Null
    }
}

$url = 'http://127.0.0.1:5173/'

# --- Fast path: server already up, just open a window and exit ---
try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1
    if ($r.StatusCode -eq 200) {
        Write-Host '  Server already running, opening a new window...' -ForegroundColor Green
        Open-AppWindow $url $browser $winW $winH $posX $posY
        Write-Host ''
        Write-Host '  This launcher window can be closed; the running server stays up.' -ForegroundColor DarkGray
        Pause-OnExit
        exit 0
    }
} catch { }

# --- Verify npm ---
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) { $npm = Get-Command npm -ErrorAction SilentlyContinue }
if (-not $npm) {
    Write-Host 'ERROR: npm not found on PATH. Install Node.js from https://nodejs.org' -ForegroundColor Red
    Pause-OnExit
    exit 1
}
Write-Host "  npm     : $($npm.Source)" -ForegroundColor DarkGray
if ($browser) {
    Write-Host "  browser : $browser" -ForegroundColor DarkGray
} else {
    Write-Host '  browser : (none found, will use default browser)' -ForegroundColor Yellow
}
Write-Host ''

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
    Write-Host 'Installing dependencies (first run)...' -ForegroundColor Yellow
    & $npm.Source install
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'npm install failed.' -ForegroundColor Red
        Pause-OnExit
        exit 1
    }
}

# --- Job Object: when this powershell process dies (window closed, Ctrl+C, etc.),
#     the kernel kills every process in the job. Prevents orphaned node/vite/npm. ---
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
public static class DFJob {
    [StructLayout(LayoutKind.Sequential)] public struct BLI {
        public long PerProcessUserTimeLimit; public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize; public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit; public long Affinity;
        public uint PriorityClass; public uint SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)] public struct IOC {
        public ulong A; public ulong B; public ulong C; public ulong D; public ulong E; public ulong F;
    }
    [StructLayout(LayoutKind.Sequential)] public struct ELI {
        public BLI BasicLimitInformation; public IOC IoInfo;
        public UIntPtr ProcessMemoryLimit; public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed; public UIntPtr PeakJobMemoryUsed;
    }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern IntPtr CreateJobObject(IntPtr a, string lpName);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool SetInformationJobObject(IntPtr h, int c, IntPtr i, uint s);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool AssignProcessToJobObject(IntPtr job, IntPtr proc);
    public static IntPtr Create() {
        IntPtr h = CreateJobObject(IntPtr.Zero, null);
        if (h == IntPtr.Zero) throw new System.ComponentModel.Win32Exception();
        var ext = new ELI();
        ext.BasicLimitInformation.LimitFlags = 0x2000; // KILL_ON_JOB_CLOSE
        int s = Marshal.SizeOf(ext);
        IntPtr p = Marshal.AllocHGlobal(s);
        try {
            Marshal.StructureToPtr(ext, p, false);
            if (!SetInformationJobObject(h, 9, p, (uint)s))
                throw new System.ComponentModel.Win32Exception();
        } finally { Marshal.FreeHGlobal(p); }
        return h;
    }
    public static bool Assign(IntPtr job, int pid) {
        var proc = Process.GetProcessById(pid);
        return AssignProcessToJobObject(job, proc.Handle);
    }
}
'@ -ErrorAction SilentlyContinue

$job = $null
try { $job = [DFJob]::Create() } catch {
    Write-Host "Warning: could not create Job Object ($($_.Exception.Message))." -ForegroundColor Yellow
    Write-Host '  Child processes may need to be killed manually on close.' -ForegroundColor Yellow
}

# --- Background opener: waits for the server, opens app window ---
Start-Job -Name 'DFOpener' -ScriptBlock {
    param($u, $b, $w, $h, $px, $py)
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 1
            if ($r.StatusCode -eq 200) { break }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    if ($b -and (Test-Path $b)) {
        $userData = Join-Path $env:LOCALAPPDATA 'DungeonForgeChrome'
        Start-Process -FilePath $b -ArgumentList @(
            "--app=$u",
            "--window-size=$w,$h",
            "--window-position=$px,$py",
            "--user-data-dir=$userData",
            '--no-first-run',
            '--no-default-browser-check'
        )
    } else {
        Start-Process $u
    }
} -ArgumentList $url, $browser, $winW, $winH, $posX, $posY | Out-Null

Write-Host '  Starting Vite dev server...' -ForegroundColor DarkGray
Write-Host '  Keep THIS window open while you use Dungeon Forge.'
Write-Host '  Close it to stop the server.' -ForegroundColor DarkGray
Write-Host ''

# --- Spawn npm in the same console; assign to job so children die with us ---
$proc = $null
try {
    $proc = Start-Process -FilePath $npm.Source -ArgumentList @('run', 'dev') -NoNewWindow -PassThru
    if ($job -and $proc) {
        try { [DFJob]::Assign($job, $proc.Id) | Out-Null } catch { }
    }
    if ($proc) { $proc.WaitForExit() }
} catch {
    Write-Host "Server error: $($_.Exception.Message)" -ForegroundColor Red
}

Get-Job -Name 'DFOpener' -ErrorAction SilentlyContinue | Remove-Job -Force -ErrorAction SilentlyContinue

# Best-effort: also kill the subtree explicitly in case the job didn't catch it
if ($proc -and -not $proc.HasExited) {
    try { & taskkill /F /T /PID $proc.Id 2>&1 | Out-Null } catch { }
}

Pause-OnExit
