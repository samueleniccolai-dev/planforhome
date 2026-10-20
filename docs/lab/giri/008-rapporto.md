---
giro: 008
traguardo: T5
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-20T07:41:00Z
fine: 2026-10-20T08:17:27Z
pr: 15
ricerca_fonti: 0
critico_da_correggere: 4
critico_accolti: 4
revisore_bloccanti: 0
revisore_dubbi: 4
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 5
mutazioni_prese: 5
verify_rossi_locali: 1
test_totali: 147
test_delta: 32
decisioni_registro: 3
decisioni_ratifica: 0
porte_senso_unico: 1
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 008 — T5 parte 1: task, coda e ritorno in coda (server)

> **PR:** #15 · **Branch:** `claude/giro-008-t4` · **Traguardo:** T5 — parziale (restano P7–P9, schermate e Playwright); T4 — frase sul ritorno in coda ora provata in CI, serve un giro verifica-produzione
> **Domande che bloccano:** nessuna (risolta: perimetro, opzione A, DECISIONI n. 32)

## Per te, in 10 righe
- Il server ha i task: crearli, assegnarli, prenderli dalla coda, rimetterli in coda (P1–P6).
- Quando un account è disattivato o una risorsa è cancellata, i task tornano in coda (frase di T4).
- Migrazione nuova `V2__tasks.sql` (solo aggiunte): `task`, `change_log`, `applied_mutation`.
- Ogni scrittura è idempotente (`mutationId`), ha `version` e riga in `change_log`.
- Presa contesa dalla coda: uno solo vince, l'altro riceve 409 `already_taken`.
- Nessuna ratifica. Nessuna dipendenza nuova.
- Il test di accettazione è stato corretto una volta (`List.of` → `Arrays.asList`, NPE su valori null; commit bfe4c1f): nessuna asserzione cambiata.
- Il budget di righe di produzione è salito da 500 a 700 nel piano (687 usate; limite del tipo 1500).
- Revisione umana (pr_guard): il file di supporto dei test di accettazione è cambiato dopo il suo commit; modello-inatteso: nel file agenti mancano revisore e orchestratore.

## Cosa funziona ora — con la prova
- 32 test di accettazione del giro 008 verdi; `./mvnw verify`: 141 test, 0 falliti (revisore: 147 con sonde di concorrenza).
- 5 mutazioni su 5 prese; 6 scenari di concorrenza × 10 ripetizioni senza 5xx.

## Cosa non funziona ancora
- P7–P9, schermate dei task, Playwright, task demo: T5 parte 2.
- T4 e T5 non sono passati: serve un giro verifica-produzione dopo T5.
- `idInUse` è applicativo, non vincolo del database (minore, UUIDv7).
- `seq` del change_log non è contiguo né ordinato tra famiglie (nota per T9).

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** test di supporto toccato (bfe4c1f); budget alzato nel piano; `idInUse` applicativo; `pr_guard` bloccato nella sua copia (eseguito dall'orchestratore). Nel rapporto, non corretti.
- **PERIMETRO:** 0 fuori perimetro.
- **CONCORRENZA:** verde.
- **MUTAZIONI:** provate 5, prese 5.

## Ricerca e critica
Nessuna ricerca. Critica: 4 punti accolti (scappatoia P3, registrazione di Acero, test del fuso/ora legale, `id_conflict` nei due versi).

## Proposte al metodo
nessuna
