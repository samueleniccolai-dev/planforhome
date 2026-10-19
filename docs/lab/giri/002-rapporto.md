---
giro: 002
traguardo: T2
tipo: verifica-produzione
esito: passato
inizio: 2026-10-19T18:01:45Z
fine: 2026-10-19T18:20:24Z
pr: 8
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
test_totali: 11
test_delta: 0
decisioni_registro: 1
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Verifica del giro 002 — T2

<!-- Rapporto corto. Modelli e token: docs/lab/giri/002-agenti.json. -->

> **PR:** #8 · **Traguardo:** T2 — passato · **Codice:** 0 righe

## Per te, in 5 righe
- T2 passa: i controlli T2.1–T2.6 sono verdi sulle run `ci` 39294246077 e `consegna` 39298335555 (36c065c).
- Nessun difetto nuovo, nessun bloccante.
- Firma dell'APK (T2.6): prova indiretta. Il passo «Sign the APK» è `success`, ma proxy e hook hanno impedito di leggere log e artefatto. Vale la prova umana del 19/10 su `planforhome-0.1.0-ce8209b` (v2/v3); app, server, workflow e infra sono identici tra ce8209b e 36c065c.
- Inclusione degli spec e2e nella run: dedotta da `testDir: './e2e'` e da `npx playwright test` senza filtri, non letta nel log.
- Da te, quando avrai un telefono: prova dell'APK su dispositivo fisico (finora solo emulatore). Nessuna ratifica.
- Revisione umana richiesta da \`pr_guard\` (modello-inatteso): l'orchestratore di questa sessione ha girato su claude-sonnet-5-5, il modello atteso è altro (\`progetto.yml\`, \`modelli_attesi\`); \`002-agenti.json\` ha il revisore due volte (voce interim + finale).

## Controlli eseguiti
| Controllo | Comando o prova | Atteso | Ottenuto |
|---|---|---|---|
| T2.1 | `gh run view 39294246077 --json jobs`; artefatti | job app, bundle web e Playwright verdi; `e2e-screenshots` | verde, artefatto presente |
| T2.2 | `grep -rnE "locator\(['\"][.#]" app/e2e` | nessun risultato | nessuno |
| T2.3 | `cd app && npm ci && npm test` | verde | 1 suite, 4 test verdi |
| T2.4 | job `apk` della CI; `needs` di `build` | success; build dipende da apk | success; `needs: [lab, server, app, apk]` |
| T2.5 | run 39298335555, job `apk` e `apk-firma`; artefatti | success; `planforhome-0.1.0-36c065c` | success; artefatto 34,7 MB |
| T2.6 | passo «Sign the APK» | success | success (prova indiretta, vedi sopra) |
| Produzione | `curl` su `/` e `/api/health` | 200 | 200 e 200 |

## Difetti trovati
Nessuno.

## Proposte al metodo
nessuna
