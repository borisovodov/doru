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
# InfoPlist.strings is UTF-16 (the format .strings requires), so grep cannot
# see into it — parse with plutil instead.
plutil -p "$APP/Contents/Resources/en.lproj/InfoPlist.strings" | grep -q CFBundleDisplayName \
  || fail "en.lproj/InfoPlist.strings lacks CFBundleDisplayName"
echo "::endgroup::"

echo "::group::Icon"
SHIPPED_ICON="$APP/Contents/Resources/icon.icns"
SOURCE_ICON="$WORKSPACE/apps/desktop/build/icon.icns"
test -f "$SHIPPED_ICON" || fail "Resources/icon.icns missing"
file "$SHIPPED_ICON" | grep -q "Mac OS X icon" || fail "the shipped icon is not an icns file"
# The packager may re-encode the icns (actool on newer Xcode), so the bytes
# can legitimately differ from the committed build/icon.icns. Compare the
# decoded representations instead: the same set, each with the same size.
ICON_TMP=$(mktemp -d)
iconutil -c iconset "$SHIPPED_ICON" -o "$ICON_TMP/shipped.iconset" || fail "cannot decode the shipped icon"
iconutil -c iconset "$SOURCE_ICON" -o "$ICON_TMP/source.iconset" || fail "cannot decode the source icon"
diff <(ls "$ICON_TMP/shipped.iconset" | sort) <(ls "$ICON_TMP/source.iconset" | sort) \
  || fail "the shipped icon has different representations than the source icon"
for rep in "$ICON_TMP/source.iconset"/*.png; do
  name=$(basename "$rep")
  sw=$(sips -g pixelWidth "$ICON_TMP/shipped.iconset/$name" | awk '/pixelWidth/{print $2}')
  sh=$(sips -g pixelHeight "$ICON_TMP/shipped.iconset/$name" | awk '/pixelHeight/{print $2}')
  tw=$(sips -g pixelWidth "$rep" | awk '/pixelWidth/{print $2}')
  th=$(sips -g pixelHeight "$rep" | awk '/pixelHeight/{print $2}')
  [ "$sw" = "$tw" ] && [ "$sh" = "$th" ] || fail "icon representation $name differs in size"
done
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
# duti -x prints the default app's *name* (see its man page: `duti -x html`
# → `Safari`), not the bundle id — so compare against the bundle names.
BUNDLE_NAME=$(plutil -extract CFBundleName raw "$PLIST")
DISPLAY_NAME=$(plutil -extract CFBundleDisplayName raw "$PLIST")
for ext in doru ged gdz; do
  handler=""
  for _ in $(seq 1 30); do
    handler=$(duti -x "$ext" 2>/dev/null | head -1) || true
    { [ "$handler" = "$BUNDLE_NAME" ] || [ "$handler" = "$DISPLAY_NAME" ]; } && break
    sleep 2
  done
  echo ".$ext -> $handler"
  { [ "$handler" = "$BUNDLE_NAME" ] || [ "$handler" = "$DISPLAY_NAME" ]; } \
    || fail ".$ext is not associated with Dóru (got: '$handler')"
done
echo "::endgroup::"

echo "::group::Launch and first-run files"
# Discrepancy with a real user install: the test build is unsigned, and on a
# headless runner there is nobody to click through the first-launch
# verification dialog — `open` blocks on it forever. Launch the binary
# directly instead, with bounded waits throughout.
"$APP/Contents/MacOS/Doru" >/tmp/doru-app.log 2>&1 &
APP_PID=$!
for _ in $(seq 1 15); do
  kill -0 "$APP_PID" 2>/dev/null && break
  sleep 2
done
if ! kill -0 "$APP_PID" 2>/dev/null; then
  cat /tmp/doru-app.log
  fail "the app exited during startup"
fi
FIRST_RUN="$HOME/Library/Application Support/Doru"
# settings.json is written by readSettings on boot — the deterministic
# first-run marker. (The log file is not: it only exists once something has
# been logged or the settings page created it.)
for _ in $(seq 1 30); do
  [ -f "$FIRST_RUN/settings.json" ] && break
  sleep 1
done
if [ ! -f "$FIRST_RUN/settings.json" ]; then
  cat /tmp/doru-app.log
  fail "first-run settings not created at $FIRST_RUN/settings.json"
fi
echo "first-run files: $(ls "$FIRST_RUN" | tr '\n' ' ')"
kill "$APP_PID" 2>/dev/null || true
echo "::endgroup::"

echo "macOS · Homebrew cask install verified."
