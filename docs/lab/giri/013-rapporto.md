---
giro: 013
traguardo: T6
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-20T20:30:19Z
fine: 2026-10-20T21:08:56Z
pr: 20
ricerca_fonti: 5
critico_da_correggere: 5
critico_accolti: 5
revisore_bloccanti: 0
revisore_dubbi: 2
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 3
mutazioni_prese: 3
verify_rossi_locali: 0
test_totali: 391
test_delta: 0
decisioni_registro: 2
decisioni_ratifica: 2
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 013 — T6 parte 1: ricorrenze sul server

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/013-agenti.json. -->

> **PR:** #20 · **Branch:** `claude/giro-013-t6` · **Traguardo:** T6 — parziale (parte server; resta il client)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Sul server, segnare fatto o «annulla questa volta» un task ciclico crea l'occorrenza successiva (giornaliera, ogni N giorni, settimanale, mensile con fine mese), nel fuso della famiglia, anche a cavallo dell'ora legale.
- Nuovo `POST …/end-series` («Termina la serie»), permesso a gestore o a chi ha creato la serie.
- «Mettere fuori la carta» è nei dati demo: fatto il giovedì, ricompare il martedì.
- `/family` ora scorre; il modulo «Aggiungi task» sta sotto la lista.
- Nessuna dipendenza né migrazione nuove. La PR tocca `TasksSection.tsx` e `family.tsx`, nessun percorso protetto.
- **Revisione umana (pr_guard):** modificati due test di accettazione già su main (`AcceptanceClock.java`: nuovo `setTo`; `Giro010DemoTasksAcceptanceTest.java`: tolta la carta demo dalla lista, che sarebbe diventata rossa). Il registro agenti completo dei ruoli si chiude con `agenti.py chiudi`.
- Ratifiche da dichiarare lette: **013-a** (modulo sotto la lista), **013-b** (il 31 ripiega sul fine mese, non come RFC 5545).

## Cosa funziona ora — con la prova
- 28 test di accettazione server verdi, 7 unitari `RecurrenceTest`; `./mvnw verify` 215 test verdi.
- Playwright: scroll di `/family` 2/2 (it, en); suite completa 123 verdi. `npm test` 45, tsc ed eslint puliti.
- Revisore: 3 mutazioni su 3 prese; sonde di concorrenza senza doppioni.

## Cosa non funziona ancora
- Client: scelta della ricorrenza, «Annulla questa volta», «Termina la serie», `recurrence.ts` con test a orologio finto (parte 2).
- `end-series` su un'occorrenza riaperta lascia viva la successiva (dubbio 1).
- Un `PUT` che cambia l'ora non sposta le occorrenze future (dubbio 2).

## Verdetto del revisore
- **BLOCCANTI:** 0
- **DUBBI:** 2 (sopra), non corretti, rinviati alla parte 2
- **PERIMETRO:** niente fuori piano
- **CONCORRENZA:** done‖done, cancel‖done, end-series‖done, reopen‖done: nessun doppione
- **MUTAZIONI:** provate 3, prese 3

## Ricerca e critica
Preso: ora locale salvata una volta, una sola successiva per serie, `PUT` non tocca la ricorrenza, test in contesto proprio. Il fine mese diverge da RFC 5545 (decisione 45). Quattro fonti non raggiungibili (DNS).

## Proposte al metodo
nessuna

## Prossima fetta
T6 parte 2 (client e interfaccia), poi `verifica-produzione`.
