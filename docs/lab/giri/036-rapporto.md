---
giro: 036
traguardo: T10
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-23T16:03:02Z
fine: 2026-10-23T16:38:51Z
pr: 51
ricerca_fonti: 0
critico_da_correggere: 0
critico_accolti: 0
revisore_bloccanti: 0
revisore_dubbi: 2
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 4
mutazioni_prese: 4
verify_rossi_locali: 0
test_totali: 502
test_delta: 20
decisioni_registro: 1
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 036 — lettura dei promemoria di un task, per i gestori

> **PR:** #51 · **Branch:** `claude/giro-036-t10` · **Traguardo:** T10 — parziale (manca la verifica 037)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Nuovo `GET /api/families/{familyId}/tasks/{taskId}/reminders`: solo i gestori della famiglia in cui il task si trova ora; serve al giro 037 per leggere `result` senza comandi sul server.
- Risposta: `id`, `kind`, `dueAt`, `sentAt`, `result`. Niente token, destinatario o testo. 403 al membro, 404 fuori famiglia, 401 senza login.
- Sola lettura: nessuna riga in `change_log`, `version` invariata.
- Nessuna migrazione, nessuna dipendenza, nessun cambiamento dell'app.
- Ratifiche: nessuna.

## Cosa funziona ora — con la prova
- 20 test di accettazione verdi (`Giro036ReminderReadAcceptanceTest`, C8 parametrico sull'isolamento tra famiglie).
- `./mvnw -B -ntp verify`: 420 test verdi (revisore). Quattro mutazioni, tutte prese.
- Sonda di concorrenza (letture durante un inoltro): solo 200 con riga giusta o 404.

## Cosa non funziona ancora
- Verifica in produzione di T10 (giro 037) e prova sul telefono.
- `pr_guard.py` non eseguibile dal revisore (falso positivo dell'hook sul comando): controllo fatto a mano, nessun percorso protetto toccato.

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** 2 (file del registro agenti sporco per l'hook; guard bloccato da falso positivo). Nessuno corretto.
- **PERIMETRO:** 3 file di produzione, 80 righe non vuote (budget 90).
- **CONCORRENZA:** sonda verde, nessun lock in lettura.
- **MUTAZIONI:** provate 4, prese 4.

## Ricerca e critica
Nessuna ricerca. Critica: 0 punti da correggere; accolti i suggerimenti (query unica, test più forti, `stale`, ordine 404/403).

## Proposte al metodo
nessuna

## Prossima fetta
Giro 037 `verifica-produzione` di T10.
