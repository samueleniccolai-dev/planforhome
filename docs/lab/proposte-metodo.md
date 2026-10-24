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

- Giro 038: Il guard considera accettazione solo app/e2e/acceptance/ e la cartella acceptance del server: un test Jest in app/src/**/__tests__/ non sarebbe protetto dal costruttore. Proposta: includere quelle cartelle tra i percorsi di accettazione del guard (giro 038).

## Dall'esperimento 2, per l'esperimento 3 (24/10/2026)

Vengono da `docs/lab/CONCLUSIONI.md` §8. Si decidono nella fase 0 dell'esperimento 3; le correzioni
agli script vanno in una PR umana su `scripts/`.

| Problema osservato | Proposta | Bug o miglioria? |
|---|---|---|
| UI e UX fuori dal ciclo: nessun criterio di usabilità nei «Fatto quando» (`traguardi.json`); 6 osservazioni dell'umano (`docs/lab/ux/2026-10-23-osservazioni-umano.md`) | UI e UX nel ciclo, con un criterio verificabile nei «Fatto quando» | miglioria |
| Merge, moduli e risposte dal telefono hanno chiesto una sessione assistita (CONCLUSIONI §5) | Il lavoro dal telefono previsto dal metodo | miglioria |
| In verifica un atteso sbagliato diventa bloccante e difetto (SKILL §7; rapporto 028:34); i giri di verifica scrivono in `difetto_di` il proprio numero | Un atteso sbagliato non è un bloccante; `difetti:` solo per i difetti trovati dopo il merge, con il giro d'origine | bug |
| Segnalazioni del guard senza un rischio vero: 001 (due traguardi in un giro), 002 (voce doppia nel registro), 029 (merge di main) | Ridurle: vedi anche le proposte dei giri 001, 002 e 029 qui sopra | miglioria |
| Lo SPEC cambiato a metà traguardo (PR #28, #46) mescola i suoi costi con quelli del giro | SPEC libero, con i costi contati a parte: riferimento `spec` in `tempo-umano.csv` | miglioria |
| Gli script perdono minuti noti: senza modulo (PR #7, #36), modulo senza ⏱ (PR #7) o con «🤖» di una sessione assistita (PR #15), moduli delle PR umane (PR #43, #48); calendario fino alla caccia e non come ESP:96; prove sul telefono contate come porte (037, 039); media di P1 senza «≥»; divisione del giro 000 non detta | Correggere `raccogli.py` e `statistiche.py` | bug |
| 8 ricerche su 18 non nominano nessuna app dell'elenco del ricercatore; DECISIONI nessuna; solo il rapporto 014 dice cosa ha preso | La riga di DECISIONI e il rapporto dicono quali app sono state analizzate e cosa se ne è preso, o che non ne è stata analizzata nessuna | miglioria |
| In fase 0 l'umano ha accettato anche per fiducia (n. 10, `fase0-decisioni.md`:58) | Il cartografo: un repository privato dell'umano come base di conoscenza, con il tempo di studio in `tempo-umano.csv` (riferimento `studio`, fuori da P1). È un'integrazione nuova: porta a senso unico, da decidere in fase 0 | miglioria |
