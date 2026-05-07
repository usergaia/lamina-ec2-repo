#!/bin/bash
set -e

echo "Updating system..."
sudo dnf update -y

echo "Installing essential tools..."
sudo dnf install -y git

echo "Installing MariaDB server..."
sudo dnf install -y mariadb105-server

echo "Starting MariaDB..."
sudo systemctl start mariadb
sudo systemctl enable mariadb

echo "Installing Flask dependencies..."
sudo dnf install -y python3 python3-pip
python3 -m pip install --user flask mysql-connector-python
python3 -m pip install --user flask mysql-connector-python python-dotenv

echo "Setup complete!"

