---
source-hash: ef244a894dd8
---

# Práce se stromem

Strom se otevírá jako interaktivní plátno. Vše níže se odehrává přímo na plátně;
seznam osob žije v pohledu **Osoby** na levém panelu aktivit.

## Navigace

- **Posouvejte** tažením pozadí, **přibližujte** kolečkem myši nebo
  trackpadem; tlačítka přiblížení jsou v rohu plátna.
- **Znovu zaostřete** na osobu dvojklikem na její kartu. Tlačítka Zpět/Vpřed v okně vás vrátí na předchozí karty a pozice ve stromu.
- **Předci a potomci** se vždy zobrazují společně: rodiče a prarodiče nad fokusem, děti pod
  ním.
- **Hledání**: napište jméno do vyhledávacího pole na panelu nástrojů a
  vyberte výsledek, abyste na danou osobu přeskočili.

## Karty

Každá karta zobrazuje avatar s iniciálami, jméno, roky života (s † u zemřelých
osob) a malé odznaky s počtem poznámek, pramenů a médií. Levý okraj označuje
otcovskou (modrou) a mateřskou (růžovou) linii v grafech předků; zvýrazněný
rámeček označuje osobu ve fokusu.

## Úpravy

Vyberte kartu a zobrazí se panel nástrojů akcí:

- **Přidat dítě / partnera / rodiče** — vedle osoby se objeví nová prázdná
  karta; napište jméno přímo do karty a potvrďte je zaškrtnutím (křížek ji
  zahodí).
- **Upravit** — otevře úplný editor osoby jako kartu: jména, pohlaví, data
  narození/úmrtí s ukazatelem kvality (*Přesně / Přibližně / Před / Po*) a pole
  volného textu pro datum (např. kalendářní datum „23 Nivôse“, které
  neodpovídá gregoriánskému), rodiny, události, prameny, poznámky a média.
- **Smazat** — odstraní osobu ze stromu a ze všech rodin.

Nový (prázdný) strom zobrazuje jednu prázdnou kartu: klikněte na ni, napište
jméno, potvrďte zaškrtnutím a na plátně se objeví první osoba. Poté nechte
strom růst z karet samotných.

## Rodiny

V úplném editoru osoby přidejte rodiče, partnera nebo děti. Napište jméno pro
výběr existující osoby; chipy zobrazují členy každé rodiny. Odebrání osoby z
rodiny nebo smazání rodiny je jeden klik.

## Prameny a poznámky

- **Prameny**: připojte k osobě prameny (s názvem a autorem) nebo znovu
  použijte existující pramen. Každá příloha je citace a lze ji odebrat.
- **Poznámky**: volné výzkumné poznámky připojené k osobě. Každá poznámka patří jednomu záznamu: přidejte, upravte nebo smažte ji v sekci Poznámky daného záznamu. Sdílená poznámka z importovaného souboru GEDCOM se zkopíruje ke každému záznamu, který na ni odkazuje.

## Adresy

Pohled **Prameny** má sekci **Adresy**. Použijte ji k vytváření, úpravám a
mazání samostatných adres. Adresy používané událostmi, archivy nebo odesílateli
zobrazují počet použití; smazáním adresy ji odpojíte od těchto záznamů. Výběr
adresy u události má také akce **Nová adresa** a **Upravit adresu** pro úpravu
adresy přímo na místě.

## Úkoly

Úkoly mají datum vytvoření a datum připomenutí. Uzavření úkolu mění pouze jeho stav; samostatné datum dokončení se neukládá. Většina editorů má sekci **Úkoly**: přidejte tam úkol a automaticky se propojí s daným záznamem. Výjimkou jsou editor úkolu a editor odesílatele: karta úkolu si ponechává Poznámky a Média, karta odesílatele nemá sekci Úkoly a mediální vazba není cílem úkolů. Události, jména a citace mají vlastní sekci Úkoly ve svém panelu příloh. **Související s** propojí úkol s jedním nebo několika záznamy ve stromu — osobou, rodinou, událostí, jménem, zdrojem, citací, médiem, místem, archivem, adresou nebo dílem, ale ne s dalším úkolem, odesílatelem nebo mediální vazbou; ponechte prázdné pro samostatný úkol. Úkol je sdílený: úprava kdekoli aktualizuje stejný záznam a smazání souvisejícího záznamu úkol ponechá na místě. Pomocí **Připojit existující úkol** můžete znovu použít sdílený úkol místo vytvoření nového.

Díla, adresy, spojení a vazby partnera/dítěte v rodinách mají stejné sekce Poznámky, Prameny a Úkoly jako karty hlavních entit. Kontakty patří osobě, události, archivu nebo odesílateli, který je popisuje, ne adrese. Úkoly si zachovávají Poznámky a Média, ale nemají Prameny, Kontakty, Přispěvatele ani Úkoly. Mediální vazba není cílem příloh. Přispěvatelé jsou dostupní pouze na kartách osoby a rodiny.

## Média

Fotografie jsou obyčejné soubory ve složce `media/` vedle projektu. Přidejte je z osoby, rodiny, pramene, místa, archivu, odesílatele, díla, úkolu nebo adresy; sekce **Související s** na kartě médií spravuje záznamy, ke kterým je toto médium připojeno. Každá karta média obsahuje právě jeden soubor. Kliknutím na náhled otevřete kartu médií, kde můžete upravit název a datum. Hvězdičkou v sekci Média na kartě cíle zvolte jeho hlavní fotografii.

Mediální záznam lze propojit s několika cíli nebo s žádným. **Odpojit od tohoto záznamu** odebere jedno propojení a je dostupné pro každé propojení, včetně posledního; médium zůstane v knihovně. **Smazat médium** odstraní záznam a kopii jeho souboru. Smazání cílového záznamu odstraní pouze jeho propojení, takže mediální záznam může zůstat bez propojení. Médium importované z GEDCOM `OBJE` s několika soubory se změní na kartu pro každý soubor; alternativní formáty `TRAN` se neimportují.

## Řazení

Seznamy, u nichž záleží na pořadí — jména, partneři a děti rodiny, názvy míst,
řádky adresy, účastníci událostí a pole šablon — mají ovládání nahoru/dolů.
Pořadí se ukládá jako pozice řádku.
