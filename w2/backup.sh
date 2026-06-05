#!/bin/bash
set -euo pipefail

SOURCE=~/lamina
DEST=~/backups
REPO="usergaia/aws-shell-automation"
STAMP=$(date +%F_%H-%M-%S)
ARCHIVE="$DEST/tasks_backup_$STAMP.tar.gz"
TAG="backup-$STAMP"

mkdir -p "$DEST"

# Archive ~/lamina. -C avoids baking the absolute home path into the tarball.
tar -czf "$ARCHIVE" -C "$(dirname "$SOURCE")" "$(basename "$SOURCE")"
echo "Backup created: $ARCHIVE"

# Publish as a GitHub Release asset (uses gh's token; creates the tag via the API).
gh release create "$TAG" "$ARCHIVE" \
  --repo "$REPO" \
  --title "Backup $STAMP" \
  --notes "Automated backup of $SOURCE from $(hostname) at $STAMP"

echo "Published to GitHub release: $TAG"
