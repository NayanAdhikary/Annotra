# Restore Procedure

A backup you've never restored is a hope, not a backup.

### Test the restore locally or on a scratch directory
```bash
# On a scratch machine or a temp directory
cd /tmp
gunzip -c /opt/annotra/backups/annotra_20260930_031500.sql.gz > restore.sql

# Point at a throwaway Postgres
docker run -d --name restore-test -e POSTGRES_PASSWORD=x -p 5433:5432 postgres:16
sleep 5
docker exec -i restore-test psql -U postgres -c "CREATE DATABASE annotra"
cat restore.sql | docker exec -i restore-test psql -U postgres -d annotra

# Verify counts
docker exec -i restore-test psql -U postgres -d annotra -c "SELECT COUNT(*) FROM annotations;"

# Clean up
docker rm -f restore-test
```

**Note**: Do this once a quarter as a drill.
