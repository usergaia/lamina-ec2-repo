import os
from flask import Flask, jsonify
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# setup .env variables
db = mysql.connector.connect(
    host=os.getenv("DB_HOST"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASS"),
    database=os.getenv("DB_NAME")
)

@app.route("/")
def home():
    return "Cloud App Connected to MariaDB!"

@app.route("/users")
def users():
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users")
    return jsonify(cursor.fetchall())

# try this in your local device by using ec2 public ip instead of 127.0.0.1

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
