---
giro: 044
traguardo: T12
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-25T06:45:20Z
fine: 2026-10-25T07:19:36Z
pr: 68
ricerca_fonti: 6
critico_da_correggere: 5
critico_accolti: 5
revisore_bloccanti: 0
revisore_dubbi: 3
dubbi_corretti: 0
fuori_perimetro: 1
mutazioni_provate: 3
mutazioni_prese: 3
verify_rossi_locali: 0
test_totali: 888
test_delta: 0
decisioni_registro: 4
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti: 004:minore,044:minore
proposte_metodo: Il «git add -A» del lucchetto può portare dentro file con fine riga cambiata dall'ambiente (server/mvnw.cmd) e il guard poi ne vieta il ripristino a mano: usare un add mirato.
---
# Rapporto del giro 044 — fondamenta del kit UI (T12)

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/044-agenti.json. -->

> **PR:** #68 · **Branch:** `claude/giro-044-t12` · **Traguardo:** T12 — Fatto quando verde, da
> verificare in produzione (la prova a fontScale 2.0 sul telefono resta al giro di verifica)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Nasce il kit UI: token di DESIGN §3, `Text`, `Button`, `Screen`, `InlineNotice`, `TextField`.
- Nuova galleria `/gallery` (con `?fs=1|1.5|2`), aperta solo in sviluppo e su `localhost`/`127.0.0.1`; in produzione torna a `/`.
- `login.tsx` è rifatta solo con il kit; le altre schermate hanno solo i colori letterali sostituiti da token.
- Nel dialogo di inoltro la famiglia scelta ora usa `accentTonal` (prima si distingueva solo per colore).
- Nessuna dipendenza nuova, server non toccato.
- **Revisione umana probabile:** il commit del lucchetto ha portato dentro `server/mvnw.cmd` (solo fine riga CRLF→LF, nessun effetto). Il guard impedisce di ripristinarlo a mano: puoi ignorarlo o chiedermi un giro.
- Revisione umana anche per: `server/mvnw.cmd` (protetto) e `044-agenti.json` con solo 7 voci (mancano critico, costruttore, revisore, orchestratore: il hook non li ha registrati; il guard segnala «modello-inatteso»).
- La PR tocca `app/e2e/acceptance/` solo con file nuovi del giro (nessun test vecchio modificato).
- Ratifiche: nessuna.

Modulo di merge: `⏱ N' · ratifiche lette: nessuna · note`

## Cosa funziona ora — con la prova
- Token e nessun colore letterale fuori da `tokens.ts` (prova: A1, A2, Jest `tokens`, `no-literal-colors`).
- Galleria con gate e scala del font (prova: A3–A5, A7, A9; Jest `gallery`).
- Login solo-kit, doppio invio bloccato col click umano (prova: A8, `giro-004-login` verde).
- `npx playwright test` 313/313, `npm test` 130 test, `tsc` ed `eslint` puliti; server `verify` 445 verdi (revisore).

## Cosa non funziona ancora
- Prova a fontScale 2.0 sul telefono: rimandata a `verifica-produzione`.
- Tema scuro: fuori da T12 (T16).
- `aria-describedby` dell'errore del campo: facoltativo, non fatto né provato.
- `test_delta` non calcolato (0 per prudenza): i conteggi 042 e 044 non sono confrontabili.

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** (1) `server/mvnw.cmd` solo fine riga, dal commit lucchetto (`044:minore`); (2) due `click()` sincroni nello stesso tick mandano 2 login: c'era già su `main` (`004:minore`), basterebbe una guardia con `useRef`; (3) `gallery.tsx:25` legge `window.location.search` senza controllo `Platform.OS`. Nessuno corretto, vanno a un giro successivo.
- **PERIMETRO:** 522 righe di produzione (limite 700); fuori perimetro solo `mvnw.cmd`.
- **CONCORRENZA:** giro solo UI; sonde Playwright: doppio clic 1 login, Enter doppio 1 login, due click sincroni 2 (già su main).
- **MUTAZIONI:** provate 3, prese 3.

## Ricerca e critica
Concorrenti analizzati: nessuno (domande tecniche su react-native-web, Expo, Android, Okabe-Ito).
Critica: accolti 5/5 — gate e `fs` con `useSyncExternalStore` (rendering statico), scansione esclude i test, `chosen` su `accentTonal`, tetto a 24 file, disattivati provati in Jest. Il [DA VERIFICARE] di Okabe-Ito resta: confermato solo da fonti secondarie il 2026-10-25 (la fonte primaria non si apriva).

## Proposte al metodo
Il «git add -A» del lucchetto può portare dentro file con fine riga cambiata dall'ambiente (server/mvnw.cmd) e il guard poi ne vieta il ripristino a mano: usare un add mirato.

## Prossima fetta
Giro `verifica-produzione` su T12; poi costruzione di T13.
