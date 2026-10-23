---
giro: 031
traguardo: T10
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-22T21:42:30Z
fine: 2026-10-22T22:35:51Z
pr: 44
ricerca_fonti: 5
critico_da_correggere: 5
critico_accolti: 5
revisore_bloccanti: 0
revisore_dubbi: 2
dubbi_corretti: 0
fuori_perimetro: 2
mutazioni_provate: 4
mutazioni_prese: 4
verify_rossi_locali: 1
test_totali: 746
test_delta: 33
decisioni_registro: 4
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 031 — sollecito (P12) con invio FCM e segno sul web

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/031-agenti.json. -->

> **PR:** #44 · **Branch:** `claude/giro-031-t10` · **Traguardo:** T10 — parziale (prima di tre fette)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Un gestore può sollecitare un task assegnato: il destinatario riceve una notifica FCM (testo generico, solo `taskId`), con limite di 5 minuti.
- Sul web: pulsante «Sollecita» e segno «Sollecitato alle HH:MM» nel fuso della famiglia.
- Nuovo endpoint `POST /api/me/devices` per i token; migrazione V6 (solo tabelle nuove).
- Nessuna dipendenza nuova. Ma `application.properties` (percorso protetto) ha 2 righe nuove sul pool Hikari: **revisione umana**, da accettare o sostituire (decisione 105).
- Un sollecito alza `version`: una modifica concorrente con la version vecchia riceve 409.
- Il token FCM si può «rubare» a un altro utente registrandolo (dubbio del revisore, da riconsiderare nel giro 033).
- Il timeout vale per ogni chiamata: con molti token l'attesa può arrivare a (N+1)×10 s.
- SPEC §8 chiede il nome della risorsa nella notifica ma anche payload generico: scelta rimandata al giro 032.
- Ratifiche: nessuna.

## Cosa funziona ora — con la prova
- Accettazione 30/30 (27 server + 3 Playwright), `verify` server 357 test, Jest 114, Playwright 272 (revisore, SHA 117d763).
- 4 mutazioni su 4 prese; concorrenza: 8 solleciti paralleli → un solo 200.

## Cosa non funziona ancora
- Promemoria automatici, silenzio notturno (giro 032). Token su Android e apertura dal tocco (giro 033, con DOMANDA su `expo-notifications` e `google-services.json`).
- Sollecito non nella coda offline di Android. Fonti ufficiali FCM non raggiungibili dalla ricerca: i punti [DA VERIFICARE] restano aperti (regola 6).
- Senza referente il sollecito non scrive nessuna riga `reminder`.

## Verdetto del revisore
- **BLOCCANTI:** nessuno
- **DUBBI:** 2 (token riassegnabile; timeout per chiamata), nessuno corretto
- **PERIMETRO:** 2 righe Hikari non previste dal piano
- **CONCORRENZA:** provata, verde
- **MUTAZIONI:** provate 4, prese 4

## Ricerca e critica
Presi tutti e 5 i punti della critica; scartati 401 che svuota la cache e data nel segno (facoltativi).

## Proposte al metodo
nessuna

## Prossima fetta
Giro 032: promemoria automatici e silenzio notturno.
