# Caddy with the Expo web bundle in /srv. Build context: app/dist.
# caddy:2, pinned by digest (resolved 2026-10-19 via mirror.gcr.io, same manifest list as Docker Hub).
FROM caddy@sha256:685ae3d7c34d9b5f8caeddc5d14051db7bbd88ff1f5a2fa0c16bd8ca328fb7af
COPY . /srv
