package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 010, T5 part 2 (server side): the demo tasks of Appendix A that T5 can already have. Same
 * application context as rounds 003, 006 and 008: the seeder ran once at start-up, when the
 * acceptance clock was still at {@link AcceptanceClock#START}. Nothing here deletes or reseeds: the
 * database is shared with the other classes (the idempotence lives in {@link
 * Giro010DemoTasksSeedAcceptanceTest}, with a database of its own).
 */
class Giro010DemoTasksAcceptanceTest extends Giro008AcceptanceSupport {

  static final String LUNCH = "Prenotare il pranzo di Natale";
  static final String ID_CARD = "Rinnovare la carta d'identità di Franco";

  /** The seed ran at START (2031-01-06 in Rome): today in the family zone plus 10 days. */
  static final String ID_CARD_DUE =
      LocalDate.ofInstant(AcceptanceClock.START, ZoneId.of(ROME)).plusDays(10).toString();

  static List<Map<String, Object>> titled(List<Map<String, Object>> tasks, String title) {
    return tasks.stream().filter(t -> title.equals(t.get("title"))).toList();
  }

  Map<String, Object> onlyOne(String token, String familyId, String title) throws Exception {
    List<Map<String, Object>> found = titled(tasks(token, familyId), title);
    assertThat(found).as("tasks titled «" + title + "»").hasSize(1);
    return found.get(0);
  }

  @Test
  void annaSeesTheChristmasLunchOnceInTheQueueAndLucaSeesItToo() throws Exception {
    String anna = demoToken("anna");
    String mamma = familyId(anna, MAMMA);

    Map<String, Object> lunch = onlyOne(anna, mamma, LUNCH);
    assertThat(lunch.get("familyId")).isEqualTo(mamma);
    assertThat(lunch.get("status")).isEqualTo("OPEN");
    assertThat(lunch.get("assigneePersonId")).isNull();
    assertThat(lunch.get("criticality")).isEqualTo("HIGH");
    assertThat(lunch.get("dueKind")).isNull();
    assertThat(lunch.get("due")).isNull();
    assertThat(version(lunch)).isEqualTo(1L);
    assertThat(lunch.get("createdBy")).isEqualTo(personIdOf(anna));

    String luca = demoToken("luca");
    assertThat(titled(tasks(luca, mamma), LUNCH)).hasSize(1);
  }

  @Test
  void rosaSeesTheIdCardOnceWithADateTenDaysAfterTheSeed() throws Exception {
    String rosa = demoToken("rosa");
    String babbo = familyId(rosa, BABBO);

    Map<String, Object> card = onlyOne(rosa, babbo, ID_CARD);
    assertThat(card.get("familyId")).isEqualTo(babbo);
    assertThat(card.get("status")).isEqualTo("OPEN");
    assertThat(card.get("assigneePersonId")).isNull();
    assertThat(card.get("criticality")).isEqualTo("NORMAL");
    assertThat(card.get("dueKind")).isEqualTo("DATE");
    assertThat(card.get("due")).isEqualTo(ID_CARD_DUE);
    assertThat(version(card)).isEqualTo(1L);
    assertThat(card.get("createdBy")).isEqualTo(personIdOf(rosa));
  }

  @Test
  void eachDemoTaskStaysInsideItsFamilies() throws Exception {
    List<Map<String, Object>> giulia = myTasks(demoToken("giulia"));
    assertThat(titled(giulia, LUNCH)).as("Giulia is in Mamma").hasSize(1);
    assertThat(titled(giulia, ID_CARD)).as("Giulia is not in Babbo").isEmpty();

    List<Map<String, Object>> marco = myTasks(demoToken("marco"));
    assertThat(titled(marco, ID_CARD)).as("Marco is in Babbo").hasSize(1);
    assertThat(titled(marco, LUNCH)).as("Marco is not in Mamma").isEmpty();

    String babbo = familyId(demoToken("rosa"), BABBO);
    Response luca = get("/api/families/" + babbo + "/tasks", demoToken("luca"));
    assertThat(luca.status()).as(luca.body()).isEqualTo(404);
    assertThat(luca.body()).doesNotContain(ID_CARD);

    // Not yet the tasks of Appendix A that need T8 or T10 («Mettere fuori la carta» comes with T6,
    // round 013, and is checked in Giro013DemoPaperAcceptanceTest).
    for (String later : List.of("Lista della spesa", "Preparare lo zaino")) {
      assertThat(titled(giulia, later)).as(later).isEmpty();
    }
  }

  @Test
  void eachDemoTaskHasOneUpsertInTheChangeLogOfItsFamily() throws Exception {
    String anna = demoToken("anna");
    String mamma = familyId(anna, MAMMA);
    String lunch = (String) onlyOne(anna, mamma, LUNCH).get("id");
    assertThat(changeLog(lunch))
        .containsExactly(Map.of("family_id", mamma, "entity", "task", "op", "UPSERT"));

    String rosa = demoToken("rosa");
    String babbo = familyId(rosa, BABBO);
    String card = (String) onlyOne(rosa, babbo, ID_CARD).get("id");
    assertThat(changeLog(card))
        .containsExactly(Map.of("family_id", babbo, "entity", "task", "op", "UPSERT"));
  }
}
