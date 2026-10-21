package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Round 020, T8 part 3 (server): contestation 019-b. In a recurring shopping list the next
 * occurrence gets every item not checked and not cancelled, the struck ones too, as normal items:
 * the strike holds for that time only. A checked item stays behind, even if struck. Only the cases
 * that round 019 (corrected) does not prove already. Context and clock of its own; the clock stands
 * still and moves by hand, so the «done» has an instant of its own in change_log.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "DEMO_PASSWORD=" + Giro003AcceptanceSupport.DEMO_PASSWORD,
      "planforhome.acceptance.context=giro020-shopping-series"
    })
@Import(AcceptanceClock.Config.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class Giro020ShoppingSeriesAcceptanceTest extends Giro019AcceptanceSupport {

  static final String MARZO = "Spesa di marzo";
  static final String DISPENSA = "Spesa della dispensa";

  /** Saturday 1 March 2031. */
  static final String FIRST_SATURDAY = "2031-03-01";

  static final String DONE_AT = "2031-01-20T09:00:00Z";

  @Test
  @Order(1)
  void aStruckUncheckedItemPassesAsANormalOneAndACheckedOneStaysBehind() throws Exception {
    at("2031-01-20T08:00:00Z");
    Families f = families();
    String m = f.mamma();
    String list = weeklyListOk(f.luca().token(), m, MARZO, FIRST_SATURDAY);
    String pasta = addOk(f.luca().token(), m, list, "Pasta");
    String riso = addOk(f.davide().token(), m, list, "Riso");
    String caffe = addOk(f.davide().token(), m, list, "Caffè");
    String zucchero = addOk(f.paolo().token(), m, list, "Zucchero");
    String sale = addOk(f.davide().token(), m, list, "Sale");

    assertStruck(remove(f.davide().token(), m, list, caffe), f.davide());
    checkOk(f.luca().token(), m, list, riso);
    checkOk(f.paolo().token(), m, list, sale);
    assertStruck(remove(f.davide().token(), m, list, sale), f.davide());
    at(DONE_AT);
    assertOk(done(f.anna().token(), m, list));

    Map<String, Object> next = nextOf(f.anna().token(), m, list, list);
    assertThat(next).containsEntry("due", "2031-03-08");
    String nextId = (String) next.get("id");
    List<Map<String, Object>> copied = items(f.paolo().token(), m, nextId);

    // A struck item not checked passes, as a normal item; a checked one (struck or not) does not.
    assertThat(texts(copied)).containsExactly("Pasta", "Caffè", "Zucchero");
    Map<String, Object> caffeCopy = copied.get(1);
    assertThat(createdBy(caffeCopy)).isEqualTo(f.davide().personId());
    assertThat(caffeCopy.get("checked")).isEqualTo(false);
    assertThat(removedBy(caffeCopy)).isNull();
    assertThat(caffeCopy.get("id")).isNotIn(pasta, riso, caffe, zucchero, sale);

    // change_log: one row per copy, and the «done» wrote nothing for Riso and Sale.
    for (Map<String, Object> copy : copied) {
      assertThat(itemLogRows((String) copy.get("id")))
          .as("change_log of the copy of " + copy.get("text"))
          .isEqualTo(1);
    }
    assertThat(itemLogRowsAt(riso, DONE_AT)).as("change_log of Riso at the done").isZero();
    assertThat(itemLogRowsAt(sale, DONE_AT)).as("change_log of Sale at the done").isZero();

    // The strike held for that time only: the copy of Caffè is checked like any other item.
    Response checked = check(f.davide().token(), m, nextId, (String) caffeCopy.get("id"), true);
    assertThat(checked.status()).as("check of the copy: " + checked.body()).isEqualTo(200);
    assertThat(object(checked).get("checked")).isEqualTo(true);

    // The closed occurrence keeps its strikes.
    List<Map<String, Object>> closed = items(f.anna().token(), m, list);
    assertThat(removedBy(item(closed, caffe))).isEqualTo(f.davide().personId());
    assertThat(removedBy(item(closed, sale))).isEqualTo(f.davide().personId());
  }

  @Test
  @Order(2)
  void aStruckItemPassesNextToARestoredOne() throws Exception {
    at("2031-01-21T08:00:00Z");
    Families f = families();
    String m = f.mamma();
    String list = weeklyListOk(f.luca().token(), m, DISPENSA, FIRST_SATURDAY);
    String olio = addOk(f.luca().token(), m, list, "Olio");
    String farina = addOk(f.luca().token(), m, list, "Farina");

    assertStruck(remove(f.paolo().token(), m, list, olio), f.paolo());
    Response restored = restore(f.davide().token(), m, list, olio);
    assertThat(restored.status()).as("restore: " + restored.body()).isEqualTo(200);
    assertStruck(remove(f.paolo().token(), m, list, farina), f.paolo());
    assertOk(done(f.anna().token(), m, list));

    Map<String, Object> next = nextOf(f.anna().token(), m, list, list);
    List<Map<String, Object>> copied = items(f.luca().token(), m, (String) next.get("id"));
    // Farina is the proof of the new rule: Olio passed with the rule of round 019 too.
    assertThat(texts(copied)).containsExactly("Olio", "Farina");
    assertThat(checks(copied)).containsOnly(false);
    assertThat(removers(copied)).containsOnlyNulls();
    assertThat(copied).extracting(i -> i.get("id")).doesNotContain(olio, farina);
  }

  // ---------------------------------------------------------------- database reads

  /** The change_log rows of a shopping item (after an HTTP assertion of the round). */
  int itemLogRows(String itemId) {
    Integer count =
        jdbc.queryForObject(
            "select count(*) from change_log where entity = 'shopping_item'"
                + " and entity_id = ?::uuid",
            Integer.class,
            itemId);
    return count == null ? 0 : count;
  }

  /** The change_log rows of a shopping item written at {@code instant}. */
  int itemLogRowsAt(String itemId, String instant) {
    Integer count =
        jdbc.queryForObject(
            "select count(*) from change_log where entity = 'shopping_item'"
                + " and entity_id = ?::uuid and at = ?",
            Integer.class,
            itemId,
            Timestamp.from(Instant.parse(instant)));
    return count == null ? 0 : count;
  }
}
