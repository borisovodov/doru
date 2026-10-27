#!/usr/bin/env bash
# Mirrors the borisovodov/flatpak build workflow (taken live from `main`):
# stamps the metainfo with its script, builds the flatpak with
# electron-builder, imports the bundle into a local OSTree repo, and installs
# it — then verifies the exported desktop entry, MIME registration, icons,
# file associations, a real launch, and the first-run files.
#
# Discrepancies with a real user install, decided case by case:
# - XDG_DATA_DIRS is set explicitly (on a real machine the flatpak profile
#   snippet adds the exports dir to it);
# - the app is launched headless under xvfb/dbus with --disable-gpu;
# - the bundle is signed with no key and installed from a --no-gpg-verify
#   local remote.
set -euo pipefail

WORKSPACE=${GITHUB_WORKSPACE:-$(pwd)}
FLATPAK_REPO="$WORKSPACE/external/flatpak"
export XDG_DATA_DIRS="$HOME/.local/share/flatpak/exports/share:/var/lib/flatpak/exports/share:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"

fail() { echo "::error::$1"; exit 1; }

echo "::group::Install flatpak tooling"
sudo apt-get update -qq
sudo apt-get install -y -qq \
  flatpak flatpak-builder ostree appstream appstream-util \
  libgtk-3-0 libnotify4 libnss3 libxss1 libasound2t64 libgbm1 xvfb dbus-x11
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
echo "::endgroup::"

echo "::group::Stamp the metainfo (external repo script)"
python3 "$FLATPAK_REPO/scripts/stamp-metainfo.py" \
  "$WORKSPACE/distribution/metadata/org.doru.doru.metainfo.xml" \
  "${TEST_VERSION:?}" "$(date -u +%Y-%m-%d)"
echo "::endgroup::"

echo "::group::Build the flatpak bundle (external workflow commands)"
cd "$WORKSPACE/apps/desktop"
npx electron-vite build
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --linux flatpak --publish never
ls -la release/*.flatpak
echo "::endgroup::"

echo "::group::Import and install the bundle"
mkdir -p /tmp/smoke-repo
ostree --repo=/tmp/smoke-repo init --mode=archive
flatpak build-import-bundle /tmp/smoke-repo release/*.flatpak
flatpak remote-add --user --no-gpg-verify smoke "file:///tmp/smoke-repo"
flatpak install --user -y smoke org.doru.doru//stable
flatpak info org.doru.doru
echo "::endgroup::"

EXPORTS="$HOME/.local/share/flatpak/exports/share"

echo "::group::Exported desktop entry"
DESKTOP="$EXPORTS/applications/org.doru.doru.desktop"
test -f "$DESKTOP" || fail "desktop entry not exported"
grep -q '^Name=Dóru$' "$DESKTOP" || fail "desktop Name is not Dóru"
grep -q '^MimeType=.*application/x-doru;' "$DESKTOP" || fail "MimeType lacks application/x-doru"
grep -q '^MimeType=.*application/x-gedzip;' "$DESKTOP" || fail "MimeType lacks application/x-gedzip"
grep -q '^MimeType=.*text/vnd.familysearch.gedcom;' "$DESKTOP" || fail "MimeType lacks text/vnd.familysearch.gedcom"
grep -q '^X-Flatpak=org.doru.doru$' "$DESKTOP" || fail "exported entry lacks the X-Flatpak tag"
grep -q '^Exec=.*flatpak run.*org.doru.doru' "$DESKTOP" || fail "Exec was not rewritten to flatpak run"
echo "::endgroup::"

echo "::group::Exported MIME package"
MIME_XML="$EXPORTS/mime/packages/org.doru.doru.xml"
test -f "$MIME_XML" || fail "MIME package not exported"
grep -q 'application/x-doru' "$MIME_XML" || fail "x-doru missing from the exported MIME package"
grep -q 'application/x-gedzip' "$MIME_XML" || fail "x-gedzip missing from the exported MIME package"
grep -q 'weight="5"' "$MIME_XML" || fail "exported globs were not weighted by flatpak"
test -f "$EXPORTS/mime/mime.cache" || fail "update-mime-database did not build mime.cache in exports"
echo "::endgroup::"

echo "::group::Exported icons and metainfo"
test -n "$(ls "$EXPORTS/icons/hicolor/"*/apps/org.doru.doru.* 2>/dev/null)" \
  || fail "no exported app icon"
test -f "$EXPORTS/metainfo/org.doru.doru.metainfo.xml" || fail "metainfo not exported"
echo "::endgroup::"

echo "::group::File associations (.doru/.ged/.gdz)"
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
xvfb-run --auto-servernum dbus-run-session -- bash -c '
  set -e
  DORU_LOG_LEVEL=debug flatpak run org.doru.doru --disable-gpu \
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
# --filesystem=home maps the real home inside the sandbox: Electron's userData
# lands in ~/.config/Doru, not in ~/.var/app/org.doru.doru.
FIRST_RUN="$HOME/.config/Doru"
for _ in $(seq 1 30); do
  [ -f "$FIRST_RUN/doru.log" ] && break
  sleep 1
done
test -f "$FIRST_RUN/doru.log" || fail "first-run log not created at $FIRST_RUN/doru.log"
echo "first-run files: $(ls "$FIRST_RUN" | tr '\n' ' ')"
echo "::endgroup::"

echo "Ubuntu · Flatpak install verified."
