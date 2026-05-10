pipeline {

    agent any

    environment {

        DOCKER_USERNAME = credentials('docker_username')
        DOCKER_PASSWORD = credentials('docker_password')
    }

    stages {

        stage("build docker image") {

            steps {

                sh "docker build -t abdelrahman678/solar-dashboard:v${BUILD_NUMBER} ."
            }
        }

        stage("push image to dockerhub") {

            steps {

                sh "docker login -u ${DOCKER_USERNAME} -p ${DOCKER_PASSWORD}"

                sh "docker push abdelrahman678/solar-dashboard:v${BUILD_NUMBER}"
            }
        }

        stage("Update ArgoCD Repo") {

            steps {

                withCredentials([

                    usernamePassword(
                        credentialsId: 'github-creds',
                        usernameVariable: 'GIT_USERNAME',
                        passwordVariable: 'GIT_TOKEN'
                    )

                ]) {

                    sh '''
                    git clone https://${GIT_USERNAME}:${GIT_TOKEN}@github.com/3bdoahmed/GProject-webapp-cd.git

                    cd GProject-webapp-cd

                    sed -i "s|image:.*|image: abdelrahman678/solar-dashboard:v${BUILD_NUMBER}|g" deployment.yaml

                    git config user.email "jenkins@gmail.com"
                    git config user.name "jenkins"

                    git add .
                    git commit -m "update image to v${BUILD_NUMBER}"

                    git push
                    '''
                }
            }
        }
    }
}
