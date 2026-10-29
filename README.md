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
│   ├── deploy-sit.sh     # persistent Docker Desktop SIT
│   ├── deploy-prd.sh     # blocked until real infrastructure is configured
│   ├── sit-environment.sh
│   ├── tests/            # isolated deployment and Pipeline mocks
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
- For Jenkins, provision a Linux agent labelled `healthylife-docker` with Java 21, `/proc`, POSIX `sh`, `nohup`, GNU `timeout`, `grep`, `tr`, `git`, `sha256sum` and the security-scan tools. SIT additionally needs Docker CLI, Compose v2+ with `up --wait`, and authorized access to the **same Docker Desktop daemon as Windows**. Network access to Maven Central, vulnerability feeds and the base-image registry is required. Maven is downloaded by the wrapper.

The Jenkins pipeline uses `agent { label 'healthylife-docker' }`, not `agent any`. This agent is an infrastructure prerequisite, not created by this repository. The checked-in Maven Wrapper downloads Maven 3.9.9 when needed.

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
2. Ensure the selected agent meets the prerequisites above. The currently running controller is `jenkins-backup`; it has **neither Docker CLI nor a mounted Docker socket**. Windows Docker access does not imply Jenkins Docker access. Provision the labelled agent and its daemon access outside this repository; no controller/socket/host configuration is changed here. No Docker Pipeline plugin is used.
3. Allow the Trivy release/database downloads described below. Jenkins needs Declarative Pipeline, Pipeline: Input Step, Git, JUnit and Timestamper plugins. Credential-backed transports also need Credentials and Credentials Binding. No scanner plugin or NVD credential is required. Docker is needed for SIT, not for the temporary Pipeline Test.
4. Create a **Pipeline** job or edit the existing one. Choose **Pipeline script from SCM**, select **Git**, and use `https://github.com/jeef123-do/jenkin.git` with repository credentials if needed.
5. Set **Branch Specifier** to `*/main` and **Script Path** to `Jenkinsfile`, then save.
6. Select **Build Now** once to load updated parameter definitions, then use **Build with Parameters**. The first run may fail closed while parameters refresh. Select `TARGET_ENV`; the old `DEPLOY_ENV` parameter is no longer used and must not be used by API callers.

### Stages and reports

| Stage | Purpose |
| --- | --- |
| Checkout | Explicit `checkout scm`, with automatic checkout disabled; reject a missing or invalid `TARGET_ENV`. |
| Build | Require Java 21, then Maven Wrapper `clean compile`. |
| Test | Run the suite, preserving `SIMULATE_TEST_FAILURE`. |
| Package | Package once and record `target/artifact.sha256` for the tested JAR. |
| Security Scan | Run pinned Trivy **0.76.1** against the packaged JAR. Fail on HIGH/CRITICAL findings or scanner errors; verify the checksum before/after scanning and compare the scan input to the original JAR. |
| Pipeline Test | For every environment: deploy the packaged JAR on agent loopback port 18081, wait for HTTP readiness, smoke-test, then clean up in `finally`, including failures. |
| Production Approval | PRD only, after all gates succeed. `input` restricts approval to `release-manager`, with a 15-minute timeout within the existing 60-minute overall timeout. |
| Deploy | TEST has already finished and been cleaned up. SIT builds the current artifact into an image, waits for container health, then smoke-tests before promotion. PRD fails closed even after approval. |

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

Every request first starts and smoke-tests the temporary Pipeline Test process,
then cleans it up before any persistent deployment. There is no approval for
TEST or SIT. SIT is a separate Compose service with an independent lifecycle.
PRD requests reach
`input` only after successful Build, Test, Package and Security Scan. Approval is limited to the
exact Jenkins user/group `release-manager`. Jenkins administrators can still
approve despite `submitter`; users with Job/Cancel can abort a pending input.
An abort or timeout propagates normally, skips PRD deployment and still runs post
actions/cleanup. It is not caught or converted into approval.

The internal Groovy approval flag is set only after `input` returns successfully,
not from a parameter. Deploy for PRD also checks that flag and a successful build
result. `disableRestartFromStage()` prevents restarting at Approval or Deploy
to bypass earlier gates; a fresh run also starts with a false approval flag.
This is defense in depth, not protection against someone who can edit/replay
the Pipeline or control Jenkins. Do not use stage restart to skip required
gates: restrict restart/replay permissions and use fresh full PRD builds only.
Do not rebuild or replace the scanned artifact after approval.

**Even approved PRD requests currently fail deliberately without deploying.**
Provide and review the real PRD endpoint, transport, artifact destination,
deployment and health/rollback scripts, environment-specific credential IDs,
agent isolation and authorization before replacing the explicit errors.
There is no production target and no fallback to SIT. Approval expires after 15
minutes or when the existing overall 60-minute timeout is reached, whichever
comes first; it does not extend the overall limit. The current top-level agent
remains allocated during input. The TEST process is already stopped before approval.

### Deployment contract and configuration

```text
Checkout -> Build -> Test -> Package (one JAR + SHA-256) -> Security Scan
  -> Pipeline Test: temporary deploy -> readiness -> smoke -> finally cleanup
  TEST -> done (no persistent deployment)
  SIT  -> image build -> Compose health/readiness -> container-local smoke -> persist
  PRD  -> Approval -> explicit failure (production target/method still required)
```

`scripts/deploy-test.sh` delegates to the existing temporary deployment.
`scripts/deploy-sit.sh` delegates to `scripts/sit-environment.sh deploy`.
`scripts/deploy-prd.sh` remains a nonzero-exit placeholder; approval cannot enable it.
`scripts/smoke-test.sh TEST` checks the owned temporary process.
`scripts/smoke-test.sh SIT` uses Compose exec to run the existing Java HTTP
checker inside `sit-app`, after Compose health readiness. No agent-to-Windows
HTTP route or extra published port is required.
The future PRD remote checker still requires a non-loopback HTTPS endpoint, no embedded credentials,
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
| `TEST_PORT` | Fixed Jenkinsfile environment | Exactly 18081, agent-local; script rejects other values. Remove any stale job parameter after Jenkins refreshes its definitions. |
| `ARTIFACT_PATH` | Fixed Jenkinsfile environment | `target/jenkins-java-maven-demo-1.0.0.jar`; shared by scanner/deploy scripts, not a build parameter. |
| `BUILD_TAG` | Jenkins built-in | Identifies only this build's temporary TEST process. |
| `SIT_DOCKER_ENGINE_ID` | Trusted job/folder or agent configuration | Required Docker Desktop engine ID; mismatch or missing value blocks every SIT action before changing resources. This is an identity check, not a credential. |
| `PRD_HEALTH_URL` | Trusted release job/folder configuration | Actual reachable PRD HTTPS health URL; unset by default. |
| Docker transport | Administrator-managed agent configuration | Authorized socket or TLS-backed connection to Windows Docker Desktop; never an unauthenticated TCP daemon. |
| PRD target / transport / destination | Not yet defined | Approved real server/platform and immutable artifact destination; never derived from user input. |
| Application configuration | Target-managed config or Jenkins secret file | Separate environment settings/profile, service account, ports, TLS and secret injection; never baked into the JAR. |
| Credential IDs | Trusted deployment code/config after review | Separate real TEST/SIT/PRD IDs of the appropriate type; none invented here. |

Before replacing the PRD placeholder, define transfer authentication, verified SSH
host keys or platform TLS trust, process/service/container ownership, release
activation, artifact checksum verification on the target, rollback, health URL
and least-privilege network access. The script must deploy `ARTIFACT_PATH`
without running Maven or replacing/rebuilding the JAR. SIT Docker builds copy
the current tested/scanned JAR, not a separately Maven-built artifact. Different environments
must use the same artifact format/bytes with external configuration. Each run
tests temporarily and optionally deploys SIT; promotion across runs additionally requires a trusted
immutable artifact store and digest selection, not another checkout/rebuild.
The local checksum protects accidental replacement, not a malicious editor of
the Pipeline or checksum file. Remote delivery verification remains part of the
future deploy implementation.

Pipeline Test `finally` always calls process-aware cleanup; post cleanup retries
if that cleanup did not complete (including partial deployment failure). It never stops a SIT/PRD
application. Do not add a generic remote shutdown to post cleanup. Deployment
or smoke failure must remain a failure; rollback must not hide that failure.

### Current topology and SIT operation

Read-only inspection for this change started from clean `main` at
`ed02c2e2b0329e21317d1c897e934724cd43f245` (`revert code`).
That revision had no Dockerfile, Compose file or `sit-app`; these are new.
The application had no explicit `server.port`; SIT now explicitly uses 8080,
matching Spring Boot's default, as confirmed by the operator.

Observed Docker topology (not inferred from the historical notes below):

- Windows uses context `desktop-linux`, endpoint
  `npipe:////./pipe/dockerDesktopLinuxEngine`, Docker Desktop's Linux engine.
- Only `jenkins-backup` was running, from `jenkins/jenkins:lts-jdk21`,
  publishing 8080/50000. The old `jenkins` container was stopped.
  No HealthyLife/SIT container or published port 18082 was present.
- The controller has two built-in executors in NORMAL mode, a `jenkins_home`
  volume, default bridge networking and no Docker CLI/socket. No node directory
  was present. The old `agent any` did not guarantee where work would run.
- The selected design requires an administrator-provisioned Linux agent with
  label `healthylife-docker`, connected to the same Desktop engine. Build context
  is sent by Docker CLI from the agent checkout; no host workspace bind mount is
  used. A remote daemon would publish on that remote host, **not Windows**.

```text
Windows browser -> 127.0.0.1:18082 (Desktop loopback publish)
                -> healthylife-sit / sit-app :8080
Jenkins controller -> healthylife-docker Linux agent -> Desktop Docker API
                    -> Compose exec -> sit-app localhost:8080/api/health
                    -> agent localhost:18081 (temporary Pipeline Test only)
```

`localhost:18081` in the agent means that agent, not Windows.
For SIT, `http://127.0.0.1:8080/api/health` is used **inside the SIT
container** by Compose health and exec smoke; it is not the agent's localhost.
The Windows browser uses `http://localhost:18082/`.
No direct agent-to-host HTTP URL is assumed, even if networks differ.
`127.0.0.1:18082:8080` intentionally does not expose SIT to the LAN.
Keep existing Jenkins ports/networking unchanged in this task.

Before any real run, the administrator must install/provision CLI + Compose,
authorize daemon access for the labelled agent, and set trusted
`SIT_DOCKER_ENGINE_ID`. On Windows, obtain the current identity read-only:

```powershell
docker --context desktop-linux info --format '{{.ID}}'
```

Compare this value with `docker info --format '{{.ID}}'` on the agent.
Do not pass a Windows `npipe` context to a Linux agent; configure that agent's
own authorized socket/TLS transport. A mounted Docker socket grants powerful
host-level access: use a trusted, isolated agent, not untrusted jobs. Do not
expose an unauthenticated Docker TCP port. TLS keys, registry credentials and
future application secrets belong in Jenkins Credentials/secret manager,
with short-lived bindings and no values in source or logs. There are currently
no application secrets or registry-login placeholders in the deployment.

For a real Jenkins run **after infrastructure is configured**, choose
`TARGET_ENV=SIT`. Build, Test, Package, Trivy and temporary Pipeline Test must
pass first. SIT always builds an image from the checksum-verified current JAR,
then runs Compose with project `healthylife-sit`, service `sit-app`,
`--no-build --wait --wait-timeout 180`, and container-local smoke.
The image uses the new root Dockerfile and build context `.`, restricted by
`.dockerignore`. Runtime uses non-root Java 21, a read-only filesystem and a
temporary `/tmp`; no persistent server data or database exists today.
User data remains in browser localStorage, which is origin-specific:
18082 does not share settings with 8080 or 18081.

Manual commands below run from a Linux shell at the repository root with the
same daemon access and trusted `SIT_DOCKER_ENGINE_ID` already configured.
They are operational instructions, **not commands executed during validation**.

```sh
# Build the current application and verify it before creating any SIT image.
sh mvnw -B clean package
sha256sum target/jenkins-java-maven-demo-1.0.0.jar > target/artifact.sha256
sh scripts/security-scan.sh
sha256sum --check target/artifact.sha256
cmp target/jenkins-java-maven-demo-1.0.0.jar target/security-input/application.jar

# Builds a new image every time, then starts/updates and checks SIT.
sh scripts/deploy-sit.sh
sh scripts/sit-environment.sh status
sh scripts/sit-environment.sh logs
sh scripts/smoke-test.sh SIT

# Stop only SIT, without deleting its container, images or data.
sh scripts/sit-environment.sh stop
# Restart the retained successful image, without rebuilding.
sh scripts/sit-environment.sh start

# Restore the preceding release, wait for health and smoke; never rebuild.
sh scripts/sit-environment.sh rollback
```

Successful releases are retained on that daemon as `healthylife-sit:current`
and `healthylife-sit:previous`; activation uses immutable image IDs rather than
relying on a mutable tag. Before updating an existing container, its actual
image is preserved as `previous`. Failed readiness/smoke automatically attempts
to restore that image, reports restoration failure explicitly, and still fails
the build. An initial deployment cannot roll back without a prior image.
Successful manual rollback swaps the retained versions. No action runs
`down -v`, deletes volumes or prunes images. There are no application volumes
today; if persistent data is added, design storage/backups and schema
compatibility before deploying it. Image rollback alone cannot undo a database
migration. Keep retained tags/images; manual pruning can remove recovery options.
Use one trusted deployment job/operator at a time for this shared project:
`disableConcurrentBuilds()` only serializes the same Jenkins job, not other
jobs or manual operations.

After an explicitly authorized real deployment, verify from Windows:

```powershell
$env:SIT_IMAGE='healthylife-sit:current'
docker --context desktop-linux compose --project-name healthylife-sit --file compose.sit.yaml ps
Test-NetConnection 127.0.0.1 -Port 18082
curl.exe --fail-with-body http://127.0.0.1:18082/api/health
Start-Process 'http://localhost:18082/'
```

Compose requires an explicit image even for `ps`. Expect a healthy
`sit-app`, `127.0.0.1:18082->8080/tcp`, and HTTP 200 `{"status":"UP"}`.
If `localhost` resolves to IPv6 only, try `127.0.0.1`; do not widen the bind
address as a workaround. This change does not claim that 18082 is currently
open: no real SIT deployment is performed during validation.

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
| SIT | Authorized access from the labelled Linux agent to the agreed Desktop daemon; no application secret today. | Use isolated agent permissions and protected Jenkins credentials for TLS/registry/application secrets when required. |
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

Run on an isolated authorized Jenkins job, not against live production:

1. Validate with the authenticated Declarative validator below, then run a
   complete SCM build. A Groovy parse or a mocked test is not a substitute for
   Jenkins Declarative validation, installed plugin checks or a real ACL test.
2. With `TARGET_ENV=TEST` and `SIMULATE_TEST_FAILURE=false`, require all CI gates
   and Pipeline Test to pass without input. Check JUnit, archived
   JAR/checksum/scan/logs and cleanup. No SIT/PRD script may run.
3. With `TARGET_ENV=SIT`, require temporary TEST readiness/smoke/cleanup first,
   no approval input, and only then persistent SIT deployment, readiness and
   container-local smoke. With no authorized labelled Docker agent, the run
   must wait for that agent or fail explicitly on daemon preflight, not use a
   different daemon. Use mocks for this change; authorize a real acceptance
   deployment separately after infrastructure setup.
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
11. In mocks, verify image build precedes readiness, readiness precedes smoke,
    a failed SIT activation attempts the previous image and still fails, and
    no post action stops SIT. Test real SIT acceptance only after authorization.
    PRD remains blocked until its real target and method are reviewed.

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

Tools and databases persist under `$HOME/.cache/healthylife-trivy`. The
controller's `jenkins_home` volume is not automatically shared with the new
labelled agent. Provision a persistent writable HOME/cache for that agent.
A label may match multiple agents, so do not concurrently write the shared
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

Pipeline Test uses a dedicated Java process
**inside the Jenkins agent/container**, not production and not a separate
Smoke Test instance. It binds to `http://127.0.0.1:18081` **inside that agent**.
`TEST_PORT` is fixed at 18081, not a configurable job parameter. Reserve that
port on the selected agent and isolate other jobs rather than changing it to
18082 or terminating an unrelated listener. This process is never the SIT
service and never uses Compose.

The GNU `timeout` supervisor PID is recorded in `target/deployment/app.pid`.
Its arguments and the JVM carry a unique build marker. Re-deployment stops only
a process whose marker matches the current build. An occupied port fails
startup; it never terminates whoever owns that port. Post `cleanup` runs after
failure/abort as well as success and signals only the owned PID; the supervisor
forwards termination to the application. A 10-minute maximum deployment lifetime
plus a 10-second forced-stop grace bounds leftovers if Jenkins/agent connectivity
is lost. Normal cleanup waits up to 15 seconds and explicitly fails if the owned
process does not stop. No Jenkins container or persistent data is deleted.

The port is **not published on the Windows host**. During an authorized live
build, inspect it from the shell of the agent actually running that build:

```sh
curl --fail http://127.0.0.1:18081/api/health
```

The application stops responding after Pipeline Test's `finally` cleanup,
before persistent SIT deployment; post cleanup is a failure fallback.
Review archived logs and Pipeline Test output after completion rather than
expecting a persistent TEST website.
The health check retries for up to 40 seconds and fails on HTTP errors or wrong
status. The owned process is checked before and after the health request.

For SIT, provision the **dedicated Docker-capable Linux Jenkins agent**
described above. The Dockerfile and Compose recipe are now in this repository.
SIT checks execute inside its container, so the agent does not need to reach a
published host port. Host sockets are not automatically available inside Jenkins.
Docker socket access is effectively host-root authority and needs approval;
a remote daemon also requires an explicit reachable host address, not assumed
`localhost`. Do not replace Pipeline Test cleanup with Compose cleanup.
Installing only the Docker
Pipeline plugin is insufficient. Do not remove/recreate the existing `jenkins`
container, delete `jenkins_home`, grant broad daemon privileges, or run Docker
prune as part of this demo.

### Demonstrate a successful and failing build

1. Configure Trivy download/network prerequisites. Run **Build with
   Parameters**, `SIMULATE_TEST_FAILURE=false` (fixed `TEST_PORT=18081`).
   Success requires tests **and a real
   security scan** to pass. If findings block the build, review the HTML report
   and remediate them first; do not bypass the gate.
2. Select `TARGET_ENV=TEST`. Check CI stages, Pipeline Test, Deploy, JUnit results,
   archived JAR/checksum, HTML/JSON security reports,
   deployment log, and health-check success URL.
3. Run again with `SIMULATE_TEST_FAILURE=true`. **Test** intentionally fails,
   JUnit shows the assertion failure, and Security Scan, Package, Deploy
   and Pipeline Test are skipped. This demonstration needs no scanner execution
   because the failure occurs earlier.
4. Uncheck the parameter for subsequent normal runs.

### Environment-separation validation

Run isolated shell/Docker lifecycle mocks on Windows with Git for Windows Bash
and Node.js (no dependency installation required):

```powershell
node --test scripts\tests\environments.test.cjs
$env:SIT_IMAGE='healthylife-sit:syntax-only'
docker compose --project-name healthylife-sit --file compose.sit.yaml config --quiet
git diff --check
```

`TEST_SHELL` can select an existing POSIX shell; Linux defaults to `/bin/sh`.
The mock suite never invokes a real Docker daemon, starts an application or
deploys a service. It covers build/checksum gates, wait-before-smoke,
daemon identity rejection, failed readiness/smoke recovery, failed restoration,
first-deploy failure, manual rollback, lifecycle/resource isolation, PID safety,
idempotent cleanup and blocked PRD. Compose `config` only parses configuration.
The Groovy harness in `scripts/tests/pipeline-mocks.groovy` parses the current
Jenkinsfile and exercises mocked commands/approval/cleanup. It requires an
existing Groovy 2.4+ runtime and the current Jenkinsfile in Base64 system
property `healthylife.pipeline`; no credentials are needed.
With an existing Groovy CLI, the Pipeline harness can also be run locally:

```powershell
$pipeline = [Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\Jenkinsfile"))
groovy "-Dhealthylife.pipeline=$pipeline" .\scripts\tests\pipeline-mocks.groovy
```

Current checks passed: 28 Node/shell contract and lifecycle cases, 31 Groovy
Pipeline cases, shell syntax, Compose config and `git diff --check`.
The unauthenticated Declarative validator returned HTTP 403.
Groovy parsing and mock execution are **not** Jenkins CPS/Declarative validation.
Use the authenticated HTTP validator documented below before a real build.
No actual SIT build/deploy, readiness HTTP request, rollback, Maven test rerun,
Trivy scan or browser reachability is claimed by mock validation.

### Historical validation (before environment separation)

The notes below belong to earlier revisions and are retained only as history.
Their container names, ports, placeholders and results do not describe the
current code or establish the current Docker topology.

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
git diff -- Jenkinsfile Dockerfile compose.sit.yaml .dockerignore scripts README.md
git add Jenkinsfile Dockerfile compose.sit.yaml .dockerignore scripts/deploy-sit.sh scripts/sit-environment.sh scripts/smoke-test.sh scripts/test-environment.sh scripts/tests README.md
git commit -m "Separate temporary Pipeline Test from persistent SIT" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
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
- **Test deployment fails:** inspect `target/deployment/app.log`, ensure reserved port 18081 is available on the selected agent, verify Linux/GNU `timeout`/Java 21 prerequisites, and leave unrelated processes alone.
- **Smoke test fails in Jenkins:** inspect the deployment log and health-check URL. Cleanup targets only the current build's deployment; an agent-local port is not a Windows-host URL.
