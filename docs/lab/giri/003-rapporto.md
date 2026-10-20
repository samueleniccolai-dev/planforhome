---
giro: 003
traguardo: T3
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-19T21:33:27Z
fine: 2026-10-19T22:06:23Z
pr: 10
ricerca_fonti: 0
critico_da_correggere: 5
critico_accolti: 5
revisore_bloccanti: 1
revisore_dubbi: 4
dubbi_corretti: 2
fuori_perimetro: 0
mutazioni_provate: 7
mutazioni_prese: 7
verify_rossi_locali: 0
test_totali: 59
test_delta: 33
decisioni_registro: 4
decisioni_ratifica: 2
porte_senso_unico: 0
riparazioni: 0
difetti: 003:bloccante
proposte_metodo: nessuna
---
# Rapporto del giro 003 — T3 parte 1: account e accesso sull'API

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/003-agenti.json. -->

> **PR:** #10 · **Branch:** `claude/giro-003-t3` · **Traguardo:** T3 — parziale: solo il lato server
> (il resto del «Fatto quando», web e Playwright, è del giro successivo)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Il server ora ha registrazione (nuova famiglia o codice d'invito), login, logout, `/api/me`, cambio password, `GET /api/families`, membri e creazione codici d'invito.
- Errore identico per email inesistente e password sbagliata, anche nei tempi; limite ai tentativi atomico.
- Dati demo dell'Appendice A (3 famiglie, 11 persone) solo se `DEMO_PASSWORD` è un segreto di ambiente: **va aggiunto ai segreti del server prima del deploy, altrimenti nessun dato demo.**
- Non ancora fatti: pagine di login/logout web, cookie e CSRF, Playwright, smoke della pagina di login, archivio del token su Android (probabile porta a senso unico: `expo-secure-store`).
- **Revisione umana richiesta:** la PR tocca `infra/smoke.sh` e `application.properties` (percorsi protetti). Lo smoke ora controlla `GET /api/families` → 401.
- Da verificare col deploy vero: `forward-headers-strategy=native` dietro Caddy e che Caddy sovrascriva `X-Forwarded-For` di un client.
- Ratifiche: `003-a` (token opaco 30 giorni, BCrypt), `003-b` (limite in memoria). Modulo: `⏱ N' · ratifiche lette: 003-a 003-b · note`.

## Cosa funziona ora — con la prova
- 28 test di accettazione (registrazione 10, login 8, isolamento 5, dati demo 5) verdi; `./mvnw verify` verde, 59 test (prova: revisore su a91633e).
- Limite sotto carico: 30 login sbagliati in parallelo → 5×401 e 25×429, in 3 giri; stesso per i codici.
- Mutazioni: 7 provate, 7 prese.

## Cosa non funziona ancora
- Tutto il lato app/web di T3. Revoca delle altre sessioni al cambio password e limite del login per IP: idee per dopo.
- Il campo «Now: T1» nell'intestazione di `infra/smoke.sh` non è aggiornato; `bash -n infra/smoke.sh` non eseguibile dal revisore (hook).
- `record()` e `retryAfterSeconds()` dell'`AttemptLimiter` restano solo per i test.

## Verdetto del revisore
- **BLOCCANTI:** 1, limite non atomico su login e codici (risolto in 226e32a, riverificato).
- **DUBBI:** NUL nei campi (corretto), test del seeder (aggiunto); restano: 429 a una password giusta in parallelo a 5 sbagliate, posto del codice non restituito su eccezioni diverse (prudenti).
- **PERIMETRO:** nessuna aggiunta.
- **CONCORRENZA:** 8 registrazioni stesse email → 1×201; stesso codice → 1 vincitore; limite atomico.
- **MUTAZIONI:** provate 7, prese 7

## Ricerca e critica
Nessuna ricerca. Critica: 5 punti, tutti accolti (timing e enumerazione, password >72 byte, `Clock` al posto di `now()`, chiave normalizzata del limite, indici).

## Proposte al metodo
nessuna

## Prossima fetta
Costruzione T3 parte 2: pagine di login/logout web, Playwright, smoke della pagina di login.
