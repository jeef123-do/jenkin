FROM eclipse-temurin:21-jdk-jammy
WORKDIR /opt/healthylife
COPY target/jenkins-java-maven-demo-1.0.0.jar application.jar
COPY scripts/SmokeCheck.java SmokeCheck.java
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "application.jar", "--server.address=0.0.0.0", "--server.port=8080"]
