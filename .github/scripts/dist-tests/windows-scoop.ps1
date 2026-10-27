# Installs the locally built zip through Scoop using the manifest taken live
# from borisovodov/bucket (`main`) and verifies the install location, the exe
# display metadata, the Start Menu shortcut (name, target, icon), the
# materialized association .reg templates, the registry registration after
# `reg import` (the opt-in step the manifest tells users to run), the doru://
# URL scheme (registry registration after first launch plus a warm and a
# cold-start link open through ShellExecute), a real launch, and the
# first-run files.
#
# Discrepancies with a real user install, decided case by case:
# - only the x64 manifest variant is exercised (no arm64 Windows runners);
# - the artifact is served from a local HTTP server (it is not published);
# - the bucket is cloned from the local checkout instead of GitHub.
$ErrorActionPreference = 'Stop'

$workspace = $env:GITHUB_WORKSPACE
$bucketDir = Join-Path $workspace 'external/bucket'
$manifest = Join-Path $bucketDir 'bucket/doru.json'
# Only the x64 variant is exercised (no arm64 Windows runners); pick its zip
# explicitly — the alphabetical first match would be the arm64 artifact.
$zip = Get-ChildItem (Join-Path $workspace 'apps/desktop/release') -Filter 'doru-windows-x64.zip' | Select-Object -First 1
$port = 8475
$scoopRoot = Join-Path $env:USERPROFILE 'scoop'
$appDir = Join-Path $scoopRoot 'apps/doru/current'

function Fail([string]$message) {
    Write-Host "::error::$message"
    exit 1
}

Write-Host '::group::Prepare the manifest with the test artifact'
$hash = (Get-FileHash -Algorithm SHA256 $zip.FullName).Hash.ToLowerInvariant()
$m = Get-Content $manifest -Raw | ConvertFrom-Json
$m.version = $env:TEST_VERSION
$m.architecture.'64bit'.url = "http://127.0.0.1:$port/$($zip.Name)"
$m.architecture.'64bit'.hash = $hash
$m | ConvertTo-Json -Depth 10 | Set-Content $manifest -Encoding utf8
Write-Host "version: $($m.version)"
Write-Host "url: $($m.architecture.'64bit'.url)"
Write-Host "hash: $($m.architecture.'64bit'.hash)"
Write-Host '::endgroup::'

Write-Host '::group::Serve the artifact'
Start-Process python -ArgumentList '-m', 'http.server', "$port", '--directory', $zip.DirectoryName -WindowStyle Hidden
for ($i = 0; $i -lt 30; $i++) {
    try {
        Invoke-WebRequest -Uri "http://127.0.0.1:$port/$($zip.Name)" -Method Head -UseBasicParsing | Out-Null
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}
try {
    Invoke-WebRequest -Uri "http://127.0.0.1:$port/$($zip.Name)" -Method Head -UseBasicParsing | Out-Null
} catch {
    Fail 'local artifact server did not come up'
}
Write-Host '::endgroup::'

Write-Host '::group::Install Scoop and the app from the local bucket'
if (-not (Get-Command scoop -ErrorAction SilentlyContinue)) {
    Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned -Force
    Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
}
$buckets = Join-Path $scoopRoot 'buckets'
New-Item -ItemType Directory -Force $buckets | Out-Null
if (-not (Test-Path (Join-Path $buckets 'test'))) {
    git clone "$bucketDir" (Join-Path $buckets 'test') | Out-Null
}
# git clone only carries the committed state — the rewritten manifest above
# is a working-tree change, so copy it over the clone explicitly.
Copy-Item -Force $manifest (Join-Path $buckets 'test/bucket/doru.json')
scoop install test/doru
Write-Host '::endgroup::'

Write-Host '::group::Install location and exe metadata'
if (-not (Test-Path (Join-Path $appDir 'doru.exe'))) { Fail 'doru.exe is missing from the install dir' }
$exe = Get-Item (Join-Path $appDir 'doru.exe')
# The release build overrides the exe display metadata with the Dóru spelling.
if ($exe.VersionInfo.ProductName -ne 'Dóru') { Fail "exe ProductName is '$($exe.VersionInfo.ProductName)', expected 'Dóru'" }
Write-Host '::endgroup::'

Write-Host '::group::Materialized association templates (post_install effect)'
$installReg = Join-Path $appDir 'install-associations.reg'
$uninstallReg = Join-Path $appDir 'uninstall-associations.reg'
if (-not (Test-Path $installReg)) { Fail 'install-associations.reg was not materialized by post_install' }
if (-not (Test-Path $uninstallReg)) { Fail 'uninstall-associations.reg was not materialized by post_install' }
$regContent = Get-Content $installReg -Raw
if ($regContent -notmatch 'doru\.exe') { Fail 'materialized .reg does not reference doru.exe' }
if ($regContent -match '\$doru') { Fail 'materialized .reg still contains the $doru placeholder' }
Write-Host '::endgroup::'

Write-Host '::group::Start Menu shortcut'
$shortcut = Join-Path $env:APPDATA 'Microsoft/Windows/Start Menu/Programs/Scoop Apps/Dóru.lnk'
if (-not (Test-Path $shortcut)) { Fail "shortcut missing: $shortcut" }
$shell = New-Object -ComObject WScript.Shell
$sc = $shell.CreateShortcut($shortcut)
if (-not $sc.TargetPath.EndsWith('doru.exe')) { Fail "shortcut target is '$($sc.TargetPath)'" }
# IconLocation is "path,index"; when no explicit icon is set, the path part
# is empty and Windows uses the target exe's icon (",0") — that is expected.
$iconPath = ($sc.IconLocation -split ',')[0]
if ($iconPath -ne '' -and $iconPath -notlike '*doru.exe*') { Fail "shortcut icon is '$($sc.IconLocation)'" }
Write-Host "target: $($sc.TargetPath)"
Write-Host "icon: $($sc.IconLocation)"
Write-Host '::endgroup::'

Write-Host '::group::Register associations (the opt-in step) and verify the registry'
reg import $installReg
$classes = 'HKCU:\Software\Classes'
foreach ($pair in @(@('.doru', 'Doru.Tree'), @('.ged', 'Doru.Gedcom'), @('.gdz', 'Doru.Gedzip'))) {
    $ext, $progId = $pair
    $key = Get-Item "$classes\$ext\OpenWithProgids"
    if ($null -eq $key.GetValue($progId)) { Fail "$ext does not list $progId in OpenWithProgids" }
    $command = (Get-Item "$classes\$progId\shell\open\command").GetValue('')
    if ($command -notlike '*doru.exe*' -or $command -notlike '*%1*') {
        Fail "$progId command is '$command'"
    }
    Write-Host "$ext -> $progId -> $command"
}
$registered = (Get-ItemProperty 'HKCU:\Software\RegisteredApplications').Doru
if ($registered -ne 'Software\Doru\Capabilities') { Fail "RegisteredApplications.Doru = '$registered'" }
$fileAssoc = Get-ItemProperty 'HKCU:\Software\Doru\Capabilities\FileAssociations'
if ($fileAssoc.'.doru' -ne 'Doru.Tree') { Fail 'Capabilities\FileAssociations lacks .doru' }
if ($fileAssoc.'.ged' -ne 'Doru.Gedcom') { Fail 'Capabilities\FileAssociations lacks .ged' }
if ($fileAssoc.'.gdz' -ne 'Doru.Gedzip') { Fail 'Capabilities\FileAssociations lacks .gdz' }
Write-Host '::endgroup::'

Write-Host '::group::Launch, first-run files, and the doru:// deep link'
$env:DORU_LOG_LEVEL = 'debug'
$process = Start-Process -FilePath (Join-Path $appDir 'doru.exe') -PassThru
Start-Sleep -Seconds 10
if ($process.HasExited) { Fail "the app exited during startup (code $($process.ExitCode))" }
if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) { Fail 'the app is not running' }
$firstRun = Join-Path $env:APPDATA 'Doru'
# settings.json is written by readSettings on boot — the deterministic
# first-run marker. (The log file is not: it only exists once something has
# been logged or the settings page created it.)
$marker = Join-Path $firstRun 'settings.json'
for ($i = 0; $i -lt 30; $i++) {
    if (Test-Path $marker) { break }
    Start-Sleep -Seconds 1
}
if (-not (Test-Path $marker)) { Fail "first-run settings not created at $marker" }
Write-Host "first-run files: $((Get-ChildItem $firstRun | Select-Object -ExpandProperty Name) -join ' ')"

# The launch registers the doru:// scheme under HKCU\Software\Classes.
$schemeKey = 'HKCU:\Software\Classes\doru'
$registered = $false
for ($i = 0; $i -lt 15; $i++) {
    if (Test-Path $schemeKey) { $registered = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $registered) { Fail 'the doru scheme was not registered in HKCU\Software\Classes' }
if ($null -eq (Get-Item $schemeKey).GetValue('URL Protocol')) { Fail 'the doru scheme key lacks the URL Protocol value' }
$schemeCommand = (Get-Item "$schemeKey\shell\open\command").GetValue('')
if ($schemeCommand -notlike '*doru.exe*' -or $schemeCommand -notlike '*%1*') {
    Fail "the doru scheme command is '$schemeCommand'"
}
Write-Host "doru:// -> $schemeCommand"

# Warm open: ShellExecute resolves the scheme through the registry and starts
# a second doru.exe, which forwards the link to the running instance via the
# single-instance lock.
$testDir = Join-Path $env:USERPROFILE 'doru-deeplink-test'
$testFile = Join-Path $testDir 'family.doru'
$testUrl = 'doru://open?path=' + ($testFile -replace '\\', '/')
Remove-Item -Recurse -Force $testDir -ErrorAction SilentlyContinue
Start-Process $testUrl
# The link points at a path that does not exist yet: openProject creates the
# .doru file itself — the file appearing proves the link went through
# registration → delivery → parsing → opening.
for ($i = 0; $i -lt 30; $i++) {
    if (Test-Path $testFile) { break }
    Start-Sleep -Seconds 1
}
if (-not (Test-Path $testFile)) { Fail "the doru:// link did not open the project ($testFile was not created)" }
$session = Join-Path $firstRun 'session.json'
# session.json is written a beat after the project file (window creation and
# recents come first) — poll like the other markers.
for ($i = 0; $i -lt 30; $i++) {
    if (Test-Path $session) { break }
    Start-Sleep -Seconds 1
}
# The path arrives from the doru:// URL with forward slashes, and that is how
# the session stores it.
$sessionText = Get-Content $session -Raw
if (-not $sessionText.Contains($testFile.Replace('\', '/')) -and
    -not $sessionText.Contains($testFile.Replace('\', '\\'))) {
    Fail 'session.json does not contain the linked project path'
}
Write-Host "deep link opened: $testFile"
Stop-Process -Id $process.Id -Force
Write-Host '::endgroup::'

Write-Host '::group::doru:// deep link (cold start through the registry)'
Remove-Item -Force $testFile -ErrorAction SilentlyContinue
Start-Process $testUrl
for ($i = 0; $i -lt 60; $i++) {
    if (Test-Path $testFile) { break }
    Start-Sleep -Seconds 1
}
if (-not (Test-Path $testFile)) { Fail "the cold-start doru:// link did not open the project ($testFile was not created)" }
Write-Host "cold-start link opened: $testFile"
Get-Process -Name 'doru' -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host '::endgroup::'

Write-Host 'Windows · Scoop install verified.'
