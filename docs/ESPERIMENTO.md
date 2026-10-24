# Esperimento 3 — la fase UI di planforhome con il metodo v4

Stato: **bozza al cancello di fase 0** (24/10/2026). Si congela con il merge della PR umana che
porta questo documento su `main`; da lì si cambia solo con una PR dell'umano, annotata in §9.
L'esperimento 2 (traguardi R0, giri 000–041) è chiuso: il suo documento è nella storia a `3aab127`
e in `docs/lab/CONCLUSIONI.md`.

## 1. Domanda

Con il metodo v4 e **criteri di UI/UX verificabili dentro i «Fatto quando»**, la catena porta
l'interfaccia di planforhome da «funzionale ma grezza» allo standard di `docs/DESIGN.md`, su 9
traguardi, con poco tempo umano? L'esperimento 2 ha mostrato che la catena costruisce funzioni
server e sync; qui si misura se regge sul lavoro di interfaccia, dove la qualità è più difficile da
verificare in automatico. Le sei osservazioni UX dell'umano
(`docs/lab/ux/2026-10-23-osservazioni-umano.md`) sono il punto di partenza.

## 2. Disegno

- **Stesso repository, stesso meccanismo, binari già in piedi.** Nessun giro 000: il primo giro è
  una `costruzione` sul primo traguardo. I giri continuano la numerazione (dal **042**).
- **Dati finti** (R0), come prima. R1 resta fuori.
- **Fasi:** 0 (chiusa il 24/10, registro in `docs/lab/fase0-decisioni-esp3.md`) → PR umana con
  documenti e correzioni → **revisione indipendente** del pacchetto (P6) → giri fino alla fine (§6).
- **Novità dichiarate rispetto all'esperimento 2:** criteri UX nei «Fatto quando»; moduli e
  risposte gestibili dal telefono (riferimento nel modulo, §4.3); il **cartografo** (repository
  privato di studio dell'umano, fuori dalla catena: nel pubblico restano solo le righe `studio`
  dei tempi); le correzioni di conteggio di §4, che chiudono i buchi elencati in
  `CONCLUSIONI.md` §8.

## 3. Soglie

Stesse soglie dell'esperimento 2 (P1–P6 e metrica primaria), con gli esiti **passata / mancata /
non misurabile** e i dati solo dagli script. Differenze dichiarate prima:

| # | Cosa | Soglia | Note per questo esperimento |
|---|---|---|---|
| **P1** | Lavoro interno: minuti umani per traguardo | **≤ 10'** su ogni traguardo e in media | La media si stampa con «≥» se una parte è ignota (§4.4). |
| **P2** | Integrazioni esterne | ≤ 60' ciascuna | **Non misurabile, dichiarato ora:** nessun traguardo UI ha integrazioni esterne (`expo-system-ui` è una dipendenza, non un'integrazione). Se una spec ne aggiungesse una, si dichiara in §9. |
| **P3** | Decisioni | ≤ 5 per traguardo; 100% delle ratifiche lette entro il merge successivo | Invariata. |
| **P4** | Autonomia | ≥ 60% merge automatici; 0 fuori catena; attese ≤ 50% del calendario; primaria ≥ 50% | Calendario come in §4.2. |
| **P5** | Qualità dopo il merge | verifica per traguardo e caccia finale fatte; **≤ 1 bloccante** trovato dopo il merge; controllo V1 provato | Un atteso sbagliato del piano **non** è un bloccante né un difetto (§4.5). La prova V1 di `docs/lab/prove/v1.md` (esperimento 2) vale finché il meccanismo di V1 non cambia. |
| **P6** | Fase 0 non a occhi chiusi | ≥ 25% delle proposte cambiate o respinte; revisione indipendente prima del primo giro | Registro: `docs/lab/fase0-decisioni-esp3.md`. Revisione: `docs/lab/revisione-fase0-esp3.md`, con `esito:` in testa. |

**Descrittivi, senza soglia:** P4 sui soli giri `costruzione`; giri con un modello inatteso; token e
minuti di sessione per giro; CI rosse; bloccanti presi dal revisore prima del merge; aggiunte fuori
piano; minuti dei moduli delle PR umane per riferimento (§4.3); minuti `studio` del cartografo.

**Rischi noti sulle soglie, scritti prima:**
- **P1 sui giri UX:** il traguardo T17 (walkthrough a freddo) produce un rapporto da leggere:
  leggerlo è tempo umano del traguardo, e 10' sono stretti. Si misura comunque.
- **P4, attese:** come nell'esperimento 2, misurano soprattutto la disponibilità dell'umano.
- **P5:** la caccia finale cerca difetti anche nelle schermate: un difetto UI è un difetto.

## 4. Come si conta

Valgono le regole dell'esperimento 2 (tempo nel momento, modulo di merge su ogni merge a mano,
`modulo-mancante` = minuti ignoti, token, modelli), con queste correzioni, che chiudono i buchi di
`CONCLUSIONI.md` §8. Le implementano `scripts/metrics/raccogli.py` e `statistiche.py`.

1. **Perimetro.** Contano i giri **dal 042 in poi** (campo `dal_giro` di `traguardi.json`);
   `metrics/giri.csv` resta unico e gli script filtrano. Nessun giro 000: nessun doppio conteggio.
2. **Calendario e attese.** Il calendario va dall'inizio del primo giro al **merge che chiude
   l'ultimo traguardo**: i giri `caccia` e `chiusura` restano fuori dal calendario, non dalle
   attese.
3. **Moduli, anche dal telefono.** Un modulo che comincia con «🤖» (scritto da una sessione
   assistita su richiesta dell'umano) **conta**: è il canale previsto per il lavoro da telefono.
   Un modulo su una **PR umana** (fuori dai giri) porta un riferimento:
   `⏱ N' · riferimento: spec | meccanismo | integrazione <nome> · ratifiche lette: … · note`;
   `raccogli.py` lo scrive in `metrics/moduli-pr-umane.csv` e `statistiche.py` lo somma (P2 per le
   integrazioni, descrittivo per il resto). I riferimenti ammessi di `tempo-umano.csv` si
   allargano con **`spec`** (scrittura delle specifiche, fuori da P1) e **`studio`** (cartografo,
   fuori da P1).
4. **Minimi dichiarati.** Ogni somma con una parte ignota si stampa come minimo («≥»), media di P1
   compresa.
5. **Atteso sbagliato ≠ difetto.** In una verifica, un controllo rosso per un atteso sbagliato del
   piano si corregge nel piano e si riesegue: non è un bloccante, non entra in `difetti:`.
   `difetti:` registra solo i difetti del prodotto trovati dopo il merge; `difetto_di` è il giro
   che ha introdotto il difetto, **mai** il giro di verifica o di caccia.
6. **Prova umana ≠ porta.** La `domanda` che chiede una prova sul telefono conta come domanda
   (intervento e attesa), ma **non** entra in `porte_senso_unico`.
7. **Attribuzione.** Giri di costruzione e di verifica di un traguardo → quel traguardo (P1).
   Giri `caccia` → a parte (P5). Giro `chiusura` → fuori da tutto. Righe `spec`, `studio`,
   `meccanismo`, `quotidiano` → descrittive.
8. **Difetti ereditati.** I tre minori della caccia 040 sono il traguardo T11: le loro correzioni
   si contano lì, non nell'esperimento 2.

## 5. Minacce alla validità

| Minaccia | Effetto | Mitigazione |
|---|---|---|
| La qualità UI non si verifica tutta in automatico | Screenshot e contrasti verdi non bastano a dire «usabile» | T17: walkthrough a freddo di una sessione **senza contesto del codice** sui 5 job di `PIANO-UI.md` §6; dopo la fine, prove con utenti veri, fuori misura |
| Stesso repository e stesso umano dell'esperimento 2 | L'umano ha già pratica del meccanismo: i minuti non sono confrontabili con un primo esperimento | Si dichiara; la colonna `da_gerio` continua a marcare «sapevo già come farlo» |
| Correzioni al meccanismo tra i due esperimenti | Gli esiti non sono confrontabili alla pari con l'esperimento 2 | Tutte nel pacchetto di fase 0, elencate nel registro; durante l'esperimento il metodo non cambia (METODO §10) |
| Le spec di T18 e T19 si scrivono a esperimento in corso | I loro costi si mescolerebbero ai giri | Riferimento `spec` in `tempo-umano.csv` e nei moduli (§4.3): contati a parte |
| L'osservatore è il soggetto | Chi misura è chi lavora | Numeri solo dagli script; conclusioni dell'umano; revisione indipendente prima del primo giro |
| Un caso solo, sullo stesso prodotto | Nessuna generalizzazione | È il terzo caso del metodo, non la prova |

## 6. Quando finisce

Al primo di questi eventi:
1. tutti i traguardi di `traguardi.json` passati **e la caccia finale chiusa**;
2. **21 giorni** di calendario dall'inizio del primo giro;
3. l'interruttore (`LAB_ATTIVO=false` o `docs/lab/STOP`) azionato dall'umano.

Poi il giro di chiusura rigenera `STATISTICHE.md` e `giri.csv`, scrive `STOP` e nient'altro.

## 7. Chi conclude

**L'umano**, in `docs/lab/CONCLUSIONI.md` (appendice per l'esperimento 3, con una PR sua): per
ogni soglia l'esito e i dati, fatti separati dalle ipotesi.

## 8. Cosa si congela al cancello

Le soglie di §3, le regole di §4, le condizioni di §6 e i traguardi T11–T19 di `traguardi.json`
(titoli e «Fatto quando»). Le spec di T18 e T19 arrivano dopo, con una PR umana che riempie solo il
campo `spec` del traguardo: la catena li prende in carico solo da quel momento.

## 9. Modifiche dopo il congelamento

| Data | PR | Cosa | Perché |
|---|---|---|---|
