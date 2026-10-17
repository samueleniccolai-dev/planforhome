---
giro: NNN
traguardo: Tn
traguardi_extra: []  # solo nel giro 000: [T2] (il giro 000 posa i binari di T1 e T2)
tipo:                # costruzione | verifica-produzione | runbook | caccia | chiusura (obbligatorio)
fase: piano          # piano → critica → costruzione → revisione → chiusura | domanda | bloccato
inizio: AAAA-MM-GGTHH:MM:SSZ
ricerca: sì
accettazione:        # SHA del commit test(acceptance); vuoto in runbook, verifica e caccia
ripreso: no
---
# Piano del giro NNN — <fetta>

## Fetta e traguardo
Quale traguardo (o quale parte), quale tipo di giro e perché proprio adesso, in una riga.
Fonti: sezioni di SPEC e, se c'è, `specs/NNN-<nome>/spec.md`.

## Fatto quando — controlli eseguibili
- [ ] `comando`, URL o test → risultato atteso
- verifica-produzione: gli stessi controlli, contro `https://app.planforhome.com` e l'ultimo APK
- runbook: `docs/runbook/<nome>.md` con passi, minuti, prova e rollback; la prova di riuscita
- caccia: le aree da battere (permessi, isolamento, sync, ricorrenze e ora legale, promemoria)

## Fuori perimetro
Cosa NON si fa in questo giro, anche se sembra utile.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|

## Porte
- Doppio senso previste: …
- Senso unico: nessuna / **DOMANDA:** …

## Rischi di concorrenza
Stato condiviso, transazioni, doppio invio, idempotenza del `mutation_id`, coda presa da due
persone: cosa può andare storto e come si prova.

## Budget
Righe di produzione (`server/src/main`, `app/src`, `app/app`) ≤ …; file ≤ …; deve stare in una
sessione. Verifica, caccia e runbook: 0 righe di codice.

## Domande per il ricercatore (al massimo 3)

## Critica ricevuta e cosa cambia
(dopo il critico) Accolto: … · Scartato, con motivo: …
