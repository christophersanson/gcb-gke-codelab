# Simple GCB to GKE CICD Pipeline Codelab

## Setup

### Install Cloud SDK, git and kubectl

- [git](https://git-scm.com/downloads) 2.14.0+
- [gcloud](https://cloud.google.com/sdk) 179.0.0+
- Install kubectl with Cloud SDK:
    ```
    gcloud components install kubectl
    ``` 

### Create a GCP project

Create a new GCP project and capture the projectId in the PROJECT_ID env var:
```
PROJECT_NAME=gke-pipeline
```
```
PROJECT_ID=$(gcloud projects create --name "${PROJECT_NAME}" --format='value(projectId)')
```
#### At the prompt type 'y' to accept generated project id.

---
Set the default project:
```
gcloud config set project ${PROJECT_ID}
```

---
Set the default zone:
```
COMPUTE_ZONE=us-west1-c
```
```
gcloud config set compute/zone ${COMPUTE_ZONE}
```

---
Ensure the default credentials are available on your local machine:
```
gcloud auth application-default login
```

---
Enable Billing on your project:

Mac
```
open https://console.developers.google.com/project/${PROJECT_ID}/settings
```
#### Use xdg-open with Linux

---
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
##### Use `gcloud services list --enabled` to check progress

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

---
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
kubectl create -f k8s/
```

### Create a cloudbuild.yaml file

TODO

```
touch cloudbuild.yaml
```
#### Open cloudbuild.yaml in your favorite editor
...

### Test the pipeline

```
gcloud container builds submit . \
    --config cloudbuild-example.yaml \
    --substitutions \
        _APP_NAME=${APP_NAME},_CLOUDSDK_COMPUTE_ZONE=${COMPUTE_ZONE},_CLOUDSDK_CONTAINER_CLUSTER=${CLUSTER_NAME},SHORT_SHA=xxx
```

## Create the Trigger


## Cleanup

## Next Steps
- Keep k8s manifest files in repo under version control
- Commit updates to manifest files back to repo to keep as source of truth
- Add multiple environments - qa, staging, prod
- Separate infrastructure manifest files from application code
- Add manifest files for Services, ConfigMaps, etc
- Use PRs as manual gates for promoting changes to prod without rebuilding
- See Kelsey Hightower's production-ready pipeline tutorial for implementations of these best practices
