# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 037 · **Tipo:** verifica-produzione · **Fase:** chiusura · **PR aperta:** #52 · **Blocchi:** nessuno

## Prossimo

Giro 038 di costruzione per T10: canale «Promemoria» con `AndroidImportance.HIGH` (oggi `4` = LOW in
expo-notifications 58.1.6) e id di canale nuovo, uguale nel `channel_id` del server. Poi verifica
che esegua anche V6 (permesso `POST_NOTIFICATIONS` nel manifest dell'APK).

## Per l'umano

- Giro 037: nessuna ratifica, nessuna domanda aperta. Prova sul telefono ricevuta (10'): verde, ma senza suono/banner.
- V6 non eseguibile dalla sessione cloud (download artefatto 403): o lo fai tu sull'APK, o lo rifà la verifica.
- Dubbio del 035: query `titleOf`/`nameOf`/`words` senza filtro di famiglia.
- Difetto maggiore del 032 (`due_at > now` in `deletePending`) e dubbi minori del 033: fetta futura.
- Token FCM dopo il logout (SPEC §9); PUT parziale di un task e dati locali dopo il 401; Browser key Firebase.
- PR #34 (`expo-sqlite`), Dependabot #2 e #3, PR #44.

## Ultimi giri

- 037 — verifica T10: server e prova sul telefono verdi, difetto maggiore sul canale (033); non passato per V6.
- 036 — GET promemoria per i gestori con isolamento: 0 bloccanti.
- 035 — testo delle notifiche secondo SPEC §8: 0 bloccanti.

**Ultimo aggiornamento:** 2026-10-23 — giro 037.
