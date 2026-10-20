package com.planforhome.account;

import com.planforhome.account.LoginService.LoginResult;
import com.planforhome.account.RegistrationService.Result;
import com.planforhome.family.FamilyRepository.FamilyView;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  public record RegisterBody(
      String email,
      String password,
      String displayName,
      String locale,
      String familyName,
      String inviteCode) {}

  public record LoginBody(String email, String password, String client) {}

  public record Registered(UUID personId, List<FamilyView> families) {}

  public record LoggedIn(String token, Instant expiresAt, UUID personId) {}

  public record WebLoggedIn(Instant expiresAt, UUID personId) {}

  public record Renewed(Instant expiresAt) {}

  private final RegistrationService registration;
  private final LoginService login;
  private final Clock clock;

  public AuthController(RegistrationService registration, LoginService login, Clock clock) {
    this.registration = registration;
    this.login = login;
    this.clock = clock;
  }

  @PostMapping("/register")
  @ResponseStatus(HttpStatus.CREATED)
  public Registered register(@RequestBody RegisterBody body, HttpServletRequest http) {
    Result result =
        registration.register(
            new RegistrationService.Request(
                body.email(),
                body.password(),
                body.displayName(),
                body.locale(),
                body.familyName(),
                body.inviteCode()),
            http.getRemoteAddr());
    return new Registered(result.personId(), result.families());
  }

  @PostMapping("/login")
  public ResponseEntity<?> login(@RequestBody LoginBody body) {
    LoginResult result = login.login(body.email(), body.password());
    if ("web".equals(body.client())) {
      return ResponseEntity.ok()
          .headers(WebSession.cookies(result.token(), remaining(result.expiresAt())))
          .body(new WebLoggedIn(result.expiresAt(), result.personId()));
    }
    return ResponseEntity.ok(new LoggedIn(result.token(), result.expiresAt(), result.personId()));
  }

  @PostMapping("/refresh")
  public ResponseEntity<Renewed> refresh(
      @AuthenticationPrincipal AuthUser user, HttpServletRequest http) {
    Instant expiresAt = login.refresh(user);
    ResponseEntity.BodyBuilder response = ResponseEntity.ok();
    if (http.getAttribute(WebSession.TOKEN_ATTRIBUTE) instanceof String value) {
      response.headers(WebSession.cookies(value, remaining(expiresAt)));
    }
    return response.body(new Renewed(expiresAt));
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(
      @AuthenticationPrincipal AuthUser user, HttpServletRequest http) {
    login.logout(user);
    ResponseEntity.BodyBuilder response = ResponseEntity.status(HttpStatus.NO_CONTENT);
    if (http.getAttribute(WebSession.TOKEN_ATTRIBUTE) != null) {
      response.headers(WebSession.cleared());
    }
    return response.build();
  }

  private Duration remaining(Instant expiresAt) {
    return Duration.between(clock.instant(), expiresAt);
  }
}
