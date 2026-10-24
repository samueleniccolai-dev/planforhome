package com.planforhome.push;

import com.planforhome.account.AuthUser;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DeviceController {

  public record DeviceBody(String token, String platform) {}

  private final PushService push;

  public DeviceController(PushService push) {
    this.push = push;
  }

  @PostMapping("/api/me/devices")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void register(@AuthenticationPrincipal AuthUser user, @RequestBody DeviceBody body) {
    push.register(user.personId(), user.sessionId(), body.token(), body.platform());
  }
}
