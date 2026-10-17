"""Tests of statistiche.py: primary metric (V7), P1–P6 outcomes, attribution, empty data."""
import csv
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(REPO, "scripts", "metrics"))
import statistiche as st  # noqa: E402

CLEAN = {"merge_automatico": "sì", "domande": "0", "commit_umani": "0", "minuti_umani": "0",
         "fuori_catena": "no", "pr_mergiata": "2026-10-20T12:00:00Z", "esito": "mergiata", "tipo": "costruzione"}


def giro(number, **fields):
    row = dict(CLEAN, giro=number, traguardo="T3")
    row.update(fields)
    return row


def goals(passed=(), integrations=None):
    integrations = integrations or {"T10": ["FCM"]}
    return [{"id": f"T{i}", "titolo": f"t{i}", "stato": "passato" if f"T{i}" in passed else "da-fare",
             "integrazioni": integrations.get(f"T{i}", [])} for i in range(1, 11)]


class PrimaryMetricTest(unittest.TestCase):
    def test_one_round_per_failure_mode(self):
        rows = [
            giro("001"),
            giro("002", merge_automatico="no"),
            giro("003", domande="1"),
            giro("004", commit_umani="2"),
            giro("005", minuti_umani="4"),
            giro("006", fuori_catena="sì"),
        ]
        result = st.primary(rows)
        self.assertEqual(result["chiusi"], ["001"])
        self.assertEqual(result["conclusi"], 6)
        reasons = {g: f for g, f, _ in result["dettaglio"]}
        self.assertEqual(reasons["002"], ["merge non automatico"])
        self.assertEqual(reasons["003"], ["domanda"])
        self.assertEqual(reasons["004"], ["commit umano"])
        self.assertEqual(reasons["005"], ["minuti umani"])
        self.assertEqual(reasons["006"], ["fuori catena"])
        self.assertEqual(result["esito"], st.MANCATA)

    def test_unknown_values_and_open_rounds(self):
        rows = [giro("001"), giro("002", minuti_umani=""), giro("003", pr_mergiata="", esito="aperta")]
        result = st.primary(rows)
        self.assertEqual((result["chiusi"], result["non_determinati"], result["in_corso"]), (["001"], ["002"], ["003"]))
        self.assertEqual(result["esito"], st.PASSATA)  # 1/2 ≥ 50% already
        self.assertEqual(st.primary([giro("001", minuti_umani=""), giro("002", domande="1")])["esito"],
                         st.NON_MISURABILE)

    def test_no_rounds(self):
        self.assertEqual(st.primary([])["esito"], st.NON_MISURABILE)


class ThresholdsTest(unittest.TestCase):
    def test_p1_outcomes_and_attribution(self):
        self.assertEqual(st.p1([], goals(), [])["esito"], st.NON_MISURABILE)
        rows = [giro("000", traguardo="T1", minuti_umani="6"), giro("001", traguardo="T2", minuti_umani="3"),
                giro("002", traguardo="T10", tipo="runbook", minuti_umani="50")]
        result = st.p1(rows, goals(passed=("T1", "T2")), [])
        per_goal = {g: v for g, v, _, _ in result["traguardi"]}
        self.assertEqual((per_goal["T1"], per_goal["T2"]), (6, 9))  # round 000 counts in both
        self.assertIsNone(per_goal["T10"])  # the runbook round goes to P2
        self.assertEqual(result["esito"], st.PASSATA)
        rows.append(giro("003", traguardo="T2", minuti_umani="5"))
        self.assertEqual(st.p1(rows, goals(passed=("T1", "T2")), [])["esito"], st.MANCATA)
        unknown = [giro("000", traguardo="T1", minuti_umani="")]
        self.assertEqual(st.p1(unknown, goals(passed=("T1",)), [])["esito"], st.NON_MISURABILE)

    def test_p2_integration(self):
        human = [{"minuti": "30", "riferimento": "integrazione FCM"}]
        rows = [giro("010", traguardo="T10", tipo="runbook", minuti_umani="20"),
                giro("011", traguardo="T10", tipo="verifica-produzione", minuti_umani="5")]
        self.assertEqual(st.p2(rows, goals(), human)["esito"], st.NON_MISURABILE)  # T10 not passed
        result = st.p2(rows, goals(passed=("T10",)), human)
        self.assertEqual(result["integrazioni"][0][2], 55)
        self.assertEqual(result["esito"], st.PASSATA)
        human.append({"minuti": "10", "riferimento": "integrazione FCM"})
        self.assertEqual(st.p2(rows, goals(passed=("T10",)), human)["esito"], st.MANCATA)

    def test_p3_decisions_and_ratifiche(self):
        rows = [giro("004", traguardo="T3", decisioni_ratifica="2", porte_senso_unico="1",
                     pr_mergiata="2026-10-20T10:00:00Z"),
                giro("005", traguardo="T3", decisioni_ratifica="0", porte_senso_unico="0",
                     pr_mergiata="2026-10-21T10:00:00Z", ratifiche_lette="004:2/2")]
        result = st.p3(rows, goals(passed=("T3",)))
        self.assertEqual((result["lette"], result["dovute"]), (2, 2))
        self.assertEqual(result["esito"], st.PASSATA)
        rows[1]["ratifiche_lette"] = "004:1/2"
        self.assertEqual(st.p3(rows, goals(passed=("T3",)))["esito"], st.MANCATA)
        self.assertEqual(st.p3([], goals())["esito"], st.NON_MISURABILE)

    def test_p4_parts(self):
        rows = [giro("001", inizio="2026-10-20T00:00:00Z", ore_attesa_umana="0"),
                giro("002", merge_automatico="no", minuti_umani="3", inizio="2026-10-20T02:00:00Z",
                     pr_mergiata="2026-10-20T10:00:00Z", ore_attesa_umana="2")]
        result = st.autonomy(rows)
        self.assertEqual(result["quota_auto"], 0.5)
        self.assertEqual(result["parti"]["merge_automatici"], st.MANCATA)
        self.assertEqual(result["parti"]["fuori_catena"], st.PASSATA)
        self.assertEqual(result["esito"], st.MANCATA)
        self.assertEqual(st.autonomy([])["esito"], st.NON_MISURABILE)

    def test_p5_and_p6_from_files(self):
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, "docs", "lab"))
            self.assertEqual(st.p6(root)["esito"], st.NON_MISURABILE)
            with open(os.path.join(root, "docs", "lab", "fase0-decisioni.md"), "w", encoding="utf-8") as f:
                f.write("# x\n\n| # | Proposta | Esito | Perché |\n|---|---|---|---|\n"
                        "| 1 | a | accettata | |\n| 2 | b | cambiata | c |\n| 3 | c | respinta | |\n"
                        "| 4 | d | accettata | |\n\n## Fuori\n\n| Voce | Esito |\n|---|---|\n| z | respinta |\n")
            result = st.p6(root)
            self.assertEqual((result["proposte"], result["quota"]), (4, 0.5))
            self.assertEqual(result["esito"], st.NON_MISURABILE)  # no review file yet
            open(os.path.join(root, "docs", "lab", "revisione-fase0.md"), "w").close()
            self.assertEqual(st.p6(root)["esito"], st.PASSATA)

            rows = [giro("003", difetto_di="001 bloccante"), giro("004", difetto_di="002 bloccante")]
            self.assertEqual(st.p5(root, rows, goals())["esito"], st.MANCATA)
            self.assertEqual(st.p5(root, [giro("003")], goals())["esito"], st.NON_MISURABILE)


class ModelCheckTest(unittest.TestCase):
    def test_rule(self):
        expected = {"revisore": "claude-opus-5-5", "orchestratore": "claude-sonnet-5-5"}
        ok = {"agenti": [{"agent_type": "revisore", "modelli": ["claude-opus-5-5[1m]"], "fonte": "transcript"},
                         {"agent_type": "", "modelli": ["x"], "fonte": "assente"}]}
        self.assertEqual(st.model_problems(ok, expected, "verifica-produzione"), [])
        bad = {"agenti": [{"agent_type": "revisore", "modelli": ["claude-sonnet-5-5"], "fonte": "transcript"}]}
        self.assertTrue(st.model_problems(bad, expected, "verifica-produzione"))
        self.assertTrue(st.model_problems(ok, expected, "costruzione"))  # agents missing
        self.assertEqual(st.model_problems(None, expected, "caccia"), ["registro degli agenti mancante"])


class MainTest(unittest.TestCase):
    def make_root(self, root, rows):
        os.makedirs(os.path.join(root, "docs", "lab"))
        os.makedirs(os.path.join(root, "metrics"))
        with open(os.path.join(root, "docs", "lab", "traguardi.json"), "w", encoding="utf-8") as f:
            json.dump({"traguardi": goals()}, f)
        if rows is not None:
            with open(os.path.join(root, "metrics", "giri.csv"), "w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=sorted({k for r in rows for k in r} | {"giro"}))
                writer.writeheader()
                writer.writerows(rows)

    def output(self, root):
        self.assertEqual(st.main(["--root", root]), 0)
        with open(os.path.join(root, "docs", "lab", "STATISTICHE.md"), encoding="utf-8") as f:
            return f.read()

    def test_zero_rounds(self):
        for rows in (None, []):
            with self.subTest(rows=rows), tempfile.TemporaryDirectory() as root:
                self.make_root(root, rows)
                text = self.output(root)
                self.assertIn("giri chiusi senza intervento umano", text)
                self.assertIn("Nessun giro ancora", text)
                self.assertNotIn("Gerio", text)
                for word in ("confermata", "smentita"):
                    self.assertNotIn(word, text)

    def test_some_rounds(self):
        with tempfile.TemporaryDirectory() as root:
            self.make_root(root, [giro("000", traguardo="T1", inizio="2026-10-19T00:00:00Z", token_fonte="assente"),
                                  giro("001", merge_automatico="no", minuti_umani="")])
            text = self.output(root)
            self.assertIn("**1 su 2 giri conclusi (50%)**", text)
            self.assertIn("| P1 |", text)
            self.assertIn("| 001 |", text)


if __name__ == "__main__":
    unittest.main()
