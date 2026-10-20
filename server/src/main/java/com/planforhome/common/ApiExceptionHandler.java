package com.planforhome.common;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiExceptionHandler {

  @ExceptionHandler(ApiException.class)
  public ResponseEntity<Map<String, String>> handle(ApiException e) {
    ResponseEntity.BodyBuilder response = ResponseEntity.status(e.status());
    if (e.retryAfterSeconds() > 0) {
      response.header("Retry-After", Long.toString(e.retryAfterSeconds()));
    }
    return response.body(Map.of("error", e.code()));
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<Map<String, String>> unreadable() {
    return ResponseEntity.badRequest().body(Map.of("error", "invalid_request"));
  }

  /** An id in the URL that is not a UUID names nothing: same answer as an unknown one. */
  @ExceptionHandler(MethodArgumentTypeMismatchException.class)
  public ResponseEntity<Map<String, String>> notAnId() {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "not_found"));
  }
}
