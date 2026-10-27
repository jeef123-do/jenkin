pipeline {
    agent any
    options {
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10', artifactNumToKeepStr: '5'))
    }
    parameters {
        booleanParam(name: 'SIMULATE_TEST_FAILURE', defaultValue: false,
                     description: 'Tick only to demonstrate the failing Test stage.')
        string(name: 'TEST_PORT', defaultValue: '18081',
               description: 'Temporary test application port on the Linux agent (not Jenkins port 8080).')
        string(name: 'NVD_API_KEY_CREDENTIAL_ID', defaultValue: 'nvd-api-key',
               description: 'Jenkins Secret text credential ID for the NVD API key; never enter the key here.')
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
        stage('Security Scan') {
            options {
                timeout(time: 45, unit: 'MINUTES')
            }
            steps {
                echo 'Dependency-Check 13.0.0: requires NVD Secret text credential, Maven Central and vulnerability-feed access. Missing credentials, scanner errors, or CVSS >= 7.0 fail this stage.'
                withCredentials([string(credentialsId: params.NVD_API_KEY_CREDENTIAL_ID,
                                        variable: 'NVD_API_KEY')]) {
                    sh '''
                        set -eu
                        set +x
                        if [ -z "$NVD_API_KEY" ]; then
                            echo "NVD API key is empty. Configure the Jenkins Secret text credential." >&2
                            exit 1
                        fi
                        sh mvnw -B -Psecurity dependency-check:check
                    '''
                }
            }
        }
        stage('Package') {
            steps {
                sh 'sh mvnw -B package -DskipTests'
            }
        }
        stage('Deploy to Test') {
            steps {
                sh 'sh scripts/test-environment.sh deploy'
            }
        }
        stage('Smoke Test') {
            steps {
                sh 'sh scripts/test-environment.sh smoke'
            }
        }
    }
    post {
        always {
            junit testResults: 'target/surefire-reports/*.xml', allowEmptyResults: true
            archiveArtifacts artifacts: 'target/*.jar,target/dependency-check-report.*,target/deployment/*.log',
                             allowEmptyArchive: true,
                             fingerprint: true
            echo 'HealthyLife CI/CD pipeline execution finished. Test deployment is temporary; no production deployment.'
        }
        success {
            echo 'HealthyLife CI/CD passed: tests, security gate, test deployment and deployed-service health check.'
        }
        failure {
            echo 'HealthyLife CI/CD failed. Dependent stages are skipped; review stage logs, test results and available security reports.'
        }
        cleanup {
            script {
                if (fileExists('scripts/test-environment.sh')) {
                    sh 'sh scripts/test-environment.sh cleanup'
                }
            }
        }
    }
}
