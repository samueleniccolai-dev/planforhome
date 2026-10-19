package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Round 000, T1: deploy and rollback on a fake server. The real infra/ scripts run with fake ssh,
 * scp and docker first in the PATH and the real flock. The fake ssh runs the remote command locally
 * with /opt/planforhome mapped to a temporary folder and a clean environment, like a login on the
 * server. The fake docker keeps the "running containers" in a state file and reports them through
 * {@code docker compose ps}, honouring --format and listing only running containers unless -a.
 *
 * <p>The environment of the scripts is the one of the "Deploy and smoke test" step of
 * .github/workflows/consegna.yml: rollback.sh is called without arguments with that same
 * environment. All secrets are fake.
 */
class Giro000RollbackAcceptanceTest {

  static final String SHA_A = "0123456789abcdef0123456789abcdef01234567";
  static final String SHA_B = "89abcdef0123456789abcdef0123456789abcdef";
  static final String OWNER = "ghcr.io/planforhome-demo/planforhome";
  static final String SERVER_A = OWNER + "/server@sha256:" + "a".repeat(64);
  static final String WEB_A = OWNER + "/web@sha256:" + "a".repeat(64);
  static final String SERVER_B = OWNER + "/server@sha256:" + "b".repeat(64);
  static final String WEB_B = OWNER + "/web@sha256:" + "b".repeat(64);

  static final String GHCR_TOKEN = "fake-ghcr-token-000";
  static final String DEMO_PASSWORD = "fake-demo-password-000";
  static final String SSH_KEY_SECRET = "fake-ssh-key-000";
  static final String SSH_KEY =
      "-----BEGIN OPENSSH PRIVATE KEY-----\n"
          + SSH_KEY_SECRET
          + "\n-----END OPENSSH PRIVATE KEY-----";
  static final String FCM_SECRET = "fake-fcm-key-000";
  static final String FCM_JSON =
      "{\"type\":\"service_account\",\"private_key\":\"" + FCM_SECRET + "\"}";
  static final String KNOWN_HOSTS = "203.0.113.10 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIfakehost000";
  static final String DEPLOY_HOST = "203.0.113.10";
  static final String DEPLOY_USER = "deploy";
  static final String DOMAIN = "app.planforhome.test";
  static final String GHCR_USER = "planforhome-demo";

  static final List<String> SECRETS =
      List.of(GHCR_TOKEN, DEMO_PASSWORD, SSH_KEY_SECRET, FCM_SECRET);

  static final Path INFRA = Path.of("..", "infra").toAbsolutePath().normalize();

  @TempDir Path tmp;
  Path bin;
  Path log;
  Path state;
  Path root;
  Path home;
  final List<Path> outputs = new ArrayList<>();
  final AtomicInteger runs = new AtomicInteger();

  record Result(int exit, String output) {}

  // ---------------------------------------------------------------- fakes

  static final String FAKE_SSH =
      """
      #!/usr/bin/env bash
      # Fake ssh: records its arguments, checks the pinned host key, runs the command locally with
      # /opt/planforhome mapped to the fake server folder and a clean environment.
      set -u
      { printf 'ssh'; printf ' [%s]' "$@"; printf '\\n'; } >>"$FAKE_LOG/ssh.args"
      strict=no known=
      while [ $# -gt 0 ]; do
        case $1 in
          -o)
            case $2 in
              StrictHostKeyChecking=yes) strict=yes ;;
              UserKnownHostsFile=*) known=${2#UserKnownHostsFile=} ;;
            esac
            shift 2 ;;
          -i | -p | -l | -F | -J) shift 2 ;;
          -*) shift ;;
          *) break ;;
        esac
      done
      [ "$strict" = yes ] || { echo "fake ssh: StrictHostKeyChecking=yes missing" >&2; exit 255; }
      [ -n "$known" ] && [ "$(cat "$known" 2>/dev/null)" = "$FAKE_KNOWN_HOSTS" ] \
        || { echo "fake ssh: host key not pinned" >&2; exit 255; }
      [ $# -ge 2 ] || { echo "fake ssh: no destination or no command" >&2; exit 255; }
      [ "$1" = "$FAKE_DEST" ] || { echo "fake ssh: unexpected destination" >&2; exit 255; }
      shift
      cmd="$*"
      pat=/opt/planforhome
      cmd=${cmd//"$pat"/$FAKE_ROOT}
      exec env -i PATH="$FAKE_BIN:/usr/bin:/bin" HOME="$FAKE_HOME" LANG=C.UTF-8 \
        LOCK_WAIT="${FAKE_LOCK_WAIT:-60}" FAKE_LOG="$FAKE_LOG" FAKE_STATE="$FAKE_STATE" \
        FAKE_ROOT="$FAKE_ROOT" FAKE_TOKEN="$FAKE_TOKEN" FAKE_DOMAIN="$FAKE_DOMAIN" bash -c "$cmd"
      """;

  static final String FAKE_SCP =
      """
      #!/usr/bin/env bash
      # Fake scp: records its arguments, checks the pinned host key, copies into the fake server.
      # Refuses (and records a violation) to overwrite a file while the deploy lock (a file with
      # "lock" in its name, in the server folder) is held.
      set -u
      { printf 'scp'; printf ' [%s]' "$@"; printf '\\n'; } >>"$FAKE_LOG/scp.args"
      strict=no
      files=()
      while [ $# -gt 0 ]; do
        case $1 in
          -o) [ "$2" = StrictHostKeyChecking=yes ] && strict=yes; shift 2 ;;
          -i | -P | -F | -J | -l) shift 2 ;;
          -*) shift ;;
          *) files+=("$1"); shift ;;
        esac
      done
      [ "$strict" = yes ] || { echo "fake scp: StrictHostKeyChecking=yes missing" >&2; exit 255; }
      [ ${#files[@]} -ge 2 ] || { echo "fake scp: nothing to copy" >&2; exit 1; }
      target=${files[-1]}
      unset 'files[-1]'
      case $target in
        "$FAKE_DEST":/opt/planforhome*) ;;
        *) echo "fake scp: unexpected target" >&2; exit 1 ;;
      esac
      path=$FAKE_ROOT${target#"$FAKE_DEST":/opt/planforhome}
      locked=no
      for f in "$FAKE_ROOT"/*lock* "$FAKE_ROOT"/.*lock*; do
        [ -f "$f" ] || continue
        flock -n -E 75 "$f" true
        [ $? -eq 75 ] && locked=yes
      done
      for src in "${files[@]}"; do
        if [ -d "$path" ]; then dst=$path/$(basename "$src"); else dst=$path; fi
        [ -d "$(dirname "$dst")" ] || { echo "fake scp: no such remote directory" >&2; exit 1; }
        if [ -e "$dst" ] && [ "$locked" = yes ]; then
          echo "scp overwrote $dst while the deploy lock was held" >>"$FAKE_LOG/violations"
          echo "fake scp: $dst is in use" >&2
          exit 1
        fi
        cp "$src" "$dst" || exit 1
      done
      """;

  static final String FAKE_DOCKER =
      """
      #!/usr/bin/env bash
      # Fake docker: login, logout, pull, compose up and compose ps. The running containers live in
      # $FAKE_STATE/containers as "service image state". Control files in $FAKE_STATE:
      # up-seconds (duration of compose up, default 1), digest-mismatch (the server runs another
      # digest), server-stops (the server has the right image but is not running), pull-fails.
      set -u
      { printf 'docker'; printf ' [%s]' "$@"; printf ' (cwd %s)\\n' "$PWD"; } >>"$FAKE_LOG/docker.log"
      fail() { echo "fake docker: $*" >&2; exit 1; }
      violation() { echo "$*" >>"$FAKE_LOG/violations"; fail "$*"; }
      q="'"
      dq='"'
      env_value() {
        local v
        v=$(sed -n "s/^$1=//p" .env | tail -n 1)
        v=${v#"$q"}; v=${v%"$q"}; v=${v#"$dq"}; v=${v%"$dq"}
        printf '%s' "$v"
      }
      case ${1-} in
        login)
          token=$(cat)
          [ "$token" = "$FAKE_TOKEN" ] || fail "login refused"
          echo "Login Succeeded" ;;
        logout) ;;
        pull)
          [ $# -eq 2 ] || fail "pull wants exactly one image"
          [ -f "$FAKE_STATE/pull-fails" ] && fail "pull failed"
          echo "pulled" ;;
        compose)
          shift
          sub=
          while [ $# -gt 0 ]; do
            case $1 in
              -f | --file | -p | --project-name | --env-file | --project-directory) shift 2 ;;
              -*) shift ;;
              *) sub=$1; shift; break ;;
            esac
          done
          [ "$PWD" = "$FAKE_ROOT" ] || violation "docker compose run outside the server folder: $PWD"
          [ -f docker-compose.yml ] && [ -f Caddyfile ] && [ -f .env ] \
            || fail "docker-compose.yml, Caddyfile or .env missing in $PWD"
          [ "$(stat -c %a .env)" = 600 ] || violation ".env is not mode 600"
          case $sub in
            up)
              for name in IMAGE_SERVER IMAGE_WEB LAB_BASE_DOMAIN POSTGRES_PASSWORD DEMO_PASSWORD; do
                [ -n "$(env_value "$name")" ] || fail "required variable $name is missing"
              done
              [ "$(env_value LAB_BASE_DOMAIN)" = "$FAKE_DOMAIN" ] || fail "unexpected LAB_BASE_DOMAIN"
              marker=$FAKE_STATE/compose-up.running
              [ -e "$marker" ] && violation "two docker compose up at the same time"
              touch "$marker"
              echo "start $(date +%s%N)" >>"$FAKE_LOG/compose-up.log"
              sleep "$(cat "$FAKE_STATE/up-seconds" 2>/dev/null || echo 1)"
              server=$(env_value IMAGE_SERVER)
              web=$(env_value IMAGE_WEB)
              server_state=running
              if [ -f "$FAKE_STATE/digest-mismatch" ]; then
                server=${server%@*}@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
              fi
              [ -f "$FAKE_STATE/server-stops" ] && server_state=exited
              {
                printf 'server %s %s\\n' "$server" "$server_state"
                printf 'caddy %s running\\n' "$web"
                printf 'postgres postgres@sha256:%s running\\n' dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd
              } >"$FAKE_STATE/containers"
              echo "end $(date +%s%N)" >>"$FAKE_LOG/compose-up.log"
              rm -f "$marker" ;;
            ps)
              all=no
              fmt='{{.Name}}'
              while [ $# -gt 0 ]; do
                case $1 in
                  -a | --all) all=yes; shift ;;
                  --format) fmt=$2; shift 2 ;;
                  --format=*) fmt=${1#--format=}; shift ;;
                  *) shift ;;
                esac
              done
              [ -f "$FAKE_STATE/containers" ] || exit 0
              while read -r svc img st; do
                [ "$st" = running ] || [ "$all" = yes ] || continue
                line=${fmt//'{{.Service}}'/$svc}
                line=${line//'{{.Image}}'/$img}
                line=${line//'{{.State}}'/$st}
                printf '%s\\n' "$line"
              done <"$FAKE_STATE/containers"
              ;;
            *) fail "unsupported compose command: $sub" ;;
          esac ;;
        *) fail "unsupported docker command: ${1-}" ;;
      esac
      """;

  // ---------------------------------------------------------------- setup and helpers

  @BeforeEach
  void fakeServer() throws IOException {
    bin = Files.createDirectories(tmp.resolve("bin"));
    log = Files.createDirectories(tmp.resolve("log"));
    state = Files.createDirectories(tmp.resolve("state"));
    home = Files.createDirectories(tmp.resolve("home"));
    // SETUP §3 creates /opt/planforhome for the deploy user.
    root = Files.createDirectories(tmp.resolve("server/opt/planforhome"));
    writeExecutable(bin.resolve("ssh"), FAKE_SSH);
    writeExecutable(bin.resolve("scp"), FAKE_SCP);
    writeExecutable(bin.resolve("docker"), FAKE_DOCKER);
  }

  private static void writeExecutable(Path file, String content) throws IOException {
    Files.writeString(file, content, StandardCharsets.UTF_8);
    Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rwxr-xr-x"));
  }

  /** The environment of the deploy step of consegna.yml, plus the fakes' own variables. */
  private Map<String, String> jobEnv(String sha, String server, String web) {
    Map<String, String> env = new HashMap<>();
    env.put("PATH", bin + ":/usr/bin:/bin");
    env.put("HOME", home.toString());
    env.put("LANG", "C.UTF-8");
    env.put("DEPLOY_HOST", DEPLOY_HOST);
    env.put("DEPLOY_USER", DEPLOY_USER);
    env.put("DEPLOY_SSH_KEY", SSH_KEY);
    env.put("DEPLOY_KNOWN_HOSTS", KNOWN_HOSTS);
    env.put("LAB_BASE_DOMAIN", DOMAIN);
    env.put("IMAGE_SERVER", server);
    env.put("IMAGE_WEB", web);
    env.put("GIT_SHA", sha);
    env.put("GHCR_TOKEN", GHCR_TOKEN);
    env.put("GHCR_USER", GHCR_USER);
    env.put("DEMO_PASSWORD", DEMO_PASSWORD);
    env.put("FCM_SERVICE_ACCOUNT_JSON", FCM_JSON);
    env.put("FAKE_BIN", bin.toString());
    env.put("FAKE_LOG", log.toString());
    env.put("FAKE_STATE", state.toString());
    env.put("FAKE_ROOT", root.toString());
    env.put("FAKE_HOME", home.toString());
    env.put("FAKE_DEST", DEPLOY_USER + "@" + DEPLOY_HOST);
    env.put("FAKE_KNOWN_HOSTS", KNOWN_HOSTS);
    env.put("FAKE_TOKEN", GHCR_TOKEN);
    env.put("FAKE_DOMAIN", DOMAIN);
    return env;
  }

  private Process start(Map<String, String> env, String script, String... args) throws IOException {
    List<String> command = new ArrayList<>();
    command.add(INFRA.resolve(script).toString());
    command.addAll(List.of(args));
    ProcessBuilder builder = new ProcessBuilder(command).directory(tmp.toFile());
    builder.environment().clear();
    builder.environment().putAll(env);
    Path out = log.resolve("run-" + runs.incrementAndGet() + "-" + script + ".out");
    outputs.add(out);
    builder.redirectErrorStream(true).redirectOutput(out.toFile());
    builder.redirectInput(ProcessBuilder.Redirect.from(new java.io.File("/dev/null")));
    return builder.start();
  }

  private Result run(Map<String, String> env, String script, String... args) throws Exception {
    Process process = start(env, script, args);
    boolean done = process.waitFor(120, TimeUnit.SECONDS);
    if (!done) {
      process.destroyForcibly();
    }
    assertThat(done).as(script + " ends within 120 s").isTrue();
    return new Result(process.exitValue(), Files.readString(outputs.get(outputs.size() - 1)));
  }

  private Result deploy(String sha, String server, String web) throws Exception {
    return run(jobEnv(sha, server, web), "deploy.sh", server, web);
  }

  /**
   * consegna.yml calls rollback.sh without arguments, with the environment of the failed deploy.
   */
  private Result rollback(String sha, String server, String web) throws Exception {
    return run(jobEnv(sha, server, web), "rollback.sh");
  }

  private String running(String service) throws IOException {
    Path containers = state.resolve("containers");
    if (!Files.exists(containers)) {
      return "";
    }
    for (String line : Files.readAllLines(containers)) {
      String[] parts = line.split(" ");
      if (parts[0].equals(service) && parts[2].equals("running")) {
        return parts[1];
      }
    }
    return "";
  }

  private String logFile(String name) throws IOException {
    Path file = log.resolve(name);
    return Files.exists(file) ? Files.readString(file) : "";
  }

  private long composeUps() throws IOException {
    return logFile("compose-up.log").lines().filter(l -> l.startsWith("start ")).count();
  }

  private void control(String name) throws IOException {
    Files.writeString(state.resolve(name), "");
  }

  private void control(String name, String value) throws IOException {
    Files.writeString(state.resolve(name), value);
  }

  private void waitForComposeUp(int count) throws Exception {
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(60);
    while (composeUps() < count || !Files.exists(state.resolve("compose-up.running"))) {
      assertThat(System.nanoTime())
          .as("compose up number " + count + " started")
          .isLessThan(deadline);
      Thread.sleep(50);
    }
  }

  private String postgresPassword() throws IOException {
    return Files.readAllLines(root.resolve(".env")).stream()
        .filter(l -> l.startsWith("POSTGRES_PASSWORD="))
        .map(l -> l.substring("POSTGRES_PASSWORD=".length()).replace("'", "").replace("\"", ""))
        .findFirst()
        .orElse("");
  }

  private void assertNoViolations() throws IOException {
    assertThat(logFile("violations")).as("violations recorded by the fakes").isEmpty();
  }

  // ---------------------------------------------------------------- tests

  @Test
  void invalidArgumentsExit2WithoutAnySshEvenWithoutDeployVariables() throws Exception {
    Map<String, String> bare = new HashMap<>();
    bare.put("PATH", bin + ":/usr/bin:/bin");
    bare.put("HOME", home.toString());
    bare.put("FAKE_LOG", log.toString());

    assertThat(run(bare, "deploy.sh", "latest", "latest").exit()).isEqualTo(2);
    assertThat(run(bare, "deploy.sh").exit()).isEqualTo(2);
    assertThat(run(bare, "deploy.sh", SERVER_A).exit()).isEqualTo(2);

    Map<String, String> env = jobEnv(SHA_A, SERVER_A, WEB_A);
    assertThat(run(env, "deploy.sh", "latest", "latest").exit()).isEqualTo(2);
    assertThat(
            run(env, "deploy.sh", "docker.io/library/nginx@sha256:" + "a".repeat(64), WEB_A).exit())
        .isEqualTo(2);
    assertThat(run(env, "deploy.sh", OWNER + "/server:latest", WEB_A).exit()).isEqualTo(2);
    assertThat(run(env, "deploy.sh", SERVER_A, WEB_A, "extra").exit()).isEqualTo(2);

    assertThat(logFile("ssh.args")).as("no ssh call").isEmpty();
    assertThat(logFile("scp.args")).as("no scp call").isEmpty();
  }

  @Test
  void missingConfigurationExits3WithoutAnySsh() throws Exception {
    for (String missing : List.of("GHCR_USER", "LAB_BASE_DOMAIN", "DEPLOY_HOST", "DEMO_PASSWORD")) {
      Map<String, String> env = jobEnv(SHA_A, SERVER_A, WEB_A);
      env.remove(missing);
      Result result = run(env, "deploy.sh", SERVER_A, WEB_A);
      assertThat(result.exit()).as("deploy without " + missing).isEqualTo(3);
      assertThat(result.output()).contains(missing);
    }
    assertThat(logFile("ssh.args")).as("no ssh call").isEmpty();
  }

  @Test
  void deployADeployBRollbackRunsAAgain() throws Exception {
    Result a = deploy(SHA_A, SERVER_A, WEB_A);
    assertThat(a.exit()).as("deploy A: " + a.output()).isZero();
    assertThat(running("server")).isEqualTo(SERVER_A);
    assertThat(running("caddy")).isEqualTo(WEB_A);
    String passwordAfterA = postgresPassword();

    Result b = deploy(SHA_B, SERVER_B, WEB_B);
    assertThat(b.exit()).as("deploy B: " + b.output()).isZero();
    assertThat(running("server")).isEqualTo(SERVER_B);
    assertThat(running("caddy")).isEqualTo(WEB_B);

    // The PostgreSQL password is generated once and kept: the data volume depends on it.
    assertThat(passwordAfterA).hasSizeGreaterThanOrEqualTo(16);
    assertThat(postgresPassword()).isEqualTo(passwordAfterA);
    assertThat(PosixFilePermissions.toString(Files.getPosixFilePermissions(root.resolve(".env"))))
        .isEqualTo("rw-------");

    Result back = rollback(SHA_B, SERVER_B, WEB_B);
    assertThat(back.exit()).as("rollback: " + back.output()).isZero();
    assertThat(running("server")).isEqualTo(SERVER_A);
    assertThat(running("caddy")).isEqualTo(WEB_A);
    assertThat(postgresPassword()).isEqualTo(passwordAfterA);
    assertNoViolations();
  }

  @Test
  void deployingBTwiceKeepsAAsThePreviousVersion() throws Exception {
    assertThat(deploy(SHA_A, SERVER_A, WEB_A).exit()).isZero();
    assertThat(deploy(SHA_B, SERVER_B, WEB_B).exit()).isZero();
    Result again = deploy(SHA_B, SERVER_B, WEB_B);
    assertThat(again.exit()).as("deploy B again (idempotent): " + again.output()).isZero();
    assertThat(running("server")).isEqualTo(SERVER_B);

    Result back = rollback(SHA_B, SERVER_B, WEB_B);
    assertThat(back.exit()).as("rollback: " + back.output()).isZero();
    assertThat(running("server")).isEqualTo(SERVER_A);
    assertThat(running("caddy")).isEqualTo(WEB_A);
    assertNoViolations();
  }

  @Test
  void deployWhoseDigestDoesNotMatchFailsAndRollbackBringsBackA() throws Exception {
    assertThat(deploy(SHA_A, SERVER_A, WEB_A).exit()).isZero();

    control("digest-mismatch");
    Result b = deploy(SHA_B, SERVER_B, WEB_B);
    assertThat(b.exit()).as("deploy B with a wrong digest").isNotZero();
    Files.delete(state.resolve("digest-mismatch"));

    Result back = rollback(SHA_B, SERVER_B, WEB_B);
    assertThat(back.exit()).as("rollback: " + back.output()).isZero();
    assertThat(running("server")).isEqualTo(SERVER_A);
    assertThat(running("caddy")).isEqualTo(WEB_A);
    assertNoViolations();
  }

  @Test
  void serverWithTheRightImageButNotRunningFailsTheDeploy() throws Exception {
    control("server-stops");
    Result a = deploy(SHA_A, SERVER_A, WEB_A);
    assertThat(a.exit()).as("deploy with the server stopped").isNotZero();
  }

  @Test
  void rollbackWithoutAPreviousVersionFails() throws Exception {
    Result fresh = rollback(SHA_A, SERVER_A, WEB_A);
    assertThat(fresh.exit()).as("rollback on an empty server").isNotZero();
    assertThat(composeUps()).isZero();

    assertThat(deploy(SHA_A, SERVER_A, WEB_A).exit()).isZero();
    Result onlyA = rollback(SHA_A, SERVER_A, WEB_A);
    assertThat(onlyA.exit()).as("rollback after the first deploy").isNotZero();
    assertThat(running("server")).isEqualTo(SERVER_A);

    assertThat(deploy(SHA_B, SERVER_B, WEB_B).exit()).isZero();
    assertThat(rollback(SHA_B, SERVER_B, WEB_B).exit()).isZero();
    // After a successful rollback there is nothing left to go back to.
    Result twice = rollback(SHA_B, SERVER_B, WEB_B);
    assertThat(twice.exit()).as("second rollback in a row").isNotZero();
    assertThat(running("server")).isEqualTo(SERVER_A);
  }

  @Test
  void twoDeploysInParallelNeverOverlap() throws Exception {
    Process a = start(jobEnv(SHA_A, SERVER_A, WEB_A), "deploy.sh", SERVER_A, WEB_A);
    Process b = start(jobEnv(SHA_B, SERVER_B, WEB_B), "deploy.sh", SERVER_B, WEB_B);
    assertThat(a.waitFor(120, TimeUnit.SECONDS)).isTrue();
    assertThat(b.waitFor(120, TimeUnit.SECONDS)).isTrue();

    assertThat(a.exitValue()).as("deploy A").isZero();
    assertThat(b.exitValue()).as("deploy B").isZero();
    assertThat(composeUps()).isEqualTo(2);
    assertNoViolations();
    assertThat(running("server")).isIn(SERVER_A, SERVER_B);
  }

  @Test
  void aDeployThatCannotTakeTheLockInTimeFailsWithoutComposeUp() throws Exception {
    control("up-seconds", "6");
    Process slow = start(jobEnv(SHA_A, SERVER_A, WEB_A), "deploy.sh", SERVER_A, WEB_A);
    waitForComposeUp(1);

    Map<String, String> impatient = jobEnv(SHA_B, SERVER_B, WEB_B);
    impatient.put("FAKE_LOCK_WAIT", "1");
    long started = System.nanoTime();
    Result b = run(impatient, "deploy.sh", SERVER_B, WEB_B);
    long seconds = TimeUnit.NANOSECONDS.toSeconds(System.nanoTime() - started);

    assertThat(b.exit()).as("deploy B while A holds the lock").isNotZero();
    assertThat(seconds).as("B gives up after the maximum wait").isLessThan(5);
    assertThat(slow.waitFor(120, TimeUnit.SECONDS)).isTrue();
    assertThat(slow.exitValue()).as("deploy A").isZero();
    assertThat(composeUps()).as("only A ran compose up").isEqualTo(1);
    assertThat(running("server")).isEqualTo(SERVER_A);
    assertNoViolations();
  }

  @Test
  void rollbackDuringASlowDeployWaitsForIt() throws Exception {
    assertThat(deploy(SHA_A, SERVER_A, WEB_A).exit()).isZero();

    control("up-seconds", "4");
    Process slowB = start(jobEnv(SHA_B, SERVER_B, WEB_B), "deploy.sh", SERVER_B, WEB_B);
    waitForComposeUp(2);
    control("up-seconds", "1");
    Result back = rollback(SHA_B, SERVER_B, WEB_B);

    assertThat(slowB.waitFor(120, TimeUnit.SECONDS)).isTrue();
    assertThat(slowB.exitValue()).as("deploy B").isZero();
    assertThat(back.exit()).as("rollback after waiting: " + back.output()).isZero();
    assertThat(composeUps()).isEqualTo(3);
    assertNoViolations();
    assertThat(running("server")).isEqualTo(SERVER_A);
    assertThat(running("caddy")).isEqualTo(WEB_A);
  }

  @Test
  void theGithubActorOfABotIsAValidRegistryUser() throws Exception {
    // github.actor of a run started by an app or a bot ends with [bot] (for example
    // github-actions[bot]): consegna.yml passes it as GHCR_USER to deploy and rollback.
    String bot = "planforhome-demo[bot]";
    Map<String, String> envA = jobEnv(SHA_A, SERVER_A, WEB_A);
    envA.put("GHCR_USER", bot);
    Result a = run(envA, "deploy.sh", SERVER_A, WEB_A);
    assertThat(a.exit()).as("deploy A as " + bot + ": " + a.output()).isZero();

    Map<String, String> envB = jobEnv(SHA_B, SERVER_B, WEB_B);
    envB.put("GHCR_USER", bot);
    assertThat(run(envB, "deploy.sh", SERVER_B, WEB_B).exit()).isZero();
    Result back = run(envB, "rollback.sh");
    assertThat(back.exit()).as("rollback as " + bot + ": " + back.output()).isZero();
    assertThat(running("server")).isEqualTo(SERVER_A);
  }

  @Test
  void secretsNeverAppearInArgumentsLogsOrFilesExceptTheEnvFile() throws Exception {
    assertThat(deploy(SHA_A, SERVER_A, WEB_A).exit()).isZero();
    control("digest-mismatch");
    assertThat(deploy(SHA_B, SERVER_B, WEB_B).exit()).isNotZero();
    Files.delete(state.resolve("digest-mismatch"));
    assertThat(rollback(SHA_B, SERVER_B, WEB_B).exit()).isZero();

    String sshArgs = logFile("ssh.args");
    assertThat(sshArgs).contains("StrictHostKeyChecking=yes");
    assertThat(logFile("scp.args")).contains("StrictHostKeyChecking=yes");
    for (String secret : SECRETS) {
      assertThat(sshArgs).as("ssh arguments").doesNotContain(secret);
      assertThat(logFile("scp.args")).as("scp arguments").doesNotContain(secret);
      assertThat(logFile("docker.log")).as("docker arguments").doesNotContain(secret);
      for (Path out : outputs) {
        assertThat(Files.readString(out))
            .as("output of " + out.getFileName())
            .doesNotContain(secret);
      }
    }

    // On the server the secrets live only in the .env (mode 600); the registry token not even
    // there.
    Path env = root.resolve(".env");
    assertThat(PosixFilePermissions.toString(Files.getPosixFilePermissions(env)))
        .isEqualTo("rw-------");
    assertThat(Files.readString(env)).contains(DEMO_PASSWORD).doesNotContain(GHCR_TOKEN);
    try (Stream<Path> files = Files.walk(tmp.resolve("server"))) {
      for (Path file : files.filter(Files::isRegularFile).toList()) {
        if (file.equals(env)) {
          continue;
        }
        String content = Files.readString(file, StandardCharsets.ISO_8859_1);
        for (String secret : SECRETS) {
          assertThat(content).as("server file " + root.relativize(file)).doesNotContain(secret);
        }
      }
    }
    assertNoViolations();
  }
}
