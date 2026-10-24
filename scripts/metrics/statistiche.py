#!/usr/bin/env python3
"""Writes docs/lab/STATISTICHE.md: the numbers of experiment 3 against the thresholds P1–P6.

    python3 scripts/metrics/statistiche.py [--root CARTELLA]

Inputs: metrics/giri.csv (scripts/metrics/raccogli.py; only the rounds from `dal_giro` of
traguardi.json count, ESPERIMENTO §4.1), metrics/tempo-umano.csv, metrics/moduli-pr-umane.csv,
docs/lab/traguardi.json, docs/lab/fase0-decisioni-esp3.md, docs/lab/giri/NNN-agenti.json,
progetto.yml (modelli_attesi). Definitions: docs/ESPERIMENTO.md §3–§4 and docs/lab/DELTA-V4.md V7.

Only numbers: each threshold gets an outcome among «passata», «mancata» and «non misurabile»,
never a conclusion (DELTA-V4 V5: conclusions are the human's). An unknown value is never a zero.
"""
import csv
import datetime
import glob
import json
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PASSATA, MANCATA, NON_MISURABILE = "passata", "mancata", "non misurabile"
TIPI = ("costruzione", "verifica-produzione", "runbook", "caccia", "chiusura")
CLOSING = "chiusura"  # the closing round (SKILL §13): only numbers, outside P4, the primary metric and attribution
GRAVITA = ("bloccante", "maggiore", "minore")
# ESPERIMENTO §4: round 000 counts in full for T1 and T2 (a conservative double count, no split).
FIRST_ROUND_GOALS = ("T1", "T2")
RATIFICA_ID = re.compile(r"\d{3}-[a-c]")
LETTERS = "abc"  # at most 3 ratifiche per round (METODO §3)


# ---------------------------------------------------------------- reading


def read_text(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def read_csv(root, name):
    path = os.path.join(root, "metrics", name)
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def read_goals_file(root):
    path = os.path.join(root, "docs", "lab", "traguardi.json")
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def read_goals(root):
    return read_goals_file(root).get("traguardi", [])


def read_expected_models(root):
    """The `modelli_attesi:` block of progetto.yml (plain `key: value` lines; no PyYAML)."""
    out, inside = {}, False
    try:
        lines = read_text(os.path.join(root, "progetto.yml")).splitlines()
    except OSError:
        return out
    for line in lines:
        if re.match(r"^modelli_attesi:\s*(#.*)?$", line):
            inside = True
            continue
        if inside:
            if line.strip() == "" or line.lstrip().startswith("#"):
                continue
            if not line.startswith((" ", "\t")):
                break
            m = re.match(r"^\s+([\w-]+):\s*([^#\s]+)", line)
            if m:
                out[m.group(1)] = m.group(2).strip("\"'")
    return out


def read_agents(root, giro):
    path = os.path.join(root, "docs", "lab", "giri", f"{giro}-agenti.json")
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) and isinstance(data.get("agenti"), list) else None
    except (OSError, ValueError):
        return None


PHASE0_FILE = "fase0-decisioni-esp3.md"
PHASE0_REVIEW = "revisione-fase0-esp3.md"


def read_phase0(root):
    """Outcomes of the main table of the phase-0 register (the first table with «Esito»)."""
    path = os.path.join(root, "docs", "lab", PHASE0_FILE)
    try:
        lines = read_text(path).splitlines()
    except OSError:
        return None
    outcomes, column = [], None
    for line in lines:
        cells = [c.strip() for c in line.strip().strip("|").split("|")] if line.strip().startswith("|") else None
        if column is None:
            if cells and "Esito" in cells:
                column = cells.index("Esito")
            continue
        if cells is None:
            break  # the main table ends at the first line that is not a table row
        if set("".join(cells)) <= set("-: "):
            continue
        if len(cells) > column:
            outcomes.append(cells[column].strip("* ").lower())
    return outcomes if column is not None else None


# ---------------------------------------------------------------- helpers


def num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def fmt(value, decimals=0):
    if value is None or value == "":
        return "—"
    if decimals == 0:
        return f"{round(value):,}".replace(",", ".")
    return f"{value:,.{decimals}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def pct(value):
    return "—" if value is None else f"{fmt(value * 100)}%"


def combine(outcomes):
    """Any part missed → missed; else any part unmeasurable → unmeasurable; else passed."""
    if not outcomes:
        return NON_MISURABILE
    if MANCATA in outcomes:
        return MANCATA
    return NON_MISURABILE if NON_MISURABILE in outcomes else PASSATA


def at_most(known, unknown, limit):
    """Outcome of «value ≤ limit» when `known` is a partial sum and `unknown` says a part is missing."""
    if known is None:
        return NON_MISURABILE
    if known > limit:
        return MANCATA
    return NON_MISURABILE if unknown else PASSATA


def share_at_least(low, high, total, limit):
    """Outcome of «share ≥ limit» given low/high counts (high includes the undetermined ones)."""
    if not total:
        return NON_MISURABILE
    if low / total >= limit:
        return PASSATA
    return MANCATA if high / total < limit else NON_MISURABILE


def merged(row):
    return bool((row.get("pr_mergiata") or "").strip())


def concluded(row):
    return merged(row) or row.get("esito") == "chiusa"


def counted(rows):
    """Rounds that count for P4 and the primary metric: all but the closing round."""
    return [r for r in rows if (r.get("tipo") or "") != CLOSING]


def human_merge(row):
    return merged(row) and row.get("merge_automatico") == "no"


def round_goals(row):
    """Goals a round counts for by its own traguardo (round 000 → T1 and T2)."""
    if row.get("giro") == "000":
        return list(FIRST_ROUND_GOALS)
    return [row["traguardo"]] if row.get("traguardo") else []


def parse_time(value):
    try:
        return datetime.datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=datetime.timezone.utc)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------- attribution (ESPERIMENTO §4, E5)


def attribution(row, goals):
    """[(bucket, threshold)] of a round's human minutes: ("T3", "P1"), ("integrazione FCM", "P2"),
    ("caccia", None). A missing or unknown tipo counts as costruzione and is listed apart."""
    integrations = {g["id"]: g.get("integrazioni") or [] for g in goals}
    tipo = row.get("tipo") or ""
    owner = row.get("traguardo") or ""
    if tipo == CLOSING:
        return []
    if tipo == "caccia":
        return [("caccia", None)]
    if tipo == "runbook" or (tipo == "verifica-produzione" and integrations.get(owner)):
        names = integrations.get(owner) or ["(non indicata)"]
        return [(f"integrazione {name}", "P2") for name in names]
    return [(goal, "P1") for goal in round_goals(row)]


# ---------------------------------------------------------------- primary metric (DELTA-V4 V7)


def round_failures(row):
    """(failures, unknown) for «closed without human intervention»."""
    failures, unknown = [], []
    checks = [
        ("merge non automatico", row.get("merge_automatico"), lambda v: v == "sì"),
        ("domanda", row.get("domande"), lambda v: num(v) == 0),
        ("commit umano", row.get("commit_umani"), lambda v: num(v) == 0),
        ("minuti umani", row.get("minuti_umani"), lambda v: num(v) == 0),
        ("fuori catena", row.get("fuori_catena"), lambda v: v == "no"),
    ]
    for name, value, ok in checks:
        value = (value or "").strip()
        if not value:
            unknown.append(name)
        elif not ok(value):
            failures.append(name)
    return failures, unknown


def primary(rows):
    """Rounds closed without intervention, over concluded rounds (merged or closed); no closing round."""
    rows = counted(rows)
    done = [r for r in rows if concluded(r)]
    closed, undetermined, detail = [], [], []
    for r in done:
        failures, unknown = round_failures(r)
        if not failures and not unknown:
            closed.append(r["giro"])
        elif not failures:
            undetermined.append(r["giro"])
        detail.append((r["giro"], failures, unknown))
    total = len(done)
    return {
        "chiusi": closed,
        "non_determinati": undetermined,
        "conclusi": total,
        "in_corso": [r["giro"] for r in rows if not concluded(r)],
        "quota": len(closed) / total if total else None,
        "esito": share_at_least(len(closed), len(closed) + len(undetermined), total, 0.5),
        "dettaglio": detail,
    }


# ---------------------------------------------------------------- P1 and P2 (human minutes)


def minutes_by_bucket(rows, goals, human_rows):
    """{bucket: [known minutes, unknown flag, rounds]} with the tempo-umano «integrazione» rows."""
    out = {}
    for r in rows:
        for bucket, _ in attribution(r, goals):
            slot = out.setdefault(bucket, [0.0, False, []])
            value = num(r.get("minuti_umani"))
            if value is None:
                slot[1] = True
            else:
                slot[0] += value
                if (r.get("minuti_ignoti") or "").strip() == "sì":
                    slot[1] = True  # known minutes of a formless merge are a minimum (ESPERIMENTO §4.4)
            slot[2].append(r["giro"])
    for h in human_rows:
        ref = (h.get("riferimento") or "").strip()
        if ref.lower().startswith("integrazione "):
            slot = out.setdefault("integrazione " + ref[len("integrazione "):].strip(), [0.0, False, []])
            value = num(h.get("minuti"))
            slot[0] += value or 0
    return out


def p1(rows, goals, human_rows):
    buckets = minutes_by_bucket(rows, goals, human_rows)
    """«≤ 10' on every internal goal, and on average»: a goal not passed yet is «non misurabile», so P1
    is «passata» only when every goal has passed, each within 10'."""
    passed = [g["id"] for g in goals if g.get("stato") == "passato"]
    per_goal, outcomes, open_goals = [], [], []
    for g in goals:
        known, unknown, rounds = buckets.get(g["id"], [0.0, False, []])
        if g["id"] in passed:
            outcome = at_most(known, unknown, 10)
        else:
            outcome = NON_MISURABILE
            open_goals.append(g["id"])
        outcomes.append(outcome)
        per_goal.append((g["id"], known if rounds else None, unknown, outcome))
    mean, mean_unknown = None, False
    if passed:
        values = [buckets.get(goal, [0.0, False, []]) for goal in passed]
        mean = sum(v[0] for v in values) / len(passed)
        mean_unknown = any(v[1] for v in values)  # a partial sum makes the mean a minimum («≥», §4.4)
        outcomes.append(at_most(mean, mean_unknown, 10))
    return {"traguardi": per_goal, "passati": passed, "non_passati": open_goals, "media": mean,
            "media_ignota": mean_unknown, "esito": combine(outcomes)}


def p2(rows, goals, human_rows):
    buckets = minutes_by_bucket(rows, goals, human_rows)
    out, outcomes = [], []
    for g in goals:
        for name in g.get("integrazioni") or []:
            slot = buckets.get(f"integrazione {name}")
            known, unknown = (slot[0], slot[1]) if slot else (None, False)  # no data yet is not 0'
            outcome = at_most(known, unknown, 60) if g.get("stato") == "passato" else NON_MISURABILE
            outcomes.append(outcome)
            out.append((name, g["id"], known, unknown, outcome))
    return {"integrazioni": out, "esito": combine(outcomes)}


# ---------------------------------------------------------------- P3 (decisions)


def ratifiche_listed(row):
    """Ratifica ids («NNN-a») read in the merge forms of a row's PR (column «ratifiche_lette»)."""
    return set(RATIFICA_ID.findall(row.get("ratifiche_lette") or ""))


def ratifiche_of(row):
    """Ratifica ids a round's report declares: NNN-a, NNN-b, NNN-c, from «decisioni_ratifica»."""
    count = int(num(row.get("decisioni_ratifica")) or 0)
    return {f"{row['giro']}-{letter}" for letter in LETTERS[:max(0, count)]}


def ratifiche_read_share(rows):
    """(read, due, pending). A ratifica of round N is read when a merge form lists its id on a PR
    merged by the human, from N's own merge up to and including the first human merge after N's
    merge (P3, «entro il merge successivo»; automatic merges in between do not use up the window).
    Without such a later human merge yet, unread ratifiche are pending, not missed."""
    order = sorted((r for r in rows if merged(r)), key=lambda r: r["pr_mergiata"])
    read = due = 0
    pending = []
    for i, r in enumerate(order):
        ids = ratifiche_of(r)
        if not ids:
            continue
        seen, closed = set(), False
        if human_merge(r):
            seen |= ratifiche_listed(r)
        for later in order[i + 1:]:
            if human_merge(later):
                seen |= ratifiche_listed(later)
                closed = True
                break
        got = ids & seen
        if not closed and got != ids:
            pending.append(r["giro"])  # the window is still open
            continue
        due += len(ids)
        read += len(got)
    return read, due, pending


def p3(rows, goals):
    passed = {g["id"] for g in goals if g.get("stato") == "passato"}
    per_goal, outcomes = [], []
    for g in goals:
        mine = [r for r in rows if g["id"] in round_goals(r)]
        values = [num(r.get(k)) for r in mine for k in ("decisioni_ratifica", "porte_senso_unico")]
        known = sum(v for v in values if v is not None)
        unknown = None in values
        outcome = at_most(known, unknown, 5) if g["id"] in passed else None
        if outcome:
            outcomes.append(outcome)
        per_goal.append((g["id"], known if mine else None, unknown, outcome))
    if not passed:
        outcomes.append(NON_MISURABILE)
    read, due, pending = ratifiche_read_share(rows)
    reading = NON_MISURABILE if not due else (PASSATA if read == due else MANCATA)
    return {"traguardi": per_goal, "lette": read, "dovute": due, "in_attesa": pending,
            "esito_lettura": reading, "esito": combine(outcomes + [reading])}


# ---------------------------------------------------------------- P4 (autonomy)


def autonomy(rows):
    rows = counted(rows)
    done = [r for r in rows if merged(r)]
    auto = sum(1 for r in done if r.get("merge_automatico") == "sì")
    outside = [r["giro"] for r in rows if r.get("fuori_catena") == "sì"]
    starts = [parse_time(r.get("inizio")) for r in rows]
    # The calendar runs to the merge that closes the last goal: hunt rounds stay out of the
    # calendar, not out of the waits (ESPERIMENTO §4.2).
    ends = [parse_time(r.get("pr_mergiata")) for r in done if (r.get("tipo") or "") != "caccia"]
    starts, ends = [s for s in starts if s], [e for e in ends if e]
    calendar = (max(ends) - min(starts)).total_seconds() / 3600 if starts and ends and max(ends) > min(starts) else None
    waits = [num(r.get("ore_attesa_umana")) for r in rows if concluded(r) or r.get("ore_attesa_umana")]
    wait_known = sum(w for w in waits if w is not None)
    wait_unknown = None in waits
    main = primary(rows)
    parts = {
        "merge_automatici": share_at_least(auto, auto, len(done), 0.6),
        "fuori_catena": NON_MISURABILE if not rows else (PASSATA if not outside else MANCATA),
        "attese": NON_MISURABILE if not calendar else at_most(wait_known / calendar, wait_unknown, 0.5),
        "primaria": main["esito"],
    }
    return {
        "mergiati": len(done), "automatici": auto, "quota_auto": auto / len(done) if done else None,
        "fuori_catena": outside, "calendario_ore": calendar, "attese_ore": wait_known if waits else None,
        "attese_ignote": wait_unknown, "quota_attese": wait_known / calendar if calendar else None,
        "primaria": main, "parti": parts, "esito": combine(list(parts.values())),
    }


# ---------------------------------------------------------------- P5 (quality after merge)


def defects(rows):
    """(blocking, unknown gravity, all): one record per defect in the «difetti» column
    ("003:bloccante;005:minore"). A round with «difetto_di» but no «difetti» record has defects of
    unknown gravity, one per origin round."""
    blocking = unknown = total = 0
    for r in rows:
        items = [i.strip().lower() for i in (r.get("difetti") or "").split(";") if i.strip()]
        records = [i.split(":", 1) for i in items if re.fullmatch(r"\d{3}:\w+", i)]
        if not records:
            origins = re.findall(r"\d{3}", r.get("difetto_di") or "")
            total += len(origins)
            unknown += len(origins)
            continue
        for _, gravity in records:
            total += 1
            blocking += gravity == "bloccante"
            unknown += gravity not in GRAVITA
    return blocking, unknown, total


def read_outcome(path):
    """«esito:» from the front matter of a file, lower case; "" when the file or the field is missing."""
    try:
        text = read_text(path)
    except OSError:
        return ""
    m = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n", text, re.S)
    for line in (m.group(1).splitlines() if m else []):
        key, _, value = line.partition(":")
        if key.strip() == "esito":
            return re.split(r"\s+#", value.strip(), maxsplit=1)[0].strip().lower()
    return ""


def outcome_of(value):
    """passata / mancata / non misurabile from a recorded «esito» (passato, passata, mancato, …)."""
    if value in ("passato", "passata"):
        return PASSATA
    if value in ("mancato", "mancata", "non-passato", "non passato"):
        return MANCATA
    return NON_MISURABILE


def v1_proof(root):
    """The recorded proof of the V1 check (ESPERIMENTO P5, E3), run by the human in C1 or round 000:
    docs/lab/prove/v1.md with «esito:» in its front matter. Only there: the folder is protected, while
    docs/lab/DECISIONI.md is written by the rounds too. Absent → non misurabile."""
    return outcome_of(read_outcome(os.path.join(root, "docs", "lab", "prove", "v1.md")))


def p5(root, rows, goals):
    ended = os.path.exists(os.path.join(root, "docs", "lab", "STOP"))
    built = sorted({g for r in rows if merged(r) and (r.get("tipo") or "costruzione") == "costruzione"
                    for g in round_goals(r)}, key=lambda t: int(t[1:]) if t[1:].isdigit() else 0)
    verified = {r.get("traguardo") for r in rows if merged(r) and r.get("tipo") == "verifica-produzione"}
    missing = [g for g in built if g not in verified]
    hunts = [r["giro"] for r in rows if merged(r) and r.get("tipo") == "caccia"]
    blocking, unknown, total = defects(rows)
    v1 = v1_proof(root)
    later = MANCATA if ended else NON_MISURABILE
    parts = {
        "verifiche": (PASSATA if built and not missing else later),
        "caccia": PASSATA if hunts else later,
        "bloccanti": MANCATA if blocking > 1 else (
            NON_MISURABILE if not any(merged(r) for r in rows) or blocking + unknown > 1 else PASSATA),
        "controllo_v1": v1,
    }
    return {"costruiti": built, "senza_verifica": missing, "cacce": hunts, "bloccanti": blocking,
            "gravita_ignota": unknown, "difetti": total, "v1": v1, "finito": ended, "parti": parts,
            "esito": combine(list(parts.values()))}


# ---------------------------------------------------------------- P6 (phase 0)


def p6(root):
    outcomes = read_phase0(root)
    review_path = os.path.join(root, "docs", "lab", PHASE0_REVIEW)
    review = os.path.exists(review_path)
    # The review passes only on its recorded «esito:» (front matter); being there is not passing.
    review_outcome = read_outcome(review_path)
    if not outcomes:
        share, first = None, NON_MISURABILE
    else:
        changed = sum(1 for o in outcomes if o in ("cambiata", "respinta"))
        share = changed / len(outcomes)
        first = PASSATA if share >= 0.25 else MANCATA
    counts = {k: sum(1 for o in outcomes or [] if o == k) for k in ("accettata", "cambiata", "respinta")}
    second = outcome_of(review_outcome)
    return {"proposte": len(outcomes or []), "conteggi": counts, "quota": share, "revisione": review,
            "esito_revisione": review_outcome,
            "parti": {"cambiate_respinte": first, "revisione": second}, "esito": combine([first, second])}


# ---------------------------------------------------------------- descriptive


REQUIRED_AGENTS = ("pianificatore", "critico", "costruttore-tdd", "revisore", "orchestratore")


def model_problems(data, expected, tipo):
    """Why a round's agent register fails the V1 rule (same rule as pr_guard); [] when it passes."""
    if data is None:
        return ["registro degli agenti mancante"]
    problems = []
    for agent in data["agenti"]:
        kind = agent.get("agent_type") or ""
        if kind not in expected:
            continue
        if agent.get("fonte") != "transcript":
            problems.append(f"{kind}: fonte {agent.get('fonte') or 'assente'}")
        for model in agent.get("modelli") or []:
            if not str(model).startswith(expected[kind]):
                problems.append(f"{kind}: {model} invece di {expected[kind]}")
    if tipo == "costruzione":
        present = {a.get("agent_type") for a in data["agenti"]}
        problems += [f"{kind}: assente" for kind in REQUIRED_AGENTS if kind not in present]
    return problems


def human_time_by_reference(human_rows):
    out = {}
    for h in human_rows:
        ref = (h.get("riferimento") or "").strip()
        key = "integrazione" if ref.lower().startswith("integrazione") else ("giro" if ref.startswith("giro ") else ref)
        out[key] = out.get(key, 0) + (num(h.get("minuti")) or 0)
    return out


def total(rows, key):
    values = [num(r.get(key)) for r in rows]
    values = [v for v in values if v is not None]
    return sum(values) if values else None


# ---------------------------------------------------------------- rendering


def minutes_text(value, unknown):
    if value is None:
        return "—"
    return f"≥ {fmt(value)}' (minuti ignoti in qualche giro)" if unknown else f"{fmt(value)}'"


def goal_list(per_goal, unit):
    parts = []
    for goal, value, unknown, outcome in per_goal:
        if outcome is None:
            continue
        shown = minutes_text(value, unknown) if unit == "'" else (
            "—" if value is None else f"{'≥ ' if unknown else ''}{fmt(value)}")
        parts.append(f"{goal} {shown}")
    return ", ".join(parts) or "nessun traguardo passato"


def render(root, rows, goals, human_rows, module_rows, now):
    r1, r3 = p1(rows, goals, human_rows), p3(rows, goals)
    # Human-PR forms with «integrazione <nome>» count in P2 (ESPERIMENTO §4.3).
    r2 = p2(rows, goals, human_rows + module_rows)
    r4, r5, r6 = autonomy(rows), p5(root, rows, goals), p6(root)
    main = r4["primaria"]
    out = ["# Statistiche — esperimento 3 (metodo v4, fase UI)\n"]
    out.append(
        f"> Generato da `scripts/metrics/statistiche.py` il {now}. Dati: `metrics/giri.csv` (dal "
        "giro `dal_giro` di `traguardi.json`), `metrics/tempo-umano.csv`, "
        "`metrics/moduli-pr-umane.csv`, `docs/lab/traguardi.json`, `docs/lab/giri/NNN-agenti.json`, "
        f"`docs/lab/{PHASE0_FILE}`. Soglie e regole di conteggio: `docs/ESPERIMENTO.md` §3–§4.\n>\n"
        f"> Giri: {len(rows)} · traguardi passati: {len([g for g in goals if g.get('stato') == 'passato'])} "
        f"su {len(goals)}. Solo numeri ed esiti delle soglie: le conclusioni le scrive l'umano in "
        "`docs/lab/CONCLUSIONI.md`.\n"
    )

    out.append("## Metrica primaria: giri chiusi senza intervento umano\n")
    out.append(
        f"**{len(main['chiusi'])} su {main['conclusi']} giri conclusi ({pct(main['quota'])})** · soglia ≥ 50% "
        f"(parte di P4) · esito: **{main['esito']}**.\n"
    )
    out.append(
        "Un giro è chiuso senza intervento se ha merge automatico, nessuna `domanda`, nessun commit umano sul "
        "branch, 0 minuti umani (modulo o `tempo-umano.csv`) e non è `fuori-catena` (DELTA-V4 V7). Il "
        "denominatore sono i giri conclusi (PR mergiata o chiusa). Fonte: `metrics/giri.csv` "
        "(`merge_automatico`, `domande`, `commit_umani`, `minuti_umani`, `fuori_catena`).\n"
    )
    if main["non_determinati"]:
        out.append(f"Non determinabili per un dato mancante: {', '.join(main['non_determinati'])}.\n")
    if main["in_corso"]:
        out.append(f"Giri non ancora conclusi, fuori dal conteggio: {', '.join(main['in_corso'])}.\n")
    if main["dettaglio"]:
        out.append("| Giro | Motivi di intervento | Dati mancanti |")
        out.append("|---|---|---|")
        for giro, failures, unknown in main["dettaglio"]:
            out.append(f"| {giro} | {', '.join(failures) or 'nessuno'} | {', '.join(unknown) or '—'} |")
        out.append("")
    return out, (r1, r2, r3, r4, r5, r6)


def render_thresholds(out, results):
    r1, r2, r3, r4, r5, r6 = results
    integ = "; ".join(
        f"{name} ({goal}): {minutes_text(known, unknown)}" + ("" if outcome != NON_MISURABILE or unknown else
                                                              ", traguardo non passato")
        for name, goal, known, unknown, outcome in r2["integrazioni"]
    ) or "nessuna integrazione in `traguardi.json`"
    p4_value = (
        f"merge automatici {r4['automatici']}/{r4['mergiati']} ({pct(r4['quota_auto'])}); fuori catena "
        f"{len(r4['fuori_catena'])}; attese {fmt(r4['attese_ore'], 1)} h su {fmt(r4['calendario_ore'], 1)} h di "
        f"calendario ({pct(r4['quota_attese'])}{', con attese ignote' if r4['attese_ignote'] else ''}); "
        f"metrica primaria {pct(r4['primaria']['quota'])}"
    )
    p5_value = (
        f"traguardi costruiti {len(r5['costruiti'])}, senza giro di verifica {len(r5['senza_verifica'])}"
        f"{' (' + ', '.join(r5['senza_verifica']) + ')' if r5['senza_verifica'] else ''}; cacce {len(r5['cacce'])}; "
        f"difetti dopo il merge {r5['difetti']}, bloccanti {r5['bloccanti']}"
        f"{', gravità ignota ' + str(r5['gravita_ignota']) if r5['gravita_ignota'] else ''}; prova del controllo V1 "
        f"{'registrata: ' + r5['v1'] if r5['v1'] != NON_MISURABILE else 'non registrata (docs/lab/prove/v1.md)'}"
        f"{'' if r5['finito'] else '; esperimento in corso'}"
    )
    c = r6["conteggi"]
    p6_value = (
        f"{c['cambiata'] + c['respinta']} cambiate o respinte su {r6['proposte']} ({pct(r6['quota'])}): "
        f"accettate {c['accettata']}, cambiate {c['cambiata']}, respinte {c['respinta']}; revisione "
        f"indipendente " + (f"con esito «{r6['esito_revisione']}»" if r6["esito_revisione"] else
                            ("presente, senza `esito:` registrato" if r6["revisione"] else "assente"))
    )
    p1_open = f"; non passati: {', '.join(r1['non_passati'])}" if r1["non_passati"] else ""
    table = [
        ("P1", "Lavoro interno: minuti umani per traguardo", "≤ 10' su ogni traguardo e in media",
         f"{goal_list([g for g in r1['traguardi'] if g[0] in r1['passati']], chr(39))}; media "
         f"{minutes_text(r1['media'], r1['media_ignota'])}{p1_open}", r1["esito"],
         "`giri.csv` (`minuti_umani`, `tipo`, `traguardo`) con l'attribuzione sotto"),
        ("P2", "Integrazioni: minuti umani per integrazione", "≤ 60' per ciascuna", integ, r2["esito"],
         "`tempo-umano.csv` (`integrazione <nome>`) + `giri.csv` (giri runbook e verifica dell'integrazione)"),
        ("P3", "Decisioni", "≤ 5 per traguardo; 100% delle ratifiche lette entro il merge successivo",
         f"{goal_list(r3['traguardi'], '')}; ratifiche lette {r3['lette']}/{r3['dovute']}"
         f"{' (in attesa: ' + ', '.join(r3['in_attesa']) + ')' if r3['in_attesa'] else ''}", r3["esito"],
         "`giri.csv` (`decisioni_ratifica`, `porte_senso_unico`, `ratifiche_lette`)"),
        ("P4", "Autonomia", "≥ 60% merge automatici; 0 fuori catena; attese ≤ 50% del calendario; primaria ≥ 50%",
         p4_value, r4["esito"],
         "`giri.csv` (`merge_automatico`, `fuori_catena`, `inizio`, `pr_mergiata`, `ore_attesa_umana`)"),
        ("P5", "Qualità dopo il merge", "verifica per traguardo e caccia finale fatte; ≤ 1 bloccante; V1 provato",
         p5_value, r5["esito"], "`giri.csv` (`tipo`, `difetti`, `difetto_di`); `docs/lab/prove/v1.md`"),
        ("P6", "Fase 0 non a occhi chiusi", "≥ 25% cambiate o respinte; revisione indipendente prima del primo giro",
         p6_value, r6["esito"], f"`docs/lab/{PHASE0_FILE}` (tabella principale); `esito:` in testa a "
         f"`docs/lab/{PHASE0_REVIEW}`"),
    ]
    out.append("## Soglie P1–P6\n")
    out.append("Esiti possibili: passata, mancata, non misurabile (dato mancante o condizione non ancora presentata).\n")
    out.append("| # | Cosa | Soglia | Valore | Esito | Fonte |")
    out.append("|---|---|---|---|---|---|")
    for row in table:
        out.append("| " + " | ".join(str(cell).replace("|", "/") for cell in row[:4]) + f" | **{row[4]}** | {row[5]} |")
    out.append("")
    parts = [("P4", r4["parti"]), ("P5", r5["parti"]), ("P6", r6["parti"])]
    out.append("Esiti per parte: " + " · ".join(
        f"{p}: " + ", ".join(f"{k.replace('_', ' ')} {v}" for k, v in d.items()) for p, d in parts
    ) + f" · P3: lettura delle ratifiche {r3['esito_lettura']}.\n")
    out.append("### Attribuzione (ESPERIMENTO §4)\n")
    out.append("- Contano i giri dal `dal_giro` di `traguardi.json` (esperimento 3; i giri 000–041 sono "
               "dell'esperimento 2). Nessun giro 000 qui: nessun doppio conteggio.")
    out.append("- Il calendario va dall'inizio del primo giro al merge che chiude l'ultimo traguardo: i giri "
               "`caccia` e `chiusura` restano fuori dal calendario, non dalle attese.")
    out.append("- Un modulo che comincia con «🤖» (sessione assistita) conta. I moduli delle PR umane "
               "(`metrics/moduli-pr-umane.csv`) si sommano per `riferimento:`; `integrazione <nome>` entra in P2.")
    out.append("- Un atteso sbagliato del piano non è un difetto; `difetto_di` è il giro d'origine, mai la "
               "verifica. La `domanda` di prova umana non si conta in `porte_senso_unico`.")
    out.append("- Giro di chiusura (`tipo: chiusura`): fuori da P4, dalla metrica primaria e dall'attribuzione.")
    out.append("- Ratifiche: un id `NNN-a` è letto se un modulo di merge lo elenca su una PR mergiata a mano, dal "
               "merge del giro fino al primo merge a mano successivo compreso.")
    out.append("- Giri di costruzione e di verifica di un traguardo: quel traguardo (P1), compresa la parte interna di T10.")
    out.append("- Giri `runbook` e giri di verifica di un traguardo con integrazioni, più le righe `integrazione "
               "<nome>` di `tempo-umano.csv`: quell'integrazione (P2).")
    out.append("- Giri `caccia`: a parte (P5). Righe `setup`, `fase 0`, `meccanismo`, `quotidiano`: descrittive.")
    out.append("- Un merge a mano senza modulo vale «minuti ignoti»: il totale diventa un minimo («≥»).")
    out.append("- Un giro senza `tipo` conta come costruzione ed è elencato nei descrittivi.\n")


def render_descriptive(out, root, rows, human_rows, module_rows, r4_all):
    out.append("## Descrittivi, senza soglia\n")
    build = [r for r in rows if r.get("tipo") == "costruzione"]
    b = autonomy(build)
    out.append(
        f"- **P4 sui soli giri `costruzione`** (E4): merge automatici {b['automatici']}/{b['mergiati']} "
        f"({pct(b['quota_auto'])}); fuori catena {len(b['fuori_catena'])}; attese {pct(b['quota_attese'])} del loro "
        f"calendario; metrica primaria {len(b['primaria']['chiusi'])}/{b['primaria']['conclusi']} "
        f"({pct(b['primaria']['quota'])})."
    )
    expected = read_expected_models(root)
    flagged = []
    for r in rows:
        problems = model_problems(read_agents(root, r["giro"]), expected, r.get("tipo"))
        if problems:
            flagged.append(f"{r['giro']} ({'; '.join(problems)})")
    out.append(f"- **Giri con un modello inatteso** (V1, regola di `pr_guard`): {len(flagged)}"
               f"{': ' + ' · '.join(flagged) if flagged else ''}.")
    absent = [r["giro"] for r in rows if (r.get("token_fonte") or "assente") == "assente"]
    partial = [r["giro"] for r in rows if r.get("token_fonte") == "parziale"]
    out.append(f"- **Token per giro**: nella tabella dei giri. Token assenti: {len(absent)}"
               f"{' (' + ', '.join(absent) + ')' if absent else ''}; parziali: {len(partial)}"
               f"{' (' + ', '.join(partial) + ')' if partial else ''}.")
    out.append(f"- **Minuti di sessione per giro** (`minuti_giro`): nella tabella; totale {fmt(total(rows, 'minuti_giro'))}'.")
    by_ref = human_time_by_reference(human_rows)
    out.append("- **Tempo umano per riferimento** (`tempo-umano.csv`): " + (", ".join(
        f"{ref or '(vuoto)'} {fmt(value)}'" for ref, value in sorted(by_ref.items())) or "nessuna riga") + ".")
    by_form = human_time_by_reference(module_rows)
    out.append("- **Moduli delle PR umane per riferimento** (`moduli-pr-umane.csv`, ESPERIMENTO §4.3): " +
               (", ".join(f"{ref or '(vuoto)'} {fmt(value)}'" for ref, value in sorted(by_form.items()))
                or "nessun modulo") + ".")
    out.append(f"- **Aggiunte fuori piano segnalate dal revisore** (`fuori_perimetro`): {fmt(total(rows, 'fuori_perimetro'))}.")
    out.append(f"- **CI rosse** (`ci_rossi`): {fmt(total(rows, 'ci_rossi'))}.")
    out.append(f"- **Bloccanti presi dal revisore prima del merge** (`revisore_bloccanti`): "
               f"{fmt(total(rows, 'revisore_bloccanti'))}.")
    missing_form = [r["giro"] for r in rows if r.get("modulo_presente") == "no"]
    out.append(f"- **Merge a mano senza modulo** (`modulo_presente = no`): {len(missing_form)}"
               f"{' (' + ', '.join(missing_form) + ')' if missing_form else ''}.")
    untyped = [r["giro"] for r in rows if (r.get("tipo") or "") not in TIPI]
    out.append(f"- **Giri senza un `tipo` valido** (contati come costruzione): {len(untyped)}"
               f"{' (' + ', '.join(untyped) + ')' if untyped else ''}.\n")

    out.append("## Giri\n")
    if not rows:
        out.append("Nessun giro ancora.\n")
        return
    out.append("| Giro | Tipo | Traguardo | Esito | PR | Minuti sessione | Merge automatico | Minuti umani | "
               "Token in/out | Cache lettura/scrittura | Fonte token | Bloccanti | CI rosse |")
    out.append("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for r in rows:
        out.append(
            f"| {r['giro']} | {r.get('tipo') or '—'} | {r.get('traguardo') or '—'} | {r.get('esito') or '—'} | "
            f"{('#' + r['pr']) if r.get('pr') else '—'} | {r.get('minuti_giro') or '—'} | "
            f"{r.get('merge_automatico') or '—'} | {r.get('minuti_umani') or '—'} | "
            f"{fmt(num(r.get('token_input')))}/{fmt(num(r.get('token_output')))} | "
            f"{fmt(num(r.get('token_cache_lettura')))}/{fmt(num(r.get('token_cache_scrittura')))} | "
            f"{r.get('token_fonte') or 'assente'} | {r.get('revisore_bloccanti') or '—'} | {r.get('ci_rossi') or '—'} |"
        )
    out.append("")


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    root = argv[argv.index("--root") + 1] if "--root" in argv else ROOT
    rows = sorted(read_csv(root, "giri.csv"), key=lambda r: r.get("giro") or "")
    goals_file = read_goals_file(root)
    goals = goals_file.get("traguardi", [])
    start = str(goals_file.get("dal_giro") or "").strip()
    if start:  # only this experiment's rounds count (ESPERIMENTO §4.1); giri.csv stays whole
        rows = [r for r in rows if (r.get("giro") or "") >= start]
    human_rows = read_csv(root, "tempo-umano.csv")
    # One row per reference of each human-PR form, shaped like a tempo-umano row.
    module_rows = [{"minuti": m.get("minuti"), "riferimento": ref, "attivita": f"modulo PR #{m.get('pr')}"}
                   for m in read_csv(root, "moduli-pr-umane.csv")
                   for ref in (m.get("riferimento") or "(senza riferimento)").split(";")]
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    out, results = render(root, rows, goals, human_rows, module_rows, now)
    render_thresholds(out, results)
    render_descriptive(out, root, rows, human_rows, module_rows, results[3])
    path = os.path.join(root, "docs", "lab", "STATISTICHE.md")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(out).rstrip("\n") + "\n")
    print(f"docs/lab/STATISTICHE.md: {len(rows)} giri, esiti " +
          " ".join(f"P{i + 1}={r['esito']}" for i, r in enumerate(results)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
