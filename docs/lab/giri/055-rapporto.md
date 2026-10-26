---
giro: 055
traguardo: T16
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-26T06:23:27Z
fine: 2026-10-26T08:45:43Z
pr: 79
ricerca_fonti: 4
critico_da_correggere: 2
critico_accolti: 2
revisore_bloccanti: 0
revisore_dubbi: 3
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 3
mutazioni_prese: 3
verify_rossi_locali: 0
test_totali: 689
test_delta: 40
decisioni_registro: 3
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 055 — T16 parte 1: tema scuro

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/055-agenti.json. -->

> **PR:** #79 · **Branch:** `claude/giro-055-t16` · **Traguardo:** T16 — parziale (parte 1 di 2:
> tema scuro; mancano gli stati V8 e `LoadingState`)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Con il sistema in tema scuro il web e l'APK (da provare sul telefono) usano ora una palette scura: sfondo `#111418`, testo `#E8ECF1`, contrasto del corpo ≥ 7:1.
- Sul web segue `prefers-color-scheme` dal vivo; il prerender esce chiaro e passa a scuro dopo l'idratazione (un lampo, accettato e documentato).
- **Revisione umana:** la PR tocca `app/app.json`, `app/package.json` e `package-lock.json` (percorsi protetti) con `expo-system-ui ~58.0.6`, dipendenza già decisa in SPEC §14.1 n. 8.
- **Cosa è successo:** il classificatore dei permessi ha negato `npx expo install` due volte; il giro è stato parcheggiato e l'hai installata tu (`ba3d653`, lock pulito). Una dipendenza decisa in anticipo viene comunque bloccata dal cloud: valuta se è un problema del metodo.
- **Da fare tu:** provare l'APK sul telefono con tema scuro di sistema (e il caso `"automatic"` su Android, [DA VERIFICARE]: la documentazione di SDK 58 non era raggiungibile).
- Nessuna ratifica. Le 8–18 vulnerabilità di `npm audit` stanno nella catena di build di Expo: Dependabot #60 e #61.

## Cosa funziona ora — con la prova
- Token scuri e rapporti di contrasto V5 (prova: `contrast.test.ts`, 3 mutazioni su 3 prese).
- Acceptance A0–A5 (prova: `app/e2e/acceptance/giro-055-dark-theme.spec.ts`, 40/40; Playwright completo 474/474; jest 215/215; tsc ed eslint verdi).
- `expo-system-ui` nei `plugins` e `userInterfaceStyle: automatic` (prova: `npx expo config --type public`).
- 20 screenshot `t16-*` (5 schermate × chiaro/scuro × 2 viewport).

## Cosa non funziona ancora
- Stati V8 su ogni schermata e `LoadingState`: parte 2 di T16.
- `app/app/index.tsx` (schermata `/`) resta chiara in tema scuro: non usa `useTheme` (dubbio 1 del revisore).
- Prova dell'APK sul telefono in tema scuro: non fatta dalla catena.

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** 3, nessuno corretto — (1) `/` resta chiara in scuro, alla parte 2; (2) `contrast.test.ts` applica 4.5:1 a tutte le coppie chiare, più severo del piano; (3) APK sul telefono da provare.
- **PERIMETRO:** pulito; solo `expo-system-ui` come dipendenza nuova.
- **CONCORRENZA:** nessuna scrittura; due sonde di resa (`/` e `/list` in scuro).
- **MUTAZIONI:** provate 3, prese 3.

## Ricerca e critica
Concorrenti analizzati: nessuno (la ricerca copre Expo, react-native-web, Material/WCAG). Critica: 2 punti accolti — `expo-system-ui` anche in `plugins` con un controllo eseguibile; soglia 3:1 delle tinte solo nello scuro. Fonti consultate il 26/10/2026; da verificare: docs.expo.dev SDK 58, superficie dark M3, react-native-web 0.21.4 esatta.

## Proposte al metodo
nessuna

## Prossima fetta
Giro 056: costruzione di T16 parte 2 (stati V8, `LoadingState`, schermata `/` in scuro).
