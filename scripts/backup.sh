#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/annotra/backups"
RETENTION_DAYS=14
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
FILE="${BACKUP_DIR}/annotra_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -u +%FT%TZ)] Starting backup → ${FILE}"

docker compose -f /opt/annotra/docker-compose.prod.yml exec -T postgres   pg_dump -U "${POSTGRES_USER:-annotra}" -d "${POSTGRES_DB:-annotra}" --clean --if-exists   | gzip > "${FILE}"

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
