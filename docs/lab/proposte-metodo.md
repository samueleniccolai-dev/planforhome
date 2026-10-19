# Proposte di modifica al metodo

Gli agenti non toccano le proprie regole (i percorsi protetti di `progetto.yml`: `.github/`,
`.claude/`, `scripts/`, METODO, ESPERIMENTO…). Se un giro trova un problema del meccanismo, lo
scrive qui. Ogni rapporto ha la riga obbligatoria `proposte_metodo:` (testo breve oppure
«nessuna»): se c'è una proposta, finisce anche in questa tabella. Durante l'esperimento si
correggono solo i bug del meccanismo (`docs/ESPERIMENTO.md`), con una PR umana.

| Data | Giro | Problema osservato | Proposta | Bug o miglioria? |
|---|---|---|---|---|
| 19/10/2026 | 000 | Il guard blocca anche `bash -n` ed esecuzioni a mano degli script `infra/` che nominano variabili di segreti; i controlli del «Fatto quando» a mano non sono eseguibili dai giri | Scrivere i controlli di script come test (Java), non come comandi a mano nel piano | miglioria |
