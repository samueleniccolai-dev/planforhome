package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 019, T8 part 2: the items of the demo list «Lista della spesa» (Appendix A, Famiglia
 * Principale, created by Giulia) say that Giulia added them, and nobody removed them. Same
 * application context as rounds 003 to 018: the seeder ran once at start-up; nothing here writes.
 */
class Giro019DemoShoppingAcceptanceTest extends Giro019AcceptanceSupport {

  static final String LIST = "Lista della spesa";

  @Test
  void theThreeDemoItemsWereAddedByGiulia() throws Exception {
    String giulia = demoToken("giulia");
    String principale = familyId(giulia, PRINCIPALE);
    List<Map<String, Object>> lists =
        tasks(giulia, principale).stream().filter(t -> LIST.equals(t.get("title"))).toList();
    assertThat(lists).as("tasks titled «" + LIST + "»").hasSize(1);

    List<Map<String, Object>> items =
        items(demoToken("marco"), principale, (String) lists.get(0).get("id"));
    assertThat(texts(items)).containsExactly("Latte", "Pane", "Mele");
    assertThat(items)
        .extracting(Giro019AcceptanceSupport::createdBy)
        .containsOnly(personIdOf(giulia));
    assertThat(removers(items)).containsOnlyNulls();
  }
}
