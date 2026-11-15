param(
  [string]$AppRoot = "",
  [switch]$SkipLauncher,
  [switch]$CreateShortcuts,
  [switch]$NoShortcuts
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkg = [System.IO.File]::ReadAllText((Join-Path $here "package.json"), [System.Text.Encoding]::UTF8) | ConvertFrom-Json

function Info([string]$text) { Write-Host ("  " + $text) }
function Step([string]$text) { Write-Host ("`n== " + $text) -ForegroundColor Cyan }
function Fail([string]$text) { Write-Host ("[ERROR] " + $text) -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "WhaleGirl image-search patch installer" -ForegroundColor Cyan
Write-Host "  This is a PATCH, not a standalone app. Install WhaleGirl first:" -ForegroundColor Yellow
Write-Host "  https://github.com/Banan1cee/whale_girl"
Write-Host "  Compatible base: WhaleGirl 4.1.2"
Write-Host ""

function Find-AppRoot {
  foreach ($known in @('F:\deep seek girl\WhaleGirl','D:\WhaleGirl','E:\WhaleGirl','F:\WhaleGirl')) {
    if (Test-Path (Join-Path $known 'server.js')) { return $known }
  }
  $keys = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
  )
  foreach ($key in $keys) {
    try {
      Get-ItemProperty $key -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.DisplayName -match "Whale|鲸鲸" -and $_.InstallLocation) {
          $p = [string]$_.InstallLocation
          if (Test-Path (Join-Path $p "server.js")) { return $p }
        }
      }
    } catch { }
  }
  try {
    Get-Process WhaleLauncher -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_.Path) {
        $p = Split-Path -Parent $_.Path
        if (Test-Path (Join-Path $p "server.js")) { return $p }
      }
    }
  } catch { }
  $common = @(
    (Join-Path $env:LOCALAPPDATA "Programs\WhaleGirl"),
    (Join-Path $env:ProgramFiles "WhaleGirl"),
    "D:\WhaleGirl",
    "E:\WhaleGirl"
  )
  foreach ($p in $common) {
    if (Test-Path (Join-Path $p "server.js")) { return $p }
  }
  return ""
}

function Pick-AppRoot {
  try {
    Add-Type -AssemblyName System.Windows.Forms | Out-Null
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = "Select the WhaleGirl folder (contains server.js). Do NOT select this patch folder."
    $dialog.ShowNewFolderButton = $false
    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return "" }
    return $dialog.SelectedPath
  } catch { return "" }
}

function New-Shortcuts([int]$Port) {
  $created = @()
  try {
    $desktop = [Environment]::GetFolderPath("Desktop")
    if (-not $desktop -or -not (Test-Path $desktop)) { return $created }
    $shell = New-Object -ComObject WScript.Shell
    $installer = Join-Path $here "install.cmd"
    if (Test-Path $installer) {
      $lnkPath = Join-Path $desktop "鲸鲸图片补丁-安装或更新.lnk"
      $lnk = $shell.CreateShortcut($lnkPath)
      $lnk.TargetPath = $installer
      $lnk.WorkingDirectory = $here
      $lnk.Description = "安装/更新鲸鲸图片补丁（先装 WhaleGirl 本体）"
      $lnk.Save()
      $created += $lnkPath
    }
    $urlPath = Join-Path $desktop "鲸鲸图片补丁-管理页.url"
    $url = $shell.CreateShortcut($urlPath)
    $url.TargetPath = "http://127.0.0.1:$Port/image-patch/"
    $url.Save()
    $created += $urlPath
  } catch {
    Info "could not create shortcuts: $($_.Exception.Message)"
  }
  return $created
}

function Enable-StickerTransport([string]$root) {
  $configPath = Join-Path $root "config.json"
  if (-not (Test-Path $configPath)) { Info "config.json missing; skip sticker feature check"; return }
  try {
    $cfg = [System.IO.File]::ReadAllText($configPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
    if ($cfg.features -and $cfg.features.stickers -eq $true) { Info "sticker transport already enabled"; return }
    $backup = Join-Path $root "config.json.whale-image-patch.bak"
    if (-not (Test-Path $backup)) { Copy-Item $configPath $backup -Force }
    if (-not $cfg.features) {
      $cfg | Add-Member -NotePropertyName features -NotePropertyValue ([pscustomobject]@{}) -Force
    }
    $cfg.features | Add-Member -NotePropertyName stickers -NotePropertyValue $true -Force
    $json = $cfg | ConvertTo-Json -Depth 40
    [System.IO.File]::WriteAllText($configPath, $json, (New-Object System.Text.UTF8Encoding($false)))
    Info "enabled features.stickers (backup: config.json.whale-image-patch.bak)"
  } catch {
    Info "could not enable sticker transport: $($_.Exception.Message)"
  }
}

if (-not $AppRoot) { $AppRoot = Find-AppRoot }
if (-not $AppRoot) {
  Write-Host "WhaleGirl was not found automatically." -ForegroundColor Yellow
  Write-Host "In the next dialog, choose the folder that contains server.js."
  $AppRoot = Pick-AppRoot
}
if (-not $AppRoot -or -not (Test-Path (Join-Path $AppRoot "server.js"))) {
  Fail "No WhaleGirl folder selected. Install WhaleGirl first, then run this installer again."
}
$AppRoot = (Resolve-Path $AppRoot).Path
Info "target: $AppRoot"

$version = ""
try { $version = ([System.IO.File]::ReadAllText((Join-Path $AppRoot "package.json"), [System.Text.Encoding]::UTF8) | ConvertFrom-Json).version } catch { }
Info "base version: $version"
if ($version -and $version -ne "4.1.2") {
  Write-Host "  [WARN] This build is tested with WhaleGirl 4.1.2; continuing anyway." -ForegroundColor Yellow
}

Step "1/6 Check this patch package"
foreach ($name in @("patch", "launcher", "install.ps1")) {
  if (-not (Test-Path (Join-Path $here $name))) { Fail "package is incomplete: missing $name" }
}
Info "package OK"

Step "2/6 Copy patch files"
$dest = Join-Path $AppRoot "whale-image-patch"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
Copy-Item (Join-Path $here "patch") $dest -Recurse
Info "copied to $dest"

Step "3/6 Add server.js hook"
$serverPath = Join-Path $AppRoot "server.js"
$serverBackup = Join-Path $AppRoot "server.js.whale-image-patch.bak"
$hook = "require('./whale-image-patch').install();"
$server = [System.IO.File]::ReadAllText($serverPath)
if ($server -notmatch 'whale-image-patch') {
  if (-not (Test-Path $serverBackup)) { Copy-Item $serverPath $serverBackup -Force }
  $lines = $server -split "`r?`n"
  $first = $lines[0]
  $newLines = @($hook) + $lines
  [System.IO.File]::WriteAllText($serverPath, ($newLines -join "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
  Info "hook added (backup: server.js.whale-image-patch.bak)"
} else {
  Info "hook already present"
}

Step "4/6 Syntax check"
$node = Join-Path $AppRoot "runtime\node.exe"
if (-not (Test-Path $node)) { $node = "node" }
Push-Location $AppRoot
try {
  & $node --check "server.js"
  if ($LASTEXITCODE -ne 0) { Fail "server.js syntax check failed" }
  & $node --check "whale-image-patch\index.js"
  if ($LASTEXITCODE -ne 0) { Fail "patch syntax check failed" }
  Info "server.js and patch syntax OK"
} finally { Pop-Location }

Step "5/6 Enable image-sending transport"
Enable-StickerTransport $AppRoot
$port = "8787"
$portFile = Join-Path $AppRoot "data\server-port.txt"
if (Test-Path $portFile) {
  $raw = (Get-Content $portFile -Raw).Trim()
  if ($raw -match '^\d+$') { $port = $raw }
}

Step "6/6 Install launcher tab (optional)"
if (-not $SkipLauncher) {
  $launcherSrc = Join-Path $here "launcher\WhaleLauncher.exe"
  $launcherDst = Join-Path $AppRoot "WhaleLauncher.exe"
  $wanted = ""
  try { $wanted = (Get-Content (Join-Path $here "launcher\version.txt") -Raw).Trim() } catch { }
  if ((Test-Path $launcherSrc) -and $wanted -eq $version) {
    $marker = "$launcherDst.whale-image-patch.installed"
    $backup = "$launcherDst.whale-image-patch.bak"
    $oldMarker = ""
    if (Test-Path $marker) { $oldMarker = (Get-Content $marker -Raw).Trim() }
    if (-not $oldMarker -or $oldMarker -ne $wanted) {
      try { Copy-Item $launcherDst $backup -Force; Info "launcher backup: $backup" } catch { Info "launcher backup failed: $($_.Exception.Message)" }
    }
    $installed = $false
    try {
      Copy-Item $launcherSrc $launcherDst -Force
      $installed = $true
    } catch {
      try {
        $old = $launcherDst + ".old-" + [DateTime]::Now.ToString("yyyyMMddHHmmss")
        Move-Item $launcherDst $old -Force
        Copy-Item $launcherSrc $launcherDst -Force
        $installed = $true
        Info "old launcher renamed to $old"
      } catch { Info "launcher tab skipped: $($_.Exception.Message)" }
    }
    if ($installed) {
      try { Set-Content -Path $marker -Value $wanted -Encoding ASCII } catch { }
      Info "launcher tab installed (restart WhaleGirl to see it)"
    }
  } else {
    Info "launcher tab skipped: no build for base '$version' (wanted '$wanted')"
  }
} else {
  Info "launcher tab skipped (-SkipLauncher)"
}

if (-not $NoShortcuts -and -not $CreateShortcuts) {
  $answer = Read-Host "Create desktop shortcuts (install/update + management page)? [Y/n]"
  if ($answer -notmatch '^\s*[nN]') { $CreateShortcuts = $true }
}
if ($CreateShortcuts) {
  $made = New-Shortcuts -Port ([int]$port)
  if ($made.Count) { Info "desktop shortcuts:"; foreach ($m in $made) { Info "  $m" } }
} else {
  Info "desktop shortcuts skipped."
  Info "Update without a shortcut: download the latest ZIP from"
  Info "  https://github.com/7ather-LX/whale-girl-image-patch/releases/latest"
  Info "extract it, then double-click install.cmd."
}

Write-Host ""
Write-Host "Installed successfully." -ForegroundColor Green
Write-Host ""
Write-Host "  Last step: FULLY EXIT the WhaleGirl launcher (tray icon -> Exit), then open it again."
Write-Host "  Click Start, then the '图片' tab (or open http://127.0.0.1:$port/image-patch/)."
Write-Host "  Then try in a selected chat: @鲸鲸 来张美图 / 看看脚"
Write-Host ""
Write-Host "  Self-check: `"$node`" `"$AppRoot\whale-image-patch\cli.js`" doctor"
Write-Host "  Uninstall : double-click uninstall.cmd"
Write-Host ""
