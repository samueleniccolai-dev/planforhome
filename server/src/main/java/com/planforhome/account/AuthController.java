package com.planforhome.account;

import com.planforhome.account.LoginService.LoginResult;
import com.planforhome.account.RegistrationService.Result;
import com.planforhome.family.FamilyRepository.FamilyView;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
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

  public record LoginBody(String email, String password) {}

  public record Registered(UUID personId, List<FamilyView> families) {}

  public record LoggedIn(String token, Instant expiresAt, UUID personId) {}

  private final RegistrationService registration;
  private final LoginService login;

  public AuthController(RegistrationService registration, LoginService login) {
    this.registration = registration;
    this.login = login;
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
  public LoggedIn login(@RequestBody LoginBody body) {
    LoginResult result = login.login(body.email(), body.password());
    return new LoggedIn(result.token(), result.expiresAt(), result.personId());
  }

  @PostMapping("/logout")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void logout(@AuthenticationPrincipal AuthUser user) {
    login.logout(user);
  }
}
