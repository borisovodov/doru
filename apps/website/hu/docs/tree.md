---
source-hash: fc4f60af6671
---

# A családfa használata

A fa interaktív vászonként nyílik meg. Az alábbiak mind a vásznon történnek; a személylista a bal oldali tevékenységsáv **Személyek** nézetében található.

## Navigáció

- **Eltolás** a háttér húzásával, **nagyítás** a görgővel vagy az érintőpaddal; a nagyítás gombjai a vászon sarkában vannak.
- **Fókuszálás** egy személyre a kártyájára való dupla kattintással. Az ablak Vissza/Előre gombjai visszavisznek a korábbi lapokhoz és fahelyzetekhez.
- **Ősök és utódok** mindig együtt láthatók: szülők és nagyszülők a fókusz felett, gyermekek
  alatta.
- **Keresés**: írjon be egy nevet az eszköztár keresőmezőjébe, és válasszon egy találatot az adott személyhez ugráshoz.

## Kártyák

Minden kártya egy monogram-avatart, a nevet, az élettartam éveit (elhunyt személyeknél † jellel) és kis jelvényeket mutat, amelyek a jegyzeteket, forrásokat és médiát számolják. A bal szél az apa (kék) és az anya (rózsaszín) vonalát jelöli az ősábrákon; a kiemelt keret a fókuszban lévő személyt jelöli.

## Szerkesztés

Válasszon ki egy kártyát a műveleti eszköztár megjelenítéséhez:

- **Gyermek / házastárs / szülő hozzáadása** — egy új, üres kártya jelenik meg a személy mellett; írja be a nevet közvetlenül a kártyára, és erősítse meg a pipával (az X elveti).
- **Szerkesztés** — megnyitja a teljes személyszerkesztőt lapként: nevek, nem, születési/halálozási dátumok minőségjelölővel (*Pontos / Körülbelül / Előtt / Után*) és szabad szöveges formával (például egy „23 Nivôse” naptári dátum, amely nem feleltethető meg a Gergely-naptárnak), családok, események, források, jegyzetek és média.
- **Törlés** — eltávolítja a személyt a fából és minden családból.

Egy új (üres) fa egyetlen üres kártyát mutat: kattintson rá, írja be a nevet, erősítse meg a pipával, és az első személy megjelenik a vásznon. Ezután a fát magukról a kártyákról növesztheti.

## Családok

A teljes személyszerkesztőben adjon hozzá szülőket, partnert vagy gyermekeket. Írjon be egy nevet egy meglévő személy kiválasztásához; a chipek az egyes családok tagjait mutatják. Egy személy eltávolítása egy családból vagy egy család törlése egyetlen kattintás.

## Források és jegyzetek

- **Források**: csatoljon forrásokat egy személyhez (címmel és szerzővel), vagy használjon újra egy meglévő forrást. Minden csatolás egy hivatkozás, és eltávolítható.
- **Jegyzetek**: egy személyhez csatolt szabad formájú kutatási jegyzetek. Minden jegyzet egyetlen rekordhoz tartozik: a rekord Jegyzetek szakaszában adhatja hozzá, szerkesztheti vagy törölheti. Az importált GEDCOM-fájl megosztott jegyzetét minden hivatkozó rekordhoz átmásoljuk.

## Címek

A **Források** nézetben van egy **Címek** szakasz. Itt önálló címeket hozhat létre, szerkeszthet és törölhet. A tények, levéltárak vagy beküldők által használt címek mutatják a használati számukat; egy törlése leválasztja azokról a rekordokról. Egy tény címválasztójában **Új cím** és **Cím szerkesztése** műveletek is vannak a cím helyben történő szerkesztéséhez.

## Feladatok

A feladatoknak létrehozási dátumuk és egy emlékeztető dátumuk van. A feladat lezárása csak az állapotát változtatja meg; külön befejezési dátum nem kerül mentésre. A legtöbb szerkesztőnek van **Feladatok** szakasza: adjon hozzá ott egy feladatot, és az automatikusan ahhoz a rekordhoz kapcsolódik. Kivétel a feladat- és a beküldő-szerkesztő: a feladatkártya megőrzi a Jegyzeteket és a Médiát, a beküldő kártyáján nincs Feladatok szakasz, és a médiakapcsolat nem célja feladatoknak. A tények és nevek saját Feladatok szakasszal rendelkeznek a csatolási panelükön. A hivatkozásnak csak Jegyzetek szakasza van, ezért a bizonyítékokhoz kapcsolódó feladatokat a forrásához csatolja. A **Kapcsolódó** egy feladatot egy vagy több rekordhoz kapcsol a fában — személyhez, családhoz, eseményhez, névhez, forráshoz, médiához, helyhez, levéltárhoz, címhez vagy műhöz, de nem egy másik feladathoz, beküldőhöz, hivatkozáshoz vagy médiakapcsolathoz; hagyja üresen egy szabadon álló feladathoz. A feladat megosztott: bárhol szerkesztve ugyanazt a rekordot frissíti, és egy kapcsolódó rekord törlése helyben hagyja a feladatot. A **Meglévő feladat csatolása** lehetőséggel új feladat létrehozása helyett újra felhasználhat egy megosztott feladatot.

A művek, címek, társítások és családi partner/gyermek kapcsolatok ugyanazokkal a Jegyzetek, Források és Feladatok szakaszokkal rendelkeznek, mint a fő entitáslapok. Az elérhetőségek ahhoz a személyhez, tényhez, levéltárhoz vagy beküldőhöz tartoznak, akit vagy amit leírnek, nem egy címhez. A feladatok megőrzik a Jegyzeteket és a Médiát, de nincs Forrásuk, Elérhetőségük, Közreműködőjük vagy Feladatuk. A médiakapcsolat nem csatolási cél. A közreműködők csak a személy- és családkártyákon érhetők el.

## Média

A fényképek közönséges fájlok a projekt melletti `media/` mappában. Adja hozzá őket egy személytől, családtól, forrástól, helytől, levéltártól, beküldőtől, műtől, feladattól vagy címtől; a médialap **Kapcsolódó** szakasza kezeli azokat a rekordokat, amelyekhez ez a média kapcsolódik. Minden médiakártya pontosan egy fájlt tartalmaz. Kattintson egy előnézetre a média lap megnyitásához, ahol szerkesztheti a címet és a dátumot. A cél Médiája szakaszában lévő csillaggal válassza ki a fő fotót.

Egy médiarekord több célhoz vagy egyhez sem kapcsolható. A **Leválasztás erről a rekordról** egy hivatkozást távolít el, és minden hivatkozásnál elérhető, beleértve az utolsót is; a média a könyvtárban marad. A **Média törlése** eltávolítja a rekordot és a fájlmásolatát. Egy célrekord törlése csak a hivatkozásait távolítja el, így egy médiarekord hivatkozások nélkül is megmaradhat. A több fájlt tartalmazó GEDCOM `OBJE` importja fájlonként egy kártyát hoz létre; az alternatív `TRAN` formátumok nem importálhatók.

## Sorrendezés

Azok a listák, amelyeknél a sorrend számít — nevek, családi partnerek és gyermekek, helynevek, címsorok és tényrésztvevők — fel/le vezérlőkkel rendelkeznek. A sorrend sorpozícióként tárolódik.
