# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 033 · **Tipo:** costruzione · **Fase:** domanda · **PR aperta:** #47 · **Blocchi:** nessuno

## Prossimo

T10 in-corso, fetta 2/3 fatta (promemoria automatici, silenzio notturno, ricalcolo, server). Giro 033: Android (`expo-notifications`, `google-services.json`: si aprirà con una DOMANDA). Poi verifica-produzione.

## Per l'umano

- **BLOCCO giro 033 (PR #47):** codice e test fatti (accettazione 19/20), ma l'installazione di `expo-notifications` è stata negata dal sistema dei permessi (anche se l'umano ha scelto A). Serve: `cd app && npx expo install expo-notifications`, commit di `package.json` e `package-lock.json` sul branch `claude/giro-033-t10`, poi rilanciare il giro (restano `expo export`, Playwright, `tsc`, `eslint`, `./mvnw verify`, revisione). Prima del merge: la PR dei workflow `apk` (`google-services.json`) a cura dell'umano.

- **DOMANDA giro 033 (PR #47):** libreria per le notifiche su Android. A) `expo-notifications` (raccomandata), B) react-native-firebase, C) nessuna libreria. Dettagli in `docs/lab/giri/033-piano.md`.
- PR #45: nessuna ratifica. Difetto maggiore (dubbio 1 revisore): un PUT tra l'istante di una riga e la corsa del lavoro (30 s) cancella un promemoria già dovuto; correzione `due_at > now` in un giro futuro.
- PR #44 in revisione umana: `application.properties` (pool Hikari, decisione 105). Nessuna ratifica.
- SPEC §8: nome della risorsa nella notifica vs payload generico — scelta nel giro 032.
- Token FCM riassegnabile tra utenti (dubbio revisore, da rivedere al giro 033).
- Decidere: PUT parziale di un task e dati locali dopo il 401; provare l'APK su telefono; Browser key Firebase.
- PR #34 (`expo-sqlite`), Dependabot #2 e #3.

## Ultimi giri

- 032 — promemoria automatici + silenzio notturno + ricalcolo: 3 punti critica (16/16 accolti), 0 bloccanti, 4/4 mutazioni prese.
- 031 — sollecito P12 + FCM HTTP v1 + segno web: 5/5 punti critica, 0 bloccanti, 4/4 mutazioni prese.
- 030 — runbook FCM scritto (T10 in-corso).

**Ultimo aggiornamento:** 2026-10-23 — giro 032.
