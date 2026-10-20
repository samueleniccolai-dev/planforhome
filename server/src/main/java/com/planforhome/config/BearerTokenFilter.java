package com.planforhome.config;

import com.planforhome.account.AuthUser;
import com.planforhome.account.LoginService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** Authenticates {@code Authorization: Bearer <token>} against the live sessions. */
public class BearerTokenFilter extends OncePerRequestFilter {

  private static final String PREFIX = "Bearer ";

  private final LoginService login;

  public BearerTokenFilter(LoginService login) {
    this.login = login;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String header = request.getHeader("Authorization");
    if (header != null && header.startsWith(PREFIX)) {
      String token = header.substring(PREFIX.length()).trim();
      if (!token.isEmpty()) {
        login
            .authenticate(token)
            .ifPresent(user -> SecurityContextHolder.getContext().setAuthentication(auth(user)));
      }
    }
    chain.doFilter(request, response);
  }

  private static UsernamePasswordAuthenticationToken auth(AuthUser user) {
    return UsernamePasswordAuthenticationToken.authenticated(user, null, List.of());
  }
}
