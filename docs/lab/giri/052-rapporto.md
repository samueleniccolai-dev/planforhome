---
giro: 052
traguardo: T15
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-25T23:37:40Z
fine: 2026-10-26T00:28:21Z
pr: 76
ricerca_fonti: 8
critico_da_correggere: 4
critico_accolti: 12
revisore_bloccanti: 0
revisore_dubbi: 2
dubbi_corretti: 0
fuori_perimetro: 1
mutazioni_provate: 3
mutazioni_prese: 3
verify_rossi_locali: 0
test_totali: 1068
test_delta: 28
decisioni_registro: 4
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 052 — T15 parte 1: lingua dell'account sul web; famiglia, famiglie e profilo dal kit

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/052-agenti.json. -->

> **PR:** #76 · **Branch:** `claude/giro-052-t15` · **Traguardo:** T15 — parziale (resta `ShoppingList`, parte 2)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Sul web, dopo l'accesso vince la lingua dell'account; «Esci» e `/login` tornano alla lingua del browser. `<html lang>` segue la lingua. Anche la data del campo `DateField.web` è nella lingua dell'account.
- Nuovo `LinkRow` nel kit (collegamento alto ≥ 48 px).
- `family`, `families` e `me` sono composte solo dal kit; persone con iniziali, nome e ruolo scritto.
- **Revisione umana richiesta:** test di accettazione vecchi (004, 007, 010 e fake API 011, 014, 016, 019, 031, 046, 047) adattati: il `locale` dell'account segue `Accept-Language`, nessuna asserzione cambiata (decisione 157). Toccato anche `FamilySwitch` (fuori elenco).
- Il guard segnala anche `modello-inatteso`: `052-agenti.json` non registra critico, costruttore, revisore e orchestratore con il modello atteso (lo scrive il hook, non a mano).
- Server non toccato, nessuna dipendenza. Nessuna ratifica.
- Da provare sul telefono: Android non ha `me()` in `_layout`, la lingua si fissa dopo il login.

## Cosa funziona ora — con la prova
- Revisore (SHA aadf739): server 445, Jest 204, Playwright 419/419, `tsc` ed `eslint` 0; accettazione L1–L6, S1, P1–P3, G1, V1 verdi; 3 mutazioni su 3 prese.

## Cosa non funziona ancora
- `ShoppingList` dal kit con voci spuntate distinte non solo dal colore (parte 2); poi la verifica di T15.
- Sessione scaduta (401): resta la lingua dell'account su `/login` (dubbio 1, minore).
- Comportamento di `Link asChild`/react-native-web 0.21 e di React 19 con `useSyncExternalStore` provato solo nel browser dei test.

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** 2, nessuno corretto: (1) su 401 non si chiama `setAccountLocale(undefined)`; (2) `052-agenti.json` cambiato dal hook (atteso).
- **PERIMETRO:** 1 (`FamilySwitch`, una riga, motivata).
- **CONCORRENZA:** risposta vecchia di `me()` scartata; due `me()` parallele ok; L5 verde.
- **MUTAZIONI:** provate 3, prese 3.

## Ricerca e critica
Concorrenti analizzati: Todoist (la lingua non è un dato dell'account, diverso dalla SPEC §2.2.9: non preso). Critica: 4 punti su 4 accolti, più 8 altri.

## Proposte al metodo
nessuna

## Prossima fetta
Giro 053: costruzione di T15 parte 2 (`ShoppingList`).
