"""Tests of scripts/guard/pr_guard.py: when a round's PR merges by itself (docs/METODO.md §4)."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(HERE, "..")))

import pr_guard  # noqa: E402

GOALS = {
    "versione": 1,
    "traguardi": [
        {"id": "T1", "titolo": "Deploy", "fatto_quando": "x", "stato": "da-fare", "giri": [], "pr": [], "passato_il": None},
        {"id": "T2", "titolo": "E2E", "fatto_quando": "y", "stato": "da-fare", "giri": [], "pr": [], "passato_il": None},
    ],
}
ACCEPTANCE = "server/src/test/java/com/planforhome/acceptance/Giro003CatalogAcceptanceTest.java"
MIGRATIONS = "server/src/main/resources/db/migration/"
EXPECTED = {
    "orchestratore": "claude-sonnet-5-5",
    "pianificatore": "claude-opus-5-5",
    "critico": "claude-opus-5-5",
    "ricercatore": "claude-sonnet-5-5",
    "costruttore-tdd": "claude-sonnet-5-5",
    "revisore": "claude-opus-5-5",
}
PROJECT = (
    "versione: 1\n\nlimite_righe:\n  aggiunte_massime: 1500\n\nmodelli_attesi:\n"
    "  # DELTA-V4 V1\n" + "".join(f"  {k}: {v}\n" for k, v in EXPECTED.items()) + "\naltro:\n  revisore: x\n"
)


def agent(agent_type, *models, fonte="transcript"):
    return {
        "agent_type": agent_type, "agent_id": f"agent-{agent_type}", "modelli": list(models),
        "token": {"input": 1, "output": 1, "cache_lettura": 0, "cache_scrittura": 0}, "fonte": fonte,
        "motivo": "" if fonte == "transcript" else "transcript illeggibile",
    }


class PrGuardTest(unittest.TestCase):
    def setUp(self):
        self.repo = tempfile.mkdtemp(prefix="pr-guard-test-")
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "test@example.com")
        self.git("config", "user.name", "test")
        self.write(MIGRATIONS + "V1__init.sql", "create table t (id bigint);\n")
        self.write(MIGRATIONS + "V2__more.sql", "create table u (id bigint);\n")
        self.write("server/src/test/java/com/planforhome/acceptance/Giro001DeployAcceptanceTest.java", "class A {}\n")
        self.write("docs/lab/traguardi.json", json.dumps(GOALS, indent=2))
        self.write("server/src/main/java/App.java", "class App {}\n")
        self.write("server/src/main/resources/application.properties", "server.port=8080\n")
        self.write("server/src/main/resources/application.yml", "spring:\n  application:\n    name: planforhome\n")
        self.write("progetto.yml", PROJECT)
        self.git("add", ".")
        self.git("commit", "-q", "-m", "init")
        self.git("switch", "-q", "-c", "claude/giro-003-t3")
        self.commit("docs: giro 003 — piano e agenti", self.round_files())

    def round_files(self, kind="costruzione", agents=None, round_no="003"):
        """The plan and the agents' register that every round's PR carries."""
        if agents is None:
            agents = [agent(t, m) for t, m in EXPECTED.items() if t != "ricercatore"]
        return {
            f"docs/lab/giri/{round_no}-piano.md": f"---\ngiro: {round_no}\ntipo: {kind}\ntraguardo: T1\n---\n# Piano\n",
            f"docs/lab/giri/{round_no}-agenti.json": json.dumps({"giro": round_no, "agenti": agents}, indent=2),
        }

    def tearDown(self):
        shutil.rmtree(self.repo, ignore_errors=True)

    # ------------------------------------------------------------------ helpers

    def git(self, *args):
        return subprocess.run(["git", "-C", self.repo, *args], check=True, capture_output=True, text=True).stdout

    def head(self):
        return self.git("rev-parse", "HEAD").strip()

    def write(self, path, content):
        full = os.path.join(self.repo, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as f:
            f.write(content)

    def commit(self, message, files):
        for path, content in files.items():
            if content is None:
                os.remove(os.path.join(self.repo, path))
            else:
                self.write(path, content)
        self.git("add", "-A")
        self.git("commit", "-q", "-m", message)

    def record(self, verdict, round_no="003"):
        """What the SubagentStop hook does after a review: a reviewer's entry with its VERDETTO."""
        rel = f"docs/lab/giri/{round_no}-agenti.json"
        path = os.path.join(self.repo, rel)
        if not os.path.exists(path):
            return
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        entry = agent("revisore", EXPECTED["revisore"])
        entry["agent_id"] = f"agent-revisore-{len(data['agenti'])}"
        entry["verdetto"] = verdict
        data["agenti"].append(entry)
        self.commit("docs: agenti — revisore", {rel: json.dumps(data, indent=2)})

    def meta(self, sha=None, verdict=None, record=True, **overrides):
        """The PR's metadata; with `record`, the same verdict is first written in the register, as
        the hook does when the reviewer stops."""
        verdict = verdict if verdict is not None else {"bloccanti": 0, "dubbi": 2, "sha": sha or self.head()}
        if record and isinstance(verdict, dict) and verdict.get("sha"):
            self.record(verdict)
        data = {
            "headRefName": "claude/giro-003-t3",
            "labels": [{"name": "giro"}],
            "isDraft": False,
            "body": "Per te…\n<!-- verdetto-revisore: " + json.dumps(verdict) + " -->",
        }
        data.update(overrides)
        return data

    def evaluate(self, meta=None):
        return pr_guard.evaluate(self.repo, "main", "HEAD", meta if meta is not None else self.meta())

    def assertAuto(self, meta=None):
        result = self.evaluate(meta)
        self.assertTrue(result["auto_merge"], result["motivi"])
        return result

    def assertHuman(self, fragment, meta=None):
        result = self.evaluate(meta)
        self.assertFalse(result["auto_merge"])
        self.assertTrue(any(fragment in r for r in result["motivi"]), result["motivi"])
        return result

    def add_acceptance(self):
        self.commit("test(acceptance): giro 003 — catalogo (rosso)", {ACCEPTANCE: "class Giro003 { /* red */ }\n"})

    # ------------------------------------------------------------------ happy path

    def test_an_ordinary_round_merges_by_itself(self):
        self.add_acceptance()
        self.commit(
            "feat: catalog",
            {
                "server/src/main/java/Catalog.java": "class Catalog {}\n" * 20,
                MIGRATIONS + "V3__catalog.sql": (
                    "-- products of a shop; we never drop table t here\n"
                    "create table product (id bigint, tenant_id text);\n"
                    "create index product_tenant on product (tenant_id);\n"
                    "alter table product add column name text;\n"
                    "insert into product (id, tenant_id, name) values (1, 'demo', 'Rose; rosse');\n"
                    "comment on table product is 'catalogo';\n"
                ),
                "app/components/Catalog.tsx": "export const x = 1;\n" * 3,
                "app/components/Catalog.test.tsx": "test('x', () => {});\n" * 5,
                "app/assets/logo.png": "\x89PNG\x00\x01",
            },
        )
        reviewed = self.head()
        goals = json.loads(json.dumps(GOALS))
        goals["traguardi"][0].update(stato="passato", giri=["003"], pr=[12], passato_il="2026-10-11T10:00:00Z")
        self.commit(
            "docs: giro 003",
            {"docs/lab/traguardi.json": json.dumps(goals, indent=2), "docs/lab/giri/003-rapporto.md": "# rapporto\n"},
        )
        result = self.assertAuto(self.meta(sha=reviewed))
        self.assertEqual(result["metriche"]["migrazioni_nuove"], 1)
        self.assertEqual(result["metriche"]["righe_main_aggiunte"], 29)  # 20 + 6 + 3: not the test, not the png

    # ------------------------------------------------------------------ protected paths

    def test_rules_and_infrastructure_need_a_human(self):
        for path in [
            ".github/workflows/ci.yml",
            ".github/workflows/déploy.yml",
            ".claude/settings.json",
            "scripts/guard/pr_guärd.py",
            "scripts/metrics/raccogli.py",
            "infra/deploy.sh",
            "infra/déploy.sh",
            "server/pom.xml",
            "server/mvnw",
            "server/.mvn/wrapper/maven-wrapper.properties",
            "server/Dockerfile",
            "server/src/main/resources/application-prod.properties",
            "app/package.json",
            "app/package-lock.json",
            "app/app.json",
            "app/jest.config.js",
            "app/playwright.config.ts",
            "app/.prettierrc.json",
            "scripts/lab/traguardo.py",
            ".specify/memory/constitution.md",
            "docs/adr/0002-x.md",
            "progetto.yml",
            "CLAUDE.md",
            "docs/SPEC.md",
            "docs/METODO.md",
            "docs/ESPERIMENTO.md",
            "docs/lab/SETUP.md",
            "docs/lab/CONCLUSIONI.md",
            "docs/lab/giri/_modello-rapporto.md",
            "docs/lab/giri/_modello-rapporto-verifica.md",
            "docs/lab/giri/_modello-runbook.md",
            "docs/lab/giri/002-agenti.json",
            "server/src/test/resources/application-test.yml",
            "server/src/test/resources/db/seed.sql",
            "app/__mocks__/expo-notifications.ts",
            "app/babel.config.js",
            "app/metro.config.js",
            "app/prettier.config.mjs",
            "app/.npmrc",
            "app/plugins/withSigning.js",
            "server/src/main/resources/application.yml",
            "server/src/main/resources/application-prod.yaml",
            "server/src/main/resources/config/application.yml",
            "docs/CLAUDE.md",
            "app/CLAUDE.local.md",
            "AGENTS.md",
            "app/AGENTS.md",
            ".mcp.json",
            "app/.mcp.json",
            "app/.claude/settings.json",
            "server/.claude/agents/x.md",
        ]:
            with self.subTest(path=path):
                self.setUp()
                self.commit("chore: x", {path: "x\n"})
                self.assertHuman("percorso protetto")
                self.tearDown()

    def test_stop_file_stops_the_chain(self):
        self.commit("docs: stop", {"docs/lab/STOP": "fermo\n"})
        self.assertHuman("interruttore")

    def test_special_characters_still_count_lines(self):
        self.commit("feat: big", {"server/src/main/java/Café.java": "int x;\n" * 1501})
        self.assertHuman("fetta troppo grande")

    # ------------------------------------------------------------------ migrations

    def test_migrations_only_grow(self):
        self.commit("fix: x", {MIGRATIONS + "V1__init.sql": "create table t (id int);\n"})
        self.assertHuman("solo aggiunte")

    def test_migration_sequence_follows_current_main(self):
        self.commit("feat: x", {MIGRATIONS + "V5__jump.sql": "create table x (id bigint);\n"})
        self.assertHuman("attesa la versione V3")

    def test_main_moved_on_meanwhile(self):
        self.commit("feat: x", {MIGRATIONS + "V3__mine.sql": "create table mine (id bigint);\n"})
        self.git("switch", "-q", "main")
        self.commit("feat: other", {MIGRATIONS + "V3__theirs.sql": "create table theirs (id bigint);\n"})
        self.git("switch", "-q", "claude/giro-003-t3")
        self.assertHuman("attesa la versione V4")

    def test_bad_migration_names(self):
        for name in ["V3_bad-name.sql", "V3__città.sql"]:
            with self.subTest(name=name):
                self.setUp()
                self.commit("feat: x", {MIGRATIONS + name: "create table x (id bigint);\n"})
                self.assertHuman("il nome deve essere")
                self.tearDown()

    def test_unsafe_statements_need_a_human(self):
        for body in [
            "alter table t drop column id;",
            "alter table t rename name to label;",
            "alter table t alter column id type varchar(2);",
            "select '--'; drop table t;",
            "drop/**/table t;",
            "drop materialized view v;",
            "update t set id = null;",
            "delete from t;",
            "truncate t;",
            "create extension pgcrypto;",
        ]:
            with self.subTest(body=body):
                self.setUp()
                self.commit("feat: x", {MIGRATIONS + "V3__change.sql": body + "\n"})
                self.assertHuman("istruzione non tra quelle sempre sicure")
                self.tearDown()

    def test_migrations_elsewhere(self):
        self.commit("feat: x", {"server/src/main/java/db/migration/V3__Wipe.java": "class V3__Wipe {}\n"})
        self.assertHuman("migrazione fuori da")

    def test_dangerous_configuration(self):
        for line in [
            "spring.jpa.hibernate.ddl-auto=update",
            "spring.jpa.hibernate.ddlAuto=create-drop",
            "spring.jpa.properties[hibernate.hbm2ddl.auto]=create",
            "spring.flyway.clean-disabled=false",
            "spring.flyway.baseline-on-migrate=true",
            "spring.flyway.out-of-order=true",
            "spring.flyway.validate-on-migrate=false",
            "spring.sql.init.mode=always",
        ]:
            with self.subTest(line=line):
                self.setUp()
                self.commit("feat: x", {"server/src/main/resources/application-dev.properties": "server.port=8080\n" + line + "\n"})
                self.assertHuman("chiave che può cancellare")
                self.tearDown()

    def test_dangerous_configuration_in_yaml(self):
        for path, text in [
            ("application.yml", "spring:\n  application:\n    name: planforhome\n  jpa:\n    hibernate:\n      ddl-auto: update\n"),
            ("application-prod.yaml", "spring:\n  flyway:\n    clean-disabled: false\n"),
            ("application.yml", "spring:\n  flyway:\n    out-of-order: true\n"),
            ("config/application.yml", "spring.flyway:\n  validate-on-migrate: \"false\"\n"),
            ("application.yml", "spring:\n  sql:\n    init:\n      mode: always\n---\nspring:\n  jpa:\n    hibernate:\n      ddl-auto: validate\n"),
        ]:
            with self.subTest(path=path, text=text[-30:]):
                self.setUp()
                self.commit("feat: x", {"server/src/main/resources/" + path: text})
                self.assertHuman("chiave che può cancellare")
                self.tearDown()

    def test_safe_or_unreadable_yaml(self):
        self.commit("feat: x", {"server/src/main/resources/application.yml": (
            "spring:\n  application:\n    name: planforhome\n  jpa:\n    hibernate:\n      ddl-auto: none\n"
            "  flyway:\n    clean-disabled: true  # default\n"
        )})
        # A protected path (a human looks), but no key that touches the schema.
        self.assertEqual(self.evaluate()["motivi"], ["percorso protetto: server/src/main/resources/application.yml"])
        self.commit("feat: y", {"server/src/main/resources/application.yml": "spring: {jpa: {hibernate: {ddl-auto: update}}}\n"})
        self.assertHuman("YAML non controllabile")

    # ------------------------------------------------------------------ acceptance tests

    def test_existing_acceptance_tests_are_frozen(self):
        self.commit(
            "fix: x",
            {"server/src/test/java/com/planforhome/acceptance/Giro001DeployAcceptanceTest.java": "class A { /* weaker */ }\n"},
        )
        self.assertHuman("già su main")

    def test_new_acceptance_tests_cannot_change_after_creation(self):
        self.add_acceptance()
        self.commit("feat: make it pass", {ACCEPTANCE: "class Giro003 { /* green, weakened */ }\n"})
        self.assertHuman("cambiato dopo il commit test(acceptance)")

    def test_weakening_under_an_acceptance_title_is_still_caught(self):
        self.add_acceptance()
        self.commit("test(acceptance): tidy", {ACCEPTANCE: "class Giro003 { }\n"})
        self.assertHuman("cambiato dopo il commit test(acceptance)")

    def test_new_acceptance_test_removed_or_moved(self):
        self.add_acceptance()
        self.commit("chore: drop it", {ACCEPTANCE: None})
        self.assertHuman("tolto o spostato")
        self.tearDown()
        self.setUp()
        self.add_acceptance()
        self.git("mv", ACCEPTANCE, "server/src/test/java/com/planforhome/Other.java")
        self.git("commit", "-q", "-m", "refactor: move")
        self.assertHuman("tolto o spostato")

    def test_acceptance_test_born_in_a_feature_commit(self):
        self.commit("feat: x", {ACCEPTANCE: "class Giro003 {}\n"})
        self.assertHuman("nato in un commit che non è test(acceptance)")

    def test_acceptance_tests_outside_the_folder(self):
        self.commit("test(acceptance): x", {"server/src/test/java/com/planforhome/CartAcceptanceTest.java": "class C {}\n"})
        self.commit("feat: x", {"server/src/test/java/com/planforhome/CartAcceptanceTest.java": "class C { }\n"})
        self.assertHuman("cambiato dopo il commit test(acceptance)")

    # ------------------------------------------------------------------ goals file

    def goals_commit(self, mutate):
        goals = json.loads(json.dumps(GOALS))
        mutate(goals)
        self.commit("docs: x", {"docs/lab/traguardi.json": json.dumps(goals)})

    def test_goals_only_change_in_state_fields(self):
        self.goals_commit(lambda g: g["traguardi"][1].update(fatto_quando="anything goes"))
        self.assertHuman("T2 cambiato oltre lo stato")

    def test_goals_cannot_be_removed(self):
        self.goals_commit(lambda g: g["traguardi"].pop())
        self.assertHuman("aggiunti, tolti o riordinati")

    def test_unknown_goal_state(self):
        self.goals_commit(lambda g: g["traguardi"][0].update(stato="quasi"))
        self.assertHuman("stato sconosciuto")

    def test_one_goal_per_round(self):
        self.goals_commit(lambda g: [t.update(stato="passato") for t in g["traguardi"]])
        self.assertHuman("un traguardo solo")

    def test_recording_the_round_in_another_goal_is_not_a_state_change(self):
        # Round 001: T1 passes, T2 (traguardi_extra) only records the round in giri and pr.
        def mutate(goals):
            goals["traguardi"][0].update(stato="passato", giri=["001"], pr=[7], passato_il="2026-10-19T17:26:31Z")
            goals["traguardi"][1].update(giri=["001"], pr=[7])
        self.goals_commit(mutate)
        reasons = self.evaluate()["motivi"]
        self.assertFalse(any("traguardi.json" in r for r in reasons), reasons)

    def test_history_is_append_only(self):
        base = json.loads(json.dumps(GOALS))
        base["traguardi"][0]["giri"] = ["001"]
        self.git("switch", "-q", "main")
        self.commit("docs: base", {"docs/lab/traguardi.json": json.dumps(base)})
        self.git("switch", "-q", "-C", "claude/giro-003-t3")
        base["traguardi"][0]["giri"] = ["999"]
        self.commit("docs: rewrite", {"docs/lab/traguardi.json": json.dumps(base)})
        self.assertHuman("riscritto")

    # ------------------------------------------------------------------ size and secrets

    def test_slice_too_big(self):
        self.commit("feat: big", {"server/src/main/java/Big.java": "int x;\n" * 1501})
        self.assertHuman("fetta troppo grande")

    def test_secrets_in_the_diff(self):
        key = "sk_live_" + "a1B2c3D4e5F6g7H8i9J0k1L2"
        for content in [f'String k = "{key}";\n', f"++ {key}\n"]:
            with self.subTest(content=content[:8]):
                self.setUp()
                self.commit("feat: x", {"server/src/main/java/Pay.java": content})
                self.assertHuman("possibile segreto")
                self.tearDown()

    def test_short_fake_webhook_secret_in_tests_is_fine(self):
        self.commit("test: x", {"server/src/test/java/WebhookTest.java": 'String s = "whsec_test";\n'})
        self.assertAuto()

    # ------------------------------------------------------------------ PR metadata and verdict

    def test_pr_metadata(self):
        self.commit("feat: x", {"server/src/main/java/X.java": "class X {}\n"})
        cases = [
            (self.meta(headRefName="feature/x"), "le PR automatiche vengono solo da"),
            (self.meta(labels=[]), "manca l'etichetta 'giro'"),
            (self.meta(labels=[{"name": "giro"}, {"name": "domanda"}]), "etichetta 'domanda'"),
            (self.meta(isDraft=True), "in bozza"),
            (self.meta(body="niente verdetto"), "manca il verdetto"),
            (self.meta(verdict={"bloccanti": 1, "sha": self.head()}), "bloccanti: 1"),
            (self.meta(verdict={"bloccanti": False, "sha": self.head()}), "bloccanti: False"),
            (self.meta(verdict={"bloccanti": 0.0, "sha": self.head()}), "bloccanti: 0.0"),
            (self.meta(verdict={"bloccanti": 0}), "quale commit ha rivisto"),
            (self.meta(body="<!-- verdetto-revisore: {bloccanti: 0} -->"), "non è JSON valido"),
            (self.meta(sha="0123456789abcdef0123456789abcdef01234567"), "non è nella storia della PR"),
        ]
        for meta, fragment in cases:
            with self.subTest(fragment=fragment):
                self.assertHuman(fragment, meta)
        self.assertAuto()

    def test_code_after_the_review_needs_a_new_review(self):
        self.commit("feat: x", {"server/src/main/java/X.java": "class X {}\n"})
        reviewed = self.head()
        self.commit("fix: after review", {"server/src/main/java/X.java": "class X { int y; }\n"})
        self.assertHuman("codice cambiato dopo la revisione", self.meta(sha=reviewed))
        self.commit("docs: report", {"docs/lab/giri/003-rapporto.md": "ok\n"})
        self.assertHuman("codice cambiato dopo la revisione", self.meta(sha=reviewed))

    def test_ci_extension_points_need_a_human(self):
        self.commit("ci: skip tests", {"scripts/ci/prepare.sh": "echo MAVEN_ARGS=-DskipTests >> $GITHUB_ENV\n"})
        self.assertHuman("percorso protetto: scripts/ci/prepare.sh")

    def test_git_attributes_cannot_hide_lines(self):
        self.commit("chore: attributes", {"server/src/.gitattributes": "*.java -diff\n"})
        self.assertHuman("percorso protetto: server/src/.gitattributes")
        # Even if such a file were already on main, the lines are still counted and read.
        self.git("switch", "-q", "main")
        self.commit("chore: attributes", {".gitattributes": "*.java -diff\n*.properties -diff\n"})
        self.git("switch", "-q", "claude/giro-003-t3")
        self.git("merge", "-q", "--no-edit", "main")
        big = "class Big {\n" + "  int x;\n" * 1600 + "}\n"
        self.commit("feat: big", {
            "server/src/main/java/Big.java": big,
            "server/src/main/resources/application.properties": "spring.flyway.clean-disabled=false\n",
        })
        result = self.evaluate()
        self.assertFalse(result["auto_merge"])
        self.assertTrue(any("fetta troppo grande" in r for r in result["motivi"]), result["motivi"])
        self.assertTrue(any("schema" in r for r in result["motivi"]), result["motivi"])

    def test_symbolic_links_need_a_human(self):
        os.symlink("../../../../docs/METODO.md", os.path.join(self.repo, "server/src/main/java/link.txt"))
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "chore: link")
        self.assertHuman("collegamento simbolico: server/src/main/java/link.txt")

    def test_keys_and_service_accounts_stay_out(self):
        for path, content in [
            ("app/android/app/release.keystore", "\x00binary"),
            ("app/upload.jks", "\x00binary"),
            ("app/credentials/play.json", '{\n  "type": "service_account",\n  "project_id": "x"\n}\n'),
        ]:
            with self.subTest(path=path):
                self.setUp()
                self.commit("chore: x", {path: content})
                self.assertHuman("file di chiavi" if not path.endswith(".json") else "possibile segreto")
                self.tearDown()

    # ------------------------------------------------------------------ DELTA-V4: models, kind of round, conclusions

    def agents_commit(self, agents, kind="costruzione"):
        self.commit("docs: agenti", self.round_files(kind=kind, agents=agents))

    def test_expected_models_from_project_file(self):
        self.assertEqual(pr_guard.expected_models(PROJECT), EXPECTED)
        self.assertEqual(pr_guard.expected_models("versione: 1\n"), {})

    def test_model_prefix_is_accepted(self):
        agents = [agent(t, m) for t, m in EXPECTED.items()]
        agents[1] = agent("pianificatore", "claude-opus-5-5[1m]")
        agents.append(agent("", "claude-haiku-5"))  # internal agent: ignored, stays in the file
        self.agents_commit(agents)
        self.assertAuto()

    def test_unexpected_model_needs_a_human(self):
        agents = [agent(t, m) for t, m in EXPECTED.items()]
        agents[5] = agent("revisore", "claude-sonnet-5-5")
        self.agents_commit(agents)
        self.assertHuman("modello-inatteso: revisore su claude-sonnet-5-5, atteso claude-opus-5-5")
        agents[5] = agent("revisore", "claude-opus-5-50")
        self.agents_commit(agents)
        self.assertHuman("modello-inatteso: revisore")

    def test_missing_register_needs_a_human(self):
        self.commit("docs: x", {"docs/lab/giri/003-agenti.json": None})
        self.assertHuman("modello-inatteso: manca docs/lab/giri/003-agenti.json")

    def test_model_without_transcript_needs_a_human(self):
        agents = [agent(t, m) for t, m in EXPECTED.items()]
        agents[4] = agent("costruttore-tdd", fonte="assente")
        self.agents_commit(agents)
        self.assertHuman("modello-inatteso: costruttore-tdd senza modello dal transcript")

    def test_build_round_needs_every_agent(self):
        agents = [agent(t, m) for t, m in EXPECTED.items() if t != "critico"]
        self.agents_commit(agents)
        self.assertHuman("mancano critico")
        self.agents_commit(agents, kind="runbook")  # only a build round needs all five
        self.assertAuto()

    def test_another_rounds_register_is_protected(self):
        self.commit("docs: x", self.round_files(round_no="002"))
        self.assertHuman("percorso protetto: docs/lab/giri/002-agenti.json")

    def test_kind_of_round_is_required(self):
        for text in ["# Piano senza frontmatter\n", "---\ngiro: 003\n---\n", "---\ntipo: refactoring\n---\n"]:
            with self.subTest(text=text):
                self.commit("docs: piano", {"docs/lab/giri/003-piano.md": text})
                self.assertHuman("tipo di giro mancante o sconosciuto")
        self.commit("docs: piano", {"docs/lab/giri/003-piano.md": None})
        self.assertHuman("tipo di giro mancante o sconosciuto")

    def test_production_check_adds_no_code(self):
        for kind in ("verifica-produzione", "caccia"):
            with self.subTest(kind=kind):
                self.setUp()
                self.agents_commit([agent(t, m) for t, m in EXPECTED.items()], kind=kind)
                self.commit("docs: rapporto", {"docs/lab/giri/003-rapporto.md": "# ok\n"})
                self.assertAuto()
                self.commit("fix: x", {"app/src/screens/Home.tsx": "export const x = 1;\n"})
                self.assertHuman(f"giro {kind}: 1 righe aggiunte nel codice")
                self.tearDown()

    def test_runbook_changes_only_docs(self):
        self.agents_commit([agent(t, m) for t, m in EXPECTED.items()], kind="runbook")
        self.commit("docs: runbook", {"docs/runbook/brevo.md": "# Brevo\n", "metrics/tempo-umano.csv": "data\n"})
        self.assertAuto()
        self.commit("feat: x", {"server/src/main/java/Mail.java": "class Mail {}\n"})
        self.assertHuman("giro runbook: cambia solo")

    def test_not_a_round_branch(self):
        self.commit("feat: x", {"server/src/main/java/X.java": "class X {}\n"})
        self.assertHuman("giro non ricavabile dal branch", self.meta(headRefName="feature/x"))

    def test_conclusions_belong_to_the_human(self):
        self.commit("docs: conclusioni", {"docs/lab/CONCLUSIONI.md": "H1 confermata\n"})
        result = self.assertHuman("percorso protetto: docs/lab/CONCLUSIONI.md")
        self.assertIn("docs/lab/CONCLUSIONI.md", pr_guard.markdown(result))

    def test_recorded_proofs_belong_to_the_human(self):
        # ESPERIMENTO P5 and P6: the recorded proofs and the phase-0 records are the human's, never a round's.
        for path in ("docs/lab/prove/v1.md", "docs/lab/revisione-fase0.md", "docs/lab/fase0-decisioni.md"):
            with self.subTest(path=path):
                self.setUp()
                self.commit("docs: esito", {path: "---\nesito: passato\n---\n"})
                self.assertHuman(f"percorso protetto: {path}")
                self.tearDown()

    def test_the_last_verdict_counts(self):
        self.commit("feat: x", {"server/src/main/java/X.java": "class X {}\n"})
        old = self.head()
        self.commit("fix: y", {"server/src/main/java/X.java": "class X { int y; }\n"})
        meta = self.meta(sha=old)
        last = {"bloccanti": 0, "sha": self.head()}
        self.record(last)
        meta["body"] += "\n<!-- verdetto-revisore: " + json.dumps(last) + " -->"
        self.assertAuto(meta)

    def test_a_broken_check_sends_the_pr_to_a_human(self):
        broken = json.loads(json.dumps(GOALS))
        broken["traguardi"][0]["giri"] = None
        broken["traguardi"][0]["stato"] = "in-corso"
        self.commit("docs: goals", {"docs/lab/traguardi.json": json.dumps(broken, indent=2)})
        self.assertHuman("non riuscito")

    # ------------------------------------------------------------------ security fixes (docs/lab/_fix-sicurezza.md)

    def test_dollar_quoting_and_escape_strings(self):
        for body, fragment in [
            ("create table t (id int, note text default $$a; drop table u$$);", "dollar quoting"),
            ("create table t (id int, note text default $x$a; drop table u$x$);", "dollar quoting"),
            ("insert into t values (E'it\\'s; drop table u');", "stringhe E'"),
            ("insert into t values (e'x');", "stringhe E'"),
        ]:
            with self.subTest(body=body):
                self.setUp()
                self.commit("feat: x", {MIGRATIONS + "V3__change.sql": body + "\n"})
                self.assertHuman(fragment)
                self.tearDown()
        self.setUp()
        self.commit("feat: x", {MIGRATIONS + "V3__ok.sql": "insert into t (id) values (1);\ncomment on table t is 'nome';\n"})
        self.assertAuto()

    def test_lines_count_in_every_folder_of_the_stacks(self):
        self.commit("feat: big", {"app/components/Big.tsx": "x;\n" * 1501})
        self.assertHuman("fetta troppo grande")

    def test_tests_and_docs_do_not_count(self):
        many = "x;\n" * 1600
        self.commit("test: many", {
            "server/src/test/java/BigTest.java": many,
            "app/src/Big.test.tsx": many,
            "app/src/__tests__/big.ts": many,
            "app/e2e/big.spec.ts": many,
            "app/components/Big.spec.tsx": many,
            "server/README.md": many,
            "app/docs/guida.txt": many,
        })
        self.assertEqual(self.assertAuto()["metriche"]["righe_main_aggiunte"], 0)

    def test_production_check_counts_every_folder_of_the_stacks(self):
        self.agents_commit([agent(t, m) for t, m in EXPECTED.items()], kind="caccia")
        self.commit("fix: x", {"app/components/X.tsx": "export const x = 1;\n"})
        self.assertHuman("giro caccia: 1 righe aggiunte nel codice")

    def test_binary_files(self):
        self.commit("feat: assets", {"app/assets/icon.png": "\x00PNG", "app/assets/fonts/a.ttf": "\x00ttf"})
        self.assertAuto()
        for path in ("server/src/main/resources/data.bin", "app/src/lib.so", "app/assets/tool.wasm"):
            with self.subTest(path=path):
                self.commit("feat: blob", {path: "\x00\x01"})
                self.assertHuman(f"file binario {path}")
                self.commit("chore: drop", {path: None})

    def test_secrets_are_read_in_binary_files_too(self):
        key = "sk_live_" + "a1B2c3D4e5F6g7H8i9J0k1L2"
        self.commit("feat: logo", {"app/assets/logo.png": "\x00PNG\n" + key + "\n"})
        self.assertHuman("possibile segreto in app/assets/logo.png")

    def test_recorded_verdict_must_match_the_body(self):
        self.commit("feat: x", {"server/src/main/java/X.java": "class X {}\n"})
        reviewed = self.head()
        self.record({"bloccanti": 1, "sha": reviewed})
        self.assertHuman("non è quello registrato dal revisore", self.meta(sha=reviewed, record=False))
        self.record({"bloccanti": 0, "sha": "f" * 40})
        self.assertHuman("non è quello registrato dal revisore", self.meta(sha=reviewed, record=False))
        self.record({"bloccanti": 0, "sha": reviewed})
        self.assertAuto(self.meta(sha=reviewed, record=False))

    def test_verdict_without_a_recorded_one(self):
        self.commit("feat: x", {"server/src/main/java/X.java": "class X {}\n"})
        self.assertHuman("manca il VERDETTO del revisore", self.meta(record=False))

    def test_kind_is_read_at_the_reviewed_commit(self):
        self.agents_commit([agent(t, m) for t, m in EXPECTED.items() if t != "critico"])
        reviewed = self.head()
        self.commit("docs: piano", {"docs/lab/giri/003-piano.md": "---\ngiro: 003\ntipo: runbook\n---\n"})
        self.assertHuman("mancano critico", self.meta(sha=reviewed))

    def test_register_only_grows_after_the_review(self):
        reviewed = self.head()
        agents = [agent(t, m) for t, m in EXPECTED.items() if t != "ricercatore"]
        orchestrator = agents.pop(0)
        orchestrator["token"]["input"] = 99  # agenti.py chiudi may rewrite the orchestrator's entry
        self.agents_commit(agents + [orchestrator])
        self.assertAuto(self.meta(sha=reviewed))
        self.agents_commit([a for a in agents if a["agent_type"] != "critico"] + [orchestrator])
        self.assertHuman("riscritto dopo la revisione", self.meta(sha=reviewed))

    def test_register_entries_are_checked(self):
        full = [agent(t, m) for t, m in EXPECTED.items() if t != "ricercatore"]
        internal = agent("", "claude-sonnet-5-5")
        cases = [
            ([], "costruzione", "non ha agenti"),
            (full + [agent("hacker", "claude-opus-5-5")], "costruzione", "agent_type sconosciuto"),
            (full + [agent("critico", "claude-opus-5-5")], "costruzione", "agent_id ripetuto"),
            ([dict(internal, agent_id="i-1")], "runbook", "mancano orchestratore"),
            ([agent("orchestratore", "claude-sonnet-5-5"), dict(internal, agent_id="i-2")], "verifica-produzione", "mancano revisore"),
            ([agent("orchestratore", "claude-sonnet-5-5"), agent("pianificatore", "claude-opus-5-5")], "caccia", "mancano revisore"),
        ]
        for agents, kind, fragment in cases:
            with self.subTest(fragment=fragment, kind=kind):
                self.agents_commit(agents, kind=kind)
                self.assertHuman(fragment, self.meta(record=False))
        self.agents_commit([agent("orchestratore", "claude-sonnet-5-5"), dict(internal, agent_id="i-3")], kind="runbook")
        self.assertAuto()

    def test_markdown_lists_the_reasons(self):
        self.commit("chore: x", {".github/workflows/x.yml": "x\n"})
        text = pr_guard.markdown(self.evaluate())
        self.assertIn("Revisione umana", text)
        self.assertIn(".github/workflows/x.yml", text)


if __name__ == "__main__":
    unittest.main()
