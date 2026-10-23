# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 037 · **Tipo:** verifica-produzione · **Fase:** domanda · **PR aperta:** #52 · **Blocchi:** nessuno

## Prossimo

Giro 037 `verifica-produzione` di T10 (legge i promemoria con il nuovo GET).

## Per l'umano

- **DOMANDA giro 037 (PR #52):** prova di T10 sul telefono (≈10 min, passi nel piano 037). A = la fai ora, T10 può passare; B = «telefono dopo», il giro chiude non-passato. Consigliata A.

- Giro 036: nessuna ratifica, nessuna domanda.
- Prova sul telefono dopo il giro 037: permesso, sollecito nel canale «Promemoria», tocco ad app chiusa/aperta, testo lungo a schermo bloccato.
- Dubbio del 035: query `titleOf`/`nameOf`/`words` senza filtro di famiglia (da aggiungere se un endpoint le userà).
- Difetto maggiore del 032 (`due_at > now` in `deletePending`) e dubbi minori del 033: fetta di un giro futuro.
- Token FCM che resta dopo il logout (SPEC §9); decidere PUT parziale di un task e dati locali dopo il 401; Browser key Firebase.
- PR #34 (`expo-sqlite`), Dependabot #2 e #3, PR #44.

## Ultimi giri

- 036 — GET promemoria per i gestori con isolamento: 0 bloccanti.
- 035 — testo delle notifiche secondo SPEC §8: 0 bloccanti.
- 034 — verifica T10 fermata su una domanda; scelta B, chiuso senza verdetto.

**Ultimo aggiornamento:** 2026-10-23 — giro 036.
