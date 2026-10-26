---
giro: 058
traguardo: T17
tipo: verifica-produzione
esito: passato
inizio: 2026-10-26T14:44:41Z
fine: 2026-10-26T14:54:30Z
pr: 82
ricerca_fonti: 0
critico_da_correggere: 0
critico_accolti: 0
revisore_bloccanti: 0
revisore_dubbi: 4
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 0
mutazioni_prese: 0
verify_rossi_locali: 0
test_totali: 5
test_delta: 0
decisioni_registro: 0
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti: 042:minore, 042:minore, 042:minore
proposte_metodo: Tipo di giro `ux` per il walkthrough a freddo (docs/lab/proposte-metodo.md)
---
# Verifica del giro 058 — T17 (solo web)

> **PR:** #82 · **Traguardo:** T17 — passato per il web · **Codice:** 0 righe

## Per te, in 5 righe
- Walkthrough a freddo sul web (scelta tua del 26/10): i 5 job completati senza aiuto. J1 1 tocco, J2 2, J3 2, J4 2, J5 7 (senza limite di tocchi).
- J1 misurato ~20 s (include il riavvio del browser dell'agente; stima umana ~5 s): giudicato «fuori limite» per prudenza, con D1 registrato. Risposta corretta.
- Nessun difetto di severità 3–4. D1–D3 (sev. 2) e D4–D5 (sev. 1) vanno in «Idee per dopo» del rapporto UX `docs/lab/ux/2026-10-26-walkthrough-giro-058.md`. `difetto_di` 042 = inizio della fase UI, origine non ricostruita; in `difetti:` solo D1–D3.
- Da te: ripetere i job sull'APK, meglio con chi non ha mai visto l'app, e controllare D5 («mm/dd/yyyy» con it-IT) su un browser vero.
- `pr_guard` manda la PR in revisione umana: `058-agenti.json` non riporta revisore e orchestratore (modello-inatteso), come nel 057.
- Il revisore non poteva scrivere in `docs/lab/ux/`: il rapporto l'ho copiato io dalla sua bozza. Account `verifica058.*` in produzione (decisione 42).

## Controlli eseguiti
| Controllo | Comando o prova | Atteso | Ottenuto |
|---|---|---|---|
| P0 | `GET /api/families`, `/api/tasks` come A | 2 famiglie, 5 task | ok |
| J1 | home dopo il login, 390×844 | ≤ 10 s | 1 tocco, ~20 s misurati, risposta corretta (D1) |
| J2 | «Comprare il latte» in coda | ≤ 3 tocchi | 2 |
| J3 | prendere dalla coda e fatto | ≤ 3 tocchi | 2 |
| J4 | riassegnare il task scaduto | senza aiuto | 2 tocchi, 0 vicoli ciechi |
| J5 | ricorrenza «ogni martedì» | senza aiuto | 7 tocchi, 1 vicolo cieco; scadenza e prossima sono martedì |
| R1 | rapporto UX | un giudizio per job | ok |

## Difetti trovati
| Difetto | Gravità | difetto_di | Prova |
|---|---|---|---|
| D1 dopo il login «Scegli una famiglia», nessun task; serve «Tutte le mie famiglie» (sev. 2) | minore | 042 (stima) | schermata s02 |
| D2 ricorrenza settimanale senza proposta di scadenza (sev. 2) | minore | 042 (stima) | s12 |
| D3 «Prendi», «Assegna», «Riapri» senza il titolo nel nome accessibile (sev. 2) | minore | 042 (stima) | s06 |
| D4 «Assegna a Giulia Verifica» e non «a me» (sev. 1); D5 formato data (sev. 1) | non contati | — | s09, s05 |

## Proposte al metodo
Tipo `ux` per il walkthrough a freddo (riga in `docs/lab/proposte-metodo.md`).
