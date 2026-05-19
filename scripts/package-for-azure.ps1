# Builds the app and creates deploy-package.zip for Azure App Service (Zip Deploy).
# Usage: .\scripts\package-for-azure.ps1
# Then: az webapp deployment source config-zip -g <resource-group> -n <app-name> --src deploy-package.zip

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host 'Installing dependencies...'
npm ci

Write-Host 'Building production bundle...'
npm run build

Write-Host 'Removing dev dependencies...'
npm prune --omit=dev

$outDir = Join-Path $root 'deploy-package'
if (Test-Path $outDir) {
  Remove-Item $outDir -Recurse -Force
}
New-Item -ItemType Directory -Path $outDir | Out-Null

$items = @('dist', 'package.json', 'package-lock.json', 'node_modules', '.node-version')
foreach ($item in $items) {
  $src = Join-Path $root $item
  if (-not (Test-Path $src)) {
    throw "Missing required path: $src"
  }
  Copy-Item $src (Join-Path $outDir $item) -Recurse
}

$zipPath = Join-Path $root 'deploy-package.zip'
if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}
Compress-Archive -Path (Join-Path $outDir '*') -DestinationPath $zipPath

Write-Host "Created $zipPath"
Write-Host 'Upload with Azure Portal (Advanced Tools → Zip Deploy) or:'
Write-Host "  az webapp deployment source config-zip -g <resource-group> -n <app-name> --src deploy-package.zip"
