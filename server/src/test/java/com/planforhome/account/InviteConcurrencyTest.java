package com.planforhome.account;

import static org.assertj.core.api.Assertions.assertThat;

import com.planforhome.account.RegistrationService.Request;
import com.planforhome.common.ApiException;
import com.planforhome.family.FamilyRepository;
import com.planforhome.family.FamilyService;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest
@Testcontainers
class InviteConcurrencyTest {

  @Container @ServiceConnection
  static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18");

  @Autowired RegistrationService registration;
  @Autowired FamilyService familyService;
  @Autowired FamilyRepository families;
  @Autowired JdbcClient jdbc;

  @Test
  void twoRegistrationsWithTheSameCodeAtTheSameTimeLetOnlyOneIn() throws Exception {
    Request founder =
        new Request(
            "fondatore@example.com", "Lanterna-Blu-42", "Fondatore", "it", "Famiglia C", null);
    UUID personId = registration.register(founder, "10.0.0.1").personId();
    UUID familyId = families.familiesOf(personId).get(0).id();
    String code = familyService.createInvite(personId, familyId).code();

    int threads = 2;
    CountDownLatch go = new CountDownLatch(1);
    ExecutorService pool = Executors.newFixedThreadPool(threads);
    List<Future<Integer>> results = new ArrayList<>();
    for (int i = 0; i < threads; i++) {
      String email = "concorrente." + i + "@example.com";
      results.add(
          pool.submit(
              () -> {
                go.await();
                try {
                  registration.register(
                      new Request(email, "Lanterna-Blu-42", "Persona", "it", null, code),
                      "10.0.0." + (10 + email.length()));
                  return 201;
                } catch (ApiException e) {
                  return e.status().value();
                }
              }));
    }
    go.countDown();
    List<Integer> statuses = new ArrayList<>();
    for (Future<Integer> result : results) {
      statuses.add(result.get());
    }
    pool.shutdown();

    assertThat(statuses).containsExactlyInAnyOrder(201, 400);
    Long accounts =
        jdbc.sql("select count(*) from user_account where email like 'concorrente.%'")
            .query(Long.class)
            .single();
    assertThat(accounts).as("the loser left no account behind").isEqualTo(1);
  }
}
