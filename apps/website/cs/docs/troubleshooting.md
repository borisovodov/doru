---
source-hash: 6953c7a55202
---

# Řešení problémů

- **Projekt `.doru` ze staršího buildu se odmítá otevřít** — před 1.0 se
  schéma projektu mění bez migrací, takže soubory zapsané jiným buildem nejsou
  srozumitelné. Otevřete projekt v buildu, který ho vytvořil, exportujte GEDCOM
  a importujte tento soubor do aktuálního buildu.
- **„Poskytovatel AI není nakonfigurován“** — otevřete Nastavení (ikona
  ozubeného kola na levém panelu), vyberte poskytovatele a postupujte podle
  průvodce: načtěte seznam modelů (nebo vyberte model) a v případě potřeby
  uložte klíč.
- **Připojení k Ollamě selhává** — vyberte předvolbu Ollama (základní URL
  `http://localhost:11434/v1`); klíč API není potřeba. Stiskněte „Načíst modely
  od poskytovatele“ — pokud hlásí, že poskytovatel je nedostupný, ujistěte se,
  že Ollama běží lokálně.
