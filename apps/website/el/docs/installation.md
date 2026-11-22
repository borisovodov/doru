---
source-hash: 762f7e504ddc
---

# Εγκατάσταση και ενημερώσεις

Το Dóru εγκαθίσταται από το κατάστημα εφαρμογών ή τον διαχειριστή πακέτων της πλατφόρμας σας.

## macOS {#macos}

Το Dóru σε macOS διανέμεται μέσω του **Homebrew**, ενός διαχειριστή πακέτων που εγκαθιστά και ενημερώνει εφαρμογές για εσάς. Αν δεν έχετε ακόμη Homebrew, εγκαταστήστε το πρώτα από το [brew.sh](https://brew.sh).

Το Dóru απαιτεί macOS 13 (Ventura) ή νεότερο και Mac με Apple silicon (M1 ή νεότερο)· τα Intel Mac δεν υποστηρίζονται.

Για να εγκαταστήσετε το Dóru, ανοίξτε το Terminal και εκτελέστε αυτές τις εντολές:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Το Dóru εμφανίζεται πλέον στις Εφαρμογές σας. Για να το ενημερώσετε αργότερα, εκτελέστε κατά καιρούς `brew upgrade --cask doru` στο Terminal.

## Linux {#linux}

Το Dóru σε Linux εκτελείται σε μηχανήματα x86-64 και arm64. Απαιτεί **Ubuntu 22.04 LTS** ή νεότερο, ή **Fedora 41** ή νεότερο· δοκιμάζεται στις τελευταίες εκδόσεις και των δύο. Άλλες διανομές πιθανότατα θα λειτουργήσουν επίσης, αλλά δεν είναι επαληθευμένες. Επιλέξτε μία από τις δύο μεθόδους παρακάτω — και οι δύο εγκαθιστούν την ίδια εφαρμογή.

### Flatpak

Το Dóru διανέμεται μέσω του **Flatpak**, του τυπικού τρόπου εγκατάστασης εφαρμογών στις περισσότερες διανομές Linux. Αν το Flatpak δεν είναι εγκατεστημένο ακόμη, ακολουθήστε τα βήματα ρύθμισης για τη διανομή σας στο [flatpak.org/setup](https://flatpak.org/setup/).

Για να εγκαταστήσετε το Dóru, ανοίξτε ένα τερματικό και εκτελέστε αυτές τις εντολές:

```sh
flatpak remote-add flathub https://dl.flathub.org/repo/flathub.flatpakrepo --user --if-not-exists
```

```sh
flatpak remote-add borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo --user --if-not-exists
```

```sh
flatpak install borisovodov doru
```

Το Dóru εμφανίζεται πλέον στο μενού εφαρμογών σας. Για να το ενημερώσετε αργότερα, αφήστε την εφαρμογή λογισμικού του συστήματός σας να χειρίζεται τις ενημερώσεις Flatpak (για παράδειγμα GNOME Software ή Discover), ή εκτελέστε `flatpak update` σε ένα τερματικό.

### Homebrew

Το Dóru διανέμεται επίσης μέσω του **Homebrew** σε Linux. Αν δεν έχετε ακόμη Homebrew, εγκαταστήστε το πρώτα από το [brew.sh](https://brew.sh).

Για να εγκαταστήσετε το Dóru, ανοίξτε ένα τερματικό και εκτελέστε αυτές τις εντολές:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Το Dóru εμφανίζεται πλέον στο μενού εφαρμογών σας. Για να το ενημερώσετε αργότερα, εκτελείτε κατά καιρούς `brew upgrade --cask doru` σε ένα τερματικό.

## Windows (πειραματικό) {#windows-experimental}

Το Dóru σε Windows διανέμεται μέσω του **Scoop**, ενός εργαλείου εγκατάστασης γραμμής εντολών που κρατά τις εφαρμογές ενημερωμένες. Αν δεν έχετε ακόμη Scoop, εγκαταστήστε το πρώτα από το [scoop.sh](https://scoop.sh).

Το Dóru απαιτεί Windows 11 ή νεότερο.

Για να εγκαταστήσετε το Dóru, ανοίξτε το PowerShell και εκτελέστε αυτές τις εντολές:

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
```

```powershell
scoop install doru
```

Το Dóru εμφανίζεται πλέον στο μενού Έναρξη. Για να το ενημερώσετε αργότερα, εκτελείτε κατά καιρούς `scoop update doru` στο PowerShell.
