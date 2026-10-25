---
giro: 043
traguardo: T11
tipo: verifica-produzione
esito: passato
inizio: 2026-10-25T05:46:14Z
fine: 2026-10-25T06:11:15Z
pr: 67
ricerca_fonti: 0
critico_da_correggere: 0
critico_accolti: 0
revisore_bloccanti: 0
revisore_dubbi: 2
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 0
mutazioni_prese: 0
verify_rossi_locali: 0
test_totali: 3
test_delta: 0
decisioni_registro: 1
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: Dopo un PUT parziale gli id dei promemoria AUTO cambiano (ricalcolo con cancella e reinserisci); id stabili solo se l'umano lo scrive in SPEC §8.
---
# Verifica del giro 043 — T11

> **PR:** #67 · **Traguardo:** T11 — passato · **Codice:** 0 righe

## Per te, in 5 righe
- T11 è verificato in produzione su `dd26d2b`: PUT parziale, replay, `null` espliciti, isolamento, sync e APK firmato sono verdi.
- Il revisore ha trovato un solo rosso, R2: dopo un PUT con il solo titolo i promemoria `AUTO` tengono orari e stato, ma ricevono `id` nuovi.
- Non l'ho contato come difetto. Il «Fatto quando» di T11 non parla degli `id` e SPEC §8 non vieta il ricalcolo. Era sbagliato l'atteso del piano: l'ho corretto e il controllo rieseguito è verde (ESPERIMENTO §4.5).
- Da te: nulla di bloccante. Resta la prova dell'APK sul telefono, che non ho fatto. Se vuoi `id` stabili, va scritto in SPEC §8.
- Scritture in produzione con dati inventati (decisione 42): account `verifica043.*@example.com` e due famiglie di prova, non cancellati.

## Controlli eseguiti
Primo passaggio del revisore sullo SHA `d5203a6` (17 controlli); secondo passaggio su `31c52d4` (R2 e S1, 3 controlli, il `VERDETTO` finale). Il prodotto in produzione è lo stesso `dd26d2b`: i due SHA differiscono solo per il piano.

| Controllo | Comando o prova | Atteso | Ottenuto |
|---|---|---|---|
| V1 | CI, run 40139137434 | verde | server, app, apk, build, lab in success |
| V2 | `./mvnw -Dtest='Giro042*,Giro011*,Giro013*,PushServiceReminderTest' test` | verde | 73 test, BUILD SUCCESS |
| V3 | Jest e Playwright `giro-042-*` | verdi | 119/119 e 3/3 |
| V4 | job `deploy` di `consegna` | verde | success |
| V5 | artefatto APK `planforhome-0.1.0-dd26d2b` | presente | `apk` e `apk-firma` in success, 39161581 byte |
| S1, S2 | `/api/health`; PUT senza token | sha `dd26d2b`; 401 | come atteso |
| P0–P7 | PUT parziale, sync, replay, `null`, 400, ricorrente, isolamento | come da piano | tutti verdi, 404 identico tra famiglie |
| R1 | promemoria dopo la creazione | 2 `AUTO` pending | come atteso |
| R2 (corretto) | PUT del solo titolo, poi `GET …/reminders` | stessi `dueAt`, `pending`, nessun duplicato | verde nei due passaggi |
| R3 | errore di rete sull'invio | non provocabile in produzione | vale V2 |

## Difetti trovati
Nessuno. Osservazione senza gravità: `ReminderPlanner.recalculate` cancella e reinserisce le righe `AUTO` future a ogni scrittura (dal giro 032). Le righe già inviate non si toccano.

## Proposte al metodo
Nessuna sul metodo. Sul prodotto: `id` dei promemoria stabili (vedi sopra).
