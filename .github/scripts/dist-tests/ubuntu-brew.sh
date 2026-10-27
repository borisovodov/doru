#!/usr/bin/env bash
# Installs the locally built AppImage through the Homebrew cask taken live
# from borisovodov/homebrew-taps (`main`) and verifies the install location,
# the desktop entry (name, icon, MimeType), the installed icon, the
# .doru/.ged/.gdz file associations, a real launch under xvfb, and the
# first-run files.
#
# Discrepancies with a real user install, decided case by case:
# - the app is launched headless with `--no-sandbox --disable-gpu` (no
#   display server on CI; the Chromium sandbox is unreliable on runners);
# - the cask url is rewritten to a local HTTP server (the artifact is not
#   published anywhere yet).
set -euo pipefail

WORKSPACE=${GITHUB_WORKSPACE:-$(pwd)}
TAP="$WORKSPACE/external/homebrew-taps"
APPIMAGE=$(ls "$WORKSPACE"/apps/desktop/release/*.AppImage | head -1)
PORT=8474

fail() { echo "::error::$1"; exit 1; }

echo "::group::Install system dependencies"
sudo apt-get update -qq
sudo apt-get install -y -qq \
  libgtk-3-0 libnotify4 libnss3 libxss1 libasound2t64 libgbm1 \
  xvfb dbus-x11 libfuse2t64 desktop-file-utils \
  || sudo apt-get install -y -qq \
  libgtk-3-0 libnotify4 libnss3 libxss1 libasound2 libgbm1 \
  xvfb dbus-x11 libfuse2 desktop-file-utils
echo "::endgroup::"

echo "::group::Install Homebrew on Linux"
if ! command -v brew >/dev/null; then
  NONINTERACTIVE=1 /bin/bash -c \
    "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
brew --version
echo "::endgroup::"

echo "::group::Prepare the cask with the test artifact"
HASH=$(sha256sum "$APPIMAGE" | awk '{print $1}')
sed -i \
  -e 's|^  url .*|  url "http://127.0.0.1:'"$PORT"'/'"$(basename "$APPIMAGE")"'"|' \
  -e 's/^  version .*/  version "'"${TEST_VERSION:?}"'"/' \
  "$TAP/Casks/doru.rb"
perl -i -pe 's/(x86_64_linux:\s+")[0-9a-f]{64}/$1'"$HASH"'/' "$TAP/Casks/doru.rb"
grep -E '^(  url|  version|  sha256 x86_64_linux:)' "$TAP/Casks/doru.rb"
echo "::endgroup::"

echo "::group::Serve the artifact"
cd "$(dirname "$APPIMAGE")"
python3 -m http.server "$PORT" >/tmp/doru-http.log 2>&1 &
HTTP_PID=$!
trap 'kill "$HTTP_PID" 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do
  curl -fsSI "http://127.0.0.1:$PORT/$(basename "$APPIMAGE")" >/dev/null && break
  sleep 1
done
curl -fsSI "http://127.0.0.1:$PORT/$(basename "$APPIMAGE")" >/dev/null \
  || fail "local artifact server did not come up"
echo "::endgroup::"

echo "::group::Install through the cask"
export HOMEBREW_NO_AUTO_UPDATE=1
brew tap borisovodov/taps "$TAP"
brew trust borisovodov/taps
brew install --cask borisovodov/taps/doru
echo "::endgroup::"

echo "::group::Install location"
INSTALLED="$HOME/Applications/Doru.AppImage"
test -x "$INSTALLED" || fail "$INSTALLED is missing or not executable"
echo "::endgroup::"

echo "::group::Desktop entry"
DESKTOP="$HOME/.local/share/applications/org.doru.doru.desktop"
test -f "$DESKTOP" || fail "desktop entry not written"
grep -q '^Name=Dóru$' "$DESKTOP" || fail "desktop Name is not Dóru"
grep -q '^Icon=org.doru.doru$' "$DESKTOP" || fail "desktop Icon is not org.doru.doru"
grep -q "^Exec=.*Doru.AppImage %U$" "$DESKTOP" || fail "desktop Exec is wrong"
grep -q '^MimeType=.*application/x-doru;' "$DESKTOP" || fail "MimeType lacks application/x-doru"
grep -q '^MimeType=.*application/x-gedzip;' "$DESKTOP" || fail "MimeType lacks application/x-gedzip"
grep -q '^MimeType=.*text/vnd.familysearch.gedcom;' "$DESKTOP" || fail "MimeType lacks text/vnd.familysearch.gedcom"
grep -q '^StartupWMClass=org.doru.doru$' "$DESKTOP" || true # informational
echo "::endgroup::"

echo "::group::Icon"
ICON="$HOME/.local/share/icons/hicolor/512x512/apps/org.doru.doru.png"
test -f "$ICON" || fail "icon not installed at $ICON"
file "$ICON" | grep -q 'PNG image data' || fail "installed icon is not a PNG"
# The cask fetches the icon from the tap repository: the installed file must
# be byte-identical to the source there.
cmp "$ICON" "$TAP/icons/org.doru.doru.png" || fail "installed icon differs from the tap's source icon"
echo "::endgroup::"

echo "::group::File associations (.doru/.ged/.gdz)"
test -f "$HOME/.local/share/mime/packages/org.doru.doru.xml" || fail "MIME package not installed"
python3 - "$WORKSPACE" <<'PY'
import os, sqlite3, sys, zipfile
d = sys.argv[1] + '/build/test-files'
os.makedirs(d, exist_ok=True)
con = sqlite3.connect(d + '/real.doru')
con.execute('CREATE TABLE t(x)')
con.execute('INSERT INTO t VALUES (1)')
con.commit(); con.close()
with open(d + '/real.ged', 'w') as f:
    f.write('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 TRLR\n')
with zipfile.ZipFile(d + '/real.gdz', 'w') as z:
    z.writestr('gedcom.ged', '0 HEAD\n0 TRLR\n')
PY
# gio may serve stale caches right after the database update: poll, then assert.
check_type() { # file expected-type — returns 1 (no exit) on mismatch
  local ct
  ct=$(gio info "$1" | awk -F': ' '/standard::content-type/{print $2}')
  echo "$1 -> $ct"
  [ "$ct" = "$2" ]
}
for pair in \
  "$WORKSPACE/build/test-files/real.doru application/x-doru" \
  "$WORKSPACE/build/test-files/real.ged text/vnd.familysearch.gedcom" \
  "$WORKSPACE/build/test-files/real.gdz application/x-gedzip"; do
  set -- $pair
  ok=0
  for _ in $(seq 1 15); do
    check_type "$1" "$2" && { ok=1; break; }
    sleep 2
  done
  [ "$ok" = 1 ] || fail "$1 did not resolve to $2"
done
for mime in application/x-doru application/x-gedzip text/vnd.familysearch.gedcom; do
  default=""
  for _ in $(seq 1 15); do
    default=$(xdg-mime query default "$mime" || true)
    [ -n "$default" ] && break
    sleep 2
  done
  echo "$mime -> $default"
  [ "$default" = "org.doru.doru.desktop" ] || fail "no default handler for $mime (got: '$default')"
done
echo "::endgroup::"

echo "::group::Launch and first-run files"
# Discrepancy: headless launch under xvfb/dbus with --no-sandbox --disable-gpu.
xvfb-run --auto-servernum dbus-run-session -- bash -c '
  set -e
  DORU_LOG_LEVEL=debug "$HOME/Applications/Doru.AppImage" --no-sandbox --disable-gpu \
    >/tmp/doru-app.log 2>&1 &
  APP_PID=$!
  alive=0
  for _ in $(seq 1 15); do
    kill -0 "$APP_PID" 2>/dev/null && { alive=1; break; }
    sleep 2
  done
  if [ "$alive" != 1 ]; then
    echo "app exited during startup"
    cat /tmp/doru-app.log
    exit 1
  fi
  sleep 8
  kill -0 "$APP_PID" 2>/dev/null || { echo "app died within 8s of startup"; cat /tmp/doru-app.log; exit 1; }
  kill "$APP_PID"
'
FIRST_RUN="$HOME/.config/Doru"
# settings.json is written by readSettings on boot — the deterministic
# first-run marker. (The log file is not: it only exists once something has
# been logged or the settings page created it.)
for _ in $(seq 1 30); do
  [ -f "$FIRST_RUN/settings.json" ] && break
  sleep 1
done
test -f "$FIRST_RUN/settings.json" || fail "first-run settings not created at $FIRST_RUN/settings.json"
echo "first-run files: $(ls "$FIRST_RUN" | tr '\n' ' ')"
echo "::endgroup::"

echo "Ubuntu · Homebrew cask install verified."
