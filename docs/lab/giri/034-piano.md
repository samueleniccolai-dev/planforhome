---
giro: 034
traguardo: T10
traguardi_extra: []
tipo: verifica-produzione
fase: piano
inizio: 2026-10-23T10:13:56Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 034 — verifica in produzione di T10 (promemoria e solleciti)

## DOMANDA per l'umano (il giro si ferma qui fino alla risposta)

**Contesto.** Il «Fatto quando» di T10 chiede, in produzione, di «inviare una notifica a un
dispositivo di prova registrato e trovare in `reminder.result` l'identificativo del messaggio
restituito da FCM». Due cose la catena non le può fare da sola:
1. **Un dispositivo registrato davvero.** Serve un telefono con l'APK, con login e permesso
   accettato: solo così il server ha un token FCM vero. Un token inventato registrato con `curl`
   viene rifiutato da FCM (`400 INVALID_ARGUMENT`) e non produce nessun identificativo. L'app non
   ha una schermata di registrazione: sul telefono si entra solo con un account che esiste già.
2. **Leggere `reminder.result`.** Nessuna API lo espone (sta solo nel database) e il server non
   scrive nel log l'identificativo di un invio riuscito (`FcmClient`, `PushService`). La regola 7
   vieta agli agenti ogni comando sui server.

**Opzioni.**

| | Cosa | Pro | Contro |
|---|---|---|---|
| **A** | Prova del telefono e una query in sola lettura, fatte da te (≈ 15 minuti, passi sotto). Il resto della verifica lo fa il giro da fuori. | Nessuna riga di codice; T10 può passare in questo giro. | Tempo umano; la query sul server è un atto manuale (in sola lettura). |
| B | Prima un giro `costruzione` piccolo: `GET /api/families/{f}/tasks/{t}/reminders` per i gestori (kind, `sentAt`, `result`), con test di isolamento. Poi la verifica: tu fai solo la parte del telefono e apri l'URL dal browser come Anna. | Prova ripetibile senza accesso al server; utile alla caccia finale. | Un giro in più; espone l'esito degli invii ai gestori (da decidere se lo si vuole). |
| C | Togli il controllo su `reminder.result` dal «Fatto quando» (PR umana su `traguardi.json`): valgono i test con FCM finto e la tua dichiarazione nel modulo. | Il più rapido. | Indebolisce il traguardo; nessuna prova che FCM risponda in produzione. |

**Raccomandazione: A.** Zero codice, la query non scrive nulla e la prova del telefono serve
comunque (PROGRESS, «Per l'umano»).

**Passi per A** (dati demo di SPEC Appendice A, Famiglia Mamma: Anna gestore, Luca membro):
1. Installa l'APK dell'artefatto di V5 (`planforhome-0.1.0-9683458…`, run consegna 39936987089).
2. Sul telefono: login come **Luca**; accetta il permesso delle notifiche; chiudi l'app.
3. Sul web (`https://app.planforhome.com`) come **Anna**: crea in Famiglia Mamma il task
   «Prova notifica 034», assegnato a Luca, scadenza 30/11/2026; premi «Sollecita».
4. Sul telefono: la notifica «Anna … ti sollecita» · «Prova notifica 034» nel canale «Promemoria»;
   toccala ad app chiusa → si apre il task. Rifallo dopo 5 minuti ad app aperta.
5. Sul server, in sola lettura (servizio del database di `infra/docker-compose.yml`):
   `select kind, sent_at, left(result, 60) from reminder where task_id = (select id from task where title = 'Prova notifica 034') order by sent_at;`
6. Incolla nella PR, in un commento: l'esito dei passi 2–4 (sì/no per ciascuno) e le righe del
   passo 5. Il `result` atteso è il `name` restituito da FCM, `projects/<progetto>/messages/<id>`: incolla solo
   quello, mai token o chiavi.

**Dopo ogni risposta.**
- A → il giro riprende: esegue i controlli qui sotto da fuori, legge il tuo commento (controlli
  F1–F3) e scrive il rapporto; T10 `passato` se tutto è verde.
- B → questo giro si chiude senza verdetto; il 035 è `costruzione` dell'endpoint (porta a doppio
  senso, nessuna dipendenza), il 036 la verifica.
- C → aspetto la tua PR su `traguardi.json`; poi questo piano senza F2.

## Fetta e traguardo
T10, tipo `verifica-produzione`: il rapporto 033 dice «Fatto quando verde, da verificare in
produzione», la PR #47 è mergiata in `9683458`, il deploy è verde. Nessun codice.
Fonti: SPEC §2.2.9, §5 (riga P12), §8; `traguardi.json` → T10; rapporti 031–033.

Riferimenti fissati al momento del piano (2026-10-23T10:15Z):
- `$SHA` = `9683458d39a51ee1d2ac2fdd9f363b726873a772` (merge della PR #47);
  `GET /api/health` → `{"status":"UP","sha":"9683458d39a51ee1d2ac2fdd9f363b726873a772"}`.
- `$RUN_CONSEGNA` = 39936987089: `controllo`, `immagine`, `pubblica`, `deploy`, `avanti` in
  `success`, `decidi` `skipped`; **`apk` ancora in corso**.
- `$RUN_CI_PR` = 39933655134 (`ci` sul branch `claude/giro-033-t10`, `45fecdb`): `success`.
- Scritture di prova in produzione: coperte dalla **decisione 42**.

## Fatto quando — controlli eseguibili

### Regole per le prove da fuori (come nel giro 029)
- `curl` e `jq` verso `https://app.planforhome.com`, login con `client:"android"`. Nessun comando
  sui server. Gli account demo li usa solo l'umano (passi di A).
- Account inventati `verifica034.<epoch>.<x>@example.com`, `<x>` = `a`, `b`, `c`, locale `it`;
  password generate in `/tmp/giro-034/` (`openssl rand -base64 18`), mai stampate; la cartella si
  cancella a fine giro. UUIDv7 generati al momento, annotati nel rapporto.
- Tre registrazioni, un codice d'invito, nessun login sbagliato; sequenza eseguita una volta.
  Un errore esterno (rete, proxy, 429 di registrazione) si dichiara e non è un difetto.

### Persone di prova (inventate)
| Chi | Come nasce | Ruolo |
|---|---|---|
| A, «Verifica A» | registrazione con `familyName: "Famiglia Verifica 034"` (F) | gestore di F |
| B, «Verifica B» | registrazione con un codice d'invito di F | membro di F |
| C, «Verifica C» | registrazione con `familyName: "Famiglia Verifica 034 Altra"` (FX) | non in F |

### V. CI, test in locale, APK
- [ ] V1 `gh run view 39933655134 --json jobs` → `server`, `app`, `apk` in `success`.
      `git ls-tree -r --name-only 9683458` contiene `Giro031*AcceptanceTest.java`,
      `Giro032Reminder{Schedule,Send,Recalc}AcceptanceTest.java`, `Giro033ChannelAcceptanceTest.java`,
      `app/e2e/acceptance/giro-031-nudge.spec.ts`, `giro-033-push-{android,web}.spec.ts`.
- [ ] V2 In locale su `9683458`: `cd server && ./mvnw -q -Dtest='Giro03[123]*AcceptanceTest' test`
      → verde. Il rapporto cita un metodo per ciascun pezzo lato server del «Fatto quando»:
      anticipo DATETIME e 9:00 DATE; scadenza e 18:00 DATE; slittamento alle 7:00; 21:45 della
      sera prima; referente nella sua lingua per una risorsa senza account; ricalcolo per scadenza,
      assegnatario, famiglia e stato; task in coda scaduto ai gestori; P12 permesso e vietato;
      secondo sollecito entro 5 minuti rifiutato; payload con `taskId` e testo in italiano e in
      inglese; token rifiutato cancellato. Un pezzo senza metodo è un difetto `034:maggiore`.
- [ ] V3 In locale: `cd app && npm test && npx playwright test e2e/acceptance/giro-031-* e2e/acceptance/giro-033-*`
      → verde; il rapporto cita il test del segno «sollecitato» con l'ora sul web. Senza Docker o
      browser valgono V1 e la run CI, dichiarandolo.
- [ ] V4 `$RUN_CONSEGNA`: job `deploy` («Deploy and smoke test») in `success`.
- [ ] V5 Ultimo APK: in `$RUN_CONSEGNA` job `apk` in `success` e un artefatto APK con `9683458`
      nel nome, dimensione > 0, non scaduto (`gh api …/runs/39936987089/artifacts`). Se il job è
      ancora in corso si attende con un controllo a intervalli; se fallisce, `034:maggiore`.
- [ ] V6 Permesso nell'APK: `gh run download 39936987089 -n <artefatto> -D /tmp/giro-034/apk`, poi
      `python3 -I` con `zipfile` legge `AndroidManifest.xml` e cerca la stringa
      `android.permission.POST_NOTIFICATIONS` codificata UTF-16LE (formato binario del manifest)
      → presente. Nessun binario nuovo (niente `aapt`). Assente = difetto `034:maggiore`
      (`difetto_di` 033).

### S. Da fuori, senza login
- [ ] S1 `curl -sS https://app.planforhome.com/api/health` → 200 con `"sha":"9683458d39a51ee1d2ac2fdd9f363b726873a772"`.
      Ripetuto alla fine.
- [ ] S2 `POST /api/families/{UUIDv7}/tasks/{UUIDv7}/nudge` e `POST /api/me/devices` senza token
      → 401.

### P. Sollecito P12 in produzione (account di prova)
- [ ] P0 Preparazione: A e C si registrano e fanno login; A genera un codice d'invito di F; B si
      registra con il codice e fa login. Se un passo fallisce, la sequenza si ferma.
- [ ] P1 A crea in F `T("Ritirare le analisi")`, DATETIME `2026-11-20T10:00:00Z`, assegnato a B;
      e `T("Portare la bici dal meccanico")`, DATE `2026-11-21`, **in coda**.
- [ ] P2 Permesso: A `nudge` su «Ritirare le analisi» → 200; il task ha `lastNudgedAt` non nullo
      e `version` + 1.
- [ ] P3 Vietato (ruolo): B `nudge` sullo stesso task → 403 `forbidden`.
- [ ] P4 Vietato (in coda): A `nudge` su «Portare la bici dal meccanico» → 409 `not_assigned`.
- [ ] P5 Entro 5 minuti: A `nudge` di nuovo su «Ritirare le analisi», `mutationId` nuovo →
      429 `nudge_too_soon`; `lastNudgedAt` invariato. Lo stesso `mutationId` di P2 → 2xx senza
      effetto (replay), `lastNudgedAt` invariato.
- [ ] P6 Isolamento: C `nudge` su «Ritirare le analisi» (con l'`id` di F nell'URL) → 404, corpo
      identico (`cmp`) a quello di una famiglia inesistente; `lastNudgedAt` invariato.

### F. Telefono e `reminder.result` (dal commento dell'umano, opzione A)
- [ ] F1 Il commento dichiara login e permesso accettato sul telefono (passo 2). Dato a parte.
- [ ] F2 Il commento riporta almeno una riga `NUDGE` per «Prova notifica 034» con `sent_at`
      valorizzato e `result` della forma `projects/<progetto>/messages/<id>` (il `name` della risposta 200 di FCM,
      `FcmClient.outcome`) → verde. Un `result` diverso (`error:…`, `push_disabled`, codice di rifiuto) è un difetto `034:bloccante`
      con `difetto_di` 031, salvo un errore esterno dichiarato.
- [ ] F3 Il commento dice se la notifica è arrivata e se il tocco apre il task (passo 4). È un dato
      a parte, come dice il traguardo: non entra nel verdetto.

### Esito
T10 è `passato` se sono verdi V1–V6 (V3 e V5 o i loro ripieghi dichiarati), S1–S2, P0–P6 e F2.
Un rosso è un difetto `034:<gravità>` con `difetto_di` il giro che l'ha costruito (031–033), e
T10 resta `in-corso`. Sono `bloccante`: un 2xx in P3, P4 o P6; un secondo sollecito accettato in
P5; F2 rosso. Un atteso sbagliato del piano si scrive come «atteso del piano», non come difetto.

## Fuori perimetro
- Qualsiasi riga di codice, test, configurazione, workflow o script del repository. Gli script di
  prova vivono in `/tmp/giro-034/` e si cancellano.
- Difetti e dubbi già noti, non trasformati in difetti nuovi: `due_at > now` in `deletePending`
  (032, maggiore); token che resta dopo il logout (SPEC §9); nome della risorsa nella notifica
  (SPEC §8 contro decisione 106); dubbi 2–4 del revisore 033; M4 senza test. Restano nel rapporto
  come «noti».
- Promemoria automatici in produzione ad orario reale (si provano con orologio iniettato in V2):
  aspettare una scadenza vera non sta in una sessione.
- Il segno «sollecitato» provato con Playwright contro produzione (vale V3 in locale).
- Pulizia degli account di prova (005–029, 034). Prove di carico.
- T1–T9, già `passato`.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; verifica dell'email e recupero della
  password; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: è un giro di verifica.

## Porte
- Doppio senso previste: nessuna nel repository.
- Senso unico: **DOMANDA** in testa (come ottenere un dispositivo registrato e leggere
  `reminder.result` senza comandi degli agenti sul server). Le scritture di prova (3 account,
  2 famiglie, 2 task inventati, 1 sollecito) sono coperte dalla decisione 42.

## Rischi di concorrenza
- P5 va eseguito entro 5 minuti da P2 (subito dopo P3–P4); se passano più di 5 minuti, il 200 non
  è un difetto: si annotano gli orari e si ripete P2–P5.
- P2 alza `version`: le scritture successive su quel task leggono la `version` nuova.
- Il passo 4 di A (secondo sollecito dopo 5 minuti) vale solo se l'umano aspetta: un 429 lì è
  atteso, non un difetto.
- Un merge su `main` durante il giro cambia la versione: S1 ripetuto alla fine lo mostra; in quel
  caso si rifà la verifica sul nuovo SHA.

## Budget
0 righe di codice. File scritti: `034-piano.md`, `034-rapporto.md`, `PROGRESS.md` e i campi
`stato`, `giri`, `pr`, `passato_il` di T10 in `traguardi.json`. Temporanei solo in `/tmp/giro-034/`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- L'endpoint di sola lettura dell'opzione B, utile anche alla caccia.
- Uno script riusabile per le verifiche in produzione (`scripts/verifica/`).
- Un reset del demo che cancelli gli account `verificaNNN.*`.
