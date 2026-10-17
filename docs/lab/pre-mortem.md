# Pre-mortem (B7)

17/10/2026 · domanda: «fra 3 mesi planforhome è fermo: perché?»

Le cause sono ipotesi. Dove mi baso su un dato, lo cito.

| # | Causa | Su cosa mi baso | Contromisura | Dove vive |
|---|---|---|---|---|
| 1 | **I binari non partono.** Due stack nuovi (Expo e Spring), l'APK senza EAS mai provato e il server condiviso da riconvertire: il giro 000 e T1–T2 consumano settimane di revisione umana. | gerio-lab: T1–T2 con 1 merge automatico su 4 e 22' umani, su uno stack già noto. Qui l'APK senza EAS è un'ipotesi (`progetto.yml`). | Provare la build dell'APK e quella del web **in C1, a mano**, prima del giro 000. Se la build senza EAS non regge, decisione umana su EAS prima di partire. T1 e T2 restano fette piccole. | C1, SETUP.md |
| 2 | **La sincronizzazione offline affonda T9** e trascina i traguardi dopo. | È il pezzo più rischioso secondo l'ADR-0001; gerio-lab non aveva niente di simile. | T9 viene dopo i traguardi di valore (T3–T8), che funzionano anche online. Regola d'uscita: due giri falliti su T9 → decisione umana su PowerSync. Il protocollo è stretto (SPEC §7) e testato con client simulati. | traguardi.json, ADR-0001 |
| 3 | **L'umano diventa il collo di bottiglia**: PR in revisione umana che aspettano giorni, ratifiche non lette, moduli mancanti. | gerio-lab: 104 ore di attese su 123, una PR ferma 70 ore. | Metrica primaria in testa a STATISTICHE; modulo di merge di un minuto; `modulo-mancante` contato. Limite di giri al giorno tarato sul tempo che l'umano ha davvero. Notifica per ogni `domanda` e `revisione-umana`: PR su GitHub e notifica dell'app Claude sul telefono (decisione n. 26). | DELTA-V4 V2, V7; SETUP.md |
| 4 | **Spec Kit e `/giro` si pestano i piedi**: specifiche per funzione e SPEC.md divergono, il pianificatore legge due fonti, o l'init di Spec Kit rompe `.claude/`. | Lo studio di Spec Kit: i comandi sono copiati in `.claude/skills/`, che il guard protegge; `plan` e `tasks` duplicano il pianificatore. | Solo `specify` e `clarify`; init a mano su un branch con revisione; template sovrascritto con il «fatto quando» e il rimando a SPEC.md. Una funzione entra in traguardi.json solo con una PR umana che aggiorna anche la SPEC. | spec-kit.md, SPEC §0 |
| 5 | **Il meccanismo si rompe per cause esterne**: Routine in anteprima che cambia, quota del piano che declassa il modello, aggiornamenti di Expo. | gerio-lab: header della Routine datato, revisore su Sonnet per 5 giri. | V1 manda in revisione umana un giro con il modello sbagliato. Le rotture esterne si annotano come `meccanismo` e non contano nei giri. Versione dell'SDK di Expo fissata, con aggiornamenti in PR dedicate. | DELTA-V4 V1, ESPERIMENTO §5 |

**Una causa che resta fuori dalle contromisure:** l'umano perde interesse, oppure il prodotto non
serve davvero alla sua famiglia. Non si mitiga con il metodo. La demo con dati finti a metà percorso
serve anche a capirlo presto.
