FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 5000 = Flask web app, 8000 = Prometheus metrics endpoint
EXPOSE 5000 8000

CMD ["python", "app.py"]
