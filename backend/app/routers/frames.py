from fastapi import APIRouter, HTTPException
import os

router = APIRouter()

@router.get("/tasks/{task_id}/frames")
async def get_frames(task_id: int):
    frames_dir = f"/data/frames/{task_id}"
    if not os.path.exists(frames_dir):
        raise HTTPException(status_code=404, detail="Frames not extracted yet")
    files = sorted([f for f in os.listdir(frames_dir) if f.endswith(".jpg")])
    return {"frames": [f"/static/frames/{task_id}/{f}" for f in files], "count": len(files)}