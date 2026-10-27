# Jenkins Java Maven Demo

A Java 21 + Maven sample project for a Jenkins Pipeline as Code presentation.

## Pipeline stages
Checkout -> Build -> Test -> Run Demo App

## Requirements
- Jenkins with the Pipeline plugin
- Git repository containing this project
- Linux/Unix build agent with Java 21 and Maven 3.9+ on PATH

Important: the official Jenkins Docker image does not necessarily include Maven. Check `java -version` and `mvn -version` on the build agent first. Install/configure Maven or use an agent that has it. Do not delete your existing Jenkins Docker volume when troubleshooting.

## Test locally
```bash
mvn -B clean package
mvn -B test
java -jar target/jenkins-java-maven-demo-1.0.0.jar
```
Expected output: `Hello, Jenkins!`

Intentional failing test (expected to fail):
```bash
mvn -B test -Ddemo.fail=true
```
Return to passing tests with `mvn -B test`.

## Configure Jenkins
1. Create a GitHub repository, e.g. `jenkins-java-maven-demo`.
2. Push the contents of this folder to the repository root. `pom.xml` and `Jenkinsfile` must be at the root.
3. Jenkins -> New Item -> `jenkins-java-maven-demo` -> Pipeline.
4. Pipeline Definition: **Pipeline script from SCM**; SCM: **Git**.
5. Enter the repository URL, select the branch (usually `*/main`), and set Script Path to `Jenkinsfile`.
6. Save, then run **Build Now**.
7. To show a failure, use **Build with Parameters**, tick `SIMULATE_TEST_FAILURE`, and run. The Test stage should fail intentionally.
8. Run again with the box unchecked to show recovery.

## 5-minute demo
1. Show the GitHub repository and Jenkinsfile.
2. Run a normal build; explain Checkout, Build, Test and Run Demo App.
3. Show the successful result and console output.
4. Run with `SIMULATE_TEST_FAILURE=true`; show the failed Test stage.
5. Run again with the parameter false; show recovery.

## Troubleshooting
- `mvn: not found`: Maven is missing from the agent.
- `java: not found` or unsupported class version: configure Java 21.
- `No such DSL method 'booleanParam'`: check the Pipeline plugin.
- `checkout scm` fails: verify repository URL, branch, credentials (if private), and Script Path.
- `sh` is not supported: use a Linux/Unix agent or adapt commands to `bat` for Windows.

This is a CI demo only. It does not deploy to production, use cloud credentials, or modify external infrastructure.
