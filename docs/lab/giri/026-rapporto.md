---
giro: 026
traguardo: T9
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-21T21:18:43Z
fine: 2026-10-21T22:40:00Z
pr: 36
ricerca_fonti: 7
critico_da_correggere: 5
critico_accolti: 5
revisore_bloccanti: 0
revisore_dubbi: 2
dubbi_corretti: 2
fuori_perimetro: 0
mutazioni_provate: 3
mutazioni_prese: 3
verify_rossi_locali: 0
test_totali: 109
test_delta: 28
decisioni_registro: 5
decisioni_ratifica: 0
porte_senso_unico: 1
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 026 — T9 parte 3: sessione Android e sync cablato

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/026-agenti.json. -->

> **PR:** #36 · **Branch:** `claude/giro-026-t9` · **Traguardo:** T9 — parziale (restano schermate dei task su Android e prova dell'APK; un traguardo passa solo con un giro verifica-produzione)
> **Domande che bloccano:** nessuna (risposta A su `expo-secure-store`, decisione 87)

## Per te, in 10 righe
- Su Android ora c'è una sessione con token (salvato con `expo-secure-store`), un ciclo di sync (avvio, dopo ogni scrittura, ogni 60 s in primo piano, ritorno in primo piano) e la lista della spesa offline: spunte e voci nuove passano dalla coda.
- **Revisione umana richiesta:** `app/package.json` e `app/package-lock.json` (dipendenza `expo-secure-store ~58.0.2`, da te approvata).
- Il token cambia persona solo con pulizia dell'archivio: un telefono passato da Anna a Luca non invia mai le modifiche di Anna col token di Luca (due bloccanti del revisore corretti, con test).
- Da provare sull'APK: login di Anna, modalità aereo, **lista già aperta in aereo**, spunta di latte, rete su, la spunta compare sul web entro 60 s; reinstallazione = nuovo login. Job `apk` della CI da controllare.
- Limite noto: offline su Android il ruolo è sempre `MEMBER` e i nomi «qualcuno»; il server decide comunque.
- Ratifiche: nessuna.

## Cosa funziona ora — con la prova
- Accettazione `giro-026-android-session.spec.ts`: 19/19 (S1–S6c, H1, H2) e intero Playwright 253/253.
- `npm test` 104 Jest, `tsc` ed `eslint` verdi; il revisore finale: 109 test, 3 mutazioni su 3 prese. Server non toccato (`verify` del revisore: 330 test verdi).
- Prova di non-redirect a `/login` offline e di azioni dirette disabilitate (`ShoppingListAndroid.test.tsx`).

## Cosa non funziona ancora
- Schermate dei task su Android via coda, avviso discreto dei task, prova su telefono fisico.
- Job `apk` e `pr_guard` non eseguibili dal revisore; `test-renderer` è usato come dipendenza transitiva di `jest-expo` (se sparisce va dichiarato: porta a senso unico).
- Riordino su Android non ottimistico. Un ciclo che sopravvive ai 5 s di `settle` può scrivere nello store mentre `signIn` lo svuota (le righe poi spariscono col 404): dubbio non bloccante.
- Punti [DA VERIFICARE] della ricerca (cookie di `fetch` su Android, timer JS in background): controllati solo via WebSearch il 21/10/2026; da riverificare sulle pagine ufficiali e sull'APK.

## Verdetto del revisore
- **BLOCCANTI:** 0 finali (2 al primo passaggio e 1 al secondo, tutti risolti: token di Luca usato dal ciclo di Anna; test Jest della lista mancanti; generazione legata al ciclo).
- **DUBBI:** 2 corretti (listener `AppState` doppi, S6c debole) + mock del router.
- **PERIMETRO:** 17 file di produzione (limite 12), 619 righe (limite 650); nessun fuori perimetro.
- **CONCORRENZA:** sonde P1–P6 e varianti; ultimo giro tutto a 0 invii col token sbagliato.
- **MUTAZIONI:** provate 3, prese 3

## Ricerca e critica
Preso: `TokenVault` con try/catch, `currentState ?? "active"`, Bearer senza cookie. Critica: 5 punti accolti (persona nel vault, flag «sporco», lista da `engine.rows()`, timeout e `signOut` locale, azioni dirette bloccate con coda). Scartato: S7 web in Node (coperto da Playwright).

## Proposte al metodo
nessuna

## Prossima fetta
Giro 027: T9 parte 4, schermate dei task su Android via coda; poi verifica-produzione.
