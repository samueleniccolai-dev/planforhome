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
