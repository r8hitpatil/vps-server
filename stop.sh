#!/usr/bin/env bash

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "======================================================="
echo "🛑 Stopping NestJS Booking Server & Redis"
echo "======================================================="

# Stop NestJS server if running
NEST_PIDS=$(pgrep -f "dist/main" || true)
if [ -n "$NEST_PIDS" ]; then
  echo "Stopping NestJS process(es): $NEST_PIDS"
  kill $NEST_PIDS 2>/dev/null || true
fi

# Stop Redis server
if "$PROJECT_DIR/bin/redis-cli" ping >/dev/null 2>&1; then
  echo "Stopping Redis server..."
  "$PROJECT_DIR/bin/redis-cli" shutdown 2>/dev/null || true
  echo "Redis stopped."
else
  echo "Redis is not running."
fi

echo "All services stopped."
