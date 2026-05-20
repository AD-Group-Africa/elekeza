# backend/Dockerfile
# IMPORTANT: build.gradle.kts targets JVM 17, not 21
# Using JDK 17 consistently prevents subtle runtime mismatches

FROM gradle:8.5-jdk17 AS build
COPY --chown=gradle:gradle . /home/gradle/src
WORKDIR /home/gradle/src
# -x test skips tests in CI — run them separately in your pipeline
RUN gradle build --no-daemon -x test

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY --from=build /home/gradle/src/build/libs/*.jar app.jar

# Non-root user for security
RUN addgroup --system elekeza && adduser --system --ingroup elekeza elekeza
USER elekeza

# JVM tuning for Render free tier (512MB RAM)
ENV JAVA_OPTS="-Xms128m -Xmx400m -XX:+UseContainerSupport -XX:MaxRAMPercentage=75"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]