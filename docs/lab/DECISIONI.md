# DECISIONI — tre livelli (METODO §3)

- **registro:** dettagli interni reversibili; nessuna ratifica.
- **ratifica:** cosa vede chi usa l'app, dati salvati, costi ricorrenti, scelte care da cambiare.
  Massimo 3 per giro, numerate `NNN a`, `NNN b`, `NNN c`. Si contano e si dichiarano lette nel
  modulo di merge (`ratifiche lette: NNN a/b`), ma non fermano la catena. Per contestarne una,
  commenta la PR del giro: `contesto n. X: …`.
- **senso unico:** il giro si è fermato con una PR `domanda`; qui va la risposta dell'umano.

Stato: `—` (in vigore) · `contestata` · `cambiata (giro NNN)` · `risposta del GG/MM`.

Le decisioni della fase 0 sono in `docs/lab/fase0-decisioni.md`.

## Porte a senso unico già decise (SPEC §14.1)

Prese prima del giro 000, al CANCELLO 2 (17/10/2026). Non si contano nei traguardi.

| # | Porta | Decisione |
|---|---|---|
| 1 | Repository pubblico, licenza MIT | ADR-0002 |
| 2 | Stack: Spring Boot + PostgreSQL; React Native + Expo | ADR-0001 |
| 3 | Dati finti fino alla porta R1 | SPEC §3 |
| 4 | Server di gerio-lab, con il suo stack fermato | ADR-0001 |
| 5 | Nessun profilo ALL: si vedono solo le proprie famiglie | SPEC §2.2 |
| 6 | Il server decide su permessi e conflitti | SPEC §5, §7 |
| 7 | Identificativi UUIDv7 generati dal client | SPEC §6 |

## Decisioni dei giri

| N. | Data | Giro | Livello | Decisione | Alternativa scartata | Motivo (una riga) | Stato |
|---|---|---|---|---|---|---|---|
