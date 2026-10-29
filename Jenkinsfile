def productionApproved = false
def temporaryTestStarted = false

pipeline {
    agent { label 'healthylife-docker' }
    options {
        timestamps()
        disableConcurrentBuilds()
        disableRestartFromStage()
        skipDefaultCheckout(true)
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10', artifactNumToKeepStr: '5'))
    }
    parameters {
        choice(name: 'TARGET_ENV', choices: ['TEST', 'SIT', 'PRD'],
               description: 'All requests run temporary Pipeline Test first. SIT persists on Docker Desktop; PRD remains blocked.')
        booleanParam(name: 'SIMULATE_TEST_FAILURE', defaultValue: false,
                     description: 'Tick only to demonstrate the failing Test stage.')
    }
    environment {
        ARTIFACT_PATH = 'target/jenkins-java-maven-demo-1.0.0.jar'
        TEST_PORT = '18081'
    }
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    if (!(params.TARGET_ENV in ['TEST', 'SIT', 'PRD'])) {
                        error('TARGET_ENV must be TEST, SIT or PRD.')
                    }
                }
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
                sh 'sha256sum "$ARTIFACT_PATH" > target/artifact.sha256'
            }
        }
        stage('Security Scan') {
            options {
                timeout(time: 30, unit: 'MINUTES')
            }
            steps {
                echo 'Trivy scans the packaged JAR before deployment. HIGH/CRITICAL findings and scanner/download/report errors fail the Pipeline. No NVD API key is required.'
                sh '''
                    set -eu
                    sha256sum --check target/artifact.sha256
                    sh scripts/security-scan.sh
                    sha256sum --check target/artifact.sha256
                    cmp "$ARTIFACT_PATH" target/security-input/application.jar
                '''
            }
        }
        stage('Pipeline Test') {
            steps {
                script {
                    if (currentBuild.currentResult != 'SUCCESS') {
                        error('Pipeline Test requires successful Build, Test, Package and Security Scan.')
                    }
                    temporaryTestStarted = true
                    try {
                        sh 'sh scripts/deploy-test.sh'
                        sh 'sh scripts/smoke-test.sh TEST'
                    } finally {
                        sh 'sh scripts/test-environment.sh cleanup'
                        temporaryTestStarted = false
                    }
                }
            }
        }
        stage('Production Approval') {
            when {
                expression { params.TARGET_ENV == 'PRD' }
            }
            options {
                timeout(time: 15, unit: 'MINUTES')
            }
            steps {
                script {
                    if (currentBuild.currentResult != 'SUCCESS') {
                        error('Production approval requires successful Build, Test, Package and Security Scan.')
                    }
                    input message: "Approve PRD request for ${env.JOB_NAME} #${env.BUILD_NUMBER}? Infrastructure is not configured; approval will not deploy.",
                          ok: 'Approve PRD request',
                          submitter: 'release-manager'
                    productionApproved = true
                }
            }
        }
        stage('Deploy') {
            steps {
                script {
                    if (currentBuild.currentResult != 'SUCCESS') {
                        error('Deployment requires successful prerequisite stages.')
                    }
                    if (params.TARGET_ENV == 'PRD' && !productionApproved) {
                        error('PRD requires approval in this run. Restarting directly at Deploy is not allowed.')
                    }
                    sh 'sha256sum --check target/artifact.sha256'
                    switch (params.TARGET_ENV) {
                        case 'TEST':
                            echo 'Pipeline Test passed and was cleaned up. No persistent TEST deployment.'
                            break
                        case 'SIT':
                            sh 'sh scripts/deploy-sit.sh'
                            break
                        case 'PRD':
                            sh 'sh scripts/deploy-prd.sh'
                            break
                        default:
                            error('TARGET_ENV must be TEST, SIT or PRD.')
                    }
                }
            }
        }
    }
    post {
        always {
            junit testResults: 'target/surefire-reports/*.xml', allowEmptyResults: true
            archiveArtifacts artifacts: 'target/*.jar,target/artifact.sha256,target/security/*,target/deployment/*.log',
                             allowEmptyArchive: true,
                             fingerprint: true
            echo 'Pipeline Test is temporary. SIT persists independently on Docker Desktop. PRD requires a real target and deployment method.'
        }
        success {
            echo 'HealthyLife CI/CD passed: tests, Trivy security gate, selected deployment and deployed-service health check.'
        }
        failure {
            echo 'HealthyLife CI/CD failed. Dependent stages are skipped; review stage logs, test results and available security reports.'
        }
        cleanup {
            script {
                if (temporaryTestStarted) {
                    sh 'sh scripts/test-environment.sh cleanup'
                }
            }
        }
    }
}
