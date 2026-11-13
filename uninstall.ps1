param([string]$AppRoot = "")

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

function Find-AppRoot {
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
      if ($_.Path) { $p = Split-Path -Parent $_.Path; if (Test-Path (Join-Path $p "server.js")) { return $p } }
    }
  } catch { }
  return ""
}

if (-not $AppRoot) { $AppRoot = Find-AppRoot }
if (-not $AppRoot -or -not (Test-Path (Join-Path $AppRoot "server.js"))) {
  Write-Host "WhaleGirl folder not found. Pass -AppRoot `"D:\WhaleGirl`"." -ForegroundColor Red
  exit 1
}
$AppRoot = (Resolve-Path $AppRoot).Path
Write-Host "Removing image patch from $AppRoot" -ForegroundColor Cyan

# 1) remove hook
$serverPath = Join-Path $AppRoot "server.js"
$backup = Join-Path $AppRoot "server.js.whale-image-patch.bak"
if (Test-Path $serverPath) {
  $lines = [System.IO.File]::ReadAllLines($serverPath)
  $kept = $lines | Where-Object { $_ -notmatch 'whale-image-patch' }
  [System.IO.File]::WriteAllText($serverPath, ($kept -join "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "  hook removed"
}
if (Test-Path $backup) {
  try { Copy-Item $backup $serverPath -Force; Remove-Item $backup -Force; Write-Host "  server.js backup restored" } catch { }
}

# 2) remove patch code (keep data / config for reinstall)
$dest = Join-Path $AppRoot "whale-image-patch"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force; Write-Host "  patch files removed" }

# 3) restore launcher
$launcher = Join-Path $AppRoot "WhaleLauncher.exe"
$launcherBackup = "$launcher.whale-image-patch.bak"
$marker = "$launcher.whale-image-patch.installed"
if (Test-Path $launcherBackup) {
  try {
    Copy-Item $launcherBackup $launcher -Force
    Remove-Item $launcherBackup -Force
    Write-Host "  launcher restored"
  } catch { Write-Host "  [WARN] could not restore launcher; copy back $launcherBackup manually" -ForegroundColor Yellow }
}
if (Test-Path $marker) { Remove-Item $marker -Force -ErrorAction SilentlyContinue }

# 4) restore base config if we changed it
$cfgBackup = Join-Path $AppRoot "config.json.whale-image-patch.bak"
if (Test-Path $cfgBackup) {
  try { Copy-Item $cfgBackup (Join-Path $AppRoot "config.json") -Force; Remove-Item $cfgBackup -Force; Write-Host "  config.json restored" } catch { }
}

# 5) shortcuts
$desktop = [Environment]::GetFolderPath("Desktop")
foreach ($name in @("鲸鲸图片补丁-安装或更新.lnk", "鲸鲸图片补丁-管理页.url")) {
  $p = Join-Path $desktop $name
  if (Test-Path $p) { Remove-Item $p -Force -ErrorAction SilentlyContinue }
}

Write-Host "Uninstalled. data/whale-image-patch.json and downloaded images are kept." -ForegroundColor Green
Write-Host "Fully exit and reopen WhaleGirl to unload the old launcher."
