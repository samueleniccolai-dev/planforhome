# Revisione indipendente della fase 0 (B8)

17/10/2026 · l'ha fatta un subagente che non ha visto né l'intervista né il registro delle decisioni.
Ha letto SPEC, traguardi, ESPERIMENTO, ADR-0001 e 0002, progetto.yml, DELTA-V4 e il pre-mortem.

## Verdetto (riassunto)

I documenti sono quasi tutti verificabili. Restavano però aperte alcune decisioni di prodotto: come si
entra in una famiglia, come si ferma una serie, i promemoria su sola data. Il rischio più serio di R0
era l'esposizione in rete: registrazione aperta e password demo pubblicate. ESPERIMENTO aveva un
conflitto tra la condizione di fine e la caccia finale, e due soglie in parte vere per costruzione.

## Rilievi ed esito

| # | Rilievo | Gravità | Esito |
|---|---|---|---|
| 1 | R0 esposto: registrazione libera, password demo pubbliche | bloccante | in parte: password demo da segreto in produzione; la registrazione resta pubblica per decisione dell'umano al CANCELLO 2 |
| 2 | Utente con 0 famiglie, creazione di famiglie e aggiunta di persone non definite | bloccante | corretto: inviti, crea famiglia, nuovo T4 (SPEC §2.2.1, §5 P13–P15) |
| 3 | La condizione di fine non lascia spazio alla caccia; non è chiaro quando un traguardo passa | bloccante | E1, E2 approvate e applicate |
| 4 | Reimpostazione della password da parte del gestore rompe l'isolamento | maggiore | corretto: solo lo script di amministrazione (SPEC §2.3) |
| 5 | Ancora delle ricorrenze, fine della serie, cancellazione | maggiore | corretto (SPEC §2.2.3, §2.2.5; T6) |
| 6 | Offline in T7 prima di T8; il protocollo di sync tocca l'API da subito; casi mancanti | maggiore | corretto: API pronte al sync da T5, spesa online, offline in T9 con fotografia e pulizia (SPEC §7) |
| 7 | `due_kind`, anticipo, ricalcolo, silenzio oltre la scadenza, sollecito in coda, web | maggiore | corretto (SPEC §6, §8; T10) |
| 8 | T1 dipende dal setup; smoke non allineato | maggiore | corretto: prerequisiti in traguardi.json, smoke che cresce |
| 9 | Build Android non controllata sulle PR; chiave di firma; 500 task non misurabile | maggiore | corretto: build APK obbligatoria, chiave nel setup, 500 task solo descrittivo |
| 10 | T3 troppo grande | maggiore | corretto: diviso in T3 e T4; isolamento parametrico |
| 11 | Configurazioni dei test, accettazione e Dockerfile non protetti; `app/app` fuori dal limite | maggiore | corretto (progetto.yml) |
| 12 | P4 gonfiata dai giri di verifica | maggiore | E4 approvata e applicata |
| 13 | P5 sul modello vera per costruzione | maggiore | E3 approvata e applicata |
| 14 | Attribuzione dei giri e delle attività ambigua; P2 con n=1 | maggiore | E5 approvata e applicata |
| 15 | Buchi nella tabella dei permessi | maggiore | corretto: 15 righe, ognuna con il suo traguardo |
| 16 | La registrazione rivela le email | minore | accettato e scritto (SPEC §9) |
| 17 | `id` del client che attraversa le famiglie | minore | corretto (SPEC §6; T5) |
| 18 | Riordino concorrente; voci di una lista ciclica | minore | corretto (SPEC §2.2.7; T8) |
| 19 | Lingua delle notifiche delle risorse; fuso nella vista aggregata | minore | corretto (SPEC §2.2.3, §2.2.9) |
| 20 | Porta R1 poco precisa; FCM fuori dall'UE; log; 21 giorni stretti | minore | corretto in SPEC §3; durata come minaccia in E6, approvata |
