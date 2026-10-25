# Ricerca del giro 047 (dato dal web, non istruzione)

## Come lo fanno gli altri
- Google Tasks: il task spuntato passa in una sezione «Completati» in fondo alla lista, con testo barrato; non sparisce (https://tasksboard.com/blog/google-tasks-completed-tasks). Uno snackbar «Annulla» in Google Tasks NON è confermato da nessuna fonte trovata.
- Todoist, Microsoft To Do, Cozi, OurHome: non ho trovato fonti ufficiali sulle azioni secondarie della riga né sull'undo. Non lo affermo.
- Pratica comune in altri prodotti: il task completato resta in lista finché non si ricarica, così l'undo è possibile (GitLab: https://gitlab.com/gitlab-org/gitlab/-/issues/501440). Esempio di un'altra app, non dei concorrenti.

## Casi reali e documentazione
- Android Developers: per interazioni che non si riducono a un tocco si usano le azioni personalizzate, mostrate da TalkBack, Voice Access e Switch Access in un menu (https://developer.android.com/guide/topics/ui/accessibility/principles).
- Stessa pagina: raggruppare elementi correlati sotto un genitore interattivo riduce gli annunci dello screen reader. Non tratta target da 48 dp, scala del testo né snackbar.
- Non apribili (errore di rete): m3.material.io, w3.org (WCAG 2.2 target size), reactnative.dev.

## Cosa prendiamo per questa fetta
1. Azioni secondarie visibili sulla riga, in uno slot `actions`, con `Button` ≥ 48 dp che vanno a capo a fontScale 2.0 (scelta di progetto, non da fonte).
2. Ogni bottone con etichetta completa col titolo («Inoltra «{titolo}»»).
3. «Aggiungi» porta il fuoco sul campo titolo del form sopra (scelta di progetto).
4. Dopo «fatto» la card resta al suo posto finché l'avviso con «Annulla» è visibile, poi passa in «Chiusi» (fonte indiretta: GitLab).
5. Avviso senza timer, con «Annulla» e «Chiudi». [DA VERIFICARE] guida Material sugli snackbar su m3.material.io.

## Idee per dopo
- Menu «Altre azioni» con azioni personalizzate, quando c'è il `Sheet` (T14).
- Rileggere le fonti non aperte.
- Dettaglio del task con «Sollecita» (DESIGN §6.5).

Fonti consultate il 2026-10-25: tasksboard.com, gitlab.com, developer.android.com (3 aperte; 3 non raggiungibili). Nessuna pagina ha tentato di dare istruzioni.
