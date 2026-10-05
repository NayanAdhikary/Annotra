#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:8000}"
TOKEN="${TOKEN:?set TOKEN env var}"
TASK_ID="${TASK_ID:?set TASK_ID}"
IMAGE_ID="${IMAGE_ID:?set IMAGE_ID}"

echo "=== B1 — GET /api/tasks/$TASK_ID ==="
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "%{time_total}\n" \
    -H "Authorization: Bearer $TOKEN" \
    "$API/api/tasks/$TASK_ID"
done | sort -n | awk '{a[NR]=$1} END {print "  median:", a[int(NR/2)+1]}'

echo "=== B2 — GET annotations (all) ==="
curl -s -o /dev/null -w "  time: %{time_total}s\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$API/api/tasks/$TASK_ID/annotations"

echo "  size:"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/api/tasks/$TASK_ID/annotations" | wc -c

echo "=== B2b — GET annotations (per image, 500 limit) ==="
curl -s -o /dev/null -w "  time: %{time_total}s\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$API/api/tasks/$TASK_ID/annotations?image_id=$IMAGE_ID&limit=500"

echo "=== B3 — GET /api/me/tasks ==="
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "%{time_total}\n" \
    -H "Authorization: Bearer $TOKEN" \
    "$API/api/me/tasks"
done | sort -n | awk '{a[NR]=$1} END {print "  median:", a[int(NR/2)+1]}'

echo "=== B4 — GET /api/projects ==="
curl -s -o /dev/null -w "  time: %{time_total}s\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$API/api/projects"

echo "=== B5 — GET review queue ==="
curl -s -o /dev/null -w "  time: %{time_total}s\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$API/api/tasks/$TASK_ID/review-queue"
