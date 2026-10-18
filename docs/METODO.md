# Metodo v4 — la catena dei giri

Regola che comanda: **il prodotto avanza da solo; l'umano decide le porte a senso unico, esegue
le integrazioni esterne con un runbook, legge i numeri e scrive le conclusioni.** Perché e come si
valuta: `docs/ESPERIMENTO.md`. Cosa cambia rispetto al v3 di gerio-lab: `docs/lab/DELTA-V4.md`.

## 1. Un giro: cinque agenti in una sessione

Ogni giro è una **sessione cloud nuova** (una Routine di Claude Code) che esegue la skill `/giro`.
La sessione principale fa solo da orchestratore: passa a ogni agente solo ciò che gli serve e
raccoglie risposte brevi. Ogni agente lavora in un contesto pulito. I modelli attesi stanno in
`progetto.yml` (`modelli_attesi`).

| Fase | Agente (modello) | Riceve | Produce |
|---|---|---|---|
| 1. Piano | `pianificatore` (Opus) | PROGRESS, traguardi, sezioni della SPEC o specifica di Spec Kit | tipo e piano della fetta, test di accettazione |
| 2. Concorrenti | `ricercatore` (Sonnet) | fetta e domande del piano | 1 pagina con fonti: concorrenti e casi reali |
| 3. Critica | `critico` (Opus) | piano + ricerca + codice | da correggere, semplificazioni, concorrenza, perimetro |
| 4. Costruzione | `costruttore-tdd` (Sonnet) | piano finale + test di accettazione | codice in TDD, commit piccoli; o un runbook |
| 5. Revisione | `revisore` (Opus) | piano + SHA, **mai** il ragionamento del costruttore | verdetto con prove: esegue, non scrive |

**Modello reale (V1).** Un hook registra, per ogni agente, il modello letto dal suo transcript e i
token in `docs/lab/giri/NNN-agenti.json`; in chiusura si aggiunge l'orchestratore. Un modello
diverso dall'atteso, o un dato mancante, manda la PR in `revisione-umana`. Nessun modello si
ricopia a mano nel rapporto.

## 2. La catena

`/giro` → PR → `ci` → `consegna` (sempre la versione su `main`): controlli → merge → deploy →
smoke → avvio del giro successivo. Il giro successivo è una sessione nuova: è il «clear».

- **WIP = 1:** una sola PR `giro` aperta. Il giro apre subito una PR bozza `in-corso` come
  lucchetto e pusha a ogni fase; un lucchetto fermo da più di 6 ore si riprende dalla sua fase.
  La storia pubblicata non si riscrive: niente push forzati, li bloccano anche le regole di GitHub.
- **Si ferma** solo se: porta a senso unico (PR `domanda`), controllo negativo (`revisione-umana`),
  due riparazioni CI fallite (`bloccato`), limite di giri al giorno, interruttore spento
  (variabile `LAB_ATTIVO` diversa da `true`, o file `docs/lab/STOP`).
- **Riparte** da sola: dopo il deploy, dopo una CI rossa (riparazione), quando metti `risposto`,
  ogni notte se la catena si è interrotta.
- **Notifiche:** per una `domanda` o una `revisione-umana` l'umano riceve la notifica della PR su
  GitHub e quella dell'app Claude sul telefono, a fine sessione. Nessun altro canale, nessun
  connettore.

## 3. Decisioni: tre livelli

| Livello | Esempi | Cosa succede |
|---|---|---|
| Registro | nomi, testi, layout, dettagli interni | riga in `DECISIONI.md`, nessuna ratifica |
| Ratifica | cosa vede chi usa l'app, dati salvati, costi ricorrenti, scelte care da cambiare | **massimo 3 per giro**, numerate `NNN-a`, `NNN-b`, `NNN-c`, in testa al rapporto; si contestano commentando la PR con `contesto n. X: …` |
| Senso unico | CLAUDE.md regola 2 | il giro si ferma con una PR `domanda`; risposta + etichetta `risposto` → riparte |

**Le ratifiche si contano, non fermano.** L'umano le dichiara lette nel modulo di merge, per id.
Una ratifica del giro N vale letta se compare in un modulo di una PR mergiata a mano, dal merge
di N fino al primo merge a mano successivo compreso. I merge automatici in mezzo non consumano
la finestra. Una ratifica non letta resta un dato
(ESPERIMENTO P3), non blocca la catena: se la bloccasse, P3 passerebbe per costruzione.

## 4. Merge automatico: quando sì

`consegna` mergia solo se tutto è vero (`scripts/guard/pr_guard.py`):
- CI verde sullo stesso SHA, build dell'APK compresa; PR non bozza, dal branch `claude/giro-…`,
  con etichetta `giro`;
- nel corpo il verdetto del revisore con 0 bloccanti;
- nessun percorso protetto: quelli di `progetto.yml` (`percorsi_protetti`), più
  `docs/lab/CONCLUSIONI.md` e `docs/lab/giri/*-agenti.json`; nessun collegamento simbolico;
- modello reale di ogni agente uguale all'atteso; nel giro `costruzione`, tutti e cinque i ruoli
  registrati;
- diff coerente con il tipo del giro (§6);
- migrazioni solo aggiunte, in sequenza, senza istruzioni distruttive;
- test di accettazione già su `main` intatti; quelli nuovi toccati solo da commit `test(acceptance)`;
- `traguardi.json` cambiato solo nei campi di stato;
- al massimo 1.500 righe aggiunte in `server/src/main`, `app/src` e `app/app`; nessun segreto nel
  diff.

Altrimenti etichetta `revisione-umana` con i motivi. L'agente non può cambiare le proprie regole e
approvarsele: le regole valide sono sempre quelle su `main`. Le regole della CLAUDE.md regola 3 un
giro non le tocca proprio (hook). Un merge a mano di una PR di un giro senza `revisione-umana` o
`bloccato` viene segnato `fuori-catena`: è il segnale che qualcuno ha saltato la catena.

**Modulo di merge (V2).** Ogni PR mergiata a mano ha un commento dell'umano:
`⏱ N' · ratifiche lette: NNN-a NNN-b MMM-a · note`, oppure `ratifiche lette: nessuna`. Senza modulo, la PR prende `modulo-mancante` e quel merge
conta come «minuti ignoti».

## 5. Limiti contro la deriva

- Una fetta = un traguardo o una sua parte. Ciò che non serve al traguardo va in «idee per dopo».
  Una fetta che usa un'integrazione esterna non ne comprende altre.
- Revisore: bloccante solo per correttezza, requisiti, sicurezza, isolamento, perdita di dati.
  Dei dubbi se ne correggono al massimo 2 per giro; gli altri restano nel rapporto.
- Critico: al massimo 5 punti da correggere. Ricercatore: 1 pagina, al massimo 3 idee per dopo.
- 3 tentativi falliti sullo stesso errore → parcheggio con BLOCCO in PROGRESS.
- Riparazioni della CI: al massimo 2 per PR, poi `bloccato`.

## 6. Quattro tipi di giro (V4, V6)

| Tipo | A cosa serve | Codice | Rapporto |
|---|---|---|---|
| `costruzione` | far diventare verde il «Fatto quando» di un traguardo, o una sua parte | ≤ 1.500 righe aggiunte | completo |
| `verifica-produzione` | eseguire il «Fatto quando» in produzione dopo il merge | 0 righe in `server/src/main`, `app/src`, `app/app` | corto |
| `runbook` | preparare **una sola** integrazione esterna: `docs/runbook/<nome>.md` | nessuno: solo `docs/runbook/`, `docs/lab/`, `metrics/` | completo |
| `caccia` | cercare difetti sul codice di `main`, alla fine | 0 righe, come la verifica | corto |

- **Un traguardo passa solo con un giro `verifica-produzione`** (ESPERIMENTO §4, E2):
  `scripts/lab/traguardo.py` rifiuta `passato` senza il rapporto di verifica con `esito: passato`.
- Un difetto trovato dopo il merge si registra nel rapporto, campo `difetti:`, con una voce
  `NNN:gravità` per difetto. `NNN` è il giro che l'ha introdotto (`difetto_di`); la gravità è
  `bloccante`, `maggiore` o `minore`. La correzione è la fetta di un giro di costruzione.
- Il giro di chiusura (`tipo: chiusura`) produce solo numeri. Resta fuori da P4, dalla metrica
  primaria e dall'attribuzione.
- `pr_guard` controlla che il diff rispetti il tipo; tipo mancante → `revisione-umana`.

**Runbook (V6).** Un giro `runbook` produce prerequisiti, passi numerati con una casella `minuti`
ciascuno, la prova di riuscita e il rollback. L'umano lo esegue in una sessione Claude assistita e
dichiarata; i minuti vanno in `metrics/tempo-umano.csv` con `riferimento = integrazione <nome>`.
Una sessione guidata fuori dal runbook si registra comunque, mai taciuta. Poi un giro
`verifica-produzione` esegue la prova; solo allora il traguardo passa.

## 7. Funzioni nuove con Spec Kit

1. L'umano lancia `/speckit-specify` e `/speckit-clarify` (e `checklist` se serve) in una sessione
   interattiva: nasce `specs/NNN-<nome>/spec.md`, con un «fatto quando» verificabile.
2. Con una PR sua, aggiunge il traguardo a `traguardi.json`, con `spec` che punta alla specifica.
3. Il pianificatore legge la specifica; costruttore e revisore lavorano come sempre.

La catena non lancia mai i comandi di Spec Kit. Non si usano `plan`, `tasks`, `implement`,
`converge`, `analyze` né l'estensione git: farebbero un secondo piano accanto a quello del giro.

## 8. Cosa fa l'umano

- Risponde alle PR `domanda`, mette `risposto` e scrive quanto tempo ha impiegato: `⏱ 5'`.
- Rivede le PR `revisione-umana`, le mergia o le chiude, con il modulo di merge.
- Esegue i runbook in una sessione assistita e annota i minuti per passo.
- Scrive ogni blocco di lavoro in `metrics/tempo-umano.csv`, nel momento.
- Ogni giorno, 5': PROGRESS e STATISTICHE; se serve contesta una ratifica.
- Alla fine scrive `docs/lab/CONCLUSIONI.md`, con una PR sua.
- Tutto il resto del tempo: niente.

## 9. Metriche e conclusioni (V3, V5, V7)

Ogni giro aggiunge il suo rapporto con le metriche in testa e `NNN-agenti.json` con modelli e
token. `scripts/metrics/` rigenera `metrics/giri.csv` e `docs/lab/STATISTICHE.md`, con in testa la
metrica primaria: **giri chiusi senza intervento umano** (merge automatico, nessuna `domanda`,
nessun commit umano, 0 minuti umani, non `fuori-catena`). Definizioni e soglie in ESPERIMENTO.

La catena produce **solo numeri**. Le conclusioni le scrive l'umano: `docs/lab/CONCLUSIONI.md` è
un percorso protetto, e il giro di chiusura rigenera solo STATISTICHE e `giri.csv`.

## 10. Vincoli

1. Questo file resta ≤ 2 pagine. Le regole cambiano solo con una PR umana.
2. Durante l'esperimento il metodo non cambia, salvo correzioni di bug del meccanismo, registrate in
   `docs/ESPERIMENTO.md`.
