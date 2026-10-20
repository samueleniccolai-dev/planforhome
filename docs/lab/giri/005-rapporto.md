---
giro: 005
traguardo: T3
tipo: verifica-produzione
esito: passato
inizio: 2026-10-20T03:34:05Z
fine: 2026-10-20T05:05:22Z
pr: 12
ricerca_fonti: 0
critico_da_correggere: 0
critico_accolti: 0
revisore_bloccanti: 0
revisore_dubbi: 5
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 0
mutazioni_prese: 0
verify_rossi_locali: 0
test_totali: 28
test_delta: 0
decisioni_registro: 1
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti: 004:minore
proposte_metodo: le prove sul limite per IP, da sessioni cloud, vanno fatte su una sola connessione TCP (l'IP di uscita cambia a ogni connessione)
---
# Verifica del giro 005 — T3

<!-- Rapporto corto. Modelli e token: docs/lab/giri/005-agenti.json. -->

> **PR:** #12 · **Traguardo:** T3 — passato · **Codice:** 0 righe

## Per te, in 5 righe
- T3 passa: tutto il «Fatto quando» è verde in produzione (`c3538cd`), 0 bloccanti.
- Difetto minore: il cookie `pfh_session` ha `Max-Age=2591999` invece di 2592000 (un secondo, troncamento).
- Il limite per IP funziona e non si aggira con `X-Forwarded-For` falso; `forward-headers-strategy=native` è confermato.
- Restano in produzione 3 account e 2 famiglie «Famiglia Verifica 005» (dati finti, nessuna API per cancellarli).
- Da fare tu: provare l'APK (`planforhome-0.1.0-c3538cd`) sul telefono. Il login su Android non è in T3: è la prossima costruzione (porta: `expo-secure-store`).

## Controlli eseguiti
| Controllo | Comando o prova | Atteso | Ottenuto |
|---|---|---|---|
| T3.1 CI | run 39362247612 | job verdi | `success` (log non leggibili dal proxy: ripiego del piano) |
| T3.2 accettazione | `Giro003*`/`Giro004*AcceptanceTest` in locale | verdi | 45 test, 0 falliti |
| T3.3 smoke | run consegna 39364524717 | verde | `success` |
| T3.4–T3.6 | `/api/health`, `/api/families`, `/login` | 200 sha, 401, 200 in 2 lingue | come atteso |
| R1–R12 | registrazione, inviti, limite | codici attesi | verdi (R11/R12 su una sola connessione) |
| D1–D9 | login, sessioni, CSRF, refresh, logout, cambio password | come da piano | verdi; D6 `Max-Age` −1 s |
| E1 | Playwright su produzione, it e en | 2 passati | 2 passati |

## Difetti trovati
| Difetto | Gravità | difetto_di | Prova (comando) |
|---|---|---|---|
| `Max-Age` del cookie di sessione 2591999 invece di 2592000 | minore | 004 | `POST /api/auth/login` con `client: web`, header `Set-Cookie` |

## Proposte al metodo
Le prove sul limite per IP, da sessioni cloud, si fanno su una sola connessione TCP.
