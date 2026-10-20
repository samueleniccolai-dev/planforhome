package com.planforhome.family;

import static org.assertj.core.api.Assertions.assertThat;

import com.planforhome.account.RegistrationService;
import com.planforhome.account.RegistrationService.Request;
import com.planforhome.common.ApiException;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** A person who creates a family while the last family removes her must not end up disabled. */
@SpringBootTest
@Testcontainers
class FamilyCreateConcurrencyTest {

  @Container @ServiceConnection
  static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18");

  @Autowired RegistrationService registration;
  @Autowired FamilyService familyService;
  @Autowired MembershipService membership;
  @Autowired FamilyRepository families;
  @Autowired JdbcClient jdbc;

  @Test
  void aCreatedFamilyNeverLeavesTheCreatorDisabled() throws Exception {
    UUID irene =
        registration
            .register(
                new Request(
                    "irene.cc@example.com", "Lanterna-Blu-42", "Irene", "it", "Faggio CC", null),
                "10.1.0.1")
            .personId();
    UUID faggio = families.familiesOf(irene).get(0).id();
    ExecutorService pool = Executors.newFixedThreadPool(2);
    try {
      for (int round = 0; round < 150; round++) {
        String code = familyService.createInvite(irene, faggio).code();
        UUID ettore =
            registration
                .register(
                    new Request(
                        "ettore." + round + ".cc@example.com",
                        "Lanterna-Blu-42",
                        "Ettore",
                        "it",
                        null,
                        code),
                    "10.1." + (1 + round / 250) + "." + (round % 250 + 1))
                .personId();
        CountDownLatch go = new CountDownLatch(1);
        Future<Integer> create =
            pool.submit(
                () -> {
                  go.await();
                  try {
                    familyService.create(ettore, null, "Nuova", null);
                    return 201;
                  } catch (ApiException e) {
                    return e.status().value();
                  }
                });
        Future<Integer> remove =
            pool.submit(
                () -> {
                  go.await();
                  try {
                    membership.remove(irene, faggio, ettore);
                    return 204;
                  } catch (ApiException e) {
                    return e.status().value();
                  }
                });
        go.countDown();
        int created = create.get(60, TimeUnit.SECONDS);
        remove.get(60, TimeUnit.SECONDS);
        boolean disabled =
            jdbc.sql("select disabled_at is not null from user_account where person_id = ?")
                .param(ettore)
                .query(Boolean.class)
                .single();
        if (created == 201) {
          assertThat(disabled).as("round " + round + ": 201 means the account lives").isFalse();
        }
        int memberships =
            jdbc.sql("select count(*) from membership where person_id = ?")
                .param(ettore)
                .query(Integer.class)
                .single();
        if (!disabled) {
          assertThat(memberships)
              .as("round " + round + ": an active account has a family")
              .isPositive();
        }
      }
    } finally {
      pool.shutdownNow();
    }
  }
}
