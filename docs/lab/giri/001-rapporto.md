---
giro: 001
traguardo: T1
tipo: verifica-produzione
esito: passato
inizio: 2026-10-19T14:46:53Z
fine: 2026-10-19T17:26:31Z
pr: 7
ricerca_fonti: 0
critico_da_correggere: 0
critico_accolti: 0
revisore_bloccanti: 0
revisore_dubbi: 4
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 0
mutazioni_prese: 0
verify_rossi_locali: 0
test_totali: 16
test_delta: 0
decisioni_registro: 1
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti: 001:minore
proposte_metodo: traguardo.py accetta un solo traguardo per rapporto di verifica: un giro con traguardi_extra non può far passare il secondo (T2)
---
# Verifica del giro 001 — T1 + T2

<!-- Rapporto corto. Modelli e token: docs/lab/giri/001-agenti.json. -->

> **PR:** #7 · **Traguardo:** T1 passato; T2 verificato verde ma non registrabile (vedi sotto) · **Codice:** 0 righe

## Per te, in 5 righe
- T1 passa. T2 ha i controlli verdi, ma `traguardo.py` lo registra `passato` solo con un rapporto che nomina T2: resta `in-corso` e serve un breve giro `verifica-produzione` solo per T2. I controlli del «Fatto quando» sono verdi (revisore: 0 bloccanti, 4 dubbi; prove umane del 19/10 verdi).
- L'APK è stato provato su **emulatore** Android 16, non su un telefono fisico: resta da rifare su telefono quando ne avrai uno.
- Difetto minore `001:minore` (difetto_di 000): lo smoke del primo deploy parte prima che Caddy abbia il certificato e fallisce; non c'è una versione precedente per il rollback. Da correggere in un giro di costruzione.
- Errore del piano 001: T2.3 indicava il file sbagliato; la chiave mancante è coperta da `app/e2e/acceptance/giro-000-i18n.spec.ts`.
- Niente da fare per te, tranne rivedere la PR (cambia `traguardi.json`).

## Controlli eseguiti
| Controllo | Comando o prova | Atteso | Ottenuto |
|---|---|---|---|
| T1.1, T1.4 | log job `deploy` 118114757814 (run 39268221499) | smoke eseguito, `digest check ok` | ok (prova umana) |
| T1.2, T1.3, T1.7 | HTTPS pubblico su `app.planforhome.com` | 200, SHA del deploy, certificato valido | ok (revisore; smoke: `/api/health reports ce8209b9c27e…`, HSTS ok) |
| T1.5, T1.6 | run `consegna`, artefatto `test-reports` | rollback test 0 fallimenti | 12 test verdi (prova umana) |
| T2.1, T2.2 | artefatto `e2e-screenshots`, run `ci` PR #6 | home it/en | `home-it.png` «Benvenuto in planforhome», `home-en.png` «Welcome to planforhome» |
| T2.3, T2.4 | Jest i18n, job `apk` | verdi | ok (revisore, 16 test) |
| T2.5, T2.6 | APK `planforhome-0.1.0-ce8209b` | firma v2/v3, pacchetto `com.planforhome.app` | `apksigner` v2 e v3 true, targetSdk 36 |
| Installazione APK (dato a parte) | `adb install` su emulatore API 36 | si apre | ok su emulatore; telefono fisico non provato |

## Difetti trovati
| Difetto | Gravità | difetto_di | Prova (comando) |
|---|---|---|---|
| Lo smoke non aspetta il certificato al primo avvio (job 118061963623: `curl: (35) tlsv1 alert internal error`, poi `no previous version to roll back to`) | minore (`001:minore`) | 000 | log del job; `/api/health` 200 alle 13:12Z con lo stesso SHA |

## Proposte al metodo
traguardo.py accetta un solo traguardo per rapporto di verifica: un giro con `traguardi_extra` non può far passare il secondo (T2).
