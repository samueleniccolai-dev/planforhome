---
giro: 001
traguardo: T1
traguardi_extra: [T2]
tipo: verifica-produzione
fase: revisione
inizio: 2026-10-19T14:46:53Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 001 — verifica in produzione dei binari (T1, T2)

## Fetta e traguardo
Verifica in produzione di T1 e T2: il giro 000 (PR #5) è mergiato e la consegna su `main` è verde
(run 39268221499); il rapporto 000 dice «Fatto quando verde, da verificare in produzione».
Nessun codice. Fonti: SPEC §4, §10, §12, §13; `traguardi.json` → T1, T2.

Nota: `main` è andato avanti dopo #5 (merge di #6, solo documenti). Lo SHA atteso in produzione è
quello dell'ultima run `consegna` con job `deploy` verde su `main` (chiamato qui `$SHA_DEPLOY`), e
deve essere uguale o successivo al merge di #5.

## Fatto quando — controlli eseguibili

Preparazione (sola lettura):
`gh run list --workflow consegna --branch main --limit 10 --json databaseId,headSha,conclusion,event`
→ ricavare `$RUN_CONSEGNA` (ultima run con `deploy` verde) e il suo `$SHA_DEPLOY`.

### T1 — deploy automatico
- [ ] T1.1 `gh run view $RUN_CONSEGNA --json jobs` → i job `immagine`, `pubblica`, `deploy` sono
      `success`; il passo «Deploy and smoke test» è verde (smoke di `infra/smoke.sh` eseguito, non
      saltato: il log contiene l'esito dello smoke e nessun `::error::`).
- [ ] T1.2 `curl -sS -o /tmp/h.json -w '%{http_code}' https://app.planforhome.com/api/health`
      → `200`; il corpo è JSON con `status` = `UP` e `sha` uguale a `$SHA_DEPLOY` (completo o
      prefisso, come lo scrive `GIT_SHA`).
- [ ] T1.3 `curl -sS -w '%{http_code}' https://app.planforhome.com/` → `200`, `Content-Type`
      `text/html`, il documento carica il bundle JS dell'app (tag `<script` verso `/_expo/`);
      con Playwright o `curl` di un percorso del bundle → `200`.
- [ ] T1.4 Verifica del digest: il log del passo «Deploy and smoke test» di `$RUN_CONSEGNA` mostra
      il controllo del digest delle immagini (`infra/deploy.sh`) superato per server e web.
- [ ] T1.5 Il merge su `main` fa partire la consegna: `$RUN_CONSEGNA` ha `event` = `push` o
      `workflow_run` su `main` (non `workflow_dispatch`), e la run del merge di #5 c'è.
- [ ] T1.6 Rollback provato in CI con server finto: nell'ultima run `ci` verde su `main` (o sulla PR
      #5) il job `server` è verde e l'artefatto `test-reports` contiene
      `Giro000RollbackAcceptanceTest` con 0 fallimenti e 0 test saltati.
- [ ] T1.7 HTTPS valido: `curl -sS -v https://app.planforhome.com/ 2>&1 | grep -i 'SSL certificate verify ok'` → presente.

### T2 — verifica visiva e APK
- [ ] T2.1 Su una PR (#5, l'ultima run `ci` verde): job `app` verde con «Web bundle (expo export)»
      e «Playwright on the web» verdi; l'artefatto `e2e-screenshots` esiste
      (`gh api repos/{owner}/{repo}/actions/runs/<id>/artifacts`) e contiene screenshot della
      home in italiano e in inglese (scaricarlo con `gh run download` e listarne i file).
- [ ] T2.2 Il report Playwright (`playwright-report`) di quella run elenca i test di
      `giro-000-home.spec.ts` e `giro-000-i18n.spec.ts` come passati, compresa la ricerca per
      ruolo ed etichetta (nessun selettore CSS: `grep -nE "locator\(['\"][.#]" app/e2e` → vuoto).
- [ ] T2.3 Chiave mancante: il test in `app/src/i18n/__tests__/i18n.test.ts` che fa fallire una chiave
      mancante è nella run Jest della CI e passa; in locale `cd app && npm test -- i18n` → verde.
- [ ] T2.4 APK su PR: nella stessa run `ci` il job `apk` è verde con artefatto `apk-non-firmato`;
      il job `build` dipende da `apk` e fallisce se `apk` non è `success`
      (`.github/workflows/ci.yml`, job `build`, `needs: [lab, server, app, apk]`).
- [ ] T2.5 APK firmato a ogni merge: in `$RUN_CONSEGNA` (o nella run `consegna` del merge di #5) i job
      `apk` e `apk-firma` sono verdi e c'è un artefatto `planforhome-<versione>-<sha corto>.apk`
      con versione `0.1.0` e sha corto uguale allo SHA della run.
- [ ] T2.6 «Ultimo APK»: scaricato quell'artefatto, il file è uno zip valido con
      `AndroidManifest.xml` e una firma v2/v3 (`apksigner verify --print-certs` se disponibile;
      altrimenti il log del passo «Sign the APK» con `apksigner verify` verde). Pacchetto
      `com.planforhome.app` (`aapt dump badging` se disponibile, altrimenti dal log di build).
      Che l'APK si installi e si apra su un telefono lo dichiara l'umano: dato a parte.

Esito: T1 `passato` se T1.1–T1.7 verdi; T2 `passato` se T2.1–T2.6 verdi. Ogni controllo rosso è
un difetto `001:<gravità>` nel rapporto, con `difetto_di: 000`.

## Fuori perimetro
- Qualsiasi riga di codice, configurazione o workflow; correzioni dei difetti trovati (vanno in un
  giro di costruzione successivo).
- I 5 dubbi minori del revisore 000 (password nei log, deploy paralleli dello stesso SHA, rideploy
  con pull fallito, `<html>` senza `lang`, `{headNodes}` non coperto): si annotano, non si toccano.
- Provocare un rollback vero in produzione (lo smoke rosso si prova solo in CI con server finto,
  come dice T1).
- Comandi sui server (CLAUDE.md regola 7): solo richieste HTTPS pubbliche e API di GitHub.
- PR di Dependabot #2 e #3; setup passo 9.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista;
  accesso con Google o Apple, iPhone, Play Store; email di verifica e recupero password;
  sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: giro di verifica. I controlli sono i comandi sopra.

## Porte
- Doppio senso previste: nessuna.
- Senso unico: nessuna.

## Rischi di concorrenza
Un merge su `main` durante la verifica cambia lo SHA in produzione: fissare `$SHA_DEPLOY` all'inizio
e, se cambia, rifare T1.2 contro la nuova run. Nessuna scrittura.

## Budget
0 righe di codice; 0 file di produzione. Unici file scritti: `001-piano.md`, `001-rapporto.md`,
`PROGRESS.md`, campi `stato`/`giri`/`pr`/`passato_il` di T1 e T2 in `traguardi.json`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Un test che fallisca se `+html.tsx` non rende `{headNodes}` (dubbio 000).
- `lang` sull'elemento `<html>` della pagina web.
