---
giro: 042
traguardo: T11
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-24T21:20:03Z
fine: 2026-10-24T22:32:00Z
pr: 66
ricerca_fonti: 0
critico_da_correggere: 3
critico_accolti: 3
revisore_bloccanti: 2
revisore_dubbi: 3
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 5
mutazioni_prese: 5
verify_rossi_locali: 0
test_totali: 466
test_delta: 0
decisioni_registro: 5
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 042 — bonifica dei tre minori della caccia 040 (T11)

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/042-agenti.json. -->

> **PR:** #66 · **Branch:** `claude/giro-042-t11` · **Traguardo:** T11 — Fatto quando verde, da
> verificare in produzione
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Il PUT del task non azzera più i campi omessi: note, criticità e scadenza si conservano; per azzerare serve `null` esplicito. Un campo di tipo sbagliato dà 400.
- La registrazione del telefono non si blocca se il token FCM non risponde (timeout 10 s, si riprova al prossimo avvio).
- Un errore di rete non sovrascrive più un promemoria già segnato inviato.
- **Revisione umana richiesta:** il guard segnala la modifica di tre punti di test di accettazione esistenti (Giro011 ×2, Giro013 ×1), adeguati alla nuova semantica del PUT (decisione 125).
- `server/mvnw.cmd` risulta modificato nell'albero di lavoro del cloud solo per i fine riga (CRLF): non è nel diff della PR.
- Il revisore non ha potuto lanciare `pr_guard` (l'hook lo blocca come falso positivo): da controllare in CI.
- Ratifiche: nessuna.
- Modulo di merge: `⏱ N' · ratifiche lette: nessuna · note`

## Cosa funziona ora — con la prova
- PUT parziale, sync, isolamento, ricorrente DATETIME (prova: `Giro042PartialUpdateAcceptanceTest`, verify 445 test verdi).
- Promemoria saldato non sovrascritto (prova: `Giro042ReminderNetworkErrorAcceptanceTest`, `PushServiceReminderTest`).
- Timeout del token (prova: Jest 119 verdi, Playwright B1–B3 3/3).

## Cosa non funziona ancora
- Verifica in produzione non ancora fatta (giro `verifica-produzione` successivo).
- Il form «Modifica task» dell'app non esiste ancora (idea del piano).
- `test_delta` non contato.

## Verdetto del revisore
- **BLOCCANTI:** 2 (campi di tipo sbagliato trattati come assenti; unit test di `PushService` mancante) — risolti: sì, in d36b104 e 6fb696b, verificati da un revisore nuovo.
- **DUBBI:** 3 (pr_guard non lanciabile; `mvnw.cmd` fine riga; `title: 5` ora 400) — l'ultimo coperto dal bloccante 1.
- **PERIMETRO:** nessuna aggiunta fuori piano.
- **CONCORRENZA:** PUT parziali e stessa `mutationId` in parallelo: ok.
- **MUTAZIONI:** provate 5 (3+2), prese 5.

## Ricerca e critica
Nessuna ricerca. Concorrenti analizzati: nessuno. Critica: 3 punti, tutti accolti, più il controllo sul pull di sync.

## Proposte al metodo
nessuna

## Prossima fetta
Giro `verifica-produzione` su T11.
