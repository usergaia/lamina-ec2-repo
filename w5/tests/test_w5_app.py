from app import app

def test_health_ok():
    resp = app.test_client().get("/health")
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "ok"

def test_ready_ok():
    resp = app.test_client().get("/ready")
    assert resp.status_code == 200