---
giro: 037
traguardo: T10
traguardi_extra: []
tipo: verifica-produzione
fase: domanda (da: piano)
inizio: 2026-10-23T17:05:17Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 037 — verifica in produzione di T10 (promemoria e solleciti)

## RICHIESTA per l'umano (decisione 111, opzione B): la prova sul telefono

**Contesto.** Con la decisione 111 hai scelto B: la catena ha costruito il testo di SPEC §8
(035) e `GET /api/families/{f}/tasks/{t}/reminders` per i gestori (036, PR #51, in produzione su
`5ce97c3`). Resta la parte che solo tu puoi fare: un telefono con l'APK, un login e il permesso
accettato. Senza un token FCM vero il server non riceve nessun identificativo da FCM, e il
controllo F2 del «Fatto quando» di T10 non si può provare. Non è una scelta nuova: serve il tuo
commento perché il giro dia un verdetto.

**Passi (≈ 10 minuti; dati demo di SPEC Appendice A, Famiglia Mamma: Anna gestore, Luca membro).**
1. Installa l'APK dell'ultima consegna (run 39991288249, job `apk`, artefatto con `5ce97c3` nel
   nome; se il job non è ancora finito, quello del run precedente con l'APK verde va bene: il testo
   lo compone il server).
2. Sul telefono: login come **Luca**; accetta il permesso delle notifiche; chiudi l'app.
3. Sul web (`https://app.planforhome.com`) come **Anna**: crea in Famiglia Mamma il task
   «Prova notifica 037», assegnato a Luca, scadenza 30/11/2026; premi «Sollecita».
4. Sul telefono: arriva «Anna ti sollecita» · «Prova notifica 037» nel canale «Promemoria»?
   Toccala ad app chiusa: si apre il task? Dopo 5 minuti risollecita e tocca ad app aperta.
5. Nello stesso browser, sempre come Anna (il cookie vale per `/api`):
   - `https://app.planforhome.com/api/families` → copia l'`id` di Famiglia Mamma (`F`);
   - `https://app.planforhome.com/api/families/F/tasks` → copia l'`id` di «Prova notifica 037» (`T`);
   - `https://app.planforhome.com/api/families/F/tasks/T/reminders` → il JSON delle righe.
6. Commenta la PR del giro: sì/no per i passi 2 e 4, e il JSON del passo 5. Contiene solo `id`,
   `kind`, `dueAt`, `sentAt`, `result`: nessun token o chiave. Poi metti `risposto` e i minuti.

**Opzioni.**

| | Cosa | Pro | Contro |
|---|---|---|---|
| **A** | Fai i passi 1–6 ora. | T10 può passare in questo giro. | ≈ 10 minuti tuoi. |
| B | Rispondi «telefono dopo»: il giro esegue solo i controlli da fuori. | Nessun tempo tuo ora. | F2 resta senza prova: T10 `non-passato`, serve un altro giro di verifica. |

**Raccomandazione: A.** È il passo concordato nella decisione 111, ed è l'ultimo che manca a T10.

**Dopo ogni risposta.**
- A → il giro riprende ed esegue tutto il «Fatto quando» qui sotto; F1–F4 si leggono dal tuo
  commento. T10 `passato` se l'esito è verde.
- B → il giro esegue V, S, P, R; il rapporto dice `non-passato` per F2 mancante, senza difetti
  nuovi; il prossimo giro è un'altra verifica, appena dici che il telefono è pronto.

## Fetta e traguardo
T10, tipo `verifica-produzione`: il giro 036 ha chiuso l'ultimo pezzo deciso con la decisione 111
(il rapporto 036 dice «manca la verifica 037»), la PR #51 è mergiata in `5ce97c3`, il deploy è
verde. Nessun codice.
Fonti: SPEC §2.2.9, §5 (riga P12), §8; `traguardi.json` → T10; piano e rapporto 034; rapporti 035–036.

Riferimenti fissati al momento del piano (2026-10-23T17:15Z):
- `$SHA` = `5ce97c31285460ccaa6c599de19b4877f21f04c6` (merge della PR #51);
  `GET /api/health` → `{"status":"UP","sha":"5ce97c31285460ccaa6c599de19b4877f21f04c6"}`.
- `$RUN_CONSEGNA` = 39991288249: `decidi`, `immagine`, `pubblica`, `deploy`, `avanti` in
  `success`, `controllo` `skipped`; **`apk` ancora in corso**.
- `$RUN_CI_PR` = 39989091113 (`ci` sul branch `claude/giro-036-t10`, `d25fbcf`): `success`.
- Scritture di prova in produzione: coperte dalla **decisione 42**.

## Fatto quando — controlli eseguibili

### Regole per le prove da fuori (come nei giri 029 e 034)
- `curl` e `jq` verso `https://app.planforhome.com`, login con `client:"android"`. Nessun comando
  sui server. Gli account demo (Anna, Luca) li usa solo l'umano.
- Account inventati `verifica037.<epoch>.<x>@example.com`, `<x>` = `a`, `b`, `c`; A e C con
  locale `it`, B con locale `en`. Password generate in `/tmp/giro-037/` (`openssl rand -base64 18`),
  mai stampate; la cartella si cancella a fine giro. UUIDv7 generati al momento, annotati nel rapporto.
- Tre registrazioni, un codice d'invito, nessun login sbagliato; sequenza eseguita una volta.
  Un errore esterno (rete, proxy, 429 di registrazione) si dichiara e non è un difetto.

### Persone di prova (inventate)
| Chi | Come nasce | Ruolo |
|---|---|---|
| A, «Verifica A» | registrazione con `familyName: "Famiglia Verifica 037"` (F); fuso predefinito, annotato da `GET /api/families` (09:00Z e 10:00Z restano fuori dal silenzio notturno in UTC e in Europa) | gestore di F |
| B, «Verifica B» | registrazione con un codice d'invito di F | membro di F, nessun dispositivo |
| C, «Verifica C» | registrazione con `familyName: "Famiglia Verifica 037 Altra"` (FX) | non in F |

### V. CI, test in locale, APK
- [ ] V1 `gh run view 39989091113 --json jobs` → `server`, `app`, `apk` in `success`.
      `git ls-tree -r --name-only 5ce97c3` contiene `Giro031*AcceptanceTest.java`,
      `Giro032Reminder{Schedule,Send,Recalc}AcceptanceTest.java`, `Giro033ChannelAcceptanceTest.java`,
      `Giro035*AcceptanceTest.java`, `Giro036ReminderReadAcceptanceTest.java`,
      `app/e2e/acceptance/giro-031-nudge.spec.ts`, `giro-033-push-{android,web}.spec.ts`.
- [ ] V2 In locale su `5ce97c3`: `cd server && ./mvnw -q -Dtest='Giro03[12356]*AcceptanceTest' test`
      → verde. Il rapporto cita un metodo per ciascun pezzo lato server del «Fatto quando»:
      anticipo DATETIME e 9:00 DATE; scadenza e 18:00 DATE; slittamento alle 7:00; 21:45 della
      sera prima; referente nella sua lingua per una risorsa senza account; ricalcolo per scadenza,
      assegnatario, famiglia e stato; task in coda scaduto ai gestori; P12 permesso e vietato;
      secondo sollecito entro 5 minuti rifiutato; payload con `taskId` e testo di SPEC §8 in
      italiano e in inglese; token rifiutato cancellato. Un pezzo senza metodo è un difetto
      `037:maggiore` con `difetto_di` il giro del pezzo.
- [ ] V3 In locale: `cd app && npm test && npx playwright test e2e/acceptance/giro-031-* e2e/acceptance/giro-033-*`
      → verde; il rapporto cita il test del segno «sollecitato» con l'ora sul web. Senza Docker o
      browser valgono V1 e la run CI, dichiarandolo.
- [ ] V4 `$RUN_CONSEGNA`: job `deploy` («Deploy and smoke test») in `success`.
- [ ] V5 Ultimo APK: in `$RUN_CONSEGNA` job `apk` in `success` e un artefatto APK con `5ce97c3`
      nel nome, dimensione > 0, non scaduto (`gh api repos/{owner}/{repo}/actions/runs/39991288249/artifacts`).
      Se il job è ancora in corso si attende con un controllo a intervalli; se fallisce,
      `037:maggiore`.
- [ ] V6 Permesso nell'APK: `gh run download 39991288249 -n <artefatto> -D /tmp/giro-037/apk`, poi
      `python3 -I` con `zipfile` legge `AndroidManifest.xml` e cerca
      `android.permission.POST_NOTIFICATIONS` codificata UTF-16LE → presente. Nessun binario nuovo.
      Assente = `037:maggiore` (`difetto_di` 033).

### S. Da fuori, senza login
- [ ] S1 `curl -sS https://app.planforhome.com/api/health` → 200 con `"sha":"5ce97c31285460ccaa6c599de19b4877f21f04c6"`.
      Ripetuto alla fine.
- [ ] S2 Senza token, con UUIDv7 inventati: `POST …/tasks/{t}/nudge`, `POST /api/me/devices`,
      `GET /api/families/{f}/tasks/{t}/reminders` → 401.

### P. Sollecito P12 in produzione (account di prova)
- [ ] P0 Preparazione: A e C si registrano e fanno login; A genera un codice d'invito di F; B si
      registra con il codice e fa login. Se un passo fallisce, la sequenza si ferma.
- [ ] P1 A crea in F `T1("Ritirare le analisi")`, DATETIME `2026-11-20T10:00:00Z`, assegnato a B;
      e `T2("Portare la bici dal meccanico")`, DATE `2026-11-21`, **in coda**.
- [ ] P2 Permesso: A `nudge` su T1 → 200; il task ha `lastNudgedAt` non nullo e `version` + 1.
- [ ] P3 Vietato (ruolo): B `nudge` su T1 → 403 `forbidden`.
- [ ] P4 Vietato (in coda): A `nudge` su T2 → 409 `not_assigned`.
- [ ] P5 Entro 5 minuti: A `nudge` di nuovo su T1, `mutationId` nuovo → 429 `nudge_too_soon`;
      `lastNudgedAt` invariato. Lo stesso `mutationId` di P2 → 2xx senza effetto (replay),
      `lastNudgedAt` invariato.
- [ ] P6 Isolamento: C `nudge` su T1 (con l'`id` di F nell'URL) → 404, corpo identico (`cmp`) a
      quello di una famiglia inesistente; `lastNudgedAt` invariato.

### R. Promemoria letti con il GET del giro 036 (account di prova)
- [ ] R1 A `GET /api/families/F/tasks/T1/reminders` → 200; oggetti con sole chiavi `id`, `kind`,
      `dueAt`, `sentAt`, `result`. Contiene: due righe `AUTO` con `result` `pending`, `sentAt`
      nullo, `dueAt` `2026-11-20T09:00:00Z` (anticipo 60) e `2026-11-20T10:00:00Z` (scadenza);
      una riga `NUDGE` con `sentAt` = ora di P2 (±1 min) e `result` `no_device` (B non ha
      dispositivi). `push_disabled` = FCM spento in produzione: `037:bloccante` (`difetto_di` 031).
      Nessuna seconda riga `NUDGE` (P3–P6 rifiutati).
- [ ] R2 Ricalcolo: A cambia la scadenza di T1 a `2026-11-25T10:00:00Z`
      (`PUT /api/families/F/tasks/T1` con la `version` corrente, `mutationId` nuovo) → R1 ripetuto mostra le due `AUTO` a `2026-11-25T09:00:00Z` e `10:00:00Z`, la
      `NUDGE` invariata.
- [ ] R3 Permessi della lettura: B (membro di F) → 403; C con l'`id` di F nell'URL → 404, corpo
      identico (`cmp`) a quello di una famiglia inesistente; C sul proprio FX con `taskId` = T1 → 404.

### F. Telefono e `reminder.result` (dal commento dell'umano)
- [ ] F1 Il commento dichiara login di Luca e permesso accettato (passo 2). Dato a parte.
- [ ] F2 Il JSON del passo 5 ha almeno una riga `NUDGE` con `sentAt` valorizzato e `result` della
      forma `projects/<progetto>/messages/<id>` → verde. Un `result` diverso (`error:…`,
      `push_disabled`, `no_device`, codice di rifiuto) è `037:bloccante` con `difetto_di` 031 o
      033, salvo un errore esterno dichiarato. `no_device` con login e permesso dichiarati punta
      alla registrazione del token (033).
- [ ] F3 Il commento dice se la notifica è arrivata con titolo «Anna ti sollecita» e testo
      «Prova notifica 037» (SPEC §8) e se il tocco apre il task. Dato a parte, come dice il
      traguardo: non entra nel verdetto; un testo diverso da §8 si annota come difetto `037:maggiore`
      (`difetto_di` 035).
- [ ] F4 Il JSON non contiene token né chiavi (solo le cinque chiavi): se le contiene,
      `037:bloccante` (`difetto_di` 036) e il commento va nascosto.

### Esito
T10 è `passato` se sono verdi V1–V6 (V3 e V5 o i loro ripieghi dichiarati), S1–S2, P0–P6, R1–R3
e F2. Un rosso è un difetto `037:<gravità>` con `difetto_di` il giro che l'ha costruito (031–036),
e T10 resta `in-corso`. Sono `bloccante`: un 2xx in P3, P4, P6 o R3; un secondo sollecito accettato
in P5; F2 rosso; `push_disabled` in R1. Un atteso sbagliato del piano si scrive come «atteso del
piano», non come difetto. Con la risposta B alla richiesta: esito `non-passato` per F2 mancante.

## Fuori perimetro
- Qualsiasi riga di codice, test, configurazione, workflow o script del repository. Gli script di
  prova vivono in `/tmp/giro-037/` e si cancellano.
- Difetti e dubbi già noti, non trasformati in difetti nuovi: `due_at > now` in `deletePending`
  (032, maggiore); token che resta dopo il logout (SPEC §9); query `titleOf`/`nameOf`/`words` senza
  filtro di famiglia (dubbio 035); dubbi 033 e 036. Restano nel rapporto come «noti».
- Promemoria automatici inviati ad orario reale in produzione (si provano con orologio iniettato
  in V2; in R1 si controlla solo che siano pianificati).
- Il segno «sollecitato» provato con Playwright contro produzione (vale V3 in locale).
- Il testo lungo a schermo bloccato e le altre prove del telefono oltre F1–F3.
- Pulizia degli account di prova (005–034, 037). Prove di carico.
- T1–T9, già `passato`.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; verifica dell'email e recupero della
  password; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: è un giro di verifica.

## Porte
- Doppio senso previste: nessuna nel repository.
- Senso unico: nessuna nuova. Le scritture di prova (3 account, 2 famiglie, 2 task inventati,
  1 sollecito, 1 modifica di scadenza) sono coperte dalla decisione 42; la prova del telefono è la
  parte umana già decisa con la decisione 111 (richiesta in testa).

## Rischi di concorrenza
- P5 va eseguito entro 5 minuti da P2; se passano più di 5 minuti il 200 non è un difetto: si
  annotano gli orari e si ripete P2–P5 (R1 allora si aspetta due righe `NUDGE`).
- P2 e R2 alzano `version`: le scritture successive su T1 leggono la `version` nuova.
- R2 dopo il ricalcolo: una lettura subito dopo il PUT deve già vedere le righe nuove (stessa
  transazione); righe vecchie e nuove insieme sono un difetto `037:maggiore` (`difetto_di` 032).
- Il secondo sollecito dell'umano (passo 4) vale solo dopo 5 minuti: un 429 prima è atteso.
- Un merge su `main` durante il giro cambia la versione: S1 ripetuto alla fine lo mostra; in quel
  caso si rifà la verifica sul nuovo SHA.

## Budget
0 righe di codice. File scritti: `037-piano.md`, `037-rapporto.md`, `PROGRESS.md` e i campi
`stato`, `giri`, `pr`, `passato_il` di T10 in `traguardi.json`. Temporanei solo in `/tmp/giro-037/`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Uno script riusabile per le verifiche in produzione (`scripts/verifica/`).
- Un reset del demo che cancelli gli account `verificaNNN.*`.
