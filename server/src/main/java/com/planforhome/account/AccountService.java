package com.planforhome.account;

import com.planforhome.common.UuidV7;
import java.time.Clock;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** Creates people with an account; used by the registration and by the demo data. */
@Service
public class AccountService {

  private final AccountRepository accounts;
  private final Clock clock;

  public AccountService(AccountRepository accounts, Clock clock) {
    this.accounts = accounts;
    this.clock = clock;
  }

  public static String normalizeEmail(String email) {
    return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
  }

  /** Inserts the person and the account; a taken e-mail raises DuplicateKeyException. */
  public UUID createPersonWithAccount(
      String email, String passwordHash, String displayName, String locale) {
    UUID id = UuidV7.next(clock);
    accounts.insertPerson(id, displayName, locale, clock.instant());
    accounts.insertAccount(id, email, passwordHash, clock.instant());
    return id;
  }
}
