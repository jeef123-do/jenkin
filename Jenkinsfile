def productionApproved = false

pipeline {
    agent any
    options {
        timestamps()
        disableConcurrentBuilds()
        disableRestartFromStage()
        skipDefaultCheckout(true)
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10', artifactNumToKeepStr: '5'))
    }
    parameters {
        choice(name: 'DEPLOY_ENV', choices: ['TEST', 'SIT', 'PRD'],
               description: 'Deployment request only, not authorization. SIT/PRD are blocked until configured.')
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
        stage('Security Scan') {
            options {
                timeout(time: 30, unit: 'MINUTES')
            }
            steps {
                echo 'Trivy scans the packaged JAR before deployment. HIGH/CRITICAL findings and scanner/download/report errors fail the Pipeline. No NVD API key is required.'
                sh 'sh scripts/security-scan.sh'
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
        stage('Deploy to SIT') {
            when {
                expression { params.DEPLOY_ENV == 'SIT' }
            }
            steps {
                error('SIT deployment is not configured. Define the real target, deployment/health-check script and SIT-only Jenkins credentials before enabling it.')
            }
        }
        stage('Production Approval') {
            when {
                expression { params.DEPLOY_ENV == 'PRD' }
            }
            options {
                timeout(time: 15, unit: 'MINUTES')
            }
            steps {
                script {
                    if (currentBuild.currentResult != 'SUCCESS') {
                        error('Production approval requires successful Build, Test, Security Scan and TEST smoke test.')
                    }
                    input message: "Approve PRD request for ${env.JOB_NAME} #${env.BUILD_NUMBER}? Infrastructure is not configured; approval will not deploy.",
                          ok: 'Approve PRD request',
                          submitter: 'release-manager'
                    productionApproved = true
                }
            }
        }
        stage('Deploy to PRD') {
            when {
                expression { params.DEPLOY_ENV == 'PRD' }
            }
            steps {
                script {
                    if (!productionApproved || currentBuild.currentResult != 'SUCCESS') {
                        error('PRD requires approval in this run after successful prerequisite stages. Restarting directly at Deploy to PRD is not allowed.')
                    }
                    error('PRD deployment is not configured. Approval alone does not enable deployment. Define the real target, protected deployment/health-check script, PRD-only Jenkins credentials and Jenkins authorization before enabling it.')
                }
            }
        }
    }
    post {
        always {
            junit testResults: 'target/surefire-reports/*.xml', allowEmptyResults: true
            archiveArtifacts artifacts: 'target/*.jar,target/security/*,target/deployment/*.log',
                             allowEmptyArchive: true,
                             fingerprint: true
            echo 'HealthyLife CI/CD pipeline execution finished. TEST deployment is temporary; SIT/PRD deployment is not configured.'
        }
        success {
            echo 'HealthyLife CI/CD passed: tests, Trivy security gate, test deployment and deployed-service health check.'
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
