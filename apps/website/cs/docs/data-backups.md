---
source-hash: 0feae5711b39
---

# Data a zálohy

- Vaše data jsou obyčejný soubor — a zůstávají vaše. Dóru nemá účty, žádný
  cloudový backend ani telemetrii. Nic se nikam nenahrává, pokud *vy*
  nenastavíte vzdáleného poskytovatele AI — a i tehdy se tomuto poskytovateli
  odesílají zprávy z chatu a data stromu, která si asistent načte
  prostřednictvím svých nástrojů. Pokud chcete mít vše na svém počítači, místní
  poskytovatelé (Ollama, LM Studio) fungují zcela offline.
- Zálohování: zastavte všechny procesy, které mohou do projektu zapisovat —
  zavřete ho v Dóru a zastavte všechny MCP klienty nebo jiné nástroje — a potom
  zkopírujte soubor `.doru` (a vedlejší složku `media/`, pokud máte fotky). To
  je vše. Obnovení znamená zkopírovat ho zpět, zatímco je projekt zavřený a
  nezapisuje do něj žádný jiný proces.
- Relace chatu se ukládají do datového adresáře aplikace, ne do souboru `.doru`;
  zálohujte je samostatně, pokud je potřebujete.
- Soubor je vhodný pro správu verzí: je to stabilní binární soubor — klidně ho
  uložte do gitu commitem.

## Synchronizace mezi počítači

Dóru nemá vestavěný synchronizační mechanismus — projekty jsou obyčejné soubory
a jejich synchronizace je na vás: iCloud Drive, Dropbox, rclone, rsync, USB
flash disk, cokoli preferujete.

Jedno upozornění: soubor `.doru` je databáze SQLite a synchronizace
**otevřeného** projektu v reálném čase pomocí nástroje pro synchronizaci souborů
může zkopírovat soubor v napůl zapsaném stavu a poškodit ho. Bezpečný postup je:
před synchronizací projekt (nebo aplikaci) zavřete a zastavte všechny ostatní
zapisující procesy. Kopírování projektu, který je zavřený a do kterého
nezapisuje nikdo jiný, je vždy bezpečné. Po havárii otevřete projekt jednou
v Dóru, aby SQLite mohl vrátit zpět případný zbývající žurnál, a potom ho před
kopírováním zavřete.
