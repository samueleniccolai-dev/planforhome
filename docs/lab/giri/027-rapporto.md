---
giro: 027
traguardo: T9
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-22T06:00:03Z
fine: 2026-10-22T06:53:57Z
pr: 37
ricerca_fonti: 5
critico_da_correggere: 5
critico_accolti: 5
revisore_bloccanti: 0
revisore_dubbi: 2
dubbi_corretti: 2
fuori_perimetro: 0
mutazioni_provate: 3
mutazioni_prese: 2
verify_rossi_locali: 0
test_totali: 568
test_delta: 17
decisioni_registro: 4
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 027 — task su Android via coda e avviso discreto

> **PR:** #37 · **Branch:** `claude/giro-027-t9` · **Traguardo:** T9 — Fatto quando verde, da verificare in produzione (resta la prova dell'APK su telefono)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Su Android la schermata della famiglia legge i task dall'archivio locale; crea, assegna, prendi, fatto e inoltra passano dalla coda e funzionano in aereo.
- Se il server rifiuta (per esempio «Già preso da Luca Rossi») compare un avviso discreto, che si chiude da solo al comando successivo o con «chiudi».
- Riapri, annulla e termina la serie restano online e sono disabilitati offline; `/tasks` su Android resta online.
- Server non toccato, nessuna dipendenza nuova, nessun percorso protetto. Nessuna ratifica.
- Da fare a mano: provare l'APK (aereo, «prendi» e «fatto», rete su, avviso entro 60 s, TalkBack) e controllare il job `apk` della CI.

## Cosa funziona ora — con la prova
- 16 test di accettazione verdi (`app/e2e/acceptance/giro-027-android-tasks.spec.ts`); Jest 111/111 anche a cache vuota; `tsc` ed `eslint` puliti; Playwright completo 269/269; server `verify` 330 test.
- Scadenza di sola data corretta nel fuso, anche sul 25/10/2026 (cambio ora); rubrica per famiglia senza collisioni tra famiglie.

## Cosa non funziona ancora
- Prova su telefono reale non fatta; `role="status"` su Android non verificato in RN 0.88 (copre `accessibilityLiveRegion`).
- Persone non aggiornate dopo lo snapshot finché la famiglia non è riletta; `/tasks` su Android online; esiti persi se si lascia la schermata prima del ciclo.
- Una mutazione (`title: null`) non è presa dai test: marginale.

## Verdetto del revisore
- **BLOCCANTI:** 0.
- **DUBBI:** 2 corretti (timeout a cache fredda; test sul filtro di `rows()`); resta `title: null`.
- **PERIMETRO:** nessuna aggiunta; ~460 righe di produzione.
- **CONCORRENZA:** 4 sonde verdi (cicli paralleli, enqueue durante sync, conflitto tra due telefoni, inoltro seguito da «fatto»).
- **MUTAZIONI:** provate 3, prese 2 (sul verdetto finale).

## Ricerca e critica
Presi tutti e 5 i punti della critica e il resto; scartato `/tasks` offline. Dalla ricerca: avviso in linea non a tempo con tre proprietà di accessibilità.

## Proposte al metodo
nessuna

## Prossima fetta
Prova dell'APK da parte dell'umano, poi giro `verifica-produzione` di T9.
