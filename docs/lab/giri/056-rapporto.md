---
giro: 056
traguardo: T16
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-26T10:36:01Z
fine: 2026-10-26T11:27:42Z
pr: 80
ricerca_fonti: 7
critico_da_correggere: 4
critico_accolti: 4
revisore_bloccanti: 0
revisore_dubbi: 3
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 3
mutazioni_prese: 3
verify_rossi_locali: 0
test_totali: 1180
test_delta: 46
decisioni_registro: 3
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 056 — T16 parte 2: stati di schermata V8 e `/` in scuro

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/056-agenti.json. -->

> **PR:** #80 · **Branch:** `claude/giro-056-t16` · **Traguardo:** T16 — Fatto quando verde, da
> verificare in produzione (un traguardo passa solo con un giro verifica-produzione)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Dove prima restava lo schermo bianco (`/families`, `/family`, `/tasks`, `/me`, `/list`) ora c'è «Caricamento…» (`LoadingState`, nuovo nel kit) e, se la rete cade o il server risponde 500, un avviso con cosa è andato storto.
- `/me` ha anche lo stato vuoto «Non fai ancora parte di nessuna famiglia».
- La schermata `/` è rifatta col kit e va in scuro (dubbio 1 del giro 055 chiuso).
- Nessuna dipendenza nuova, server non toccato, nessuna ratifica, nessuna porta a senso unico: la PR non dovrebbe richiedere revisione umana.
- Da provare sul telefono: annuncio di TalkBack del «Caricamento…» e APK in tema scuro (non provati dalla catena).
- Rischio dichiarato: una regione `aria-live` montata già piena può non essere annunciata (web e TalkBack).
- Ratifiche: nessuna. Modulo di merge: `⏱ N' · ratifiche lette: nessuna · note`.

## Cosa funziona ora — con la prova
- Accettazione `giro-056-screen-states.spec.ts`: 45/45; Playwright completo 519/519; `npm test` 216/216; `tsc` ed `eslint` puliti; server `verify` 445 test verdi (revisore, SHA f15bcbe).
- Screenshot `t16-home-*` e `t16-state-*` (24) prodotti dai test.
- Budget: +106/−18 righe di produzione su 9 file (limite 220/14).

## Cosa non funziona ancora
- `me()` non distingue 401 da errore di rete: se cade `/api/me` la persona finisce su `/login` (fuori perimetro, idea per dopo).
- Android: `/family` con sync offline che non diventa mai pronto mostra uno spinner senza fine (prima era schermo vuoto); manca un timeout.
- Nessun test su `/me` con `/api/families` abortito per rete (provato a mano dal revisore, giusto).
- Annuncio TalkBack e APK scuro non provati. Nessun bottone «Riprova», nessun ritardo anti-sfarfallio.
- Per Playwright serve prima `npx expo export --platform web`: con `dist` vecchio sembrano rossi 44 test.

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** 3 (guard sul file agenti scritto dall'hook; `/me` rete caduta non coperto da A4; spinner Android) — nessuno corretto, tutti qui sopra.
- **PERIMETRO:** nessuna aggiunta non richiesta.
- **CONCORRENZA:** nessuna scrittura nuova; 4 sonde verdi (nessuno spinner orfano, smontaggio con task in volo).
- **MUTAZIONI:** provate 3, prese 3.

## Ricerca e critica
Concorrenti analizzati: nessuno (la ricerca non ne ha trovati sugli stati di schermata). Preso: `aria-hidden` sullo spinner (react-native-web ignora `accessibilityLabel`), testi d'errore che dicono cosa fare (GOV.UK, solo risultati di ricerca). Critica: 4 punti da correggere, tutti accolti (endpoint per schermata, fake API della lista, due caricamenti di `/me`, `aria-hidden` provato nel DOM).

## Proposte al metodo
nessuna

## Prossima fetta
Giro verifica-produzione di T16.
