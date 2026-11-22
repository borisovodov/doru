---
source-hash: 762f7e504ddc
---

# Telepítés és frissítések

A Dóru a platformja alkalmazásboltjából vagy csomagkezelőjéből telepíthető.

## macOS {#macos}

A Dóru macOS-en a **Homebrew**-n keresztül érhető el, amely csomagkezelő telepíti és frissíti az alkalmazásokat Ön helyett. Ha még nincs Homebrew-ja, először telepítse a [brew.sh](https://brew.sh) oldalról.

A Dóruhoz macOS 13 (Ventura) vagy újabb, valamint Apple silicon Mac (M1 vagy újabb) szükséges; az Intel Mac-ek nem támogatottak.

A Dóru telepítéséhez nyissa meg a Terminált, és futtassa a következő parancsokat:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

A Dóru most megjelenik az Alkalmazások között. Későbbi frissítéshez időnként futtassa a `brew upgrade --cask doru` parancsot a Terminálban.

## Linux {#linux}

A Dóru Linuxon x86-64 és arm64 gépeken fut. **Ubuntu 22.04 LTS** vagy újabb, illetve **Fedora 41** vagy újabb szükséges; mindkettő legújabb kiadásán tesztelték. Más disztribúciók valószínűleg szintén működnek, de nincsenek ellenőrizve. Válassza az alábbi két módszer egyikét — mindkettő ugyanazt az alkalmazást telepíti.

### Flatpak

A Dóru a **Flatpak**-on keresztül érhető el, amely a legtöbb Linux-disztribúció szabványos alkalmazástelepítési módja. Ha a Flatpak még nincs telepítve, kövesse a disztribúciójához tartozó beállítási lépéseket a [flatpak.org/setup](https://flatpak.org/setup/) oldalon.

A Dóru telepítéséhez nyisson meg egy terminált, és futtassa a következő parancsokat:

```sh
flatpak remote-add flathub https://dl.flathub.org/repo/flathub.flatpakrepo --user --if-not-exists
```

```sh
flatpak remote-add borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo --user --if-not-exists
```

```sh
flatpak install borisovodov doru
```

A Dóru most megjelenik az alkalmazásmenüben. Későbbi frissítéshez hagyja, hogy a rendszer szoftveralkalmazása kezelje a Flatpak-frissítéseket (például a GNOME Software vagy a Discover), vagy futtassa a `flatpak update` parancsot egy terminálban.

### Homebrew

A Dóru Linuxon **Homebrew**-n keresztül is elérhető. Ha még nincs Homebrew-ja, először telepítse a [brew.sh](https://brew.sh) oldalról.

A Dóru telepítéséhez nyisson meg egy terminált, és futtassa a következő parancsokat:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

A Dóru most megjelenik az alkalmazásmenüben. Későbbi frissítéshez időnként futtassa a `brew upgrade --cask doru` parancsot egy terminálban.

## Windows (kísérleti) {#windows-experimental}

A Dóru Windows-on a **Scoop**-on keresztül érhető el, amely parancssori telepítő, és naprakészen tartja az alkalmazásokat. Ha még nincs Scoop-je, először telepítse a [scoop.sh](https://scoop.sh) oldalról.

A Dóruhoz Windows 11 vagy újabb szükséges.

A Dóru telepítéséhez nyissa meg a PowerShellt, és futtassa a következő parancsokat:

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
```

```powershell
scoop install doru
```

A Dóru most megjelenik a Start menüben. Későbbi frissítéshez időnként futtassa a `scoop update doru` parancsot a PowerShellben.
