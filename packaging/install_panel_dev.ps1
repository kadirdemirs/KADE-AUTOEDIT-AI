# Panel'i UDT olmadan Premiere'e KALICI kurar (gelistirici modu gerektirir).
# Plugin'i %APPDATA%\Adobe\UXP\Plugins\External\<id>_<version> altina kopyalar;
# Premiere her acildiginda Window > UXP Plugins menusunde hazir gelir.
#
# Kullanim:  powershell -ExecutionPolicy Bypass -File packaging\install_panel_dev.ps1
# Once panel derlenmis olmali:  cd panel && npm run build

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "panel\dist"

if (-not (Test-Path (Join-Path $src "manifest.json"))) {
    Write-Error "panel\dist\manifest.json yok. Once 'cd panel; npm run build' calistirin."
    exit 1
}

# manifest'ten id ve version oku
$manifest = Get-Content (Join-Path $src "manifest.json") -Raw | ConvertFrom-Json
$folderName = "$($manifest.id)_$($manifest.version)"
$dest = Join-Path $env:APPDATA "Adobe\UXP\Plugins\External\$folderName"

New-Item -ItemType Directory -Force -Path $dest | Out-Null
Get-ChildItem $dest -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "$src\*" -Destination $dest -Recurse -Force

Write-Output "=========================================="
Write-Output " Panel kuruldu (kalici):"
Write-Output "   $dest"
Write-Output ""
Write-Output " Premiere'i KAPAT-AC, sonra:"
Write-Output "   Window > UXP Plugins > KADE AutoEdit"
Write-Output ""
Write-Output " NOT: Premiere'de Developer Mode acik olmali"
Write-Output "   (Edit > Preferences > Plug-ins > Enable Developer Mode)"
Write-Output "=========================================="
