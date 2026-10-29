pipeline {
    agent any
    options {
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
        timeout(time: params.INITIALIZE_NVD_DATABASE ? 540 : 180, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10', artifactNumToKeepStr: '5'))
    }
    parameters {
        booleanParam(name: 'INITIALIZE_NVD_DATABASE', defaultValue: false,
                     description: 'One-time NVD database preparation only (up to 8 hours). Does not test, scan dependencies, package or deploy.')
        booleanParam(name: 'SIMULATE_TEST_FAILURE', defaultValue: false,
                     description: 'Tick only to demonstrate the failing Test stage.')
        string(name: 'TEST_PORT', defaultValue: '18081',
               description: 'Temporary test application port on the Linux agent (not Jenkins port 8080).')
    }
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        stage('Prepare NVD Database') {
            when {
                expression { params.INITIALIZE_NVD_DATABASE }
            }
            options {
                timeout(time: 8, unit: 'HOURS')
            }
            steps {
                echo 'Database preparation only, NOT a vulnerability scan. Keep the agent Maven cache; do not run other jobs against the same database concurrently.'
                withCredentials([string(credentialsId: 'nvd-api-key', variable: 'NVD_API_KEY')]) {
                    sh '''
                        set -eu
                        set +x
                        if [ -z "$NVD_API_KEY" ]; then
                            echo "NVD API key is empty. Configure the Jenkins Secret text credential with ID nvd-api-key." >&2
                            exit 1
                        fi
                        if ! java -version 2>&1 | grep -Eq 'version "21([.]|")'; then
                            echo "Database preparation requires a Java 21 JDK on this Jenkins agent." >&2
                            exit 1
                        fi
                        sh mvnw -B -Psecurity dependency-check:update-only
                    '''
                }
            }
        }
        stage('Build') {
            when {
                expression { !params.INITIALIZE_NVD_DATABASE }
            }
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
            when {
                expression { !params.INITIALIZE_NVD_DATABASE }
            }
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
            when {
                expression { !params.INITIALIZE_NVD_DATABASE }
            }
            options {
                timeout(time: 90, unit: 'MINUTES')
            }
            steps {
                echo 'Dependency-Check 13.0.0: requires the nvd-api-key Secret text credential, Maven Central and vulnerability-feed access. Missing credentials, scanner errors, or CVSS >= 7.0 fail this stage.'
                withCredentials([string(credentialsId: 'nvd-api-key', variable: 'NVD_API_KEY')]) {
                    sh '''
                        set -eu
                        set +x
                        if [ -z "$NVD_API_KEY" ]; then
                            echo "NVD API key is empty. Configure the Jenkins Secret text credential with ID nvd-api-key." >&2
                            exit 1
                        fi
                        sh mvnw -B -Psecurity dependency-check:check
                    '''
                }
            }
        }
        stage('Package') {
            when {
                expression { !params.INITIALIZE_NVD_DATABASE }
            }
            steps {
                sh 'sh mvnw -B package -DskipTests'
            }
        }
        stage('Deploy to Test') {
            when {
                expression { !params.INITIALIZE_NVD_DATABASE }
            }
            steps {
                sh 'sh scripts/test-environment.sh deploy'
            }
        }
        stage('Smoke Test') {
            when {
                expression { !params.INITIALIZE_NVD_DATABASE }
            }
            steps {
                sh 'sh scripts/test-environment.sh smoke'
            }
        }
    }
    post {
        always {
            script {
                if (!params.INITIALIZE_NVD_DATABASE) {
                    junit testResults: 'target/surefire-reports/*.xml', allowEmptyResults: true
                    archiveArtifacts artifacts: 'target/*.jar,target/dependency-check-report.*,target/deployment/*.log',
                                     allowEmptyArchive: true,
                                     fingerprint: true
                }
            }
            echo 'HealthyLife CI/CD pipeline execution finished. Test deployment is temporary; no production deployment.'
        }
        success {
            script {
                if (params.INITIALIZE_NVD_DATABASE) {
                    echo 'NVD database preparation completed. No dependency scan or deployment was performed. Uncheck INITIALIZE_NVD_DATABASE and run the normal Pipeline to verify CI/CD.'
                } else {
                    echo 'HealthyLife CI/CD passed: tests, security gate, test deployment and deployed-service health check.'
                }
            }
        }
        failure {
            echo 'HealthyLife CI/CD failed. Dependent stages are skipped; review stage logs, test results and available security reports.'
        }
        cleanup {
            script {
                if (!params.INITIALIZE_NVD_DATABASE && fileExists('scripts/test-environment.sh')) {
                    sh 'sh scripts/test-environment.sh cleanup'
                }
            }
        }
    }
}
