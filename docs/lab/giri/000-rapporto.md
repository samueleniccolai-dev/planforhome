---
giro: 000
traguardo: T1
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-19T10:22:45Z
fine: 2026-10-19T11:02:52Z
pr: 5
ricerca_fonti: 0
critico_da_correggere: 5
critico_accolti: 5
revisore_bloccanti: 0
revisore_dubbi: 5
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 5
mutazioni_prese: 5
verify_rossi_locali: 0
test_totali: 26
test_delta: 26
decisioni_registro: 5
decisioni_ratifica: 2
porte_senso_unico: 0
riparazioni: 1
difetti: 000:minore, 000:minore, 000:minore, 000:minore
proposte_metodo: i controlli degli script infra/ vanno scritti come test, il guard blocca l'esecuzione a mano
---
# Rapporto del giro 000 — i binari: deploy, verifica visiva e APK (T1, T2)

<!-- Modelli e token non stanno qui: li registra 000-agenti.json. -->

> **PR:** #5 · **Branch:** `claude/giro-000-t1` · **Traguardi:** T1 e T2 — Fatto quando verde in locale, da
> verificare in produzione (resta da vedere la CI: Playwright e job `apk`)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Scheletro server (Spring Boot, `GET /api/health`), app Expo (web statico, home it/en), `infra/` di deploy e rollback.
- La PR tocca percorsi protetti (`pom.xml`, `package.json`, `infra/`, Dockerfile): **revisione umana**.
- Playwright/Chromium e il job `apk` non sono stati provati nella sessione: li prova la CI.
- Ratifica `000-a`: immagine Temurin 25 JRE fissata per digest. Ratifica `000-b`: pacchetto Android `com.planforhome.app`, versione 0.1.0.
- Ratifiche da dichiarare lette: `000-a 000-b`.
- Il guard segnala anche: `.gitkeep` nella cartella migrazioni, un valore finto nel test di rollback letto come segreto, e agenti mancanti in `000-agenti.json` (voci registrate dal hook: da guardare).
- Passo 9 del setup (`LAB_ATTIVO`, Schedule) resta tuo, come da PROGRESS.

## Cosa funziona ora — con la prova
- `./mvnw verify`: 18 test server verdi, Spotless compreso (revisore, SHA d0b27dd).
- `/api/health` su stack reale postgres:18 + server → `{"status":"UP","sha":…}`.
- App: `npm test` (4), `tsc`, `eslint`, `expo export --platform web` verdi.
- Deploy/rollback provati su server finto: lucchetto, `precedente`, digest, segreti solo nel `.env` 600.

## Cosa non funziona ancora
- Nessun deploy in produzione né APK ancora verificati.
- Riparazione 1 (CI rossa, Playwright it-IT): `app/app/+html.tsx` non rendeva `headNodes`/`bodyNodes`, il bundle web non si idratava e restava l'inglese prerenderizzato. Corretto in 4d294a5; revisore mirato: 0 bloccanti, Playwright 7/7 in locale. Dubbio: nessun test prende la rimozione di `{headNodes}`.
- Dubbi minori del revisore non corretti: password generata nei log del server; stesso SHA deployato due volte in parallelo (`mv` fallisce, oggi impedito da `concurrency`); rideploy di B con pull fallito torna ad A; `<html>` senza `lang`.

## Verdetto del revisore
- **BLOCCANTI:** nessuno
- **DUBBI:** 5 (nessuno corretto, vedi sopra)
- **PERIMETRO:** nessuna aggiunta fuori piano
- **CONCORRENZA:** due deploy, due rollback, A-B-C con digest errato: corretti; due B identici in parallelo: dubbio minore
- **MUTAZIONI:** provate 5, prese 5

## Ricerca e critica
Nessuna ricerca. Critica: 5 punti su 5 accolti (niente i18n-js, niente Actuator, password e volume Postgres, `incoming/`).
Nota di processo: ho lanciato per errore il pianificatore FINALE prima dello scheletro (§5, giro 000); l'ho fermato e rifatto nell'ordine giusto.

## Proposte al metodo
Controlli degli script `infra/` come test, non comandi a mano (il guard li blocca).

## Prossima fetta
Se la CI è verde e la PR mergiata e deployata: giro `verifica-produzione` per T1 e T2.
