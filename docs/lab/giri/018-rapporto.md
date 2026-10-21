---
giro: 018
traguardo: T8
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-21T06:35:32Z
fine: 2026-10-21T07:16:00Z
pr: 25
ricerca_fonti: 0
critico_da_correggere: 3
critico_accolti: 3
revisore_bloccanti: 0
revisore_dubbi: 3
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 3
mutazioni_prese: 3
verify_rossi_locali: 0
test_totali: 285
test_delta: 36
decisioni_registro: 3
decisioni_ratifica: 1
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 018 — lista della spesa, parte server

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/018-agenti.json. -->

> **PR:** #25 · **Branch:** `claude/giro-018-t8` · **Traguardo:** T8 — parziale (solo server; app e Playwright al giro 019)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Il server ha la lista della spesa: un task con `template` «lista della spesa» ha voci che si aggiungono, spuntano, riordinano e si tolgono (se spuntate).
- Nella lista ciclica la nuova occorrenza riceve le voci non spuntate.
- Task demo «Lista della spesa» con 3 voci. Migrazione `V4__shopping_items.sql` (solo aggiunte).
- Nessuna schermata ancora: arriva col giro 019.
- Revisione umana richiesta (pr_guard): `Giro010DemoTasksAcceptanceTest` (tolta «Lista della spesa» dall'elenco dei task assenti, come nel giro 013); `Giro018ShoppingAcceptanceTest` corretto dopo la pubblicazione (decisione 64); modello-inatteso in `018-agenti.json` (revisore e orchestratore mancanti).
- Ratifica **018-a**: ogni membro scrive sulle voci di qualunque lista aperta della famiglia. Dichiarala letta nel modulo di merge.

## Cosa funziona ora — con la prova
- 5 endpoint e isolamento tra famiglie (prova: `Giro018*` 36 test verdi; `./mvnw -B -ntp verify` 280 test verdi).
- Concorrenza: 20 ripetizioni di aggiunte, spunte e riordino in parallelo senza doppioni (revisore).

## Cosa non funziona ancora
- App e Playwright (schermata, etichette it/en) del «Fatto quando» di T8.
- Il replay di una voce non controlla il `taskId` dell'URL: con la stessa `mutationId` verso un'altra lista della stessa famiglia risponde 200 con la voce della prima. Nessuna fuga tra famiglie; da correggere (409 `mutation_conflict`).
- `pr_guard.py` non eseguito dal revisore (hook): da eseguire in chiusura.

## Verdetto del revisore
- **BLOCCANTI:** nessuno
- **DUBBI:** 3 (replay su altra lista; replay dopo inoltro, rinviato a T9; pr_guard); nessuno corretto
- **PERIMETRO:** nessuna aggiunta non richiesta
- **CONCORRENZA:** 5 sonde × 20, tutte verdi
- **MUTAZIONI:** provate 3, prese 3

## Ricerca e critica
Nessuna ricerca (nessuna schermata). Critica: 3 punti, tutti accolti (test del giro 010, ordine del replay, riordino con id ripetuti).

## Proposte al metodo
nessuna

## Prossima fetta
Giro 019: costruzione di T8, parte app (con ricerca sull'uso della lista) e il dubbio del replay.
