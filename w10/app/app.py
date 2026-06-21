from flask import Flask
from prometheus_client import start_http_server, Counter, Gauge

from cost_analysis import total_cost

app = Flask(__name__)

REQUEST_COUNT = Counter("app_requests_total", "Total App Requests")
CLOUD_COST = Gauge("cloud_estimated_cost", "Estimated Cloud Cost")

hits = 0


@app.route("/")
def home():
    global hits
    hits += 1
    REQUEST_COUNT.inc()
    return f"""
    <h1>Cloud Service Running</h1>
    <p>Requests served since startup: <b>{hits}</b></p>
    <p>Refresh the page and watch the number climb. The same count is exported
    to Prometheus as <code>app_requests_total</code>, and the
    <b>Application</b> panels in Grafana update within a few seconds.</p>
    <p>Raw metrics this service exposes: <a href="http://localhost:8000/">localhost:8000</a></p>
    """


if __name__ == "__main__":
    CLOUD_COST.set(total_cost)
    start_http_server(8000)
    app.run(host="0.0.0.0", port=5000)
