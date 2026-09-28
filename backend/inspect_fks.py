import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import MetaData, Table, inspect
import sys

async def main():
    engine = create_async_engine("sqlite+aiosqlite:///annotra.db")
    async with engine.connect() as conn:
        def do_inspect(conn):
            inspector = inspect(conn)
            print("Tasks FKs:")
            print(inspector.get_foreign_keys('tasks'))
        await conn.run_sync(do_inspect)
        
asyncio.run(main())
