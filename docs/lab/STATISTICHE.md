# Statistiche — esperimento 2 (metodo v4)

> Generato da `scripts/metrics/statistiche.py` il 2026-10-23 19:17 UTC. Dati: `metrics/giri.csv`, `metrics/tempo-umano.csv`, `docs/lab/traguardi.json`, `docs/lab/giri/NNN-agenti.json`, `docs/lab/fase0-decisioni.md`. Soglie e regole di conteggio: `docs/ESPERIMENTO.md` §3–§4.
>
> Giri: 39 · traguardi passati: 9 su 10. Solo numeri ed esiti delle soglie: le conclusioni le scrive l'umano in `docs/lab/CONCLUSIONI.md`.

## Metrica primaria: giri chiusi senza intervento umano

**16 su 38 giri conclusi (42%)** · soglia ≥ 50% (parte di P4) · esito: **mancata**.

Un giro è chiuso senza intervento se ha merge automatico, nessuna `domanda`, nessun commit umano sul branch, 0 minuti umani (modulo o `tempo-umano.csv`) e non è `fuori-catena` (DELTA-V4 V7). Il denominatore sono i giri conclusi (PR mergiata o chiusa). Fonte: `metrics/giri.csv` (`merge_automatico`, `domande`, `commit_umani`, `minuti_umani`, `fuori_catena`).

Giri non ancora conclusi, fuori dal conteggio: 038.

| Giro | Motivi di intervento | Dati mancanti |
|---|---|---|
| 000 | merge non automatico, minuti umani | — |
| 001 | merge non automatico, domanda | minuti umani |
| 002 | merge non automatico, minuti umani | — |
| 003 | merge non automatico | minuti umani |
| 004 | merge non automatico | minuti umani |
| 005 | nessuno | — |
| 006 | nessuno | — |
| 007 | nessuno | — |
| 008 | merge non automatico, domanda | minuti umani |
| 009 | domanda, minuti umani | — |
| 010 | nessuno | — |
| 011 | nessuno | — |
| 012 | domanda, minuti umani | — |
| 013 | merge non automatico, minuti umani | — |
| 014 | nessuno | — |
| 015 | nessuno | — |
| 016 | nessuno | — |
| 017 | nessuno | — |
| 018 | merge non automatico, minuti umani | — |
| 019 | merge non automatico, minuti umani | — |
| 020 | merge non automatico, minuti umani | — |
| 021 | nessuno | — |
| 022 | nessuno | — |
| 023 | nessuno | — |
| 024 | merge non automatico, domanda, minuti umani | — |
| 025 | nessuno | — |
| 026 | merge non automatico, domanda | minuti umani |
| 027 | nessuno | — |
| 028 | merge non automatico, minuti umani | — |
| 029 | merge non automatico | minuti umani |
| 030 | nessuno | — |
| 031 | merge non automatico, minuti umani | — |
| 032 | merge non automatico, minuti umani | — |
| 033 | merge non automatico, domanda, minuti umani | — |
| 034 | merge non automatico, domanda, minuti umani | — |
| 035 | merge non automatico, minuti umani | — |
| 036 | nessuno | — |
| 037 | domanda, minuti umani | — |

## Soglie P1–P6

Esiti possibili: passata, mancata, non misurabile (dato mancante o condizione non ancora presentata).

| # | Cosa | Soglia | Valore | Esito | Fonte |
|---|---|---|---|---|---|
| P1 | Lavoro interno: minuti umani per traguardo | ≤ 10' su ogni traguardo e in media | T1 ≥ 10' (minuti ignoti in qualche giro), T2 15', T3 ≥ 0' (minuti ignoti in qualche giro), T4 1', T5 ≥ 5' (minuti ignoti in qualche giro), T6 10', T7 0', T8 30', T9 ≥ 9' (minuti ignoti in qualche giro); media 9'; non passati: T10 | **mancata** | `giri.csv` (`minuti_umani`, `tipo`, `traguardo`) con l'attribuzione sotto |
| P2 | Integrazioni: minuti umani per integrazione | ≤ 60' per ciascuna | FCM (T10): 83', traguardo non passato | **non misurabile** | `tempo-umano.csv` (`integrazione <nome>`) + `giri.csv` (giri runbook e verifica dell'integrazione) |
| P3 | Decisioni | ≤ 5 per traguardo; 100% delle ratifiche lette entro il merge successivo | T1 2, T2 2, T3 4, T4 1, T5 2, T6 3, T7 2, T8 5, T9 2; ratifiche lette 12/16 | **mancata** | `giri.csv` (`decisioni_ratifica`, `porte_senso_unico`, `ratifiche_lette`) |
| P4 | Autonomia | ≥ 60% merge automatici; 0 fuori catena; attese ≤ 50% del calendario; primaria ≥ 50% | merge automatici 19/38 (50%); fuori catena 0; attese 52,5 h su 104,4 h di calendario (50%); metrica primaria 42% | **mancata** | `giri.csv` (`merge_automatico`, `fuori_catena`, `inizio`, `pr_mergiata`, `ore_attesa_umana`) |
| P5 | Qualità dopo il merge | verifica per traguardo e caccia finale fatte; ≤ 1 bloccante; V1 provato | traguardi costruiti 10, senza giro di verifica 0; cacce 0; difetti dopo il merge 20, bloccanti 7; prova del controllo V1 registrata: passata; esperimento in corso | **mancata** | `giri.csv` (`tipo`, `difetti`, `difetto_di`); `docs/lab/prove/v1.md` |
| P6 | Fase 0 non a occhi chiusi | ≥ 25% cambiate o respinte; revisione indipendente prima del giro 000 | 4 cambiate o respinte su 33 (12%): accettate 29, cambiate 4, respinte 0; revisione indipendente con esito «passato» | **mancata** | `docs/lab/fase0-decisioni.md` (tabella principale); `esito:` in testa a `docs/lab/revisione-fase0.md` |

Esiti per parte: P4: merge automatici mancata, fuori catena passata, attese mancata, primaria mancata · P5: verifiche passata, caccia non misurabile, bloccanti mancata, controllo v1 passata · P6: cambiate respinte mancata, revisione passata · P3: lettura delle ratifiche mancata.

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

- **P4 sui soli giri `costruzione`** (E4): merge automatici 11/25 (44%); fuori catena 0; attese 35% del loro calendario; metrica primaria 11/25 (44%).
- **Giri con un modello inatteso** (V1, regola di `pr_guard`): 0.
- **Token per giro**: nella tabella dei giri. Token assenti: 0; parziali: 0.
- **Minuti di sessione per giro** (`minuti_giro`): nella tabella; totale 1.713'.
- **Tempo umano per riferimento** (`tempo-umano.csv`): fase 0 262', giro 42', integrazione 63', meccanismo 15', quotidiano 60', setup 165'.
- **Aggiunte fuori piano segnalate dal revisore** (`fuori_perimetro`): 3.
- **CI rosse** (`ci_rossi`): 4.
- **Bloccanti presi dal revisore prima del merge** (`revisore_bloccanti`): 8.
- **Merge a mano senza modulo** (`modulo_presente = no`): 6 (001, 003, 004, 008, 026, 029).
- **Giri senza un `tipo` valido** (contati come costruzione): 0.

## Giri

| Giro | Tipo | Traguardo | Esito | PR | Minuti sessione | Merge automatico | Minuti umani | Token in/out | Cache lettura/scrittura | Fonte token | Bloccanti | CI rosse |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 000 | costruzione | T1 | mergiata | #5 | 40 | no | 10 | 490/49.971 | 12.169.539/599.318 | transcript | 0 | 1 |
| 001 | verifica-produzione | T1 | mergiata | #7 | 160 | no | — | 110/10.091 | 1.842.661/126.330 | transcript | 0 | 0 |
| 002 | verifica-produzione | T2 | mergiata | #8 | 19 | no | 5 | 124/6.819 | 1.975.672/155.803 | transcript | 0 | 0 |
| 003 | costruzione | T3 | mergiata | #10 | 33 | no | — | 274/50.085 | 6.628.106/472.155 | transcript | 1 | 0 |
| 004 | costruzione | T3 | mergiata | #11 | 27 | no | — | 254/41.467 | 6.156.673/421.138 | transcript | 0 | 0 |
| 005 | verifica-produzione | T3 | mergiata | #12 | 91 | sì | 0 | 162/12.546 | 3.234.041/328.254 | transcript | 0 | 0 |
| 006 | costruzione | T4 | mergiata | #13 | 45 | sì | 0 | 300/40.254 | 6.418.917/445.541 | transcript | 1 | 0 |
| 007 | costruzione | T4 | mergiata | #14 | 26 | sì | 0 | 213/28.172 | 4.429.057/336.769 | transcript | 0 | 0 |
| 008 | costruzione | T5 | mergiata | #15 | 36 | no | — | 271/53.398 | 5.934.666/465.953 | transcript | 0 | 0 |
| 009 | verifica-produzione | T4 | mergiata | #16 | 69 | sì | 1 | 142/14.157 | 2.534.643/192.086 | transcript | 0 | 0 |
| 010 | costruzione | T5 | mergiata | #17 | 49 | sì | 0 | 279/41.238 | 7.054.558/478.406 | transcript | 0 | 1 |
| 011 | costruzione | T5 | mergiata | #18 | 39 | sì | 0 | 297/58.243 | 8.454.928/482.307 | transcript | 0 | 0 |
| 012 | verifica-produzione | T5 | mergiata | #19 | 24 | sì | 5 | 172/16.642 | 4.403.825/222.168 | transcript | 0 | 0 |
| 013 | costruzione | T6 | mergiata | #20 | 39 | no | 10 | 360/41.671 | 10.632.086/471.003 | transcript | 0 | 0 |
| 014 | costruzione | T6 | mergiata | #21 | 38 | sì | 0 | 310/46.782 | 7.973.368/507.856 | transcript | 0 | 0 |
| 015 | verifica-produzione | T6 | mergiata | #22 | 11 | sì | 0 | 158/13.830 | 3.505.075/183.026 | transcript | 0 | 0 |
| 016 | costruzione | T7 | mergiata | #23 | 49 | sì | 0 | 300/45.617 | 8.136.804/454.088 | transcript | 0 | 1 |
| 017 | verifica-produzione | T7 | mergiata | #24 | 14 | sì | 0 | 161/17.703 | 3.605.056/186.641 | transcript | 0 | 0 |
| 018 | costruzione | T8 | mergiata | #25 | 40 | no | 10 | 314/38.694 | 7.475.829/426.177 | transcript | 0 | 0 |
| 019 | costruzione | T8 | mergiata | #27 | 55 | no | 10 | 352/60.766 | 10.888.031/620.626 | transcript | 0 | 0 |
| 020 | costruzione | T8 | mergiata | #29 | 74 | no | 10 | 499/34.957 | 10.945.283/621.727 | transcript | 0 | 0 |
| 021 | costruzione | T8 | mergiata | #31 | 26 | sì | 0 | 217/22.627 | 4.479.266/287.886 | transcript | 0 | 0 |
| 022 | verifica-produzione | T8 | mergiata | #32 | 21 | sì | 0 | 200/15.277 | 4.498.631/256.914 | transcript | 0 | 0 |
| 023 | costruzione | T9 | mergiata | #33 | 34 | sì | 0 | 238/29.097 | 5.377.198/425.890 | transcript | 0 | 0 |
| 024 | costruzione | T9 | mergiata | #34 | 37 | no | 7 | 277/27.455 | 5.419.319/415.176 | transcript | 1 | 0 |
| 025 | costruzione | T9 | mergiata | #35 | 22 | sì | 0 | 222/34.497 | 4.981.573/337.239 | transcript | 0 | 1 |
| 026 | costruzione | T9 | mergiata | #36 | 81 | no | — | 469/53.370 | 10.571.771/622.929 | transcript | 0 | 0 |
| 027 | costruzione | T9 | mergiata | #37 | 54 | sì | 0 | 405/142.736 | 11.256.489/569.788 | transcript | 0 | 0 |
| 028 | verifica-produzione | T9 | mergiata | #38 | 25 | no | 2 | 200/54.803 | 4.985.246/274.796 | transcript | 5 | 0 |
| 029 | verifica-produzione | T9 | mergiata | #40 | 20 | no | — | 163/44.777 | 3.604.101/233.100 | transcript | 0 | 0 |
| 030 | runbook | T10 | mergiata | #42 | 10 | sì | 0 | 172/51.672 | 3.204.356/234.690 | transcript | 0 | 0 |
| 031 | costruzione | T10 | mergiata | #44 | 53 | no | 5 | 372/156.867 | 12.132.035/541.139 | transcript | 0 | 0 |
| 032 | costruzione | T10 | mergiata | #45 | 58 | no | 2 | 361/150.545 | 9.561.177/626.722 | transcript | 0 | 0 |
| 033 | costruzione | T10 | mergiata | #47 | 88 | no | 7 | 267/93.908 | 5.692.695/399.419 | transcript | 0 | 0 |
| 034 | verifica-produzione | T10 | mergiata | #49 | 26 | no | 10 | 50/17.716 | 1.101.415/108.418 | transcript | 0 | 0 |
| 035 | costruzione | T10 | mergiata | #50 | 37 | no | 2 | 241/75.499 | 4.940.607/424.354 | transcript | 0 | 0 |
| 036 | costruzione | T10 | mergiata | #51 | 36 | sì | 0 | 233/63.555 | 4.577.180/372.758 | transcript | 0 | 0 |
| 037 | verifica-produzione | T10 | mergiata | #52 | 85 | sì | 10 | 154/44.016 | 3.226.540/171.806 | transcript | 0 | 0 |
| 038 | costruzione | T10 | aperta | #54 | 22 | — | 0 | 170/39.130 | 3.055.566/228.986 | transcript | 0 | 0 |
