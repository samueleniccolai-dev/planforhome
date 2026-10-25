# Statistiche — esperimento 3 (metodo v4, fase UI)

> Generato da `scripts/metrics/statistiche.py` il 2026-10-25 13:09 UTC. Dati: `metrics/giri.csv` (dal giro `dal_giro` di `traguardi.json`), `metrics/tempo-umano.csv`, `metrics/moduli-pr-umane.csv`, `docs/lab/traguardi.json`, `docs/lab/giri/NNN-agenti.json`, `docs/lab/fase0-decisioni-esp3.md`. Soglie e regole di conteggio: `docs/ESPERIMENTO.md` §3–§4.
>
> Giri: 6 · traguardi passati: 2 su 9. Solo numeri ed esiti delle soglie: le conclusioni le scrive l'umano in `docs/lab/CONCLUSIONI.md`.

## Metrica primaria: giri chiusi senza intervento umano

**2 su 5 giri conclusi (40%)** · soglia ≥ 50% (parte di P4) · esito: **mancata**.

Un giro è chiuso senza intervento se ha merge automatico, nessuna `domanda`, nessun commit umano sul branch, 0 minuti umani (modulo o `tempo-umano.csv`) e non è `fuori-catena` (DELTA-V4 V7). Il denominatore sono i giri conclusi (PR mergiata o chiusa). Fonte: `metrics/giri.csv` (`merge_automatico`, `domande`, `commit_umani`, `minuti_umani`, `fuori_catena`).

Giri non ancora conclusi, fuori dal conteggio: 047.

| Giro | Motivi di intervento | Dati mancanti |
|---|---|---|
| 042 | merge non automatico, minuti umani | — |
| 043 | nessuno | — |
| 044 | merge non automatico, minuti umani | — |
| 045 | nessuno | — |
| 046 | merge non automatico, minuti umani | — |

## Soglie P1–P6

Esiti possibili: passata, mancata, non misurabile (dato mancante o condizione non ancora presentata).

| # | Cosa | Soglia | Valore | Esito | Fonte |
|---|---|---|---|---|---|
| P1 | Lavoro interno: minuti umani per traguardo | ≤ 10' su ogni traguardo e in media | T11 5', T12 5'; media 5'; non passati: T13, T14, T15, T16, T17, T18, T19 | **non misurabile** | `giri.csv` (`minuti_umani`, `tipo`, `traguardo`) con l'attribuzione sotto |
| P2 | Integrazioni: minuti umani per integrazione | ≤ 60' per ciascuna | nessuna integrazione in `traguardi.json` | **non misurabile** | `tempo-umano.csv` (`integrazione <nome>`) + `giri.csv` (giri runbook e verifica dell'integrazione) |
| P3 | Decisioni | ≤ 5 per traguardo; 100% delle ratifiche lette entro il merge successivo | T11 0, T12 0; ratifiche lette 0/0 | **non misurabile** | `giri.csv` (`decisioni_ratifica`, `porte_senso_unico`, `ratifiche_lette`) |
| P4 | Autonomia | ≥ 60% merge automatici; 0 fuori catena; attese ≤ 50% del calendario; primaria ≥ 50% | merge automatici 2/5 (40%); fuori catena 0; attese 10,1 h su 14,6 h di calendario (69%); metrica primaria 40% | **mancata** | `giri.csv` (`merge_automatico`, `fuori_catena`, `inizio`, `pr_mergiata`, `ore_attesa_umana`) |
| P5 | Qualità dopo il merge | verifica per traguardo e caccia finale fatte; ≤ 1 bloccante; V1 provato | traguardi costruiti 3, senza giro di verifica 1 (T13); cacce 0; difetti dopo il merge 2, bloccanti 0; prova del controllo V1 registrata: passata; esperimento in corso | **non misurabile** | `giri.csv` (`tipo`, `difetti`, `difetto_di`); `docs/lab/prove/v1.md` |
| P6 | Fase 0 non a occhi chiusi | ≥ 25% cambiate o respinte; revisione indipendente prima del primo giro | 3 cambiate o respinte su 16 (19%): accettate 13, cambiate 3, respinte 0; revisione indipendente con esito «passato» | **mancata** | `docs/lab/fase0-decisioni-esp3.md` (tabella principale); `esito:` in testa a `docs/lab/revisione-fase0-esp3.md` |

Esiti per parte: P4: merge automatici mancata, fuori catena passata, attese mancata, primaria mancata · P5: verifiche non misurabile, caccia non misurabile, bloccanti passata, controllo v1 passata · P6: cambiate respinte mancata, revisione passata · P3: lettura delle ratifiche non misurabile.

### Attribuzione (ESPERIMENTO §4)

- Contano i giri dal `dal_giro` di `traguardi.json` (esperimento 3; i giri 000–041 sono dell'esperimento 2). Nessun giro 000 qui: nessun doppio conteggio.
- Il calendario va dall'inizio del primo giro al merge che chiude l'ultimo traguardo: i giri `caccia` e `chiusura` restano fuori dal calendario, non dalle attese.
- Un modulo che comincia con «🤖» (sessione assistita) conta. I moduli delle PR umane (`metrics/moduli-pr-umane.csv`) si sommano per `riferimento:`; `integrazione <nome>` entra in P2.
- Un atteso sbagliato del piano non è un difetto; `difetto_di` è il giro d'origine, mai la verifica. La `domanda` di prova umana non si conta in `porte_senso_unico`.
- Giro di chiusura (`tipo: chiusura`): fuori da P4, dalla metrica primaria e dall'attribuzione.
- Ratifiche: un id `NNN-a` è letto se un modulo di merge lo elenca su una PR mergiata a mano, dal merge del giro fino al primo merge a mano successivo compreso.
- Giri di costruzione e di verifica di un traguardo: quel traguardo (P1), compresa la parte interna di T10.
- Giri `runbook` e giri di verifica di un traguardo con integrazioni, più le righe `integrazione <nome>` di `tempo-umano.csv`: quell'integrazione (P2).
- Giri `caccia`: a parte (P5). Righe `setup`, `fase 0`, `meccanismo`, `quotidiano`: descrittive.
- Un merge a mano senza modulo vale «minuti ignoti»: il totale diventa un minimo («≥»).
- Un giro senza `tipo` conta come costruzione ed è elencato nei descrittivi.

## Descrittivi, senza soglia

- **P4 sui soli giri `costruzione`** (E4): merge automatici 0/3 (0%); fuori catena 0; attese 69% del loro calendario; metrica primaria 0/3 (0%).
- **Giri con un modello inatteso** (V1, regola di `pr_guard`): 0.
- **Token per giro**: nella tabella dei giri. Token assenti: 0; parziali: 0.
- **Minuti di sessione per giro** (`minuti_giro`): nella tabella; totale 259'.
- **Tempo umano per riferimento** (`tempo-umano.csv`): fase 0 262', giro 42', integrazione 63', meccanismo 15', quotidiano 60', setup 165'.
- **Moduli delle PR umane per riferimento** (`moduli-pr-umane.csv`, ESPERIMENTO §4.3): (senza riferimento) 46', meccanismo 5'.
- **Aggiunte fuori piano segnalate dal revisore** (`fuori_perimetro`): 1.
- **CI rosse** (`ci_rossi`): 0.
- **Bloccanti presi dal revisore prima del merge** (`revisore_bloccanti`): 2.
- **Merge a mano senza modulo** (`modulo_presente = no`): 0.
- **Giri senza un `tipo` valido** (contati come costruzione): 0.

## Giri

| Giro | Tipo | Traguardo | Esito | PR | Minuti sessione | Merge automatico | Minuti umani | Token in/out | Cache lettura/scrittura | Fonte token | Bloccanti | CI rosse |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 042 | costruzione | T11 | mergiata | #66 | 72 | no | 5 | 415/121.741 | 10.623.136/701.098 | transcript | 2 | 0 |
| 043 | verifica-produzione | T11 | mergiata | #67 | 25 | sì | 0 | 218/48.173 | 4.314.718/258.242 | transcript | 0 | 0 |
| 044 | costruzione | T12 | mergiata | #68 | 34 | no | 5 | 275/100.507 | 5.969.058/416.763 | transcript | 0 | 0 |
| 045 | verifica-produzione | T12 | mergiata | #69 | 22 | sì | 0 | 119/22.611 | 2.000.499/150.409 | transcript | 0 | 0 |
| 046 | costruzione | T13 | mergiata | #70 | 43 | no | 5 | 329/166.427 | 10.023.688/568.140 | transcript | 0 | 0 |
| 047 | costruzione | T13 | aperta | #71 | 63 | — | 0 | 445/144.702 | 11.630.794/753.519 | transcript | 0 | 0 |
