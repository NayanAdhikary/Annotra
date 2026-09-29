import asyncio, os, random
from PIL import Image
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.models.task import Task, Project, Label, ImageAsset
from app.models.user import User
from app.models.annotation import Annotation
from app.models.task_assignment import TaskAssignment

async def setup():
    engine = create_async_engine(settings.DATABASE_URL)
    Session = async_sessionmaker(engine, class_=AsyncSession)
    
    async with Session() as db:
        # Check if user 1 exists
        res = await db.execute(text("SELECT id FROM users WHERE id=1"))
        if not res.first():
            await db.execute(text("INSERT INTO users (id, email, username, hashed_password, role, is_active) VALUES (1, 'bench@test.com', 'bench_user', 'x', 'admin', 1)"))
            
        # Check if project 1 exists
        res = await db.execute(text("SELECT id FROM projects WHERE id=1"))
        if not res.first():
            await db.execute(text("INSERT INTO projects (id, name, owner_id) VALUES (1, 'Benchmark', 1)"))
            
        # Task 9999
        res = await db.execute(text("SELECT id FROM tasks WHERE id=9999"))
        if not res.first():
            await db.execute(text("INSERT INTO tasks (id, project_id, name, status) VALUES (9999, 1, 'Bench Task', 'annotation')"))
        
        # Labels
        labels = [
            (1, 9999, "Car", "#FF0000", "[]"),
            (2, 9999, "Person", "#00FF00", "[]"),
            (3, 9999, "Bike", "#0000FF", "[]")
        ]
        for l in labels:
            res = await db.execute(text(f"SELECT id FROM labels WHERE id={l[0]}"))
            if not res.first():
                await db.execute(text("INSERT INTO labels (id, task_id, name, color, attributes) VALUES (:1, :2, :3, :4, :5)"),
                                {"1": l[0], "2": l[1], "3": l[2], "4": l[3], "5": l[4]})
                                
        # Create tasks 9901 to 9950 for B3
        for i in range(9901, 9951):
            res = await db.execute(text(f"SELECT id FROM tasks WHERE id={i}"))
            if not res.first():
                await db.execute(text(f"INSERT INTO tasks (id, project_id, name, status) VALUES ({i}, 1, 'Bench Task {i}', 'annotation')"))
                
            res = await db.execute(text(f"SELECT id FROM task_assignments WHERE task_id={i} AND user_id=1"))
            if not res.first():
                await db.execute(text(f"INSERT INTO task_assignments (id, task_id, user_id, role) VALUES ({i}, {i}, 1, 'annotator')"))
                
        await db.commit()
        
    print("DB entities setup complete.")

def gen_images():
    outdir = "data/images/9999"
    os.makedirs(outdir, exist_ok=True)
    img = Image.new("RGB", (640, 480), color=(120, 120, 120))
    for i in range(10_000):
        if not os.path.exists(f"{outdir}/frame_{i:05d}.jpg"):
            img.save(f"{outdir}/frame_{i:05d}.jpg", quality=60)
    print("images generated")

async def gen_image_assets():
    engine = create_async_engine(settings.DATABASE_URL)
    Session = async_sessionmaker(engine, class_=AsyncSession)
    async with Session() as db:
        res = await db.execute(text("SELECT count(*) FROM image_assets WHERE task_id=9999"))
        count = res.scalar()
        if count < 10000:
            await db.execute(text("DELETE FROM image_assets WHERE task_id=9999"))
            await db.commit()
            batch = []
            for i in range(1, 10001):
                batch.append(ImageAsset(
                    id=i,
                    task_id=9999,
                    filename=f"frame_{i-1:05d}.jpg",
                    width=640,
                    height=480,
                    storage_path=f"data/images/9999/frame_{i-1:05d}.jpg"
                ))
                if len(batch) >= 2000:
                    db.add_all(batch)
                    await db.commit()
                    batch = []
            if batch:
                db.add_all(batch)
                await db.commit()
        print("image assets generated")

async def seed_annotations(task_id: int, image_ids: list[int], label_ids: list[int], n=500_000):
    engine = create_async_engine(settings.DATABASE_URL)
    Session = async_sessionmaker(engine, class_=AsyncSession)
    
    async with Session() as db:
        res = await db.execute(text(f"SELECT count(*) FROM annotations WHERE task_id={task_id}"))
        count = res.scalar()
        if count >= n:
            print(f"Annotations already seeded (found {count})")
            return
            
    print(f"Generating {n} annotations...")
    async with Session() as db:
        batch = []
        for i in range(n):
            img = random.choice(image_ids)
            x = random.randint(0, 500); y = random.randint(0, 400)
            batch.append(Annotation(
                task_id=task_id, image_id=img,
                label_id=random.choice(label_ids),
                shape_type="rectangle",
                points=[x, y, x + random.randint(20, 100), y + random.randint(20, 100)],
                frame=0, occluded=False, attributes=[],
                source="manual", is_keyframe=True,
                review_status=random.choice(["pending", "accepted", "rejected"]),
            ))
            if len(batch) >= 2000:
                db.add_all(batch)
                await db.commit()
                batch = []
                print(f"seeded {i}")
        if batch:
            db.add_all(batch)
            await db.commit()
    print("Annotations seeded.")

async def main():
    await setup()
    gen_images()
    await gen_image_assets()
    await seed_annotations(9999, list(range(1, 10001)), [1, 2, 3], 500_000)

if __name__ == "__main__":
    asyncio.run(main())
