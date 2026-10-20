# Statistiche — esperimento 2 (metodo v4)

> Generato da `scripts/metrics/statistiche.py` il 2026-10-20 05:06 UTC. Dati: `metrics/giri.csv`, `metrics/tempo-umano.csv`, `docs/lab/traguardi.json`, `docs/lab/giri/NNN-agenti.json`, `docs/lab/fase0-decisioni.md`. Soglie e regole di conteggio: `docs/ESPERIMENTO.md` §3–§4.
>
> Giri: 6 · traguardi passati: 3 su 10. Solo numeri ed esiti delle soglie: le conclusioni le scrive l'umano in `docs/lab/CONCLUSIONI.md`.

## Metrica primaria: giri chiusi senza intervento umano

**0 su 5 giri conclusi (0%)** · soglia ≥ 50% (parte di P4) · esito: **mancata**.

Un giro è chiuso senza intervento se ha merge automatico, nessuna `domanda`, nessun commit umano sul branch, 0 minuti umani (modulo o `tempo-umano.csv`) e non è `fuori-catena` (DELTA-V4 V7). Il denominatore sono i giri conclusi (PR mergiata o chiusa). Fonte: `metrics/giri.csv` (`merge_automatico`, `domande`, `commit_umani`, `minuti_umani`, `fuori_catena`).

Giri non ancora conclusi, fuori dal conteggio: 005.

| Giro | Motivi di intervento | Dati mancanti |
|---|---|---|
| 000 | merge non automatico, minuti umani | — |
| 001 | merge non automatico, domanda | minuti umani |
| 002 | merge non automatico, minuti umani | — |
| 003 | merge non automatico | minuti umani |
| 004 | merge non automatico | minuti umani |

## Soglie P1–P6

Esiti possibili: passata, mancata, non misurabile (dato mancante o condizione non ancora presentata).

| # | Cosa | Soglia | Valore | Esito | Fonte |
|---|---|---|---|---|---|
| P1 | Lavoro interno: minuti umani per traguardo | ≤ 10' su ogni traguardo e in media | T1 ≥ 10' (minuti ignoti in qualche giro), T2 15', T3 ≥ 0' (minuti ignoti in qualche giro); media 8'; non passati: T4, T5, T6, T7, T8, T9, T10 | **mancata** | `giri.csv` (`minuti_umani`, `tipo`, `traguardo`) con l'attribuzione sotto |
| P2 | Integrazioni: minuti umani per integrazione | ≤ 60' per ciascuna | FCM (T10): —, traguardo non passato | **non misurabile** | `tempo-umano.csv` (`integrazione <nome>`) + `giri.csv` (giri runbook e verifica dell'integrazione) |
| P3 | Decisioni | ≤ 5 per traguardo; 100% delle ratifiche lette entro il merge successivo | T1 2, T2 2, T3 4; ratifiche lette 2/4 (in attesa: 004) | **mancata** | `giri.csv` (`decisioni_ratifica`, `porte_senso_unico`, `ratifiche_lette`) |
| P4 | Autonomia | ≥ 60% merge automatici; 0 fuori catena; attese ≤ 50% del calendario; primaria ≥ 50% | merge automatici 0/5 (0%); fuori catena 0; attese 12,4 h su 17,1 h di calendario (72%); metrica primaria 0% | **mancata** | `giri.csv` (`merge_automatico`, `fuori_catena`, `inizio`, `pr_mergiata`, `ore_attesa_umana`) |
| P5 | Qualità dopo il merge | verifica per traguardo e caccia finale fatte; ≤ 1 bloccante; V1 provato | traguardi costruiti 3, senza giro di verifica 1 (T3); cacce 0; difetti dopo il merge 7, bloccanti 1; prova del controllo V1 registrata: passata; esperimento in corso | **non misurabile** | `giri.csv` (`tipo`, `difetti`, `difetto_di`); `docs/lab/prove/v1.md` |
| P6 | Fase 0 non a occhi chiusi | ≥ 25% cambiate o respinte; revisione indipendente prima del giro 000 | 4 cambiate o respinte su 33 (12%): accettate 29, cambiate 4, respinte 0; revisione indipendente con esito «passato» | **mancata** | `docs/lab/fase0-decisioni.md` (tabella principale); `esito:` in testa a `docs/lab/revisione-fase0.md` |

Esiti per parte: P4: merge automatici mancata, fuori catena passata, attese mancata, primaria mancata · P5: verifiche non misurabile, caccia non misurabile, bloccanti passata, controllo v1 passata · P6: cambiate respinte mancata, revisione passata · P3: lettura delle ratifiche mancata.

### Attribuzione (ESPERIMENTO §4)

- Giro 000: conta per intero sia in T1 sia in T2 (doppio conteggio prudente: nessuna divisione dei minuti).
- Giro di chiusura (`tipo: chiusura`): fuori da P4, dalla metrica primaria e dall'attribuzione.
- Ratifiche: un id `NNN-a` è letto se un modulo di merge lo elenca su una PR mergiata a mano, dal merge del giro fino al primo merge a mano successivo compreso.
- Giri di costruzione e di verifica di un traguardo: quel traguardo (P1), compresa la parte interna di T10.
- Giri `runbook` e giri di verifica di un traguardo con integrazioni, più le righe `integrazione <nome>` di `tempo-umano.csv`: quell'integrazione (P2).
- Giri `caccia`: a parte (P5). Righe `setup`, `fase 0`, `meccanismo`, `quotidiano`: descrittive.
- Un merge a mano senza modulo vale «minuti ignoti»: il totale diventa un minimo («≥»).
- Un giro senza `tipo` conta come costruzione ed è elencato nei descrittivi.

## Descrittivi, senza soglia

- **P4 sui soli giri `costruzione`** (E4): merge automatici 0/3 (0%); fuori catena 0; attese 37% del loro calendario; metrica primaria 0/3 (0%).
- **Giri con un modello inatteso** (V1, regola di `pr_guard`): 0.
- **Token per giro**: nella tabella dei giri. Token assenti: 0; parziali: 0.
- **Minuti di sessione per giro** (`minuti_giro`): nella tabella; totale 370'.
- **Tempo umano per riferimento** (`tempo-umano.csv`): fase 0 262', giro 20', meccanismo 10', setup 165'.
- **Aggiunte fuori piano segnalate dal revisore** (`fuori_perimetro`): 0.
- **CI rosse** (`ci_rossi`): 1.
- **Bloccanti presi dal revisore prima del merge** (`revisore_bloccanti`): 1.
- **Merge a mano senza modulo** (`modulo_presente = no`): 3 (001, 003, 004).
- **Giri senza un `tipo` valido** (contati come costruzione): 0.

## Giri

| Giro | Tipo | Traguardo | Esito | PR | Minuti sessione | Merge automatico | Minuti umani | Token in/out | Cache lettura/scrittura | Fonte token | Bloccanti | CI rosse |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 000 | costruzione | T1 | mergiata | #5 | 40 | no | 10 | 490/49.971 | 12.169.539/599.318 | transcript | 0 | 1 |
| 001 | verifica-produzione | T1 | mergiata | #7 | 160 | no | — | 110/10.091 | 1.842.661/126.330 | transcript | 0 | 0 |
| 002 | verifica-produzione | T2 | mergiata | #8 | 19 | no | 5 | 124/6.819 | 1.975.672/155.803 | transcript | 0 | 0 |
| 003 | costruzione | T3 | mergiata | #10 | 33 | no | — | 274/50.085 | 6.628.106/472.155 | transcript | 1 | 0 |
| 004 | costruzione | T3 | mergiata | #11 | 27 | no | — | 254/41.467 | 6.156.673/421.138 | transcript | 0 | 0 |
| 005 | verifica-produzione | T3 | aperta | #12 | 91 | — | 0 | 162/12.546 | 3.234.041/328.254 | transcript | 0 | 0 |
