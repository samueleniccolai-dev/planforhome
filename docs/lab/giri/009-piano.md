---
giro: 009
traguardo: T4
traguardi_extra: []
tipo: verifica-produzione
fase: chiusura
inizio: 2026-10-20T11:55:07Z
ricerca: no
accettazione:
ripreso: no
---
> **RISPOSTA (20/10, opzione A):** scritture di prova autorizzate. Rilanciare la revisione.
> **DOMANDA (giro 009, risolta):** la verifica in produzione di T4 richiede scritture verso `app.planforhome.com` (4 account `verifica009.*@example.com`, 3 famiglie, 2 task di prova: dati inventati). Il permesso della sessione le ha negate: 0 account creati, limiti per IP intatti. Controlli in sola lettura e in CI verdi (T4.1–T4.4, B1: sha b92f3b4).
> Opzioni: A) autorizzare le scritture di prova verso produzione e rilanciare la revisione (raccomandata); B) l'umano esegue la sequenza del piano e scrive l'esito; C) T4 resta `in-corso`, nessuna verifica.
> Dopo A: nuovo revisore sullo stesso piano. Dopo B: l'esito va nel piano e nel rapporto. Dopo C: giro chiuso senza passaggio di T4.
> Anche da fare: provare l'APK di b92f3b4 su telefono (job `apk` ancora in corso alle 11:58 UTC).

# Piano del giro 009 — verifica in produzione di T4 (famiglie, persone e ruoli)

## Fetta e traguardo
Verifica di T4. Le parti di T4 sono state costruite nei giri 006 (API, PR #13), 007 (web, PR #14) e
008 (ritorno in coda, PR #15). Il rapporto 008 dice che la frase sul ritorno in coda ora è provata
in CI e che serve un giro verifica-produzione. La PR #15 è mergiata (`b92f3b4`) e il deploy è
verde. Questo giro ripete i controlli del «Fatto quando» di T4 contro `https://app.planforhome.com`
e contro le run della CI. Nessun codice.
Fonti: SPEC §2.1, §2.2.1, §5 (P13–P15), §6; `traguardi.json` → T4; contratti dell'API in
`006-piano.md` e `008-piano.md`, testi dell'app in `007-piano.md`.

Riferimenti fissati al momento del piano (2026-10-20, circa 12:00Z):
- `$SHA` = `b92f3b4d40d14d0b33f0ac9bd212dd516d5f1f4c` (merge della PR #15). `git diff --stat 03ac540 b92f3b4`
  è vuoto: il merge ha lo stesso albero dell'ultimo commit della PR.
- `$RUN_CONSEGNA` = 39417679689 (push su `main`, b92f3b4): job `controllo`, `immagine`,
  `pubblica`, `deploy`, `avanti` `success`; `decidi` `skipped`; **`apk` ancora in corso**. La run
  39418463477 (stesso SHA) è `skipped`.
- `$RUN_CI_PR` = 39409556560 (PR #15, 03ac540) `success`.
- `GET /api/health` → `{"status":"UP","sha":"b92f3b4…"}`.

Il «Fatto quando» di T4 non nomina Android: l'APK non entra nel verdetto (vedi «Per l'umano»).

## Fatto quando — controlli eseguibili

### Regole per le prove in produzione
- Tutto da fuori, con `curl` (e Playwright per la parte web) verso `https://app.planforhome.com`.
  Nessun comando sui server (regola 7). Nessuna lettura di `DEMO_PASSWORD` né di altri segreti:
  **gli account demo (Luca, Giulia) non si usano in produzione** (vedi sezione E).
- Account inventati, creati da questo giro e lasciati in produzione (non c'è un'API per
  cancellarli): `verifica009.<epoch>.<x>@example.com` con `<x>` = `a`, `b`, `c`, `d`. `<epoch>` =
  `date -u +%s` all'inizio della prova, annotato nel rapporto. Locale `it`.
- Password generate al momento in `/tmp/giro-009/` (`openssl rand -base64 18 > /tmp/giro-009/p-a`,
  idem `p-b`, `p-c`, `p-d`), mai stampate né committate, passate con
  `jq -n --rawfile p /tmp/giro-009/p-a '{…, password: ($p|rtrimstr("\n"))}' | curl --data @- …`.
  Tutto `/tmp/giro-009/` si cancella a fine giro.
- Limiti da rispettare: registrazioni 10 per IP all'ora (qui 4); codici sbagliati 5 per IP all'ora
  (qui 1, in J3); login sbagliati 5 per email (qui 1, in N3, su un account già disattivato).
  La sequenza si esegue **una volta sola, nell'ordine**. Se un passo fallisce per un motivo
  esterno (rete, proxy), lo si dichiara nel rapporto; si ripete solo dopo un'ora.
- Ogni `id` e `mutationId` mandato è un UUIDv7 generato al momento (per esempio con
  `python3 -I -c` e i 48 bit di millisecondi + casuale) e annotato nel rapporto.

### Persone e famiglie di prova (inventate)
| Chi | Come nasce | Ruolo |
|---|---|---|
| A (`…a@`) | registrazione con `familyName: "Famiglia Verifica 009"` | gestore di Verifica 009 |
| B (`…b@`) | registrazione con `familyName: "Famiglia Verifica 009 Bis"`; poi entra in Verifica 009 con un codice (J1) | gestore di Bis, membro di 009: **2 famiglie** |
| C (`…c@`) | registrazione con un codice di Verifica 009 | membro, **1 famiglia** (poi tolta: N1) |
| D (`…d@`) | registrazione con un codice di Verifica 009 | membro, **1 famiglia** (resta) |
| Nina | risorsa senza account aggiunta da A, referente A | membro senza account |

### A. Prove nella CI (sola lettura) e in locale
- [ ] T4.1 `gh run view 39409556560 --json jobs` → job `server` e `app` `success`. In `git ls-tree -r b92f3b4`
      ci sono `Giro006{Family,Members,LastMembership,Isolation}AcceptanceTest`,
      `Giro008{Requeue,Task,Queue,TaskIsolation}AcceptanceTest` e
      `app/e2e/acceptance/giro-007-families.spec.ts` (Luca entra diretto, Giulia sceglie e cambia,
      con l'API finta dei dati demo). Se il proxy blocca i log, vale il job `success`.
- [ ] T4.2 In locale, su `b92f3b4`:
      `cd server && ./mvnw -q -Dtest='Giro003*AcceptanceTest,Giro004*AcceptanceTest,Giro006*AcceptanceTest,Giro008*AcceptanceTest' test`
      → verde. In particolare `Giro008RequeueAcceptanceTest` (account disattivato e risorsa
      cancellata → task in coda) e `Giro006LastMembershipAcceptanceTest`.
- [ ] T4.3 In locale: `cd app && npx expo export --platform web && npx playwright test e2e/acceptance/giro-007-*`
      → verde in `it-IT` e `en-US` (prova di Luca e Giulia con i dati demo, API finta).
      Se Docker o il browser mancano nella sessione, vale T4.1 e lo si dichiara.
- [ ] T4.4 `$RUN_CONSEGNA`: job `deploy` («Deploy and smoke test») `success`.

### B. Smoke da fuori
- [ ] B1 `curl -sS https://app.planforhome.com/api/health` → 200, `"sha":"b92f3b4d40d14d0b33f0ac9bd212dd516d5f1f4c"`.
- [ ] B2 Senza login: `POST /api/families` `{"name":"X"}` → 401; `POST /api/families/join` `{"code":"x"}` → 401;
      `GET /families` e `GET /family` → 200 (file statici).

### C. P14 — creare una famiglia
- [ ] C1 Registrazione di A (con `familyName`) → 201, `families[0].role` = `MANAGER`. Login di A (Bearer).
- [ ] C2 A: `POST /api/families` `{id: <uuid7>, name: "Famiglia Verifica 009 Ter", timeZone: "Europe/Rome"}`
      → 201, `role: "MANAGER"`; lo stesso corpo di nuovo → 200, stesso `id`; `GET /api/families` di A → 2
      famiglie (009, 009 Ter).
- [ ] C3 Vietato: A con `name: "   "` → 400 `family_name_invalid`; A con `timeZone: "Marte/Olimpo"` →
      400 `time_zone_invalid`; dopo, `GET /api/families` di A → ancora 2.

### J. Codici d'invito e codice da utente già registrato (P13 codici)
- [ ] J0 Registrazione di B (con `familyName: "Famiglia Verifica 009 Bis"`) → 201. Login di B.
- [ ] J1 A: `POST /api/families/{009}/invites` → 201 `{code, expiresAt}` (≈ ora + 7 giorni). B:
      `POST /api/families/join` `{code}` → 200 `{…, role:"MEMBER"}`; `GET /api/families` di B → 2
      (009, 009 Bis, ordinate per nome).
- [ ] J2 Vietato P13: B (membro di 009) `POST /api/families/{009}/invites` → 403 `forbidden`.
- [ ] J3 Vietato: B di nuovo con lo **stesso** codice → 400 `invite_invalid` (un codice sbagliato su 5).
- [ ] J4 A genera un secondo codice; B lo usa → 409 `already_member`. Poi C si registra con
      **quel** codice → 201, `families[0]` = Verifica 009, `MEMBER` (il codice non si era consumato).
- [ ] J5 A genera un terzo codice; D si registra con quel codice → 201, 1 famiglia.

### R. P13 — risorse, ruoli, referente, togliere un'appartenenza
- [ ] R1 A: `POST /api/families/{009}/resources` `{id:<uuid7>, displayName:"Nina", referentPersonId:<A>}`
      → 201 `hasAccount:false`, `referentPersonId` = A; stesso corpo di nuovo → 200, nessun doppione
      in `GET /api/families/{009}/members`.
- [ ] R2 Vietato: B (membro) aggiunge una risorsa → 403; A con `referentPersonId` = Nina (risorsa) →
      400 `referent_invalid`; A con `referentPersonId` = un UUIDv7 inventato → 400 `referent_invalid`;
      A con `displayName: ""` → 400 `display_name_invalid`; l'elenco membri non cambia (5 persone).
- [ ] R3 Ruoli: A nomina B gestore → 200 `MANAGER`; A rimette B membro → 200 `MEMBER`; vietato: D
      (membro) nomina sé stesso gestore → 403; A dà `MANAGER` a Nina → 400 `role_invalid`; A, unica
      gestore, si toglie il ruolo → 409 `last_manager`.
- [ ] R4 Togliere un'appartenenza: vietato: D (membro) `DELETE /api/families/{009}/members/{B}` → 403.
      Permesso: A toglie B da 009 → 204; B entra ancora (`GET /api/me` → 200) e ha 1 famiglia
      (009 Bis). Poi B rientra in 009 con un quarto codice di A → 200 (serve a L2).
- **Ordine di esecuzione fisso:** B, C, J, R1–R3, L1, E, R4, L2, N.

### L. P15 — lasciare una famiglia senza lasciarla senza gestore
- [ ] L1 Vietato: A (unica gestore di 009, con 2 famiglie) `DELETE /api/families/{009}/members/{A}` →
      409 `last_manager`; D (1 sola famiglia) lascia 009 → 409 `last_family`; entrambi restano membri.
- [ ] L2 Permesso: B (2 famiglie, membro di 009) lascia 009 → 204; `GET /api/families` di B → solo 009 Bis.

### N. Nessuna persona resta senza famiglia, task in coda
- [ ] N1 A crea due task in 009: `POST /api/families/{009}/tasks` `{mutationId, title:"Portare il
      cane dal veterinario", assigneePersonId:<C>}` → 201 `version: 1`; `{mutationId, title:"Annaffiare
      il basilico", assigneePersonId:<Nina>}` → 201.
- [ ] N2 A toglie C (ultima appartenenza) → 204. Il vecchio token di C su `GET /api/me` → 401.
- [ ] N3 Login di C con la password giusta → 401 con corpo identico byte per byte a quello di un
      login di C con una password sbagliata (`{"error":"invalid_credentials"}`, `cmp` dei due corpi).
- [ ] N4 `GET /api/families/{009}/tasks` (A) → il task del veterinario ha `assigneePersonId: null`,
      `status: "OPEN"`, `version: 2`.
- [ ] N5 A toglie Nina → 204; Nina non è più in `GET /api/families/{009}/members`; un secondo `DELETE`
      → 404; il task del basilico ha `assigneePersonId: null`, `status: "OPEN"`, `version: 2`.
- [ ] N6 Isolamento da fuori: D `GET /api/families/{009 Bis}/members` → 404; D `GET /api/families/{009 Bis}/tasks`
      → 404; A `DELETE /api/families/{009 Bis}/members/{B}` → 404 con corpo identico a quello di
      una famiglia inesistente (UUIDv7 inventato).

### E. Web: entrare in una famiglia, scegliere e cambiare (Playwright su produzione)
- [ ] E1 Script temporaneo fuori dal repo (`/tmp/giro-009/web/web.spec.ts` e una config con
      `baseURL: https://app.planforhome.com`, senza `webServer`), lanciato con
      `cd app && npx playwright test --config /tmp/giro-009/web/playwright.config.ts`, in `it-IT` e
      `en-US`, elementi per ruolo ed etichetta:
      - **1 famiglia (D, come Luca):** login → URL `/family?id=<009>`, h1 «Famiglia Verifica 009»,
        elenco persone con D; nessun link «Cambia famiglia» / «Switch family» né su `/family` né su `/me`;
      - **2 famiglie (B, come Giulia):** login → URL `/families`, h1 «Scegli una famiglia» /
        «Choose a family», esattamente 2 link: «Famiglia Verifica 009», «Famiglia Verifica 009 Bis»;
        clic su «Famiglia Verifica 009 Bis» → h1 «Famiglia Verifica 009 Bis»; «Cambia famiglia» →
        `/families` → «Famiglia Verifica 009» → h1 «Famiglia Verifica 009»; lo stesso partendo da `/me`;
      - **isolamento:** D apre `/family?id=<009 Bis>` → alert «Famiglia non trovata.» / «Family not
        found.», nessun testo «Famiglia Verifica 009 Bis».
      Si esegue dopo L1 e prima di R4 (B deve avere 2 famiglie). Se il browser non esce dal proxy, vale
      T4.3 più le chiamate J1/N6 (le stesse del client), e lo si dichiara.
- I casi esatti del «Fatto quando» con Luca e Giulia dei dati demo non si provano in produzione
  dall'agente (servirebbe `DEMO_PASSWORD`): valgono T4.1/T4.3; **l'umano** può confermarli entrando
  come Luca e Giulia sul web.

### Esito
T4 `passato` se T4.1, T4.2 (o il suo ripiego dichiarato), T4.4, B1–B2, C1–C3, J0–J5, R1–R4, L1–L2,
N1–N6 ed E1 (o il suo ripiego) sono verdi. Un controllo rosso è un difetto `009:<gravità>` con
`difetto_di: 006`, `007` o `008`, e T4 resta `in-corso`. N2/N3 verdi a metà (sessione o login
ancora valido dopo la disattivazione) o un 200 in N6 sono difetti `bloccante`.

## Per l'umano (non entra nel verdetto)
- APK di b92f3b4: job `apk` di `$RUN_CONSEGNA` ancora in corso al momento del piano; il rapporto
  annota l'esito e il nome dell'artefatto. Provarlo su un telefono fisico resta all'umano (come
  `planforhome-0.1.0-c3538cd`). Su Android il login non c'è ancora (porta `expo-secure-store`).
- Conferma facoltativa con i dati demo: Luca entra diretto nella Famiglia Mamma; Giulia sceglie tra
  Famiglia Principale e Famiglia Mamma e cambia famiglia (web, password demo).

## Fuori perimetro
- Qualsiasi riga di codice, configurazione, workflow o script del repository (lo script Playwright
  vive in `/tmp/giro-009/` e si cancella).
- T5 parte 2 (P7–P9, schermate dei task, task demo) e la sua verifica.
- Login su Android, `expo-secure-store`; APK su telefono fisico.
- Codice scaduto (7 giorni), limite dei codici oltre 1 tentativo, concorrenza in produzione: vale la CI.
- Login con gli account demo; login sbagliati sugli account demo.
- Pulizia degli account di prova (005 e 009); difetto `Max-Age` del giro 004; PR Dependabot #2 e #3.
- T1, T2, T3, già `passato`.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; verifica dell'email e recupero della
  password; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: giro di verifica.

## Porte
- Doppio senso previste: 4 account, 3 famiglie («Famiglia Verifica 009», «… Bis», «… Ter») e 2 task
  inventati lasciati nel database di produzione (R0, dati finti; si tolgono con un reset del demo).
- Senso unico: nessuna.

## Rischi di concorrenza
- Un merge su `main` durante il giro cambia la versione in produzione: B1 lo mostra. Si rifà la
  verifica sul nuovo SHA (dopo un'ora, per il limite di registrazione).
- I limiti per IP sono condivisi con altre sessioni dallo stesso IP di uscita: un 429 inatteso in
  registrazione o in J3 si annota con il passo; non è un difetto.
- Un riavvio del server a metà non cambia nulla di persistente; si annota se `/api/health` cambia.
- Nessuna scrittura nel repository oltre ai documenti del giro.

## Budget
0 righe di codice. File scritti: `009-piano.md`, `009-rapporto.md`, `PROGRESS.md` e i campi
`stato`/`giri`/`pr`/`passato_il` di T4 in `traguardi.json`. File temporanei solo in `/tmp/giro-009/`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Un endpoint o uno script per cancellare gli account di prova delle verifiche (oggi restano).
- Un comando di verifica in produzione riusabile (le sezioni C–N come script in `scripts/`).
