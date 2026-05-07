#!/bin/bash
set -e

echo "Updating system..."
sudo dnf update -y

echo "Installing essential tools..."
sudo dnf install -y git

echo "Installing MariaDB server..."
sudo dnf install mariadb105-server -y

echo "Starting MariaDB..."
sudo systemctl start mariadb
sudo systemctl enable mariadb

echo "Installing Python tools for Flask app..."
sudo dnf install python3 python3-pip -y

echo "Setup complete!"
echo "Next steps:"
echo "1. Run: sudo mysql_secure_installation"
echo "2. Run: sudo mysql"
echo "3. Create cloud_db and cloud_user using the SQL commands from your instructions."
