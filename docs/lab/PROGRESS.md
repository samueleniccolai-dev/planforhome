# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** nessuno · **Tipo:** — · **Fase:** — · **PR aperta:** — · **Blocchi:** nessuno
**Inizio del giro 000:** —

## Fasi dell'esperimento

| Fase | Stato |
|---|---|
| 0 — specifica, traguardi, stack, protocollo (CANCELLO 2) | fatta, 17/10/2026 |
| C — adattamento del meccanismo da gerio-lab (CANCELLO 3) | fatta, 18/10/2026 |
| Setup assistito (server, DNS, segreti, chiave dell'APK, ruleset, Routine) | passi 1–8 fatti, 18/10/2026; manca il 9 |
| Giro 000 — i binari (T1, T2) | prossimo |

## Prossimo

Giro 000, tipo `costruzione`, traguardo T1: deploy automatico (con `traguardi_extra: [T2]`). Parte
con il passo 9 del setup.

Note per il giro 000, dalla prova a mano del 18/10/2026 (`DECISIONI.md` n. 1):
- `create-expo-app` oggi dà Expo SDK 58 e react-native 0.88; la build Android regge con Node 24,
  JDK 17 Temurin e Android SDK 36, come la CI;
- il template di default esporta il web con `web.output: "server"`: per Caddy (file statici da
  `app/dist`, `infra/README.md`) serve `"static"`;
- nell'immagine cloud c'è `mvn` (JDK 21 con Maven): `server/mvnw` nasce da `mvn -N wrapper:wrapper`.

## Ultimi giri

- nessuno

## Per l'umano

- Setup passo 9: `LAB_ATTIVO` = `true`, «Run now» della Routine, poi la Schedule delle 03:07.
- PR di Dependabot #2 e #3 (action di `.github/`): da guardare prima o dopo il giro 000.
- Ratifiche da dichiarare lette: nessuna.

**Ultimo aggiornamento:** 2026-10-18 — setup passi 1–8.
