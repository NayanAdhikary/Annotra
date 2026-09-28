import asyncio
import json
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.security import create_access_token

async def main():
    engine = create_async_engine("sqlite+aiosqlite:///annotra.db")
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT id, email, role FROM users LIMIT 1"))
        user = res.fetchone()
        if user:
            token = create_access_token(data={"sub": str(user.id), "role": user.role})
            print(token)
        else:
            print("No users found")
            
asyncio.run(main())
