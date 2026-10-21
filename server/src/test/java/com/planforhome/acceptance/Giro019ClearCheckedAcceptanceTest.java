package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 019, T8 part 2 (server): «Remove the checked items» only for the creator of the list, a
 * manager of the family or the assignee (contestation 018-a). The others get {@code 403 forbidden}
 * and nothing changes. A struck item stays, struck, even when it was checked before. Same
 * application context as rounds 003 to 018.
 */
class Giro019ClearCheckedAcceptanceTest extends Giro019AcceptanceSupport {

  @Test
  void davideIsRefusedAndNothingChanges() throws Exception {
    Sabato s = sabato();
    Families f = s.f();
    checkOk(f.luca().token(), f.mamma(), s.list(), s.uova());
    checkOk(f.luca().token(), f.mamma(), s.list(), s.mele());
    List<Map<String, Object>> before = items(f.anna().token(), f.mamma(), s.list());
    int logRows = shoppingLogRows();

    assertError(clearChecked(f.davide().token(), f.mamma(), s.list()), 403, "forbidden");
    assertError(clearChecked(f.giulia().token(), f.mamma(), s.list()), 403, "forbidden");

    assertThat(items(f.anna().token(), f.mamma(), s.list())).isEqualTo(before);
    assertThat(shoppingLogRows()).isEqualTo(logRows);
  }

  @Test
  void theCreatorThenAManagerThenTheAssigneeClearTheChecked() throws Exception {
    Sabato s = sabato();
    Families f = s.f();
    checkOk(f.davide().token(), f.mamma(), s.list(), s.uova());
    checkOk(f.davide().token(), f.mamma(), s.list(), s.mele());
    assertError(clearChecked(f.davide().token(), f.mamma(), s.list()), 403, "forbidden");
    assertOk(clearChecked(f.luca().token(), f.mamma(), s.list()));
    assertThat(texts(items(f.anna().token(), f.mamma(), s.list())))
        .containsExactly("Latte", "Pane");

    checkOk(f.davide().token(), f.mamma(), s.list(), s.pane());
    assertOk(clearChecked(f.anna().token(), f.mamma(), s.list()));
    assertThat(texts(items(f.anna().token(), f.mamma(), s.list()))).containsExactly("Latte");

    assertOk(setAssignee(f.anna().token(), f.mamma(), s.list(), f.paolo().personId()));
    checkOk(f.davide().token(), f.mamma(), s.list(), s.latte());
    assertOk(clearChecked(f.paolo().token(), f.mamma(), s.list()));
    assertThat(items(f.anna().token(), f.mamma(), s.list())).isEmpty();
    assertThat(storedItem(s.latte()).get("removed_by")).isEqualTo(f.paolo().personId());
  }

  @Test
  void aCheckedItemStruckLaterStaysStruckAfterTheClear() throws Exception {
    Sabato s = sabato();
    Families f = s.f();
    checkOk(f.luca().token(), f.mamma(), s.list(), s.uova());
    checkOk(f.luca().token(), f.mamma(), s.list(), s.mele());
    assertStruck(remove(f.davide().token(), f.mamma(), s.list(), s.uova()), f.davide());

    assertOk(clearChecked(f.luca().token(), f.mamma(), s.list()));

    List<Map<String, Object>> items = items(f.anna().token(), f.mamma(), s.list());
    assertThat(texts(items)).containsExactly("Latte", "Pane", "Uova");
    assertThat(removedBy(item(items, s.uova()))).isEqualTo(f.davide().personId());
    assertThat(storedItem(s.uova()).get("deleted_at")).isNull();
    assertThat(storedItem(s.mele()).get("removed_by")).isEqualTo(f.luca().personId());
  }
}
