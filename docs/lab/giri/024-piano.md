---
giro: 024
traguardo: T9
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-21T18:05:20Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 024 — T9 parte 2: motore di sync del client (bozza)

## RISPOSTA: Opzione A (21/10, decisione 81). DOMANDA per l'umano — dipendenza npm nuova per il database locale su Android

**Contesto.** SPEC §4 e §7: su Android il client ha un database locale SQLite e una coda di
modifiche. La parte server di T9 è fatta (giro 023: snapshot, changes, `version` sul PUT). Il motore
di sync del client ha bisogno di un database locale, e nessuna libreria SQLite è tra le dipendenze
di base (ADR-0001, SPEC §14.1, DECISIONI): è una porta a senso unico (CLAUDE.md regola 2). ADR-0001
cita già `expo-sqlite` come la strada «matura su Android» (righe 46–47), ma non la registra come
dipendenza decisa.

**Opzioni.**

| | Opzione | Pro | Contro |
|---|---|---|---|
| A | `expo-sqlite`, versione dell'SDK 58 (`~58.0.x`, fissata da `npx expo install expo-sqlite`), solo Android | modulo ufficiale Expo, nessun plugin nativo a parte, segue gli aggiornamenti dell'SDK (Dependabot); già indicato da ADR-0001 | il supporto web è alpha (COOP/COEP): non lo usiamo, il web resta online (§7); in Jest non gira, serve un adattatore in memoria |
| B | `@op-sqlite/op-sqlite` (ultima stabile) | più veloce, JSI | libreria di terzi, plugin di Expo e build nativa da gestire; più superficie nell'APK in CI |
| C | Nessuna dipendenza in questo giro | nessuna porta ora | il motore usa solo un archivio in memoria; il «Fatto quando» di T9 (database locale) resta aperto e la domanda torna al giro dopo |

**Raccomandazione: A.** Motivo: è il modulo che ADR-0001 già prevede, versionato con l'SDK; la
logica del motore resta dietro un'interfaccia `LocalStore`, così i test Jest usano un archivio in
memoria e nessun'altra dipendenza (niente `better-sqlite3` in Jest).

**Cosa succede dopo ogni risposta.**
- **A:** il giro riparte con la fetta qui sotto, completa; `app/package.json` cambia, quindi la PR
  va in `revisione-umana`. Decisione da registrare in DECISIONI.
- **B:** stessa fetta con op-sqlite; in più va provata la build dell'APK in CI con il plugin; il
  budget cresce e la fetta potrebbe dividersi.
- **C:** la fetta si riduce al motore con l'archivio in memoria (righe 1–5 del «Fatto quando»);
  l'adattatore SQLite e il cablaggio su Android restano al giro successivo, con la stessa domanda.

## Fetta e traguardo
T9 parte 2 (costruzione): motore di sync del client — coda locale con `mutation_id`, invio in
ordine, lettura per `seq`, fotografia per famiglia nuova, esito dei conflitti, pulizia di una
famiglia persa — dietro un'interfaccia `LocalStore` con due implementazioni: in memoria (Jest) e
SQLite (Android, se risposta A). Il web non cambia. Fonti: SPEC §4, §7; rapporto 023.

## Fatto quando — controlli eseguibili
- [ ] `cd app && npx jest src/sync` → rete finta che cade a metà invio: nessuna modifica persa né
  duplicata (ogni `mutation_id` arriva al server finto una volta con effetto).
- [ ] Jest: le spunte di una lista della spesa fatte offline arrivano dopo la riconnessione, in ordine.
- [ ] Jest: dopo un inoltro di un task fuori dalle famiglie dell'utente, o dopo la perdita di
  un'appartenenza, l'archivio locale non contiene più righe di quella famiglia.
- [ ] Jest: entrando in una famiglia nuova, il client chiede prima la fotografia, poi solo le
  modifiche dopo `seq`.
- [ ] Jest: un conflitto o un rifiuto di permesso produce un esito per l'avviso discreto; il client
  scarta la modifica e riscarica l'entità.
- [ ] (A) `cd app && npx tsc --noEmit && npx eslint .` verdi con l'adattatore SQLite; build APK in
  CI verde.
- [ ] `cd app && npx playwright test` invariato e verde (il web resta online).

## Fuori perimetro
- Offline sul web; sincronizzazione in tempo reale (`traguardi.json → fuori_perimetro`).
- Template 730, calendario, accesso Google/Apple, iPhone, Play Store, email, dati reali.
- Modifiche al server oltre a correzioni necessarie all'API del giro 023.
- Avviso discreto nell'interfaccia oltre all'esito esposto dal motore (resta per un giro di UI).
- Qualunque dipendenza oltre a quella scelta nella domanda.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Da scrivere in FINALE, dopo la risposta. Dati demo: famiglie «Rossi» e «Bianchi-Verdi», utenti
anna@demo.test (gestore Rossi, membro Bianchi-Verdi) e luca@demo.test (membro Rossi); lista della
spesa «Spesa sabato» con voci «latte», «pane», «uova».

## Porte
- Doppio senso previste: interfaccia `LocalStore`, schema SQLite locale (non è su `main` del server,
  si ricrea), intervallo di sync 60 s.
- Senso unico: **DOMANDA** qui sopra (dipendenza npm per SQLite).

## Rischi di concorrenza
Doppio invio della coda (avvio + ritorno rete insieme): un solo ciclo di sync alla volta; caduta
della rete dopo che il server ha applicato ma prima della risposta: il reinvio con lo stesso
`mutation_id` non duplica. Pulizia di famiglia persa durante un ciclo: la coda di quella famiglia
si svuota senza invio.

## Budget
Righe di produzione in `app/src` ≤ 600; file ≤ 10; una sessione.

## Domande per il ricercatore (al massimo 3)
Nessuna (`ricerca: no`).

## Critica ricevuta e cosa cambia
(dopo il critico)
