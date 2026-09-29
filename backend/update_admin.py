import os

def update_admin():
    with open('app/routers/admin.py', 'r', encoding='utf-8') as f:
        content = f.read()

    search = '''@router.get("/health", response_model=HealthReport)
async def health(db: AsyncSession = Depends(get_db), _: User = ADMIN_ONLY):
    report = HealthReport(
        database=False, redis=False, storage_writable=False,
        celery_workers=0, pending_jobs=0,
        versions={"api": "0.1.0"},
    )

    # Database
    try:
        await asyncio.wait_for(db.execute(select(1)), timeout=1.0)
        report.database = True
    except Exception:
        report.database = False

    # Redis + queue depth
    try:
        r = get_redis()
        await asyncio.wait_for(r.ping(), timeout=1.0)
        report.redis = True
        try:
            report.pending_jobs = (
                await asyncio.wait_for(r.llen("celery"), timeout=1.0)
            )
        except Exception:
            report.pending_jobs = 0
    except Exception:
        report.redis = False

    # Storage
    try:
        test_path = "/data/.healthcheck"
        os.makedirs("/data", exist_ok=True)
        with open(test_path, "w") as f:
            f.write("ok")
        os.remove(test_path)
        report.storage_writable = True
    except Exception:
        report.storage_writable = False

    # Celery worker count (best-effort via inspect; returns quickly or 0)
    try:
        from app.workers import celery_app
        inspect = celery_app.control.inspect(timeout=1.0)
        pong = await asyncio.to_thread(inspect.ping) or {}
        report.celery_workers = len(pong)
    except Exception:
        report.celery_workers = 0

    return report'''

    replace = '''from sqlalchemy import text
import psutil
import time
from app.main import _START_TIME

@router.get("/health")
async def health(db: AsyncSession = Depends(get_db), _: User = ADMIN_ONLY):
    t0 = time.perf_counter()
    await db.execute(text("SELECT 1"))
    db_ping_ms = int((time.perf_counter() - t0) * 1000)

    redis_ok = False
    redis_ping_ms = 0
    try:
        r = get_redis()
        t1 = time.perf_counter()
        await asyncio.wait_for(r.ping(), timeout=1.0)
        redis_ping_ms = int((time.perf_counter() - t1) * 1000)
        redis_ok = True
    except Exception:
        pass

    # DB pool stats
    from app.core.database import engine
    pool = engine.pool
    pool_stats = {
        "size": pool.size(),
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
    }

    # Disk usage
    disk = psutil.disk_usage("/data")

    celery_workers = 0
    try:
        from app.workers import celery_app
        inspect = celery_app.control.inspect(timeout=1.0)
        pong = await asyncio.to_thread(inspect.ping) or {}
        celery_workers = len(pong)
    except Exception:
        pass

    return {
        "database": {"ok": True, "ping_ms": db_ping_ms, "pool": pool_stats},
        "redis": {"ok": redis_ok, "ping_ms": redis_ping_ms},
        "celery": {"workers": celery_workers},
        "storage": {
            "total_gb": round(disk.total / 1e9, 2),
            "used_gb": round(disk.used / 1e9, 2),
            "free_gb": round(disk.free / 1e9, 2),
            "percent": disk.percent,
        },
        "uptime_sec": int(time.time() - _START_TIME),
    }'''

    # Ensure we don't have duplicate HealthReport response_model failure since the schema changed, wait, remove `response_model=HealthReport`
    content = content.replace(search, replace)
    
    with open('app/routers/admin.py', 'w', encoding='utf-8') as f:
        f.write(content)

update_admin()

with open('requirements.txt', 'r') as f:
    if 'psutil' not in f.read():
        with open('requirements.txt', 'a') as f:
            f.write('\npsutil\n')
