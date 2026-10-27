#!/usr/bin/env bash
# Installs the locally built dmg through the Homebrew cask taken live from
# borisovodov/homebrew-taps (`main`) and verifies the install location, the
# display names, the icon, the .doru/.ged/.gdz file associations, a real
# launch, and the first-run files.
#
# The cask is transformed in place: the released version/sha256 are replaced
# with the test artifact's, and the url points at a local HTTP server.
set -euo pipefail

WORKSPACE=${GITHUB_WORKSPACE:-$(pwd)}
TAP="$WORKSPACE/external/homebrew-taps"
DMG=$(ls "$WORKSPACE"/apps/desktop/release/*.dmg | head -1)
PORT=8473

fail() { echo "::error::$1"; exit 1; }

echo "::group::Prepare the cask with the test artifact"
HASH=$(shasum -a 256 "$DMG" | awk '{print $1}')
sed -i '' \
  -e 's|^  url .*|  url "http://127.0.0.1:'"$PORT"'/'"$(basename "$DMG")"'"|' \
  -e 's/^  version .*/  version "'"${TEST_VERSION:?}"'"/' \
  "$TAP/Casks/doru.rb"
perl -i -pe 's/(arm:\s+")[0-9a-f]{64}/$1'"$HASH"'/' "$TAP/Casks/doru.rb"
grep -E '^(  url|  version|  sha256 arm:)' "$TAP/Casks/doru.rb"
echo "::endgroup::"

echo "::group::Serve the artifact"
cd "$(dirname "$DMG")"
python3 -m http.server "$PORT" >/tmp/doru-http.log 2>&1 &
HTTP_PID=$!
trap 'kill "$HTTP_PID" 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do
  curl -fsSI "http://127.0.0.1:$PORT/$(basename "$DMG")" >/dev/null && break
  sleep 1
done
curl -fsSI "http://127.0.0.1:$PORT/$(basename "$DMG")" >/dev/null \
  || fail "local artifact server did not come up"
echo "::endgroup::"

echo "::group::Install through the cask"
export HOMEBREW_NO_AUTO_UPDATE=1
brew tap borisovodov/taps "$TAP"
brew trust borisovodov/taps
brew install --cask borisovodov/taps/doru
echo "::endgroup::"

APP=/Applications/Doru.app
PLIST="$APP/Contents/Info.plist"

echo "::group::Install location and bundle identity"
test -d "$APP" || fail "$APP does not exist"
test "$(plutil -extract CFBundleIdentifier raw "$PLIST")" = "org.doru.doru" \
  || fail "CFBundleIdentifier is not org.doru.doru"
echo "::endgroup::"

echo "::group::Display names (the two macOS lookups)"
test "$(plutil -extract CFBundleDisplayName raw "$PLIST")" = "Dóru" \
  || fail "CFBundleDisplayName is not Dóru"
test "$(plutil -extract CFBundleName raw "$PLIST")" = "Doru" \
  || fail "CFBundleName is not Doru (must stay ASCII)"
grep -q 'CFBundleDisplayName' "$APP/Contents/Resources/en.lproj/InfoPlist.strings" \
  || fail "en.lproj/InfoPlist.strings lacks CFBundleDisplayName"
echo "::endgroup::"

echo "::group::Icon"
test -f "$APP/Contents/Resources/icon.icns" || fail "Resources/icon.icns missing"
cmp "$APP/Contents/Resources/icon.icns" "$WORKSPACE/apps/desktop/build/icon.icns" \
  || fail "the shipped icon.icns differs from the source icon"
# Launch Services must resolve an icon for the app (a broken icon falls back
# to the generic application image — still an image, so this is only a sanity
# check that icon lookup itself works).
osascript -l JavaScript -e '
ObjC.import("AppKit");
var img = $.NSWorkspace.sharedWorkspace.iconForFile("/Applications/Doru.app");
(img && img.size.width > 16).toString();' | grep -q '^true$' \
  || fail "Launch Services returned no usable icon for the app"
echo "::endgroup::"

echo "::group::File associations (.doru/.ged/.gdz)"
# Force Launch Services to register the freshly installed app; registration
# is otherwise asynchronous and polled below.
lsregister=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
"$lsregister" -f "$APP"
brew install duti >/dev/null
for ext in doru ged gdz; do
  handler=""
  for _ in $(seq 1 30); do
    handler=$(duti -x "$ext" 2>/dev/null | head -1) || true
    [ "$handler" = "org.doru.doru" ] && break
    sleep 2
  done
  echo ".$ext -> $handler"
  [ "$handler" = "org.doru.doru" ] || fail ".$ext is not associated with org.doru.doru"
done
echo "::endgroup::"

echo "::group::Launch and first-run files"
open "$APP"
for _ in $(seq 1 15); do
  pgrep -f "$APP/Contents/MacOS/Doru" >/dev/null && break
  sleep 2
done
pgrep -f "$APP/Contents/MacOS/Doru" >/dev/null || fail "the app is not running after open"
FIRST_RUN="$HOME/Library/Application Support/Doru"
for _ in $(seq 1 30); do
  [ -f "$FIRST_RUN/doru.log" ] && break
  sleep 1
done
test -f "$FIRST_RUN/doru.log" \
  || fail "first-run log not created at $FIRST_RUN/doru.log"
echo "first-run files: $(ls "$FIRST_RUN" | tr '\n' ' ')"
osascript -e 'quit app "Doru"'
echo "::endgroup::"

echo "macOS · Homebrew cask install verified."
