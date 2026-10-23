---
giro: 035
traguardo: T10
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-23T14:52:31Z
fine: 2026-10-23T15:30:00Z
pr: 50
ricerca_fonti: 5
critico_da_correggere: 4
critico_accolti: 4
revisore_bloccanti: 0
revisore_dubbi: 3
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 3
mutazioni_prese: 3
verify_rossi_locali: 0
test_totali: 515
test_delta: 0
decisioni_registro: 3
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 035 — testo delle notifiche (SPEC §8)

> **PR:** #50 · **Branch:** `claude/giro-035-t10` · **Traguardo:** T10 — parziale (mancano il giro 036 e la verifica 037)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Sollecito, promemoria, task in coda scaduto e risorsa senza account hanno ora titolo e testo composti dal server, nella lingua del destinatario, con la scadenza nel fuso della famiglia.
- Titoli oltre 100 caratteri si accorciano (99 + «…»).
- **Revisione umana:** la PR cambia le asserzioni di test di accettazione già su `main` (031, 032, 033), che controllavano il testo vecchio (decisione 114).
- Nessuna migrazione, nessuna dipendenza, nessun cambiamento dell'app.
- Ratifiche: nessuna. Niente da fare da parte tua oltre la revisione.

## Cosa funziona ora — con la prova
- Testo per i quattro casi, in it e en, DST incluso (prova: `Giro035NotificationTextAcceptanceTest`, 11 test; `NotificationTextTest`, 5 test).
- `./mvnw -B -ntp verify`: 400 test verdi; app 114 test verdi (revisore).

## Cosa non funziona ancora
- Endpoint di lettura dei promemoria per i gestori (giro 036) e verifica in produzione (037).
- Resa su telefono del testo lungo e a schermo bloccato: non provata.
- `app/e2e/acceptance/giro-033-push-android.spec.ts:236` simula ancora il testo vecchio (finto lato client).
- Il sollecito a nome di una risorsa può confondere il referente.

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** 6 file di produzione invece di 5; `titleOf`, `nameOf`, `words` leggono per id senza filtro di famiglia (oggi solo percorsi interni); `035-agenti.json` sporco durante la revisione (scritto dal hook).
- **PERIMETRO:** pulito.
- **CONCORRENZA:** sonda con due `runDue` e un PUT: nessun testo misto né doppio invio.
- **MUTAZIONI:** provate 3, prese 3.

## Ricerca e critica
Ricerca: FCM 4096 byte, nessun limite ufficiale Android, CLDR `en` senza punto; la formula «is nudging you» è nostra, non verificata altrove. Critica: 4 punti, tutti accolti.

## Proposte al metodo
nessuna

## Prossima fetta
Giro 036: GET promemoria per i gestori, con test di isolamento.
