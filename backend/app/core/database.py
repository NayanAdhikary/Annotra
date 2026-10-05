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
        pool_size=10,           # base connections kept alive (lowered for Celery headroom)
        max_overflow=5,         # burst capacity
        pool_pre_ping=True,     # detect dead connections after DB restart
        pool_recycle=1800,      # recycle every 30 min (connection lifetime)
        pool_timeout=30,        # wait at most 30s for a free connection
    )

async_session = async_sessionmaker(
    engine, class_=AsyncSession,
    expire_on_commit=False,   # avoid a refresh round-trip after every commit
)

from app.core.sql_logging import attach_slow_query_logger
attach_slow_query_logger(engine)

class Base(DeclarativeBase):
    pass
async def get_db():
    async with async_session() as session:
        yield session