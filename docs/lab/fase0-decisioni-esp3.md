# Fase 0 dell'esperimento 3 — registro delle proposte

Una riga per ogni proposta di Claude nella fase 0 (24/10/2026, due blocchi di domande in chat più
le proposte del cancello). Esito: **accettata**, **cambiata** o **respinta**, con il perché. Serve
alla soglia P6 di `docs/ESPERIMENTO.md`. Gli esiti delle righe 10–16 sono stati confermati
dall'umano al cancello («procedi pure», 24/10/2026 21:15).

| # | Data | Fase | Proposta | Esito | Perché |
|---|---|---|---|---|---|
| 1 | 24/10/2026 | blocco 1 | Traguardi = le 6 fette UI-1…UI-6 di PIANO-UI §4 più due traguardi dalle spec dell'umano (colore+icona; vista calendario); i 3 minori della caccia 040 come primo traguardo «UI-0 bonifica» | accettata | |
| 2 | 24/10/2026 | blocco 1 | Soglie: riuso della primaria e di P1–P6 con le correzioni di conteggio di CONCLUSIONI §8 (ESPERIMENTO §4) | accettata | |
| 3 | 24/10/2026 | blocco 1 | Lingua del web: vince quella dell'account, quella del browser solo prima del login (osservazione 6 del 23/10) | accettata | |
| 4 | 24/10/2026 | blocco 1 | Lavoro dal telefono: moduli e risposte gestibili da mobile, senza sessione assistita obbligatoria | accettata | «basta gestibili da mobile» (risposta del 24/10) |
| 5 | 24/10/2026 | blocco 1 | Cartografo dentro l'esperimento 3 come registro di schede per le decisioni | cambiata | l'umano lo allarga a bussola di studio: percorsi per progetto (concetti e dove studiarli) più le schede; v1 da migliorare usandola |
| 6 | 24/10/2026 | blocco 2 | Forma del cartografo: repository privato dell'umano, percorsi + schede + indice; la catena non lo legge mai; tempo di studio a `studio` in tempo-umano.csv, fuori da P1 | accettata | repo `Cartografo` creato e popolato (v1) il 24/10 |
| 7 | 24/10/2026 | blocco 2 | Popolamento del cartografo: lo crea l'umano, lo popola la sessione assistita | accettata | |
| 8 | 24/10/2026 | blocco 2 | Icona per membro: emoji libera, ognuno sceglie la propria; il gestore per le risorse senza account; tinta solo dalla palette chiusa | cambiata | l'umano la estende a **ogni risorsa** (ogni utente è una risorsa): entra così nel traguardo T18 |
| 9 | 24/10/2026 | blocco 1 | Tema scuro su Android con `expo-system-ui` (porta a senso unico) invece della preferenza in-app | accettata | DESIGN §8; a verbale in SPEC §14.1 n. 8 |
| 10 | 24/10/2026 | cancello | Semantica del PUT (minore 040, T11): i campi omessi conservano il valore; azzerare richiede il valore nullo esplicito | accettata | dal registro n. 99 dell'esp. 2: la decisione mancava; confermata al cancello |
| 11 | 24/10/2026 | cancello | Un modulo di merge che comincia con «🤖» (sessione assistita su richiesta dell'umano) conta: è il canale previsto dal telefono | accettata | CONCLUSIONI §8 (PR #15); confermata al cancello |
| 12 | 24/10/2026 | cancello | Modulo sulle PR umane con `riferimento: spec / meccanismo / integrazione <nome>`; `raccogli.py` lo scrive in `metrics/moduli-pr-umane.csv` e `statistiche.py` lo somma | accettata | CONCLUSIONI §8 (PR #43, #48); confermata al cancello |
| 13 | 24/10/2026 | cancello | In verifica un atteso sbagliato del piano non è un bloccante né un difetto; `difetto_di` è il giro d'origine, mai il giro di verifica o di caccia | accettata | CONCLUSIONI §8 («bug»); confermata al cancello |
| 14 | 24/10/2026 | cancello | La `domanda` di prova umana (telefono) conta come domanda ma non in `porte_senso_unico` | accettata | CONCLUSIONI §8 (giri 037, 039); confermata al cancello |
| 15 | 24/10/2026 | cancello | Guard (giro 029): «codice cambiato dopo la revisione» conta solo i file che cambiano anche nel diff della PR (`base...head`), così un merge di `main` nel branch non basta per la revisione umana | accettata | bug: ha fermato il giro 029; confermata al cancello |
| 16 | 24/10/2026 | cancello | Guard (giro 038): tra i percorsi di accettazione dell'app entrano i soli file `*.acceptance.test.*` sotto `app/src` (non tutte le cartelle `__tests__`, che servono anche ai test unitari) | cambiata | proposta del giro 038, ristretta in fase 0; confermata al cancello |

## Rimandate (fuori dal conteggio di P6)

- Giri 001 e 002: ridurre le segnalazioni del guard senza un rischio vero (due traguardi in un
  giro; voce doppia nel registro). Rumore tollerabile: si riapre se torna a costare.
- Giro 005: nota sul limite per IP nelle prove da sessioni cloud (una sola connessione TCP), da
  aggiungere al modello del piano di verifica alla prima occasione utile.
