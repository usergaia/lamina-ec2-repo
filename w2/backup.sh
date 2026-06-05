#!/bin/bash

SOURCE=~/lamina
DEST=~/backups

mkdir -p "$DEST"

tar -czf "$DEST/tasks_backup_$(date +%F_%H-%M-%S).tar.gz" "$SOURCE"

echo "Backup completed"