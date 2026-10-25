---
giro: 047
traguardo: T13
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-25T12:01:04Z
fine: 2026-10-25T13:04:31Z
pr: 71
ricerca_fonti: 3
critico_da_correggere: 5
critico_accolti: 5
revisore_bloccanti: 0
revisore_dubbi: 2
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 3
mutazioni_prese: 2
verify_rossi_locali: 1
test_totali: 975
test_delta: 22
decisioni_registro: 3
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 047 — T13 parte 2: vista famiglia sul kit della lista

<!-- Modelli e token non stanno qui: li registra 047-agenti.json. -->

> **PR:** #71 · **Branch:** `claude/giro-047-t13` · **Traguardo:** T13 — Fatto quando verde, da
> verificare in produzione (un traguardo passa solo con un giro verifica-produzione)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- La lista dei task nella vista famiglia (`TasksSection`) è composta solo dal kit: sezioni, card con checkbox, «Prendi» grande, badge, avviso con «Annulla» senza timer, stato vuoto con «Aggiungi».
- Le azioni secondarie (inoltra, assegna, annulla, riapri, sollecita) restano sulla riga, nello slot `actions` della card; «Sollecita» resta lì finché non c'è un dettaglio (DESIGN §6.5).
- Un solo blocco di scrittura per sezione; l'undo si azzera a ogni altra scrittura; su Android l'undo di «fatto» va in rete e la lista si aggiorna.
- La card ricorrente aperta mostra «Prossima: …» anche su `/tasks` (effetto del riuso di `TaskCard`, non chiesto dal piano).
- **Revisione umana richiesta:** il commit `test(acceptance)` `5ea8ee1` adatta 7 test vecchi (010, 011, 013, 014, 016, 019, 031) ai nuovi selettori, solo selettori; e il giro tocca 11 file di produzione contro 8 del budget.
- Il guard segnala `modello-inatteso`: in `047-agenti.json` mancano i modelli attesi di critico, costruttore-tdd, revisore e orchestratore (scritti dal hook, non a mano).
- Da fare sul telefono (F1): prova dell'APK e fontScale 2.0 reali, non fatte dalla catena.
- Ratifiche: nessuna.

## Cosa funziona ora — con la prova
- Accettazione 047 (19 test, rossi su `840a91f`): verdi. Playwright completo 353/353, Jest 175/175, tsc, eslint, prettier; server `./mvnw verify` 445 test verdi (revisore).
- Nessun colore letterale né `StyleSheet` in `TasksSection.tsx` (F12).
- Screenshot 2 viewport × fontScale 1.0 e 2.0 su `/family?fs=2`.

## Cosa non funziona ancora
- Nessun dettaglio del task: «Sollecita» e le azioni secondarie non sono in un menu (T14, `Sheet`).
- Form e dialog restano al vecchio stile (T14); il resto di `family.tsx` è T15.
- «Riapri» non è nella coda Android.
- Nessuna prova sul telefono vero.
- Chiavi i18n `task.take` e `task.markDone` ora inutilizzate.

## Verdetto del revisore
- **BLOCCANTI:** 0
- **DUBBI:** 2, non corretti. (1) La guardia sincrona `inFlight` in `exclusive` non è provata: togliendola i test restano verdi; con due clic nello stesso tick su task diversi partono 3 scritture invece di 1. Manca un test (Playwright o Jest), il codice è corretto. (2) «Prossima: …» compare anche su `/tasks`; ora in DECISIONI n. 141.
- **PERIMETRO:** nessuna aggiunta fuori dal piano; server 0 righe.
- **CONCORRENZA:** retry dopo rete/403 (F8), undo scaduto (F7), ricorrente (F5), 409 (F4), Android (Jest) provati.
- **MUTAZIONI:** provate 3, prese 2 (non presa: guardia `inFlight`).

## Ricerca e critica
Concorrenti analizzati: Google Tasks (completati in fondo), GitLab (undo) — se n'è preso solo che l'undo richiede la card ancora visibile; altre fonti non trovate o non raggiungibili. Critica: 5 punti accolti (404/409 a `onStale`, un solo stato undo, `role` di `InlineNotice`, test vecchi, refresh Android); scelto di non riusare `useQuickActions`. Scartata la ricerca: card subito in «Chiusi» come `/tasks`.
[DA VERIFICARE] guida Material sugli snackbar su m3.material.io, non raggiungibile il 25/10/2026.

## Proposte al metodo
nessuna

## Prossima fetta
Giro `verifica-produzione` di T13 (poi il test per la guardia sincrona, nel giro di costruzione di T14).
