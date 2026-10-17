# Esperimento 2 — planforhome con il metodo v4

Stato: **soglie congelate al CANCELLO 1** (17/10/2026), modificate con E1–E6 al CANCELLO 2. Da qui si cambiano solo con una
PR dell'umano, annotata qui sotto in §9.

## 1. Domanda

Con il metodo v4, una catena di agenti porta un prodotto **nuovo** da un'idea a 6–10 traguardi? Serve
farlo con poco tempo umano sul lavoro interno, integrazioni esterne assistite e brevi, decisioni prese
davvero dall'umano e qualità controllata dopo il merge.

gerio-lab (esperimento 1) ha ricostruito un prodotto esistente e ha lasciato un risultato netto: il
metodo toglie tempo umano dove il lavoro sta dentro il repository, e lo sposta su integrazioni,
merge dei percorsi protetti e verifiche. Lo dice l'appendice dell'umano, `CONCLUSIONI.md:90-92`.
Questo esperimento misura le due parti separatamente, con soglie scritte prima.

## 2. Disegno

- **Un caso solo, nessun gruppo di controllo.** I numeri di gerio-lab sono un riferimento per tarare
  le soglie, non una baseline: cambiano il dominio, il metodo (v4) e forse lo stack.
- **Dati finti** (R0) per tutta la durata. Il passaggio a dati reali (R1) richiede una GitHub App
  separata e l'umano come titolare del trattamento: non fa parte di questo esperimento.
- **Fasi:**
  1. 0, interattiva, senza agenti nuovi;
  2. setup assistito;
  3. giro 000 (i binari);
  4. giri fino alla fine (§6).
- Il meccanismo è quello di `docs/lab/DELTA-V4.md`. Le differenze effettive sono in
  `docs/lab/ADATTAMENTI.md`.

## 3. Soglie

Ogni soglia ha un esito tra **passata**, **mancata** e **non misurabile**. Il terzo esito vale quando il
dato manca o la condizione non si è presentata, ed è dichiarato prima dove è prevedibile. Ogni dato
viene da un file e da una colonna precisi; li misura lo script indicato, mai un agente a parole.

| # | Cosa | Soglia | gerio-lab (riferimento) | Dato e fonte |
|---|---|---|---|---|
| **P1** | Lavoro interno: minuti umani per traguardo | **≤ 10'** su **ogni** traguardo interno, e in media | 8,5' in media su T1–T4 (10, 12, 5, 7) | Somma per traguardo di `tempo-umano.csv` (`riferimento = giro NNN`) e dei moduli di merge, esclusi i giri `runbook` e le righe `integrazione <nome>`. Script `statistiche.py`. |
| **P2** | Integrazioni: minuti umani per integrazione esterna, assistita | **≤ 60'** per ciascuna | ~100' Stripe (T5 = 117 in tutto), ~120' email (T6 = 139), senza assistenza | Somma delle righe `integrazione <nome>`. Comprende l'esecuzione del runbook, gli account, i segreti, il DNS e la prova. Non comprende il merge dei giri di costruzione. |
| **P3** | Decisioni | **≤ 5** (ratifiche + porte a senso unico) su **ogni** traguardo; **100%** delle ratifiche dichiarate lette entro il merge successivo | media 2,5, ma 6 su T5 e T6; ratifiche lette: nessuna dichiarata | `giri.csv` (`decisioni_ratifica`, `porte_senso_unico`) per traguardo; moduli di merge (`ratifiche lette`) contro le ratifiche dei rapporti. |
| **P4** | Autonomia | **≥ 60%** di merge automatici; **0** merge fuori catena; attese umane **≤ 50%** del calendario; metrica primaria **≥ 50%** dei giri | 40% (8/20); 1 (giro 008); 85% (104 h su 123); metrica primaria 40% | `giri.csv` (`merge_automatico`, `fuori_catena`, `pr_creata`, `pr_mergiata`, fine sessione). Metrica primaria come in DELTA-V4 V7. |
| **P5** | Qualità dopo il merge | un giro `verifica-produzione` per traguardo e una `caccia` finale, fatti; **≤ 1** bloccante trovato dopo il merge; il controllo V1 **provato** in C1 (un modello diverso finto → `revisione-umana`) (E3) | difetti non cercati; revisore su Sonnet per 5 giri senza segnale | `giri.csv` (`tipo`, `difetto_di`, gravità); `NNN-modelli.json` contro `progetto.yml`. |
| **P6** | Fase 0 non a occhi chiusi | **≥ 25%** delle proposte cambiate o respinte in `docs/lab/fase0-decisioni.md`; SPEC, traguardi e protocollo **passano una revisione indipendente** prima del giro 000 | Gerio: 138 decisioni su 140 approvate senza modifiche | Conteggio delle righe di `fase0-decisioni.md`; rapporto della revisione (B8) con i punti corretti. |

**Descrittivi, senza soglia** (manca un riferimento affidabile):
- i numeri di P4 calcolati sui soli giri `costruzione` (E4);
- giri con un modello inatteso, segnalati da V1 (E3);
- token per giro;
- minuti di sessione per giro;
- setup (minuti per passo di `SETUP.md`);
- minuti della fase 0;
- aggiunte fuori piano segnalate dal revisore;
- CI rosse;
- bloccanti presi dal revisore prima del merge.

**Rischi noti sulle soglie, scritti prima:**
- **P4:** i primi giri toccano percorsi protetti (infra, build, dipendenze) e vanno in revisione umana
  per costruzione: in gerio-lab, T1 e T2 hanno avuto 1 merge automatico su 4. Si contano comunque
  tutti i giri, il 000 compreso. Una soglia che esclude i giri scomodi non misura niente.
- **P2:** se i traguardi scelti in B5 non hanno integrazioni esterne oltre al deploy, P2 è «non
  misurabile», e lo si dichiara al CANCELLO 2. Il setup della fase D (server, DNS, segreti) si misura
  per passo ma non entra in P2: è una tantum e non dipende dal metodo.
- **P4, attese:** misurano soprattutto la mia disponibilità, non la catena. La soglia resta perché è
  il costo che gerio-lab ha nascosto.

## 4. Come si conta

- **Tempo umano.** Ogni blocco in cui l'umano è presente, assistito o no, va in
  `metrics/tempo-umano.csv`.
  - Colonne: `data,minuti,attivita,riferimento,da_gerio,note`.
  - `riferimento` ammessi: `fase 0`, `setup`, `giro NNN`, `integrazione <nome>`, `meccanismo`,
    `quotidiano`.
  - Le righe si scrivono **nel momento**, non ricostruite a memoria.
  - In più, il **modulo di merge** su ogni PR mergiata a mano: `⏱ N' · ratifiche lette: NNN a/b ·
    note`. Un merge a mano senza modulo prende l'etichetta `modulo-mancante`, e quel merge vale come
    «minuti ignoti».
- **Traguardo interno / integrazione.** Si decide in B5 e si scrive in `traguardi.json` (campo
  `integrazioni: []`). Non si riclassifica dopo. L'unica integrazione è FCM (T10): **P2 si giudica su
  un solo caso** (E5).
- **Quando un traguardo passa.** Diventa «passato» solo dopo il suo giro `verifica-produzione`, per
  tutti i traguardi, interni e di integrazione (E2).
- **Attribuzione** (E5):

  | Cosa | Dove si conta |
  |---|---|
  | giro 000 | traguardi T1 e T2, quindi P1 |
  | giri di costruzione di un traguardo, compresa la parte interna di T10 | quel traguardo, quindi P1 |
  | giro `runbook` di un'integrazione, sua revisione e merge, esecuzione assistita, prova in produzione | `integrazione <nome>`, quindi P2 |
  | giro `verifica-produzione` di un traguardo interno | quel traguardo, quindi P1 |
  | giro `caccia` | a parte: descrittivo, più P5 |
  | setup della fase D (server, DNS, segreti, chiave dell'APK, ruleset) | `setup`: misurato, non giudicato |
  | progetto Firebase e `google-services.json` | `integrazione FCM` se fatti dentro T10; `setup` se fatti nella fase D |
  | correzioni del meccanismo, PR di Dependabot su `.github/` | `meccanismo` |
- **Decisioni.** Ratifiche + porte a senso unico, da `DECISIONI.md`, attribuite al traguardo del giro.
- **Calendario e attese.** Il calendario va dal giro 000 al merge che chiude l'ultimo traguardo.
  L'attesa umana va dalla fine della sessione del giro al merge, per i soli merge a mano, più il tempo
  in cui una `domanda` resta aperta.
- **Modelli.** Attesi da `progetto.yml`, reali da `NNN-modelli.json` (DELTA-V4 V1).
- **Difetti.** Una riga per difetto trovato dopo il merge, con `difetto_di = NNN` e una gravità
  (`bloccante` / `maggiore` / `minore`); «bloccante» con la definizione del revisore.
- **Token.** Dallo script di chiusura (DELTA-V4 V3), con `token_fonte`.

## 5. Minacce alla validità

| Minaccia | Effetto | Mitigazione |
|---|---|---|
| Dominio nuovo, metodo v4 ed eventuale stack nuovo cambiano insieme | Un esito non si può attribuire a una sola causa | Si dichiara. La scelta dello stack (B3) pesa anche su questo: con lo stesso stack di gerio-lab ne cambiano due. |
| Contaminazione da gerio-lab | L'umano sa già come fare setup, integrazioni e merge | Colonna `da_gerio` su ogni riga. |
| Minuti autodichiarati | Possono essere sottostimati o dimenticati | Scritti nel momento, modulo obbligatorio al merge, `modulo-mancante` contato. |
| Assistenza dell'IA diversa da gerio-lab | P2 non è confrontabile alla pari con gerio-lab | P2 ha una soglia assoluta, non un confronto. |
| L'osservatore è il soggetto | L'umano che misura è anche quello che lavora | Le conclusioni le scrive l'umano, ma i numeri vengono solo dagli script. Revisione indipendente prima del giro 000. |
| Dati finti | Nessun rischio reale su privacy e sicurezza | R1 è fuori dall'esperimento. Nessuna conclusione sulla prontezza per dati reali. |
| Routine in anteprima, header datato | Il meccanismo può rompersi per cause esterne | Una rottura esterna si annota come `meccanismo` e non conta nei giri. |
| Quota del piano che declassa il modello | Agenti su un modello diverso dall'atteso | V1 la rende visibile e la manda in revisione umana. |
| Un caso solo | Nessuna generalizzazione | Il template resta in pausa. Questo è il secondo caso, non la prova. |
| Cambia anche il framework del server (Spring invece di Quarkus) (E6) | Una variabile in più rispetto a gerio-lab | Si dichiara. |
| Spec Kit con `/giro` è una variabile nuova (E6) | Effetti del flusso di specifica confusi con quelli della catena | Si dichiara; l'uso di Spec Kit si annota per traguardo. |
| 10 traguardi con un giro di verifica ciascuno fanno 25–30 giri (E6) | La fine per tempo (21 giorni) è un esito probabile | Si dichiara ora: finire per tempo non è un fallimento del protocollo, è un dato. |

## 6. Quando finisce

Al primo di questi eventi:
1. tutti i traguardi di `traguardi.json` passati **e la caccia finale chiusa** (E1);
2. 21 giorni di calendario dall'inizio del giro 000;
3. l'interruttore (`LAB_ATTIVO=false` o `docs/lab/STOP`) azionato dall'umano.

Poi il giro di chiusura rigenera `STATISTICHE.md` e `giri.csv`, scrive `STOP` e nient'altro.

## 7. Chi conclude

**L'umano.** `docs/lab/CONCLUSIONI.md` è un percorso protetto: la catena non lo scrive. Le
conclusioni dicono, per ogni soglia P1–P6, l'esito e su quali dati si basa. Separano i fatti dalle
ipotesi e si possono far leggere a un revisore indipendente prima di pubblicarle.

## 8. Cosa si congela al CANCELLO 1

Le soglie P1–P6, le regole di §4 e le condizioni di fine di §6. SPEC, traguardi e stack si fissano al
CANCELLO 2. La classificazione «interno / integrazione» di ogni traguardo si fissa lì e non cambia più.

## 9. Modifiche dopo il congelamento

| Data | PR | Cosa | Perché |
|---|---|---|---|
| 17/10/2026 | commit della fase 0 (approvazione al CANCELLO 2) | modifiche E1–E6, sotto | rilievi della revisione indipendente B8 (docs/lab/revisione-fase0.md) |

### Modifiche E1–E6, approvate dall'umano al CANCELLO 2 (17/10/2026)

Applicate nel testo sopra; qui resta il motivo di ciascuna.

| # | Dove | Modifica proposta | Perché |
|---|---|---|---|
| E1 | §6, punto 1 | «tutti i traguardi passati **e la caccia finale chiusa**» | Oggi l'esperimento finisce prima che si possa fare la caccia chiesta da P5. |
| E2 | §4 | Un traguardo diventa «passato» solo dopo il suo giro `verifica-produzione`. La regola vale per tutti i traguardi, non solo per le integrazioni. | DELTA-V4 V4 e V6 dicevano cose diverse. |
| E3 | §3, P5 | La clausola «0 giri con un modello inatteso non segnalato» diventa: «il controllo V1 è provato in C1 (un modello diverso finto → `revisione-umana`)». Il numero di giri con un modello inatteso diventa un dato descrittivo. | La clausola attuale ha una sola fonte, la stessa che fa scattare V1: passa per costruzione. |
| E4 | §3, P4 | Soglia invariata. In più, gli stessi numeri si pubblicano sui soli giri `costruzione`, come dato descrittivo. | I giri di verifica e di caccia, con 0 righe di codice, vanno quasi sempre in merge automatico e gonfiano P4. |
| E5 | §4 | Tabella di attribuzione (sotto). P2 si dichiara su **un solo caso** (FCM). | Oggi non è scritto dove vanno il giro 000, i giri di runbook e di verifica, e il setup di Firebase. |
| E6 | §5 | Tre minacce in più: (a) cambia anche il framework del server (Spring invece di Quarkus); (b) Spec Kit con `/giro` è una variabile nuova; (c) 10 traguardi con un giro di verifica ciascuno fanno 25–30 giri: 21 giorni sono stretti, e la fine per tempo è un esito probabile. | Scelte della fase 0, venute dopo il congelamento. |
