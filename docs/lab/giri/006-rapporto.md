---
giro: 006
traguardo: T4
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-20T05:35:20Z
fine: 2026-10-20T06:20:00Z
pr: 13
ricerca_fonti: 0
critico_da_correggere: 5
critico_accolti: 5
revisore_bloccanti: 1
revisore_dubbi: 4
dubbi_corretti: 2
fuori_perimetro: 0
mutazioni_provate: 3
mutazioni_prese: 3
verify_rossi_locali: 0
test_totali: 109
test_delta: 34
decisioni_registro: 4
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti: 006:bloccante
proposte_metodo: nessuna
---
# Rapporto del giro 006 — T4 parte 1: famiglie, persone e ruoli (server)

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/006-agenti.json. -->

> **PR:** #13 · **Branch:** `claude/giro-006-t4` · **Traguardo:** T4 — parziale (solo server; schermate e test Playwright nella parte 2; il test del ritorno dei task in coda è di T5)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Chi è già registrato può creare una famiglia e usare un codice d'invito; un gestore aggiunge risorse (con referente), cambia ruoli e referenti, toglie appartenenze; chiunque può lasciare una famiglia.
- Regole P13–P15 di SPEC §5 applicate dal server: mai famiglia senza gestore, mai persona senza famiglia (l'account si disattiva alla perdita dell'ultima).
- Solo API: nessuna schermata nuova, nessun effetto visibile su `app.planforhome.com`.
- Nessuna migrazione, nessuna dipendenza nuova, nessuna porta a senso unico.
- La PR tocca solo `server/`, test e `docs/lab/`: nessun motivo di revisione umana, salvo quanto dice `pr_guard`.
- Nessuna ratifica.

## Cosa funziona ora — con la prova
- 34 test di accettazione nuovi, tutti verdi (`Giro006*AcceptanceTest`); `./mvnw -B -ntp verify`: 109 test verdi.
- Isolamento tra famiglie: il test parametrico del giro 003 percorre da solo i nuovi endpoint.
- Concorrenza: 4 gare provate 10 volte (ultimi gestori, ultime appartenenze, join contro remove, doppio invio); sonda del revisore 120 giri su create contro remove: 0 violazioni.

## Cosa non funziona ancora
- Nessuna schermata (parte 2 di T4, con Playwright per Luca e Giulia).
- Il ritorno dei task in coda quando si toglie un'appartenenza: `onMembershipRemoved` è vuoto, lo riempie T5. T4 non può passare prima.
- Il test di concorrenza `FamilyCreateConcurrencyTest` non prende la mutazione «tolto solo il ricontrollo di `isDisabled`» (la sonda HTTP del revisore sì). Va reso HTTP o alternato.
- I due fix piccoli (id malformato → 400, replay con fuso diverso → 409) non hanno un test di accettazione dedicato.
- Un errore interno arriva al client come 401 a corpo vuoto (già così prima del giro): maschera i 5xx.

## Verdetto del revisore
- **BLOCCANTI:** 1 (`create` senza lock su `person`: 201 ma account disattivato) — risolto in 850f94e, riverificato (0 bloccanti sul SHA 084bc9e).
- **DUBBI:** 4; corretti 2 (id malformato, fuso nel replay); gli altri sopra.
- **PERIMETRO:** nessuna aggiunta fuori piano; 497 righe in `server/src/main` contro 450 previste (javadoc, Spotless).
- **CONCORRENZA:** ordine dei lock fisso `family` poi `person`; sonde verdi.
- **MUTAZIONI:** provate 3, prese 3 (più 3 sulla correzione, 3 prese).

## Ricerca e critica
Nessuna ricerca (API senza schermate). Critico: 5 punti «da correggere», tutti accolti (precedenza dei controlli, doppio invio, `id` delle risorse, `already_member` senza consumare il codice, lock sul referente), più i test mancanti.

## Proposte al metodo
nessuna

## Prossima fetta
T4 parte 2 (schermate e Playwright), oppure prima il login su Android (DECISIONI n. 22).
