---
giro: 016
traguardo: T7
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-20T23:38:31Z
fine: 2026-10-21T00:27:42Z
pr: 23
ricerca_fonti: 4
critico_da_correggere: 4
critico_accolti: 4
revisore_bloccanti: 0
revisore_dubbi: 4
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 4
mutazioni_prese: 3
verify_rossi_locali: 0
test_totali: 467
test_delta: 26
decisioni_registro: 4
decisioni_ratifica: 2
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 016 — T7: inoltro di un task tra famiglie

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/016-agenti.json. -->

> **PR:** #23 · **Branch:** `claude/giro-016-t7` · **Traguardo:** T7 — Fatto quando verde, da
> verificare in produzione
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Chi sta in due o più famiglie può inoltrare un task da una all'altra dal pulsante «Inoltra «titolo»».
- Se l'assegnatario non è nella famiglia di arrivo, l'app avvisa e il task va in coda.
- Il server decide il permesso (ruolo nella famiglia di partenza); l'inoltro è idempotente.
- Ricorrenza e serie restano; l'evento `FORWARDED` viene registrato (migrazione `V3__task_events.sql`).
- Nessuna porta a senso unico. Nessun runbook da eseguire. La PR non tocca percorsi protetti di tipo «stack» oltre alla migrazione.
- Ratifiche: **016-a** (assegnatario tenuto solo se nella famiglia di arrivo, avviso prima della conferma); **016-b** (l'evento conserva `previousAssigneeId`).
- Prova su TalkBack dell'avviso `role="alert"`: non fatta, serve un telefono.

## Cosa funziona ora — con la prova
- Endpoint `POST /api/families/{F}/tasks/{id}/forward`: 19 test di accettazione server (13+6), compresi isolamento, replay, fusi, concorrenza (inoltri incrociati, inoltro contro «Prendo io»).
- Dialogo nell'app: 7 test Playwright (F1–F7); suite completa 143 verde; `npm test` 72; `./mvnw verify` 244 verde.

## Cosa non funziona ancora
- Storia degli eventi non mostrata nell'app (fuori perimetro); solo `FORWARDED`.
- Inoltro di una serie intera non previsto.
- Dubbio 1: un ciclico DATETIME inoltrato in un fuso diverso sposta di ore le occorrenze successive (la regola `time` è letta nel fuso di arrivo). Da decidere.
- Dubbio 3: se `members(toFamilyId)` fallisce, l'avviso non compare e la conferma resta possibile (minore; il server è corretto).
- Dubbio 4: i replay di take/done dopo un inoltro rispondono 404 (precedente al giro; conta per T9).
- Avviso su TalkBack non provato su dispositivo.

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** 4, nessuno corretto in questo giro; vedi sopra. Il dubbio 2: nessun test ferma la mutazione che rimette il filtro di famiglia in `hasLater` (serie spezzata); il codice attuale è corretto.
- **PERIMETRO:** nulla fuori piano.
- **CONCORRENZA:** replay parallelo 200/200 con una sola riga; inoltro contro «fatto» coerente; ciclo a tre famiglie senza deadlock; ora legale USA corretta.
- **MUTAZIONI:** provate 4, prese 3.

## Ricerca e critica
Ricerca: 4 fonti, scarse (Q1 e Q3 senza fonte primaria); presi `role="dialog"`, focus e radiogroup; l'avviso è una scelta nostra. Critica: 4 punti, tutti accolti (replay prima del 404, ciclico segnato fatto da Anna, due_at DATE nel fuso di arrivo, un solo UPDATE); tolto `GET …/events`.

## Proposte al metodo
nessuna

## Prossima fetta
Giro `verifica-produzione` di T7; poi, a monte, i dubbi 1–3 possono essere una piccola costruzione.
