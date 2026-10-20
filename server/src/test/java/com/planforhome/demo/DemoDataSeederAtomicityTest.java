package com.planforhome.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.AdditionalAnswers.delegatesTo;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

import com.planforhome.account.AccountRepository;
import com.planforhome.account.AccountService;
import com.planforhome.family.FamilyRepository;
import java.time.Clock;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest
@Testcontainers
class DemoDataSeederAtomicityTest {

  @Container @ServiceConnection
  static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18");

  @Autowired AccountService accountService;
  @Autowired AccountRepository accounts;
  @Autowired FamilyRepository families;
  @Autowired PasswordEncoder encoder;
  @Autowired TransactionTemplate tx;
  @Autowired Clock clock;
  @Autowired JdbcClient jdbc;
  @Autowired com.planforhome.task.TaskRepository tasks;

  @Test
  void aSeederThatFailsHalfWayLeavesNoData() {
    FamilyRepository failing = mock(FamilyRepository.class, delegatesTo(families));
    // First membership succeeds, the second one fails: people and a family exist by then.
    AtomicInteger calls = new AtomicInteger();
    doAnswer(
            inv -> {
              if (calls.incrementAndGet() > 1) {
                throw new IllegalStateException("boom");
              }
              families.insertMembership(
                  inv.getArgument(0), inv.getArgument(1), inv.getArgument(2), inv.getArgument(3));
              return null;
            })
        .when(failing)
        .insertMembership(any(), any(), any(), any());
    DemoDataSeeder seeder =
        new DemoDataSeeder(
            "Lanterna-Blu-42", accountService, accounts, failing, tasks, encoder, tx, clock);

    assertThatThrownBy(() -> seeder.run(new DefaultApplicationArguments()))
        .hasMessageContaining("boom");

    assertThat(jdbc.sql("select count(*) from person").query(Long.class).single()).isZero();
    assertThat(jdbc.sql("select count(*) from family").query(Long.class).single()).isZero();
  }
}
