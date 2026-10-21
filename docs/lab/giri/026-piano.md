---
giro: 026
traguardo: T9
traguardi_extra: []
tipo: costruzione
fase: costruzione
inizio: 2026-10-21T21:18:43Z
ricerca: sì
accettazione: 9cd3f81
ripreso: no
---
# Piano del giro 026 — T9 parte 3: sessione Android e motore di sync cablato

## DOMANDA — RISPOSTA: opzione A (21/10, decisione 87)

(porta a senso unico: dipendenza npm nuova)

**Contesto.** Il cablaggio del motore su Android ha bisogno di una sessione su Android, che oggi
non esiste: il login manda sempre `client: "web"`, `call()` usa percorsi relativi e il CSRF letto
da `document.cookie` (decisione 21; rapporti 003, 004 e 005: «porta: `expo-secure-store`»). Il
server è già pronto: con un `client` diverso da `web` il login restituisce il token opaco nel corpo,
e `BearerTokenFilter` lo accetta (decisioni 11 e 20). SPEC §9 chiede per Android un token «salvato
in modo sicuro (archivio cifrato di Expo)». Senza un token conservato, il telefono non può
sincronizzare dopo un riavvio dell'app, quindi la coda offline non arriva mai al server.

| Opzione | Cosa | Pro | Contro |
|---|---|---|---|
| A | `expo-secure-store`, versione dell'SDK 58 (`~58.0.x`, fissata da `npx expo install expo-secure-store`), usata solo su Android | modulo ufficiale Expo, è l'«archivio cifrato di Expo» di SPEC §9 (Android Keystore); nessun config plugin necessario su Android; segue l'SDK con Dependabot | modulo nativo in più nell'APK; tocca `app/package.json` e il lock (revisione umana); in Jest e Playwright va sostituito da un archivio finto dietro un'interfaccia |
| B | Token in una tabella di `expo-sqlite` (già presente), in chiaro | nessuna dipendenza nuova | contraddice SPEC §9 («in modo sicuro»); il token vale 30 giorni |
| C | Token solo in memoria | nessuna dipendenza, nessun dato sul disco | login a ogni avvio; la coda offline resta ferma finché l'utente non rientra; già scartato (decisione 21) |

**Raccomandazione: A.** È quello che SPEC §9 descrive e che i giri 003–005 hanno già indicato.
Versione: quella che `npx expo install` fissa per l'SDK 58. Alternativa: nessuna valida senza
cambiare SPEC §9.

**Cosa succede dopo ogni risposta.**
- **A:** il giro prosegue con la fetta qui sotto; la PR va in revisione umana per
  `app/package.json` e `app/package-lock.json`.
- **B:** serve prima una PR umana su SPEC §9; il giro si ferma.
- **C:** la fetta perde la sessione persistente: il motore parte solo dopo un login nella stessa
  esecuzione; la coda sopravvive su SQLite ma parte solo dopo il login successivo. Il resto del
  piano non cambia.

Nessuna domanda per la rilevazione della rete: niente `@react-native-community/netinfo` (sarebbe
un'altra porta). Il «ritorno della rete» si copre con il ciclo ogni 60 s in primo piano e il ritorno
in primo piano (`AppState`, già in React Native). Porta a doppio senso, decisione da registrare.

## Fetta e traguardo
T9 parte 3 (costruzione): sessione Android con token, ciclo di vita del motore di sync (avvio, dopo
ogni scrittura, ogni 60 s in primo piano, ritorno in primo piano, logout con `clear()`) e lista della
spesa offline su Android (spunte e voci nuove passano dalla coda). È la parte più piccola che rende
visibile l'offline sul telefono. Fonti: SPEC §4, §7, §9; piani 024 e 025; decisioni 11, 20, 21, 22.

**Cosa resta di T9 dopo questo giro:** schermate dei task su Android via coda (crea, assegna,
prendi, fatto, inoltra), avviso discreto per i task, prova dell'APK su telefono; poi
verifica-produzione.

## Progetto (i nomi dei tre moduli sotto «Contratti» sono fissati dai test; il resto è libero)
1. `src/api/tokenSession.ts` (puro, nessun import di `react-native` o `expo-*`):
   `createTokenSession({ vault, fetch, baseUrl, timers, timeoutMs })`. Il vault salva
   `{ token, personId }` (dal corpo del login: `LoggedIn(token, expiresAt, personId)`). Login con
   `client: "android"`. `http` è l'adattatore del motore: URL assoluto `baseUrl + path`,
   `Authorization: Bearer`, niente CSRF (decisione 20), `credentials: "omit"`, `AbortController`
   con `timeoutMs` (15 s nell'app); rifiuta **solo** per errore di rete o timeout; una risposta con
   corpo non JSON (502 HTML) è `{ status, body: null }` (quindi `retry`). Senza credenziali risponde
   401 senza rete. `logout()` cancella subito il vault, scarta le risposte ancora in volo (l'adattatore
   rifiuta) e tenta il logout sul server **senza aspettarlo**.
2. `src/api/vault.native.ts` / `vault.web.ts` (o simili): su Android `TokenVault` su
   `expo-secure-store` (una chiave, JSON); sul web nessun vault. `get()` che lancia → nessun token e
   voce cancellata (lo fa `current()` di `tokenSession`). Base dell'API da `EXPO_PUBLIC_API_URL`
   (predefinita `https://app.planforhome.com`). Il web resta su `client.ts` con cookie e CSRF.
3. `src/sync/session.ts` (puro): `createSyncSession({ engine, auth, timers, appState,
   onUnauthorized })` con `start()`, `afterWrite()`, `stop()`, `signIn()`, `signOut()`:
   - `start()` senza credenziali non fa nulla; con credenziali un ciclo subito e un intervallo di
     60 s solo in `active` (`currentState ?? "active"`); `start()` ripetuto non raddoppia nulla;
   - `afterWrite()` durante un ciclo segna «sporco»: a fine ciclo parte **un solo** ciclo in più,
     subito;
   - `unauthorized`: ferma timer e ascolto di `AppState`, chiama `onUnauthorized` una volta, non
     tocca archivio, coda né vault (il `personId` resta per il confronto);
   - `signIn()`: se il `personId` salvato prima differisce da quello nuovo (o non c'è),
     `engine.clear()` **prima** di `start()`;
   - `signOut()`: stop, `auth.logout()`, attesa del ciclo in volo al più 5 s, `engine.clear()`;
     non aspetta mai il server.
4. `src/shopping/queued.ts` (puro): `checkItemMutation` (`PUT …/items/{i}/checked`
   `{ checked }`, patch `{ checked }`) e `addItemMutation` (`POST …/items` `{ id, text }`, patch
   `{ taskId, text, checked: false }`).
5. Layout radice: su Android apre `openSqliteStore()`, crea motore e sessione, `start()` all'avvio
   (decisione 22). Sul web nulla cambia.
6. Lista della spesa su Android, in un hook separato (`useOfflineList` o simile; `ShoppingList.tsx`
   ha già 413 righe e non deve crescere di molto):
   - titolo, ruolo, voci e «me» da `engine.rows(familyId)` e dal `personId` salvato: nessuna
     chiamata all'API all'apertura; un errore di rete non porta **mai** a `/login` (solo
     `onUnauthorized` lo fa);
   - «spunta» e «aggiungi» = `enqueue` + `afterWrite()`;
   - le altre azioni (togli, ripristina, svuota spuntate, riordina) restano dirette all'API, sono
     disabilitate con etichetta se l'ultimo ciclo è `offline` **o** se c'è una mutazione in coda per
     quel task; dopo un'azione diretta, `afterWrite()` e rilettura da `engine.rows()`;
   - avvisi: `conflict`/`notFound`/`invalid` → `list.stale`; `forbidden` → `list.forbidden`.
7. `home`: il link «Accedi» compare anche su Android; il login su Android usa `signIn()`.

## Dati demo
Quelli dei giri 024–025: famiglie Rossi (`…00f1`, Anna MANAGER, Luca MEMBER) e Bianchi-Verdi
(`…00f2`, Anna MEMBER); task «Spesa sabato» (`…0101`) con voci latte (`…0201`), pane (`…0202`),
uova (`…0203`); «Pagare la bolletta della luce» (`…0102`); «Portare il cane dal veterinario»
(`…0103`). Utenti `anna@demo.test`, `luca@demo.test`. Token finto `tok-anna-demo`.

## Fatto quando — controlli eseguibili
- [ ] `cd app && npx playwright test e2e/acceptance/giro-026-*` → tutti verdi (Node, senza pagina,
  con rete finta e orologio finto):
  - S1 login Android di Anna → `client: "android"`, vault `{ tok-anna-demo, personId }`, richieste
    successive assolute con `Authorization: Bearer tok-anna-demo`, senza `X-CSRF-Token`, tutte con
    `credentials: "omit"`; S1b password errata → `invalid`, vault vuoto, nessuna sync;
  - S2 avvio con token nel vault → un ciclo subito, poi uno ogni 60 s solo in `active`; in
    `background` nessuno; ritorno in `active` → uno subito; S2b `start()` due volte → un ciclo e un
    solo intervallo; S2c `currentState` null → come `active`; S2d vault che lancia in `get()` →
    nessuna richiesta, voce cancellata; S2e `stop()` → nessun ciclo dopo;
  - S3 [memoria e SQLite] rete giù: Anna spunta latte e pane e aggiunge «caffè» → righe locali
    aggiornate, nulla applicato; rete su al tick dei 60 s → le tre modifiche applicate una volta, in
    ordine; il ciclo dopo non rimanda nulla;
  - S4 tre `afterWrite()` durante un ciclo fermo su `/api/families` → **esattamente** un ciclo in
    più, subito (orologio fermo), modifica applicata una volta;
  - S5 401 → `onUnauthorized` una volta, archivio, coda e vault invariati, nessuna richiesta dopo;
    S5b poi Luca accede → archivio e coda di Anna cancellati prima della sua sync, la modifica di
    Anna non parte mai col token di Luca; S5c poi Anna rientra → la sua coda parte col token nuovo;
  - S6 [memoria e SQLite] logout di Anna con una modifica in coda e rete giù → archivio, coda,
    cursori e vault vuoti, nessuna richiesta dopo (neanche col ritorno in `active`); Luca dopo non
    vede nulla di Anna; S6b rete che non risponde mai → `signOut()` si risolve senza muovere
    l'orologio, logout sul server tentato col token di Anna; S6c ciclo fermo su `/changes` →
    `signOut()` si risolve entro 5 s e la risposta tardiva non riscrive nulla;
  - H1 richiesta senza risposta → interrotta dopo `timeoutMs` (segnale abortito), esito `offline`;
    H2 502 con corpo HTML → esito `retry`, non `offline`.
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi, con i test Jest nuovi del
  costruttore: hook della lista su Android con motore finto (apertura senza API, rete giù senza
  `/login`, azioni dirette disabilitate offline e con mutazione in coda, mappa degli avvisi).
- [ ] `cd app && npx playwright test` → tutto verde: il web resta online e invariato (login con
  cookie e CSRF già coperto da `giro-004-login` e dai test con API finta).
- [ ] Job `apk` della CI verde (la build Android include `expo-secure-store`).
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → solo la revisione
  umana attesa (`app/package.json`, `app/package-lock.json`).
- [ ] Prova a mano sull'APK (per l'umano, nel rapporto): login di Anna, modalità aereo, spunta di
  latte, rete su, la spunta compare sul web entro 60 s; poi app chiusa e riaperta già in modalità
  aereo con la lista aperta → la lista si vede, nessun passaggio a `/login`.

## Fuori perimetro
- Schermate dei task su Android via coda; avviso discreto dei task: giro dopo.
- Rilevazione della rete con NetInfo o `expo-network` (porta a senso unico; non serve ora).
- Modifiche al server (il login con token esiste già).
- `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario; accesso Google o
  Apple, iPhone, Play Store; email; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `app/e2e/acceptance/giro-026-android-session.spec.ts` | S1–S6c, H1, H2 qui sopra (19 test), con il server finto del giro 025 copiato ed esteso in `giro-026-fake-sync-server.ts` (`fetch` con token, login, logout, `down`, `hang`, `hold`, aggiunta di voci); orologio, `AppState` e vault finti; moduli di produzione caricati a run time |

### Contratti per i test
- `src/api/tokenSession.ts` → `createTokenSession({ vault, fetch, baseUrl, timers, timeoutMs })`
  → `{ login(email, password): Promise<'ok'|'invalid'|'tooMany'|'error'>, current():
  Promise<{ token, personId } | undefined>, http: Http, logout(): Promise<void> }`.
- `TokenVault` = `{ get(): Promise<{ token, personId } | null>, set(c), clear() }`.
- `timers` = `{ setTimeout, clearTimeout, setInterval, clearInterval }` (nell'app quelli globali);
  `appState` = forma di `AppState` di React Native (`currentState`, `addEventListener('change')`
  → `{ remove() }`).
- `src/sync/session.ts` → `createSyncSession({ engine, auth, timers, appState, onUnauthorized })`
  → `{ start(), afterWrite(), stop(), signIn(email, password), signOut() }`; intervallo 60 s,
  attesa massima del ciclo in `signOut()` 5 s.
- `src/shopping/queued.ts` → `checkItemMutation({ familyId, taskId, itemId, checked })`,
  `addItemMutation({ familyId, taskId, itemId, text })` → `MutationInput`.
- I tre moduli non importano `react-native` né `expo-*` al caricamento (i test girano in Node).

## Porte
- Doppio senso previste: variabile `EXPO_PUBLIC_API_URL` con predefinita; intervallo 60 s e
  `AppState` al posto di NetInfo; azioni della lista non in coda disabilitate offline.
- Senso unico: **DOMANDA** in testa (`expo-secure-store`).

## Rischi di concorrenza
- Timer, `AppState` e `afterWrite()` insieme: `sync()` serializza, il flag «sporco» evita sia i
  doppioni sia l'attesa di 60 s (S4); `start()` ripetuto non crea un secondo intervallo (S2b).
- Logout durante un ciclo: `signOut()` aspetta il ciclo al più 5 s; le risposte che arrivano dopo
  `logout()` vengono scartate dall'adattatore, così nessuna riga torna dopo la pulizia (S6c).
- Cambio di persona dopo un 401: `engine.clear()` prima del primo ciclo della persona nuova (S5b).
- Doppio tocco su «spunta» offline: due `enqueue` con `mutation_id` diversi, entrambi idempotenti;
  l'ultimo vince sul server (ordine della coda).

## Budget
Righe di produzione (`app/src`, `app/app`) ≤ 650; file ≤ 12; una sessione. Il percorso Android
della lista sta in un hook a parte; `ShoppingList.tsx` cresce al più di 40 righe.

## Domande per il ricercatore (al massimo 3)
1. `expo-secure-store` con SDK 58 su Android: API (`getItemAsync`/`setItemAsync`/`deleteItemAsync`),
   limiti di dimensione, serve un config plugin? Comportamento dopo reinstallazione e backup automatico.
2. `fetch` di React Native 0.88 su Android: salva da solo i cookie `Set-Cookie`? (Se sì, il login
   Android non deve ricevere cookie, o vanno ignorati.)
3. `AppState` su Android con Expo SDK 58: eventi affidabili per `active`/`background`, e timer JS
   sospesi in background?

## Critica ricevuta e cosa cambia
Accolto:
- (1) 401 e cambio di persona: il vault salva `{ token, personId }`; `signIn()` cancella l'archivio
  se la persona cambia, prima di `start()`. Test S5b e S5c.
- (2) `afterWrite()` durante un ciclo: flag «sporco», un solo ciclo in più subito. S4 ora chiede
  esattamente un ciclo in più senza muovere l'orologio.
- (3) Lista su Android: dati da `engine.rows()` e `personId` salvato, errore di rete mai a
  `/login`. Prova a mano con la lista aperta in modalità aereo, test Jest dell'hook.
- (4) `signOut()` appeso: timeout con `AbortController` nell'adattatore (H1); `signOut()` cancella
  subito in locale e tenta il logout sul server senza aspettarlo (S6b); ciclo in volo (S6c).
- (5) Azioni dirette disabilitate anche con mutazioni in coda per il task; rilettura da
  `engine.rows()` dopo le ricariche (test Jest).
- Moduli puri con vault, timer e `AppState` iniettati (nessun `expo-secure-store` né `Platform` nei
  test Node); vault per piattaforma (`.native`/`.web`).
- Mappa degli avvisi `conflict`/`notFound`/`invalid` → `list.stale`, `forbidden` →
  `list.forbidden`.
- Test di concorrenza e mancanti: S2b, S2c, S2d; budget con hook separato.
- Facoltativi: `credentials: "omit"` (in S1) e 502 HTML = `retry` (H2).

Non accolto / cambiato:
- S7 (web in Node) tolto: importare `client.ts` in Node renderebbe fragile il test se il
  costruttore aggiunge import di piattaforma; il web è già coperto dai test Playwright esistenti con
  pagina (`giro-004-login` e successivi), che restano nel «Fatto quando».
- Il test Jest della schermata resta al costruttore (test unitari), non di accettazione: la
  schermata non si carica in Node senza React Native.

## Idee per dopo
- Rilevazione della rete con NetInfo per sincronizzare subito al ritorno della rete.
