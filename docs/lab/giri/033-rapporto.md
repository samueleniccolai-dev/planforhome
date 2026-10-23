---
giro: 033
traguardo: T10
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-23T08:09:21Z
fine: 2026-10-23T09:36:52Z
pr: 47
ricerca_fonti: 5
critico_da_correggere: 5
critico_accolti: 11
revisore_bloccanti: 0
revisore_dubbi: 5
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 5
mutazioni_prese: 4
verify_rossi_locali: 0
test_totali: 521
test_delta: 20
decisioni_registro: 2
decisioni_ratifica: 0
porte_senso_unico: 1
riparazioni: 0
difetti: 033:minore
proposte_metodo: nessuna
---
# Rapporto del giro 033 — registrazione del telefono Android e apertura del task dalla notifica

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/033-agenti.json. -->

> **PR:** #47 · **Branch:** `claude/giro-033-t10` · **Traguardo:** T10 — Fatto quando verde, da
> verificare in produzione (fetta 3/3; resta la prova sul telefono, a cura dell'umano)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- L'app Android chiede il permesso delle notifiche, crea il canale «Promemoria», legge il token FCM e lo registra sul server (`POST /api/me/devices`), anche dopo un riavvio o quando torna la rete.
- Toccare la notifica apre `/tasks?task=<id>`: il task appare in «Aperto dalla notifica»; se non c'è più, un avviso.
- Il server mette `channel_id = "reminders"` in ogni messaggio FCM (una riga).
- Dipendenza nuova `expo-notifications ~58.1.5` (tua risposta A, decisione 108).
- **Revisione umana** (pr_guard): tocca `app/package.json`, il lock e `app/app.json`; inoltre `033-agenti.json` non ha le voci di revisore e orchestratore (modello-inatteso). Il giro non tocca `.github/`: la PR #48 dei workflow è già su main.
- **Da fare tu:** `aapt dump permissions` sull'APK per `POST_NOTIFICATIONS` (il prebuild non lo mette nel manifest del progetto: lo porta la libreria, da confermare); prova sul telefono (permesso, sollecito nel canale, tocco ad app chiusa e aperta).
- Ratifiche: nessuna.

## Cosa funziona ora — con la prova
- Accettazione 19/19 Playwright (R1–R9, O1–O4, A1, W1–W5) e C1 sul server; `./mvnw verify` 384 test; Jest 114/114; tsc ed eslint puliti; `expo export` web ok.
- Concorrenza: 10 `ensure()` paralleli → una POST; token ruotato in volo → POST in serie (sonde P1–P3 del revisore).
- Task di un'altra famiglia nell'URL: non si vede, alert (W3).

## Cosa non funziona ancora
- Nessuna prova su telefono vero; `POST_NOTIFICATIONS` non verificato sull'APK.
- Il token resta sul server dopo il logout (SPEC §9, rischio aperto). Passaggio Anna→Luca: al più un invio in più.
- Dubbio 2: «ricorda solo dopo un 2xx» senza test (mutazione M4 non presa).
- Dubbio 3: se il layout si rimonta, la stessa notifica può navigare due volte (minore).
- Dubbio 4: se `getDevicePushTokenAsync()` non risolve mai, le registrazioni successive restano ferme fino al riavvio (minore).
- Difetto maggiore del 032 (`due_at > now` in `deletePending`) ancora aperto. Apertura del task offline fuori perimetro.

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** 5 (nessuno corretto, tutti nel rapporto; vedi sopra).
- **PERIMETRO:** nessuna aggiunta; contro origin/main nessun file di `.github/`.
- **CONCORRENZA:** P1–P3 ok, P4 doppia navigazione al rimontaggio.
- **MUTAZIONI:** provate 5, prese 4.

## Ricerca e critica
Ricerca di seconda mano (WebFetch non ha raggiunto docs.expo.dev): versione, token nativo senza `projectId`, canale prima del permesso. Critica: tutti i punti accolti; server già fatto, rotta con evidenza, serializzazione di `ensure()`, `channel_id` lato server.

## Proposte al metodo
nessuna

## Prossima fetta
Giro `verifica-produzione` di T10 (notifica a un dispositivo di prova, `reminder.result` con l'id FCM); prima la tua prova sul telefono.
