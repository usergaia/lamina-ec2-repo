# DOCUMENTATION

## I. Understanding Docker Images and Containers

A Docker image is a packaged template that contains everything needed to run an application, such as the runtime, dependencies, and application files.

A Docker container is a running instance of an image. The image is like the blueprint, while the container is the actual running application.

Commands used:

```bash
docker pull python:3.11
docker run -d -p 8080:80 --name basic-nginx nginx
docker ps
docker stop basic-nginx
docker rm basic-nginx
```

Result:

The Nginx container was successfully run and accessed in the browser at:

```txt
http://localhost:8080
```

## II. Dockerfile Basics

A Dockerfile is a file that contains instructions for building a Docker image.

Common Dockerfile instructions:

- `FROM`: sets the base image
- `WORKDIR`: sets the working directory inside the container
- `COPY`: copies files from the local machine into the image
- `RUN`: runs commands while building the image
- `EXPOSE`: documents the port used by the application
- `CMD`: sets the command that runs when the container starts

Dockerfile used:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY src/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ .

EXPOSE 5000

CMD ["python", "app.py"]
```

Build command:

```bash
docker build -t dockered-flask .
```

Result:

The Flask Docker image was successfully built.

## III. Running and Testing Docker Containers

The Flask container was started using:

```bash
docker run -d -p 5000:5000 --name flask-test dockered-flask
```

The application was accessed in the browser at:

```txt
http://localhost:5000
```

The health endpoint was tested at:

```txt
http://localhost:5000/health
```

Container logs were checked using:

```bash
docker logs flask-test
```

The container was stopped and removed using:

```bash
docker stop flask-test
docker rm flask-test
```

Result:

The Flask application ran successfully inside a Docker container and was accessible from the browser.

## IV. Docker Volumes and Networking

Docker volumes allow files from the host machine to be shared with a container. This is useful during development because changes made locally can be reflected inside the container.

Volume command used:

```bash
docker run -d -p 5000:5000 -v "$(pwd):/app" --name docker-debug-w5 dockered-flask
```

Since the working directory was:

```txt
C:\_code\_projects\lamina-cc\w5\src
```

the current folder was mounted into the container's `/app` directory.

Result:

Changes were tested by refreshing the browser and by clicking the Refresh Status button in the web app. The button called the Flask `/health` endpoint again, which showed that the container was reading the updated files through the mounted volume.

## V. Cleanup

Cleanup commands used:

```bash
docker ps -a
docker stop flask-test
docker rm flask-test
docker stop docker-debug-w5
docker rm docker-debug-w5
```
