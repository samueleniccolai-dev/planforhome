package com.planforhome.common;

import org.springframework.http.HttpStatus;

/** An expected refusal: the status and the code of the JSON body {@code {"error": code}}. */
public class ApiException extends RuntimeException {

  private final HttpStatus status;
  private final String code;
  private final long retryAfterSeconds;

  public ApiException(HttpStatus status, String code) {
    this(status, code, 0);
  }

  public ApiException(HttpStatus status, String code, long retryAfterSeconds) {
    super(code, null, false, false);
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  public HttpStatus status() {
    return status;
  }

  public String code() {
    return code;
  }

  public long retryAfterSeconds() {
    return retryAfterSeconds;
  }

  public static ApiException badRequest(String code) {
    return new ApiException(HttpStatus.BAD_REQUEST, code);
  }

  public static ApiException notFound() {
    return new ApiException(HttpStatus.NOT_FOUND, "not_found");
  }

  public static ApiException tooManyAttempts(long retryAfterSeconds) {
    return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "too_many_attempts", retryAfterSeconds);
  }
}
