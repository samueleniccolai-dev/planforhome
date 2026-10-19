# Copies the jar built by `./mvnw package` into a JRE image; it builds nothing itself.
# eclipse-temurin:25-jre, pinned by digest (resolved 2026-10-19 via mirror.gcr.io, same manifest list as Docker Hub).
FROM eclipse-temurin@sha256:dbb43d81099eec91e0800226ed2296d03146ee7857165b95112372ad0d67e87f

ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA}

WORKDIR /app
COPY target/planforhome-server.jar app.jar

USER 1000:1000
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
