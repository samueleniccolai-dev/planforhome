package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Round 018, T8 part 1 (server): a recurring shopping list (SPEC 2.2.7). When an occurrence is done
 * or cancelled «this time», the next one gets a copy of the unchecked items (new ids, same text,
 * same order, unchecked, version 1); the checked ones stay behind. The closed occurrence keeps its
 * items as they were. «End the series» creates nothing. Context and clock of its own (as in round
 * 013): the clock is set once, before the first due.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "DEMO_PASSWORD=" + Giro003AcceptanceSupport.DEMO_PASSWORD,
      "planforhome.acceptance.context=giro018-shopping-series"
    })
@Import(AcceptanceClock.Config.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class Giro018ShoppingSeriesAcceptanceTest extends Giro018AcceptanceSupport {

  static final String UUID_V7 =
      "^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

  /** Saturday 1 February 2031. */
  static final String FIRST_SATURDAY = "2031-02-01";

  record Weekly(
      Principale p, String list, String pasta, String riso, String caffe, String zucchero) {}

  /**
   * «Spesa settimanale» of Giulia with «Pasta», «Riso», «Caffè», «Zucchero»; Riso, Caffè checked.
   */
  Weekly weekly() throws Exception {
    Principale p = principale();
    String token = p.giulia().token();
    String list = weeklyListOk(token, p.id(), SETTIMANALE, FIRST_SATURDAY);
    String pasta = addOk(token, p.id(), list, "Pasta");
    String riso = addOk(token, p.id(), list, "Riso");
    String caffe = addOk(token, p.id(), list, "Caffè");
    String zucchero = addOk(token, p.id(), list, "Zucchero");
    checkOk(token, p.id(), list, riso);
    checkOk(p.marco().token(), p.id(), list, caffe);
    return new Weekly(p, list, pasta, riso, caffe, zucchero);
  }

  /** The next occurrence has only the unchecked items, as copies; the closed one keeps its four. */
  void assertCopied(Weekly s, String closedStatus) throws Exception {
    Principale p = s.p();
    Map<String, Object> next = nextOf(p.giulia().token(), p.id(), s.list(), s.list());
    assertThat(next).containsEntry("due", "2031-02-08").containsEntry("template", "SHOPPING_LIST");
    String nextId = (String) next.get("id");

    List<Map<String, Object>> copied = items(p.luca().token(), p.id(), nextId);
    assertThat(texts(copied)).containsExactly("Pasta", "Zucchero");
    assertThat(checks(copied)).containsOnly(false);
    for (Map<String, Object> copy : copied) {
      assertThat((String) copy.get("id")).matches(UUID_V7);
      assertThat(copy.get("id")).isNotIn(s.pasta(), s.riso(), s.caffe(), s.zucchero());
      assertThat(copy.get("taskId")).isEqualTo(nextId);
      assertThat(version(copy)).isEqualTo(1L);
      assertThat(changeLog((String) copy.get("id"))).containsExactly(itemRow(p.id(), "UPSERT"));
    }

    assertThat(task(p.giulia().token(), p.id(), s.list())).containsEntry("status", closedStatus);
    List<Map<String, Object>> closed = items(p.giulia().token(), p.id(), s.list());
    assertThat(texts(closed)).containsExactly("Pasta", "Riso", "Caffè", "Zucchero");
    assertThat(checks(closed)).containsExactly(false, true, true, false);
    assertThat(storedItems(s.list())).hasSize(4);
  }

  @Test
  @Order(1)
  void doneCarriesTheUncheckedItemsToTheNextSaturday() throws Exception {
    at("2031-01-20T08:00:00Z");
    Weekly s = weekly();
    assertOk(done(s.p().giulia().token(), s.p().id(), s.list()));
    assertCopied(s, "DONE");
  }

  @Test
  @Order(2)
  void cancelThisTimeCarriesThemToo() throws Exception {
    Weekly s = weekly();
    assertOk(cancel(s.p().giulia().token(), s.p().id(), s.list()));
    assertCopied(s, "CANCELLED");
  }

  @Test
  @Order(3)
  void endTheSeriesCopiesNothing() throws Exception {
    Weekly s = weekly();
    Principale p = s.p();
    assertOk(endSeries(p.giulia().token(), p.id(), s.list()));

    assertThat(openInSeries(p.giulia().token(), p.id(), s.list())).isEmpty();
    assertThat(series(p.giulia().token(), p.id(), s.list())).hasSize(1);
    assertThat(storedItems(s.list())).hasSize(4);
    Integer all =
        jdbc.queryForObject(
            "select count(*) from shopping_item i join task t on t.id = i.task_id"
                + " where t.series_id = ?::uuid",
            Integer.class,
            s.list());
    assertThat(all).isEqualTo(4);
  }
}
