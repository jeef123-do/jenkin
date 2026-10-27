pipeline {
    agent any
    options {
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
        timeout(time: 20, unit: 'MINUTES')
    }
    parameters {
        booleanParam(name: 'SIMULATE_TEST_FAILURE', defaultValue: false,
                     description: 'Tick only to demonstrate the failing Test stage.')
    }
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        stage('Build') {
            steps {
                sh '''
                    set -eu
                    if ! java -version 2>&1 | grep -Eq 'version "21([.]|")'; then
                        echo "HealthyLife requires a Java 21 JDK on this Jenkins agent." >&2
                        exit 1
                    fi
                    sh mvnw -B clean compile -DskipTests
                '''
            }
        }
        stage('Test') {
            steps {
                script {
                    if (params.SIMULATE_TEST_FAILURE) {
                        sh 'sh mvnw -B test -Ddemo.fail=true'
                    } else {
                        sh 'sh mvnw -B test'
                    }
                }
            }
        }
        stage('Package') {
            steps {
                sh 'sh mvnw -B package -DskipTests'
            }
        }
        stage('Smoke Test') {
            steps {
                sh '''
                    set -eu
                    app_jar='target/jenkins-java-maven-demo-1.0.0.jar'
                    if [ ! -f "$app_jar" ]; then
                        echo "Packaged application JAR was not found: $app_jar" >&2
                        exit 1
                    fi

                    java -jar "$app_jar" --server.port=18080 > healthylife-app.log 2>&1 &
                    app_pid=$!
                    cleanup() {
                        kill "$app_pid" 2>/dev/null || true
                        wait "$app_pid" 2>/dev/null || true
                    }
                    trap cleanup EXIT
                    java scripts/SmokeCheck.java http://127.0.0.1:18080/api/health
                '''
            }
        }
    }
    post {
        always {
            junit testResults: 'target/surefire-reports/*.xml', allowEmptyResults: true
            archiveArtifacts artifacts: 'target/*.jar,healthylife-app.log',
                             allowEmptyArchive: true,
                             fingerprint: true
            echo 'HealthyLife CI pipeline execution finished.'
        }
        success {
            echo 'HealthyLife CI pipeline completed successfully.'
        }
        failure {
            echo 'HealthyLife CI pipeline failed. Review the stage logs, fix the issue, and run again.'
        }
    }
}
