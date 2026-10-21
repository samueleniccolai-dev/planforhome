package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Round 016, T7: {@code POST /api/families/{familyId}/tasks/{taskId}/forward}. P11 is checked on
 * the role in the family of departure; the caller must be a member of both families (404 if not);
 * the assignee stays if he belongs to the family of arrival, otherwise the task goes to the queue;
 * the rule and the series stay; a DATE due keeps its local date in the zone of arrival. One {@code
 * FORWARDED} event, one DELETE in the change log of the departure and one UPSERT in the change log
 * of the arrival; the same {@code mutationId} again gives the current view, nothing more.
 *
 * <p>Context and clock of its own; the clock only moves forward by the two hours of every test, so
 * every due is weeks after it and the order of the tests does not matter.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "DEMO_PASSWORD=" + Giro003AcceptanceSupport.DEMO_PASSWORD,
      "planforhome.acceptance.context=giro016-forward"
    })
@Import(AcceptanceClock.Config.class)
class Giro016ForwardAcceptanceTest extends Giro016AcceptanceSupport {

  private static final int ROUNDS = 5;

  // ---------------------------------------------------------------- P11

  @Test
  void aManagerOfTheDepartureForwardsAndTheAssigneeNotInTheArrivalIsDropped() throws Exception {
    World w = world();
    String foto = foto(w);

    Response forwarded = forward(w.giulia().token(), w.principale(), foto, w.mamma());

    assertForwarded(forwarded, w.mamma(), 2);
    assertThat((Object) forwarded.json("$.assigneePersonId")).as("Marco is not in Mamma").isNull();
    assertThat(ids(tasks(w.giulia().token(), w.principale()))).doesNotContain(foto);
    assertThat(ids(tasks(w.giulia().token(), w.mamma()))).contains(foto);
    Map<String, Object> seenByAnna = task(w.anna().token(), w.mamma(), foto);
    assertThat(seenByAnna).containsEntry("title", FOTO).containsEntry("status", "OPEN");
    assertThat(seenByAnna.get("assigneePersonId")).isNull();
    assertThat(changeLog(foto))
        .containsExactly(
            row(w.principale(), "UPSERT"), row(w.principale(), "DELETE"), row(w.mamma(), "UPSERT"));
    assertThat(events(foto))
        .containsExactly(
            Map.of(
                "type", "FORWARDED",
                "actor", w.giulia().personId(),
                "from_family", w.principale(),
                "to_family", w.mamma(),
                "assignee_kept", "false"));
  }

  @Test
  void aManagerOfTheDepartureWhoIsNotInTheArrivalGets404() throws Exception {
    World w = world();
    String foto = foto(w);

    Response refused = forward(w.marco().token(), w.principale(), foto, w.mamma());

    assertError(refused, 404, "not_found");
    assertUntouched(foto, w.principale(), 1, 1);
    // The same task can be forwarded by who is in both families: the 404 was about Marco.
    assertForwarded(forward(w.giulia().token(), w.principale(), foto, w.mamma()), w.mamma(), 2);
  }

  @Test
  void aMemberForwardsHisOwnTaskAndStaysTheAssignee() throws Exception {
    World w = world();
    String siepe = taskOk(w.marco().token(), w.babbo(), SIEPE, w.marco().personId());

    Response forwarded = forward(w.marco().token(), w.babbo(), siepe, w.principale());

    assertForwarded(forwarded, w.principale(), 2);
    assertThat((String) forwarded.json("$.assigneePersonId")).isEqualTo(w.marco().personId());
    assertThat(ids(tasks(w.rosa().token(), w.babbo()))).doesNotContain(siepe);
    assertThat(task(w.giulia().token(), w.principale(), siepe))
        .containsEntry("assigneePersonId", w.marco().personId());
  }

  @Test
  void aMemberCannotForwardATaskThatIsNotHis() throws Exception {
    World w = world();
    String documento = taskOk(w.rosa().token(), w.babbo(), DOCUMENTO);

    Response refused = forward(w.marco().token(), w.babbo(), documento, w.principale());

    assertError(refused, 403, "forbidden");
    assertUntouched(documento, w.babbo(), 1, 1);
    assertThat(ids(tasks(w.rosa().token(), w.babbo()))).contains(documento);
  }

  // ---------------------------------------------------------------- the assignee

  @Test
  void anAssigneeInTheArrivalStaysAndAResourceOfTheDepartureGoesToTheQueue() throws Exception {
    World w = world();
    String regalo = taskOk(w.giulia().token(), w.principale(), REGALO, w.giulia().personId());
    String dentista = taskOk(w.giulia().token(), w.principale(), DENTISTA, w.leo());

    Response kept = forward(w.giulia().token(), w.principale(), regalo, w.mamma());
    Response queued = forward(w.giulia().token(), w.principale(), dentista, w.mamma());

    assertForwarded(kept, w.mamma(), 2);
    assertThat((String) kept.json("$.assigneePersonId")).isEqualTo(w.giulia().personId());
    assertForwarded(queued, w.mamma(), 2);
    assertThat((Object) queued.json("$.assigneePersonId")).as("Leo is not in Mamma").isNull();
    assertThat(stored(dentista).get("assignee")).isNull();
    assertThat(events(regalo)).hasSize(1);
    assertThat(events(regalo).get(0)).containsEntry("assignee_kept", "true");
    assertThat(events(dentista).get(0)).containsEntry("assignee_kept", "false");
  }

  // ---------------------------------------------------------------- who is not in both

  @Test
  void whoIsOnlyInOneOfTheTwoFamiliesGets404() throws Exception {
    World w = world();
    String pranzo = taskOk(w.anna().token(), w.mamma(), PRANZO);
    String latte = taskOk(w.luca().token(), w.mamma(), LATTE, w.luca().personId());

    assertError(forward(w.luca().token(), w.mamma(), latte, w.principale()), 404, "not_found");
    assertError(forward(w.anna().token(), w.mamma(), pranzo, w.principale()), 404, "not_found");

    assertUntouched(latte, w.mamma(), 1, 1);
    assertUntouched(pranzo, w.mamma(), 1, 1);
    // Giulia is in both: her own task of Mamma goes to Principale.
    String own = taskOk(w.giulia().token(), w.mamma(), REGALO, w.giulia().personId());
    assertForwarded(forward(w.giulia().token(), w.mamma(), own, w.principale()), w.principale(), 2);
  }

  // ---------------------------------------------------------------- recurring tasks

  @Test
  void aRecurringTaskKeepsItsRuleAndItsNextOccurrenceIsBornInTheArrival() throws Exception {
    World w = world();
    String carta =
        recurringOk(
            w.marco().token(),
            w.principale(),
            CARTA,
            "DATE",
            "2031-02-04",
            TUESDAYS,
            w.marco().personId());

    Response forwarded = forward(w.giulia().token(), w.principale(), carta, w.mamma());

    assertForwarded(forwarded, w.mamma(), 2);
    Map<String, Object> moved = task(w.anna().token(), w.mamma(), carta);
    assertThat(moved).containsEntry("seriesId", carta).containsEntry("due", "2031-02-04");
    assertThat(moved.get("assigneePersonId")).as("Marco is not in Mamma").isNull();
    assertThat(recurrenceType(moved)).isEqualTo("WEEKLY");
    assertThat(strings(rule(moved).get("days"))).containsExactly("TUESDAY");

    // A task in the queue: Anna (manager of Mamma) marks it done (P7).
    assertOk(done(w.anna().token(), w.mamma(), carta));

    Map<String, Object> next = nextOf(w.anna().token(), w.mamma(), carta, carta);
    assertThat(next).containsEntry("title", CARTA).containsEntry("due", "2031-02-11");
    assertThat(next.get("assigneePersonId")).isNull();
    assertThat(strings(rule(next).get("days"))).containsExactly("TUESDAY");
    assertThat(series(w.giulia().token(), w.principale(), carta)).as("in Principale").isEmpty();
  }

  // ---------------------------------------------------------------- dues and time zones

  @Test
  void aDateDueKeepsItsLocalDateInTheZoneOfTheArrival() throws Exception {
    World w = world();
    String zio = createFamilyOk(w.giulia().token(), ZIO, NEW_YORK);
    String date = id();
    Response created =
        createTask(
            w.giulia().token(),
            w.principale(),
            id(),
            "id",
            date,
            "title",
            REGALO,
            "dueKind",
            "DATE",
            "due",
            "2031-01-20");
    assertThat(created.status()).as(created.body()).isEqualTo(201);
    String timed = id();
    created =
        createTask(
            w.giulia().token(),
            w.principale(),
            id(),
            "id",
            timed,
            "title",
            FOTO,
            "dueKind",
            "DATETIME",
            "due",
            "2031-01-20T17:30:00Z");
    assertThat(created.status()).as(created.body()).isEqualTo(201);

    Response forwardedDate = forward(w.giulia().token(), w.principale(), date, zio);
    Response forwardedTimed = forward(w.giulia().token(), w.principale(), timed, zio);

    assertForwarded(forwardedDate, zio, 2);
    assertThat((String) forwardedDate.json("$.dueKind")).isEqualTo("DATE");
    assertThat((String) forwardedDate.json("$.due")).isEqualTo("2031-01-20");
    assertThat(storedDueAt(date))
        .as("midnight of 20 January in New York")
        .isEqualTo(Instant.parse("2031-01-20T05:00:00Z"));
    assertForwarded(forwardedTimed, zio, 2);
    assertThat(dueInstant(task(w.giulia().token(), zio, timed)))
        .as("a DATETIME is an instant: it does not move")
        .isEqualTo(Instant.parse("2031-01-20T17:30:00Z"));
  }

  // ---------------------------------------------------------------- validations

  @Test
  void badRequestsAndClosedTasksAreRefusedWithoutEffect() throws Exception {
    World w = world();
    String foto = foto(w);
    String g = w.giulia().token();
    String p = w.principale();

    assertError(forward(g, p, foto, p), 400, "same_family");
    assertError(forward(g, p, foto, "non-un-uuid"), 400, "invalid_request");
    assertError(forward(g, p, foto, null), 400, "invalid_request");
    assertError(
        forwardRaw(g, p, foto, json("toFamilyId", w.mamma())), 400, "invalid_request"); // no id
    assertError(forward(g, p, foto, "non-un-uuid", w.mamma()), 400, "invalid_request");
    assertUntouched(foto, p, 1, 1);

    String closed = taskOk(g, p, REGALO, w.giulia().personId());
    assertOk(done(g, p, closed));
    assertError(forward(g, p, closed, w.mamma()), 409, "not_open");
    assertUntouched(closed, p, 2, 2);
  }

  // ---------------------------------------------------------------- idempotence

  @Test
  void theSameMutationAgainGivesTheSameStateAndNothingMore() throws Exception {
    World w = world();
    String foto = foto(w);
    String mutation = id();

    Response first = forward(w.giulia().token(), w.principale(), foto, mutation, w.mamma());
    Response again = forward(w.giulia().token(), w.principale(), foto, mutation, w.mamma());

    assertForwarded(first, w.mamma(), 2);
    assertForwarded(again, w.mamma(), 2);
    assertThat(changeLog(foto))
        .containsExactly(
            row(w.principale(), "UPSERT"), row(w.principale(), "DELETE"), row(w.mamma(), "UPSERT"));
    assertThat(appliedRows(mutation)).isEqualTo(1);
    assertThat(events(foto)).hasSize(1);

    String regalo = taskOk(w.giulia().token(), w.principale(), REGALO, w.giulia().personId());
    assertError(
        forward(w.giulia().token(), w.principale(), regalo, mutation, w.mamma()),
        409,
        "mutation_conflict");
    assertUntouched(regalo, w.principale(), 1, 1);
  }

  @Test
  void aReplayAfterLeavingTheFamilyOfArrivalGets404() throws Exception {
    World w = world();
    String foto = foto(w);
    String mutation = id();
    assertForwarded(
        forward(w.giulia().token(), w.principale(), foto, mutation, w.mamma()), w.mamma(), 2);

    Response removed = removeMember(w.anna().token(), w.mamma(), w.giulia().personId());
    assertThat(removed.status()).as(removed.body()).isBetween(200, 204);

    Response replay = forward(w.giulia().token(), w.principale(), foto, mutation, w.mamma());
    assertError(replay, 404, "not_found");
    assertThat(stored(foto).get("family_id")).isEqualTo(w.mamma());
    assertThat(events(foto)).hasSize(1);
  }

  // ---------------------------------------------------------------- concurrency

  @Test
  void twoCrossedForwardsAtTheSameTimeBothSucceed() throws Exception {
    World w = world();
    String g = w.giulia().token();
    for (int round = 0; round < ROUNDS; round++) {
      String toMamma = taskOk(g, w.principale(), FOTO);
      String toPrincipale = taskOk(g, w.mamma(), REGALO, w.giulia().personId());

      List<Response> answers =
          together(
              () -> forward(g, w.principale(), toMamma, w.mamma()),
              () -> forward(g, w.mamma(), toPrincipale, w.principale()));

      assertThat(statuses(answers)).as("round " + round + ": " + answers).containsExactly(200, 200);
      assertThat(stored(toMamma).get("family_id")).isEqualTo(w.mamma());
      assertThat(stored(toPrincipale).get("family_id")).isEqualTo(w.principale());
    }
  }

  @Test
  void aForwardAndATakeAtTheSameTimeLeaveNoWriteInTheDepartureAfterTheDelete() throws Exception {
    World w = world();
    for (int round = 0; round < ROUNDS; round++) {
      String foto = taskOk(w.giulia().token(), w.principale(), FOTO);

      List<Response> answers =
          together(
              () -> forward(w.giulia().token(), w.principale(), foto, w.mamma()),
              () -> take(w.marco().token(), w.principale(), foto));

      assertThat(answers.get(0).status()).as("forward: " + answers.get(0).body()).isEqualTo(200);
      assertThat(answers.get(1).status()).as("take: " + answers.get(1).body()).isIn(200, 404);
      Map<String, Object> now = stored(foto);
      assertThat(now.get("family_id")).isEqualTo(w.mamma());
      assertThat(now.get("assignee")).as("Marco is not in Mamma").isNull();
      List<Map<String, Object>> log = changeLog(foto);
      int delete = log.indexOf(row(w.principale(), "DELETE"));
      assertThat(delete).as("change_log: " + log).isGreaterThan(0);
      assertThat(log.subList(delete + 1, log.size()))
          .as("after the DELETE: " + log)
          .containsExactly(row(w.mamma(), "UPSERT"));
    }
  }
}
