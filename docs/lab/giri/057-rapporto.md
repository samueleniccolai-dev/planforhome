---
giro: 057
traguardo: T16
tipo: verifica-produzione
esito: passato
inizio: 2026-10-26T12:01:05Z
fine: 2026-10-26T12:20:41Z
pr: 81
ricerca_fonti: 0
critico_da_correggere: 0
critico_accolti: 0
revisore_bloccanti: 0
revisore_dubbi: 3
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 2
mutazioni_prese: 2
verify_rossi_locali: 0
test_totali: 24
test_delta: 0
decisioni_registro: 0
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Verifica del giro 057 — T16

> **PR:** #81 · **Traguardo:** T16 — passato · **Codice:** 0 righe

## Per te, in 5 righe
- T16 (tema scuro e stati V8) verificato in produzione su `32b223a`: 24 controlli verdi, 0 bloccanti, 0 difetti.
- Mutazioni provate 2, prese 2 (contrasto dei token, `accessibilityLiveRegion` di `LoadingState`). Il VERDETTO del revisore riporta 0: vale il conteggio nel testo.
- Atteso del piano sbagliato (S5): su `/me` l'app manda sempre `POST /api/auth/refresh` (dal giro 018, non scrive dati). S5 va letto escludendo il refresh; non è un difetto.
- Da te sul telefono (F1, non bloccante): APK in tema scuro di sistema, annuncio TalkBack del «Caricamento…», note offline/conflitto. APK `planforhome-0.1.0-32b223a` pronto.
- `pr_guard` manda la PR in revisione umana: `057-agenti.json` non riporta il revisore (modello-inatteso). Nessun codice toccato.
- Dubbi 056 già noti restano aperti (`me()` non distingue 401 da errore, spinner Android senza timeout).

## Controlli eseguiti
| Controllo | Comando o prova | Atteso | Ottenuto |
|---|---|---|---|
| V1–V5 | CI 055/056, jest/tsc/eslint, Playwright locale, deploy, APK | verdi | 216 jest, 85 Playwright, deploy e APK success |
| H1–H3 | salute, galleria spenta, meta color-scheme | sha 32b223a, ok | ok |
| P0–P1 | 3 account `verifica057.*` inventati (decisione 42) | creati | ok |
| T1–T5 | 7 schermate × chiaro/scuro × 390/1280, contrasto ≥ 4.5 | ok | min 7.47 in scuro |
| S1–S5 | caricamento, 500, rete caduta (page.route) | stati V8 | ok; S5 con refresh escluso |
| E1–E2 | vuoto con dati veri, `/me` senza famiglie | ok | ok |
| Q1 | 36 screenshot | nessuno vuoto | ok |
| X1 | isolamento tra famiglie | 404 / non visibile | ok |

## Difetti trovati
Nessuno.

## Proposte al metodo
nessuna
