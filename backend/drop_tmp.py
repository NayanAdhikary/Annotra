import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import sys

async def main():
    engine = create_async_engine("sqlite+aiosqlite:///annotra.db")
    async with engine.begin() as conn:
        await conn.execute(text("DROP TABLE IF EXISTS _alembic_tmp_annotations"))
        await conn.execute(text("DROP TABLE IF EXISTS _alembic_tmp_tasks"))
        
asyncio.run(main())
