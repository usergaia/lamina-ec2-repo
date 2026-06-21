# DOCUMENTATION

Week 10 stands up a local cloud-style monitoring stack on Docker. Prometheus scrapes
metrics from three sources — the host/VM (Node Exporter), the containers (cAdvisor),
and a small instrumented Flask service — and Grafana visualizes them on a single
observability dashboard. A short cost model rounds it out by publishing an estimated
cloud cost as its own metric.

The stack runs from one `docker compose up`. Grafana starts blank; the Prometheus
datasource and the dashboard are added by hand in the UI (section VI) and the
finished dashboard is exported to `dashboards/`.

> Platform note: the stack was built on Windows 11 with Docker Desktop, so commands
> use `docker compose` (v2). Node Exporter reports the Docker Desktop Linux VM's
> metrics rather than the Windows host, and containers reach each other by service
> name, so no `host.docker.internal` is needed.

## Monitoring Architecture

```
python_app   (application metrics)  ──┐
Node Exporter (system metrics)        ├──►  Prometheus  ──►  Grafana dashboard
cAdvisor     (container metrics)      ┘     (scrape + store)   ├── Infrastructure
cost gauge   (estimated cost)                                  ├── Application
                                                               ├── Containers
                                                               └── Cost Analytics
```

| Service       | Role                     | URL                   |
| ------------- | ------------------------ | --------------------- |
| Prometheus    | Metrics collector        | http://localhost:9090 |
| Grafana       | Visualization dashboard  | http://localhost:3000 |
| Node Exporter | Host/VM system metrics   | http://localhost:9100 |
| cAdvisor      | Container metrics        | http://localhost:8080 |
| python_app    | Sample Flask service     | http://localhost:5000 |

## Quick Start

Prerequisites: Docker Desktop running.

```powershell
cd w10
docker compose up -d --build
docker compose ps          # prometheus, grafana, node_exporter, cadvisor, python_app
```

Then open:

- Prometheus — http://localhost:9090 (targets at `/targets`)
- Grafana — http://localhost:3000 (admin / admin), dashboard **Grafana Dashboard | W10**
- Sample app — http://localhost:5000 (refresh a few times to grow the counter)
- cAdvisor — http://localhost:8080

Tear it down with `docker compose down` (add `-v` to also drop the Grafana volume).

## I. The monitoring stack

`docker-compose.yml` defines five services on one network:

```
prometheus      metrics collector            :9090
grafana         dashboards                   :3000
node_exporter   host/VM system metrics       :9100
cadvisor        per-container metrics        :8080
python_app      sample Flask service         :5000  (+ :8000 metrics)
```

Grafana keeps its state (datasource, dashboards) in a named volume so the work you
do in the UI survives a restart. cAdvisor runs privileged with read-only mounts of
the host paths it needs to read container stats.

**Result:** `docker compose ps` shows all five services `Up`.

## II. Collecting metrics with Prometheus

`prometheus.yml` scrapes every source on a 5-second interval. The targets are
addressed by Compose service name:

```yaml
global:
  scrape_interval: 5s

scrape_configs:
  - job_name: "node_exporter"
    static_configs: [{ targets: ["node_exporter:9100"] }]
  - job_name: "cadvisor"
    static_configs: [{ targets: ["cadvisor:8080"] }]
  - job_name: "python_app"
    static_configs: [{ targets: ["python_app:8000"] }]
```

Node Exporter supplies the system metrics; example queries:

```promql
100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
node_memory_MemAvailable_bytes
node_filesystem_avail_bytes
```

**Result:** http://localhost:9090/targets shows every job `UP`.

## III. The instrumented service

`app/app.py` is a small Flask service instrumented with `prometheus_client`. It
serves `/` and increments a counter on each request, and it starts a separate
metrics server on port 8000 for Prometheus to scrape.

```python
REQUEST_COUNT = Counter("app_requests_total", "Total App Requests")

@app.route("/")
def home():
    REQUEST_COUNT.inc()
    return "Cloud Service Running"

start_http_server(8000)
app.run(host="0.0.0.0", port=5000)
```

Refresh http://localhost:5000 a few times, then query `app_requests_total` (or
`rate(app_requests_total[1m])`) in Prometheus.

**Result:** the counter climbs with each request to the service.

## IV. Container metrics with cAdvisor

cAdvisor exposes per-container CPU, memory, and I/O, scraped via the `cadvisor:8080`
target. It needs no application changes — it observes the Docker engine directly.

```promql
rate(container_cpu_usage_seconds_total[1m])
container_memory_usage_bytes
```

**Result:** http://localhost:8080 lists the running containers, and the metrics above
return per-container series in Prometheus.

## V. The cost model

`app/cost_analysis.py` is a small pandas script that estimates cloud cost from usage
and a per-unit price for compute, storage, and network:

```python
df["Total_Cost"] = df["Usage"] * df["Cost_per_unit"]
print("Total Cloud Cost:", df["Total_Cost"].sum())
```

Run it inside the container:

```powershell
docker compose exec python_app python cost_analysis.py
```

The same total is published by the service as the `cloud_estimated_cost` gauge so it
can be charted alongside the live metrics.

**Result:** the script prints the per-service breakdown and total, and
`cloud_estimated_cost` is queryable in Prometheus.

Grafana starts empty, so the dashboard is built by hand and then exported to
`dashboards/`.

### Step 1 — Add the Prometheus datasource

**Connections → Data sources → Add data source → Prometheus.** Set the URL to
`http://prometheus:9090` (the service name, since Grafana and Prometheus share the
Compose network), then **Save & test** — it should report the datasource is working.

### Step 2 — Build the panels

**Dashboards → New → New dashboard → Add visualization** (pick the Prometheus
datasource), enter a query, give the panel a title, and **Apply**. Repeat per panel,
grouped into four rows:

| Row            | Panel              | Query |
| -------------- | ------------------ | ----- |
| Infrastructure | CPU Usage %        | `100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)` |
| Infrastructure | Memory Used        | `node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes` |
| Infrastructure | Disk Available     | `node_filesystem_avail_bytes` |
| Application    | Request Rate       | `rate(app_requests_total[1m])` |
| Application    | Total Requests     | `app_requests_total` |
| Containers     | Container CPU      | `rate(container_cpu_usage_seconds_total[1m])` |
| Containers     | Container Memory   | `container_memory_usage_bytes` |
| Cost Analytics | Estimated Cost     | `cloud_estimated_cost` |

Save the dashboard as **Grafana Dashboard | W10**.

### Step 3 — Export it

**Export → Export as code → Download file**, then save the downloaded JSON as
`dashboards/grafana-config.json`. That export is the dashboard deliverable.

**Result:** the dashboard shows every panel populated, and `dashboards/grafana-config.json`
can be re-imported into a fresh Grafana via **Dashboards → Import**.

## VII. Cleanup

```powershell
docker compose down        # add -v to also remove the Grafana volume
```

**Result:** all five containers stop and are removed; images remain cached for the
next run.
