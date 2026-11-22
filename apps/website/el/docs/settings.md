---
source-hash: ecff58fa2a2c
---

# Ρυθμίσεις

Οι καθολικές ρυθμίσεις βρίσκονται στο `settings.json` στον κατάλογο δεδομένων της εφαρμογής:

| Λειτουργικό σύστημα | Διαδρομή |
|---|---|
| macOS | `~/Library/Application Support/Doru/settings.json` |
| Linux | `~/.config/Doru/settings.json` |
| Windows | `%APPDATA%\Doru\settings.json` |

**Οι προεπιλογές ζουν στην εφαρμογή· το αρχείο καταγράφει μόνο ρητές παρακάμψεις.** Στην πρώτη εκτέλεση η εφαρμογή δημιουργεί το αρχείο μόνο με την αναφορά `$schema` — όλα τα άλλα πέφτουν στις ενσωματωμένες προεπιλογές, ώστε οι νέες προεπιλογές να φτάνουν στους υπάρχοντες χρήστες με τις ενημερώσεις της εφαρμογής. Η αναφορά `$schema` είναι η μοναδική πηγή τεκμηρίωσης: οι επεξεργαστές με υποστήριξη JSON Schema (VS Code, Zed, JetBrains) προσφέρουν αυτόματη συμπλήρωση, επικύρωση και περιγραφές πεδίων από αυτήν. Η εφαρμογή γράφει καταχωρίσεις στο αρχείο μόνο όταν αλλάζετε μια ρύθμιση στις **Ρυθμίσεις**· όλα τα άλλα μένουν ανέγγιχτα.
Το αρχείο είναι απλό JSON με επιτρεπόμενα σχόλια — επεξεργαστείτε το με οποιονδήποτε επεξεργαστή· οι αλλαγές λαμβάνονται ζωντανά όσο η εφαρμογή εκτελείται. Η εφαρμογή επικυρώνει το αρχείο με το σχήμα κατά τη φόρτωση· αν δεν αναλύεται ή δεν ταιριάζει με το σχήμα, αντικαθίσταται με το κενό πρότυπο (καταγράφεται προειδοποίηση). Ο πάροχος ΤΝ ρυθμίζεται στην ενότητα `ai` αυτού του αρχείου — βλ. [ΤΝ και πράκτορες](agents.md).

Πλήρης αναφορά:

```jsonc
{
  "$schema": "https://doru.family/settings.json",

  // AI providers — set from Settings (gear icon) or here directly.
  "ai": {
    // The active provider: ollama | lmstudio | custom | acp
    // (cloud presets return one by one).
    "provider": "ollama",

    // Per-provider settings, keyed by provider id. Only the entry of the
    // active provider is used; the others keep their values and are
    // restored when you switch back.
    "providers": {
      "ollama": {
        "baseUrl": "", // optional override of the provider's default endpoint
        "model": ""
      }
      // For "acp" only: the agent binary to spawn. Add a comma after the
      // "ollama" object above when you enable it.
      // "acp": { "command": "my-agent", "args": [] }
    }
  },

  // Theme: one palette file with a dark and a light section. The OS
  // appearance decides which palette applies.
  "theme": "doru"
}
```

## Αρχεία καταγραφής

Η εφαρμογή προσθέτει διαγνωστικά στο `doru.log` στον κατάλογο δεδομένων (δίπλα στο `settings.json`). Το αρχείο εναλλάσσεται στα 5 MB — το προηγούμενο αρχείο διατηρείται ως `doru.old.log`. Η προεπιλεγμένη λεπτομέρεια είναι `warn` (οι εκδόσεις ανάπτυξης καταγράφουν σε `debug`)· ορίστε `DORU_LOG_LEVEL=trace|debug|info|warn|error` για παράκαμψη. Οι προειδοποιήσεις επικύρωσης σχήματος (αρχείο ρυθμίσεων ή θέματος που δεν ταιριάζει με το σχήμα του) καταγράφονται εδώ. Το κουμπί **Άνοιγμα αρχείου καταγραφής** στις Ρυθμίσεις δημιουργεί το αρχείο κατά απαίτηση, αν δεν έχει καταγραφεί τίποτα ακόμη.
