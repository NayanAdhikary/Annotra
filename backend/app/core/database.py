from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

# SQLite needs StaticPool (single shared in-process connection) to avoid
# 'database is locked' errors and unnecessary overhead from pool management.
# For Postgres in production, pool_size/max_overflow are appropriate.
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if _is_sqlite:
    from sqlalchemy.pool import StaticPool
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_size=20,           # base connections kept alive
        max_overflow=10,        # burst capacity
        pool_pre_ping=True,     # detect dead connections after DB restart
        pool_recycle=1800,      # recycle every 30 min (connection lifetime)
        pool_timeout=30,        # wait at most 30s for a free connection
    )

async_session = async_sessionmaker(
    engine, class_=AsyncSession,
    expire_on_commit=False,   # avoid a refresh round-trip after every commit
)

import logging, time
from sqlalchemy import event

logger = logging.getLogger("sql.timing")

@event.listens_for(engine.sync_engine, "before_cursor_execute")
def _before(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault("query_start", []).append(time.perf_counter())

@event.listens_for(engine.sync_engine, "after_cursor_execute")
def _after(conn, cursor, statement, parameters, context, executemany):
    total = time.perf_counter() - conn.info["query_start"].pop()
    if total > 0.5:   # log queries > 500ms
        logger.warning("SLOW QUERY %.3fs: %s", total, statement[:200])

class Base(DeclarativeBase):
    pass
async def get_db():
    async with async_session() as session:
        yield session