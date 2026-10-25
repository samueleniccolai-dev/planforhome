---
giro: 048
traguardo: T13
traguardi_extra: []
tipo: verifica-produzione
fase: revisione
inizio: 2026-10-25T17:18:38Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 048 — verifica in produzione di T13 (UI-2: lista dei task)

## Fetta e traguardo
T13, tipo `verifica-produzione`: il rapporto 047 dice «Fatto quando verde, da verificare in
produzione», le PR #70 (`40350b4`) e #71 (`0fc42d8`) sono mergiate, il deploy è verde. Nessun codice.
Fonti: SPEC §2.2.2, §12; DESIGN §4, §6; `traguardi.json` → T13; piani e rapporti 046 e 047.

Riferimenti fissati al momento del piano (2026-10-25T17:25Z):
- `$SHA` = `0fc42d82e67b72d871557cbc00b0086ef91ec547` (merge della PR #71);
  `GET /api/health` → `{"status":"UP","sha":"0fc42d82e67b72d871557cbc00b0086ef91ec547"}`.
- `$RUN_CONSEGNA` = 40215487645: `controllo`, `immagine`, `pubblica`, `deploy`, `avanti` in
  `success`, `decidi` `skipped`; **`apk` ancora in corso**. Il run 40215857332 su `0fc42d8` è
  `skipped`: atteso, non un difetto.
- `$RUN_CI_PR` = 40196438706 (`ci` su `claude/giro-047-t13`, `000d084`): `success`.
- I giri 046 e 047 non toccano il server: la verifica è sull'app web servita in produzione,
  sull'APK e sui test in locale. Il server si usa solo per preparare i dati di prova.
- Oggi, 25/10/2026, in Europa finisce l'ora legale (01:00Z): `Europe/Rome` è ora UTC+1. Le date
  dei task si calcolano nel fuso della famiglia (vedi P1), non in UTC.

## Fatto quando — controlli eseguibili

### Regole per le prove da fuori (come nei giri 037, 039, 045)
- `curl`, `jq` e Playwright verso `https://app.planforhome.com`; nessun comando sui server. Gli
  account demo di SPEC Appendice A li usa solo l'umano.
- Scritture di prova coperte dalla **decisione 42**. Account inventati
  `verifica048.<epoch>.<x>@example.com`, `<x>` = `a`, `c`; locale `it`. Password generate in
  `/tmp/giro-048/` (`openssl rand -base64 18`), mai stampate. UUIDv7 generati al momento, annotati
  nel rapporto. Due registrazioni, nessun login sbagliato; sequenza eseguita una volta.
- Gli script Playwright di prova vivono in `/tmp/giro-048/` (config con `baseURL` di produzione,
  Chromium locale se il download dal proxy dà 403, come nel 045) e si cancellano a fine giro;
  non entrano nel repository.
- Un errore esterno (rete, proxy, 429 di registrazione) si dichiara e non è un difetto.

### Dati di prova (inventati)
| Chi / cosa | Come nasce | Note |
|---|---|---|
| A, «Verifica A» | registrazione con `familyName: "Famiglia Verifica 048"` (F) | gestore di F |
| F2 «Famiglia Verifica 048 Due» | A, `POST /api/families` | A gestore; serve alla vista aggregata e allo stato vuoto |
| «Leo Verifica» | A, `POST /api/families/F/resources` | risorsa senza account in F |
| C, «Verifica C» | registrazione con `familyName: "Famiglia Verifica 048 Altra"` (FX) | non in F né in F2 |

`D` = la data di oggi nel fuso di F, letto da `GET /api/families` al passo P1 (annotato).
Tutti i controlli L si fanno nello stesso giorno di `D` nel fuso di F; se si passa la
mezzanotte della famiglia, si ricalcolano gli attesi (non è un difetto).

| Task | Famiglia | Stato, assegnatario | Scadenza | Criticità | Sezione attesa |
|---|---|---|---|---|---|
| T1 «Innaffiare le piante del balcone» | F | aperto, A | DATE `D-1` | normale | In ritardo |
| T2 «Ritirare il pacco in posta» | F | aperto, A | DATE `D` | normale | Oggi |
| T3 «Pagare la bolletta della luce» | F | aperto, Leo Verifica | DATE `D+2` | normale | Prossimi |
| T4 «Portare il gatto dal veterinario» | F | aperto, **in coda** | DATE `D+5` | alta | Prossimi |
| T5 «Comprare le lampadine» | F | aperto, **in coda** | nessuna | normale | Senza scadenza |
| T6 «Prenotare il pranzo della domenica» | F2 | aperto, A | DATE `D+1` | normale | Prossimi |
| TX «Task segreto di C» | FX | aperto, C | DATE `D` | normale | mai visibile ad A |

### V. CI, test in locale, APK
- [ ] V1 `gh api repos/{owner}/{repo}/actions/runs/40196438706/jobs` → `server`, `app`, `apk`
      in `success`. `git ls-tree -r --name-only 0fc42d8` contiene `app/src/ui/{TaskCard,
      SectionHeader,FilterTabs,EmptyState,PersonBadge,FamilyTag,CriticalityBadge,InlineNotice}.tsx`,
      `app/app/tasks.tsx`, `app/src/task/TasksSection.tsx`, `app/src/task/TaskSectionList.tsx`,
      `app/e2e/acceptance/giro-046-{list-kit,task-list}.spec.ts`,
      `app/e2e/acceptance/giro-047-family-list.spec.ts`.
- [ ] V2 In locale su `0fc42d8`: `cd app && npm ci && npm test && npx tsc --noEmit && npx eslint .`
      → verde. `grep -nE "#[0-9a-fA-F]{3,8}|StyleSheet|from 'react-native'.*(Pressable|Text)" app/src/task/TasksSection.tsx app/app/tasks.tsx app/src/ui/TaskCard.tsx`
      → nessuna riga («senza colori letterali»; un `StyleSheet` del kit in `TaskCard` che usa solo
      token si annota, non è un difetto). Prova di mutazione a mano (poi annullata con
      `git checkout -- app/`): aggiungere `const c = '#ABCDEF';` a `app/src/task/TasksSection.tsx`
      → `npm test -- no-literal-colors` rosso. Se resta verde, `048:maggiore` (`difetto_di` 046).
- [ ] V3 In locale: `cd app && npx expo export -p web && npx playwright test e2e/acceptance/giro-046-* e2e/acceptance/giro-047-*`
      → verde; esistono, con dimensione > 0, gli 8 screenshot
      `app/e2e-screenshots/tasks-list-{390,1280}-fs{1,2}.png` e `family-{390,1280}-fs{1,2}.png`;
      il rapporto li descrive (a fs2/390 nessun testo tagliato, «Prendi» intero). Senza browser
      valgono V1 e la run CI, dichiarandolo.
- [ ] V4 `$RUN_CONSEGNA`: job `deploy` («Deploy and smoke test») in `success`.
- [ ] V5 Ultimo APK: in `$RUN_CONSEGNA` job `apk` (e `apk-firma`, se c'è) in `success` e un
      artefatto `planforhome-0.1.0-0fc42d8`, dimensione > 0, non scaduto
      (`gh api repos/{owner}/{repo}/actions/runs/40215487645/artifacts`). Se il job è in corso si
      attende con un controllo a intervalli (massimo 30 minuti); se fallisce, `048:maggiore`
      (`difetto_di` 047).

### S. Da fuori, senza login
- [ ] S1 `curl -sS https://app.planforhome.com/api/health` → 200 con
      `"sha":"0fc42d82e67b72d871557cbc00b0086ef91ec547"`. Ripetuto alla fine.
- [ ] S2 `https://app.planforhome.com/tasks` senza sessione → dopo l'idratazione si arriva al
      login; nessun `listitem` di task a vista.

### P. Preparazione (API, account di prova)
- [ ] P0 A e C si registrano e fanno login; A crea F2 e la risorsa «Leo Verifica» in F. Se un
      passo fallisce, la sequenza si ferma e il giro si dichiara bloccato (non è un difetto di T13
      se l'errore è esterno).
- [ ] P1 `GET /api/families` come A → F e F2 col loro fuso (annotato) → si calcola `D`.
- [ ] P2 **Prima** di creare i task: controllo E1 (stato vuoto su F2).
- [ ] P3 A crea T1–T5 in F e T6 in F2; C crea TX in FX; ogni `POST` → 2xx.

### E. Stato vuoto
- [ ] E1 Playwright, login come A, `/family?id=<F2>` (390 e 1280, it-IT) → `EmptyState` con
      «Nessun task.» e il bottone «Aggiungi» per ruolo; il clic su «Aggiungi» porta il fuoco sul
      campo del titolo del nuovo task (`document.activeElement` è il campo con l'etichetta del
      titolo). Nessun task creato da questo controllo.

### L. Lista dei task in produzione (login come A, it-IT, viewport 390 e 1280)
- [ ] L1 Vista aggregata `/tasks`: regione «Task di tutte le mie famiglie»; heading 2, in ordine,
      «In ritardo», «Oggi», «Prossimi», «Senza scadenza» (nessun «Chiusi» finché non c'è un task
      chiuso); ogni sezione è una `list` con i `listitem` della tabella, nell'ordine; 6
      `listitem`; nessuna traccia di «Task segreto di C».
- [ ] L2 Card: ogni `listitem` di `/tasks` ha il `FamilyTag` con il nome della sua famiglia (T6:
      «Famiglia Verifica 048 Due»; gli altri: «Famiglia Verifica 048»); T4 mostra il badge «Alta»;
      T3 mostra «Assegnato a Leo Verifica» e il `PersonBadge` con l'iniziale «L»; T1 ha la scadenza
      in colore di pericolo (`rgb(153, 27, 27)`), T2 no.
- [ ] L3 Target: un `checkbox` «Fatto: {titolo}» per ogni task aperto, ognuno ≥ 48×48 px;
      «Prendi» solo su T4 e T5, alto ≥ 48 px, con bounding box che non si sovrappone a quella del
      checkbox della stessa card (distanza ≥ 8 px).
- [ ] L4 `FilterTabs` su `/tasks`: «In coda» → solo T4 e T5; «Assegnati a me» → T1, T2, T6;
      «Tutti» → di nuovo 6 task. Il tab scelto ha `aria-selected="true"` (o `aria-checked`, come
      nel 046).
- [ ] L5 Fatto con undo su `/tasks`: checkbox «Fatto: Ritirare il pacco in posta» → un solo
      `POST …/tasks/{T2}/done` (da `page.on('request')`); la card passa sotto «Chiusi» con
      `aria-checked="true"`; un `InlineNotice` «Fatto: Ritirare il pacco in posta.» con
      «Annulla» → un solo `POST …/reopen`; la card torna sotto «Oggi», non selezionata, l'avviso
      sparisce. Alla fine T2 è aperto (`GET` come A).
- [ ] L6 Vista famiglia `/family?id=<F>`: lista «Task della famiglia» con le stesse sezioni e T1–T5
      nell'ordine della tabella; **nessun** `FamilyTag`; T6 assente. «Prendi» su T4 → un solo
      `POST …/take`, card «Assegnato a Verifica A», avviso con «Annulla» → card di nuovo in coda;
      alla fine T4 è in coda (`GET` come A).
- [ ] L7 In en-US: `/tasks` con heading «Overdue», «Today», «Upcoming», «No due date», regione
      «Tasks of all my families», checkbox «Done: {title}»; nessuna chiave grezza a vista
      (`task.` nel testo della pagina → assente).
- [ ] L8 Screenshot in produzione, solo per il rapporto, in `/tmp/giro-048/`: `/tasks` e
      `/family?id=<F>` a 390×844 e 1280×800; `/family?id=<F>&fs=2` alle stesse due viewport. A
      390 `document.documentElement.scrollWidth <= 390` su tutte; a fs 2 nessun elemento della card
      con `scrollWidth > clientWidth` e «Prendi» visibile per intero. (Su `/tasks` il moltiplicatore
      `fs` non è previsto: fs 2 vale per V3.)
- [ ] L9 Isolamento, regressione: C `GET /api/tasks` → nessun task di F o F2; A
      `/family?id=<FX>` → messaggio di famiglia non trovata, nessun «Task segreto di C».

### F. Sul telefono
- [ ] F1 APK e fontScale di sistema 2.0 su Android non si provano dalla catena (nessun dispositivo
      né emulatore): si dichiarano e restano «Per l'umano» in `PROGRESS.md`, come nei giri 043 e
      045. Non bloccano il `passato`.

### Esito
T13 è `passato` se sono verdi V1–V5 (V3 con il ripiego dichiarato), S1–S2, P0–P3, E1, L1–L9, con
F1 dichiarata. Un rosso è un difetto `048:<gravità>` con `difetto_di` 046 o 047 (il giro che ha
introdotto la parte), e T13 resta `in-corso`. Un atteso sbagliato del piano si scrive come
«atteso del piano», non come difetto, e si riesegue il controllo corretto.

## Fuori perimetro
- Qualsiasi riga di codice, test, configurazione, workflow o script del repository.
- I dubbi del revisore 047 (guardia sincrona `inFlight` senza test; «Prossima: …» anche su
  `/tasks`, DECISIONI n. 141): già noti, non diventano difetti nuovi. Il doppio clic nello stesso
  tick non si prova in produzione.
- Chiavi i18n inutilizzate `task.take`, `task.markDone`; «Riapri» non in coda Android.
- `NewTaskForm`, `ForwardDialog`, `Sheet`, dettaglio del task, «Sollecita» nel dettaglio: T14.
  Resto di `family.tsx`, `families.tsx`, `me.tsx`: T15. Tema scuro: T16.
- Task ricorrenti, inoltro, sollecito, lista della spesa in produzione: provati nei giri loro e
  dai test locali (V3); qui non si creano.
- Pulizia degli account di prova dei giri precedenti e di questo. Prove di carico.
- T1–T12, già `passato`; T14–T19.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; «home nonni» a griglia;
  set di icone come dipendenza; accesso con Google o Apple, iPhone, Play Store; verifica
  dell'email e recupero della password; sincronizzazione in tempo reale e offline sul web; dati
  reali (R1).

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: è un giro di verifica.

## Porte
- Doppio senso previste: nessuna nel repository.
- Senso unico: nessuna nuova. Scritture di prova in produzione (2 account, 3 famiglie, 1 risorsa,
  7 task inventati, un done/reopen e un take/rimetti in coda) coperte dalla decisione 42.

## Rischi di concorrenza
- L5 e L6: un solo clic per azione; si conta una sola richiesta e si controlla lo stato finale
  con un `GET`, così un undo perso si vede.
- Un merge su `main` durante il giro cambia la versione: S1 ripetuto alla fine lo mostra; in quel
  caso si rifà la verifica sul nuovo SHA.
- Mezzanotte del fuso di F durante il giro: le sezioni cambiano; si ricalcolano gli attesi.

## Budget
0 righe di codice. File scritti: `048-piano.md`, `048-rapporto.md`, `PROGRESS.md` e i campi
`stato`, `giri`, `pr`, `passato_il` di T13 in `traguardi.json`. Temporanei solo in `/tmp/giro-048/`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Un emulatore Android nella CI per gli screenshot a fontScale 2.0 (porta: immagine/action nuova).
- Uno script riusabile per le verifiche in produzione (`scripts/verifica/`), già proposto nel 039.
- Il moltiplicatore `fs` anche su `/tasks`, per gli screenshot in produzione come su `/family`.
