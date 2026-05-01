#!/bin/bash

echo "Updating system..."
sudo dnf update -y

echo "Installing essential tools..."
sudo dnf install git curl wget gcc gcc-c++ make -y

echo "Setup complete!"
.