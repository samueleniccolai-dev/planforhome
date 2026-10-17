"""Tests of the per-round agent register: transcript reader, lock, hooks and `agenti.py chiudi`."""
import json
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(REPO, "scripts", "metrics"))
import agenti  # noqa: E402

HOOK_AGENT = os.path.join(REPO, ".claude", "hooks", "registra-agente.py")
HOOK_SESSION = os.path.join(REPO, ".claude", "hooks", "registra-sessione.py")
AGENTI = os.path.join(REPO, "scripts", "metrics", "agenti.py")


def assistant(model="claude-opus-5-5", usage=None, msg_id="m1", **extra):
    message = {"role": "assistant", "id": msg_id}
    if model is not None:
        message["model"] = model
    if usage is not False:
        message["usage"] = usage or {"input_tokens": 10, "output_tokens": 5,
                                     "cache_read_input_tokens": 100, "cache_creation_input_tokens": 20}
    return json.dumps(dict({"type": "assistant", "message": message}, **extra))


def write(path, lines):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return path


def git(cwd, *args):
    subprocess.run(["git", "-C", cwd, *args], check=True, capture_output=True, text=True)


class TranscriptTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def read(self, lines, **kw):
        return agenti.read_transcript(write(os.path.join(self.dir, "t.jsonl"), lines), **kw)

    def test_models_and_usage_summed_once_per_message(self):
        models, tokens, fonte, motivo = self.read([
            json.dumps({"type": "user", "message": {"role": "user", "content": "ciao"}}),
            assistant(msg_id="a"), assistant(msg_id="a"),  # same message split in two lines
            assistant(model="claude-opus-5-5[1m]", msg_id="b"),
            "{not json",
        ])
        self.assertEqual(fonte, "transcript", motivo)
        self.assertEqual(models, ["claude-opus-5-5", "claude-opus-5-5[1m]"])
        self.assertEqual(tokens, {"input": 20, "output": 10, "cache_lettura": 200, "cache_scrittura": 40})

    def test_missing_cache_fields_count_as_zero(self):
        _, tokens, fonte, _ = self.read([assistant(usage={"input_tokens": 3, "output_tokens": 4})])
        self.assertEqual(fonte, "transcript")
        self.assertEqual(tokens["cache_lettura"], 0)

    def test_missing_usage_fails_closed(self):
        _, _, fonte, motivo = self.read([assistant(msg_id="a"), assistant(usage=False, msg_id="b")])
        self.assertEqual(fonte, "assente")
        self.assertIn("usage", motivo)

    def test_missing_model_fails_closed(self):
        models, _, fonte, motivo = self.read([assistant(model=None)])
        self.assertEqual((models, fonte), ([], "assente"))
        self.assertIn("model", motivo)

    def test_synthetic_messages_are_ignored(self):
        models, _, fonte, _ = self.read([assistant(msg_id="a"), assistant(model="<synthetic>", usage=False, msg_id="b")])
        self.assertEqual((models, fonte), (["claude-opus-5-5"], "transcript"))

    def test_no_assistant_or_no_file_fails_closed(self):
        self.assertEqual(self.read([json.dumps({"type": "user"})])[2], "assente")
        self.assertEqual(agenti.read_transcript(os.path.join(self.dir, "nope.jsonl"))[2], "assente")
        self.assertEqual(agenti.read_transcript(None)[2], "assente")

    def test_sidechain_lines_skipped_in_main_transcript(self):
        models, _, _, _ = self.read([assistant(msg_id="a"),
                                     assistant(model="claude-haiku-5", msg_id="b", isSidechain=True)],
                                    skip_sidechain=True)
        self.assertEqual(models, ["claude-opus-5-5"])

    def test_totals_and_token_fonte(self):
        ok = {"fonte": "transcript", "token": {"input": 1, "output": 2, "cache_lettura": 3, "cache_scrittura": 4}}
        bad = {"fonte": "assente", "token": agenti.zero_tokens()}
        self.assertEqual(agenti.totals([ok, ok]), ({"input": 2, "output": 4, "cache_lettura": 6, "cache_scrittura": 8},
                                                    "transcript"))
        self.assertEqual(agenti.totals([ok, bad])[1], "parziale")
        self.assertEqual(agenti.totals([])[1], "assente")


WORKER = """
import sys
sys.path.insert(0, sys.argv[1])
import agenti
for i in range(int(sys.argv[4])):
    agenti.add_entry(sys.argv[2], "007", {"agent_type": "critico", "agent_id": sys.argv[3] + "-" + str(i),
        "modelli": ["claude-opus-5-5"], "token": {"input": 1, "output": 1, "cache_lettura": 0, "cache_scrittura": 0},
        "fonte": "transcript", "motivo": ""})
"""


class ConcurrencyTest(unittest.TestCase):
    def test_concurrent_appends_lose_nothing(self):
        with tempfile.TemporaryDirectory() as root:
            script = os.path.join(root, "worker.py")
            write(script, [WORKER])
            procs = [subprocess.Popen([sys.executable, "-I", script, os.path.dirname(AGENTI), root, f"p{n}", "5"])
                     for n in range(6)]
            for p in procs:
                self.assertEqual(p.wait(timeout=120), 0)
            with open(agenti.register_path(root, "007"), encoding="utf-8") as f:
                data = json.load(f)
            self.assertEqual(len(data["agenti"]), 30)
            self.assertEqual(len({a["agent_id"] for a in data["agenti"]}), 30)
            self.assertEqual(data["totale_token"]["input"], 30)
            self.assertEqual(data["token_fonte"], "transcript")
            self.assertFalse(os.path.exists(agenti.register_path(root, "007") + ".lock"))


class HookTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = self.tmp.name
        git(self.repo, "init", "-q")
        git(self.repo, "checkout", "-q", "-b", "claude/giro-007-prova")
        self.transcript = write(os.path.join(self.repo, "t", "agent-x.jsonl"), [assistant()])

    def tearDown(self):
        self.tmp.cleanup()

    def hook(self, path, stdin, env=None):
        full_env = dict(os.environ)
        full_env.pop("CLAUDE_PROJECT_DIR", None)
        full_env.update(env or {})
        return subprocess.run([sys.executable, "-I", path], input=stdin, capture_output=True, text=True,
                              env=full_env, timeout=60)

    def register(self):
        with open(os.path.join(self.repo, "docs", "lab", "giri", "007-agenti.json"), encoding="utf-8") as f:
            return json.load(f)

    def test_subagent_entry_written(self):
        payload = {"agent_id": "agent-1", "agent_type": "revisore", "agent_transcript_path": self.transcript,
                   "cwd": self.repo, "session_id": "s"}
        res = self.hook(HOOK_AGENT, json.dumps(payload))
        self.assertEqual(res.returncode, 0, res.stderr)
        data = self.register()
        self.assertEqual(data["giro"], "007")
        self.assertEqual(data["agenti"][0]["agent_type"], "revisore")
        self.assertEqual(data["agenti"][0]["modelli"], ["claude-opus-5-5"])
        self.assertEqual(data["token_fonte"], "transcript")

    def test_missing_transcript_written_as_absent(self):
        payload = {"agent_id": "agent-2", "agent_type": "critico", "cwd": self.repo}
        self.assertEqual(self.hook(HOOK_AGENT, json.dumps(payload)).returncode, 0)
        entry = self.register()["agenti"][0]
        self.assertEqual(entry["fonte"], "assente")
        self.assertTrue(entry["motivo"])
        self.assertEqual(self.register()["token_fonte"], "parziale")

    def test_outside_round_branch_does_nothing(self):
        git(self.repo, "checkout", "-q", "-b", "main-like")
        payload = {"agent_type": "critico", "agent_transcript_path": self.transcript, "cwd": self.repo}
        self.assertEqual(self.hook(HOOK_AGENT, json.dumps(payload)).returncode, 0)
        self.assertFalse(os.path.exists(os.path.join(self.repo, "docs", "lab", "giri", "007-agenti.json")))

    def test_garbage_input_exits_zero(self):
        res = self.hook(HOOK_AGENT, "{garbage", env={"CLAUDE_PROJECT_DIR": self.repo})
        self.assertEqual(res.returncode, 0)

    def test_session_hook_and_close(self):
        main = write(os.path.join(self.repo, "t", "main.jsonl"),
                     [assistant(model="claude-sonnet-5-5", msg_id="o1"),
                      assistant(model="claude-opus-5-5", msg_id="s1", isSidechain=True)])
        payload = {"session_id": "sess-1", "transcript_path": main, "model": "claude-sonnet-5-5",
                   "source": "startup", "cwd": self.repo}
        res = self.hook(HOOK_SESSION, json.dumps(payload), env={"CLAUDE_PROJECT_DIR": self.repo})
        self.assertEqual(res.returncode, 0, res.stderr)
        with open(os.path.join(self.repo, ".claude", "state", "sessione.json"), encoding="utf-8") as f:
            self.assertEqual(json.load(f)["transcript_path"], main)
        for _ in range(2):  # closing twice in the same session keeps one orchestrator entry
            res = subprocess.run([sys.executable, "-I", AGENTI, "chiudi", "007", "--root", self.repo],
                                 capture_output=True, text=True, timeout=60)
            self.assertEqual(res.returncode, 0, res.stderr)
        data = self.register()
        self.assertEqual(len(data["agenti"]), 1)
        self.assertEqual(data["agenti"][0]["agent_type"], "orchestratore")
        self.assertEqual(data["agenti"][0]["modelli"], ["claude-sonnet-5-5"])
        self.assertEqual(data["token_fonte"], "transcript")

    def test_close_without_session_file_is_absent(self):
        res = subprocess.run([sys.executable, "-I", AGENTI, "chiudi", "007", "--root", self.repo],
                             capture_output=True, text=True, timeout=60)
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertEqual(self.register()["agenti"][0]["fonte"], "assente")
        self.assertEqual(self.register()["token_fonte"], "parziale")


if __name__ == "__main__":
    unittest.main()
