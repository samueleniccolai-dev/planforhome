# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 007 · **Tipo:** costruzione · **Fase:** chiusura · **PR aperta:** #14 · **Blocchi:** nessuno

## Prossimo

T5 (task, con il ritorno dei task in coda di T4) oppure il login su Android (`expo-secure-store`, porta a senso unico; DECISIONI n. 22). T4 resta in corso: serve un giro verifica-produzione.

## Per l'umano

- Rivedere #12 se arriva in revisione umana (modifica a `docs/lab/` e `metrics/`).
- Difetto minore 004: `Max-Age` del cookie 2591999 invece di 2592000.
- In produzione restano account e famiglie «Famiglia Verifica 005» (dati finti, nessuna API per cancellarli).
- APK `planforhome-0.1.0-c3538cd` ancora da provare su telefono fisico. PR Dependabot #2 e #3.

## Ultimi giri

- 005 — verifica-produzione T3: T3 passato, 0 bloccanti, 1 difetto minore.
- 007 — costruzione T4 (app): scelta e cambio famiglia sul web; 35 test di accettazione, 82 totali, 0 bloccanti.
- 006 — costruzione T4 (server): 34 test di accettazione, 109 totali, 1 bloccante trovato e risolto.

**Ultimo aggiornamento:** 2026-10-20 — giro 007.
