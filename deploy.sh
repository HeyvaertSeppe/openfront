#!/bin/bash
set -e

REPO_DIR="/opt/openfront"
COMPOSE_FILE="$REPO_DIR/docker-compose.yml"

echo "[$(date)] Auto-deploy starting..."

cd "$REPO_DIR"
git pull origin main

echo "[$(date)] Rebuilding Docker image..."
docker compose -f "$COMPOSE_FILE" build --no-cache

echo "[$(date)] Restarting container..."
docker compose -f "$COMPOSE_FILE" up -d

echo "[$(date)] Waiting for server..."
sleep 5

if docker compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
  echo "[$(date)] Deploy successful!"
else
  echo "[$(date)] ERROR: Container failed to start:"
  docker compose -f "$COMPOSE_FILE" logs --tail 50
  exit 1
fi
echo "[$(date)] Done."
