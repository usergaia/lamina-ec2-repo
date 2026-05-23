from datetime import datetime

from flask import Flask, jsonify, render_template

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "message": "Flask API is up and running. testestest12341234"
    })

@app.route("/ready")
def ready():
    return jsonify({"status": "Ready to receive traffics"})

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
