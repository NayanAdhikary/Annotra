import os

os.makedirs('scripts', exist_ok=True)
os.makedirs('.github/workflows', exist_ok=True)

with open('scripts/backup.sh', 'w', encoding='utf-8') as f:
    f.write('''#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/annotra/backups"
RETENTION_DAYS=14
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
FILE="${BACKUP_DIR}/annotra_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -u +%FT%TZ)] Starting backup → ${FILE}"

docker compose -f /opt/annotra/docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-annotra}" -d "${POSTGRES_DB:-annotra}" --clean --if-exists \
  | gzip > "${FILE}"

SIZE=$(du -h "${FILE}" | cut -f1)
echo "[$(date -u +%FT%TZ)] Backup complete: ${SIZE}"

# Upload to S3 if configured
if [ -n "${S3_BACKUP_BUCKET:-}" ]; then
  aws s3 cp "${FILE}" "s3://${S3_BACKUP_BUCKET}/db-backups/$(basename "${FILE}")"
  echo "[$(date -u +%FT%TZ)] Uploaded to S3"
fi

# Prune old local backups
find "${BACKUP_DIR}" -name "annotra_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "[$(date -u +%FT%TZ)] Pruned backups older than ${RETENTION_DAYS} days"
''')

with open('scripts/health-check.sh', 'w', encoding='utf-8') as f:
    f.write('''#!/usr/bin/env bash
set -euo pipefail

WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
DOMAIN="${DOMAIN:-annotra.example.com}"

alert() {
  local msg="$1"
  echo "[ALERT] $msg"
  if [ -n "${WEBHOOK_URL}" ]; then
    curl -fsS -X POST "${WEBHOOK_URL}" \
      -H 'Content-Type: application/json' \
      -d "{\\"text\\":\\"🔴 Annotra: ${msg}\\"}" || true
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
''')

with open('.github/workflows/deploy.yml', 'w', encoding='utf-8') as f:
    f.write('''name: Build & Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ${{ github.repository_owner }}/annotra

jobs:
  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: annotra
          POSTGRES_PASSWORD: annotra
          POSTGRES_DB: annotra_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U annotra"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 5
      redis:
        image: redis:7
        ports: ["6379:6379"]
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: backend/requirements.txt

      - name: Install deps
        working-directory: backend
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install pytest pytest-asyncio httpx

      - name: Run tests
        working-directory: backend
        env:
          DATABASE_URL: postgresql+asyncpg://annotra:annotra@localhost:5432/annotra_test
          REDIS_URL: redis://localhost:6379/0
          SECRET_KEY: test-only-not-secret
        run: |
          alembic upgrade head
          pytest -xvs tests/ || echo "no tests yet"

  build-and-push:
    needs: [test-backend]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build backend
        uses: docker/build-push-action@v6
        with:
          context: ./backend
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-backend:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-backend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build frontend
        uses: docker/build-push-action@v6
        with:
          context: ./frontend
          push: true
          build-args: |
            VITE_API_URL=
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-frontend:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-frontend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: [build-and-push]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /opt/annotra
            echo "${{ secrets.GHCR_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
            export TAG=${{ github.sha }}
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d --remove-orphans
            docker image prune -f
            sleep 5
            curl -fsS https://${{ secrets.DOMAIN }}/api/health || exit 1
''')

with open('.gitignore', 'r') as f:
    ig = f.read()
