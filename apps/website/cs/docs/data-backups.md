---
source-hash: fbf10a17cf6e
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
  je vše. Obnovení znamená zkopírovat zpět soubor `.doru` i složku `media/`,
  zatímco je projekt zavřený a nezapisuje do něj žádný jiný proces. Po havárii
  otevřete projekt jednou v Dóru, aby SQLite mohl obnovit případný zbývající
  žurnál, a potom ho před kopírováním nebo obnovením zavřete. Pokud projekt
  nelze otevřít, odsuňte poškozený soubor `.doru` a případný zbývající žurnál
  stranou, než budete obnovovat.
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
zapisující procesy. Řádně zavřený projekt, do kterého nezapisuje nikdo jiný, lze
bezpečně zkopírovat. Po havárii otevřete projekt jednou v Dóru, aby SQLite mohl
vrátit zpět případný zbývající žurnál, a potom ho před kopírováním zavřete.
Pokud projekt nelze otevřít, odsuňte poškozený soubor a případný zbývající
žurnál stranou, než obnovíte zálohu.
