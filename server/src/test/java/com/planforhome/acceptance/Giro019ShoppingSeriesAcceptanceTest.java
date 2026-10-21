package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Round 019, T8 part 2 (server): a recurring shopping list after contestation 018-a. The next
 * occurrence gets the alive unchecked items only: not the checked ones, not the struck ones; every
 * copy keeps {@code createdBy} of its origin and has no {@code removedBy}. Context and clock of its
 * own (as in round 018): the clock is set before the first due.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "DEMO_PASSWORD=" + Giro003AcceptanceSupport.DEMO_PASSWORD,
      "planforhome.acceptance.context=giro019-shopping-series"
    })
@Import(AcceptanceClock.Config.class)
class Giro019ShoppingSeriesAcceptanceTest extends Giro019AcceptanceSupport {

  /** Saturday 1 February 2031. */
  static final String FIRST_SATURDAY = "2031-02-01";

  @Test
  void theNextSaturdayGetsPastaAndZuccheroWithTheirAuthors() throws Exception {
    at("2031-01-20T08:00:00Z");
    Families f = families();
    String m = f.mamma();
    String list = weeklyListOk(f.luca().token(), m, SETTIMANALE, FIRST_SATURDAY);
    String pasta = addOk(f.luca().token(), m, list, "Pasta");
    String riso = addOk(f.davide().token(), m, list, "Riso");
    String caffe = addOk(f.davide().token(), m, list, "Caffè");
    String zucchero = addOk(f.paolo().token(), m, list, "Zucchero");

    assertStruck(remove(f.davide().token(), m, list, caffe), f.davide());
    checkOk(f.luca().token(), m, list, riso);
    assertOk(done(f.anna().token(), m, list));

    Map<String, Object> next = nextOf(f.anna().token(), m, list, list);
    assertThat(next).containsEntry("due", "2031-02-08");
    List<Map<String, Object>> copied = items(f.paolo().token(), m, (String) next.get("id"));
    assertThat(texts(copied)).containsExactly("Pasta", "Zucchero");
    assertThat(checks(copied)).containsOnly(false);
    assertThat(createdBy(copied.get(0))).isEqualTo(f.luca().personId());
    assertThat(createdBy(copied.get(1))).isEqualTo(f.paolo().personId());
    assertThat(removers(copied)).containsOnlyNulls();
    assertThat(copied).extracting(i -> i.get("id")).doesNotContain(pasta, zucchero);

    List<Map<String, Object>> closed = items(f.anna().token(), m, list);
    assertThat(texts(closed)).containsExactly("Pasta", "Riso", "Caffè", "Zucchero");
    assertThat(removedBy(item(closed, caffe))).isEqualTo(f.davide().personId());
  }
}
