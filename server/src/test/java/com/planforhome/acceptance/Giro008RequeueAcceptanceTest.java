package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 008, the last sentence of T4 (SPEC 2.2.1): when a person leaves a family, or is removed
 * from it, her tasks of that family go back to the queue; her tasks of other families do not move.
 */
class Giro008RequeueAcceptanceTest extends Giro008AcceptanceSupport {

  @Test
  void theTasksOfADisabledAccountGoBackToTheQueue() throws Exception {
    Quercia q = quercia();
    String basil = taskOk(q.vera().token(), q.id(), BASIL, q.ivo().personId());
    String vet = taskOk(q.vera().token(), q.id(), VET);
    String mIvo = id();
    Response took = take(q.ivo().token(), q.id(), vet, mIvo);
    assertThat(took.status()).as(took.body()).isEqualTo(200);
    String bread = taskOk(q.vera().token(), q.id(), BREAD, q.tea().personId());

    Response removed = removeMember(q.ugo().token(), q.id(), q.ivo().personId());

    assertThat(removed.status()).as(removed.body()).isEqualTo(204);
    assertThat(login(q.ivo().email(), GOOD_PASSWORD).status()).isEqualTo(401);
    assertQueued(q, basil, 2);
    assertQueued(q, vet, 3);
    assertThat(changeLog(basil)).hasSize(2);
    assertThat(changeLog(vet)).hasSize(3);
    Map<String, Object> teas = task(q.ugo().token(), q.id(), bread);
    assertThat(teas).containsEntry("assigneePersonId", q.tea().personId());
    assertThat(version(teas)).isEqualTo(1);

    Response replay = take(q.ivo().token(), q.id(), vet, mIvo);
    assertThat(replay.status()).as("old token of a disabled account").isEqualTo(401);
    assertQueued(q, vet, 3);
    assertThat(changeLog(vet)).hasSize(3);
  }

  @Test
  void theTasksOfADeletedResourceGoBackToTheQueue() throws Exception {
    Quercia q = quercia();
    String vet = taskOk(q.vera().token(), q.id(), VET, q.gino());

    Response removed = removeMember(q.vera().token(), q.id(), q.gino());

    assertThat(removed.status()).as(removed.body()).isEqualTo(204);
    assertThat(memberIds(q.ugo().token(), q.id())).doesNotContain(q.gino());
    assertQueued(q, vet, 2);
  }

  @Test
  void aManagerRemovingTeaFromQuerciaMovesOnlyHerTasksOfQuercia() throws Exception {
    Quercia q = quercia();
    String bread = taskOk(q.tea().token(), q.id(), BREAD, q.tea().personId());
    String gas = taskOk(q.tea().token(), q.acero(), GAS, q.tea().personId());
    String basil = taskOk(q.ugo().token(), q.id(), BASIL);
    String mTea = id();
    Response took = take(q.tea().token(), q.id(), basil, mTea);
    assertThat(took.status()).as(took.body()).isEqualTo(200);

    Response removed = removeMember(q.ugo().token(), q.id(), q.tea().personId());

    assertThat(removed.status()).as(removed.body()).isEqualTo(204);
    assertQueued(q, bread, 2);
    assertQueued(q, basil, 3);
    Map<String, Object> stays = task(q.tea().token(), q.acero(), gas);
    assertThat(stays).containsEntry("assigneePersonId", q.tea().personId());
    assertThat(version(stays)).isEqualTo(1);
    assertThat(myTasks(q.tea().token())).extracting(t -> t.get("familyId")).containsOnly(q.acero());

    Response replay = take(q.tea().token(), q.id(), basil, mTea);
    assertThat(replay.status()).as("replay after removal: " + replay.body()).isEqualTo(404);
    Response fresh = take(q.tea().token(), q.id(), basil);
    assertThat(fresh.status()).as(fresh.body()).isEqualTo(404);
    assertQueued(q, basil, 3);
    assertThat(changeLog(basil)).hasSize(3);
  }

  @Test
  void teaLeavingQuerciaHerselfMovesOnlyHerTasksOfQuercia() throws Exception {
    Quercia q = quercia();
    String bread = taskOk(q.tea().token(), q.id(), BREAD, q.tea().personId());
    String gas = taskOk(q.tea().token(), q.acero(), GAS, q.tea().personId());

    Response left = removeMember(q.tea().token(), q.id(), q.tea().personId());

    assertThat(left.status()).as(left.body()).isEqualTo(204);
    assertQueued(q, bread, 2);
    Map<String, Object> stays = task(q.tea().token(), q.acero(), gas);
    assertThat(stays).containsEntry("assigneePersonId", q.tea().personId());
    assertThat(version(stays)).isEqualTo(1);
    assertThat(ids(myTasks(q.tea().token()))).containsExactly(gas);
  }

  /** As Ugo sees it: open, in the queue, with this version. */
  private void assertQueued(Quercia q, String taskId, long version) throws Exception {
    Map<String, Object> task = task(q.ugo().token(), q.id(), taskId);
    assertThat(task).containsEntry("status", "OPEN").containsEntry("assigneePersonId", null);
    assertThat(version(task)).as("version of " + task.get("title")).isEqualTo(version);
  }
}
