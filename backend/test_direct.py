import asyncio
from app.core.database import async_session
from app.models.task import Task
from app.routers.projects import _task_response
from sqlalchemy import select

async def main():
    async with async_session() as db:
        task = await db.get(Task, 1)
        if not task:
            print("no task")
            return
        
        try:
            res = await _task_response(db, task)
            print("Response success!")
        except Exception as e:
            import traceback
            traceback.print_exc()

asyncio.run(main())
