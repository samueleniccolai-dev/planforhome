# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 029 · **Tipo:** verifica-produzione · **Fase:** chiusura · **PR aperta:** #40 · **Blocchi:** nessuno

## Prossimo

T9 passato. Giro 030: traguardo T10 (primo non passato), secondo `traguardi.json`. Il difetto minore del PUT (scadenza azzerata se omessa) aspetta una decisione sulla semantica.

## Per l'umano

- Provare l'APK `planforhome-0.1.0-1e813c4` su telefono: login, aereo, task prendi/fatto/inoltra in coda, rete su, avviso («Già preso da …») entro 60 s, TalkBack.
- Decidere: PUT parziale di un task (campi omessi restano o si cancellano?) e dati locali dopo il 401 per ultima famiglia tolta.
- PR #34 (`expo-sqlite`), Dependabot #2 e #3.

## Ultimi giri

- 029 — verifica T9 passata: 26/26 controlli verdi in produzione, 0 bloccanti, 1 difetto minore (PUT azzera la scadenza).
- 028 — verifica T9 non passata: 5 attesi del piano sbagliati su 25 controlli, nessun difetto di dati o isolamento.
- 027 — costruzione T9 (4/4): task su Android via coda, rubrica locale, avviso discreto; 568 test, 0 bloccanti.

**Ultimo aggiornamento:** 2026-10-22 — giro 029.
