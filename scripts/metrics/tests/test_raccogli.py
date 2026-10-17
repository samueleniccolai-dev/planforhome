"""Tests of raccogli.py: minutes parser, merge form, agent register columns, API fields, LAB_AUTORE."""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(REPO, "scripts", "metrics"))
import raccogli  # noqa: E402

FORM = "⏱ 12' · ratifiche lette: 007 2/2, 008 1/1 · nota: 3 min di attesa"


class MinutesTest(unittest.TestCase):
    def test_accepted_forms(self):
        for body, minutes in [
            ("⏱ 7", 7), ("⏱ 7'", 7), ("⏱7’", 7), ("fatto, 9' in tutto", 9), ("revisione 4 min", 4),
            ("Tempo revision 10 minuti", 10), ("5 min e poi altri 3'", 8),
        ]:
            with self.subTest(body=body):
                self.assertEqual(raccogli.comment_minutes(body), minutes)

    def test_timer_wins_over_bare_forms(self):
        self.assertEqual(raccogli.comment_minutes(FORM), 12)

    def test_not_minutes(self):
        for body in ("T2' passato", "ratifiche lette: 007 2/2", "10 minutes", "dell'app", "", None):
            with self.subTest(body=body):
                self.assertEqual(raccogli.comment_minutes(body), 0)


class FormTest(unittest.TestCase):
    def test_form_needs_time_and_ratifiche(self):
        self.assertTrue(raccogli.has_form(FORM))
        self.assertTrue(raccogli.has_form("15 minuti, ratifiche lette: nessuna"))
        self.assertFalse(raccogli.has_form("⏱ 12'"))
        self.assertFalse(raccogli.has_form("ratifiche lette: 007 2/2"))

    def test_ratifiche_items(self):
        self.assertEqual(raccogli.ratifiche_read(FORM), ["007:2/2", "008:1/1"])
        self.assertEqual(raccogli.ratifiche_read("⏱ 3'"), [])


class AgentFieldsTest(unittest.TestCase):
    def test_models_and_tokens_from_register(self):
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, "docs", "lab", "giri"))
            data = {
                "giro": "007",
                "agenti": [
                    {"agent_type": "revisore", "modelli": ["claude-opus-5-5"], "fonte": "transcript"},
                    {"agent_type": "costruttore-tdd", "modelli": ["claude-sonnet-5-5", "claude-haiku-5"]},
                    {"agent_type": "orchestratore", "modelli": ["claude-sonnet-5-5"]},
                ],
                "totale_token": {"input": 1, "output": 2, "cache_lettura": 3, "cache_scrittura": 4},
                "token_fonte": "parziale",
            }
            with open(os.path.join(root, "docs", "lab", "giri", "007-agenti.json"), "w", encoding="utf-8") as f:
                json.dump(data, f)
            with mock.patch.object(raccogli, "ROOT", root):
                row = raccogli.agent_fields("007")
                missing = raccogli.agent_fields("008")
        self.assertEqual(row["modello_revisore"], "claude-opus-5-5")
        self.assertEqual(row["modello_costruttore"], "claude-haiku-5;claude-sonnet-5-5")
        self.assertEqual(row["modello_orchestratore"], "claude-sonnet-5-5")
        self.assertEqual((row["token_input"], row["token_cache_scrittura"], row["token_fonte"]), (1, 4, "parziale"))
        self.assertEqual((missing["token_fonte"], missing["token_input"]), ("assente", ""))


class FakeApi:
    def __init__(self, answers):
        self.answers = answers

    def get(self, path):
        for prefix, value in self.answers.items():
            if path.startswith(prefix):
                return value
        return []


def pr_answers(merged_by, comments, labels=(), events=(), commits=()):
    return {
        "pulls/5/files": [{"filename": "server/src/main/A.java", "additions": 10, "deletions": 1},
                          {"filename": "app/src/x.test.ts", "additions": 4, "deletions": 0}],
        "pulls/5/commits": list(commits),
        "pulls/5": {"created_at": "2026-10-20T10:00:00Z", "merged_at": "2026-10-20T12:00:00Z",
                    "merged_by": {"login": merged_by}, "labels": [{"name": n} for n in labels],
                    "commits": 2, "changed_files": 2, "state": "closed"},
        "issues/5/comments": comments,
        "issues/5/events": list(events),
        "actions/runs?": {"workflow_runs": []},
    }


class ApiFieldsTest(unittest.TestCase):
    PR = {"number": 5, "head": {"ref": "claude/giro-007-x", "sha": "abc"}}

    def fields(self, answers):
        with mock.patch.object(raccogli, "HUMAN", "umano"):
            return raccogli.api_fields(FakeApi(answers), self.PR, None)

    def test_manual_merge_with_form(self):
        comments = [{"user": {"login": "umano"}, "body": FORM},
                    {"user": {"login": "umano"}, "body": "🤖 rapporto: 99 minuti"}]
        fields, minutes, state = self.fields(pr_answers("umano", comments))
        self.assertEqual((minutes, state), (12, "mergiata"))
        self.assertEqual(fields["merge_automatico"], "no")
        self.assertEqual(fields["modulo_presente"], "sì")
        self.assertEqual(fields["ratifiche_lette"], "007:2/2;008:1/1")
        self.assertEqual((fields["righe_main_aggiunte"], fields["righe_test_aggiunte"]), (10, 4))

    def test_manual_merge_without_form(self):
        fields, minutes, _ = self.fields(pr_answers("umano", [{"user": {"login": "umano"}, "body": "⏱ 5'"}]))
        self.assertEqual((fields["modulo_presente"], minutes), ("no", 5))
        fields, _, _ = self.fields(pr_answers("umano", [{"user": {"login": "umano"}, "body": FORM}],
                                              labels=["modulo-mancante"]))
        self.assertEqual(fields["modulo_presente"], "no")

    def test_automatic_merge_questions_and_human_commits(self):
        events = [
            {"event": "labeled", "label": {"name": "domanda"}, "created_at": "2026-10-20T10:00:00Z"},
            {"event": "unlabeled", "label": {"name": "domanda"}, "created_at": "2026-10-20T11:30:00Z"},
        ]
        commits = [{"commit": {"author": {"email": "noreply@anthropic.com"}}, "committer": {"login": "x"}},
                   {"commit": {"author": {"email": "umano@example.com"}}, "committer": {"login": "umano"}}]
        fields, _, _ = self.fields(pr_answers("github-actions[bot]", [], events=events, commits=commits))
        self.assertEqual(fields["merge_automatico"], "sì")
        self.assertEqual(fields["modulo_presente"], "")
        self.assertEqual((fields["domande"], fields["ore_domanda"], fields["commit_umani"]), (1, 1.5, 1))


class AuthorTest(unittest.TestCase):
    def test_lab_autore_required(self):
        env = {k: v for k, v in os.environ.items() if k != "LAB_AUTORE"}
        res = subprocess.run([sys.executable, "-I", os.path.join(REPO, "scripts", "metrics", "raccogli.py")],
                             capture_output=True, text=True, env=env, timeout=60)
        self.assertEqual(res.returncode, 2)
        self.assertIn("LAB_AUTORE", res.stderr)


if __name__ == "__main__":
    unittest.main()
