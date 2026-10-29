FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --chown=10001:10001 application.jar /app/application.jar
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/application.jar", "--server.address=0.0.0.0", "--server.port=8080"]
CMD []
