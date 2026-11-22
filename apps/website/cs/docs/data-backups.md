---
source-hash: e207f75e832a
---

# Data a zálohy

- Vaše data jsou obyčejný soubor — a zůstávají vaše. Dóru nemá účty, žádný
  cloudový backend ani telemetrii. Nic se nikam nenahrává, pokud *vy*
  nenastavíte poskytovatele AI — a i tehdy opouští váš počítač jen obsah, který
  odešlete v chatu. Pokud chcete mít vše na svém počítači, místní poskytovatelé
  (Ollama, LM Studio) fungují zcela offline.
- Zálohování: zkopírujte soubor `.doru` (a vedlejší složku `media/`, pokud máte
  fotky). To je vše. Obnovení znamená zkopírovat ho zpět.
- Soubor je vhodný pro správu verzí: je to stabilní binární soubor — klidně ho
  uložte do gitu commitem.

## Synchronizace mezi počítači

Dóru nemá vestavěný synchronizační mechanismus — projekty jsou obyčejné soubory
a jejich synchronizace je na vás: iCloud Drive, Dropbox, rclone, rsync, USB
flash disk, cokoli preferujete.

Jedno upozornění: soubor `.doru` je databáze SQLite a synchronizace
**otevřeného** projektu v reálném čase pomocí nástroje pro synchronizaci
souborů může zkopírovat soubor v napůl zapsaném stavu a poškodit ho. Bezpečný
postup je: před synchronizací projekt (nebo aplikaci) zavřete. Kopírování
zavřeného projektu je vždy bezpečné.
