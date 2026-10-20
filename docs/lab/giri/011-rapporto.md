---
giro: 011
traguardo: T5
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-20T18:28:59Z
fine: 2026-10-20T19:08:00Z
pr: 18
ricerca_fonti: 7
critico_da_correggere: 5
critico_accolti: 14
revisore_bloccanti: 0
revisore_dubbi: 3
dubbi_corretti: 0
fuori_perimetro: 1
mutazioni_provate: 3
mutazioni_prese: 3
verify_rossi_locali: 0
test_totali: 374
test_delta: 97
decisioni_registro: 4
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 011 — T5 parte 3: fatto, riapri, modifica, annulla e filtri

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/011-agenti.json. -->

> **PR:** #18 · **Branch:** `claude/giro-011-t5` · **Traguardo:** T5 — Fatto quando verde, da
> verificare in produzione
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Server: «Segna fatto», «Riapri», modifica (`PUT`) e annulla dei task (P7–P9), idempotenti, con `version` e `change_log`. Nessuna migrazione.
- App web: pulsanti «Segna fatto», «Riapri», «Annulla task» (con conferma) e filtri «Tutti», «Assegnati a me», «In coda», «In scadenza» (7 giorni, nel fuso della famiglia).
- Dati demo nuovi, inventati: risorsa Nina e 4 task in Famiglia Mamma.
- Il `PUT` non controlla `version`: vince l'ultima modifica, fino a T9 (decisione 38).
- Il modulo di modifica nell'app non c'è: il `PUT` si prova solo dall'API.
- Nessuna porta a senso unico, nessuna ratifica. Tocca solo percorsi non protetti, salvo l'esito di `pr_guard` qui sotto.
- Prossimo: giro verifica-produzione di T5.

## Cosa funziona ora — con la prova
- Accettazione server 32/32 e Playwright 28/28; suite completa Playwright 121 verdi (prova: revisore, SHA 9ecf000).
- `./mvnw verify` 180 test verdi; Jest 45; `tsc` ed `eslint` puliti; `expo export` web riesce.
- Concorrenza: done doppio in parallelo, done/cancel con stesso `mutationId`, reopen/assign e PUT/done in parallelo: sempre coerenti (sonda del revisore).

## Cosa non funziona ancora
- Modulo di modifica dell'app; scroll vero dell'elenco lungo; `PUT` senza controllo di `version` (T9).
- `me()` con errore di rete porta al login invece del messaggio di errore (dubbio 1, non corretto).
- `requeue` toglie l'assegnatario anche a task DONE/CANCELLED: «Riapri» porta in coda.
- Punti [DA VERIFICARE] (20/10/2026): `aria-pressed` in react-native-web 0.21.4: il costruttore lo ha letto nel sorgente installato e Playwright lo conferma; Jackson 3 in Boot 4 coperto solo dai test 400; effetto di `page.clock` su `Intl` non verificato (i test Jest usano orologio iniettato).

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** 3 (me() e login; `pr_guard` non eseguibile dal revisore; `011-agenti.json` non committato: lo scrive il hook, committato in chiusura). Nessuno corretto.
- **PERIMETRO:** 1, `ScrollView` in `tasks.tsx`.
- **CONCORRENZA:** sonda 10 giri per scenario, tutte verdi.
- **MUTAZIONI:** provate 3, prese 3.

## Ricerca e critica
Ricerca: 7 fonti, deboli (concorrenti non trovati). Critica: 15 punti, 14 accolti, 1 spostato (Jest su `filters.ts`, scritto dal costruttore).

## Proposte al metodo
nessuna

## Prossima fetta
Giro `verifica-produzione` di T5.
