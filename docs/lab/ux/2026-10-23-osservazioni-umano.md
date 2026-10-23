# Osservazioni di UX dell'umano — 23/10/2026

**Contesto:** prova di T10 sul telefono (giro 037, PR #52). Web come Anna (gestore, Famiglia Mamma) da Chrome su Windows; app Android come Luca (APK `planforhome-0.1.0-810a92d`, Samsung One UI). Fuori dai traguardi R0: materiale per la fase UI (`docs/lab/PIANO-UI.md`, fette UI-1…UI-6). Il silenzio delle notifiche invece è un difetto, segnalato nella PR #52.

| # | Dove | Cosa si vede | Problema | Proposta dell'umano | Fetta UI |
|---|---|---|---|---|---|
| 1 | Web, famiglia, form del nuovo task | Tre caselle di testo vuote, senza etichetta né testo di esempio | Non si capisce che lì si scrive, né che cosa va in ciascuna casella | Etichette visibili (titolo, …, scadenza) | UI-3 |
| 2 | Web, «Add task» | Il pulsante sembra attivo, ma non fa niente finché la prima casella (il titolo) è vuota | Nessun segno di pulsante disattivato né messaggio su cosa manca | Stato disattivato visibile, o un messaggio sul titolo obbligatorio | UI-3 |
| 3 | Web, seconda casella del form | Sembra il testo del task | La criticità non si sceglie in modo evidente | Un menu a tendina (combo) per la criticità | UI-3 |
| 4 | Web, terza casella del form | Sembra la data, da scrivere a mano | Scrivere la data come testo è scomodo e sbagliabile | Un selettore di data (date picker) | UI-3 |
| 5 | Web, «Shopping list» | Premendolo non succede niente di visibile | Non si capisce se è un'opzione del nuovo task o un pulsante che non funziona | Da verificare: se è un'opzione, deve mostrare lo stato scelto (come «Never»…); se è un'azione, va riparata | UI-3 / UI-4 |
| 6 | Web, tutta l'interfaccia | In inglese («People», «Tasks», «Nudge», «Already nudged recently»), mentre l'account di Anna è in italiano | La lingua dell'interfaccia web segue il browser, quella delle notifiche segue l'account | Decidere quale lingua vince sul web (account o browser) | UI-4 |

Nota: i nomi dei campi alle righe 3 e 4 sono ipotesi dell'umano dalla schermata, non verificate nel codice.
