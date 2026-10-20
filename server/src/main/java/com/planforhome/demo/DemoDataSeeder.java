package com.planforhome.demo;

import com.planforhome.account.AccountRepository;
import com.planforhome.account.AccountService;
import com.planforhome.common.UuidV7;
import com.planforhome.family.FamilyRepository;
import java.time.Clock;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The invented families of SPEC Appendix A. Runs at start-up only if {@code DEMO_PASSWORD} is not
 * empty, in one transaction (all or nothing), and does nothing if the demo already exists.
 */
@Component
public class DemoDataSeeder implements ApplicationRunner {

  private record Member(String name, String role, String referent, boolean account) {}

  private static Member manager(String name) {
    return new Member(name, "MANAGER", null, true);
  }

  private static Member member(String name) {
    return new Member(name, "MEMBER", null, true);
  }

  private static Member resource(String name, String referent) {
    return new Member(name, "MEMBER", referent, false);
  }

  private static final Map<String, List<Member>> FAMILIES =
      Map.of(
          "Famiglia Principale",
          List.of(
              manager("Marco"),
              manager("Giulia"),
              resource("Leo", "Giulia"),
              resource("Sofia", "Marco")),
          "Famiglia Mamma",
          List.of(
              manager("Anna"),
              manager("Pietro"),
              member("Giulia"),
              member("Luca"),
              member("Paolo"),
              member("Davide")),
          "Famiglia Babbo",
          List.of(manager("Rosa"), manager("Franco"), member("Marco")));

  private final String password;
  private final AccountService accountService;
  private final AccountRepository accounts;
  private final FamilyRepository families;
  private final PasswordEncoder encoder;
  private final TransactionTemplate tx;
  private final Clock clock;

  public DemoDataSeeder(
      @Value("${planforhome.demo.password:}") String password,
      AccountService accountService,
      AccountRepository accounts,
      FamilyRepository families,
      PasswordEncoder encoder,
      TransactionTemplate tx,
      Clock clock) {
    this.password = password;
    this.accountService = accountService;
    this.accounts = accounts;
    this.families = families;
    this.encoder = encoder;
    this.tx = tx;
    this.clock = clock;
  }

  @Override
  public void run(ApplicationArguments args) {
    if (password == null || password.isBlank()) {
      return;
    }
    tx.executeWithoutResult(status -> seed());
  }

  void seed() {
    if (accounts.emailExists(email("Marco"))) {
      return;
    }
    String hash = encoder.encode(password);
    Map<String, UUID> people = new HashMap<>();
    for (String name : List.of("Marco", "Giulia", "Anna", "Pietro", "Luca", "Paolo", "Davide")) {
      people.put(name, accountService.createPersonWithAccount(email(name), hash, name, "it"));
    }
    for (String name : List.of("Rosa", "Franco")) {
      people.put(name, accountService.createPersonWithAccount(email(name), hash, name, "it"));
    }
    for (String name : List.of("Leo", "Sofia")) {
      UUID id = UuidV7.next(clock);
      accounts.insertPerson(id, name, "it", clock.instant());
      people.put(name, id);
    }
    FAMILIES.forEach(
        (familyName, members) -> {
          UUID familyId = UuidV7.next(clock);
          families.insertFamily(familyId, familyName, clock.instant());
          // Referents first: a resource points to a member row of the same family.
          for (Member m : members) {
            if (m.referent() == null) {
              families.insertMembership(familyId, people.get(m.name()), m.role(), null);
            }
          }
          for (Member m : members) {
            if (m.referent() != null) {
              families.insertMembership(
                  familyId, people.get(m.name()), m.role(), people.get(m.referent()));
            }
          }
        });
  }

  private static String email(String name) {
    return name.toLowerCase(java.util.Locale.ROOT) + "@example.com";
  }
}
