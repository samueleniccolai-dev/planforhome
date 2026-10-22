# Proposte di modifica al metodo

Gli agenti non toccano le proprie regole (i percorsi protetti di `progetto.yml`: `.github/`,
`.claude/`, `scripts/`, METODO, ESPERIMENTO…). Se un giro trova un problema del meccanismo, lo
scrive qui. Ogni rapporto ha la riga obbligatoria `proposte_metodo:` (testo breve oppure
«nessuna»): se c'è una proposta, finisce anche in questa tabella. Durante l'esperimento si
correggono solo i bug del meccanismo (`docs/ESPERIMENTO.md`), con una PR umana.

| Data | Giro | Problema osservato | Proposta | Bug o miglioria? |
|---|---|---|---|---|
| 19/10/2026 | 000 | Il guard blocca anche `bash -n` ed esecuzioni a mano degli script `infra/` che nominano variabili di segreti; i controlli del «Fatto quando» a mano non sono eseguibili dai giri | Scrivere i controlli di script come test (Java), non come comandi a mano nel piano | miglioria |

- Giro 001: `scripts/lab/traguardo.py` accetta un solo `traguardo` per rapporto di verifica; con `traguardi_extra` il secondo traguardo (T2) non può passare nello stesso giro.

- Giro 002: `pr_guard` segnala `modello-inatteso` quando un revisore si ferma in attesa di lavoro in background e riprende: `NNN-agenti.json` ha due voci con lo stesso `agent_id`. Proposta: ignorare i duplicati dello stesso `agent_id` (vale l'ultima voce).

- Giro 005: le prove sul limite per IP da sessioni cloud vanno fatte su una sola connessione TCP (l'IP di uscita cambia a ogni connessione): lo dica il modello di piano della verifica.

- Giro 029 (22/10/2026, sessione assistita fuori catena) — **bug**. La PR #40 era in conflitto con
  `main` su `docs/lab/DECISIONI.md` (riga n. 98 aggiunta sia dalla PR umana #39 sia dal giro). Con
  un conflitto GitHub non avvia `ci`, quindi `consegna` non decide e la catena si ferma senza
  errori. Risolto il conflitto con un merge di `main` nel branch, `pr_guard` ha mandato la PR in
  `revisione-umana` per «codice cambiato dopo la revisione»: `changes(repo, sha, head)` confronta
  il commit rivisto con la testa a due punti e conta anche i file arrivati da `main` (qui
  `docs/DESIGN.md`, `progetto.yml`). Proposta: contare solo i file che cambiano anche nel diff
  della PR (`base...head`), così un merge di `main` (regola 8 di `CLAUDE.md`) non basta per la
  revisione umana. In più, `/giro` dovrebbe accorgersi di una PR di giro pronta ma in conflitto
  (`mergeable_state: dirty`) e risolverla con un merge di `main`, invece di uscire per WIP = 1.
