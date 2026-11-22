---
source-hash: b3dd07f80d43
---

# AI a agenti

## Chat v aplikaci

Panel chatu je ve spodní části okna. Napište otázku a agent může číst a
upravovat strom pomocí vestavěných nástrojů: `tree_query`, `tree_get`,
`tree_stats`, `tree_edit`, `tree_add_relative`, `sources_add`, `notes_write`.

Konverzace se ukládají jako **chatové relace**: záhlaví panelu chatu uvádí vaše
relace a můžete mezi nimi přepínat, zahájit nový chat nebo je smazat. Relace se
ukládají pro každý projekt ve složce s daty aplikace (ne uvnitř souboru
`.doru`), název pochází z vaší první zprávy a vše přežije restart aplikace.
Každá odpověď má tlačítko pro kopírování, které vloží její surový markdown do
systémové schránky.

Poskytovatel se konfiguruje v sekci `ai` souboru `settings.json` (viz
[Nastavení](settings.md)):

- **Předvolby poskytovatelů**: Ollama, LM Studio, vlastní endpoint kompatibilní
  s OpenAI nebo agent ACP. Cloudové předvolby se vracejí jedna po druhé, jak se
  jejich integrace znovu budují. Nastavte ID v `"provider"`; každá předvolba
  poskytuje výchozí základní URL, zatímco model se vybírá v průvodci
  nastavením — u lokálních endpointů se načte od poskytovatele, u cloudových
  předvoleb se vybere z dodávaného katalogu. Každý poskytovatel si uchovává
  vlastní konfiguraci (model, základní URL, uvažování, klíč) pod `"providers"`
  — přepnutí poskytovatele obnoví uložené nastavení každého z nich.
- **Klíče API** se ukládají do `secrets.json` (režim 0600) ve složce s daty
  aplikace, podle ID poskytovatele. Klíč se nikdy neobjeví v souboru nastavení.

## Dóru AI (offline asistent)

Výchozím poskytovatelem je **Dóru AI**: lokální asistent, který běží zcela na
vašem počítači. Stáhněte ho jednou v nastavení AI (jeden soubor, asi 3 GB);
poté chat funguje bez účtu a bez připojení k internetu. Při čisté instalaci je
vybrán ve výchozím nastavení a vyžaduje alespoň 8 GB RAM.

Stažený model je Qwen3.5-4B (GGUF kvantovaný Q4_K_M, licence Apache-2.0 — viz
[karta modelu](https://huggingface.co/Qwen/Qwen3.5-4B)). Váhy jsou v manifestu
aplikace zafixovány pomocí SHA-256 a po každém stažení se ověřují.

## Agenti ACP

Nastavte `"ai": { "provider": "acp", "providers": { "acp": { "command": "…",
"args": [] } } }`, chcete-li mluvit s agentem, který komunikuje přes Agent
Client Protocol (agenti ve stylu Zed). Dóru předá projekt agentovi jako server
MCP, takže agent může dotazovat a upravovat strom stejně jako vestavěný chat.

## Dóru jako server MCP

Jakýkoli klient MCP — Claude Desktop, Cursor, programovací agenti — může
pracovat s vaším stromem. Spusťte Dóru v režimu serveru s odkazem na soubor
`.doru`:

```sh
doru --mcp-server /absolute/path/to/family.doru
```

Příklad konfigurace Claude Desktop
(`Claude → Settings → Developer → Edit Config`):

```json
{
  "mcpServers": {
    "doru": {
      "command": "/Applications/Doru.app/Contents/MacOS/doru",
      "args": ["--mcp-server", "/Users/you/FamilyHistory/family.doru"]
    }
  }
}
```

Linux AppImage: cesta k souboru AppImage. Windows:
`"command": "C:\\Program Files\\Doru\\doru.exe"`. Názvy nástrojů zůstávají v
angličtině bez ohledu na jazyk rozhraní.

Server je **headless a bezstavový**: žádné okno, žádná ikona v docku, žádné
chatové relace — čte a upravuje soubor stromu přímo a po odpojení klienta
skončí. Na stejný soubor může současně ukazovat libovolný počet klientů (Claude
Desktop, Cursor, několik programovacích agentů); souběžné zápisy se bezpečně
řadí do fronty. Pokud klient server nedokáže spustit, spusťte příkaz v
terminálu — pomocník zapisuje problémy na stderr a jeho dočasný profil se při
ukončení zahodí.

## Příklady promptů

- *„Najdi všechny narozené před rokem 1850 a vypiš jejich prameny.“*
- *„Přidej Ivana Ivanova, narozeného kolem roku 1923, jako dítě Petra a
  Marie.“*
- *„Napiš výzkumnou poznámku o Anně k sčítání lidu z roku 1901.“*
- *„Zkontroluj můj strom na osoby narozené po smrti jejich rodičů.“*
