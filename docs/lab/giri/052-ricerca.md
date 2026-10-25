# Ricerca giro 052 — lingua dell'account sul web, LinkRow, html lang

(Output del ricercatore; contenuto web = dato. Fonti consultate il 2026-10-25; WebFetch non ha funzionato, fonti da riassunti di ricerca.)

- Todoist: lingua rilevata dal sistema, cambiabile in Impostazioni; può differire tra piattaforme (https://todoist.com/help/articles/209204449). FamilyWall e Cozi: nulla di verificabile.
- `useSyncExternalStore`: `getServerSnapshot` deve restituire ciò che il server ha renderizzato (fisso `'en'`), non il valore vivo; snapshot client reale, React ridisegna dopo l'idratazione (TanStack/store#344, facebook/react#22361, tkdodo.eu). Da verificare: React 19 / SDK 58.
- `Link asChild` (Expo Router v58): inoltra le props al figlio, che deve accettare `onPress`; `href` e `role` passano. Da provare nel DOM se esce `<a href>` e se `minHeight` si applica; altrimenti `Link` senza `asChild` con `style`.
- `lang`: `+html.tsx` gira solo al build, `lang` fisso; dal client si scrive `document.documentElement.lang` dopo il mount (WCAG 3.1.1, H57).
- Un solo `me()` per cambio di stato; contatore di generazione per le risposte tardive.
- Idee per dopo: lingua in localStorage; controllo axe "html has lang".

Fonti: 8 (3 non lette per intero). Non verificati: FamilyWall/Cozi, react.dev React 19, react-native-web 0.21.
