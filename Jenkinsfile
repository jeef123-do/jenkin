pipeline {
    agent any
    options { timestamps(); disableConcurrentBuilds() }
    parameters {
        booleanParam(name: 'SIMULATE_TEST_FAILURE', defaultValue: false,
                     description: 'Tick only to demonstrate a failing test/build.')
    }
    stages {
        stage('Checkout') { steps { checkout scm } }
        stage('Build') { steps { sh 'mvn -B clean package -DskipTests' } }
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
        stage('Run Demo App') {
            steps { sh 'java -jar target/jenkins-java-maven-demo-1.0.0.jar' }
        }
    }
    post {
        success { echo 'CI Pipeline completed successfully!' }
        failure { echo 'CI Pipeline failed. Check the logs, fix the issue, and run again.' }
        always { echo 'Pipeline execution finished.' }
    }
}
