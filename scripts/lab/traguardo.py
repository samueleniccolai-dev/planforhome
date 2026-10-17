#!/usr/bin/env python3
"""Updates the state of one goal in docs/lab/traguardi.json (only the fields a round may change).

    python3 scripts/lab/traguardo.py T3 --stato passato --giro 009 --pr 14 --verifica 009
    python3 scripts/lab/traguardo.py --mostra

The consegna workflow refuses any other change to the file (scripts/guard/pr_guard.py).
A goal becomes «passato» only after its verification round (ESPERIMENTO §4, E2; DELTA-V4 V4, V6):
--verifica NNN must name a report docs/lab/giri/NNN-rapporto.md with tipo: verifica-produzione,
the same traguardo and esito: passato. For a goal with integrations, NNN must be greater than the
goal's last runbook round (a report with tipo: runbook and the same traguardo).
"""
import argparse
import datetime
import json
import os
import re
import sys

LAB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs", "lab")
PATH = os.path.join(LAB, "traguardi.json")
STATI = ("da-fare", "in-corso", "passato")


def read_text(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def front_matter(text):
    m = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n", text or "", re.S)
    data = {}
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                key, value = line.split(":", 1)
                data[key.strip()] = re.split(r"\s+#", value.strip(), maxsplit=1)[0].strip()
    return data


def verification_problem(goal_id, giro, integrations=()):
    """None when round `giro` is a passed production verification of `goal_id`, else the reason.
    The report must name this very goal in `traguardo` (round 000 builds T1 and T2, but T2 passes only
    with its own verification). For a goal with integrations, the verification must come after the
    goal's last runbook round."""
    if not giro:
        return "lo stato passato richiede --verifica NNN (il giro verifica-produzione del traguardo)"
    if not re.fullmatch(r"\d{3}", giro):
        return f"--verifica {giro!r}: serve il numero del giro a tre cifre, es. 009"
    path = os.path.join(LAB, "giri", f"{giro}-rapporto.md")
    try:
        fm = front_matter(read_text(path))
    except OSError:
        return f"manca docs/lab/giri/{giro}-rapporto.md"
    expected = {"tipo": "verifica-produzione", "traguardo": goal_id, "esito": "passato"}
    wrong = [f"{k}: {fm.get(k) or '(vuoto)'} invece di {v}" for k, v in expected.items() if fm.get(k) != v]
    if wrong:
        return f"il rapporto del giro {giro} non prova il traguardo: " + "; ".join(wrong)
    if integrations:
        runbooks = last_runbook(goal_id)
        if runbooks and int(giro) <= int(runbooks):
            return (f"il giro di verifica {giro} non viene dopo l'ultimo giro runbook ({runbooks}) del traguardo: "
                    "la prova del runbook va eseguita dopo")
    return None


def last_runbook(goal_id):
    """The highest round number among the reports with tipo: runbook and this traguardo, or None."""
    found = []
    folder = os.path.join(LAB, "giri")
    for name in sorted(os.listdir(folder)) if os.path.isdir(folder) else []:
        if not re.fullmatch(r"\d{3}-rapporto\.md", name):
            continue
        try:
            fm = front_matter(read_text(os.path.join(folder, name)))
        except OSError:
            continue
        if fm.get("tipo") == "runbook" and fm.get("traguardo") == goal_id:
            found.append(name[:3])
    return max(found) if found else None


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("id", nargs="?", help="T1 … T10")
    parser.add_argument("--stato", choices=STATI)
    parser.add_argument("--giro", help="numero del giro, es. 004")
    parser.add_argument("--pr", type=int, help="numero della PR del giro")
    parser.add_argument("--verifica", help="giro verifica-produzione che prova il traguardo (obbligatorio con passato)")
    parser.add_argument("--mostra", action="store_true", help="stampa lo stato dei traguardi")
    args = parser.parse_args()

    with open(PATH, encoding="utf-8") as f:
        data = json.load(f)
    if args.mostra or not args.id:
        for t in data["traguardi"]:
            print(f"{t['id']}  {t['stato']:<9}  giri={','.join(t['giri']) or '-'}  pr={t['pr'] or '-'}  {t['titolo']}")
        return 0

    goal = next((t for t in data["traguardi"] if t["id"] == args.id), None)
    if goal is None:
        print(f"traguardo sconosciuto: {args.id}", file=sys.stderr)
        return 1
    if args.stato == "passato":
        problem = verification_problem(goal["id"], args.verifica, goal.get("integrazioni") or [])
        if problem:
            print(f"traguardo {goal['id']} non passato: {problem}", file=sys.stderr)
            return 1
        if args.verifica not in goal["giri"]:
            goal["giri"].append(args.verifica)
    if args.giro and args.giro not in goal["giri"]:
        goal["giri"].append(args.giro)
    if args.pr and args.pr not in goal["pr"]:
        goal["pr"].append(args.pr)
    if args.stato:
        goal["stato"] = args.stato
        goal["passato_il"] = (
            datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if args.stato == "passato" else None
        )
    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{goal['id']}: stato={goal['stato']} giri={goal['giri']} pr={goal['pr']} passato_il={goal['passato_il']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
