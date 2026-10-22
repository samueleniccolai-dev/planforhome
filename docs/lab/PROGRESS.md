# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 028 · **Tipo:** verifica-produzione · **Fase:** chiusura · **PR aperta:** #38 · **Blocchi:** nessuno

## Prossimo

Giro 029: `verifica-produzione` di T9 con gli attesi corretti (Q4: 2xx senza effetto; K3: stesso stato finale; C1: A e B promosso a MANAGER; I2: il client cancella le voci; I3: 401 per account disattivato). Poi dubbio sul 401 all'ultima famiglia.

## Per l'umano

- Giro 028: decidere se ratificare «test Jest» → Playwright in Node per il motore di sync.
- Provare l'APK su telefono: login, aereo, task prendi/fatto/inoltra in coda, rete su, avviso («Già preso da …») entro 60 s, TalkBack. Job `apk` della CI. PR #34 (`expo-sqlite`), Dependabot #2 e #3.

## Ultimi giri

- 028 — verifica T9 non passata: 5 attesi del piano sbagliati su 25 controlli, nessun difetto di dati o isolamento.
- 027 — costruzione T9 (4/4): task su Android via coda, rubrica locale, avviso discreto; 568 test, 0 bloccanti (2 dubbi corretti).
- 026 — costruzione T9 (3/4): sessione Android con token, ciclo di sync, lista della spesa offline; 109 test, 0 bloccanti finali.

**Ultimo aggiornamento:** 2026-10-22 — giro 028.
