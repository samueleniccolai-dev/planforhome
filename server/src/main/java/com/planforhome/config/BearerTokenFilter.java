package com.planforhome.config;

import com.planforhome.account.AuthUser;
import com.planforhome.account.LoginService;
import com.planforhome.account.WebSession;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates a request against the live sessions. With an {@code Authorization} header only the
 * bearer value counts and the cookie is ignored; without it, the {@code pfh_session} cookie. A
 * request authenticated by the cookie must carry the matching {@code X-CSRF-Token} to change
 * anything (except on the public endpoints, which do not look at the session at all).
 */
public class BearerTokenFilter extends OncePerRequestFilter {

  private static final String PREFIX = "Bearer ";
  private static final Set<String> SAFE = Set.of("GET", "HEAD", "OPTIONS", "TRACE");

  private final LoginService login;

  public BearerTokenFilter(LoginService login) {
    this.login = login;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String header = request.getHeader("Authorization");
    if (header != null) {
      if (header.startsWith(PREFIX)) {
        String value = header.substring(PREFIX.length()).trim();
        if (!value.isEmpty()) {
          login.authenticate(value).ifPresent(BearerTokenFilter::authenticate);
        }
      }
    } else if (!isPublic(request)) {
      String value = cookie(request);
      Optional<AuthUser> user = value == null ? Optional.empty() : login.authenticate(value);
      if (user.isPresent()) {
        if (!SAFE.contains(request.getMethod())
            && !WebSession.csrfMatches(value, request.getHeader(WebSession.CSRF_HEADER))) {
          response.setStatus(HttpServletResponse.SC_FORBIDDEN);
          response.setContentType("application/json");
          response.getWriter().write("{\"error\":\"csrf_invalid\"}");
          return;
        }
        request.setAttribute(WebSession.TOKEN_ATTRIBUTE, value);
        authenticate(user.get());
      }
    }
    chain.doFilter(request, response);
  }

  private static boolean isPublic(HttpServletRequest request) {
    String path = request.getRequestURI();
    boolean post = "POST".equals(request.getMethod());
    return path.equals("/api/health")
        || (post && (path.equals("/api/auth/register") || path.equals("/api/auth/login")));
  }

  private static String cookie(HttpServletRequest request) {
    Cookie[] cookies = request.getCookies();
    if (cookies != null) {
      for (Cookie c : cookies) {
        if (WebSession.SESSION_COOKIE.equals(c.getName()) && !c.getValue().isEmpty()) {
          return c.getValue();
        }
      }
    }
    return null;
  }

  private static void authenticate(AuthUser user) {
    SecurityContextHolder.getContext()
        .setAuthentication(
            UsernamePasswordAuthenticationToken.authenticated(user, null, List.of()));
  }
}
