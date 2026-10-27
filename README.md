# HealthyLife — BMI & Weight Planner

HealthyLife is a friendly, responsive wellness dashboard with a BMI calculator and a safety-first weight planner. The Spring Boot application serves both the REST API and a vanilla HTML/CSS/JavaScript frontend. Settings stay in browser `localStorage`; personal health values are sent only to this application on `localhost`, not to an external service.

## Features

- Dashboard with a BMI snapshot, current and target weight, distance-to-goal card, quick actions, and a general wellness tip.
- BMI calculator with input validation, adult screening categories, an optional Male/Female selection, a category-colored gauge, and clear limitations. Sex is optional and does not change general adult BMI categories.
- Weight planner with current/target BMI, signed weight difference, progress visualization, and a cautious illustrative timeline for appropriate weight-loss goals.
- Gentle warning for goals below the general adult BMI range and no encouragement to lose more when current BMI is below that range.
- Health tips for balanced meals, movement, rest/hydration, and sustainable habits.
- Responsive navigation, accessible labels, visible request/loading/error states, local settings, and a reset-to-demo action.
- REST API with Bean Validation and consistent JSON validation errors.
- Jenkins pipeline with a Java 21 agent, Maven Wrapper, test report publishing, JAR archiving, and a cleanly stopped HTTP smoke test.

## Technology stack

- Java 21, Spring Boot 3.4.5, Spring MVC, Bean Validation
- Maven, JUnit 5, Spring Boot Test, MockMvc
- HTML5, CSS3, vanilla JavaScript, Canvas charts (no Node.js build step or chart service)
- Jenkins Declarative Pipeline and Maven Wrapper (Maven 3.9.9)

## Folder structure

```text
.
├── Jenkinsfile
├── mvnw / mvnw.cmd
├── .mvn/wrapper/
├── pom.xml
├── scripts/
│   └── SmokeCheck.java
└── src/
    ├── main/
    │   ├── java/com/example/healthylife/
    │   │   ├── api/          # REST controllers, DTOs, error handling
    │   │   └── service/      # BMI categories and calculations
    │   └── resources/static/ # Browser app served by Spring Boot
    └── test/java/com/example/healthylife/
        ├── api/              # HTTP/API tests
        └── service/          # Calculation tests
```

## Prerequisites

- Java 21 JDK
- For local builds, Maven is optional; the Maven Wrapper downloads the pinned Maven distribution.
- For Jenkins, use an agent with Java 21 and network access to Maven Central. Maven and Docker do not need to be installed on that agent.

The Jenkins pipeline uses `agent any`; Java 21 must be available on the selected agent. The checked-in Maven Wrapper downloads Maven 3.9.9 when needed.

## Run locally in VS Code

1. Open this repository folder in VS Code and select a Java 21 JDK for the project.
2. In the integrated terminal, run:

   ```powershell
   .\mvnw.cmd -B spring-boot:run
   ```

3. Open [http://localhost:8080/](http://localhost:8080/). The dashboard starts with clearly marked example data. Update the planner fields to personalize the dashboard, or choose **Reset demo data** to restore the initial values.

You can also build and run the executable JAR:

```powershell
.\mvnw.cmd -B clean package
java -jar target/jenkins-java-maven-demo-1.0.0.jar
```

Open [http://localhost:8080/](http://localhost:8080/) after startup. Stop either local run with `Ctrl+C`.

## Build and test

```powershell
.\mvnw.cmd -B clean package
.\mvnw.cmd -B test
```

Maven writes JUnit XML results to `target/surefire-reports/`. The project has no database or network-dependent tests.

To demonstrate a deliberately failing Jenkins test, run:

```powershell
.\mvnw.cmd -B test -Ddemo.fail=true
```

That optional demonstration test is expected to fail. A normal `.\mvnw.cmd -B clean package` does not set the property and passes the suite.

## REST API

The frontend uses these same-origin endpoints:

### Health check

```http
GET /api/health
```

Example response:

```json
{"status":"UP"}
```

### Calculate BMI

```http
POST /api/bmi/calculate
Content-Type: application/json

{"heightCm":170,"weightKg":68}
```

Example response:

```json
{
  "bmi": 23.5,
  "category": "Normal range",
  "explanation": "Within the general adult BMI range of 18.5 to below 25.",
  "screeningMeasure": true
}
```

The calculation is `weightKg / (heightCm / 100)²`. General adult categories use the exact BMI value: below 18.5 (underweight), 18.5 to below 25 (normal range), 25 to below 30 (overweight), and 30 or above (obesity range). Display rounding does not affect classification.

Height must be 50–250 cm and weight 20–500 kg. Missing, malformed, or out-of-range values return HTTP 400 with a structured error, for example:

```json
{
  "timestamp": "2026-01-01T12:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Request validation failed.",
  "path": "/api/bmi/calculate",
  "details": {"heightCm": "Height must be at least 50 cm."}
}
```

### Create a weight plan

```http
POST /api/weight/plan
Content-Type: application/json

{"heightCm":170,"currentWeightKg":80,"targetWeightKg":70,"targetDate":"2027-03-01"}
```

`targetDate` is optional and is never treated as a promised deadline. The response includes current/target BMI, weight difference and direction, safety status, and (only for safe weight-loss goals) an illustrative 0.25–0.5 kg/week range. Actual progress varies. BMI is a screening measure, not a diagnosis; adult categories may not suit children or every population.

## Privacy and health information

Dashboard values are clearly identified as sample data. User-entered values are saved in this browser’s `localStorage` and sent only to this local Spring Boot app to calculate results. HealthyLife does not include analytics, an external API, or a database. Wellness content is general information, not a substitute for professional advice.
The optional Male/Female selection is saved in `localStorage` and is not sent to the BMI API because it is not needed for this general adult BMI formula.

## Jenkins: Pipeline script from SCM

1. Push this project to a GitHub repository with `pom.xml` and `Jenkinsfile` at its root.
2. Ensure the selected Jenkins agent has a Java 21 JDK on `PATH` and network access to Maven Central so Maven Wrapper can download Maven 3.9.9. No Docker installation or Docker Pipeline plugin is required.
3. In Jenkins, select **New Item** → **Pipeline**.
4. Under **Pipeline**, choose **Pipeline script from SCM**; select **Git**; enter the repository URL and credentials if it is private.
5. Set **Branch Specifier** to `*/main` and **Script Path** to `Jenkinsfile`, then save.
6. Select **Build Now** (or **Build with Parameters**). A successful run checks out the repository, builds, tests, packages the JAR, publishes JUnit results, runs the `/api/health` smoke test, and archives the executable JAR.

The Jenkinsfile explicitly checks out `scm`, so it works with a Pipeline configured as “Pipeline script from SCM.” The smoke-test process has an exit trap and is stopped even when the HTTP check fails.

### Demonstrate a successful and failing build

1. Run **Build with Parameters** with `SIMULATE_TEST_FAILURE` unchecked. All five stages should pass; check the JUnit results and the archived `jenkins-java-maven-demo-1.0.0.jar`.
2. Run **Build with Parameters** again with `SIMULATE_TEST_FAILURE` checked. The **Test** stage intentionally fails and Jenkins publishes the test report.
3. Uncheck the parameter and run again. The test suite and pipeline should pass.

## Push to GitHub

From the project root, after creating an empty GitHub repository:

```powershell
git add .
git commit -m "Build HealthyLife BMI and weight planner"
git branch -M main
git remote add origin https://github.com/<your-account>/<your-repository>.git
git push -u origin main
```

If `origin` is already configured, skip `git remote add origin`. For later changes, use `git add .`, `git commit -m "Describe your change"`, and `git push`.

## Troubleshooting

- **Maven or Java version mismatch locally:** run `.\mvnw.cmd -version` and verify Maven reports Java 21. Select a Java 21 JDK in VS Code.
- **Jenkins reports that Java 21 is missing:** configure a Java 21 JDK on the selected agent and ensure `java` is available on `PATH`.
- **Maven Wrapper cannot download Maven:** ensure the Jenkins agent can access Maven Central and its workspace permits downloading/extracting the Maven distribution.
- **Jenkins SCM checkout fails:** check the Git URL, private-repository credentials, `*/main`, and Script Path `Jenkinsfile`.
- **Port 8080 is already in use:** stop the other process or run the app with `.\mvnw.cmd -B spring-boot:run '-Dspring-boot.run.arguments=--server.port=8081'`, then open `http://localhost:8081/`.
- **The browser reports a connection error:** make sure the application is running and reload the page at `http://localhost:8080/`.
- **Local settings cannot be saved:** allow site storage in the browser; the app will show a message and continue to use entered values for the open page.
- **Smoke test fails in Jenkins:** inspect `healthylife-app.log` and the test stage output; the pipeline always attempts to stop the started Java process.
