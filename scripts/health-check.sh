#!/usr/bin/env bash
set -euo pipefail

WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
DOMAIN="${DOMAIN:-annotra.example.com}"

alert() {
  local msg="$1"
  echo "[ALERT] $msg"
  if [ -n "${WEBHOOK_URL}" ]; then
    curl -fsS -X POST "${WEBHOOK_URL}"       -H 'Content-Type: application/json'       -d "{\"text\":\"🔴 Annotra: ${msg}\"}" || true
  fi
}

# Disk usage
USED=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "${USED}" -gt 85 ]; then
  alert "Disk usage at ${USED}%"
fi

# Redis reachable
if ! docker compose -f /opt/annotra/docker-compose.prod.yml exec -T redis redis-cli ping | grep -q PONG; then
  alert "Redis not responding"
fi

# Celery workers
WORKERS=$(docker compose -f /opt/annotra/docker-compose.prod.yml ps --services --filter "status=running" | grep -c worker)
if [ "${WORKERS}" -lt 3 ]; then
  alert "Only ${WORKERS}/3 Celery workers running"
fi

# Recent API 5xx spike (from Caddy access log)
ERRORS=$(grep -c '"status":5' /var/lib/docker/volumes/annotra_caddy-data/_data/access.log 2>/dev/null || echo 0)
if [ "${ERRORS}" -gt 50 ]; then
  alert "${ERRORS} 5xx responses in Caddy access log — investigate"
fi

echo "[OK] $(date -u +%FT%TZ)"
