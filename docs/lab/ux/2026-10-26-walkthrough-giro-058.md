# Walkthrough a freddo — giro 058 (web, 26/10/2026)

Ambiente: https://app.planforhome.com, Chromium headless (Playwright 1.63), locale it-IT,
fuso Europe/Rome, viewport 390x844, touch. Account A (Giulia Verifica). Ogni job fatto una volta.
Secondi = tempo reale misurato. Comprende ~2,5-4,5 s per passo di riavvio del browser
dell'automazione e il tempo di lettura dell'agente; si danno sia il valore misurato sia la stima
senza lo strumento.

| Job | Tocchi | Secondi (misurati / stima senza strumento) | Giudizio |
|---|---|---|---|
| J1 Cosa devo fare oggi | 1 | ~20 / ~5 | completato fuori limite (misurato); risposta corretta |
| J2 Comprare il latte in coda (F1) | 2 | ~7 / ~4 | completato entro il limite (≤3) |
| J3 Prendere e chiudere la lavastoviglie | 2 | ~12 / ~3 | completato entro il limite (≤3) |
| J4 Riassegnare a sé la lettiera scaduta | 2 | ~10 / ~4 | completato senza aiuto, 0 vicoli ciechi |
| J5 Portare fuori la carta ogni martedì | 7 | ~40 / ~15 | completato senza aiuto, 1 vicolo cieco |

## Percorsi reali
- **J1.** Dopo il login la prima schermata è «Scegli una famiglia» (link «Famiglia Bianchi 058»,
  «Famiglia Rossi 058», «Tutte le mie famiglie»), senza task (s02). Tocco 1: «Tutte le mie
  famiglie». La lista è divisa in «In ritardo / Oggi / Prossimi / Senza scadenza» con la
  famiglia su ogni scheda (s03). Risposta scritta: oggi «Portare Leo dal pediatra» (Famiglia
  Rossi 058, 17:00, Alta) e «Pagare la mensa» (Famiglia Bianchi 058, in coda); in ritardo
  «Cambiare la lettiera» (Rossi); «Ritirare il pacco» è fra i Prossimi. Confronto con la busta
  alla fine: corretta.
- **J2.** Da «Famiglia Rossi 058»: «Nuovo task» (1), titolo, «Aggiungi task» (2). Non c'è un
  campo per l'assegnatario: il task nasce «In coda» in «Senza scadenza» (s06).
- **J3.** «Prendi» sulla scheda (1) → «Assegnato a Giulia Verifica»; casella «Fatto: Svuotare la
  lavastoviglie» (2) → finisce in «Chiusi», «Fatto», con «Riapri».
- **J4.** Scaduto riconosciuto subito: sezione «In ritardo» e data in rosso (s09). «Assegna» (1)
  apre sotto la scheda «Assegna a Giulia Verifica / Assegna a Marco Verifica / Rimetti in coda»;
  «Assegna a Giulia Verifica» (2) → «Assegnato a Giulia Verifica».
- **J5.** «Nuovo task» (1), titolo, «Ogni settimana» (2) → compaiono i giorni, «Martedì» (3),
  «Aggiungi task» (4) → avviso «Un task ciclico ha bisogno di una scadenza.» (s12, vicolo
  cieco). Scadenza scelta 27/10/2026 (5-6, il campo conferma «martedì 27 ottobre 2026»),
  «Aggiungi task» (7). Risultato (s15): «Prossimi» → «Portare fuori la carta In coda Scadenza:
  27/10/2026 Si ripete: ogni martedì Prossima: 03/11/2026». Entrambe martedì.

## Difetti
| # | Severità | Dove | Prova |
|---|---|---|---|
| D1 | 2 | Prima schermata dopo il login: scelta della famiglia senza task; per «cosa devo fare oggi» serve un tocco su «Tutte le mie famiglie», che ha lo stesso aspetto dei link delle famiglie | s02, heading «Scegli una famiglia» |
| D2 | 2 | Nuovo task ciclico: con «Ogni settimana» + «Martedì» la scadenza è comunque obbligatoria; l'app non propone il prossimo martedì | s12, alert «Un task ciclico ha bisogno di una scadenza.» |
| D3 | 2 | Nome accessibile ambiguo: «Prendi», «Assegna», «Annulla task», «Riapri» non contengono il titolo (mentre «Inoltra «…»» e «Sollecita «…»» sì); con due task in coda ci sono due «Prendi» uguali per un lettore di schermo | snapshot di s06: due button «Prendi» |
| D4 | 1 | Riassegnazione: la voce è «Assegna a Giulia Verifica», non «Assegna a me»; nessuna schermata dice chi è l'utente collegato | s09 |
| D5 | 1 | Campo Scadenza mostra il segnaposto «mm/dd/yyyy» con locale it-IT (forse solo Chromium headless; da ricontrollare su un browser vero) | s05 |

Nessun difetto di severità 3-4: per il web T17 può passare. D1-D5 vanno in «Idee per dopo».
