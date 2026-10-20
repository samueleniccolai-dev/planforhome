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
}
