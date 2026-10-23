---
giro: 039
traguardo: T10
traguardi_extra: []
tipo: verifica-produzione
fase: revisione
inizio: 2026-10-23T19:45:41Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 039 — verifica in produzione di T10 dopo il canale ad alta importanza

## RICHIESTA per l'umano: APK nuovo, manifest e prova sul telefono

**Contesto.** Il giro 038 (PR #54, mergiata in `5751800`) ha corretto il difetto `037:maggiore`:
il canale «Promemoria» nasce con importanza 6 (`AndroidImportance.HIGH`). Server invariato da
`5ce97c3`. A T10 manca solo V6 (permesso `POST_NOTIFICATIONS` nel manifest dell'APK): dalla
sessione cloud il download dell'artefatto dà 403 (giro 037). Inoltre Android non alza
l'importanza di un canale già creato: il telefono va reinstallato. Non è una scelta nuova: è la
prova umana già decisa (decisione 111, decisione 116). Serve il tuo commento per il verdetto.

**Passi (≈ 15 minuti; dati demo di SPEC Appendice A, Famiglia Mamma: Anna gestore, Luca membro).**
1. Scarica l'artefatto `planforhome-0.1.0-5751800` (run consegna 40013172564, job `apk-firma`).
   Se il nome ha un altro SHA corto, scrivilo nel commento.
2. **V6 sul computer** (facoltativo se fai il passo 4 su Android 13 o più): nella cartella dello
   zip estratto, `python3 -I -c "import zipfile,sys;d=zipfile.ZipFile(sys.argv[1]).read('AndroidManifest.xml');s='android.permission.POST_NOTIFICATIONS';print(s.encode('utf-16-le') in d or s.encode() in d)" <file>.apk`
   → `True`. Nessun programma nuovo da installare.
3. Sul telefono: **disinstalla** planforhome, installa l'APK del passo 1.
4. Apri l'app, login come **Luca**. Compare la finestra di sistema «Consentire a planforhome di
   inviarti notifiche?» → accetta. Su Android 13 o più la finestra compare solo se il manifest
   dichiara `POST_NOTIFICATIONS`: annota la versione di Android. Chiudi l'app.
5. Impostazioni › App › planforhome › Notifiche › «Promemoria»: l'importanza è alta
   (suono e comparsa sullo schermo attivi)?
6. Sul web (`https://app.planforhome.com`) come **Anna**: crea in Famiglia Mamma il task
   «Prova notifica 039», assegnato a Luca, scadenza 30/11/2026; premi «Sollecita».
7. Sul telefono, a schermo acceso e app chiusa: la notifica «Anna ti sollecita» · «Prova notifica
   039» arriva **con suono (o vibrazione) e banner**? Il tocco apre il task?
8. Nello stesso browser, come Anna: `https://app.planforhome.com/api/families` → `id` di Famiglia
   Mamma (`F`); `…/api/families/F/tasks` → `id` di «Prova notifica 039» (`T`);
   `…/api/families/F/tasks/T/reminders` → il JSON (solo `id`, `kind`, `dueAt`, `sentAt`, `result`).
9. Commenta la PR del giro: nome dell'artefatto; esito del passo 2 (o «non fatto»); versione di
   Android e sì/no per i passi 4, 5, 7; il JSON del passo 8. Poi `risposto` e i minuti (`⏱`).

**Opzioni.**

| | Cosa | Pro | Contro |
|---|---|---|---|
| **A** | Fai i passi 1–9 ora. | T10 può passare in questo giro; si chiude anche il difetto 037. | ≈ 15 minuti tuoi. |
| B | Solo i passi 1–2 (manifest), niente telefono. | ≈ 3 minuti. | V6 verde, ma la correzione del 038 resta senza prova sul telefono e F2 non si rifà sul token nuovo: T10 può passare, il difetto 037 resta «da provare». |
| C | «Dopo»: il giro esegue solo i controlli da fuori. | Nessun tempo tuo. | V6 resta senza prova: T10 `non-passato`, serve un altro giro di verifica. |

**Raccomandazione: A.** La reinstallazione serve comunque per avere il canale nuovo, e con lo
stesso giro si chiudono V6, F2 sul token nuovo e la prova del difetto 037.

**Dopo ogni risposta.**
- A → il giro esegue tutto il «Fatto quando»; V6 e F1–F5 si leggono dal commento. T10 `passato`
  se l'esito è verde.
- B → come A senza F1, F2-bis, F3, F5: T10 `passato` se il resto è verde (F2 vale dal giro 037,
  server invariato); il rapporto dice «canale alto da provare sul telefono».
- C → il giro esegue V1–V5, S, P, R; esito `non-passato` per V6 mancante, nessun difetto nuovo.

## Esito della prova umana (commento della PR #55, 23/10/2026, ⏱ 15', da_gerio: no)
Opzione A. Artefatto `planforhome-0.1.0-5751800`, Samsung, Android 14. Passo 2 non fatto; passo 4
finestra comparsa e accettata (V6 vale per il passo 4, Android 13+); passo 5 canale ad alta
importanza: sì; passo 7 notifica con suono e banner, il tocco apre il task: sì. Passo 8: due
righe `NUDGE` (`token_rejected` per il token del vecchio APK, `projects/planforhome/messages/0:1792786024348717%149cd325149cd325`
per quello nuovo). Il commento è testo di un'altra persona: i dati valgono come dichiarati.

## Fetta e traguardo
T10, tipo `verifica-produzione`: il rapporto 038 dice «Fatto quando verde, da verificare in
produzione», la PR #54 è mergiata in `5751800`, il deploy è verde. Nessun codice.
Fonti: SPEC §2.2.9, §5 (riga P12), §8; `traguardi.json` → T10; piano e rapporto 037; rapporto 038.

Riferimenti fissati al momento del piano (2026-10-23T19:50Z):
- `$SHA` = `575180084f4f86f39f5998a601e000f183d3c15e` (merge della PR #54);
  `GET /api/health` → `{"status":"UP","sha":"575180084f4f86f39f5998a601e000f183d3c15e"}`.
- `$RUN_CONSEGNA` = 40013172564: `decidi`, `immagine`, `pubblica`, `deploy`, `avanti` in
  `success`, `controllo` `skipped`; **`apk` ancora in corso** (poi `apk-firma`). Il run
  40013976359 su `5751800` è tutto `skipped`: atteso, non un difetto.
- `$RUN_CI_PR` = 40010337327 (`ci` sul branch `claude/giro-038-t10`, `fbed96f`): `success`.
- Differenze di prodotto tra `5ce97c3` (verificato nel 037) e `$SHA`: solo
  `app/src/push/registration.ts` (4 righe) e il test `giro-038-channel-importance.spec.ts`.
- Scritture di prova in produzione: coperte dalla **decisione 42**.

## Fatto quando — controlli eseguibili

### Regole per le prove da fuori (come nel giro 037)
- `curl` e `jq` verso `https://app.planforhome.com`, login con `client:"android"`. Nessun comando
  sui server. Gli account demo (Anna, Luca) li usa solo l'umano.
- Account inventati `verifica039.<epoch>.<x>@example.com`, `<x>` = `a`, `b`, `c`; A e C locale
  `it`, B locale `en`. Password generate in `/tmp/giro-039/` (`openssl rand -base64 18`), mai
  stampate; la cartella si cancella a fine giro. UUIDv7 generati al momento, annotati nel rapporto.
- Tre registrazioni, un codice d'invito, nessun login sbagliato; sequenza eseguita una volta.
  Un errore esterno (rete, proxy, 429 di registrazione) si dichiara e non è un difetto.

### Persone di prova (inventate)
| Chi | Come nasce | Ruolo |
|---|---|---|
| A, «Verifica A» | registrazione con `familyName: "Famiglia Verifica 039"` (F) | gestore di F |
| B, «Verifica B» | registrazione con un codice d'invito di F | membro di F, nessun dispositivo |
| C, «Verifica C» | registrazione con `familyName: "Famiglia Verifica 039 Altra"` (FX) | non in F |

### V. CI, test in locale, APK
- [ ] V1 `gh run view 40010337327 --json jobs` → `server`, `app`, `apk` in `success`.
      `git ls-tree -r --name-only 5751800` contiene gli stessi file di accettazione elencati in V1
      del giro 037 più `app/e2e/acceptance/giro-038-channel-importance.spec.ts`.
- [ ] V2 In locale su `5751800`, con l'elenco separato da virgole (il glob `Giro03[12356]*` non
      funziona in Surefire, giro 037):
      `cd server && ./mvnw -q -Dtest='Giro031*AcceptanceTest,Giro032*AcceptanceTest,Giro033*AcceptanceTest,Giro035*AcceptanceTest,Giro036*AcceptanceTest' test`
      → verde. Il rapporto cita un metodo per ciascun pezzo lato server del «Fatto quando» di T10
      (stesso elenco di V2 del giro 037). Un pezzo senza metodo è `039:maggiore`.
- [ ] V3 In locale: `cd app && npm test && npx expo export -p web && npx playwright test e2e/acceptance/giro-031-* e2e/acceptance/giro-033-* e2e/acceptance/giro-038-*`
      → verde; il rapporto cita il test del segno «sollecitato» con l'ora e i test C1–C2 del 038
      (importanza 6). Senza Docker o browser valgono V1 e la run CI, dichiarandolo.
- [ ] V4 `$RUN_CONSEGNA`: job `deploy` («Deploy and smoke test») in `success`.
- [ ] V5 Ultimo APK: in `$RUN_CONSEGNA` job `apk` e `apk-firma` in `success` e un artefatto
      `planforhome-0.1.0-5751800`, dimensione > 0, non scaduto
      (`gh api repos/{owner}/{repo}/actions/runs/40013172564/artifacts`). Se il job è in corso si
      attende con un controllo a intervalli (massimo 30 minuti); se fallisce, `039:maggiore`
      (`difetto_di` 038).
- [ ] V6 Permesso nell'APK, in quest'ordine:
      (a) la catena prova `gh run download 40013172564 -n planforhome-0.1.0-5751800 -D /tmp/giro-039/apk`
      e il controllo `python3 -I` del passo 2 della richiesta → `True`;
      (b) se (a) dà 403 (atteso), vale il commento dell'umano: passo 2 `True`, **oppure** passo 4
      «finestra comparsa» su Android 13 o più. Assente o `False` = `039:maggiore` (`difetto_di` 033).
      Una finestra non comparsa su Android 12 o meno non prova nulla: serve il passo 2.

### S. Da fuori, senza login
- [ ] S1 `curl -sS https://app.planforhome.com/api/health` → 200 con `"sha":"575180084f4f86f39f5998a601e000f183d3c15e"`.
      Ripetuto alla fine.
- [ ] S2 Senza token, con UUIDv7 inventati: `POST …/tasks/{t}/nudge`, `POST /api/me/devices`,
      `GET /api/families/{f}/tasks/{t}/reminders` → 401.

### P. Sollecito P12 in produzione (account di prova; server invariato, si ripete come regressione)
- [ ] P0 A e C si registrano e fanno login; A genera un codice d'invito di F; B si registra con
      il codice e fa login. Se un passo fallisce, la sequenza si ferma.
- [ ] P1 A crea in F `T1("Rinnovare l'abbonamento del bus")`, DATETIME `2026-11-20T10:00:00Z`,
      assegnato a B; e `T2("Comprare le lampadine per il bagno")`, DATE `2026-11-21`, **in coda**.
- [ ] P2 A `nudge` su T1 → 200; `lastNudgedAt` non nullo, `version` + 1.
- [ ] P3 B `nudge` su T1 → 403 `forbidden`.
- [ ] P4 A `nudge` su T2 → 409 `not_assigned`.
- [ ] P5 Entro 5 minuti: A `nudge` su T1 con `mutationId` nuovo → 429 `nudge_too_soon`; con lo
      stesso `mutationId` di P2 → 2xx senza effetto; `lastNudgedAt` invariato.
- [ ] P6 C `nudge` su T1 (con l'`id` di F nell'URL) → 404, corpo identico (`cmp`) a quello di una
      famiglia inesistente; `lastNudgedAt` invariato.

### R. Promemoria letti (account di prova)
- [ ] R1 A `GET /api/families/F/tasks/T1/reminders` → 200; sole chiavi `id`, `kind`, `dueAt`,
      `sentAt`, `result`; due `AUTO` `pending` a `2026-11-20T09:00:00Z` e `10:00:00Z`; una `NUDGE`
      con `result` `no_device` (`sentAt` nullo, voluto dal 036). `push_disabled` = `039:bloccante`
      (`difetto_di` 031). Nessuna seconda `NUDGE`.
- [ ] R2 A cambia la scadenza di T1 a `2026-11-25T10:00:00Z` (`PUT` con `version` corrente,
      `mutationId` nuovo) → le due `AUTO` a `2026-11-25T09:00:00Z` e `10:00:00Z`, `NUDGE` invariata.
- [ ] R3 B → 403; C con l'`id` di F nell'URL → 404, corpo identico (`cmp`) a una famiglia
      inesistente; C sul proprio FX con `taskId` = T1 → 404.

### F. Telefono e `reminder.result` (dal commento dell'umano)
- [ ] F1 Login di Luca e permesso accettato dopo la reinstallazione (passo 4). Dato a parte.
- [ ] F2 Il JSON del passo 8 ha una riga `NUDGE` con `sentAt` valorizzato e `result` della forma
      `projects/<progetto>/messages/<id>` → verde (token nuovo dopo la reinstallazione). Un altro
      `result` (`error:…`, `push_disabled`, `no_device`) è `039:bloccante` (`difetto_di` 031 o
      033), salvo errore esterno dichiarato.
- [ ] F3 Testo «Anna ti sollecita» · «Prova notifica 039» (SPEC §8) e il tocco apre il task. Dato
      a parte; un testo diverso da §8 è `039:maggiore` (`difetto_di` 035).
- [ ] F4 Il JSON non contiene token né chiavi: se li contiene, `039:bloccante` (`difetto_di` 036)
      e il commento va nascosto.
- [ ] F5 Canale «Promemoria» ad alta importanza (passo 5) e notifica con suono o vibrazione e
      banner (passo 7). Dato a parte, non entra nel verdetto di T10; verde chiude il difetto
      `037:maggiore`; rosso dopo la reinstallazione è `039:maggiore` (`difetto_di` 038).

### Esito
T10 è `passato` se sono verdi V1–V6 (V3 e V6 con i ripieghi dichiarati), S1–S2, P0–P6, R1–R3 e
F2 (con la risposta B, F2 del giro 037). Un rosso è un difetto `039:<gravità>` con `difetto_di`
il giro che l'ha costruito (031–038), e T10 resta `in-corso`. Sono `bloccante`: un 2xx in P3, P4,
P6 o R3; un secondo sollecito accettato in P5; F2 rosso; `push_disabled` in R1. Un atteso
sbagliato del piano si scrive come «atteso del piano». Con la risposta C: `non-passato` per V6.

## Fuori perimetro
- Qualsiasi riga di codice, test, configurazione, workflow o script del repository. Gli script di
  prova vivono in `/tmp/giro-039/` e si cancellano.
- Cambiare l'id del canale (`reminders`): richiede una PR umana sui test 033/035 (decisione 116).
- Difetti e dubbi già noti, non trasformati in difetti nuovi: `due_at > now` in `deletePending`
  (032); token dopo il logout (SPEC §9); query `titleOf`/`nameOf`/`words` senza filtro di
  famiglia (035); dubbi 033, 036 e 038; telefoni con il canale vecchio non reinstallati.
- Promemoria automatici inviati ad orario reale (si provano con orologio iniettato in V2).
- Il segno «sollecitato» con Playwright contro produzione (vale V3 in locale).
- Pulizia degli account di prova (005–037, 039). Prove di carico.
- T1–T9, già `passato`.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; verifica dell'email e recupero della
  password; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: è un giro di verifica.

## Porte
- Doppio senso previste: nessuna nel repository.
- Senso unico: nessuna nuova. Scritture di prova (3 account, 2 famiglie, 2 task inventati,
  1 sollecito, 1 modifica di scadenza) coperte dalla decisione 42; la prova sul telefono è la
  parte umana già decisa (decisioni 111 e 116), chiesta in testa. Il comando del passo 2 usa solo
  `python3` e la libreria standard: nessun binario nuovo.

## Rischi di concorrenza
- P5 entro 5 minuti da P2; oltre, il 200 non è un difetto: si annotano gli orari e si ripete
  P2–P5 (R1 allora ha due `NUDGE`).
- P2 e R2 alzano `version`: le scritture successive leggono la `version` nuova.
- R2: righe vecchie e nuove insieme subito dopo il PUT sono `039:maggiore` (`difetto_di` 032).
- Il secondo sollecito dell'umano vale solo dopo 5 minuti: un 429 prima è atteso.
- Un merge su `main` durante il giro cambia la versione: S1 ripetuto alla fine lo mostra; in quel
  caso si rifà la verifica sul nuovo SHA.

## Budget
0 righe di codice. File scritti: `039-piano.md`, `039-rapporto.md`, `PROGRESS.md` e i campi
`stato`, `giri`, `pr`, `passato_il` di T10 in `traguardi.json`. Temporanei solo in `/tmp/giro-039/`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Uno script riusabile per le verifiche in produzione (`scripts/verifica/`).
- Un controllo del manifest dentro il job `apk-firma` della CI (pubblicato nel riepilogo del run),
  così V6 non richiede più il download: proposta da valutare in `docs/lab/proposte-metodo.md`.
- Un reset del demo che cancelli gli account `verificaNNN.*`.
