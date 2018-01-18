# Simple GCB to GKE CICD Pipeline Codelab

## Setup

### Install Cloud SDK, git and kubectl

- [git](https://git-scm.com/downloads) 2.14.0+
- [gcloud](https://cloud.google.com/sdk) 179.0.0+
- Install kubectl with Cloud SDK:
    ```
    gcloud components install kubectl
    ```
### Setup the Repo

Before getting started, you need to click on the 'fork' button in the upper right corner this repository.

After the fork is complete, click the green "clone or download" link, and copy the clone url.

Next, clone your fork of the repository:

```
USERNAME=<GITHUB_USERNAME>
```
```
git clone https://github.com/${USERNAME}/gcb-gke-codelab.git
cd gcb-gke-codelab
```

### Create a GCP project

Create a new GCP project and capture the projectId in the PROJECT_ID env var:
```
PROJECT_NAME=gke-pipeline-${USERNAME}
```
```
PROJECT_ID=$(gcloud projects create --name "${PROJECT_NAME}" --format='value(projectId)')
```
_At the prompt type 'y' to accept generated project id._

Set the default project:
```
gcloud config set project ${PROJECT_ID}
```

Set the default zone:
```
COMPUTE_ZONE=us-west1-c
```
```
gcloud config set compute/zone ${COMPUTE_ZONE}
```

Ensure the default credentials are available on your local machine:
```
gcloud auth application-default login
```

Enable Billing on your project:

On Mac:
```
open https://console.developers.google.com/project/${PROJECT_ID}/settings
```
_Use xdg-open with Linux, start with Windows_

Enable the required GCP APIs:
```
gcloud services enable --async \
  container.googleapis.com \
  cloudapis.googleapis.com \
  cloudbuild.googleapis.com \
  sourcerepo.googleapis.com \
  compute.googleapis.com \
  storage-component.googleapis.com \
  containerregistry.googleapis.com \
  logging.googleapis.com
```
_Use `gcloud services list --enabled` to check progress_

### Create a GKE cluster

Create the cluster:
```
CLUSTER_NAME=production
```
```
gcloud container clusters create ${CLUSTER_NAME} --async
```
It can take up to five minutes to provision the Kubernetes clusters. Use the gcloud command to check the status of each cluster:

```
gcloud container clusters list
```

Grant the Container Builder service account developer access to the GKE API to fetch credentials and apply changes to the cluster.
```
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')
```
```
gcloud projects add-iam-policy-binding ${PROJECT_NUMBER} \
  --member=serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com \
  --role=roles/container.developer
```

The project is setup at this point. Now what???

## Create The App Pipeline

```
APP_NAME=my-app
```

### Create k8s Resources

_Wait for cluster to be running to execute this section_

Get cluster credentials and make available to kubectl
```
gcloud container clusters get-credentials ${CLUSTER_NAME} --zone ${COMPUTE_ZONE}
```

```
mkdir k8s
```
Create a Deployment file
```
kubectl run ${APP_NAME} --image=gcr.io/${PROJECT_NAME}/${APP_NAME} --port=3000 --env="GET_HOSTS_FROM=dns" --labels="app=${APP_NAME}" --dry-run -o yaml > k8s/deployment.yaml
```

Create a Service file
```
kubectl create service loadbalancer ${APP_NAME} --tcp=80:3000 --dry-run -o yaml > k8s/service.yaml
```
Create Service and Deployment resources
```
kubectl apply -f k8s/
```

### Create a build pipeline config file

```
touch cloudbuild.yaml
```

_Open cloudbuild.yaml in your favorite editor_

_Copy/paste the following into cloudbuild.yaml:_

Add docker build step:
```
steps:
# Build the image
- id: 'Build docker image'
  name: 'gcr.io/cloud-builders/docker'
  args: [ 'build', '-t', 'gcr.io/$PROJECT_ID/$_APP_NAME:$SHORT_SHA', '.' ]
```

Push image to registry:
```
# Push updated image
- id: 'Push image to registry'
  name: 'gcr.io/cloud-builders/docker'
  args: [ 'push', 'gcr.io/$PROJECT_ID/$_APP_NAME:$SHORT_SHA' ]
```

Patch Deployment manifest file:

```
# Patch the Deployment
- id: 'Patch manifest with new image'
  name: 'gcr.io/cloud-builders/kubectl'
  entrypoint: 'sh'
  env:
    - 'CLOUDSDK_COMPUTE_ZONE=${_CLOUDSDK_COMPUTE_ZONE}'
    - 'CLOUDSDK_CONTAINER_CLUSTER=${_CLOUDSDK_CONTAINER_CLUSTER}'
  args:
    - '-c'
    - |
      gcloud container clusters get-credentials \
        --project="${PROJECT_ID}" --zone="${_CLOUDSDK_COMPUTE_ZONE}" "${_CLOUDSDK_CONTAINER_CLUSTER}"

      cat <<EOF > patch.yaml
      spec:
        template:
          spec:
            containers:
              - name: ${_APP_NAME}
                image: gcr.io/${PROJECT_ID}/${_APP_NAME}:${SHORT_SHA}
      EOF

      kubectl patch --local -o yaml \
        -f k8s/deployment.yaml \
        -p "$(cat patch.yaml)" \
        > deployment.yaml

      mv deployment.yaml k8s/deployment.yaml
```

Apply change to the GKE cluster:
```
# Apply change
- id: 'Apply update to cluster'
  name: 'gcr.io/cloud-builders/kubectl'
  args: [ 'apply', '-f', 'k8s/']
  env:
    - 'CLOUDSDK_COMPUTE_ZONE=${_CLOUDSDK_COMPUTE_ZONE}'
    - 'CLOUDSDK_CONTAINER_CLUSTER=${_CLOUDSDK_CONTAINER_CLUSTER}'
```

Tell the build that you created an image:
```
# Associate image that was pushed to GCR with the build history UI
images:
- 'gcr.io/$PROJECT_ID/$_APP_NAME:$SHORT_SHA'
```

_Save the file_

### Test the pipeline

Manually trigger a build from the CLI
```
gcloud container builds submit . \
    --config cloudbuild.yaml \
    --substitutions \
        _APP_NAME=${APP_NAME},_CLOUDSDK_COMPUTE_ZONE=${COMPUTE_ZONE},_CLOUDSDK_CONTAINER_CLUSTER=${CLUSTER_NAME},SHORT_SHA=xxx
```

See if it worked:
```
open ${URL}
```

### Get the app url
List Service
```
kubectl get service ${APP_NAME}
```

Note the external IP address once it's provisioned. Save it for later.
```
URL=http://<service-external-ip>
```

## Create the Trigger

We're going to create a build trigger that will kick off the build and deploy pipeline on changes to source code.

### Get your environment variable values
```
echo ${APP_NAME} ${COMPUTE_ZONE} ${CLUSTER_NAME}
```

### Go to Build Triggers page in Cloud Console
```
open https://console.cloud.google.com/gcr/triggers?project=${PROJECT_ID}
```

Follow prompts to OAuth into GitHub and select your repo.

Create trigger with following:

| Field                 | Value        |
| -------------          |-------------|
| Name                   | Deploy on push to master |
| Trigger type           | branch      |
| Branch | master        |
| Build configuration    | cloudbuild.yaml      |
| cloudbuild.yaml location | cloudbuild.yaml      |
| Substitution variables | _CLOUDSDK_CONTAINER_CLUSTER: <CLUSTER_NAME> |
|                        | _CLOUDSDK_COMPUTE_ZONE: <COMPUTE_ZONE> |
|                        | _APP_NAME: <_APP_NAME> |

_Save Trigger_

### Test the Trigger

Update the hello message at `app/lib/get-welcome-message.js`

```
git add .
git commit -m 'your message'
git push
```

A new build should kick off. When complete you should see your new welcome message.

Check build status
```
open https://console.cloud.google.com/gcr/builds?project=${PROJECT_ID}
```

Check that your change is live
```
open ${URL}
```

## Next Steps

This was intended as a quickstart codelab for familiarizing yourself with GKE, GCB, and setting up a CICD pipeline.

For a more real-world pipeline, see this [pipeline tutorial](https://github.com/kelseyhightower/pipeline) or evolve this project and implement some of the following:

- Browse the [supported](https://github.com/GoogleCloudPlatform/cloud-builders) and [community contributed](https://github.com/GoogleCloudPlatform/cloud-builders-community) builder images to get a sense of available functionality
- Speed up your build by pulling in your previously built image and doing a --cache-from build
- Commit updates to manifest files back to repo to keep as source of truth. Use hub CLI tool to commit changes back to repo from build.
- Create multiple cluster like qa, staging, and prod, and create additional build triggers connecting them, e.g. deploy to qa on push to a feature branch, push to prod on git tag.
- Separate infrastructure manifest files from application code
- Use PRs as manual gates for promoting changes to prod without rebuilding
- See Kelsey Hightower's production-ready [pipeline tutorial](https://github.com/kelseyhightower/pipeline) for an example of these and other best practices

## Cleanup
Delete the GCP Project:
```
gcloud projects delete ${PROJECT_ID}
```

Delete the GitHub repo
```
GITHUB_USERNAME=christophersanson
REPO=gcb-gke-codelab
```
```
curl -X DELETE "https://api.github.com/repos/${GITHUB_USERNAME}/${repo}"
```