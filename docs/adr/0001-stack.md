# ADR-0001 — Stack di planforhome

- **Data:** 17/10/2026
- **Stato:** deciso dall'umano il 17/10/2026 (B3): server Spring Boot, client React Native + Expo, offline solo sul telefono, server di gerio-lab con il suo stack fermato.
- **Regola:** lo stack lo scelgono le specifiche, non le preferenze o lo studio dell'umano. Il
  meccanismo e la pulizia della misura contano solo a parità di requisiti, e lo dico dove succede.

## Requisiti che pesano sulla scelta

Dalle note dell'intervista (`docs/lab/fase0-intervista.md`):

| # | Requisito | Peso sullo stack |
|---|---|---|
| R1 | app Android: prima APK, poi Play Store; iPhone più avanti | client mobile vero, notifiche push |
| R2 | web per la gestione completa; dal telefono probabilmente si può fare tutto | idealmente un solo codice per mobile e web |
| R3 | offline (es. lista della spesa senza rete) | database locale e sincronizzazione: è il pezzo più rischioso |
| R4 | famiglie che si sovrappongono, ruoli, inoltro tra famiglie, risorse senza app | permessi articolati e verificati sul server, con molti test |
| R5 | notifica sul telefono per promemoria e solleciti | Firebase Cloud Messaging su Android, gratuito [F]; prima integrazione esterna (P2) |
| R6 | italiano e inglese | i18n nel client e nei testi delle notifiche |
| R7 | dati finti in R0; in R1 dati di famiglie, anche di minori | dati su un server di cui si risponde, in UE |
| R8 | ogni traguardo ha un «fatto quando» verificato da un test; il secondo traguardo è la verifica visiva | interfaccia testabile in modo automatico, anche con screenshot, in CI |

## Server — deciso

**Java 25, Spring Boot, PostgreSQL. La sincronizzazione la scriviamo noi, stretta, con i conflitti
risolti dal server.** Decisione dell'umano al B3: opzione A, ma con Spring al posto di Quarkus.

Conseguenze per la misura e per il meccanismo:
- Cambia anche il framework del server rispetto a gerio-lab. Restano uguali linguaggio, Maven,
  PostgreSQL e migrazioni. Va aggiunto alle minacce alla validità: oltre a dominio, v4 e client,
  cambia anche il framework.
- Dal meccanismo di gerio-lab:
  - guard, CI su Maven e schema di consegna si riusano;
  - vanno riscritti i controlli specifici di Quarkus: le chiavi di configurazione pericolose in
    `pr_guard` e l'immagine `Dockerfile.jvm`.
- Uscita: se il traguardo della sincronizzazione fallisce due volte, si valuta PowerSync Open Edition
  su Postgres, senza cambiare server ([licenza FSL](https://powersync.com/legal/licensing-terms)).
- Ospitato sul server di gerio-lab (fascia ~0 €). Vedi «Server condiviso».

## Client — deciso: React Native + Expo

| Criterio | Flutter (Dart) | React Native + Expo (TypeScript) |
|---|---|---|
| R1 Android, poi iOS | sì, APK con `flutter build apk` | sì; APK con `expo prebuild` e Gradle in CI, senza obbligo del servizio EAS (**I**: da provare in C) |
| R2 web | sì, ma disegnato su canvas: più pesante al primo caricamento | sì, con react-native-web: produce un DOM vero |
| R3 offline sul telefono | SQLite con drift, maturo | SQLite con expo-sqlite, maturo su Android |
| R3 offline sul web | drift sul web con WebAssembly e OPFS, documentato ([drift web](https://drift.simonbinder.eu/web/)) | il supporto web di expo-sqlite è segnato **alpha** e richiede header COOP/COEP ([doc Expo](https://docs.expo.dev/versions/latest/sdk/sqlite/)) |
| R5 push | FCM con plugin Firebase | FCM con expo-notifications; token del dispositivo inviato al nostro server, senza il servizio push di Expo |
| R8 test e verifica visiva | test di widget e screenshot «golden» senza browser. Sul web, Playwright richiede di attivare l'albero di semantica, e i selettori generati cambiano tra una build e l'altra ([Maestro](https://docs.maestro.dev/get-started/supported-platform/flutter), [guida di un fornitore](https://getautonoma.com/blog/flutter-playwright-testing-guide)) | Playwright sul web funziona come in gerio-lab (DOM, ruoli, etichette); Jest per la logica |
| Linguaggi del repository | Dart + Java | TypeScript + Java |

**Il criterio decisivo è l'offline sul web.**
- Se l'offline serve **solo sul telefono** (il caso della spesa), il web può restare online. Allora
  React Native + Expo vince su R8: la verifica visiva con Playwright si fa come in gerio-lab, su un DOM
  vero, ed è ciò su cui la catena verifica i «fatto quando».
- Se l'offline serve **anche sul web**, vince Flutter, perché lo fa con un componente documentato e
  non in alpha.

**Deciso:** offline solo sul telefono; client **React Native + Expo**. Il web resta online.

## Server condiviso (fascia ~0 €)

Il server di gerio-lab ospita oggi Caddy e l'app di gerio-lab in Docker Compose. Caddy occupa le
porte 80 e 443 (`infra/docker-compose.yml`, `infra/Caddyfile` di gerio-lab).
- Il repository di gerio-lab non si tocca. Quindi planforhome non può aggiungere il suo sito al
  Caddyfile di gerio-lab.
- Strade valutate; **decisa la 1** (17/10/2026), da eseguire nel setup (C2, D):
  1. fermare lo stack di gerio-lab, perché l'esperimento è concluso, e far gestire 80 e 443 a
     planforhome;
  2. un proxy condiviso sull'host, fuori da entrambi i repository.
- Il DNS va su un sottodominio di planforhome.com.

## Budget

| Voce | Costo |
|---|---|
| server | 0 € in più (server di gerio-lab) |
| FCM | gratuito [F] |
| Google Play | 25 $ una tantum, quando serve lo store |
| Apple | 99 $/anno, solo quando il progetto si dimostra valido |

## Conseguenze

- I primi giri toccano build, CI e infrastruttura: per la regola di P4 vanno quasi tutti in revisione
  umana.
- FCM e il Play Store sono integrazioni esterne, con un runbook ciascuna (DELTA-V4 V6).
- `progetto.yml` (B6) descrive due stack nello stesso repository.
