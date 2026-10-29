def ciPassed = false
def temporaryTestStarted = false

pipeline {
    agent none
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
               description: 'All requests run temporary Pipeline Test. SIT persists on the approved Windows host; PRD is not configured.')
        booleanParam(name: 'SIMULATE_TEST_FAILURE', defaultValue: false,
                     description: 'Tick only to demonstrate the failing Test stage.')
    }
    environment {
        TEST_PORT = '18081'
        ARTIFACT_PATH = 'target/jenkins-java-maven-demo-1.0.0.jar'
    }
    stages {
        stage('Pipeline Test') {
            agent { label 'healthylife-linux' }
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
                        echo 'Trivy HIGH/CRITICAL findings and scanner/report errors block deployment.'
                        sh '''
                            set -eu
                            sha256sum --check target/artifact.sha256
                            sh scripts/security-scan.sh
                            sha256sum --check target/artifact.sha256
                            cmp "$ARTIFACT_PATH" target/security-input/application.jar
                        '''
                    }
                }
                stage('Deploy to Test') {
                    steps {
                        script { temporaryTestStarted = true }
                        sh 'sh scripts/deploy-test.sh'
                    }
                }
                stage('Smoke Test') {
                    steps {
                        sh 'sh scripts/smoke-test.sh TEST'
                    }
                }
                stage('Prepare SIT Artifact') {
                    steps {
                        script {
                            if (currentBuild.currentResult != 'SUCCESS') {
                                error('Successful CI, security scan and Pipeline Test smoke check are required.')
                            }
                            sh 'sha256sum --check target/artifact.sha256'
                            if (params.TARGET_ENV == 'SIT') {
                                stash name: 'sit-release',
                                      includes: 'target/jenkins-java-maven-demo-1.0.0.jar,target/artifact.sha256,Dockerfile,compose.sit.yaml,scripts/sit-service.ps1'
                            }
                            ciPassed = true
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
                }
                cleanup {
                    script {
                        if (temporaryTestStarted && fileExists('scripts/test-environment.sh')) {
                            sh 'sh scripts/test-environment.sh cleanup'
                        }
                    }
                }
            }
        }
        stage('SIT') {
            when {
                beforeAgent true
                expression { params.TARGET_ENV == 'SIT' }
            }
            agent { label 'healthylife-windows-sit' }
            stages {
                stage('Deploy to SIT') {
                    steps {
                        script {
                            if (!ciPassed || currentBuild.currentResult != 'SUCCESS') {
                                error('SIT requires successful Pipeline Test and cleanup in this run.')
                            }
                            dir("sit-release-${env.BUILD_NUMBER}") {
                                unstash 'sit-release'
                                powershell '.\\scripts\\sit-service.ps1 -Action Deploy'
                            }
                        }
                    }
                }
                stage('SIT Smoke Test') {
                    steps {
                        script {
                            dir("sit-release-${env.BUILD_NUMBER}") {
                                powershell '.\\scripts\\sit-service.ps1 -Action Smoke'
                            }
                        }
                    }
                }
            }
        }
        stage('Production Configuration') {
            when { expression { params.TARGET_ENV == 'PRD' } }
            steps {
                error('Production target, deployment transport, isolated configuration/data/secrets and health URL are not configured. No approval or deployment will be attempted. Do not use the SIT host/localhost as a Production fallback.')
            }
        }
        stage('Production Approval') {
            when { expression { params.TARGET_ENV == 'PRD' } }
            options {
                timeout(time: 15, unit: 'MINUTES')
            }
            steps {
                script {
                    if (!ciPassed || currentBuild.currentResult != 'SUCCESS') {
                        error('Production requires successful Pipeline Test and cleanup.')
                    }
                    input message: "Approve Production release for ${env.JOB_NAME} #${env.BUILD_NUMBER}?",
                          ok: 'Approve Production',
                          submitter: 'release-manager'
                }
            }
        }
        stage('Deploy to Production') {
            when { expression { params.TARGET_ENV == 'PRD' } }
            steps {
                error('Production deployment is disabled until an explicit target and reviewed implementation are configured.')
            }
        }
    }
    post {
        always {
            echo 'HealthyLife finished. Pipeline Test has its own cleanup; persistent SIT/Production are never stopped by post.'
        }
        success {
            echo 'Requested HealthyLife workflow passed. TEST alone does not deploy a persistent service.'
        }
        failure {
            echo 'HealthyLife failed. Review tests, scan reports and stage logs. SIT failure requires inspection or explicit rollback; no automatic success fallback.'
        }
    }
}
