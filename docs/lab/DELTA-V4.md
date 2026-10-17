# DELTA-V4 — cosa passa da gerio-lab a planforhome

Stato: **approvato al CANCELLO 1** (17/10/2026), senza le voci A1 e A2

Fonte: gerio-lab a `c8d5cee` (17/10, appendice dell'umano compresa), letto in sola lettura. Le righe
citate (`file:r`) si riferiscono a quel commit. Il meccanismo si copia a mano, non da un template. Ogni
differenza effettiva si annota in `docs/lab/ADATTAMENTI.md` durante la fase C. Questo documento è la
lista di intenti; ADATTAMENTI è il registro di cosa è stato fatto davvero.

Fonti delle correzioni:
- l'appendice dell'umano (`docs/lab/CONCLUSIONI.md:107-117`);
- la revisione indipendente del 16/10 (problemi 1–10);
- l'ADR-0009 di Gerio, «Esito del laboratorio gerio-lab: cosa prendere del metodo v3» (17/10,
  proposta). La riconciliazione è in §6.

Legenda: **F** = fatto verificato sul codice o sui dati; **I** = ipotesi da verificare (di solito in C1).

## 1. Copio tale e quale

Senza modifiche di logica. Dove stanno le costanti di stack (Java, Maven, Flyway, percorsi) non lo
decide questo documento: si decide dopo la scelta dello stack (B3, B6). Vedi §5.

| # | Voce | File in gerio-lab | Motivo |
|---|---|---|---|
| C1 | Helper delle PR via REST | `.claude/skills/giro/pr.py` | Già generico. Aggira il blocco GraphQL delle sessioni cloud (F). |
| C2 | Riavvio della catena con `risposto` | `.github/workflows/risposta.yml` | Generico. Unico cambio: nessun login predefinito (§3). |
| C3 | Aggiornamento dei soli campi di stato dei traguardi | `scripts/lab/traguardo.py` | Generico. Tiene `traguardi.json` intoccabile fuori dallo stato. |
| C4 | Nucleo del guard: modalità, regole shell, segreti, REST allowlist | `.claude/hooks/guard.py` | Chiude per difetto e ha 31 test. In gerio-lab non risulta aggirato in 20 giri. |
| C5 | Decisione di merge: motivi di `revisione-umana` | `scripts/guard/pr_guard.py` | È il pezzo che nessun prodotto del settore fa. 34 test. |
| C6 | Test del guard e del PR helper | `scripts/guard/tests/*` | Repository git usa e getta e `gh` finto. Devono passare in C1 come in gerio-lab. |
| C7 | Ciclo del giro | `.claude/skills/giro/SKILL.md` §0–§12, `docs/METODO.md:20-32` | Lucchetto WIP=1 (PR bozza `in-corso`), ripresa dopo 6 ore, fasi piano → critica → costruzione → revisione → chiusura. Ha funzionato in 20 giri senza CI rosse. |
| C8 | Tre livelli di decisione | `docs/METODO.md:34-40` | registro / ratifica (≤ 3) / senso unico → `domanda`. Il problema non è il modello ma la lettura (§2, V2). |
| C9 | Interruttori | `docs/METODO.md:28-30`, `consegna.yml` job `avanti` | `STOP`, `LAB_ATTIVO`, `LAB_GIRI_MAX_GIORNO`, `riparazione-1/2` → `bloccato`. |
| C10 | Controllo `fuori-catena` | `consegna.yml` job `controllo` (r.185-216) | Ha scoperto il merge fuori catena del giro 008 (F). |
| C11 | Revisore isolato | `.claude/agents/revisore.md` | Lavora in un worktree sullo SHA e non riceve il ragionamento del costruttore. Ha preso 2 bloccanti prima del merge (giri 013, 016). |
| C12 | Struttura di raccolta delle metriche | `scripts/metrics/raccogli.py` | Rapporto (frontmatter) + API GitHub → `giri.csv`. Le colonne cambiano (§2). |
| C13 | Schema di consegna | `consegna.yml` (`immagine`, `deploy`), `infra/deploy.sh`, `remote.sh`, `rollback.sh`, `smoke.sh` | Immagine costruita senza segreti, deploy con flock, verifica del digest, smoke e rollback. **Condizionato alla B3:** si copia se lo stack è «web con container», altrimenti si rifà con lo stesso contratto. |
| C14 | Modelli di piano e rapporto (struttura) | `docs/lab/giri/_modello-*.md` | Le sezioni «Per te, in 10 righe», «Cosa funziona ora — con la prova» ecc. restano. Cambiano frontmatter e valori predefiniti (V1, V4). |

## 2. Cambio: le correzioni obbligatorie del v4

Ogni voce ha tre colonne: dove si interviene, come, e una prova che la correzione funziona, cioè un
test o un controllo che fallisce senza.

| # | Correzione | Perché (fatto in gerio-lab) | Dove e come | Prova di efficacia |
|---|---|---|---|---|
| V1 | **Controllo del modello di ogni agente in consegna**: diverso dall'atteso o mancante → `revisione-umana` | Il modello sta solo nel frontmatter (`revisore.md:6` `model: opus`). Nel rapporto lo ricopia l'orchestratore, e `_modello-rapporto.md:9-10` ha `sonnet`/`opus` come valori predefiniti. Il revisore ha girato su Sonnet nei giri 014–018 senza che niente lo fermasse (F). | **(a)** Modelli attesi dei 5 agenti e dell'orchestratore in `progetto.yml`. **(b)** Modello reale letto da una fonte deterministica: il campo `model` dei messaggi nel transcript di ogni subagente, letto da un hook `SubagentStop` che lo scrive in `docs/lab/giri/NNN-modelli.json` (**I**: verificare in C1 quali campi espone l'hook). Ripiego: l'agente scrive il proprio ID di modello nel `VERDETTO`, mai copiato dall'orchestratore. **(c)** `pr_guard.py` confronta: diverso o assente → motivo `modello-inatteso`. **(d)** Tolti i valori predefiniti dal modello di rapporto. | Test in `test_pr_guard.py`: PR con un modello del revisore diverso o mancante → `auto_merge=false` con quel motivo. |
| V2 | **Modulo fisso a ogni merge**, con minuti umani e ratifiche lette | I minuti erano solo i commenti `⏱` (40'), ricostruiti poi a 425' (`CONCLUSIONI.md:66-67`). «Tempo revision 10 minuti» sulla PR #2 è stato ignorato dal parser (`raccogli.py:40`, regex `⏱\s*(\d+)`). «Le ratifiche non le ho lette» (`CONCLUSIONI.md:78`) (F). | **(a)** Commento modulo dell'umano su ogni PR che mergia a mano: `⏱ N' · ratifiche lette: NNN a/b[, MMM c/d] · note`. **(b)** Il job `controllo` di `consegna`, dopo ogni merge a mano, verifica che il modulo ci sia: se manca, etichetta `modulo-mancante`, contata in STATISTICHE. **(c)** Le ratifiche dei giri mergiati in automatico si dichiarano lette nel primo modulo successivo. **(d)** Il parser accetta `⏱ N`, `N'`, `N min`, `N minuti`. | Test di `raccogli.py` sulle quattro forme. Test di `controllo` con una PR mergiata a mano senza modulo → etichetta. |
| V3 | **Token per giro** | `abbonamento.csv` vuoto; il costo per giro non è mai stato misurato. La proposta in `ROUTINE.md:281` («Come misurarla davvero») non è stata fatta per non toccare percorsi protetti a esperimento in corso (F). | Lo script di chiusura somma `usage` dai transcript della sessione: orchestratore + subagenti, dove sono leggibili (**I**: verificare in C1 percorso e formato nelle sessioni cloud delle Routine). Colonne nuove in `giri.csv`: `token_input`, `token_output`, `token_cache_lettura`, `token_cache_scrittura`, `token_fonte` (`transcript` / `stima` / `assente`). | Test dello script su un transcript finto. `token_fonte=assente` vale come dato mancante e si conta in STATISTICHE. |
| V4 | **Tipo di giro «verifica in produzione»**, con rapporto corto | T5 e T6 sono passati sulla prova e sulla dichiarazione dell'umano (`013-rapporto`, `019-rapporto:36,42`). Nessuno ha cercato difetti dopo il merge: `difetto_di` è vuoto in 20 giri (F). | Campo `tipo` nel piano: `costruzione` / `verifica-produzione` / `runbook` / `caccia`. Un giro `verifica-produzione` o `caccia`: 0 righe in `src/main` (lo impone `pr_guard`), un modello di rapporto corto (`_modello-rapporto-verifica.md`), un difetto trovato apre una riga con `difetto_di = NNN`. Il protocollo chiede un giro di verifica per traguardo e una caccia ai bug alla fine (ESPERIMENTO P5). | Test di `pr_guard`: giro `verifica-produzione` con righe in `src/main` → `revisione-umana`. |
| V5 | **Conclusioni scritte dall'umano**; la catena produce solo numeri | `SKILL.md:207` impone «confermata, smentita, non misurabile». CONCLUSIONI della catena contraddiceva STATISTICHE su H1 (revisione, problema 2) (F). | Tolto il §13 di SKILL come giudizio. Il giro di chiusura rigenera solo `STATISTICHE.md` e `giri.csv`. `docs/lab/CONCLUSIONI.md` diventa percorso protetto (guard + `pr_guard`), scritto solo dall'umano con una PR propria. | Test del guard: scrittura su `CONCLUSIONI.md` bloccata. Test di `pr_guard`: la PR di un giro che la tocca → `revisione-umana`. |
| V6 | **Integrazioni esterne come lavoro di prima classe**: runbook dalla catena, esecuzione assistita, minuti a parte | Il 88% del tempo umano su T1–T7 (256' su 290') è andato in account, segreti, DNS, prove e una sessione guidata fuori catena (`CONCLUSIONI.md:83-89`, `tempo-umano.csv:19`) (F). | **(a)** Un giro `runbook` produce `docs/runbook/<integrazione>.md`: prerequisiti, passi numerati con una casella `minuti` ciascuno, la prova di riuscita, il rollback. **(b)** L'umano lo esegue in una sessione Claude assistita, dichiarata: i minuti vanno in `tempo-umano.csv` con `riferimento = integrazione <nome>`. **(c)** Il traguardo passa solo dopo un giro `verifica-produzione` che ne esegue la prova. **(d)** Una sessione guidata fuori dal runbook si registra come `meccanismo` o `integrazione`, mai taciuta. | Il traguardo non può passare a `passato` senza un giro `verifica-produzione` successivo al runbook: controllo in `traguardo.py`, con test. |
| V7 | **Metrica primaria «giri chiusi senza intervento umano»** | Merge automatici 8 su 20; attese umane 104 h su 123 (F). Ricalcolato su `giri.csv`: i giri con merge automatico, 0 minuti umani e 0 interventi sono gli stessi 8, cioè **40%**. | Lo calcola `statistiche.py` e sta in testa a STATISTICHE. Un giro è «chiuso senza intervento» se ha merge automatico, nessuna `domanda`, nessun commit umano sul branch, 0 minuti umani dal modulo o da `tempo-umano.csv`, e non è `fuori-catena`. | Test di `statistiche.py` con 4 giri finti, uno per ogni modo di fallire. |

## 3. Altri cambi

| # | Voce | File in gerio-lab | Cambio | Motivo |
|---|---|---|---|---|
| A1 | ~~Costanti di stack in `progetto.yml`~~ | — | **Tolta al CANCELLO 1** (17/10). | Nessuna regola che condizioni la scelta dello stack prima di B3. |
| A2 | ~~Checklist di stack del revisore e del critico in un file di profilo~~ | — | **Tolta al CANCELLO 1** (17/10). | Come A1: nessuna regola che condizioni la scelta dello stack prima di B3. |
| A3 | Login fissato nel codice | `pr.py:30`, `raccogli.py:26`, `consegna.yml:43`, `risposta.yml:17`, `CLAUDE.md:61` | `LAB_AUTORE` obbligatoria, senza valore predefinito: se manca, i workflow falliscono chiusi. | Prepara la porta R1 (GitHub App, identità separata) e toglie un'identità personale dal codice. |
| A4 | `tempo-umano.csv` | `metrics/tempo-umano.csv` | Stesse colonne (`data,minuti,attivita,riferimento,da_gerio,note`) con `riferimento` chiuso: `fase 0` / `setup` / `giro NNN` / `integrazione <nome>` / `meccanismo` / `quotidiano`. `da_gerio` vuol dire «sapevo già come farlo da gerio-lab». | In gerio-lab i riferimenti liberi hanno reso la ricostruzione ambigua. |
| A5 | Modello di minaccia | README:41-58 di gerio-lab | Aggiunte: iniezione dal web (il ricercatore usa WebSearch/WebFetch, `ricercatore.md:4`; la regola testuale di `ricercatore.md:36` non basta da sola); dipendenze nuove come vettore; porta R1 con GitHub App, documentata e non costruita. | Revisione, problema 5. Con dati finti il rischio resta gestibile, ma va scritto prima. |
| A6 | Ipotesi H4 (deriva) e H5 (calendario) | `docs/ESPERIMENTO.md:11-17` | Escono. Al loro posto: attese umane misurate (P4) e aggiunte fuori piano segnalate dal revisore (descrittive). | H4 era vera per costruzione; H5 misurava l'umano (appendice r.80-81). |
| A7 | `proposte-metodo.md` | `docs/lab/proposte-metodo.md` | Resta, con una riga obbligatoria nel rapporto: «proposte al metodo: … / nessuna». | Era vuoto dopo 20 giri: nessuno lo chiedeva. |
| A8 | Ricercatore | `ricercatore.md:3` | Descrizione e fonti del dominio fioristi sostituite da quelle di planforhome, decise in B2. | È del prodotto. |
| A9 | Dependabot | `.github/dependabot.yml` | Ecosistemi secondo lo stack. Le PR di Dependabot su `.github/` si contano come `meccanismo`. | In gerio-lab una PR di Dependabot ha chiesto un merge a mano non contato nei giri (`tempo-umano.csv:5`). |

## 4. Lascio fuori

| # | Voce | File in gerio-lab | Motivo |
|---|---|---|---|
| L1 | Baseline di Gerio | `scripts/metrics/baseline_gerio.py`, `metrics/baseline-gerio.csv` | planforhome non ha un gemello da confrontare. |
| L2 | Confronto con Gerio | `statistiche.py` (H1–H5 lab contro Gerio) | Si riscrive sulle soglie P1–P6. |
| L3 | Prova di pagamento | `infra/prova-stripe.sh` | È del prodotto Gerio. |
| L4 | Stringhe di smoke e dati della demo | `infra/smoke.sh` («Fioreria Il Glicine», `rose-rosse`, `104,80 €`) | Sono del prodotto. La struttura dello smoke resta (C13). |
| L5 | Scostamenti e verifiche della SPEC | `docs/scostamenti-4-10.md`, `docs/verifiche.md` | Legati alla SPEC di Gerio. Se serviranno, nasceranno dalla SPEC di planforhome. |
| L6 | Conteggio dei test di Maven | `scripts/metrics/conta_test.py` | Legato a Surefire/Failsafe. Rientra solo se lo stack resta Java. |
| L7 | Registro dell'abbonamento | `metrics/abbonamento.csv` | Vuoto in gerio-lab. Lo sostituiscono i token per giro (V3). |
| L8 | Cartografo, `/definisci`, template pubblico | proposta del 16/10 | Decisione presa: fase 0 senza agenti nuovi, template in pausa. |
| L9 | Codice, SPEC, ADR di prodotto e nomi di Gerio | `src/`, `docs/SPEC.md`, `docs/adr/0002-0004` | planforhome parte pulito. Della SPEC di Gerio si riprende solo la forma delle sezioni (B4). |

## 5. Cosa resta aperto (non lo decide questo documento)

- **B3 e B6:** dove stanno le costanti e le checklist di stack, e cosa entra in `progetto.yml` oltre
  ai modelli attesi (V1), si decide dopo la scelta dello stack. Se lo stack cambia, C13 e L6 si
  riscrivono.
- **I1:** quali campi espongono gli hook `SubagentStop` e i transcript delle sessioni cloud (V1, V3).
  Se non bastano, valgono i ripieghi scritti nelle righe V1 e V3, e lo dico al CANCELLO 3.
## 6. Riconciliazione con l'ADR-0009 di Gerio

L'ADR-0009 decide per **Gerio**, che è un prodotto vero: prende cinque parti del v3 e lascia fuori
merge automatico e catena di Routine. Dice anche: «si riprovano nel laboratorio, non in Gerio».
planforhome è quel laboratorio, quindi tiene merge automatico e catena.

| Punto dell'ADR-0009 | In DELTA-V4 | Esito |
|---|---|---|
| 1. Test di accettazione prima, intoccabili | C5, C6, C7 | coerente |
| 2. Verificatore che esegue; modello effettivo nel rapporto, verdetto nullo se diverso | C11, V1 | coerente. V1 è più forte: la fonte è deterministica e l'esito è `revisione-umana` |
| 3. Controlli deterministici sulla PR dalla versione su `main` | C5, C10 | coerente. In Gerio il merge resta umano; qui resta automatico |
| 4. Modulo fisso: minuti e ratifiche lette; **una ratifica non letta entro il ciclo successivo torna in domanda** | V2 | **diverso:** qui la ratifica non letta si conta (P3) ma non ferma la catena. Motivo: è una misura dell'esperimento; se la catena la forzasse, P3 passerebbe per costruzione, come H4 in gerio-lab |
| 5. Integrazioni: **fette piccole**, runbook dal Costruttore, esecuzione assistita, minuti a parte | V6 | coerente; aggiunto a V6 il vincolo delle fette piccole (sotto). Modello di runbook: le guide Stripe e Brevo di Gerio, solo come forma |
| Metriche: minuti in due conti, difetti dopo il merge, modello effettivo | V2, V4, V1; ESPERIMENTO P1, P2, P5 | coerente |
| «Una metrica senza azione si cancella» | V3 (token) | i token sono descrittivi: si cancellano al giro di chiusura se nessuno li ha usati per decidere |

**Aggiunta a V6:** un giro `runbook` copre **una sola** integrazione. La fetta di costruzione che la
usa sta entro il limite di righe e non comprende altre integrazioni. In gerio-lab T5 e T6 sono costati
4 giri ciascuno, e il giro 016 è durato 236'.
