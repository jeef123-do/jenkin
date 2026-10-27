pipeline {
    agent {
        docker {
            image 'maven:3.9.9-eclipse-temurin-21'
        }
    }
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
                sh 'mvn -B clean package -DskipTests'
            }
        }
        stage('Test') {
            steps {
                script {
                    if (params.SIMULATE_TEST_FAILURE) {
                        sh 'mvn -B test -Ddemo.fail=true'
                    } else {
                        sh 'mvn -B test'
                    }
                }
            }
        }
        stage('Package') {
            steps {
                sh 'mvn -B package -DskipTests'
                archiveArtifacts artifacts: 'target/jenkins-java-maven-demo-1.0.0.jar', fingerprint: true
            }
        }
        stage('Run Demo App or Smoke Test') {
            steps {
                sh '''
                    set -eu
                    java -jar target/jenkins-java-maven-demo-1.0.0.jar --server.port=18080 > healthylife-app.log 2>&1 &
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
            archiveArtifacts artifacts: 'target/jenkins-java-maven-demo-1.0.0.jar,healthylife-app.log',
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
