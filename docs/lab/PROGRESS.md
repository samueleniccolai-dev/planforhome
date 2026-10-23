# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 035 · **Tipo:** costruzione · **Fase:** chiusura · **PR aperta:** #50 (revisione umana) · **Blocchi:** nessuno

## Prossimo

Giro 036 `costruzione` (GET promemoria per i gestori, con isolamento), 037 `verifica-produzione` di T10.

## Per l'umano

- PR #50: revisione umana perché cambia asserzioni di accettazione 031/032/033 (decisione 114). Nessuna ratifica.
- Prova sul telefono dopo il giro 036: permesso, sollecito nel canale «Promemoria», tocco ad app chiusa/aperta, testo lungo a schermo bloccato.
- Dubbio del 035: query `titleOf`/`nameOf`/`words` senza filtro di famiglia (da aggiungere se un endpoint le userà).
- Difetto maggiore del 032 (`due_at > now` in `deletePending`) e dubbi minori del 033: fetta di un giro futuro.
- Token FCM che resta dopo il logout (SPEC §9); decidere PUT parziale di un task e dati locali dopo il 401; Browser key Firebase.
- PR #34 (`expo-sqlite`), Dependabot #2 e #3, PR #44.

## Ultimi giri

- 035 — testo delle notifiche secondo SPEC §8: 0 bloccanti.
- 034 — verifica T10 fermata su una domanda; scelta B, chiuso senza verdetto.
- 033 — Android: permesso, token FCM, apertura dal tocco: 0 bloccanti.

**Ultimo aggiornamento:** 2026-10-23 — giro 035.
