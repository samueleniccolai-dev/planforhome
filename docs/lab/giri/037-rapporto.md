---
giro: 037
traguardo: T10
tipo: verifica-produzione
esito: non-passato
inizio: 2026-10-23T17:05:17Z
fine: 2026-10-23T18:30:00Z
pr: 52
ricerca_fonti: 0
critico_da_correggere: 0
critico_accolti: 0
revisore_bloccanti: 0
revisore_dubbi: 5
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 0
mutazioni_prese: 0
verify_rossi_locali: 0
test_totali: 22
test_delta: 0
decisioni_registro: 0
decisioni_ratifica: 0
porte_senso_unico: 1
riparazioni: 0
difetti: 037:maggiore
proposte_metodo: nessuna
---
# Verifica del giro 037 — T10

<!-- Rapporto corto. Modelli e token: docs/lab/giri/037-agenti.json. -->

> **PR:** #52 · **Traguardo:** T10 — non passato (V6 non eseguito) · **Codice:** 0 righe

## Per te, in 10 righe
- Tutto verde in produzione su `5ce97c3`: sollecito (P0–P6), lettura promemoria (R1–R3), CI, deploy, test locali (85 server, 114 Jest, 22 Playwright).
- La tua prova sul telefono è verde: notifica FCM vera (`result` = `projects/planforhome/messages/…`), testo di SPEC §8, il tocco apre il task. Grazie: 10 minuti.
- **Difetto maggiore (033):** le notifiche arrivano senza suono, vibrazione e banner. Confermato dal revisore: `app/src/push/registration.ts:20` ha `IMPORTANCE_HIGH = 4`, ma in `expo-notifications` 58.1.6 `HIGH` = 6 (4 = `LOW`). Correzione: `AndroidImportance.HIGH` e un id di canale nuovo (anche nel `channel_id` del server). È la fetta di un giro di costruzione.
- **T10 resta `in-corso`:** V6 (permesso `POST_NOTIFICATIONS` nel manifest dell'APK) non si è potuto eseguire, perché il download dell'artefatto dà 403 dalla sessione cloud. Prove indirette: il permesso è stato chiesto e accettato sul telefono, `app/` è identico tra `810a92d` e `5ce97c3`, il plugin `expo-notifications` è in `app.json`.
- Nessuna revisione umana richiesta (0 righe di codice).

## Controlli eseguiti
| Controllo | Prova | Atteso | Ottenuto |
|---|---|---|---|
| V1 CI e test presenti | run 39989091113 | verde | verde |
| V2 server | `Giro031…036 AcceptanceTest` elencati | verde | 85 test, 0 falliti |
| V3 app | Jest + Playwright 031/033 | verde | 114/114 e 22/22 |
| V4 deploy | run 39991288249 | success | success |
| V5 APK | artefatto `planforhome-0.1.0-5ce97c3` | presente | presente, 39150137 byte |
| V6 permesso nel manifest | `gh run download` | presente | **non eseguito** (403) |
| S1–S2 | health e 401 | 200 / 401 | ok |
| P0–P6 | account `verifica037.1792779770.*` | 200/403/409/429/404 | ok |
| R1–R3 | GET promemoria | 5 chiavi, ricalcolo, 403/404 | ok |
| F1, F2, F4 | commento umano | verde | verde |
| F3 | commento umano | testo SPEC §8, tocco apre il task | ok; senza suono |

Atteso del piano sbagliato (non difetti): il pattern `Giro03[12356]*` non funziona in Surefire (elenco separato da virgole); in R1 la riga `NUDGE` `no_device` ha `sentAt` nullo (voluto dal 036); Playwright richiede prima `npx expo export -p web`.

## Difetti trovati
| Difetto | Gravità | difetto_di | Prova |
|---|---|---|---|
| Canale «Promemoria» con importanza bassa: niente suono, vibrazione, banner | maggiore | 033 | `registration.ts:20`; enum in `NotificationChannelManager.types.d.ts:32-35`; osservazione sul telefono |

Noti e non rifatti: `due_at > now` in `deletePending` (032), token FCM dopo il logout (SPEC §9), query senza filtro di famiglia (dubbio 035).

## Proposte al metodo
nessuna
