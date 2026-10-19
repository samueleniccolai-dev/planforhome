package com.planforhome.account;

import java.util.UUID;

/** The authenticated caller of a request: the person and the session of the bearer token. */
public record AuthUser(UUID personId, UUID sessionId) {}
