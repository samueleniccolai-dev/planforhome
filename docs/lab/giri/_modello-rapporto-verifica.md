---
giro: NNN
traguardo: Tn        # nella caccia: caccia
tipo:                # verifica-produzione | caccia | chiusura
esito:               # verifica: passato | non-passato · caccia: chiusa (resta in giri.csv come esito_verifica)
inizio: AAAA-MM-GGTHH:MM:SSZ
fine: AAAA-MM-GGTHH:MM:SSZ
pr:
ricerca_fonti: 0
critico_da_correggere: 0
critico_accolti: 0
revisore_bloccanti: 0
revisore_dubbi: 0
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 0
mutazioni_prese: 0
verify_rossi_locali: 0
test_totali: 0       # controlli eseguiti
test_delta: 0
decisioni_registro: 0
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:             # una voce NNN:gravità per difetto del prodotto, separate da virgola (es. 004:bloccante); NNN = giro d'origine, mai questo giro; un atteso sbagliato del piano non è un difetto; vuoto se nessuno
proposte_metodo:     # testo breve oppure «nessuna»; obbligatorio
---
# Verifica del giro NNN — Tn / caccia

<!-- Rapporto corto. Modelli e token: docs/lab/giri/NNN-agenti.json. -->

> **PR:** #… · **Traguardo:** Tn — passato / non passato · **Codice:** 0 righe

## Per te, in 5 righe
Esito, difetti trovati, se serve qualcosa da te (una prova sul telefono, una revisione).

## Controlli eseguiti
| Controllo | Comando o prova | Atteso | Ottenuto |
|---|---|---|---|

## Difetti trovati
Una riga per difetto del prodotto, la stessa voce `NNN:gravità` del campo `difetti:` in testa.
`difetto_di` è il giro che l'ha introdotto, mai questo. Un atteso sbagliato del piano non è un
difetto: si corregge il piano e si riesegue il controllo (ESPERIMENTO §4.5).

| Difetto | Gravità (bloccante / maggiore / minore) | difetto_di | Prova (comando) |
|---|---|---|---|

## Proposte al metodo
Una riga, oppure «nessuna».
