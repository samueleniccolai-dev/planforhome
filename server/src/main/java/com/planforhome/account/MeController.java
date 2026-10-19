package com.planforhome.account;

import com.planforhome.account.AccountRepository.Profile;
import com.planforhome.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MeController {

  public record PasswordBody(String currentPassword, String newPassword) {}

  private final AccountRepository accounts;
  private final LoginService login;

  public MeController(AccountRepository accounts, LoginService login) {
    this.accounts = accounts;
    this.login = login;
  }

  @GetMapping("/api/me")
  public Profile me(@AuthenticationPrincipal AuthUser user) {
    return accounts.profile(user.personId()).orElseThrow(ApiException::notFound);
  }

  @PutMapping("/api/me/password")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void changePassword(
      @AuthenticationPrincipal AuthUser user, @RequestBody PasswordBody body) {
    login.changePassword(user.personId(), body.currentPassword(), body.newPassword());
  }
}
