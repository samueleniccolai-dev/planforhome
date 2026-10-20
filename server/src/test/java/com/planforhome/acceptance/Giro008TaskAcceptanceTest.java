package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 008, T5 part 1: P1 and P2 of SPEC 5, the body checks, the DATE due on the daylight saving
 * change, client ids that clash in both directions, idempotent {@code mutationId}, {@code version}
 * and {@code change_log}.
 */
class Giro008TaskAcceptanceTest extends Giro008AcceptanceSupport {

  // ---------------------------------------------------------------- P1

  @Test
  void p1MembersAndManagersSeeTheTasksOfTheirFamilies() throws Exception {
    Quercia q = quercia();
    String bread = taskOk(q.tea().token(), q.id(), BREAD);
    String basil = taskOk(q.ugo().token(), q.id(), BASIL);
    String gas = taskOk(q.tea().token(), q.acero(), GAS);

    assertThat(ids(tasks(q.tea().token(), q.id()))).containsExactlyInAnyOrder(bread, basil);
    assertThat(ids(tasks(q.ugo().token(), q.id()))).containsExactlyInAnyOrder(bread, basil);

    List<Map<String, Object>> teaAll = myTasks(q.tea().token());
    assertThat(ids(teaAll)).containsExactlyInAnyOrder(bread, basil, gas);
    assertThat(find(teaAll, bread))
        .containsEntry("familyId", q.id())
        .containsEntry("familyTimeZone", ROME);
    assertThat(find(teaAll, gas))
        .containsEntry("familyId", q.acero())
        .containsEntry("familyTimeZone", NEW_YORK);

    assertThat(ids(myTasks(q.ugo().token()))).containsExactlyInAnyOrder(bread, basil);
  }

  @Test
  void p1StrangersSeeNothing() throws Exception {
    Quercia q = quercia();
    String bread = taskOk(q.tea().token(), q.id(), BREAD);
    String gas = taskOk(q.tea().token(), q.acero(), GAS);
    String luca = demoToken("luca");

    Response refused = get("/api/families/" + q.id() + "/tasks", luca);
    Response missing = get("/api/families/" + id() + "/tasks", luca);

    assertThat(refused.status()).isEqualTo(404);
    assertThat(refused.status()).isEqualTo(missing.status());
    assertThat(refused.body()).isEqualTo(missing.body());
    assertThat(ids(myTasks(luca))).doesNotContain(bread, gas);
  }

  // ---------------------------------------------------------------- P2

  @Test
  void p2AMemberCreatesATaskWithTheTitleOnly() throws Exception {
    Quercia q = quercia();

    Response created = createTask(q.tea().token(), q.id(), id(), "title", BREAD);

    assertThat(created.status()).as(created.body()).isEqualTo(201);
    String taskId = created.json("$.id");
    assertThat(taskId).isNotBlank();
    Map<String, Object> task = created.json("$");
    assertThat(task)
        .containsEntry("familyId", q.id())
        .containsEntry("familyTimeZone", ROME)
        .containsEntry("title", BREAD)
        .containsEntry("status", "OPEN")
        .containsEntry("criticality", "NORMAL")
        .containsEntry("assigneePersonId", null)
        .containsEntry("dueKind", null)
        .containsEntry("due", null)
        .containsEntry("createdBy", q.tea().personId());
    assertThat(version(task)).isEqualTo(1);
    assertThat(ids(tasks(q.ugo().token(), q.id()))).containsExactly(taskId);
  }

  @Test
  void p2ADueDateAndADueInstantComeBackAsSent() throws Exception {
    Quercia q = quercia();

    Response date =
        createTask(
            q.tea().token(), q.id(), id(), "title", BASIL, "dueKind", "DATE", "due", "2026-11-03");
    Response instant =
        createTask(
            q.tea().token(),
            q.id(),
            id(),
            "title",
            VET,
            "dueKind",
            "DATETIME",
            "due",
            "2026-11-03T17:30:00Z");

    assertThat(date.status()).as(date.body()).isEqualTo(201);
    assertThat((String) date.json("$.dueKind")).isEqualTo("DATE");
    assertThat((String) date.json("$.due")).isEqualTo("2026-11-03");
    assertThat(instant.status()).as(instant.body()).isEqualTo(201);
    assertThat((String) instant.json("$.dueKind")).isEqualTo("DATETIME");
    assertThat((String) instant.json("$.due")).isEqualTo("2026-11-03T17:30:00Z");
  }

  @Test
  void aDueDateIsMidnightInTheTimeZoneOfTheFamilyAcrossTheDaylightSavingChange() throws Exception {
    Quercia q = quercia();
    String after = id();
    String change = id();

    Response afterChange =
        createTask(
            q.tea().token(),
            q.acero(),
            id(),
            "id",
            after,
            "title",
            GAS,
            "dueKind",
            "DATE",
            "due",
            "2026-11-03");
    Response onChange =
        createTask(
            q.tea().token(),
            q.acero(),
            id(),
            "id",
            change,
            "title",
            BIKE,
            "dueKind",
            "DATE",
            "due",
            "2026-11-01");

    assertThat(afterChange.status()).as(afterChange.body()).isEqualTo(201);
    assertThat(onChange.status()).as(onChange.body()).isEqualTo(201);
    assertThat(dueAt(after)).as("EST, after the change").isEqualTo("2026-11-03T05:00:00Z");
    assertThat(dueAt(change))
        .as("EDT, midnight before the change")
        .isEqualTo("2026-11-01T04:00:00Z");
    List<Map<String, Object>> all = myTasks(q.tea().token());
    assertThat(find(all, after))
        .containsEntry("dueKind", "DATE")
        .containsEntry("due", "2026-11-03");
    assertThat(find(all, change))
        .containsEntry("dueKind", "DATE")
        .containsEntry("due", "2026-11-01");
  }

  @Test
  void p2RefusesStrangersAndBadBodiesAndWritesNothing() throws Exception {
    Quercia q = quercia();
    String m = id();
    String token = q.tea().token();

    Response stranger = createTask(demoToken("luca"), q.id(), id(), "title", BREAD);
    assertThat(stranger.status()).as(stranger.body()).isEqualTo(404);
    Response anonymous = createTask(null, q.id(), id(), "title", BREAD);
    assertThat(anonymous.status()).as(anonymous.body()).isEqualTo(401);

    assertError(createTask(token, q.id(), m, "title", ""), 400, "title_invalid");
    assertError(createTask(token, q.id(), m, "title", "   "), 400, "title_invalid");
    assertError(createTask(token, q.id(), m, "title", "a".repeat(201)), 400, "title_invalid");
    assertError(
        createTask(token, q.id(), m, "title", BREAD, "criticality", "URGENT"),
        400,
        "criticality_invalid");
    assertError(
        createTask(token, q.id(), m, "title", BREAD, "dueKind", "DATE"), 400, "due_invalid");
    assertError(createTask(token, q.id(), null, "title", BREAD), 400, "invalid_request");
    assertError(createTask(token, q.id(), "not-a-uuid", "title", BREAD), 400, "invalid_request");

    assertThat(tasks(q.ugo().token(), q.id())).isEmpty();

    Response good = createTask(token, q.id(), m, "title", BREAD);
    assertThat(good.status())
        .as("a refused mutationId is not recorded: " + good.body())
        .isEqualTo(201);
    assertThat(tasks(q.ugo().token(), q.id())).hasSize(1);
  }

  // ---------------------------------------------------------------- client ids

  @Test
  void aTaskIdOfAnotherFamilyIsAConflictAndTheOtherTaskDoesNotChange() throws Exception {
    Quercia q = quercia();
    String gas = taskOk(q.tea().token(), q.acero(), GAS);

    Response clash = createTask(q.ugo().token(), q.id(), id(), "id", gas, "title", BREAD);

    assertError(clash, 409, "id_conflict");
    Map<String, Object> untouched = task(q.tea().token(), q.acero(), gas);
    assertThat(untouched).containsEntry("title", GAS).containsEntry("familyId", q.acero());
    assertThat(version(untouched)).isEqualTo(1);
    assertThat(tasks(q.ugo().token(), q.id())).isEmpty();
  }

  @Test
  void aPersonIdOrAFamilyIdIsNotATaskId() throws Exception {
    Quercia q = quercia();
    String marco = personIdOfDemo("marco");

    assertError(
        createTask(q.ugo().token(), q.id(), id(), "id", marco, "title", BREAD), 409, "id_conflict");
    assertError(
        createTask(q.ugo().token(), q.id(), id(), "id", q.acero(), "title", BREAD),
        409,
        "id_conflict");
    assertThat(tasks(q.ugo().token(), q.id())).isEmpty();
  }

  @Test
  void aTaskIdIsNotAResourceIdNorAFamilyId() throws Exception {
    Quercia q = quercia();
    String bread = taskOk(q.ugo().token(), q.id(), BREAD);
    List<String> membersBefore = memberIds(q.ugo().token(), q.id());

    Response resource = addResource(q.ugo().token(), q.id(), bread, "Nilo", q.ugo().personId());
    assertError(resource, 409, "id_conflict");
    assertThat(memberIds(q.ugo().token(), q.id()))
        .containsExactlyInAnyOrderElementsOf(membersBefore);

    Response family = createFamily(q.tea().token(), bread, "Famiglia Larice", ROME);
    assertError(family, 409, "id_conflict");
    assertThat(familyIds(q.tea().token())).containsExactlyInAnyOrder(q.id(), q.acero());

    Map<String, Object> task = task(q.ugo().token(), q.id(), bread);
    assertThat(task).containsEntry("title", BREAD);
    assertThat(version(task)).isEqualTo(1);
  }

  // ---------------------------------------------------------------- mutationId

  @Test
  void theSameCreationSentTwiceIsOneTask() throws Exception {
    Quercia q = quercia();
    String taskId = id();
    String m = id();

    Response first = createTask(q.tea().token(), q.id(), m, "id", taskId, "title", BREAD);
    Response second = createTask(q.tea().token(), q.id(), m, "id", taskId, "title", BREAD);

    assertThat(first.status()).as(first.body()).isEqualTo(201);
    assertThat(second.status()).as(second.body()).isEqualTo(200);
    assertThat((String) second.json("$.id")).isEqualTo(taskId);
    assertThat(version(second)).isEqualTo(1);
    assertThat(ids(tasks(q.ugo().token(), q.id()))).containsExactly(taskId);
    assertThat(changeLog(taskId)).hasSize(1);
  }

  @Test
  void takeAndAssigneeSentTwiceChangeOnceAndAMutationIdIsNotReused() throws Exception {
    Quercia q = quercia();
    String bread = taskOk(q.ugo().token(), q.id(), BREAD);
    String basil = taskOk(q.ugo().token(), q.id(), BASIL);
    String mTake = id();
    String mAssign = id();

    Response took = take(q.tea().token(), q.id(), bread, mTake);
    Response tookAgain = take(q.tea().token(), q.id(), bread, mTake);
    assertThat(took.status()).as(took.body()).isEqualTo(200);
    assertThat(tookAgain.status()).as(tookAgain.body()).isEqualTo(200);
    assertThat(version(tookAgain)).isEqualTo(2);

    Response assigned = setAssignee(q.ugo().token(), q.id(), bread, mAssign, q.ivo().personId());
    Response assignedAgain =
        setAssignee(q.ugo().token(), q.id(), bread, mAssign, q.ivo().personId());
    assertThat(assigned.status()).as(assigned.body()).isEqualTo(200);
    assertThat(assignedAgain.status()).as(assignedAgain.body()).isEqualTo(200);
    assertThat(version(assignedAgain)).isEqualTo(3);
    assertThat(changeLog(bread)).hasSize(3);

    assertError(
        setAssignee(q.ugo().token(), q.id(), basil, mAssign, q.ivo().personId()),
        409,
        "mutation_conflict");
    assertError(
        setAssignee(q.vera().token(), q.id(), bread, mAssign, q.ivo().personId()),
        409,
        "mutation_conflict");
    Map<String, Object> basilNow = task(q.ugo().token(), q.id(), basil);
    assertThat(basilNow).containsEntry("assigneePersonId", null);
    assertThat(version(basilNow)).isEqualTo(1);
    assertThat(version(task(q.ugo().token(), q.id(), bread))).isEqualTo(3);
    assertThat(changeLog(bread)).hasSize(3);
  }

  // ---------------------------------------------------------------- version and change_log

  @Test
  void everyWriteRaisesTheVersionAndAddsOneChangeLogRow() throws Exception {
    Quercia q = quercia();
    String bread = taskOk(q.ugo().token(), q.id(), BREAD);

    assertThat(take(q.tea().token(), q.id(), bread).status()).isEqualTo(200);
    assertThat(setAssignee(q.tea().token(), q.id(), bread, null).status()).isEqualTo(200);
    Response last = setAssignee(q.ugo().token(), q.id(), bread, q.ivo().personId());

    assertThat(last.status()).as(last.body()).isEqualTo(200);
    assertThat(version(last)).isEqualTo(4);
    assertThat(version(task(q.ugo().token(), q.id(), bread))).isEqualTo(4);
    List<Map<String, Object>> log = changeLog(bread);
    assertThat(log).hasSize(4);
    assertThat(log)
        .allSatisfy(
            row ->
                assertThat(row)
                    .containsEntry("family_id", q.id())
                    .containsEntry("entity", "task")
                    .containsEntry("op", "UPSERT"));
  }

  // ---------------------------------------------------------------- helpers

  private String dueAt(String taskId) {
    return jdbc.queryForObject(
        "select to_char(due_at at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') from task"
            + " where id = ?::uuid",
        String.class,
        taskId);
  }
}
