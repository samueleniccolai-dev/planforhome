---
giro: 023
traguardo: T9
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-21T16:51:37Z
fine: 2026-10-21T17:25:41Z
pr: 33
ricerca_fonti: 0
critico_da_correggere: 3
critico_accolti: 3
revisore_bloccanti: 0
revisore_dubbi: 3
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 4
mutazioni_prese: 4
verify_rossi_locali: 0
test_totali: 334
test_delta: 16
decisioni_registro: 3
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 023 — T9 parte 1: API di sincronizzazione sul server

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/023-agenti.json. -->

> **PR:** #33 · **Branch:** `claude/giro-023-t9` · **Traguardo:** T9 — parziale (solo la parte server; manca il motore di sync del client)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Nessun cambiamento visibile a chi usa l'app: è l'API che il telefono userà per la sincronizzazione.
- Nuovi: `GET /api/sync/families/{f}/snapshot` (fotografia) e `.../changes?after=&limit=` (lettura per `seq`).
- Il `PUT` del task accetta `version` facoltativa: se è vecchia, 409 `version_conflict` con lo stato attuale.
- Un task inoltrato esce dalla famiglia di partenza solo come cancellazione, senza titolo né voci.
- Revisione umana attesa dal guard: toccati file di `task/` e `DECISIONI.md` (decisioni 78–80, tutte `registro`).
- Ratifiche: nessuna. Nessuna porta a senso unico, nessuna dipendenza, nessuna migrazione.
- Resta per T9: motore di sync del client con test Jest e SQLite su Android. SQLite richiede una dipendenza npm nuova (es. `expo-sqlite`): sarà una porta a senso unico nel giro che la usa.

## Cosa funziona ora — con la prova
- Coda rimandata due volte, lettura per `seq` con cancellazioni, fotografia per chi entra, conflitto in cui vince il primo, modifica non più permessa valutata sullo stato vero, isolamento (prova: `Giro023Sync*AcceptanceTest`, 16 test; `./mvnw verify` verde, 334 test).
- Isolamento parametrico tra famiglie sui due endpoint nuovi (`Giro003IsolationAcceptanceTest`).

## Cosa non funziona ancora
- Motore di sync del client, SQLite e coda offline su Android, spunte offline, pulizia dei dati di una famiglia persa: non fatti.
- All'inoltro la famiglia di partenza riceve il `DELETE` del task ma non delle sue voci: il client dovrà cancellarle a cascata (dubbio 2 del revisore).
- `deletedAt` di un'entità spostata è l'istante dell'ultima riga della pagina, non quello del trasferimento (minore).

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** 3 (cascata voci nel client, `deletedAt` di entità spostata, `pr_guard` non eseguito dal revisore per un blocco dell'hook); nessuno corretto, vanno nel giro del client.
- **PERIMETRO:** nessuna aggiunta fuori perimetro.
- **CONCORRENZA:** 4 sonde (`PUT` paralleli con stessa `mutationId`, fotografia contro scritture, inoltro contro nuova voce, inoltro ripetuto): tutte verdi.
- **MUTAZIONI:** provate 4, prese 4.

## Ricerca e critica
Nessuna ricerca. Critico: 3 punti da correggere, tutti accolti (fuga dall'inoltro, ordine dei controlli del `PUT`, paginazione); accolti anche i punti «più semplici» e i facoltativi.

## Proposte al metodo
nessuna

## Prossima fetta
Giro 024: T9 parte 2, motore di sync del client (porta a senso unico per SQLite).
