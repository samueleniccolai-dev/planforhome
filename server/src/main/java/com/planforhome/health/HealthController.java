package com.planforhome.health;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

  public record Health(String status, String sha) {}

  private final String gitSha;

  public HealthController(@Value("${planforhome.git-sha}") String gitSha) {
    this.gitSha = gitSha;
  }

  @GetMapping(path = "/api/health", produces = MediaType.APPLICATION_JSON_VALUE)
  public Health health() {
    return new Health("UP", gitSha);
  }
}
