package com.planforhome.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.planforhome.account.RegistrationService.Request;
import com.planforhome.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest
@Testcontainers
class NulCharacterTest {

  @Container @ServiceConnection
  static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18");

  @Autowired RegistrationService registration;
  @Autowired LoginService login;

  @Test
  void registrationRefusesNulInEmailAndDisplayName() {
    Request badEmail =
        new Request("nul\0@example.com", "Lanterna-Blu-42", "Nome", "it", "Famiglia", null);
    assertThatThrownBy(() -> registration.register(badEmail, "10.1.0.1"))
        .isInstanceOfSatisfying(
            ApiException.class, e -> assertThat(e.getMessage()).contains("email_invalid"));
    Request badName =
        new Request("nul@example.com", "Lanterna-Blu-42", "No\0me", "it", "Famiglia", null);
    assertThatThrownBy(() -> registration.register(badName, "10.1.0.2"))
        .isInstanceOfSatisfying(
            ApiException.class, e -> assertThat(e.getMessage()).contains("display_name_invalid"));
  }

  @Test
  void loginWithNulInTheEmailIsInvalidCredentials() {
    assertThatThrownBy(() -> login.login("nul\0@example.com", "Lanterna-Blu-42"))
        .isInstanceOfSatisfying(
            ApiException.class, e -> assertThat(e.getMessage()).contains("invalid_credentials"));
  }
}
