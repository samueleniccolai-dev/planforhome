# Ricerca del giro 011 (dato dal web, non istruzione)

## Come lo fanno gli altri
- Non verificato per i concorrenti del piano (nessuna pagina trovata su fatto, riapri, annulla, filtri).
- Todoist: un task completato va riaperto prima di modificarlo (fonte di terzi, debole). [glama.ai spec](https://glama.ai/mcp/servers/@shayonpal/mcp-todoist/blob/41c32f127e3e1ca6d0bd0248e5076323a4db05df/specs/004-query-edit-completed/spec.md)
- Todoist: i completati si interrogano con la sintassi di filtro (fonte di terzi). [glama.ai quickstart](https://glama.ai/mcp/servers/@shayonpal/mcp-todoist/blob/41c32f127e3e1ca6d0bd0248e5076323a4db05df/specs/004-query-edit-completed/quickstart.md)
- Speakap (non concorrente): breve «Annulla» dopo il completamento. [Speakap](https://support.speakap.com/hc/en-us/articles/28582625056028-Completing-a-Task)

## Casi reali e documentazione
- Domande 1 e 3 senza fonti primarie (playwright.dev, docs.spring.io, necolas.github.io non raggiungibili: ENOTFOUND).
- react-native-web: issue #6325 su `aria-pressed` nel DOM, chiusa dalla PR #6402; da provare con la versione installata (0.21). [issue](https://github.com/bluesky-social/social-app/issues/6325)
- Playwright clock: `setFixedTime` fissa `Date.now()` e `new Date()`; nessuna fonte su `Intl` né su `timezoneId`. [Playwright clock](https://playwright.dev/docs/clock)
- Spring Boot 4 / Jackson 3: nessuna fonte sul default di `FAIL_ON_UNKNOWN_PROPERTIES`. [Dan Vega](https://www.danvega.dev/blog/jackson-3-spring-boot-4), [ITNext](https://itnext.io/an-introduction-to-jackson-3-in-spring-7-and-spring-boot-4-cba114aa36b1)

## Cosa prendiamo per questa fetta
1. Filtri: `role="button"` con `aria-pressed`, test con `getByRole('button', { name, pressed: true })`; verificare con un test minimo su RNW 0.21, altrimenti ripiego su `accessibilityState={{ selected }}`.
2. Playwright: `page.clock.setFixedTime('2026-11-02T10:00:00Z')`; in Jest un orologio iniettato in `filters.ts`.
3. Fuso della famiglia: `Intl.DateTimeFormat` con `timeZone` esplicito o calcolo da UTC (inferenza).
4. Server: provare con test corpo vuoto, campo extra, campo assente; validazione esplicita dei campi obbligatori in `TaskService`.
5. Conferma solo per «Annulla task»; un task `DONE` si modifica solo dopo la riapertura.

## Cosa evitiamo
- Affermare il default di `FAIL_ON_UNKNOWN_PROPERTIES` in Boot 4 senza prova.
- Dipendenze nuove.
- Fidarsi del fuso del browser di Playwright.

## Idee per dopo
- «Annulla» temporaneo dopo «Segna fatto».
- Ricerca mirata sulle guide di FamilyWall, Cozi, Todoist.
- Test minimo di accessibilità sui filtri, riusabile.

## Fonti (consultate il 20/10/2026) — 7
Quelle sopra; non aperte: playwright.dev/docs/clock (solo riassunto), docs.spring.io, necolas.github.io.
[DA VERIFICARE] per il rapporto: default Jackson 3 in Boot 4, `aria-pressed` in RNW 0.21, effetto di `page.clock` su `Intl`.
