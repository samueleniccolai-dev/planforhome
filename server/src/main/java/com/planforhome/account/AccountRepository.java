package com.planforhome.account;

import static com.planforhome.common.Time.db;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class AccountRepository {

  public record Credentials(UUID personId, String passwordHash, boolean disabled) {}

  public record Profile(UUID personId, String email, String displayName, String locale) {}

  public record SessionRef(UUID sessionId, UUID personId) {}

  private final JdbcClient jdbc;

  public AccountRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public void insertPerson(UUID id, String displayName, String locale, Instant now) {
    jdbc.sql("insert into person (id, display_name, locale, created_at) values (?, ?, ?, ?)")
        .params(id, displayName, locale, db(now))
        .update();
  }

  public void insertAccount(UUID personId, String email, String passwordHash, Instant now) {
    jdbc.sql(
            "insert into user_account (person_id, email, password_hash, created_at)"
                + " values (?, ?, ?, ?)")
        .params(personId, email, passwordHash, db(now))
        .update();
  }

  public boolean emailExists(String email) {
    return jdbc.sql("select count(*) from user_account where email = ?")
            .params(email)
            .query(Long.class)
            .single()
        > 0;
  }

  public Optional<Credentials> credentials(String email) {
    return jdbc.sql(
            "select person_id, password_hash, (disabled_at is not null) as disabled"
                + " from user_account where email = ?")
        .params(email)
        .query(
            (rs, i) ->
                new Credentials(
                    rs.getObject("person_id", UUID.class),
                    rs.getString("password_hash"),
                    rs.getBoolean("disabled")))
        .optional();
  }

  public Optional<String> passwordHash(UUID personId) {
    return jdbc.sql("select password_hash from user_account where person_id = ?")
        .params(personId)
        .query(String.class)
        .optional();
  }

  public void updatePasswordHash(UUID personId, String passwordHash) {
    jdbc.sql("update user_account set password_hash = ? where person_id = ?")
        .params(passwordHash, personId)
        .update();
  }

  public Optional<Profile> profile(UUID personId) {
    return jdbc.sql(
            "select p.id, a.email, p.display_name, p.locale from person p"
                + " join user_account a on a.person_id = p.id where p.id = ?")
        .params(personId)
        .query(
            (rs, i) ->
                new Profile(
                    rs.getObject("id", UUID.class),
                    rs.getString("email"),
                    rs.getString("display_name"),
                    rs.getString("locale")))
        .optional();
  }

  public void insertSession(
      UUID id, String tokenHash, UUID personId, Instant now, Instant expiresAt) {
    jdbc.sql(
            "insert into auth_session (id, token_hash, person_id, created_at, expires_at)"
                + " values (?, ?, ?, ?, ?)")
        .params(id, tokenHash, personId, db(now), db(expiresAt))
        .update();
  }

  /** The live session of a token: not revoked, not expired, account not disabled. */
  public Optional<SessionRef> liveSession(String tokenHash, Instant now) {
    return jdbc.sql(
            "select s.id, s.person_id from auth_session s"
                + " join user_account a on a.person_id = s.person_id"
                + " where s.token_hash = ? and s.revoked_at is null and s.expires_at > ?"
                + " and a.disabled_at is null")
        .params(tokenHash, db(now))
        .query(
            (rs, i) ->
                new SessionRef(
                    rs.getObject("id", UUID.class), rs.getObject("person_id", UUID.class)))
        .optional();
  }

  public void revokeSession(UUID sessionId, Instant now) {
    jdbc.sql("update auth_session set revoked_at = ? where id = ? and revoked_at is null")
        .params(db(now), sessionId)
        .update();
  }
}
