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

- Java 21, Spring Boot 4.0.9, Spring MVC, Bean Validation, Jackson 3
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
│   ├── deploy-test.sh
│   ├── deploy-sit.sh     # blocked until real infrastructure is configured
│   ├── deploy-prd.sh     # blocked until real infrastructure is configured
│   ├── smoke-test.sh
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

The current Jenkins pipeline uses `healthylife-linux` for CI/Pipeline Test and
`healthylife-windows-sit` for persistent SIT. Configure the node labels first.
The Maven Wrapper downloads Maven 3.9.9 when needed. See
[ENVIRONMENTS.md](ENVIRONMENTS.md) for the current topology and setup.

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

**Current workflow:** Every request runs temporary Pipeline Test at fixed port
18081 and cleans its owned process before proceeding. TEST then ends; SIT uses
the dedicated Windows agent and `compose.sit.yaml` to persist at Windows-local
port 18082; PRD fails before approval because no Production target is supplied.
Dockerfile and `scripts/sit-service.ps1` are new runtime/lifecycle files for SIT.
They never manage Production. No deployment has been performed by this change.
See [ENVIRONMENTS.md](ENVIRONMENTS.md) for authoritative current setup,
credentials, URLs, start/stop/log/rollback and acceptance tests.

1. Push the updated project to GitHub with `pom.xml` and `Jenkinsfile` at its root.
2. Ensure the agent meets the Linux prerequisites above. The inspected `jenkins` container has Java 21, Maven 3.9.9 and GNU `timeout`, but **neither Docker CLI nor a Docker socket**. Host Docker access does not imply Jenkins Docker access. No Docker Pipeline plugin or `agent { docker { ... } }` syntax is used.
3. Allow the Trivy release/database downloads described below. Jenkins needs Declarative Pipeline, Pipeline: Input Step, Git, JUnit and Timestamper plugins. Future credential-backed deployments also need Credentials and Credentials Binding. No scanner Jenkins plugin, Docker daemon or NVD credential is required.
4. Create a **Pipeline** job or edit the existing one. Choose **Pipeline script from SCM**, select **Git**, and use `https://github.com/jeef123-do/jenkin.git` with repository credentials if needed.
5. Set **Branch Specifier** to `*/main` and **Script Path** to `Jenkinsfile`, then save.
6. Configure both node labels as described in ENVIRONMENTS.md. Refresh parameter
   definitions, then use **Build with Parameters**. Select TARGET_ENV; TEST_PORT
   is fixed, not a parameter. Do not start a SIT deployment until separately
   authorized. The old DEPLOY_ENV parameter is not used.

### Stages and reports

| Stage | Purpose |
| --- | --- |
| Checkout | Explicit `checkout scm`, with automatic checkout disabled; reject a missing or invalid `TARGET_ENV`. |
| Build | Require Java 21, then Maven Wrapper `clean compile`. |
| Test | Run the suite, preserving `SIMULATE_TEST_FAILURE`. |
| Package | Package once and record `target/artifact.sha256` for the tested JAR. |
| Security Scan | Run pinned Trivy **0.76.1** against the packaged JAR. Fail on HIGH/CRITICAL findings or scanner errors; verify the checksum before/after scanning and compare the scan input to the original JAR. |
| Deploy to Test / Smoke Test | Every request runs owned temporary TEST on Linux port 18081. Group post archives and cleans TEST even after failure. |
| Prepare SIT Artifact | Verify checksum and stash the same JAR/runtime files only for SIT. |
| Deploy to SIT / SIT Smoke Test | Dedicated Windows SIT agent uses local Docker Desktop, isolated project/service/profile/state and loopback port 18082; no approval. |
| Production Configuration | PRD fails before input because no target is supplied; no fallback to SIT/localhost. |
| Production Approval / Deploy to Production | Disabled behind the configuration failure. Future input uses submitter release-manager; deploy still explicitly fails until separately reviewed and implemented. |

Post actions retain JUnit results and archive `target/*.jar`, available
`target/security/*` (HTML, JSON, text and package inventory), `target/artifact.sha256`
and `target/deployment/*.log`,
including reports produced before a failed security gate. An unavailable
database/service may prevent report generation; no report does **not** mean a
successful scan. Retention is 10 builds with artifacts for the latest 5. Builds
of the same job cannot overlap. CI/CD has a 60-minute overall timeout
and a 30-minute scan-stage timeout (the Trivy scan itself allows 20 minutes).
Standard Declarative behavior skips
dependent stages after a failure.

### Environment requests and production approval

`TARGET_ENV` defaults to `TEST`. It is only a deployment request, never evidence
of authorization. The pre-existing `SIMULATE_TEST_FAILURE` checkbox only makes
the Test stage fail; the original pipeline had no PRD switch, production
deployment, deploy credentials or SIT implementation. Jenkins job ACLs,
credential stores and infrastructure permissions are not defined in this
repository and cannot be verified from this file.

Every request runs and cleans Pipeline Test first. TEST ends there; SIT deploys
the persistent Windows-local integration instance without approval. PRD fails
at Production Configuration before any approval or target contact. The retained
future approval template is limited to the
exact Jenkins user/group `release-manager`. Jenkins administrators can still
approve despite `submitter`; users with Job/Cancel can abort a pending input.
An abort or timeout propagates normally, skips PRD deployment and still runs post
actions/cleanup. It is not caught or converted into approval.

The internal CI flag and successful build result gate SIT after TEST cleanup.
No parameter is treated as approval. Production has two explicit failure
barriers. `disableRestartFromStage()` prevents restarting past earlier gates.
This is defense in depth, not protection against someone who can edit/replay
the Pipeline or control Jenkins. Do not use stage restart to skip required
gates: restrict restart/replay permissions and use fresh full PRD builds only.
Do not rebuild or replace the scanned artifact after approval.

**PRD currently fails before requesting approval or deploying.**
Provide and review the real Production endpoints, transport, artifact destination,
deployment and health/rollback scripts, environment-specific credential IDs,
agent isolation and authorization before replacing the explicit errors.
No server, URL or credential ID is invented here. Approval expires after 15
minutes or when the existing overall 60-minute timeout is reached, whichever
comes first; it does not extend the overall limit. `agent none` avoids holding
an executor at future input. Pipeline Test post runs on its Linux executor
before any environment deployment.

### Deployment contract and configuration

```text
Checkout -> Build -> Test -> Package (one JAR + SHA-256) -> Security Scan
  -> Deploy to Test -> Smoke Test -> Prepare SIT Artifact -> archive/TEST cleanup
  TEST -> done
  SIT  -> Windows Deploy to SIT -> SIT Smoke Test -> leave SIT running
  PRD  -> Production Configuration failure (no target)
```

`scripts/deploy-test.sh` delegates to the existing temporary deployment.
SIT uses `scripts/sit-service.ps1` on Windows, not the Linux shell scripts.
The shell SIT deploy/smoke branches explicitly reject execution and point to
that Windows route. `scripts/deploy-prd.sh` remains a failure placeholder.
TEST smoke remains process-aware. The unused remote PRD helper requires a
non-loopback HTTPS endpoint, no embedded credentials,
query or fragment, a trusted TLS certificate, HTTP 200 and the existing
`"status":"UP"` response contract. HTTP redirects are not followed. An unreachable
endpoint or wrong response eventually exits nonzero. An authenticated health
endpoint needs a reviewed credential-aware client implementation first; do not
put a token in the URL. DNS/network egress policies must ensure the configured
hostname actually refers to the intended environment.

| Variable / setting | Source | Required value |
| --- | --- | --- |
| `TARGET_ENV` | Choice parameter | Exactly `TEST`, `SIT` or `PRD`; rejected otherwise before Build. |
| `SIMULATE_TEST_FAILURE` | Existing parameter | Test-failure demonstration only, not approval. |
| `TEST_PORT` | Fixed Pipeline environment | 18081 for temporary Pipeline Test in every request. |
| `ARTIFACT_PATH` | Fixed Jenkinsfile environment | `target/jenkins-java-maven-demo-1.0.0.jar`; shared by scanner/deploy scripts, not a build parameter. |
| `BUILD_TAG` | Jenkins built-in | Identifies only this build's temporary TEST process. |
| SIT health | Fixed in Windows script | http://127.0.0.1:18082/api/health from Windows SIT agent; internal container check on port 8080. |
| `PRD_HEALTH_URL` | Future protected release configuration | Not supplied; current Pipeline does not invoke remote PRD smoke. |
| Remote target / transport / destination | Not yet defined | Approved real server/platform and immutable artifact destination; never derived from user input. |
| Application configuration | Target-managed config or Jenkins secret file | Separate environment settings/profile, service account, ports, TLS and secret injection; never baked into the JAR. |
| Credential IDs | Trusted deployment code/config after review | Separate real TEST/SIT/PRD IDs of the appropriate type; none invented here. |

Before replacing a placeholder, define transfer authentication, verified SSH
host keys or platform TLS trust, process/service/container ownership, release
activation, artifact checksum verification on the target, rollback, health URL
and least-privilege network access. The script must deploy `ARTIFACT_PATH`
without running Maven or replacing/rebuilding the JAR. Different environments
must use the same artifact format/bytes with external configuration. Each run
targets one environment; promotion across runs additionally requires a trusted
immutable artifact store and digest selection, not another checkout/rebuild.
The local checksum protects accidental replacement, not a malicious editor of
the Pipeline or checksum file. Remote delivery verification remains part of the
future deploy implementation.

Pipeline Test group post calls the original cleanup only if this run attempted the
temporary TEST deployment (including partial failure). It never stops a SIT/PRD
application. Do not add a generic remote shutdown to post cleanup. Deployment
or smoke failure must remain a failure; rollback must not hide that failure.

### Required Jenkins authorization and credentials (outside Jenkinsfile)

- Configure a real security realm (Jenkins accounts, LDAP/AD or SSO) with a
  unique `release-manager` user or group, trusted group membership and tested
  exact-name resolution. Avoid a user/group name collision. `submitter` alone
  is not an authorization strategy; enable Matrix Authorization or an
  appropriately scoped Role-based Authorization strategy. Remove anonymous
  build/configuration access.
- Give builders Overall/Read, Job/Read and Job/Build only on the intended job.
  Give release managers sufficient Overall/Read and Job/Read access to inspect
  the build and approve via `input`. The input allowlist controls approval;
  granting Job/Build does not grant approval. Keep Job/Cancel limited to
  operators who may abort a release. Treat Overall/Administer as privileged
  break-glass access and audit its approval bypass.
- Limit Job/Configure, Job/Create, Job/Move, Job/Delete, Run/Replay,
  Run/Update/restart capabilities and credential create/update/view/use
  permissions to trusted administrators as appropriate for installed plugins.
  Protect the SCM branch, Jenkinsfile, Maven Wrapper and deploy/scan scripts
  with required review; prevent untrusted PRs/branches from running with PRD
  credentials. A configurable job or replayable Pipeline can remove this gate.
- Store future PRD secrets in a separately authorized release folder/job with
  PRD-only trusted agents and network/service-account access. Do not put PRD
  secrets at global scope reachable by untrusted jobs. Credential domains and
  distinct IDs alone are not an ACL; folder credentials are accessible to jobs
  in that folder, and `withCredentials` only limits binding lifetime. If this
  general CI job is editable by developers, use a protected release job rather
  than exposing PRD credentials to it. Do not run secret-bearing steps beside
  untrusted workloads under the same OS identity.
- Review Job/Workspace, artifact/log read permissions and retention. Never
  archive credential files, credential-bearing config or secret-bearing logs.
  Audit approvals, configuration/SCM changes and credential use in Jenkins and
  the target system. Enforce least privilege at the target infrastructure too.

| Environment | Current need | Configuration when real infrastructure exists |
| --- | --- | --- |
| TEST | None: loopback deployment uses no login or secret. | If remote deployment is added, create a TEST-only service identity and TEST-only credential. Never reuse SIT/PRD credentials. |
| SIT | Local Docker named-pipe access under the dedicated Windows agent OS account; no deployment secret currently needed. | Protect the node/account; scope future registry/integration credentials to SIT only. |
| PRD | Not configured; approval cannot enable deployment. | Create a least-privilege PRD service identity/credential in the restricted release folder/job, unavailable to TEST/SIT or untrusted SCM jobs. |
| SCM | Optional credential for private checkout, managed by the job. | Read-only repository access; not a deployment identity. |

Select binding by the actual deployment transport: `sshUserPrivateKey` for
**SSH Username with private key** (`keyFileVariable` and, if needed,
`usernameVariable`/`passphraseVariable`), `usernamePassword` for a service login,
`string` for **Secret text** tokens, or `file` for **Secret file** configuration.
Use `withCredentials` only inside the relevant deploy stage, for the shortest
possible block, after PRD approval and the internal guard. Supply the actual
admin-configured ID in trusted configuration, not a user-controlled build
parameter. There is intentionally no unused/dummy binding in this Jenkinsfile.

Use single-quoted Groovy shell scripts so the shell, not Groovy interpolation,
expands bound environment variables; start secret-bearing shell blocks with
`set +x`. Never echo secrets, dump the environment, enable verbose HTTP/SSH
tracing, or put secrets in command-line arguments. Masking is best effort, not
access control. Use stdin or protected temporary files outside archived/browsable
workspace paths as supported by the real client. For SSH, provision verified
host keys; never bypass host-key checking. Clean up temporary secret files and
review deploy/application logs before retaining them.

### Acceptance tests for the approval controls

Use the current acceptance checklist in [ENVIRONMENTS.md](ENVIRONMENTS.md).
The numbered cases below are historical for the earlier scaffold: its blocked
SIT and PRD input-before-configuration expectations no longer apply.

Run on an isolated authorized Jenkins job, not against live production:

1. Validate with the authenticated Declarative validator below, then run a
   complete SCM build. A Groovy parse or a mocked test is not a substitute for
   Jenkins Declarative validation, installed plugin checks or a real ACL test.
2. With `TARGET_ENV=TEST` and `SIMULATE_TEST_FAILURE=false`, require all CI gates,
   selected Deploy and Smoke Test to pass without input. Check JUnit, archived
   JAR/checksum/scan/logs and cleanup. No SIT/PRD script may run.
3. With `TARGET_ENV=SIT`, require no input or TEST process and an explicit
   not-configured failure in Deploy, with Smoke Test skipped. This does **not** prove a SIT
   deployment works: none exists yet. After real SIT wiring, verify its actual
   health check, identity and isolation without adding an approval.
4. Request PRD as a normal builder: after all gates pass, leave input pending
   and confirm Deploy has not started. Attempt approval via both UI and
   the input HTTP API with an unauthorized non-admin account; neither may
   advance the run. Selecting PRD or starting a build must not change this.
5. Approve using a verified release-manager account. Only then may PRD Deploy
   start; it must currently fail as not configured with no network deploy
   or PRD credential binding. After real wiring, verify the approved artifact
   fingerprint, audit record, target identity and target health.
6. Abort input and let it time out in separate runs. Require an aborted run,
   skipped PRD deploy and preserved post, with no credential use or remote shutdown.
7. Set `SIMULATE_TEST_FAILURE=true` with PRD requested. Test must fail before
   approval. In reviewed throwaway test branches, separately induce a Build
   failure, Security Scan nonzero exit (scanner error and HIGH/CRITICAL finding),
   and an unstable test result. None may approve/deploy; never disable the real
   security gate to obtain a production approval.
8. Confirm Restart from Stage is unavailable, including for Approval and Deploy.
   In an isolated mocked restart, missing same-run approval must fail.
   Confirm ordinary users cannot configure/replay or otherwise skip gates.
   Confirm unrelated jobs/branches cannot bind the eventual PRD
   credentials or reach PRD. Do not print secret values to demonstrate access.
9. Verify administrator bypass separately and audit it; do not claim that
   `submitter` blocks Jenkins administrators. Send a second build while the
   first waits: `disableConcurrentBuilds()` must queue it. Verify the unchanged
   global/scan timeouts, JUnit/archive retention and TEST cleanup after aborts.
10. Submit invalid/missing `TARGET_ENV` via a test API request or mocked binding:
    reject it without a deploy command. Change the JAR after scanning in an
    isolated test: the checksum gate must fail before Deploy. Confirm only one
    Maven package invocation occurs and no deploy script runs Maven.
11. After real SIT/PRD wiring, verify the target digest matches the archived
    checksum, health uses that environment's URL, a failed deploy skips Smoke
    Test, and an unreachable/wrong-status health endpoint fails the build.
    Verify no post action stops the remote application on failure or abort.

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
the Linux node label can match multiple agents. Do not concurrently write the shared
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
dependencies can legitimately block deployment as new advisories are published.

The dependency remediation upgrades the Boot parent from 3.4.5 to **4.0.9**,
using its coordinated BOM rather than mixing incompatible Framework major
versions. Boot 3.5.16 still produced blocking findings in the validation scan,
so the approved major upgrade uses the MVC-specific application/test starters,
Jackson 3's `tools.jackson.databind.ObjectMapper`, and the relocated MockMvc
auto-configuration test annotation. Java remains 21 and API response shapes are
covered by the existing tests. The scanned runtime includes Spring MVC 7.0.10,
Tomcat 11.0.27 and Jackson Databind 3.1.7.

To run on a compatible Linux agent after packaging:

```sh
sh scripts/security-scan.sh
```

### Temporary test environment and Docker prerequisites

The working alternative for the inspected agent is a dedicated Java process
**inside the Jenkins agent/container**, not production and not a separate
Smoke Test instance. It binds to `http://127.0.0.1:18081` **inside that agent**.
The Pipeline fixes TEST_PORT=18081. Standalone script callers may select another
free port between 1024 and 65535 if needed.
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

Persistent SIT uses a dedicated **Windows** agent on the confirmed Docker
Desktop host; see ENVIRONMENTS.md. Do not mount Docker sockets into the
controller or replace temporary TEST with the persistent service. Host sockets
are not automatically available inside Jenkins.
Docker socket access is effectively host-root authority and needs approval;
a remote daemon also requires an explicit reachable host address, not assumed
`localhost`. Then replace the deployment/cleanup script with container lifecycle
handling and verify the same deployed container. Installing only the Docker
Pipeline plugin is insufficient. Do not remove/recreate the existing `jenkins`
container, delete `jenkins_home`, grant broad daemon privileges, or run Docker
prune as part of this demo.

### Demonstrate a successful and failing build

1. Configure Trivy download/network prerequisites. Run **Build with
   Parameters**, `TARGET_ENV=TEST`, `SIMULATE_TEST_FAILURE=false` (fixed port 18081).
   Success requires tests **and a real
   security scan** to pass. If findings block the build, review the HTML report
   and remediate them first; do not bypass the gate.
2. Select `TARGET_ENV=TEST`. Check CI stages, Deploy, Smoke Test, JUnit results,
   archived JAR/checksum, HTML/JSON security reports,
   deployment log, and health-check success URL.
3. Run again with `SIMULATE_TEST_FAILURE=true`. **Test** intentionally fails,
   JUnit shows the assertion failure, and Security Scan, Package, Deploy
   and Smoke Test are skipped. This demonstration needs no scanner execution
   because the failure occurs earlier.
4. Uncheck the parameter for subsequent normal runs.

### Validation and current limits

For current Pipeline Test / persistent SIT / blocked Production verification,
see [ENVIRONMENTS.md](ENVIRONMENTS.md). Results below are historical, not claims
that the new SIT service has been deployed or verified live.

Multi-environment change validation on 2026-10-29:

- Groovy 2.4.21 syntax parsing and 36 isolated mocked Pipeline cases passed:
  environment dispatch, remote placeholders, post-deploy smoke dispatch,
  failure in every gate/deploy/smoke stage for all environments, unstable
  results, PRD abort/timeout/rejected input, invalid/missing choices, direct
  restart without approval and the existing simulated-test-failure command.
  Checks also asserted one package command, scan-input comparison and retained
  timeouts/concurrency/restart/retention options. Mocks are not Jenkins CPS,
  Declarative execution or proof of authorization.
- All six shell scripts passed `sh -n` with LF endings. Real executions confirmed
  SIT/PRD placeholders fail, invalid smoke environments and absent URLs fail,
  and remote HTTP/loopback/query-bearing URLs are rejected.
- The new TEST deploy/smoke wrappers ran against the existing packaged JAR on
  isolated agent-local port 28189. Real health succeeded; a wrong endpoint
  returned HTTP 404 and failed the smoke check. Cleanup stopped only the owned
  temporary process and the port was closed afterward. SHA-256 verification
  passed for the JAR; modified-artifact checksum and byte comparisons failed
  as intended. No real SIT/PRD server was contacted.
- The running Jenkins reported **2.580.1**. Installed manifests include
  Declarative model definition/API **2.2293.v6e7193cec599**, Input Step
  **560.v56198a_642157**, workflow-cps **4395.v738456a_5da_6b_**,
  Credentials **1514.vb_01eb_014e7d4**, Credentials Binding
  **728.v902a_273b_8947**, JUnit **1442.vb_b_a_467df2767**,
  Timestamper **1.30** and Git **5.11.0**. Their declared minimum Jenkins
  versions are below 2.580.1; the installed Declarative library contains
  `DisableRestartFromStage`. This checks prerequisites, not active plugin
  health or end-to-end execution.
- The Declarative HTTP validator still returned **403 without authorization**.
  Run the authenticated validator below and real Jenkins/ACL acceptance tests
  before release. No new Maven build/tests, Trivy database scan, full SCM
  Pipeline, real remote TLS health success or remote deployment is claimed.
  The application/POM and security policy were not changed.

Earlier approval-control change validation on 2026-10-29 (historical):

- The updated Jenkinsfile parsed with the installed Groovy 2.4.21 library.
  Fourteen isolated mocked control-flow cases passed: default TEST, blocked
  SIT, approved-but-unconfigured PRD, abort, timeout, failures in Build/Test/
  Package/Scan/TEST deployment/smoke, the existing simulated test failure,
  unstable results and a direct-deploy restart simulation. These mocks do not
  execute Jenkins CPS, Declarative directives, real input authorization or
  credential ACLs.
- Both unchanged shell scripts passed `sh -n`. The existing local packaged JAR
  was exercised with the unchanged TEST script in an isolated temporary folder
  on `jenkins-backup`, port 28187. Deployment, real health check and closed port
  after cleanup passed on the second attempt. The first attempt reported
  application exit before startup with an empty application log; cleanup ran.
  The cause of that intermittent startup result is not confirmed or changed
  by this approval-only patch.
- The current Declarative validator attempt returned HTTP 403 without
  authorization. Authenticated Declarative validation and the real approval/
  permission acceptance tests above remain required. No full SCM-triggered
  build, new Maven test run, new vulnerability scan, SIT or PRD deployment is
  claimed for this change.

Earlier application/scanner validation (not rerun by this multi-environment change):

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
  run (not a guarantee). Before remediation, the scanner identified 35 packages and reported 8
  CRITICAL, 25 HIGH, 28 MEDIUM and 12 LOW findings; these are report entries,
  not necessarily unique CVEs. The final gate correctly returned exit 1.
  HTML/JSON/text/inventory reports were generated.
  A filtered nonblocking report fixture returned success; the real report and
  a missing report returned failure.
- After upgrading to Boot 4.0.9, `clean package` passed all 15 tests, and a real
  Trivy scan identified 40 packages with **zero vulnerability entries** in the
  database snapshot used on 2026-10-29. The unchanged HIGH/CRITICAL gate returned
  exit 0. This is a point-in-time result, not a guarantee of no vulnerabilities.
  The deliberate test-failure flag still produced exactly one failed test.
  The new JAR was deployed using the actual deployment script on agent-local
  port 18082 for isolated validation: health, frontend and BMI calculation
  succeeded, and cleanup closed the port. The Pipeline default remains 18081.
  A full SCM-triggered Jenkins run with this upgrade still needs to be executed.
- Jenkinsfile Groovy syntax parsed successfully with the installed Jenkins
  Groovy version. The unauthenticated Declarative validator returned HTTP 403
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
