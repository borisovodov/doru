# Installation

Every link below downloads the installer for the latest release directly.
macOS is the primary platform; **Windows and Linux builds are experimental** —
they are built by CI, but are unsigned and have not yet been verified on real
Windows/Linux machines, so expect rough edges.

| Platform | Installer |
|---|---|
| macOS (Apple Silicon) | [doru-mac-arm64.dmg](https://github.com/borisovodov/doru/releases/latest/download/doru-mac-arm64.dmg) |
| Windows (x64) *(experimental)* | [doru-windows-x64.exe](https://github.com/borisovodov/doru/releases/latest/download/doru-windows-x64.exe) |
| Windows (arm64) *(experimental)* | [doru-windows-arm64.exe](https://github.com/borisovodov/doru/releases/latest/download/doru-windows-arm64.exe) |
| Linux (x64) *(experimental)* | [doru-linux-x86_64.AppImage](https://github.com/borisovodov/doru/releases/latest/download/doru-linux-x86_64.AppImage) or [doru-linux-amd64.deb](https://github.com/borisovodov/doru/releases/latest/download/doru-linux-amd64.deb) |
| Linux (arm64) *(experimental)* | [doru-linux-arm64.AppImage](https://github.com/borisovodov/doru/releases/latest/download/doru-linux-arm64.AppImage) or [doru-linux-arm64.deb](https://github.com/borisovodov/doru/releases/latest/download/doru-linux-arm64.deb) |

- **macOS**: open the `.dmg`, drag Dóru to Applications. Builds are signed and
  notarized by Apple.
- **Windows (experimental)**: run the installer. Builds are not code-signed yet
  and not verified on real Windows machines, so SmartScreen may show a warning
  — click “More info → Run anyway”.
- **Linux (experimental)**: builds are unsigned and not verified on real Linux
  machines. The `.deb` installs with `sudo apt install ./doru-*.deb`; the
  AppImage needs `chmod +x` and then just runs.
