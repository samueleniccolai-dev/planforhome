---
giro: 026
traguardo: T9
traguardi_extra: []
tipo: costruzione
fase: piano
inizio: 2026-10-21T21:18:43Z
ricerca: sì
accettazione:
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

## Progetto (indicativo; il costruttore sceglie i nomi)
1. `src/api/session.ts`: interfaccia `TokenVault` (`get`, `set`, `clear`); su Android
   `expo-secure-store`, sul web nessun token (restano i cookie). `call()` su Android usa la base
   dell'API da `EXPO_PUBLIC_API_URL` (predefinita `https://app.planforhome.com`) e l'header
   `Authorization: Bearer`; niente CSRF con il Bearer (decisione 20). Login con `client: "android"`.
2. `src/sync/session.ts`: `createSyncSession({ engine, timer, appState })` con `start()`,
   `afterWrite()`, `stop()`, `signOut()`. Un solo ciclo per volta (lo garantisce già `sync()`);
   intervallo 60 s solo con `AppState` `active`; `unauthorized` ferma il timer e porta al login
   senza toccare archivio e coda; `signOut()` = stop, logout sul server, `engine.clear()`,
   `vault.clear()`, anche se la rete manca.
3. Layout radice: su Android apre `openSqliteStore()`, crea motore e sessione, `refresh()` all'avvio
   (decisione 22). Sul web nulla cambia.
4. Lista della spesa su Android: legge `engine.rows(familyId)` filtrate per `taskId`; «spunta» e
   «aggiungi» fanno `enqueue` + `afterWrite()`; le altre azioni (togli, ripristina, svuota spuntate,
   riordina) restano dirette all'API, seguite da `afterWrite()`, e sono disabilitate con etichetta
   se il ciclo è `offline`. `SyncNotice` della lista → avviso esistente `list.stale`/`list.forbidden`.
5. `home`: il link «Accedi» compare anche su Android.

## Dati demo
Quelli dei giri 024–025: famiglie Rossi (`…00f1`, Anna MANAGER, Luca MEMBER) e Bianchi-Verdi
(`…00f2`, Anna MEMBER); task «Spesa sabato» (`…0101`) con voci latte (`…0201`), pane (`…0202`),
uova (`…0203`); «Pagare la bolletta della luce» (`…0102`); «Portare il cane dal veterinario»
(`…0103`). Utenti `anna@demo.test`, `luca@demo.test`. Token finto `tok-anna-demo`.

## Fatto quando — controlli eseguibili
- [ ] `cd app && npx playwright test e2e/acceptance/giro-026-*` → tutti verdi (Node, senza pagina,
  con rete finta e orologio finto):
  - S1 login Android di Anna → richiesta con `client: "android"`, token nel vault, richieste
    successive con `Authorization: Bearer tok-anna-demo` e senza `X-CSRF-Token`;
  - S2 avvio con token nel vault → un ciclo di sync subito, poi uno ogni 60 s solo in `active`;
    in `background` nessun ciclo; ritorno in `active` → un ciclo subito;
  - S3 rete giù: Anna spunta latte e pane e aggiunge «caffè» → righe locali spuntate, nessuna
    richiesta riuscita; rete su al tick dei 60 s → il server riceve le tre modifiche in ordine, una
    volta sola, e un secondo ciclo non le rimanda;
  - S4 `afterWrite()` durante un ciclo → al più un ciclo in più, nessun doppione;
  - S5 401 dal server → timer fermo, archivio e coda identici, esito `unauthorized`;
  - S6 logout di Anna con una modifica in coda e rete giù → archivio vuoto (righe, coda, cursori),
    vault vuoto, nessun ciclo dopo; il login di Luca dopo non vede nulla di Anna (isolamento);
  - S7 web: `call()` resta su percorsi relativi, cookie e CSRF, senza `Authorization`.
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi.
- [ ] `cd app && npx playwright test` → tutto verde (il web resta online e invariato).
- [ ] Job `apk` della CI verde (la build Android include `expo-secure-store`).
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → solo la revisione
  umana attesa (`app/package.json`, `app/package-lock.json`).
- [ ] Prova a mano sull'APK (per l'umano, nel rapporto): login di Anna, modalità aereo, spunta di
  latte, rete su, la spunta compare sul web entro 60 s.

## Fuori perimetro
- Schermate dei task su Android via coda; avviso discreto dei task: giro dopo.
- Rilevazione della rete con NetInfo o `expo-network` (porta a senso unico; non serve ora).
- Modifiche al server (il login con token esiste già).
- `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario; accesso Google o
  Apple, iPhone, Play Store; email; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `app/e2e/acceptance/giro-026-android-session.spec.ts` | S1–S7 qui sopra, con il server finto del giro 025 (copiato in `giro-026-fake-sync-server.ts`) e moduli di produzione caricati a run time |

## Porte
- Doppio senso previste: variabile `EXPO_PUBLIC_API_URL` con predefinita; intervallo 60 s e
  `AppState` al posto di NetInfo; azioni della lista non in coda disabilitate offline.
- Senso unico: **DOMANDA** in testa (`expo-secure-store`).

## Rischi di concorrenza
- Timer, `AppState` e `afterWrite()` insieme: `sync()` serializza; S4 lo prova.
- Logout durante un ciclo: `signOut()` aspetta il ciclo in corso prima di `clear()`, così il ciclo
  non riscrive righe dopo la pulizia (S6 con ciclo in volo).
- Doppio tocco su «spunta» offline: due `enqueue` con `mutation_id` diversi, entrambi idempotenti;
  l'ultimo vince sul server (ordine della coda).

## Budget
Righe di produzione (`app/src`, `app/app`) ≤ 600; file ≤ 10; una sessione.

## Domande per il ricercatore (al massimo 3)
1. `expo-secure-store` con SDK 58 su Android: API (`getItemAsync`/`setItemAsync`/`deleteItemAsync`),
   limiti di dimensione, serve un config plugin? Comportamento dopo reinstallazione e backup automatico.
2. `fetch` di React Native 0.88 su Android: salva da solo i cookie `Set-Cookie`? (Se sì, il login
   Android non deve ricevere cookie, o vanno ignorati.)
3. `AppState` su Android con Expo SDK 58: eventi affidabili per `active`/`background`, e timer JS
   sospesi in background?

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Rilevazione della rete con NetInfo per sincronizzare subito al ritorno della rete.
