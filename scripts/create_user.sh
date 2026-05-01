#!/bin/bash

USERNAME=$1

# check if user exists
if id "$USERNAME" &>/dev/null; then
    echo "User $USERNAME already exists."
else
    sudo adduser "$USERNAME"
    sudo usermod -aG wheel "$USERNAME"
    echo "User $USERNAME created and added to sudo group."
fi
