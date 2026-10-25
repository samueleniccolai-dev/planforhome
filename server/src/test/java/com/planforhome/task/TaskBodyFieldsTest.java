package com.planforhome.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.planforhome.common.ApiException;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** A field of the wrong type is a bad request, never "absent" (it used to skip checks). */
class TaskBodyFieldsTest {

  private static final ObjectMapper JSON = new ObjectMapper();

  private static JsonNode body(String json) {
    return JSON.readTree(json);
  }

  @Test
  void stringVersionIsReadAsNumber() {
    assertThat(TaskService.version(body("{\"version\":\"1\"}").get("version"))).isEqualTo(1L);
    assertThat(TaskService.version(body("{\"version\":2}").get("version"))).isEqualTo(2L);
  }

  @Test
  void nonIntegerVersionIsRefused() {
    for (String v : new String[] {"\"x\"", "true", "1.5", "[]", "{}"}) {
      assertThatThrownBy(() -> TaskService.version(body("{\"version\":" + v + "}").get("version")))
          .as(v)
          .isInstanceOf(ApiException.class);
    }
  }

  @Test
  void numberInATextFieldIsRefused() {
    for (String f : new String[] {"title", "notes", "criticality"}) {
      assertThatThrownBy(() -> TaskService.text(body("{\"" + f + "\":5}"), f))
          .as(f)
          .isInstanceOf(ApiException.class);
    }
  }

  @Test
  void textAbsentOrNullIsNull() {
    assertThat(TaskService.text(body("{}"), "notes")).isNull();
    assertThat(TaskService.text(body("{\"notes\":null}"), "notes")).isNull();
    assertThat(TaskService.text(body("{\"notes\":\"a\"}"), "notes")).isEqualTo("a");
  }
}
