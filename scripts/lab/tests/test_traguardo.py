"""Tests of traguardo.py: «passato» only with --verifica NNN (ESPERIMENTO §4, E2; DELTA-V4 V4, V6)."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.normpath(os.path.join(HERE, "..", "traguardo.py"))


def report(tipo="verifica-produzione", traguardo="T3", esito="passato"):
    return f"---\ngiro: 009\ntraguardo: {traguardo}\ntipo: {tipo}\nesito: {esito}\n---\n# Rapporto\n"


class TraguardoTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = self.tmp.name
        os.makedirs(os.path.join(root, "scripts", "lab"))
        os.makedirs(os.path.join(root, "docs", "lab", "giri"))
        self.script = os.path.join(root, "scripts", "lab", "traguardo.py")
        shutil.copy(SCRIPT, self.script)
        self.goals = os.path.join(root, "docs", "lab", "traguardi.json")
        goal = {"id": "T3", "titolo": "Account", "stato": "in-corso", "giri": ["004"], "pr": [12], "passato_il": None}
        with open(self.goals, "w", encoding="utf-8") as f:
            json.dump({"traguardi": [goal]}, f)
        self.report_path = os.path.join(root, "docs", "lab", "giri", "009-rapporto.md")

    def tearDown(self):
        self.tmp.cleanup()

    def run_script(self, *args):
        return subprocess.run([sys.executable, "-I", self.script, *args], capture_output=True, text=True, timeout=60)

    def goal(self):
        with open(self.goals, encoding="utf-8") as f:
            return json.load(f)["traguardi"][0]

    def write_report(self, text):
        with open(self.report_path, "w", encoding="utf-8") as f:
            f.write(text)

    def assert_rejected(self, *args):
        res = self.run_script("T3", "--stato", "passato", *args)
        self.assertEqual(res.returncode, 1, res.stdout)
        self.assertEqual(self.goal()["stato"], "in-corso")
        self.assertIsNone(self.goal()["passato_il"])
        return res.stderr

    def test_passato_without_verifica_is_refused(self):
        self.assertIn("--verifica", self.assert_rejected())

    def test_missing_report_is_refused(self):
        self.assertIn("009-rapporto.md", self.assert_rejected("--verifica", "009"))

    def test_wrong_report_is_refused(self):
        for text in (report(tipo="costruzione"), report(traguardo="T4"), report(esito="parziale")):
            with self.subTest(text=text):
                self.write_report(text)
                self.assert_rejected("--verifica", "009")

    def test_bad_round_number_is_refused(self):
        self.assert_rejected("--verifica", "9")

    def test_verification_report_accepted(self):
        self.write_report(report())
        res = self.run_script("T3", "--stato", "passato", "--verifica", "009", "--pr", "15")
        self.assertEqual(res.returncode, 0, res.stderr)
        goal = self.goal()
        self.assertEqual(goal["stato"], "passato")
        self.assertEqual(goal["giri"], ["004", "009"])
        self.assertEqual(goal["pr"], [12, 15])
        self.assertTrue(goal["passato_il"])

    def set_integrations(self, names):
        with open(self.goals, encoding="utf-8") as f:
            data = json.load(f)
        data["traguardi"][0]["integrazioni"] = names
        with open(self.goals, "w", encoding="utf-8") as f:
            json.dump(data, f)

    def write_round(self, giro, text):
        path = os.path.join(os.path.dirname(self.report_path), f"{giro}-rapporto.md")
        with open(path, "w", encoding="utf-8", newline="") as f:
            f.write(text)

    def test_verification_must_follow_the_last_runbook(self):
        self.set_integrations(["FCM"])
        self.write_report(report())
        self.write_round("012", "---\r\ngiro: 012\r\ntraguardo: T3\r\ntipo: runbook\r\nesito: mergiata\r\n---\r\n")
        self.assertIn("runbook", self.assert_rejected("--verifica", "009"))
        self.write_round("012", "---\ngiro: 012\ntraguardo: T3\ntipo: runbook\n---\n")
        self.write_round("013", report().replace("009", "013"))
        res = self.run_script("T3", "--stato", "passato", "--verifica", "013")
        self.assertEqual(res.returncode, 0, res.stderr)

    def test_runbook_order_ignored_without_integrations(self):
        self.write_report(report())
        self.write_round("012", "---\ngiro: 012\ntraguardo: T3\ntipo: runbook\n---\n")
        self.assertEqual(self.run_script("T3", "--stato", "passato", "--verifica", "009").returncode, 0)

    def test_round_000_does_not_pass_t2(self):
        """Round 000 builds T1 and T2 (traguardi_extra), but T2 passes only with its own verification."""
        text = "---\ngiro: 000\ntraguardo: T1\ntraguardi_extra: [T2]\ntipo: verifica-produzione\nesito: passato\n---\n"
        self.write_round("000", text)
        self.assertIn("traguardo: T1 invece di T3", self.assert_rejected("--verifica", "000"))

    def test_other_states_need_no_verification(self):
        res = self.run_script("T3", "--stato", "in-corso", "--giro", "005")
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertEqual(self.goal()["giri"], ["004", "005"])


if __name__ == "__main__":
    unittest.main()
