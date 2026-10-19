---
giro: 002
traguardo: T2
traguardi_extra: []
tipo: verifica-produzione
fase: revisione
inizio: 2026-10-19T18:01:45Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 002 — verifica in produzione di T2 (verifica visiva e APK)

## Fetta e traguardo
Verifica di T2 da solo. Il giro 001 ha trovato verdi tutti i controlli di T2, ma
`scripts/lab/traguardo.py` accetta un solo traguardo per rapporto, quindi T2 è rimasto `in-corso`
(rapporto 001, `proposte-metodo.md`). La PR #7 è mergiata (36c065c). Questo giro ripete i
controlli di T2 contro le run più recenti e scrive un rapporto che nomina solo T2.
Nessun codice. Fonti: SPEC §10, §12, §13; `traguardi.json` → T2.

Tra ce8209b (APK e e2e verificati nel giro 001) e 36c065c sono cambiati solo `docs/` e
`metrics/` (`git diff --stat ce8209b 36c065c`). App, server, workflow e infrastruttura sono
identici. Quindi:
- `$RUN_CONSEGNA` = 39298335555 (push su `main`, 36c065c). Al momento del piano il job `apk` è in
  corso. Se finisce verde, l'«ultimo APK» è `planforhome-0.1.0-36c065c`. Se fallisce, è un
  difetto `002:<gravità>` con `difetto_di: 000`, e T2 non passa.
- `$RUN_CI_PR` = 39294246077 (PR #7, `success`): è l'ultima run `ci` completa su una PR.

## Fatto quando — controlli eseguibili
Preparazione (sola lettura). Aspettare che `$RUN_CONSEGNA` sia `completed`:
`gh run view 39298335555 --json status,conclusion,jobs`.

- [ ] T2.1 `gh run view 39294246077 --json jobs` → job `app` `success`. I passi
      «Web bundle (expo export)» e «Playwright on the web» sono `success`.
      `gh api repos/{owner}/{repo}/actions/runs/39294246077/artifacts` → c'è `e2e-screenshots`.
- [ ] T2.2 Ricerca per ruolo ed etichetta: `grep -nE "locator\(['\"][.#]" app/e2e` → nessun
      risultato. I test di `app/e2e/acceptance/giro-000-home.spec.ts` (it/en) sono nella run di T2.1.
- [ ] T2.3 Chiave mancante: `app/e2e/acceptance/giro-000-i18n.spec.ts` è nella run di T2.1 (job
      `app` verde). In locale: `cd app && npm test` → verde.
- [ ] T2.4 APK su PR: in `39294246077` il job `apk` è `success`. Il job `build` ha
      `needs` con `apk` (`grep -n "needs" .github/workflows/ci.yml`), quindi una build rotta fa
      fallire il controllo.
- [ ] T2.5 APK firmato al merge: in `39298335555` i job `apk` e `apk-firma` sono `success`.
      `gh api repos/{owner}/{repo}/actions/runs/39298335555/artifacts` → un artefatto con nome
      `planforhome-0.1.0-36c065c` (versione 0.1.0, SHA corto del merge).
- [ ] T2.6 Firma: il passo «Sign the APK» di `apk-firma` è `success` (con `apksigner verify`).
      Se il proxy blocca log e artefatti (come nel giro 001), vale la prova umana del 19/10 su
      `planforhome-0.1.0-ce8209b` (v2/v3, `com.planforhome.app`). Il codice dell'app è identico,
      ma va dichiarato nel rapporto.

Esito: T2 `passato` se T2.1–T2.6 sono verdi. Se T2.5 è rosso perché il job `apk` di 39298335555
fallisce, è un difetto e il traguardo resta `in-corso`.
Dato a parte, non bloccante: l'APK è stato aperto solo su emulatore, non su telefono fisico.

## Fuori perimetro
- Qualsiasi riga di codice, configurazione, workflow o script (compreso `traguardo.py`, percorso
  protetto: la correzione è una PR umana).
- T1, già `passato`. Il difetto `001:minore` (smoke prima del certificato Caddy) va in un giro di
  costruzione.
- La prova su telefono fisico (la dichiara l'umano quando avrà un telefono).
- PR Dependabot #2 e #3; ratifiche 000-a e 000-b.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista;
  accesso con Google o Apple, iPhone, Play Store; email di verifica e recupero password;
  sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: giro di verifica.

## Porte
- Doppio senso previste: nessuna.
- Senso unico: nessuna.

## Rischi di concorrenza
Un nuovo merge su `main` durante il giro cambia l'«ultimo APK». In quel caso T2.5 e T2.6 si
rifanno sulla nuova run `consegna`. Nessuna scrittura.

## Budget
0 righe di codice. File scritti: `002-piano.md`, `002-rapporto.md`, `PROGRESS.md` e i campi
`stato`/`giri`/`pr`/`passato_il` di T2 in `traguardi.json`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- `lang` sull'elemento `<html>` e un test su `{headNodes}` (dubbi del giro 000).
