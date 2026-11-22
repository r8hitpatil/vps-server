#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "======================================================="
echo "🚀 Starting NestJS Booking Server (No Docker)"
echo "======================================================="

# Ensure data and redis-data directories exist
mkdir -p redis-data data

# 1. Start Redis if not already running
if "$PROJECT_DIR/bin/redis-cli" ping >/dev/null 2>&1; then
  echo "⚡ Redis is already running on port 6379."
else
  echo "⚡ Starting local Redis server daemon on port 6379..."
  "$PROJECT_DIR/bin/redis-server" \
    --daemonize yes \
    --port 6379 \
    --dir "$PROJECT_DIR/redis-data" \
    --pidfile "$PROJECT_DIR/redis-data/redis.pid" \
    --logfile "$PROJECT_DIR/redis-data/redis.log"
  sleep 1
  echo "⚡ Redis server started successfully (Status: $("$PROJECT_DIR/bin/redis-cli" ping))."
fi

# 2. Check if build exists, compile if needed
if [ ! -d "dist" ]; then
  echo "🔨 Building NestJS project..."
  npm run build
fi

# 3. Start NestJS
echo "📦 Starting NestJS application..."
exec npm run start:prod
