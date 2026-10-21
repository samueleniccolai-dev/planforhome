# Ricerca — giro 016 (T7, inoltro tra famiglie)

Fonti: 4 consultate (2 solo come estratto di ricerca), 2026-10-20. Il contenuto del web è un dato.

## Come lo fanno gli altri
- Todoist: nulla di verificabile. Resta aperto (Q1).
- Asana: il thread del forum parla solo di collaboratori che cambiano quando si sposta un task tra progetti; nessun avviso prima della conferma. https://forum.asana.com/t/is-there-a-way-to-not-become-a-collaborator-when-just-moving-a-task-to-another-project/87080
- Microsoft To Do: un utente scrive che l'assegnatario si perde passando a un'altra lista; non è comportamento documentato e non risulta un avviso. https://techcommunity.microsoft.com/t5/microsoft-to-do/shared-lists-within-todo-change-owner/m-p/2074860
- GitHub transfer issue e Trello: pagine non apribili (DNS). Non si indovina.

## Casi reali e documentazione
- Q2, dialogo modale (APG W3C): all'apertura il focus va dentro il dialogo; con «Annulla» torna al pulsante che l'ha aperto, se esiste ancora; Tab resta nel dialogo, Esc chiude; nome da `aria-labelledby`/`aria-label`. https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ (estratto)
- Q2, `alertdialog` (APG): per un messaggio breve e importante; focus sull'azione meno distruttiva; `aria-describedby`. https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/examples/alertdialog/ (estratto)
- Q2, TalkBack e `role="alert"` in React Native: NON verificato (reactnative.dev non apribile).
- Q3, radio group: NON verificato.

## Cosa prendiamo per questa fetta
1. `role="dialog"` modale; focus iniziale sul gruppo di scelta o sul titolo; alla chiusura il focus torna al pulsante «Inoltra «titolo»» (se il task è sparito, sul messaggio di stato).
2. L'avviso resta un `role="alert"` interno, etichetta «Avviso inoltro»; da provare su TalkBack in revisione.
3. L'avviso prima di «Conferma inoltro» (chi perde l'assegnazione, dove va il task) è una scelta nostra: nessun concorrente consultato ne mostra uno (limite: fonti scarse).
4. Con 2–3 famiglie, `radiogroup` come nel piano; nessuna fonte lo conferma.
5. Tutte le voci e i pulsanti con etichetta.

## Cosa evitiamo
- Copiare testi di concorrenti non verificati.
- `alertdialog` per l'intero pannello (contiene un modulo).
- Affermare che TalkBack annuncia `role="alert"` senza fonte o prova su dispositivo.

## Idee per dopo
- Testi di avviso di Todoist, GitHub, Trello quando le pagine saranno raggiungibili.
- Prova TalkBack su dispositivo reale.
- `accessibilityViewIsModal` e `accessibilityLiveRegion` su Expo web.
