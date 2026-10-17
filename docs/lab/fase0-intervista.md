# Fase 0 — note dell'intervista

Risposte dell'umano, riassunte fedelmente. Le proposte di Claude stanno in `fase0-decisioni.md`.

## Blocco 1 — 17/10/2026

**Utenti e famiglie**
- Una persona fa login e può appartenere a più famiglie. Se ne ha una sola entra lì direttamente,
  altrimenti sceglie tra le sue.
- Esempi di famiglie che si sovrappongono:
  - «babbo, mamma, figlio 1, figlio 2»;
  - «nonno, nonna, mamma, zio 1, zio 2, zio 3»;
  - «nonno, nonna, babbo».
- In valutazione: un profilo **ALL** che vede tutto di tutte le famiglie, per una gestione più corretta.
- Ruoli: per esempio babbo e mamma possono assegnare task ai figli.

**Task**
- Ogni famiglia ha i suoi task. Un task si assegna a una persona oppure sta in una **coda** da cui
  qualcuno lo prende.
- Ogni task ha una scadenza e una criticità.
- **Inoltro:** un task passa da una famiglia all'altra se chi lo inoltra appartiene a entrambe.
- **Task ciclici:** per esempio «mettere fuori la carta» ogni martedì.
- **Template di task:**
  - «lista della spesa», con checkbox facili;
  - «730», con scansione e salvataggio in PDF.
- **Calendario** per vedere e creare task futuri.
- Più avanti: brainstorming con suggerimenti e controllo della concorrenza.

**Problemi di oggi**
- documenti;
- cose cicliche dimenticate;
- cose da fare al momento dimenticate.

**Prima demo**
- creare task e assegnarli;
- **promemoria:** sia automatico per l'assegnatario, sia mandato a mano da chi ha un certo ruolo.

**Fuori dal perimetro per ora**
- dati bancari, sanitari e in generale troppo personali.

## Blocco 2 — 17/10/2026

- **Spec Kit:** diventa uno strumento del repository. Si itera `/specify` a ogni funzione nuova; Claude
  verifica il risultato e come si integra.
- **Promemoria:** all'inizio solo notifica sul telefono; gli altri canali sono da valutare.
- **Risorse e utenti:** ogni utente è una risorsa, ma non ogni risorsa è un utente. I task si
  assegnano alle risorse; gli utenti sono quelli che hanno l'app sul telefono. Così si possono dare
  task anche a chi non ha l'app, come organizzazione mentale. A chi non ha un telefono manca la
  notifica.
- **Vincoli:** nessun vincolo, si vuole vedere cosa nasce. Conta solo il budget: proposte su più
  fasce di spesa.

## Blocco 3 — 17/10/2026

- **Spec Kit e `/giro`:** la sinergia fa parte della prova di questo esperimento.
- **App:** negli store. All'inizio può bastare un APK non pubblico, da installare sui telefoni delle
  persone che lo provano.
- **Stack:** lo scelgono solo le specifiche, per arrivare allo stack migliore; preferenze e studio
  dell'umano non entrano. Il cartografo (percorso di studio) è fuori da questo esperimento: il
  progetto servirà come applicazione di riferimento.
- **Prima demo:** ci sono anche risorse senza app.
- **Lingue:** multilingua.

## Blocco 4 — 17/10/2026

- **Piattaforme:** Apple solo quando il progetto si dimostra valido (99 $ l'anno sono tanti). I 25 $
  una tantum di Google Play si possono spendere.
- **Login:** username e password con email, all'inizio.
- **Lingue:** italiano e inglese.
- **Web e telefono:** dal web sarà più facile gestire tutto; il telefono serve almeno per le cose
  assegnate. Da decidere nelle specifiche: probabilmente anche dal telefono si può fare tutto ciò che
  si fa dal web.
- **Offline:** sì.
- **Demo:** 3 famiglie:
  - «Famiglia Babbo», 3 utenti;
  - «Famiglia Mamma», 6 utenti;
  - «Famiglia Principale», 2 utenti e 2 risorse.
