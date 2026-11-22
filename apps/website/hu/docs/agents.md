---
source-hash: b3dd07f80d43
---

# MI és ügynökök

## A beépített csevegés

A csevegőpanel az ablak alján található. Írjon be egy kérdést, és az ügynök beépített eszközökkel olvashatja és szerkesztheti a fát: `tree_query`, `tree_get`, `tree_stats`, `tree_edit`, `tree_add_relative`, `sources_add`, `notes_write`.

A beszélgetések **csevegési munkamenetekként** mentődnek: a csevegőpanel fejléce listázza a munkameneteit, és válthat közöttük, új csevegést indíthat vagy törölheti őket. A munkamenetek projektenként az alkalmazás adatkönyvtárában tárolódnak (nem a `.doru` fájlon belül), a címet az első üzenete adja, és minden túléli az alkalmazás újraindítását. Minden válasznak van egy másológombja, amely a nyers markdownt a rendszer vágólapjára teszi.

A szolgáltató a `settings.json` `ai` szakaszában konfigurálható (lásd [Beállítások](settings.md)):

- **Szolgáltató-előbeállítások**: Ollama, LM Studio, egyéni OpenAI-kompatibilis végpont vagy ACP-ügynök. A felhő-előbeállítások egyenként térnek vissza, ahogy integrációik újraépülnek. Az azonosítót a `"provider"` mezőben adja meg; minden előbeállítás alapértelmezett alap URL-t biztosít, a modellt pedig a Beállítások varázslóban választja ki — helyi végpontoknál a szolgáltatótól lekért, felhő-előbeállításoknál a szállított katalógusból választott modellt. Minden szolgáltató megtartja saját konfigurációját (modell, alap URL, következtetés, kulcs) a `"providers"` alatt — a szolgáltatóváltás visszaállítja az egyes szolgáltatók mentett beállításait.
- **Az API-kulcsok** a `secrets.json` fájlban (0600 mód) tárolódnak az alkalmazás adatkönyvtárában, szolgáltató-azonosítóval kulcsolva. A kulcs soha nem jelenik meg a beállításfájlban.

## Dóru AI (offline asszisztens)

Az alapértelmezett szolgáltató a **Dóru AI**: egy helyi asszisztens, amely teljes egészében a számítógépén fut. Töltse le egyszer az MI-beállításokban (egyetlen fájl, körülbelül 3 GB); utána a csevegés fiók és internetkapcsolat nélkül működik. Friss telepítésen alapértelmezés szerint ez van kiválasztva, és legalább 8 GB RAM-ot igényel.

A letöltött modell a Qwen3.5-4B (Q4_K_M kvantált GGUF, Apache-2.0 licenc — lásd a [modellkártyát](https://huggingface.co/Qwen/Qwen3.5-4B)). A súlyokat SHA-256 rögzíti az alkalmazás manifesztjében, és minden letöltés után ellenőrzésre kerülnek.

## ACP-ügynökök

Állítsa be a `"ai": { "provider": "acp", "providers": { "acp": { "command": "…", "args": [] } } }` értéket, hogy olyan ügynökkel beszéljen, amely az Agent Client Protocolt (Zed-stílusú ügynökök) beszéli. A Dóru MCP-kiszolgálóként adja át a projektet az ügynöknek, így az ugyanúgy lekérdezheti és szerkesztheti a fát, mint a beépített csevegés.

## A Dóru mint MCP-kiszolgáló

Bármely MCP-kliens — Claude Desktop, Cursor, kódoló ügynökök — dolgozhat a fával. Futtassa a Dóru-t kiszolgáló módban, a `.doru` fájlra mutatva:

```sh
doru --mcp-server /absolute/path/to/family.doru
```

Claude Desktop konfigurációs példa (`Claude → Settings → Developer → Edit Config`):

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

Linux AppImage: az AppImage fájl elérési útja. Windows: `"command": "C:\\Program Files\\Doru\\doru.exe"`. Az eszköznevek az UI nyelvétől függetlenül angolul maradnak.

A kiszolgáló **fej nélküli és állapotmentes**: nincs ablak, nincs dock ikon, nincsenek csevegési munkamenetek — közvetlenül olvassa és szerkeszti a fa fájlját, és kilép, amikor a kliens leválik. Bármennyi kliens mutathat ugyanarra a fájlra egyszerre (Claude Desktop, Cursor, több kódoló ügynök); az egyidejű írások biztonságosan sorba állnak. Ha egy kliens nem tudja elindítani a kiszolgálót, futtassa a parancsot egy terminálban — a segédprogram a stderr-re naplózza a problémákat, és ideiglenes profilja kilépéskor eldobásra kerül.

## Példakérdések

- *„Keresse meg mindazokat, akik 1850 előtt születtek, és listázza a forrásaikat.”*
- *„Adja hozzá Ivan Ivanovot, aki körülbelül 1923-ban született, Petr és Maria gyermekeként.”*
- *„Írjon kutatási jegyzetet Annáról az 1901-es népszámlálással kapcsolatban.”*
- *„Ellenőrizze a fámat, vannak-e olyan emberek, akik a szüleik halála után születtek.”*
