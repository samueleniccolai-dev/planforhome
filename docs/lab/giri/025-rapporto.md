---
giro: 025
traguardo: T9
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-21T20:15:07Z
fine: 2026-10-21T20:36:49Z
pr: 35
ricerca_fonti: 0
critico_da_correggere: 1
critico_accolti: 1
revisore_bloccanti: 0
revisore_dubbi: 3
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 5
mutazioni_prese: 5
verify_rossi_locali: 0
test_totali: 151
test_delta: 34
decisioni_registro: 2
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 1
difetti: 024:maggiore
proposte_metodo: nessuna
---
# Rapporto del giro 025 — T9: correzioni del motore di sync (contestazioni 83 e 84)

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/025-agenti.json. -->

> **PR:** #35 · **Branch:** `claude/giro-025-t9` · **Traguardo:** T9 — parziale (cablaggio su Android ancora da fare)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Corretti i difetti del giro 024 che hai segnalato (contesto n. 83 e 84). Nessuna schermata cambia.
- Un task inoltrato tra due famiglie dello stesso utente non sparisce più dal telefono, in nessun ordine di lettura.
- Due modifiche offline allo stesso task non danno più 409 alla seconda: prende la `version` della risposta, ma solo se la risposta è davvero la scrittura della prima (il replay del server rende lo stato attuale; riscrivere alla cieca avrebbe perso la modifica di un altro).
- Una famiglia si cancella dal telefono solo con 404 `not_found` **e** assenza dall'elenco; una rotta mancante dopo un rollback non cancella più nulla.
- La logica SQL è ora in `sqlStore.ts` ed è provata con `node:sqlite`, senza dipendenze nuove.
- Nessun percorso protetto toccato; nessuna ratifica.

## Cosa funziona ora — con la prova
- Accettazione 025: 34/34 (17 casi × memoria e SQLite); 024: 21/21; Jest 88/88; tsc ed eslint verdi (revisore, SHA 9e452bc).

## Cosa non funziona ancora
- Cablaggio del motore su Android (sessione, schermate, logout con `clear()`) e prova di `sqliteStore.ts` su telefono.
- Un 404 in `sendQueue` toglie la modifica dalla coda con avviso; un 404 incerto su una famiglia ferma il ciclo e quindi le famiglie lette dopo.
- Una rinomina offline dopo un `done`/`take`/`assignee` riceve sempre 409 con avviso (prudente, senza perdite).
- Se l'utente tocca di continuo durante l'invio, il ciclo non finisce finché la coda non è vuota.

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** 3 (coda mai vuota, 404 ripetuto, rinomina dopo `done`), tutti minori, nel rapporto.
- **PERIMETRO:** solo `app/src/sync/` e un test Jest adattato; 0 fuori perimetro.
- **CONCORRENZA:** 4 sonde (cicli paralleli, tocco durante l'invio, inoltro nei due ordini, risposta persa) senza perdite né doppioni.
- **MUTAZIONI:** provate 5, prese 5.

## Ricerca e critica
Il critico ha trovato un punto: la riscrittura cieca della `version` perde la modifica di un altro client sul replay. Accolto: regola `+1`, test C7b e C7c.

## Proposte al metodo
nessuna

## Prossima fetta
Giro 026: T9 parte 3, cablaggio su Android; poi verifica-produzione.

## Riparazione 1 (2026-10-21)

CI rossa solo nel job `apk`: l'installazione dell'NDK 27.1.12297006 è fallita con `ZipException: Archive is not a ZIP archive` (download corrotto dal runner). Lab, server e app verdi. Non viene dal codice: nessuna modifica, la CI riparte con `pronta`.
