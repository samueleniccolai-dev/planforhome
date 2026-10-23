# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 039 · **Tipo:** verifica-produzione · **Fase:** domanda · **PR aperta:** #55 · **Blocchi:** nessuno

## Prossimo

Giro 039 `verifica-produzione` per T10: manifest con `POST_NOTIFICATIONS` (V6), poi prova sul telefono dopo reinstallazione dell'APK.

## Per l'umano

- **DOMANDA giro 039 (PR #55):** prova di T10 sul telefono con l'APK nuovo (V6 + canale Promemoria alto). Opzioni A (≈15') / B (solo manifest) / C (dopo). Raccomandata A. Dettagli in `docs/lab/giri/039-piano.md`.

- Giro 038: nessuna ratifica. Per la prova: disinstalla e reinstalla l'APK (Android non alza un canale esistente), rifai il login, controlla che «Promemoria» sia ad alta importanza.
- V6 non eseguibile dalla sessione cloud (download artefatto 403): o lo fai tu sull'APK, o lo rifà la verifica.
- Dubbio del 035: query `titleOf`/`nameOf`/`words` senza filtro di famiglia.
- Difetto maggiore del 032 (`due_at > now` in `deletePending`) e dubbi minori del 033: fetta futura.
- Token FCM dopo il logout (SPEC §9); PUT parziale di un task e dati locali dopo il 401; Browser key Firebase.
- PR #34 (`expo-sqlite`), Dependabot #2 e #3, PR #44.

## Ultimi giri

- 038 — canale Promemoria con importanza ALTA (6): 0 bloccanti, 555 test; da provare sul telefono.
- 037 — verifica T10: server e prova sul telefono verdi, difetto maggiore sul canale (033); non passato per V6.
- 036 — GET promemoria per i gestori con isolamento: 0 bloccanti.

**Ultimo aggiornamento:** 2026-10-23 — giro 038.
