---
giro: 046
traguardo: T13
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-25T09:11:47Z
fine: 2026-10-25T09:54:38Z
pr: 70
ricerca_fonti: 8
critico_da_correggere: 5
critico_accolti: 5
revisore_bloccanti: 0
revisore_dubbi: 2
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 4
mutazioni_prese: 3
verify_rossi_locali: 0
test_totali: 490
test_delta: 21
decisioni_registro: 8
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 046 — T13 parte 1: kit della lista e vista «tutte le mie famiglie»

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/046-agenti.json. -->

> **PR:** #70 · **Branch:** `claude/giro-046-t13` · **Traguardo:** T13 — parte 1 di 2 (il Fatto quando
> completo non è ancora verde; un traguardo passa solo con un giro verifica-produzione)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- `/tasks` (tutte le mie famiglie) ora è composta solo dal kit: sezioni In ritardo, Oggi, Prossimi, Senza scadenza, Chiusi; card con checkbox, «Prendi» grande, badge di criticità, persona e famiglia.
- Fatto e «Prendi» si annullano dall'avviso «Annulla» (senza timer).
- `TasksSection` e la vista famiglia restano alla parte 2 di T13.
- **Revisione umana richiesta:** il commit `test(acceptance)` adatta tre test vecchi (010, 011, 016) alla nuova UI, come nei giri 018 e 035.
- Su Android i controlli rapidi sono disabilitati per i task con mutazioni in coda; la prova su dispositivo è rimandata alla verifica.
- Possibile sovrapposizione di `FamilySwitch` col titolo a 390 px con 2+ famiglie: non misurata da nessun test.
- Il guard segnala anche `modello-inatteso` (nel registro `046-agenti.json` mancano costruttore-tdd, revisore, orchestratore): da controllare.
- Ratifiche: nessuna.
- Modulo di merge: `⏱ N' · ratifiche lette: nessuna · note`

## Cosa funziona ora — con la prova
- Accettazione `giro-046-*` 21/21; Playwright intero 334/334; Jest 151/151; tsc ed eslint verdi (revisore, SHA 25c081f).
- Ordine, sezioni e cambio d'ora (Roma 25/10, Santiago 06/09) coperti da Jest.
- Doppio tocco, retry con stesso `mutationId`, undo di «Prendi»: 5 sonde del revisore su 5.

## Cosa non funziona ancora
- Parte 2 di T13: `TasksSection` e vista famiglia.
- Ramo Android (coda + `quickBlocked`) provato solo in Jest sulla funzione pura; prova a fontScale 2.0 su telefono non fatta.
- La guardia `running.current` in `useQuickActions` non ha un test proprio (mutazione M1 sopravvissuta).

## Verdetto del revisore
- **BLOCCANTI:** 0
- **DUBBI:** 2 (guardia non coperta; nuovo mutationId dopo azione su altro task) — non corretti, nel rapporto
- **PERIMETRO:** nessuna aggiunta non richiesta
- **CONCORRENZA:** 5 sonde su 5 verdi
- **MUTAZIONI:** provate 4, prese 3

## Ricerca e critica
Concorrenti analizzati: Todoist, Singularity — presi: ordine per scadenza/criticità, sezioni sempre aperte. Cozi, Sweepy, FamilyWall, OurHome, Homey non verificati.
Critica: 5 punti accolti su 5. Scartati i facoltativi «Annulla fatto» e `role="status"`.

## Proposte al metodo
nessuna

## Prossima fetta
Giro `costruzione` su T13 parte 2 (`TasksSection`, vista famiglia).
