# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 033 · **Tipo:** costruzione · **Fase:** chiusura · **PR aperta:** #47 · **Blocchi:** nessuno

## Prossimo

T10 in-corso, fetta 3/3 fatta (Android: permesso, token FCM, apertura del task). Giro dopo: `verifica-produzione` di T10, dopo la tua prova sul telefono.

## Per l'umano

- PR #47 in revisione umana (`app/package.json`, lock). Nessuna ratifica.
- Prova sul telefono: permesso, sollecito nel canale «Promemoria», tocco ad app chiusa/aperta. `aapt dump permissions` sull'APK per `POST_NOTIFICATIONS` (alternativa: `android.permissions` in `app.json`).
- Difetto maggiore del 032 (`due_at > now` in `deletePending`) e dubbi minori del 033 (rimontaggio del layout, token che non risolve, M4 senza test): fetta di un giro futuro.
- Token FCM che resta dopo il logout (SPEC §9); SPEC §8: nome della risorsa nella notifica.
- Decidere: PUT parziale di un task e dati locali dopo il 401; Browser key Firebase.
- PR #34 (`expo-sqlite`), Dependabot #2 e #3, PR #44.

## Ultimi giri

- 033 — Android: permesso, token FCM, apertura dal tocco: 11/11 punti critica accolti, 0 bloccanti, 4/5 mutazioni prese.
- 032 — promemoria automatici + silenzio notturno + ricalcolo: 0 bloccanti, 4/4 mutazioni prese.
- 031 — sollecito P12 + FCM HTTP v1 + segno web: 0 bloccanti, 4/4 mutazioni prese.

**Ultimo aggiornamento:** 2026-10-23 — giro 033.
