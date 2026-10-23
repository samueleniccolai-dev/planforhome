---
giro: 038
traguardo: T10
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-23T18:51:40Z
fine: 2026-10-23T19:13:55Z
pr: 54
ricerca_fonti: 7
critico_da_correggere: 4
critico_accolti: 4
revisore_bloccanti: 0
revisore_dubbi: 2
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 2
mutazioni_prese: 2
verify_rossi_locali: 0
test_totali: 555
test_delta: 2
decisioni_registro: 2
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: Il guard non protegge i test Jest in app/src/**/__tests__/ come accettazione.
---
# Rapporto del giro 038 — canale Promemoria ad alta importanza

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/038-agenti.json. -->

> **PR:** #54 · **Branch:** `claude/giro-038-t10` · **Traguardo:** T10 — Fatto quando verde, da
> verificare in produzione (serve la prova sul telefono)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Il canale «Promemoria» ora nasce con importanza ALTA (6): suono e banner. Prima era 4 = BASSA, il difetto del giro 037.
- Cambia una riga in `app/src/push/registration.ts`. Server invariato.
- **Da fare per la prova:** Android non alza l'importanza di un canale già creato. Disinstalla l'APK dal telefono, installa quello nuovo, rifai il login e controlla in Impostazioni › App › Notifiche che «Promemoria» sia ad alta importanza.
- L'id del canale resta `reminders`: i test 033/035 lo fissano. Un id nuovo richiede una PR tua.
- La PR va in revisione umana (il guard segnala `docs/lab/ux/` arrivato da `main` e i percorsi del giro; vedi proposta di metodo).
- Ratifiche: nessuna.

## Cosa funziona ora — con la prova
- Canale creato con importanza 6 (prova: `giro-038-channel-importance.spec.ts` C1 e C2; con 4 o 5 falliscono).
- Nessuna importanza numerica diversa da 6 in `app/src/push/` (grep del revisore).
- 555 test del revisore verdi (420 server, 114 Jest, 21 Playwright).

## Cosa non funziona ancora
- Non provato sul telefono: suono e banner reali, manifest con `POST_NOTIFICATIONS` (V6).
- I telefoni con il canale già creato restano a importanza bassa finché non si reinstalla.
- Job `apk` della CI non verificato dal revisore.

## Verdetto del revisore
- **BLOCCANTI:** 0
- **DUBBI:** 2 (apk in CI; prova umana sul telefono), nessuno corretto
- **PERIMETRO:** 1 riga di produzione, fuori perimetro 0
- **CONCORRENZA:** nessun percorso di scrittura nuovo
- **MUTAZIONI:** provate 2, prese 2

## Ricerca e critica
Presi 4 punti su 4: test sul modulo vero (importanza scritta in `registration.ts`, senza opzione nuova), grep più forte, passi di verifica dopo la reinstallazione. Fonti: guide Android sui canali (2026-10-23); docs.expo.dev e Firebase non raggiungibili.

## Proposte al metodo
Il guard non protegge i test Jest in `app/src/**/__tests__/` come accettazione.

## Prossima fetta
Giro `verifica-produzione` per T10: reinstallazione, V6 (manifest), prova suono e banner.
