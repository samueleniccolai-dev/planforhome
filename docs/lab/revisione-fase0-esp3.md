---
esito: passato
data: 2026-10-24
---
# Revisione indipendente — fase 0 dell'esperimento 3

Revisione del pacchetto `claude/esperimento-3-fase0` su richiesta dell'umano, da una sessione che
non ha visto la stesura. Primo passaggio sui commit `2ffdbec`, `3a6fdc7`, `9375ba2`: **esito
`mancato`** per tre problemi di gravità alta (n. 1–3 sotto). Ri-verifica sul commit di correzione
`5888567`: i tre alti e i tre medi risolti, **esito `passato`**. Fonti: il diff `main..HEAD`, i
documenti che tocca, `docs/lab/CONCLUSIONI.md` §8, la storia a `3aab127`.

## Per te, in 10 righe

Il pacchetto, con le correzioni di `5888567`, per me passa. Le correzioni di conteggio di
ESPERIMENTO §4 sono implementate e coperte da test (🤖, moduli delle PR umane, filtro `dal_giro`,
calendario senza caccia, media «≥», atteso ≠ difetto, prova ≠ porta, guard 029 e 038, e ora anche i
minuti noti che sopravvivono a un modulo mancante); i due file di fase 0 e `docs/DESIGN.md` sono
protetti e l'ho provato a runtime; `STOP` è rimosso; niente segreti nel diff; i «Fatto quando» di
T11–T17 sono verificabili e T18/T19 aspettano la spec come promesso. I tre difetti che avrebbero
falsato l'esperimento (fine a 21 giorni contati dal giro 000; caccia 040 che valeva come caccia
finale; DESIGN.md protetto solo sulla carta) sono corretti e riverificati. Restano 7 note basse
(n. 7–13): nessuna falsa una soglia, si sistemano con calma. Sappi che P6 parte già mancata nella
prima parte — 3 cambiate su 16, 19% < 25% — ora dichiarato prima in ESPERIMENTO §3, come dev'essere.

## Problemi

| # | Gravità (alta/media/bassa) | Dove | Problema | Proposta |
|---|---|---|---|---|
| 1 | alta — **risolto** (`5888567`) | `.claude/skills/giro/SKILL.md` §1 | La fine per tempo contava «21 giorni dall'`inizio` di `docs/lab/giri/000-piano.md`» (esp. 2, ≈17/10): la catena avrebbe chiuso l'esperimento 3 con ~2 settimane d'anticipo, contro ESPERIMENTO §6.2 | Fatto: termine dall'`inizio` di `docs/lab/giri/<dal_giro>-piano.md`; senza quel file il termine non decorre |
| 2 | alta — **risolto** (`5888567`) | `.claude/skills/giro/SKILL.md` §1 | «Caccia chiusa» era soddisfatta dalla caccia 040 (esp. 2): niente caccia finale dell'esp. 3, e P5 «caccia: mancata» per costruzione, contro ESPERIMENTO §6.1 | Fatto: caccia valida solo con numero ≥ `dal_giro`; giri sotto `dal_giro` dichiarati fuori (resta la nota n. 13) |
| 3 | alta — **risolto** (`5888567`) | `scripts/guard/pr_guard.py`, `.claude/hooks/guard.py` | `docs/DESIGN.md` era nei `percorsi_protetti` di `progetto.yml` ma nessuno dei due meccanismi lo applicava: un giro poteva cambiare il documento normativo di T12–T19 e auto-mergiarsi | Fatto: in `PROTECTED_FILES` e `RULE_FILES`; provato a runtime nella ri-verifica (manca il test dedicato: nota n. 12) |
| 4 | media — **risolto** (`5888567`) | `scripts/metrics/raccogli.py`, `statistiche.py`, ESPERIMENTO §4.4 | Un merge a mano senza modulo buttava anche i minuti noti: P1 poteva dire «non misurabile» dove i soli minuti noti direbbero «mancata» | Fatto: i minuti noti restano, colonna nuova `minuti_ignoti=sì`, il bucket diventa un minimo («≥»); §4.4 aggiornato; test in tutte e due le suite |
| 5 | media — **risolto** (`5888567`) | `.claude/skills/giro/SKILL.md` §12.3 | La regola «Concorrenti dichiarati» di CONCLUSIONI §8 non compariva da nessuna parte | Fatto: riga obbligatoria «Concorrenti analizzati: <nomi> — cosa se n'è preso / nessuno» nel rapporto dei giri con ricerca (resta la nota n. 11) |
| 6 | media — **risolto** (`5888567`) | ESPERIMENTO §3, «Rischi noti» | P6 prima parte già aritmeticamente mancata al cancello (3/16 = 19% < 25%) senza dichiararlo prima | Fatto: dichiarato nei «Rischi noti sulle soglie», prima del merge |
| 7 | bassa | `scripts/metrics/raccogli.py` (`human_pr_forms`) + `statistiche.py` (`module_rows`) | Una PR umana con più moduli dai riferimenti diversi somma i minuti dell'intera PR e li duplica su ogni riferimento (join «;», poi split senza dividere): sovrastima P2 e i descrittivi nel caso raro di riferimenti misti | Una riga per modulo (pr, minuti, riferimento) invece che per PR |
| 8 | bassa | `statistiche.py`, nota di attribuzione stampata in STATISTICHE | «Righe `setup`, `fase 0`, `meccanismo`, `quotidiano`: descrittive» non nomina `spec` e `studio` (ESPERIMENTO §4.7); il comportamento è comunque giusto | Aggiornare il testo della nota |
| 9 | bassa | `docs/lab/traguardi.json` (T12) | Il componente `Text` è attribuito a «DESIGN §5», che non lo elenca (viene da PIANO-UI §4–§5) | Citare PIANO-UI, o aggiungere `Text` alla tabella di DESIGN §5 |
| 10 | bassa | `docs/DESIGN.md` §8, `docs/lab/PIANO-UI.md` §4 (UI-5) | Dicono ancora «si decide in UI-5» per il tema scuro Android, ma la porta è decisa in fase 0 (SPEC §14.1 n. 8, DECISIONI 119, T16) | Una riga di aggiornamento nella stessa PR umana |
| 11 | bassa | CONCLUSIONI §8 vs SKILL §12.3 | La dichiarazione dei concorrenti ora è nel rapporto, ma la parte «la riga di DECISIONI» di CONCLUSIONI §8 resta scoperta | Se serve, estenderla al modello delle righe di DECISIONI; il rapporto copre l'intento |
| 12 | bassa | `scripts/guard/tests/test_pr_guard.py` | Manca il test dedicato su `docs/DESIGN.md` protetto (provato a runtime in questa revisione, ma senza regressione automatica) | `assertHuman` su un commit che tocca `docs/DESIGN.md` |
| 13 | bassa | `.claude/skills/giro/SKILL.md` (tabella dei tipi, §2.1 fallback «000», §5 «scheletro», regole fisse) | La riga `caccia` della tabella dice ancora «nessuna caccia chiusa» senza il vincolo `dal_giro` (il blocco normativo sopra lo fissa); più i residui del giro 000, innocui (la numerazione riparte da max+1 = 042) | Allineare la riga della tabella e marcare i passaggi del 000 come storici, alla prima occasione |
| 14 | bassa | `scripts/metrics/raccogli.py` (`has_form`) | Il caso limite del modulo «0 N'» (placeholder, PR #7 dell'esp. 2) resta non letto; il caso generico «senza ⏱» è coperto da `BARE_MINUTES` | Nessuna azione: basta non lasciare il placeholder nei moduli |

## Prove eseguite

| Prova | Comando | Esito |
|---|---|---|
| Test delle metriche | `python3 -m unittest discover -s scripts/metrics/tests` | OK — 60 test al primo passaggio; **62 alla ri-verifica** |
| Test del guard | `python3 -m unittest discover -s scripts/guard/tests` | OK — 109 test (primo passaggio e ri-verifica) |
| Test del lab | `python3 -m unittest discover -s scripts/lab/tests` | OK — 9 test (primo passaggio e ri-verifica) |
| JSON dei traguardi | `python3 -m json.tool docs/lab/traguardi.json > /dev/null` | OK (rifatto alla ri-verifica) |
| Stato dei traguardi | `python3 scripts/lab/traguardo.py --mostra` | OK — T11–T19 tutti `da-fare`, giri e PR vuoti (rifatto alla ri-verifica) |
| Smoke di statistiche, su una copia | `python3 scripts/metrics/statistiche.py --root <copia nello scratchpad>` | OK — 0 giri (filtro `dal_giro` esclude 000–041), P1–P5 «non misurabile», P2 «nessuna integrazione» come dichiarato, V1 «passata» da `prove/v1.md`, P6 «mancata» (3/16 = 19%); rifatto su una copia a `5888567`: identico, e legge l'`esito:` di questo file |
| Segreti e dati personali nel diff | ricerca di pattern (token, chiavi, password, PEM) su `git diff main..HEAD` | OK — nessuno; i soli riscontri sono testo documentale su dati finti |
| Protezioni dei file di fase 0 e di DESIGN | lettura di `progetto.yml`, `pr_guard.py`, `guard.py`; a runtime `pr_guard.protected('docs/DESIGN.md','003')` e `guard.is_rule('docs/DESIGN.md')` | OK — `fase0-decisioni-esp3.md` e `revisione-fase0-esp3.md` in tutti e tre; `docs/DESIGN.md` → `True` in entrambi dopo `5888567`; `docs/lab/STOP` rimosso dal pacchetto (la storia lo conserva) |

## Ri-verifica del 24/10 (commit 5888567)

Verificato il diff di `5888567` (8 file: SKILL, ESPERIMENTO, i due guard, raccogli, statistiche e
le due suite di test) e rieseguite tutte le prove della tabella sopra. Punto per punto:

| # | Verifica | Esito |
|---|---|---|
| 1 (alta) | SKILL §1: «21 giorni dall'`inizio` del piano del primo giro dell'esperimento (`docs/lab/giri/<dal_giro>-piano.md`; se il file non esiste … il termine non decorre)». Oggi `042-piano.md` non esiste: il termine non decorre; decorrerà dal giro 042 | **risolto** |
| 2 (alta) | SKILL §1: caccia valida «con numero ≥ `dal_giro`», «giri e cacce con numero sotto `dal_giro` … non contano», e il giro nuovo è `caccia` finché non ce n'è una di questo esperimento. La caccia 040 non soddisfa più la condizione | **risolto** (residuo cosmetico nella tabella dei tipi: nota n. 13) |
| 3 (alta) | `docs/DESIGN.md` in `PROTECTED_FILES` (pr_guard) e `RULE_FILES` (hook); provato a runtime: `pr_guard.protected('docs/DESIGN.md','003')` → `True`, `guard.is_rule('docs/DESIGN.md')` → `True` | **risolto** (test di regressione mancante: nota n. 12) |
| 4 (media) | `raccogli.py` tiene i minuti noti e scrive `minuti_ignoti=sì` (colonna nuova in `FIELDS`); `statistiche.py` marca il bucket come minimo in `minutes_by_bucket`, quindi anche la media di P1 diventa «≥»; ESPERIMENTO §4.4 aggiornato in coerenza («mai un falso “passata”»); test nuovi `test_known_minutes_survive_a_missing_form` e `test_known_minutes_of_a_formless_merge_are_a_minimum`, suite verdi (62) | **risolto** |
| 5 (media) | SKILL §12.3: riga obbligatoria «Concorrenti analizzati: <nomi> — cosa se n'è preso» oppure «nessuno» nei rapporti dei giri con ricerca, citando CONCLUSIONI §8 | **risolto** (la parte «riga di DECISIONI» resta scoperta: nota n. 11) |
| 6 (media) | ESPERIMENTO §3, «Rischi noti sulle soglie»: P6 prima parte dichiarata già mancata per costruzione (3/16, 19%), con il perché | **risolto** |

Le note basse n. 7–10 e 14 del primo passaggio non sono state toccate e restano aperte; si
aggiungono le n. 11–13 nate dalla ri-verifica. Nessuna è di gravità alta o media.

**Esito finale: `passato`.** A verbale: il primo giudizio, sui commit fino a `9375ba2`, era
`mancato`; le correzioni di `5888567` lo ribaltano.
