import asyncio
from sqlalchemy import select
from app.core.database import async_session
from app.models.user import User, UserRole
from app.models.task import Project, Task, Label, ImageAsset
from app.models.task_assignment import TaskAssignment

async def seed_qa():
    async with async_session() as db:
        # Get users
        alice = (await db.execute(select(User).where(User.email.like("alice%")))).scalar_one_or_none()
        bob = (await db.execute(select(User).where(User.email.like("bob%")))).scalar_one_or_none()
        admin = (await db.execute(select(User).where(User.role == UserRole.ADMIN.value))).scalars().first()

        if not admin:
            print("No admin user found.")
            return
        
        # Create Alice and Bob if they don't exist
        if not alice:
            alice = User(email="alice@example.com", username="alice", full_name="Alice", hashed_password="hashed", role=UserRole.ANNOTATOR.value)
            db.add(alice)
        if not bob:
            bob = User(email="bob@example.com", username="bob", full_name="Bob", hashed_password="hashed", role=UserRole.REVIEWER.value)
            db.add(bob)
        await db.flush()

        # Create Project
        project = Project(name="QA Testing Project", description="Auto-generated for Day 25 QA", owner_id=admin.id)
        db.add(project)
        await db.flush()

        # Create Task
        task = Task(project_id=project.id, name="Task 25.16 QA", task_type="image", status="annotation", priority="high")
        db.add(task)
        await db.flush()

        # Create 3 Labels
        db.add_all([
            Label(task_id=task.id, name="Car", color="#ef4444"),
            Label(task_id=task.id, name="Pedestrian", color="#3b82f6"),
            Label(task_id=task.id, name="Bicycle", color="#10b981")
        ])

        # Create 20 Images
        images = []
        for i in range(1, 21):
            images.append(ImageAsset(task_id=task.id, filename=f"qa_image_{i:02d}.jpg", storage_path=f"dummy/path/qa_image_{i:02d}.jpg", width=1920, height=1080))
        db.add_all(images)

        # Assign Alice (Annotator) and Bob (Reviewer)
        db.add(TaskAssignment(task_id=task.id, user_id=alice.id, role="annotator"))
        db.add(TaskAssignment(task_id=task.id, user_id=bob.id, role="reviewer"))

        await db.commit()
        print(f"✅ Successfully seeded QA Project and Task (ID: {task.id}) with 20 images.")
        print(f"Assigned Alice ({alice.email}) and Bob ({bob.email}).")

if __name__ == "__main__":
    asyncio.run(seed_qa())
