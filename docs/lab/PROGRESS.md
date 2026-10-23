# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 031 · **Tipo:** costruzione · **Fase:** chiusura · **PR aperta:** #44 · **Blocchi:** nessuno

## Prossimo

T10 in-corso, fetta 1/3 fatta (sollecito P12 + FCM, web). Giro 032: promemoria automatici, silenzio notturno, ricalcolo. Giro 033: Android (`expo-notifications`, `google-services.json`: si aprirà con una DOMANDA). Poi verifica-produzione.

## Per l'umano

- PR #44 in revisione umana: `application.properties` (pool Hikari, decisione 105). Nessuna ratifica.
- SPEC §8: nome della risorsa nella notifica vs payload generico — scelta nel giro 032.
- Token FCM riassegnabile tra utenti (dubbio revisore, da rivedere al giro 033).
- Decidere: PUT parziale di un task e dati locali dopo il 401; provare l'APK su telefono; Browser key Firebase.
- PR #34 (`expo-sqlite`), Dependabot #2 e #3.

## Ultimi giri

- 031 — sollecito P12 + FCM HTTP v1 + segno web: 5/5 punti critica, 0 bloccanti, 4/4 mutazioni prese.
- 030 — runbook FCM scritto (T10 in-corso).
- 029 — verifica T9 passata: 26/26 controlli verdi.

**Ultimo aggiornamento:** 2026-10-22 — giro 031.
