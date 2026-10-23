# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 034 · **Tipo:** verifica-produzione · **Fase:** chiusura (senza verdetto) · **PR aperta:** #49 · **Blocchi:** nessuno

## Prossimo

Risposta B: giro 035 `costruzione` (testo notifiche, SPEC §8), 036 `costruzione` (GET promemoria per i gestori), 037 `verifica-produzione` di T10.

## Per l'umano

- **DOMANDA giro 034 (PR #49):** per la verifica di T10 serve la prova sul telefono e una `select` in sola lettura su `reminder.result`. Opzioni A (tu, ~15') / B (giro di costruzione con endpoint di lettura) / C (togli il controllo da traguardi.json). Raccomando A. Dettagli e passi in `docs/lab/giri/034-piano.md`.

- PR #49: nessuna ratifica. Prova sul telefono dopo il giro 036.
- PR #47 era in revisione umana (`app/package.json`, lock).
- Prova sul telefono: permesso, sollecito nel canale «Promemoria», tocco ad app chiusa/aperta. `aapt dump permissions` sull'APK per `POST_NOTIFICATIONS` (alternativa: `android.permissions` in `app.json`).
- Difetto maggiore del 032 (`due_at > now` in `deletePending`) e dubbi minori del 033 (rimontaggio del layout, token che non risolve, M4 senza test): fetta di un giro futuro.
- Token FCM che resta dopo il logout (SPEC §9); SPEC §8: nome della risorsa nella notifica.
- Decidere: PUT parziale di un task e dati locali dopo il 401; Browser key Firebase.
- PR #34 (`expo-sqlite`), Dependabot #2 e #3, PR #44.

## Ultimi giri

- 034 — verifica T10 fermata su una domanda; scelta B, chiuso senza verdetto.
- 033 — Android: permesso, token FCM, apertura dal tocco: 0 bloccanti.
- 032 — promemoria automatici + silenzio notturno + ricalcolo: 0 bloccanti.

**Ultimo aggiornamento:** 2026-10-23 — giro 034.
