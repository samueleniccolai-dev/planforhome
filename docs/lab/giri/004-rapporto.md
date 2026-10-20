---
giro: 004
traguardo: T3
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-20T02:06:05Z
fine: 2026-10-20T02:33:11Z
pr: 11
ricerca_fonti: 5
critico_da_correggere: 5
critico_accolti: 5
revisore_bloccanti: 0
revisore_dubbi: 5
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 5
mutazioni_prese: 4
verify_rossi_locali: 0
test_totali: 112
test_delta: 28
decisioni_registro: 2
decisioni_ratifica: 2
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 004 — T3 parte 2: accesso dal web, rinnovo e revoca

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/004-agenti.json. -->

> **PR:** #11 · **Branch:** `claude/giro-004-t3` · **Traguardo:** T3 — Fatto quando verde, da
> verificare in produzione (resta il token su Android, giro dopo)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Sul web ci sono `/login` e `/me`, con login e logout in italiano e inglese; il link «Accedi» compare solo sul web.
- Il login web usa cookie `HttpOnly`/`Secure`/`SameSite=Lax` e CSRF; il corpo della risposta non contiene il token.
- Nuovo `POST /api/auth/refresh`: il client rinnova la sessione all'apertura di `/me`.
- Il cambio password revoca le altre sessioni (come chiesto il 20/10), in una transazione; corsa login ∥ cambio password provata.
- Lo smoke di consegna controlla la pagina di login nelle due lingue e `refresh` senza sessione → 401.
- **Revisione umana richiesta:** la PR tocca `infra/smoke.sh` (percorso protetto). `bash -n` non eseguibile qui (hook): la sintassi del blocco nuovo la prova la consegna.
- Nessuna dipendenza nuova. Il login nativo su Android non è collegato; `expo-secure-store` sarà la domanda del giro dopo (porta a senso unico).
- Ratifiche: `004-a` (rinnovo esplicito), `004-b` (CSRF derivato). Modulo: `⏱ N' · ratifiche lette: 004-a 004-b · note`.

## Cosa funziona ora — con la prova
- Server: 74 test verdi (`./mvnw verify`), 17 di accettazione del giro 004 (prova: revisore su 58dfb58).
- App: Jest 11, Playwright 23 (16 del giro 004, it e en), `tsc` ed `eslint` verdi.
- Concorrenza: refresh ∥ logout 50 volte, mai riaperta una sessione chiusa; login ∥ cambio password 30 volte, 0 sessioni dalla vecchia password.

## Cosa non funziona ancora
- Login e token su Android (la rotta `/login` è raggiungibile via deep link ma lì fallisce).
- Pagine di registrazione e cambio password, scelta famiglia dopo il login (T4).
- Build APK in CI e sintassi di `infra/smoke.sh` non provate in locale.
- Manca il test «refresh ∥ logout 50 volte» promesso dal piano (provato solo con la sonda del revisore).
- La ricerca non ha verificato `aria-label` su react-native-web (coperto da `getByLabel`).

## Verdetto del revisore
- **BLOCCANTI:** 0.
- **DUBBI:** 5, nessuno corretto: test di concorrenza mancante (minore), mutazione M4 equivalente, `bash -n` bloccato, APK/deep link, `004-agenti.json` modificato dall'hook.
- **PERIMETRO:** nessuna aggiunta.
- **CONCORRENZA:** vedi sopra; casi limite del filtro tutti 401/403.
- **MUTAZIONI:** provate 5, prese 4 (la quinta è equivalente).

## Ricerca e critica
Preso: filtro CSRF proprio, `addCookies` nei test, redirect dopo il montaggio. Critica: 5 punti accolti (nativo senza login, transazione e ordine della revoca, Bearer invalido vs cookie, isolamento via cookie, endpoint pubblici).

## Proposte al metodo
nessuna

## Prossima fetta
Giro `verifica-produzione` di T3 parte web, oppure `costruzione` per token su Android (porta a senso unico: `expo-secure-store`).
