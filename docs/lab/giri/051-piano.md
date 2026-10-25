---
giro: 051
traguardo: T14
traguardi_extra: []
tipo: verifica-produzione
fase: revisione
inizio: 2026-10-25T22:44:36Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 051 — verifica in produzione di T14 (UI-3: form e sheet)

## Fetta e traguardo
T14, tipo `verifica-produzione`: il rapporto 050 dice «Fatto quando verde, da verificare in
produzione», le PR #73 (`4a000e1`) e #74 (`9c6e826`) sono mergiate, il deploy è verde. Nessun codice.
Fonti: SPEC §2.2.6, §12; DESIGN §5, §6.3, §6.4; `traguardi.json` → T14; piani e rapporti 049 e
050; `docs/lab/ux/2026-10-23-osservazioni-umano.md` (osservazioni 1–5).

Riferimenti fissati al momento del piano (2026-10-25T22:45Z):
- `$SHA` = `9c6e826b7e0643eb3bed8e58468c5535337535d8` (merge della PR #74);
  `GET /api/health` → `{"status":"UP","sha":"9c6e826b7e0643eb3bed8e58468c5535337535d8"}`.
- `$RUN_CONSEGNA` = 40241289934: `controllo`, `immagine`, `pubblica`, `deploy`, `avanti` in
  `success`, `decidi` `skipped`; **`apk` ancora in corso**. Il run 40241655283 su `9c6e826` è
  `skipped`: atteso, non un difetto.
- `$RUN_CI_049` = 40225726160 (`ci` su `claude/giro-049-t14`, `48a30a0`): `success`.
  `$RUN_CI_050` = 40237562473 (`ci` su `claude/giro-050-t14`, `cedfaec`): `success`.
- I giri 049 e 050 non toccano il server: la verifica è sull'app web servita in produzione,
  sull'APK e sui test in locale. Il server serve a preparare i dati e a controllare lo stato finale.
- La galleria (`/gallery?set=form`) in produzione è spenta per scelta (`isGalleryEnabled`): i
  controlli del kit (K2 del 049, G1 del 050) valgono in locale (V3), non in produzione.
- Alle 22:45Z in `Europe/Rome` sono le 23:45: le scadenze di prova sono **date fisse future**
  (6–8 novembre 2026), così il passaggio di mezzanotte non cambia gli attesi.

## Fatto quando — controlli eseguibili

### Regole per le prove da fuori (come nei giri 045 e 048)
- `curl`, `jq` e Playwright verso `https://app.planforhome.com`; nessun comando sui server. Gli
  account demo di SPEC Appendice A li usa solo l'umano.
- Scritture di prova coperte dalla **decisione 42**. Account inventati
  `verifica051.<epoch>.<x>@example.com`, `<x>` = `a`, `c`; locale `it`. Password generate in
  `/tmp/giro-051/` (`openssl rand -base64 18`), mai stampate. UUIDv7 generati al momento, annotati
  nel rapporto. Due registrazioni, nessun login sbagliato; sequenza eseguita una volta.
- Gli script Playwright di prova vivono in `/tmp/giro-051/` (config con `baseURL` di produzione,
  Chromium locale se il download dal proxy dà 403) e si cancellano a fine giro; non entrano nel
  repository. Le richieste si contano con `page.on('request')`.
- Un errore esterno (rete, proxy, 429 di registrazione) si dichiara e non è un difetto.

### Dati di prova (inventati)
| Chi / cosa | Come nasce | Note |
|---|---|---|
| A, «Verifica A» | registrazione con `familyName: "Famiglia Verifica 051"` (F) | gestore di F |
| F2 «Famiglia Verifica 051 Due» | A, `POST /api/families` | A gestore; famiglia di arrivo degli inoltri |
| «Leo Verifica» | A, `POST /api/families/F/resources` | risorsa senza account, solo in F |
| C, «Verifica C» | registrazione con `familyName: "Famiglia Verifica 051 Altra"` (FX) | non in F né in F2 |

| Task | Famiglia | Come nasce | Stato, assegnatario | Scadenza | Serve a |
|---|---|---|---|---|---|
| T1 «Comprare il regalo per la nonna» | F | API | aperto, A | DATE 2026-11-06 | I1 |
| T2 «Ritirare il cappotto in tintoria» | F | API | aperto, in coda | nessuna | I2 |
| T3 «Ritirare le foto» | F | API | aperto, Leo Verifica | DATE 2026-11-07 | I3 |
| T4 «Comprare il pane» | F | **UI**, N2 | aperto, in coda (come il form crea) | nessuna | N2, C1 |
| T5 «Portare l'auto in revisione» | F | **UI**, N5–N6 | aperto, criticità alta | DATETIME 2026-11-07 18:30 Europe/Rome | N5, N6 |
| T6 «Spesa del sabato» | F | **UI**, N7 | aperto, lista della spesa | nessuna | N7 |
| T7 «Annaffiare l'orto» | F | **UI**, N8b | ogni settimana | DATE 2026-11-08 | I5, C2, C3 |
| TX «Task segreto di C» | FX | API, come C | aperto, C | DATE 2026-11-06 | isolamento |

### V. CI, test in locale, APK
- [ ] V1 `gh api repos/{owner}/{repo}/actions/runs/40225726160/jobs` e `…/40237562473/jobs` →
      `server`, `app`, `apk` in `success`. `git ls-tree -r --name-only 9c6e826` contiene
      `app/src/ui/{TextField,CheckRow,RadioRow,Sheet,DateField,ConfirmDialog}.tsx`,
      `app/src/ui/DateField.web.tsx`, `app/src/task/{NewTaskForm,ForwardDialog}.tsx`,
      `app/e2e/acceptance/giro-049-{form-kit,new-task-sheet}.spec.ts`,
      `app/e2e/acceptance/giro-050-{confirm,confirm-kit}.spec.ts`.
- [ ] V2 In locale su `9c6e826`: `cd app && npm ci && TZ=Europe/Rome npm test && npx tsc --noEmit && npx eslint .`
      → verde (K1, K3 del 049; K1, K2 del 050). `grep -nE "#[0-9a-fA-F]{3,8}|StyleSheet" app/src/task/NewTaskForm.tsx app/src/task/ForwardDialog.tsx`
      → nessuna riga. Prova di mutazione a mano (poi annullata con `git checkout -- app/`):
      nel `ForwardDialog` togliere la conseguenza dalla descrizione accessibile di «Conferma
      inoltro» → `npm test -- ForwardDialog` rosso. Se resta verde, `051:maggiore` (`difetto_di` 050).
- [ ] V3 In locale: `cd app && npx expo export -p web && npx playwright test e2e/acceptance/giro-049-* e2e/acceptance/giro-050-*`
      → verde (K2, N1–N14 del 049; G1, I1–I6, C1–C4, E1, S1, S2 del 050, compresi I4 e C4 che
      in produzione non si provocano). Senza browser valgono V1 e le run CI, dichiarandolo.
- [ ] V4 `$RUN_CONSEGNA`: job `deploy` («Deploy and smoke test») in `success`.
- [ ] V5 Ultimo APK: in `$RUN_CONSEGNA` job `apk` (e `apk-firma`, se c'è) in `success` e un
      artefatto `planforhome-0.1.0-9c6e826`, dimensione > 0, non scaduto
      (`gh api repos/{owner}/{repo}/actions/runs/40241289934/artifacts`). Il job era in corso alle
      22:45Z: si attende con un controllo a intervalli (massimo 30 minuti); se fallisce,
      `051:maggiore` (`difetto_di` 050); se è ancora in corso dopo 30 minuti, il giro si dichiara
      in attesa, non `passato`.

### S. Da fuori, senza login
- [ ] S1 `curl -sS https://app.planforhome.com/api/health` → 200 con
      `"sha":"9c6e826b7e0643eb3bed8e58468c5535337535d8"`. Ripetuto alla fine.
- [ ] S2 `curl -sS https://app.planforhome.com/gallery` → il corpo non contiene «Pannello di
      prova», «Apri la conferma», «Togliere la gita dal calendario?» (la galleria resta spenta).

### P. Preparazione (API, account di prova)
- [ ] P0 A e C si registrano e fanno login; A crea F2 e la risorsa «Leo Verifica» in F. Se un
      passo fallisce, la sequenza si ferma e il giro si dichiara bloccato (errore esterno ≠ difetto).
- [ ] P1 A crea T1–T3 in F via API (T3 assegnato a «Leo Verifica»); C crea TX in FX; ogni
      `POST` → 2xx.

### N. Nuovo task in produzione (login come A, it-IT, `/family?id=<F>`, viewport 390×844 e 1280×800)
- [ ] N1 Bottone «Nuovo task» → `dialog` «Nuovo task» con `aria-modal="true"` e il campo
      «Titolo» col fuoco (`toBeFocused`).
- [ ] N2 **≤ 3 interazioni** (SPEC §12): clic su «Nuovo task», `keyboard.type('Comprare il pane')`,
      clic su «Aggiungi task» → esattamente 1 `POST /api/families/<F>/tasks` con titolo «Comprare
      il pane»; dialogo chiuso; T4 nella lista; fuoco su «Nuovo task». Lo script conta 3
      interazioni.
- [ ] N3 Osservazione 1: nel dialogo sono visibili «Titolo», «Scadenza», «Ora (hh:mm,
      facoltativa)», «Criticità», «Si ripete», «Lista della spesa»; ogni campo si trova con
      `getByLabel`/`getByRole(…, { name })` con lo stesso testo; nessun `placeholder` uguale
      all'etichetta o senza etichetta.
- [ ] N4 Osservazione 2: a titolo vuoto e a «   » «Aggiungi task» è `toBeDisabled()`, con il
      motivo «Scrivi il titolo per aggiungere il task.» visibile e come descrizione accessibile;
      un clic forzato non fa `POST`. Scritto un titolo → abilitato, il motivo sparisce.
- [ ] N5 Osservazione 3: `radiogroup` «Criticità» con «Bassa», «Normale», «Alta», «Normale»
      scelto all'apertura; «Portare l'auto in revisione» con «Alta» → `POST` con
      `criticality: 'HIGH'`; la card di T5 mostra «Alta».
- [ ] N6 Osservazione 4: «Scadenza» mostra «Nessuna scadenza» all'apertura; il campo data è un
      selettore (`input[type=date]` sul web, trovato per etichetta); per T5 `fill('2026-11-07')`
      e «Ora» «18:30» → `POST` con `dueKind: 'DATETIME'`, `due: '2026-11-07T17:30:00.000Z'`
      (dopo l'ora legale Roma è UTC+1); «Togli la scadenza» riporta a «Nessuna scadenza»
      (provato prima di scegliere la data).
- [ ] N7 Osservazione 5: un solo `checkbox` «Lista della spesa», alto ≥ 48 px,
      `aria-checked=false` → clic → `true`; «Spesa del sabato» → `POST` con
      `template: 'SHOPPING_LIST'`; la card mostra il link «Apri la lista «Spesa del sabato»».
- [ ] N8 Chiusura ed errore: Esc → dialogo chiuso, nessun `POST`, fuoco su «Nuovo task»;
      riaperto, il form è vuoto. (a) «Annaffiare l'orto» con «Ogni settimana» e senza scadenza →
      `alert` «Un task ciclico ha bisogno di una scadenza.» dentro il dialogo, aperto, nessun
      `POST`; (b) con scadenza 2026-11-08 → 1 `POST`, nasce T7.
- [ ] N9 `en-US` (contesto nuovo, stessa sessione): «New task», «Title», «Due date»,
      «Criticality», «Low/Normal/High», «Add task», «Write the title to add the task.»; nessun
      testo con `task.` a vista. Nessun task creato.
- [ ] N10 A 390 px e a 1280 px, dialogo aperto: `document.documentElement.scrollWidth` ≤ viewport,
      «Aggiungi task» raggiungibile scorrendo; target dei controlli ≥ 48 px. Screenshot solo per il
      rapporto, in `/tmp/giro-051/`.

### I. Inoltro con la conseguenza scritta (SPEC §2.2.6; login come A, `/family?id=<F>`)
- [ ] I1 «Inoltra «Comprare il regalo per la nonna»» → `dialog` «Inoltra il task»; «Conferma
      inoltro» disattivato con descrizione «Scegli la famiglia di arrivo.»; tra le scelte F2, mai
      FX; scelta F2 → «Il task passa in Famiglia Verifica 051 Due e resta assegnato a Verifica A.»
      visibile ed è la descrizione accessibile di «Conferma inoltro»; nessun `POST …/forward`
      prima della conferma. Conferma → 1 `POST …/forward`; `GET /api/families/<F2>/tasks` come A
      → T1 in F2, assegnato ad A.
- [ ] I2 T2 «Ritirare il cappotto in tintoria» → «Il task passa in Famiglia Verifica 051 Due e
      resta in coda.»; conferma → 1 `POST`, avviso «Inoltrato in Famiglia Verifica 051 Due»; T2 in
      F2, in coda.
- [ ] I3 T3 «Ritirare le foto» → `alert` «Avviso inoltro» con «Leo Verifica non fa parte di
      Famiglia Verifica 051 Due: il task andrà in coda.», uguale alla descrizione di «Conferma
      inoltro». Conferma → T3 in F2, in coda.
- [ ] I5 T7 «Annaffiare l'orto» → la conseguenza contiene «La ricorrenza resta uguale.».
      **Non** si conferma: «Annulla», «Chiudi» ed Esc (uno per apertura) → nessun `POST`,
      dialogo chiuso, fuoco su «Inoltra «Annaffiare l'orto»». (= I6 del 050)

### C. Conferme di annullamento (login come A, `/family?id=<F>`)
- [ ] C1 «Annulla task» su T4 «Comprare il pane» → `dialog` «Annullare «Comprare il pane»?» con
      `aria-modal`, «Il task passa tra i Chiusi come annullato e nessuno lo vedrà più da fare.»
      come descrizione accessibile di «Conferma annullamento», fuoco su «Non annullare»; nella
      riga nessun bottone di conferma. «Non annullare» → nessuna richiesta, fuoco su «Annulla task».
      Di nuovo → «Conferma annullamento» → 1 `POST …/cancel`; T4 annullato (`GET` come A).
- [ ] C2 «Annulla questa volta» su T7 → dialogo «Annullare questa volta?» con «Si annulla solo
      questa occorrenza di «Annaffiare l'orto»; le prossime restano.»; Esc → nessuna richiesta.
- [ ] C3 «Termina la serie» su T7 → dialogo «Terminare la serie «Annaffiare l'orto»?» con «Si
      annulla questa occorrenza e non ne arriveranno altre.»; «Non terminare» → nessuna
      richiesta, fuoco su «Termina la serie»; «Conferma: termina la serie» → 1 richiesta
      `…/end-series`; T7 annullato e senza occorrenza successiva (`GET` come A).

### X. Isolamento, regressione
- [ ] X1 C `GET /api/tasks` → nessun task di F o F2; C `GET /api/families/<F>/tasks` → 403 o
      404; A `/family?id=<FX>` → famiglia non trovata, nessun «Task segreto di C»; nel dialogo
      d'inoltro di A, FX non compare (I1).

### F. Sul telefono
- [ ] F1 APK su Android (griglia del `DateField`, tasto Indietro dello `Sheet` e del
      `ConfirmDialog`, `accessibilityHint` con TalkBack, fontScale 2.0) non si prova dalla
      catena (nessun dispositivo né emulatore): si dichiara e resta «Per l'umano» in
      `PROGRESS.md`, come nei giri 045 e 048. Non blocca il `passato`.

### Esito
T14 è `passato` se sono verdi V1–V5 (V3 con il ripiego dichiarato), S1–S2, P0–P1, N1–N10,
I1–I3, I5, C1–C3, X1, con F1 dichiarata. Un rosso è un difetto `051:<gravità>` con `difetto_di`
049 (form, kit del form, Sheet) o 050 (ConfirmDialog, inoltro, conferme), e T14 resta
`in-corso`. Un atteso sbagliato del piano si scrive come «atteso del piano», non come difetto, e
si riesegue il controllo corretto.

## Fuori perimetro
- Qualsiasi riga di codice, test, configurazione, workflow o script del repository.
- I dubbi già noti dei revisori 049 e 050 (test Jest del fuoco iniziale su annulla; fuoco dopo
  un annullamento riuscito; ruolo `dialog` invece di `alertdialog`; `role="textbox"` su
  `<input type="date">`; guardia sincrona di `TasksSection`): non diventano difetti nuovi.
- I4 (membri non leggibili, 500) e C4 (abort di rete dentro la conferma), N13–N14 del 049: non si
  provocano in produzione; valgono V3.
- Galleria in produzione (spenta per scelta): K2 del 049 e G1 del 050 valgono in V3.
- Lingua del web secondo account o browser (osservazione 6): UI-4. Resto di `family.tsx`,
  `families.tsx`, `me.tsx`: T15. Tema scuro: T16.
- Pulizia degli account di prova dei giri precedenti e di questo. Prove di carico.
- T1–T13, già `passato`; T15–T19.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; «home nonni» a griglia;
  set di icone come dipendenza; accesso con Google o Apple, iPhone, Play Store; verifica
  dell'email e recupero della password; sincronizzazione in tempo reale e offline sul web; dati
  reali (R1).

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: è un giro di verifica.

## Porte
- Doppio senso previste: nessuna nel repository.
- Senso unico: nessuna nuova. Scritture di prova in produzione (2 account, 3 famiglie, 1 risorsa,
  8 task inventati, 3 inoltri, 1 annullamento, 1 fine serie) coperte dalla decisione 42.

## Rischi di concorrenza
- Ogni azione con un solo clic; si conta una sola richiesta e si controlla lo stato finale con
  un `GET`, così un doppio invio o una conferma persa si vedono.
- Un merge su `main` durante il giro cambia la versione: S1 ripetuto alla fine lo mostra; in quel
  caso si rifà la verifica sul nuovo SHA.
- Mezzanotte di Roma alle 23:00Z: le scadenze sono date fisse future, gli attesi non cambiano.

## Budget
0 righe di codice. File scritti: `051-piano.md`, `051-rapporto.md`, `PROGRESS.md` e i campi
`stato`, `giri`, `pr`, `passato_il` di T14 in `traguardi.json`. Temporanei solo in `/tmp/giro-051/`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Un emulatore Android nella CI per griglia data, tasto Indietro e TalkBack (porta: immagine o
  action nuova).
- Uno script riusabile per le verifiche in produzione (`scripts/verifica/`), già proposto nel 039.
