"""
Seed a task with N synthetic images and M annotations for benchmarking.
Run: python -m scripts.seed_perf_task --images 10000 --annotations 500000
"""
import argparse
import os
import random
import sys
import asyncio
from pathlib import Path

from PIL import Image
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import settings
from app.models.task import Project, Task, Label, ImageAsset
from app.models.annotation import Annotation
from app.models.user import User


async def main(args):
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        # Find admin user
        admin = (await db.execute(select(User).limit(1))).scalar_one_or_none()
        if not admin:
            print("No users exist. Register a user first.")
            return

        # Create project + task
        project = Project(
            name="PERF TEST",
            description="Synthetic dataset for benchmarking",
            owner_id=admin.id,
        )
        db.add(project)
        await db.flush()

        task = Task(
            project_id=project.id,
            name="Perf Task",
            task_type="image",
        )
        db.add(task)
        await db.flush()

        # Create labels
        labels = []
        for name, color in [("Car", "#FF0000"), ("Person", "#00FF00"), ("Bike", "#0000FF")]:
            lb = Label(task_id=task.id, name=name, color=color)
            db.add(lb)
            labels.append(lb)
        await db.flush()

        print(f"Created project={project.id}, task={task.id}")

        # Generate images on disk
        # Using a relative path for Windows compatibility since it runs in backend dir
        outdir = f"data/images/{task.id}"
        os.makedirs(outdir, exist_ok=True)
        img = Image.new("RGB", (640, 480), color=(80, 80, 80))

        image_ids = []
        for i in range(args.images):
            path = f"{outdir}/frame_{i:05d}.jpg"
            if not os.path.exists(path):
                img.save(path, quality=60)
            asset = ImageAsset(
                task_id=task.id,
                filename=f"frame_{i:05d}.jpg",
                width=640, height=480,
                storage_path=path,
            )
            db.add(asset)
            if (i + 1) % 1000 == 0:
                await db.flush()
                await db.commit()
                print(f"  images: {i + 1}")
        await db.commit()

        image_rows = (await db.execute(
            select(ImageAsset.id).where(ImageAsset.task_id == task.id)
        )).scalars().all()
        image_ids = list(image_rows)
        print(f"  total images: {len(image_ids)}")

        # Generate annotations
        label_ids = [l.id for l in labels]
        batch = []
        BATCH_SIZE = 2000
        for i in range(args.annotations):
            img_id = random.choice(image_ids)
            x = random.randint(0, 500)
            y = random.randint(0, 400)
            w = random.randint(20, 100)
            h = random.randint(20, 100)
            batch.append(Annotation(
                task_id=task.id,
                image_id=img_id,
                label_id=random.choice(label_ids),
                shape_type="rectangle",
                points=[x, y, x + w, y + h],
                frame=0,
                occluded=False,
                attributes=[],
                source="manual",
                is_keyframe=True,
                review_status=random.choice(["pending", "accepted", "rejected"]),
            ))
            if len(batch) >= BATCH_SIZE:
                db.add_all(batch)
                await db.commit()
                batch = []
                print(f"  annotations: {i + 1}")

        if batch:
            db.add_all(batch)
            await db.commit()

        print(f"\nDone.")
        print(f"  TASK_ID={task.id}")
        print(f"  IMAGE_ID={image_ids[0]}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--images", type=int, default=10000)
    parser.add_argument("--annotations", type=int, default=500000)
    args = parser.parse_args()
    asyncio.run(main(args))
