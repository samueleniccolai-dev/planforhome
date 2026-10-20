package com.planforhome.family;

import static com.planforhome.common.Time.db;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class FamilyRepository {

  public record FamilyView(UUID id, String name, String timeZone, String role) {}

  public record MemberView(
      UUID personId, String displayName, String role, boolean hasAccount, UUID referentPersonId) {}

  private final JdbcClient jdbc;

  public FamilyRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public void insertFamily(UUID id, String name, Instant now) {
    jdbc.sql("insert into family (id, name, created_at) values (?, ?, ?)")
        .params(id, name, db(now))
        .update();
  }

  public void insertMembership(UUID familyId, UUID personId, String role, UUID referentPersonId) {
    jdbc.sql(
            "insert into membership (family_id, person_id, role, referent_person_id)"
                + " values (?, ?, ?, ?)")
        .params(familyId, personId, role, referentPersonId)
        .update();
  }

  public List<FamilyView> familiesOf(UUID personId) {
    return jdbc.sql(
            "select f.id, f.name, f.time_zone, m.role from membership m"
                + " join family f on f.id = m.family_id where m.person_id = ? order by f.name")
        .params(personId)
        .query(
            (rs, i) ->
                new FamilyView(
                    rs.getObject("id", UUID.class),
                    rs.getString("name"),
                    rs.getString("time_zone"),
                    rs.getString("role")))
        .list();
  }

  public Optional<String> roleIn(UUID familyId, UUID personId) {
    return jdbc.sql("select role from membership where family_id = ? and person_id = ?")
        .params(familyId, personId)
        .query(String.class)
        .optional();
  }

  public List<MemberView> members(UUID familyId) {
    return jdbc.sql(
            "select p.id, p.display_name, m.role, m.referent_person_id,"
                + " (a.person_id is not null) as has_account from membership m"
                + " join person p on p.id = m.person_id"
                + " left join user_account a on a.person_id = m.person_id"
                + " where m.family_id = ? order by p.display_name, p.id")
        .params(familyId)
        .query(
            (rs, i) ->
                new MemberView(
                    rs.getObject("id", UUID.class),
                    rs.getString("display_name"),
                    rs.getString("role"),
                    rs.getBoolean("has_account"),
                    rs.getObject("referent_person_id", UUID.class)))
        .list();
  }

  public void insertInvite(
      String code, UUID familyId, UUID createdBy, Instant now, Instant expiresAt) {
    jdbc.sql(
            "insert into invite (code, family_id, created_by, created_at, expires_at)"
                + " values (?, ?, ?, ?, ?)")
        .params(code, familyId, createdBy, db(now), db(expiresAt))
        .update();
  }

  /**
   * Consumes a valid invite in one statement; empty if the code is unknown, used or expired (so two
   * concurrent uses of the same code cannot both win).
   */
  public Optional<UUID> consumeInvite(String code, UUID personId, Instant now) {
    return jdbc.sql(
            "update invite set used_by = ?, used_at = ?"
                + " where code = ? and used_at is null and expires_at > ? returning family_id")
        .params(personId, db(now), code, db(now))
        .query(UUID.class)
        .optional();
  }

  public void insertFamily(UUID id, String name, String timeZone, Instant now) {
    jdbc.sql("insert into family (id, name, time_zone, created_at) values (?, ?, ?, ?)")
        .params(id, name, timeZone, db(now))
        .update();
  }

  public Optional<FamilyView> familyView(UUID familyId, UUID personId) {
    return familiesOf(personId).stream().filter(f -> f.id().equals(familyId)).findFirst();
  }

  public Optional<MemberView> memberView(UUID familyId, UUID personId) {
    return members(familyId).stream().filter(m -> m.personId().equals(personId)).findFirst();
  }

  /** Row locks: the first step of every write on the memberships of a family or of a person. */
  public boolean lockFamily(UUID familyId) {
    return jdbc.sql("select id from family where id = ? for update")
        .params(familyId)
        .query(UUID.class)
        .optional()
        .isPresent();
  }

  public void lockPerson(UUID personId) {
    jdbc.sql("select id from person where id = ? for update").params(personId).query().listOfRows();
  }

  public boolean isDisabled(UUID personId) {
    return jdbc.sql(
                "select count(*) from user_account where person_id = ? and disabled_at is not null")
            .params(personId)
            .query(Long.class)
            .single()
        > 0;
  }

  /** True if the person is in the family and has an account (a resource has none). */
  public boolean isUserIn(UUID familyId, UUID personId) {
    return count(
            "select count(*) from membership m join user_account a on a.person_id = m.person_id"
                + " where m.family_id = ? and m.person_id = ?",
            familyId,
            personId)
        > 0;
  }

  public boolean personExists(UUID personId) {
    return count("select count(*) from person where id = ?", personId) > 0;
  }

  public long managerCount(UUID familyId) {
    return count(
        "select count(*) from membership where family_id = ? and role = 'MANAGER'", familyId);
  }

  public long membershipCount(UUID personId) {
    return count("select count(*) from membership where person_id = ?", personId);
  }

  public boolean isReferentIn(UUID familyId, UUID personId) {
    return count(
            "select count(*) from membership where family_id = ? and referent_person_id = ?",
            familyId,
            personId)
        > 0;
  }

  public void insertResource(UUID id, String displayName, UUID createdBy, Instant now) {
    jdbc.sql(
            "insert into person (id, display_name, locale, created_at)"
                + " select ?, ?, locale, ? from person where id = ?")
        .params(id, displayName, db(now), createdBy)
        .update();
  }

  public void updateRole(UUID familyId, UUID personId, String role) {
    jdbc.sql("update membership set role = ? where family_id = ? and person_id = ?")
        .params(role, familyId, personId)
        .update();
  }

  public void updateReferent(UUID familyId, UUID personId, UUID referentPersonId) {
    jdbc.sql("update membership set referent_person_id = ? where family_id = ? and person_id = ?")
        .params(referentPersonId, familyId, personId)
        .update();
  }

  public void deleteMembership(UUID familyId, UUID personId) {
    jdbc.sql("delete from membership where family_id = ? and person_id = ?")
        .params(familyId, personId)
        .update();
  }

  public void deletePerson(UUID personId) {
    jdbc.sql("delete from person where id = ?").params(personId).update();
  }

  /** Disabling is enough to end every session: {@code liveSession} filters on it. */
  public void disableAccount(UUID personId, Instant now) {
    jdbc.sql("update user_account set disabled_at = ? where person_id = ?")
        .params(db(now), personId)
        .update();
  }

  /** The family of an invite that is still good, without using it. */
  public Optional<UUID> openInviteFamily(String code, Instant now) {
    return jdbc.sql(
            "select family_id from invite where code = ? and used_at is null and expires_at > ?")
        .params(code, db(now))
        .query(UUID.class)
        .optional();
  }

  private long count(String sql, Object... params) {
    return jdbc.sql(sql).params(params).query(Long.class).single();
  }
}
