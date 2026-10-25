# Statistiche — esperimento 3 (metodo v4, fase UI)

> Generato da `scripts/metrics/statistiche.py` il 2026-10-24 22:34 UTC. Dati: `metrics/giri.csv` (dal giro `dal_giro` di `traguardi.json`), `metrics/tempo-umano.csv`, `metrics/moduli-pr-umane.csv`, `docs/lab/traguardi.json`, `docs/lab/giri/NNN-agenti.json`, `docs/lab/fase0-decisioni-esp3.md`. Soglie e regole di conteggio: `docs/ESPERIMENTO.md` §3–§4.
>
> Giri: 1 · traguardi passati: 0 su 9. Solo numeri ed esiti delle soglie: le conclusioni le scrive l'umano in `docs/lab/CONCLUSIONI.md`.

## Metrica primaria: giri chiusi senza intervento umano

**0 su 0 giri conclusi (—)** · soglia ≥ 50% (parte di P4) · esito: **non misurabile**.

Un giro è chiuso senza intervento se ha merge automatico, nessuna `domanda`, nessun commit umano sul branch, 0 minuti umani (modulo o `tempo-umano.csv`) e non è `fuori-catena` (DELTA-V4 V7). Il denominatore sono i giri conclusi (PR mergiata o chiusa). Fonte: `metrics/giri.csv` (`merge_automatico`, `domande`, `commit_umani`, `minuti_umani`, `fuori_catena`).

Giri non ancora conclusi, fuori dal conteggio: 042.

## Soglie P1–P6

Esiti possibili: passata, mancata, non misurabile (dato mancante o condizione non ancora presentata).

| # | Cosa | Soglia | Valore | Esito | Fonte |
|---|---|---|---|---|---|
| P1 | Lavoro interno: minuti umani per traguardo | ≤ 10' su ogni traguardo e in media | nessun traguardo passato; media —; non passati: T11, T12, T13, T14, T15, T16, T17, T18, T19 | **non misurabile** | `giri.csv` (`minuti_umani`, `tipo`, `traguardo`) con l'attribuzione sotto |
| P2 | Integrazioni: minuti umani per integrazione | ≤ 60' per ciascuna | nessuna integrazione in `traguardi.json` | **non misurabile** | `tempo-umano.csv` (`integrazione <nome>`) + `giri.csv` (giri runbook e verifica dell'integrazione) |
| P3 | Decisioni | ≤ 5 per traguardo; 100% delle ratifiche lette entro il merge successivo | nessun traguardo passato; ratifiche lette 0/0 | **non misurabile** | `giri.csv` (`decisioni_ratifica`, `porte_senso_unico`, `ratifiche_lette`) |
| P4 | Autonomia | ≥ 60% merge automatici; 0 fuori catena; attese ≤ 50% del calendario; primaria ≥ 50% | merge automatici 0/0 (—); fuori catena 0; attese 0,0 h su — h di calendario (—); metrica primaria — | **non misurabile** | `giri.csv` (`merge_automatico`, `fuori_catena`, `inizio`, `pr_mergiata`, `ore_attesa_umana`) |
| P5 | Qualità dopo il merge | verifica per traguardo e caccia finale fatte; ≤ 1 bloccante; V1 provato | traguardi costruiti 0, senza giro di verifica 0; cacce 0; difetti dopo il merge 0, bloccanti 0; prova del controllo V1 registrata: passata; esperimento in corso | **non misurabile** | `giri.csv` (`tipo`, `difetti`, `difetto_di`); `docs/lab/prove/v1.md` |
| P6 | Fase 0 non a occhi chiusi | ≥ 25% cambiate o respinte; revisione indipendente prima del primo giro | 3 cambiate o respinte su 16 (19%): accettate 13, cambiate 3, respinte 0; revisione indipendente con esito «passato» | **mancata** | `docs/lab/fase0-decisioni-esp3.md` (tabella principale); `esito:` in testa a `docs/lab/revisione-fase0-esp3.md` |

Esiti per parte: P4: merge automatici non misurabile, fuori catena passata, attese non misurabile, primaria non misurabile · P5: verifiche non misurabile, caccia non misurabile, bloccanti non misurabile, controllo v1 passata · P6: cambiate respinte mancata, revisione passata · P3: lettura delle ratifiche non misurabile.

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

- **P4 sui soli giri `costruzione`** (E4): merge automatici 0/0 (—); fuori catena 0; attese — del loro calendario; metrica primaria 0/0 (—).
- **Giri con un modello inatteso** (V1, regola di `pr_guard`): 0.
- **Token per giro**: nella tabella dei giri. Token assenti: 0; parziali: 0.
- **Minuti di sessione per giro** (`minuti_giro`): nella tabella; totale 72'.
- **Tempo umano per riferimento** (`tempo-umano.csv`): fase 0 262', giro 42', integrazione 63', meccanismo 15', quotidiano 60', setup 165'.
- **Moduli delle PR umane per riferimento** (`moduli-pr-umane.csv`, ESPERIMENTO §4.3): (senza riferimento) 46', meccanismo 5'.
- **Aggiunte fuori piano segnalate dal revisore** (`fuori_perimetro`): 0.
- **CI rosse** (`ci_rossi`): 0.
- **Bloccanti presi dal revisore prima del merge** (`revisore_bloccanti`): 2.
- **Merge a mano senza modulo** (`modulo_presente = no`): 0.
- **Giri senza un `tipo` valido** (contati come costruzione): 0.

## Giri

| Giro | Tipo | Traguardo | Esito | PR | Minuti sessione | Merge automatico | Minuti umani | Token in/out | Cache lettura/scrittura | Fonte token | Bloccanti | CI rosse |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 042 | costruzione | T11 | aperta | #66 | 72 | — | 0 | 415/121.741 | 10.623.136/701.098 | transcript | 2 | 0 |
