# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 027 · **Tipo:** costruzione · **Fase:** chiusura · **PR aperta:** #37 · **Blocchi:** nessuno

## Prossimo

Giro 028: `verifica-produzione` di T9 (dopo la PR 037 mergiata e il deploy verde); la prova dell'APK su telefono resta dell'umano.

## Per l'umano

- Giro 027: nessuna ratifica, nessuna porta. Server e dipendenze non toccati.
- Provare l'APK su telefono: login, aereo, task prendi/fatto/inoltra in coda, rete su, avviso («Già preso da …») entro 60 s, TalkBack. Job `apk` della CI. PR #34 (`expo-sqlite`), Dependabot #2 e #3.

## Ultimi giri

- 027 — costruzione T9 (4/4): task su Android via coda, rubrica locale, avviso discreto; 568 test, 0 bloccanti (2 dubbi corretti).
- 026 — costruzione T9 (3/4): sessione Android con token, ciclo di sync, lista della spesa offline; 109 test, 0 bloccanti finali.
- 025 — costruzione T9: correzioni del sync (contestazioni 83/84); 151 test, 0 bloccanti.

**Ultimo aggiornamento:** 2026-10-22 — giro 027.
