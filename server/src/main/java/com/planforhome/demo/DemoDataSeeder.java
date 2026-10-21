package com.planforhome.demo;

import com.planforhome.account.AccountRepository;
import com.planforhome.account.AccountService;
import com.planforhome.common.UuidV7;
import com.planforhome.family.FamilyRepository;
import com.planforhome.shopping.ShoppingRepository;
import com.planforhome.task.TaskRepository;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

  private static final Logger LOG = LoggerFactory.getLogger(DemoDataSeeder.class);

  /**
   * A demo task: created by a demo person in one of their families; no due date if days < 0. With
   * {@code weekly} it is a weekly recurring task of its creator, due the first such day from today.
   */
  private record DemoTask(
      String title,
      String creator,
      String family,
      String criticality,
      int dueInDays,
      DayOfWeek weekly,
      List<String> items) {

    DemoTask(String title, String creator, String family, String criticality, int dueInDays) {
      this(title, creator, family, criticality, dueInDays, null, List.of());
    }
  }

  private static final List<DemoTask> TASKS =
      List.of(
          new DemoTask("Prenotare il pranzo di Natale", "Anna", "Famiglia Mamma", "HIGH", -1),
          new DemoTask(
              "Rinnovare la carta d'identità di Franco", "Rosa", "Famiglia Babbo", "NORMAL", 10),
          new DemoTask(
              "Mettere fuori la carta",
              "Marco",
              "Famiglia Principale",
              "NORMAL",
              0,
              DayOfWeek.TUESDAY,
              List.of()),
          new DemoTask(
              "Lista della spesa",
              "Giulia",
              "Famiglia Principale",
              "NORMAL",
              -1,
              null,
              List.of("Latte", "Pane", "Mele")));

  private final String password;
  private final AccountService accountService;
  private final AccountRepository accounts;
  private final FamilyRepository families;
  private final TaskRepository tasks;
  private final ShoppingRepository shopping;
  private final PasswordEncoder encoder;
  private final TransactionTemplate tx;
  private final Clock clock;

  public DemoDataSeeder(
      @Value("${planforhome.demo.password:}") String password,
      AccountService accountService,
      AccountRepository accounts,
      FamilyRepository families,
      TaskRepository tasks,
      ShoppingRepository shopping,
      PasswordEncoder encoder,
      TransactionTemplate tx,
      Clock clock) {
    this.password = password;
    this.accountService = accountService;
    this.accounts = accounts;
    this.families = families;
    this.tasks = tasks;
    this.shopping = shopping;
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
    if (!accounts.emailExists(email("Marco"))) {
      seedPeople();
    }
    seedTasks();
  }

  /** Tasks are checked on every start: one per title in its family, never an error. */
  private void seedTasks() {
    for (int i = 0; i < TASKS.size(); i++) {
      DemoTask t = TASKS.get(i);
      var creator = accounts.credentials(email(t.creator())).map(c -> c.personId());
      if (creator.isEmpty()) {
        LOG.warn("demo task {} skipped: person not found", i + 1);
        continue;
      }
      var family =
          families.familiesOf(creator.get()).stream()
              .filter(f -> f.name().equals(t.family()))
              .findFirst();
      if (family.isEmpty()) {
        LOG.warn("demo task {} skipped: family not found", i + 1);
        continue;
      }
      UUID familyId = family.get().id();
      if (tasks.ofFamily(familyId).stream().anyMatch(r -> r.title().equals(t.title()))) {
        continue;
      }
      ZoneId zone = ZoneId.of(family.get().timeZone());
      boolean due = t.dueInDays() >= 0;
      var today = clock.instant().atZone(zone).toLocalDate();
      var day =
          t.weekly() != null
              ? today.with(TemporalAdjusters.nextOrSame(t.weekly()))
              : today.plusDays(t.dueInDays());
      var dueAt = due ? day.atStartOfDay(zone).toInstant() : null;
      UUID id = UuidV7.next(clock);
      tasks.insert(
          id,
          familyId,
          t.title(),
          null,
          due ? "DATE" : null,
          dueAt,
          t.criticality(),
          t.weekly() != null ? creator.get() : null,
          creator.get(),
          clock.instant(),
          t.weekly() != null ? "{\"type\":\"WEEKLY\",\"days\":[\"" + t.weekly() + "\"]}" : null,
          t.weekly() != null ? id : null,
          t.items().isEmpty() ? "NONE" : "SHOPPING_LIST");
      tasks.logChange(familyId, id, clock.instant());
      shopping.addItems(familyId, id, t.items(), creator.get(), clock.instant());
    }
  }

  private void seedPeople() {
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
