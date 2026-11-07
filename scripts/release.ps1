$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$cli = Join-Path $PWD 'tools/cli/astra-plugin-0.5.1-windows-x64/astra-plugin.exe'
if (!(Test-Path $cli)) { throw 'Official CLI missing. See README.md.' }
$env:PATH = "$PWD\tools\bun;$env:PATH"
function Assert-Exit { if ($LASTEXITCODE -ne 0) { throw "Command failed: $LASTEXITCODE" } }
npm.cmd run build
Assert-Exit
npm.cmd test
Assert-Exit
& $cli check . --strict
Assert-Exit
& $cli test . --no-build --report test/conformance.json
Assert-Exit
& $cli build . --target noarch --reproducible
Assert-Exit
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$bundle = "wallpaper-engine-$version-noarch.astraplugin"
& $cli verify $bundle
Assert-Exit
Get-FileHash $bundle -Algorithm SHA256
