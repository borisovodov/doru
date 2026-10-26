# Distribution

How Dóru reaches users and how releases flow through the channels. This is a
maintainer runbook; the user-facing installation instructions live in the
[guide](guide/installation.md). Deferred distribution work is tracked in
GitHub issues, not here.

## Channels

Three publisher-level channels, each a separate repository with its own
update automation (every four hours, no secrets — the bots read unauthenticated
GitHub APIs):

- **Homebrew** — tap `borisovodov/taps` (repo `homebrew-taps`), cask `doru`.
  macOS installs the notarized dmg; Linux installs the AppImage into
  `~/Applications` and writes a desktop entry and launcher icon via
  `postflight_steps`.
- **Scoop** — bucket `borisovodov/bucket`, manifest `doru`. Installs the
  portable Windows zip.
- **Flatpak** — remote `borisovodov/flatpak` (repo `flatpak`), app
  `org.doru.doru`, x86_64 and aarch64, a signed OSTree repository served
  from GitHub Pages.

## Releases

1. Bump every `package.json` version to the release number, sync with
   `npm install --package-lock-only`, commit as `Bump version to X.Y.Z`,
   push to `main`, then push the signed tag `vX.Y.Z`.
2. The release workflow builds exactly the artifacts the channels consume:
   the macOS dmg, two Windows zips, two Linux AppImages.
3. The channel bots pick the release up on their own within their next cycle:
   - the tap bot bumps the cask using the release assets' sha256 digests;
   - the Scoop excavator bumps the manifest (hashes via the releases API
     jsonpath);
   - the flatpak bot builds both architectures from the tag and republishes
     the OSTree repository.
4. Verify: cask and manifest hashes equal the release digests; the flatpak
   refs `app/org.doru.doru/{x86_64,aarch64}/stable` are served; the bot
   version markers advanced.

## Store metadata

- `distribution/metadata/` holds `summary.md`, `description.md`, the
  AppStream metainfo, and the screenshots. Regenerate screenshots after UI
  changes with `node scripts/capture-screenshots.ts` (built app, seeded tree,
  forced English locale).
- The metainfo is shared by the flatpak build and future store listings; its
  screenshots reference `raw.githubusercontent.com` URLs — update them if the
  paths move.
- Validate the metainfo with `appstreamcli validate --no-net`. AppStream ≥ 1.0
  rejects the OARS id `sex-theme` — the correct id is `sex-themes`; use a
  `developer` block, not the deprecated `developer_name`.
- The flatpak build stamps the release version into `<releases>` at build
  time; the committed metainfo stays release-free.
- The Homebrew cask's launcher icon ships in `homebrew-taps` as
  `icons/org.doru.doru.png`.

## Signing

- Flatpak: dedicated GPG key `2600902022BDB589`; the private key lives in the
  `FLATPAK_GPG_KEY` secret of the `flatpak` repo, the public key is embedded
  in `borisovodov.flatpakrepo`, and the revocation certificate is kept
  off-repo. Rotate by generating a new key, swapping the secret, and
  republishing the repository.
- macOS: Developer ID plus notarization, see [signing.md](signing.md).
  Windows binaries are not signed.

## Identifiers

The names below appear as literals in several formats and repositories and
cannot be derived from one another — keep them in sync deliberately:

- `org.doru.doru` — the reverse-DNS id: `appId` in `electron-builder.yml`
  (macOS bundle id, Flatpak id), `desktopName` in
  `apps/desktop/package.json` (Linux desktop file name), the AppStream
  metainfo `<id>`, and the Homebrew cask's zap paths
  (`org.doru.doru.plist`).
- `doru` — the executable name (`executableName` in `electron-builder.yml`),
  the `doru://` protocol scheme (main process), and the MCP server name for
  ACP agents (`main/chat.ts`). The `.doru` file extension shares the string
  but is a separate concept.
- `Dóru` / `Doru` — technical names stay ASCII: `productName` drives
  CFBundleName, the helper app names, and the userData path, and a non-ASCII
  CFBundleName crashes Electron at startup on macOS. The Dóru spelling lives
  in display-only fields: `mac.extendInfo.CFBundleDisplayName`,
  `linux.desktop.entry.Name`, the AppStream metainfo name, and the Homebrew
  cask's name stanza.

## Gotchas that cost real time

- **electron-builder AppImage** — `toolsets.appimage: '1.0.3'` builds with
  the static runtime. The legacy fuse2 runtime is dynamically linked against
  an unversioned `libz.so` that stock systems do not ship; the static runtime
  also falls back to extraction when FUSE is missing, so there is no
  `libfuse2` requirement to document.
- **electron-builder flatpak** — the metainfo enters the bundle via
  `flatpak.files` into `share/metainfo`; `appstreamcli compose` at finish
  requires the Linux icon set (`resources/icons`, all ≤ 512px — a single
  1024px icon is dropped and compose fails with `icon-not-found`).
- **Flatpak branch** — publish on `stable`. Network remotes resolve the
  default branch as `stable` while local `file://` remotes use `master`;
  building on `master` makes HTTPS installs fail with "Nothing matches".
- **Flatpak runtimes** — the runtime comes from Flathub, declared via
  `RuntimeRepo=` in the `.flatpakrepo`. flatpak resolves runtimes only within
  one installation, so user installs need a user-scoped Flathub
  (`remote-add flathub … --user`).
- **Brew 7 install steps** — `postflight_steps` is declarative: literal
  arguments and `{{user}}`-style templates only, no raw Ruby. Tilde paths
  resolve against the sandbox HOME, not the user's — use `/home/{{user}}/…`.
  Network access in a step requires `network_access: true`.
- **Brew cask on Linux** — the AppImage lands in `~/Applications`
  (appimagedir), not `appdir`; the cask's desktop entry must point there.
- **macOS bundle name** — the bundle is `Doru.app` because of
  `mac.executableName`; the cask references that exact name.
- **Scoop** — the channel artifact is the plain zip target: no `#/dl.7z`
  fragment, no installer execution, no `post_install` cleanup.
- **Accent in names** — `productName` stays ASCII: Electron derives
  CFBundleName, the helper app names, and the userData path from it, and a
  non-ASCII CFBundleName crashes Electron at startup on macOS (SIGTRAP before
  any logging). Display surfaces carry the Dóru spelling instead —
  CFBundleDisplayName on macOS (Dock/Spotlight), the desktop entry Name on
  Linux, the AppStream metainfo name, and the Windows exe metadata
  (ProductName/FileDescription, set via `--config.productName=Dóru` on the
  Windows release job). The override never reaches the packaged
  package.json, so `app.getName()` and the userData path stay Doru.
