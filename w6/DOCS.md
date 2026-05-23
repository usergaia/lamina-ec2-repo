# DOCUMENTATION

Week 6 focuses on deploying the Flask app from Week 5 to a local Kubernetes cluster, configuring health probes, and enabling automatic horizontal scaling.

The Flask app from `w5/src/` is reused as-is, with one small additive change: a `/ready` endpoint for the readiness probe. The Docker image is built and published automatically to GitHub Container Registry (GHCR) by a GitHub Action, so any cluster can pull it without local builds.

## Quick Start

For anyone cloning this repository who wants to run the app immediately without reading the full guide.

Prerequisites: Docker, `kubectl`, and Minikube installed.

```powershell
# 1. Start a local cluster
minikube start --driver=docker

# 2. Enable metrics-server (required for HPA)
minikube addons enable metrics-server

# 3. Apply all Kubernetes manifests
kubectl apply -f w6/deployment.yaml
kubectl apply -f w6/service.yaml
kubectl apply -f w6/hpa.yaml

# 4. Wait for the pod to be ready, then open the app
kubectl get pods                          # STATUS Running, READY 1/1
minikube service lamina-flask-service     # opens the app in the browser
```

The Docker image is pulled automatically from GHCR (`ghcr.io/usergaia/lamina-flask:1.0`); no local build step is needed.

To tear everything down later, see [Section VII](#vii-cleanup).

## I. Cluster Setup

A local Kubernetes cluster is required to run Kubernetes objects. Minikube was chosen because it works on Windows with the Docker driver and matches the curriculum's commands.

Verification commands:

```powershell
docker --version
kubectl version --client
minikube version
```

Starting the cluster:

```powershell
minikube start --driver=docker
kubectl get nodes
```

Result:

The cluster started successfully with one node named `minikube` in `Ready` state, acting as both control plane and worker.

## II. Containerizing for Kubernetes

The same Dockerfile from Week 5 is reused (`w5/Dockerfile`). Instead of building locally and side-loading into Minikube, a GitHub Action automatically builds and publishes the image to GHCR on every push.

The Flask app's `/ready` endpoint was added to `w5/src/app.py`:

```python
@app.route("/ready")
def ready():
    return jsonify({"status": "Ready to receive traffics"})
```

GitHub Action workflow at `.github/workflows/build-and-push.yml`:

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main]
    paths:
      - "w5/**"
      - ".github/workflows/build-and-push.yml"
  workflow_dispatch:

permissions:
  contents: read
  packages: write

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository_owner }}/lamina-flask

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v5
        with:
          context: ./w5
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:1.0
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
```

After pushing, the GHCR package was made public via the GitHub UI:

```
github.com/usergaia?tab=packages → lamina-flask → Package settings → Change visibility → Public
```

Result:

The image is now available at `ghcr.io/usergaia/lamina-flask:1.0` and can be pulled by any Kubernetes cluster with internet access. Anyone cloning the repository can run `kubectl apply` directly without rebuilding the image locally.

## III. Deployment

A Kubernetes Deployment manages the desired number of pod replicas, recreating them if they fail. The deployment manifest defines what container to run, how many copies, and which labels identify "its" pods.

File: `w6/deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lamina-flask
spec:
  replicas: 1
  selector:
    matchLabels:
      app: lamina-flask
  template:
    metadata:
      labels:
        app: lamina-flask
    spec:
      containers:
        - name: lamina-flask
          image: ghcr.io/usergaia/lamina-flask:1.0
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 5000
```

Apply and verify:

```powershell
kubectl apply -f w6/deployment.yaml
kubectl get deploy
kubectl get pods
```

Result:

The Deployment was created and one pod transitioned from `ContainerCreating` to `Running` within ~30 seconds. The image was pulled from GHCR on first run and cached in Minikube's local image cache.

## IV. Service

The pod's IP is private to the cluster — external clients cannot reach it. A `NodePort` Service opens a port on the cluster node and forwards traffic to the matched pods.

File: `w6/service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: lamina-flask-service
spec:
  type: NodePort
  selector:
    app: lamina-flask
  ports:
    - port: 5000
      targetPort: 5000
```

The Service's `selector` (`app: lamina-flask`) matches the labels in the Deployment's pod template — that is how the two objects are connected.

Apply and access:

```powershell
kubectl apply -f w6/service.yaml
kubectl get svc
minikube service lamina-flask-service
```

Result:

Minikube opened the browser to a tunneled localhost URL (`http://127.0.0.1:<random-port>`). The Flask app's index page rendered correctly. Both `/health` and `/ready` returned JSON responses as expected.

## V. Health Probes

Kubernetes does not poll application endpoints by default. Liveness and readiness probes opt-in to health monitoring:

- **Liveness probe** — if it fails repeatedly, K8s kills and restarts the container.
- **Readiness probe** — if it fails, K8s stops routing traffic to the pod (but does not restart it).

Added to `w6/deployment.yaml` under the container spec:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 5000
  initialDelaySeconds: 5
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /ready
    port: 5000
  initialDelaySeconds: 5
  periodSeconds: 5
```

Apply and verify:

```powershell
kubectl apply -f w6/deployment.yaml
kubectl describe pod -l app=lamina-flask
```

The `describe` output confirmed both probes were configured under the Containers section.

Self-healing test:

```powershell
kubectl delete pod -l app=lamina-flask
kubectl get pods -w
```

Result:

The Deployment immediately created a replacement pod. The new pod cycled `Pending → ContainerCreating → 0/1 Running → 1/1 Running`, where the gap between `0/1` and `1/1` represented the readiness probe passing before traffic was routed to it.

## VI. Horizontal Pod Autoscaler

The HPA scales the number of pods based on observed CPU usage relative to a declared CPU request.

Prerequisites:

1. **Metrics-server** enabled in the cluster to provide CPU and memory readings:

   ```powershell
   minikube addons enable metrics-server
   ```

2. **Resource requests** declared on the container — without these, HPA cannot compute "X% of what?". Added to the container spec in `w6/deployment.yaml`:

   ```yaml
   resources:
     requests:
       cpu: 100m
       memory: 64Mi
     limits:
       cpu: 200m
       memory: 128Mi
   ```

   The small CPU request (`100m`) makes the HPA more responsive to load during testing.

HPA manifest at `w6/hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: lamina-flask-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: lamina-flask
  minReplicas: 1
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 50
```

Apply:

```powershell
kubectl apply -f w6/hpa.yaml
kubectl get hpa
```

Load test using a busybox pod hitting the Service via cluster DNS:

```powershell
kubectl run load-generator --image=busybox --restart=Never -- /bin/sh -c "while true; do wget -q -O- http://lamina-flask-service:5000; done"
```

Monitoring:

```powershell
kubectl get hpa -w
kubectl get pods -w
```

Result:

Under sustained load, HPA scaled the Deployment from 1 to 5 replicas as CPU utilization crossed 50% of the per-pod request. After stopping the load generator (`kubectl delete pod load-generator`), HPA's default 5-minute scale-down stabilization window held the replica count high before gradually reducing back toward `minReplicas: 1`.

## VII. Cleanup

### Remove app resources from the cluster

These `kubectl delete` commands work on any Kubernetes cluster (Minikube, EKS, GKE, etc.) — they only affect the cluster `kubectl` is currently configured to talk to.

```powershell
kubectl delete -f w6/hpa.yaml
kubectl delete -f w6/service.yaml
kubectl delete -f w6/deployment.yaml
```

### Verify resources are gone

```powershell
kubectl get all
```

Expected output after cleanup: only the cluster's built-in `service/kubernetes` remains. No deployments, pods, services, or HPAs should be listed.

### Stop the local cluster (Minikube-specific)

Stop the cluster while preserving its state for next time:

```powershell
minikube stop
```

Or delete the cluster entirely, wiping all state and freeing disk:

```powershell
minikube delete
```

The published image remains usable by any future cluster without rebuilding.
