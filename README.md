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
- Jenkins CI/CD with dependency security scanning, a temporary test deployment, deployed-service health checks, JUnit publishing, and JAR/security-report archiving.

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
│   ├── SmokeCheck.java
│   ├── security-scan.sh
│   └── test-environment.sh
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
- For Jenkins, use a Linux agent with Java 21, `/proc`, POSIX `sh`, `nohup`, GNU `timeout`, `grep`, and `tr`. Network access to Maven Central and vulnerability feeds is required. Maven and Docker do not need to be installed on that agent.

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

1. Push the updated project to GitHub with `pom.xml` and `Jenkinsfile` at its root.
2. Ensure the agent meets the Linux prerequisites above. The inspected `jenkins` container has Java 21, Maven 3.9.9 and GNU `timeout`, but **neither Docker CLI nor a Docker socket**. Host Docker access does not imply Jenkins Docker access. No Docker Pipeline plugin or `agent { docker { ... } }` syntax is used.
3. Allow the Trivy release/database downloads described below. Jenkins needs Declarative Pipeline, Git, JUnit and Timestamper plugins. No scanner Jenkins plugin, Docker daemon or NVD credential is required.
4. Create a **Pipeline** job or edit the existing one. Choose **Pipeline script from SCM**, select **Git**, and use `https://github.com/jeef123-do/jenkin.git` with repository credentials if needed.
5. Set **Branch Specifier** to `*/main` and **Script Path** to `Jenkinsfile`, then save.
6. Select **Build Now** once to load updated parameter definitions, then use **Build with Parameters**.

### Stages and reports

| Stage | Purpose |
| --- | --- |
| Checkout | Explicit `checkout scm`, with automatic checkout disabled. |
| Build | Require Java 21, then Maven Wrapper `clean compile`. |
| Test | Run the suite, preserving `SIMULATE_TEST_FAILURE`. |
| Package | Package the already-tested application as an executable JAR. |
| Security Scan | Run pinned Trivy **0.76.1** against the packaged JAR, including nested dependencies. Fail on HIGH/CRITICAL findings or scanner errors before deployment. |
| Deploy to Test | Start that JAR on the agent's loopback interface and `TEST_PORT`; wait up to 60 seconds for successful Spring startup. |
| Smoke Test | Check that existing deployment's `/api/health`, requiring HTTP 200 and `"status":"UP"`; never start another instance. |

Post actions retain JUnit results and archive `target/*.jar`, available
`target/security/*` (HTML, JSON, text and package inventory), and `target/deployment/*.log`,
including reports produced before a failed security gate. An unavailable
database/service may prevent report generation; no report does **not** mean a
successful scan. Retention is 10 builds with artifacts for the latest 5. Builds
of the same job cannot overlap. CI/CD has a 60-minute overall timeout
and a 30-minute scan-stage timeout (the Trivy scan itself allows 20 minutes).
Standard Declarative behavior skips
dependent stages after a failure.

### Security scanner setup and policy

The Pipeline now uses **Trivy 0.76.1**, replacing Dependency-Check. The Maven
`security` profile, NVD credentials binding and `INITIALIZE_NVD_DATABASE` mode
are removed. Old parameters disappear after Jenkins loads the new Jenkinsfile.
An already-running NVD build is not changed or stopped; its database and Jenkins
credentials are left untouched. No API key is required for the new scanner.

The Linux agent needs `curl`, `sha256sum`, `tar`, `awk`, `grep`, `mktemp`, `wc`
and standard POSIX utilities, plus outbound HTTPS to GitHub release assets and
Trivy OCI database registries (defaults include `mirror.gcr.io` and `ghcr.io`).
The script downloads the pinned Linux x86_64/ARM64 release and validates its
SHA-256 against the versioned official release checksum list before extraction.
The checksum list is fetched over HTTPS from the same release; this protects
against corrupt downloads, not compromise of the upstream release itself.
No root installation, Docker socket or Jenkins scanner plugin is needed.

Tools and databases persist under `$HOME/.cache/healthylife-trivy`. On the
inspected `jenkins-backup` agent, HOME is `/var/jenkins_home`, already backed by
the existing volume. Other agents need their own persistent writable HOME/cache;
`agent any` does not guarantee one agent. Do not concurrently write the shared
cache from other jobs. Never delete caches or locks while a scanner is running.
Trivy downloads a prebuilt vulnerability DB and a separate Java identification
DB, rather than paging through the NVD API. The first download can still be large
or fail due to registry/network limits; faster startup is not guaranteed.

**Package now precedes Security Scan** intentionally: Trivy scans the exact
Spring Boot executable JAR, including nested runtime dependencies, before Deploy.
The script copies only that JAR into a staging directory and uses `trivy rootfs`
to enable binary/JAR analysis (filesystem source scanning does not enable the
same analyzers). No container image or actual operating-system root is scanned.
Test-only dependencies absent from that JAR are no longer covered, unlike the
previous Dependency-Check configuration. JUnit tests still run normally.
This is a runtime dependency scan, not source-code, secrets, container-image or
penetration testing. Identification/database coverage can have false positives
or negatives; the script refuses a scan that does not identify expected Spring
Boot packages, but this is not proof every dependency was recognized.

The gate uses Trivy's **HIGH/CRITICAL severity classifications**, not a direct
numeric CVSS 7.0 comparison: vendors/data sources may classify differently.
LOW/MEDIUM/UNKNOWN remain in the full reports; UNKNOWN findings require manual
review and do not block by this policy. Unfixed HIGH/CRITICAL findings also block.
No ignore file is used. Download/scan/report errors fail, and reports are
generated before the severity gate so a blocked build retains the findings.
The JSON-producing scan uses exit code 0 for findings only; the final
`trivy convert --severity HIGH,CRITICAL --exit-code 1` is the mandatory gate.
The scanner binary is pinned; vulnerability data changes over time. Existing
Spring Boot 3.4.5 dependencies may legitimately block deployment.

To run on a compatible Linux agent after packaging:

```sh
sh scripts/security-scan.sh
```

### Temporary test environment and Docker prerequisites

The working alternative for the inspected agent is a dedicated Java process
**inside the Jenkins agent/container**, not production and not a separate
Smoke Test instance. It binds to `http://127.0.0.1:18081` **inside that agent**.
Change `TEST_PORT` to another free port between 1024 and 65535 if necessary.
8080 and 50000 are rejected to protect Jenkins service ports. Host port 8081
was occupied during inspection, so the default is 18081. Different jobs must
choose different free ports.

The GNU `timeout` supervisor PID is recorded in `target/deployment/app.pid`.
Its arguments and the JVM carry a unique build marker. Re-deployment stops only
a process whose marker matches the current build. An occupied port fails
startup; it never terminates whoever owns that port. Post `cleanup` runs after
failure/abort as well as success and signals only the owned PID; the supervisor
forwards termination to the application. A 10-minute maximum deployment lifetime
plus a 10-second forced-stop grace bounds leftovers if Jenkins/agent connectivity
is lost. Normal cleanup waits up to 15 seconds and explicitly fails if the owned
process does not stop. No Jenkins container or persistent data is deleted.

The port is **not published on the Windows host**. During a live build, inspect
it from the host with:

```powershell
docker exec jenkins-backup curl --fail http://127.0.0.1:18081/api/health
```

The application stops responding after post cleanup. Review archived logs and
Smoke Test output after completion rather than expecting a persistent website.
The health check retries for up to 40 seconds and fails on HTTP errors or wrong
status. The owned process is checked before and after the health request.

For future Docker deployment, provision a **dedicated Docker-capable Linux
Jenkins agent** with Docker CLI, approved daemon access, a Java 21 application
image/build recipe, and networking allowing the agent to reach the published
test port. Host sockets are not automatically available inside Jenkins.
Docker socket access is effectively host-root authority and needs approval;
a remote daemon also requires an explicit reachable host address, not assumed
`localhost`. Then replace the deployment/cleanup script with container lifecycle
handling and verify the same deployed container. Installing only the Docker
Pipeline plugin is insufficient. Do not remove/recreate the existing `jenkins`
container, delete `jenkins_home`, grant broad daemon privileges, or run Docker
prune as part of this demo.

### Demonstrate a successful and failing build

1. Configure Trivy download/network prerequisites. Run **Build with
   Parameters**, `SIMULATE_TEST_FAILURE=false`, `TEST_PORT=18081`.
   Success requires tests **and a real
   security scan** to pass. If findings block the build, review the HTML report
   and remediate them first; do not bypass the gate.
2. Check all seven stages, JUnit results, archived JAR, HTML/JSON security reports,
   deployment log, and health-check success URL.
3. Run again with `SIMULATE_TEST_FAILURE=true`. **Test** intentionally fails,
   JUnit shows the assertion failure, and Security Scan, Package, Deploy to Test
   and Smoke Test are skipped. This demonstration needs no scanner execution
   because the failure occurs earlier.
4. Uncheck the parameter for subsequent normal runs.

### Validation and current limits

- Maven Wrapper `clean package`: verified, **15 tests passed**.
- `test -Ddemo.fail=true`: verified nonzero exit, **1 intentional failure**.
- Real deployment script inside the existing Jenkins container: startup and
  health response at port 18081 verified; repeat deployment, occupied-port
  rejection without killing the existing app, failing HTTP 404 health check,
  idempotent cleanup, interrupted-startup cleanup with a failing exit status,
  and a closed port after cleanup also verified.
- Trivy 0.76.1 release installation/checksum, vulnerability DB and Java DB
  downloads, and a real packaged-JAR scan were verified on `jenkins-backup`.
  Initial database downloads completed in approximately three minutes on that
  run (not a guarantee). The scanner identified 35 packages and reported 8
  CRITICAL, 25 HIGH, 28 MEDIUM and 12 LOW findings; these are report entries,
  not necessarily unique CVEs. The final gate correctly returned exit 1.
  HTML/JSON/text/inventory reports were generated. No deployment was attempted
  as part of this scanner validation and no passing security gate is claimed.
  A filtered nonblocking report fixture returned success; the real report and
  a missing report returned failure. Fix dependencies before demonstrating
  successful CI/CD; do not lower severity or ignore findings just to get green.
- Jenkinsfile Groovy syntax parsed successfully with the installed Jenkins
  Groovy version. The authenticated Declarative validator returned HTTP 403
  without credentials; **a full Jenkins Pipeline run has not been verified**.
  An authorized user can validate from PowerShell without putting a token on
  the command line (curl prompts for the API token as the password):

  ```powershell
  curl.exe --fail-with-body --user YOUR_JENKINS_USER -X POST -F "jenkinsfile=<Jenkinsfile" http://localhost:8080/pipeline-model-converter/validate
  ```

  Use a Jenkins **API token**, not an account password; password authentication
  may additionally require a CSRF crumb. A successful response says
  `Jenkinsfile successfully validated`. This validates syntax, not execution.

## Push to GitHub

From this existing repository, review only intended changes, commit and push:

```powershell
git status --short
git diff --check
git diff -- Jenkinsfile pom.xml scripts/security-scan.sh README.md
git add Jenkinsfile pom.xml scripts/security-scan.sh README.md
git commit -m "Replace NVD dependency scan with pinned Trivy" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push -u origin main
```

The inspected branch is `main` and `origin` already points to
`https://github.com/jeef123-do/jenkin.git`; no remote change or force push is
needed. Then open `http://localhost:8080`, open the SCM Pipeline job, and follow
the parameterized build steps above. Commit/push are left to the repository
owner; never commit credentials or generated reports.

## Troubleshooting

- **Maven or Java version mismatch locally:** run `.\mvnw.cmd -version` and verify Maven reports Java 21. Select a Java 21 JDK in VS Code.
- **Jenkins reports that Java 21 is missing:** configure a Java 21 JDK on the selected agent and ensure `java` is available on `PATH`.
- **Maven Wrapper cannot download Maven:** ensure the Jenkins agent can access Maven Central and its workspace permits downloading/extracting the Maven distribution.
- **Jenkins SCM checkout fails:** check the Git URL, private-repository credentials, `*/main`, and Script Path `Jenkinsfile`.
- **Port 8080 is already in use:** stop the other process or run the app with `.\mvnw.cmd -B spring-boot:run '-Dspring-boot.run.arguments=--server.port=8081'`, then open `http://localhost:8081/`.
- **The browser reports a connection error:** make sure the application is running and reload the page at `http://localhost:8080/`.
- **Local settings cannot be saved:** allow site storage in the browser; the app will show a message and continue to use entered values for the open page.
- **Security Scan fails:** inspect the stage log and available Trivy reports. Check release/OCI registry network access and persistent cache permissions; remediate HIGH/CRITICAL findings rather than disabling the gate. NVD credentials are no longer used.
- **Test deployment fails:** inspect `target/deployment/app.log`, choose a free `TEST_PORT`, verify Linux/GNU `timeout`/Java 21 prerequisites, and leave unrelated processes alone.
- **Smoke test fails in Jenkins:** inspect the deployment log and health-check URL. Cleanup targets only the current build's deployment; an agent-local port is not a Windows-host URL.
