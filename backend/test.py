import asyncio
from app.core.database import engine
from sqlalchemy import text
from app.core.security import create_access_token
import httpx
import time

async def run():
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT id, role FROM users LIMIT 1"))
        row = res.first()
        token = create_access_token(row[0], role=row[1])
        print("TOKEN=" + token)

        await conn.execute(text("INSERT OR IGNORE INTO projects (id, name, created_at) VALUES (1, 'Test Project', CURRENT_TIMESTAMP)"))
        await conn.execute(text("INSERT OR IGNORE INTO tasks (id, project_id, name, status, created_at, task_type) VALUES (1, 1, 'Test Video Task', 'pending', CURRENT_TIMESTAMP, 'video')"))
        await conn.execute(text("UPDATE tasks SET task_type = 'video' WHERE id = 1"))
        await conn.execute(text("INSERT OR IGNORE INTO labels (id, name, color) VALUES (1, 'Test Label', '#FF0000')"))

    headers = {'Authorization': f'Bearer {token}'}
    
    with open('test.mp4', 'rb') as f:
        print('1. Uploading...')
        r = httpx.post('http://localhost:8000/api/tasks/1/videos/upload', headers=headers, files={'file': ('test.mp4', f, 'video/mp4')})
        print(r.status_code, r.text)
        assert r.status_code == 200
        video_id = r.json()['id']
    
    print('2. Waiting for extraction...')
    for _ in range(15):
        r = httpx.get(f'http://localhost:8000/api/videos/{video_id}', headers=headers)
        if r.json()['extraction_status'] == 'done':
            print('Extraction done!', r.json())
            break
        time.sleep(1)
    else:
        print('Extraction timed out!', r.json())
        return
        
    print('3. Frames...')
    r = httpx.get(f'http://localhost:8000/api/videos/{video_id}/frames', headers=headers)
    print(r.status_code, r.text)
    assert r.status_code == 200
    
    frame_url = r.json()['frame_urls'][0]
    print('4. Verify a frame serves:', frame_url)
    r = httpx.head(f'http://localhost:8000{frame_url}')
    print(r.status_code)
    assert r.status_code == 200
    
    print('5. Create a track...')
    r = httpx.post('http://localhost:8000/api/tasks/1/tracks', headers=headers, json={'label_id':1,'shape_type':'rectangle','points':[100,100,300,300],'frame':0})
    print(r.status_code, r.text)
    assert r.status_code == 201
    track_id = r.json()['track_id']
    
    print('6. Add a keyframe...')
    r = httpx.post(f'http://localhost:8000/api/tracks/{track_id}/keyframes', headers=headers, json={'frame':60,'points':[500,300,700,500]})
    print(r.status_code, r.text)
    assert r.status_code == 201
    print('ALL PASSED!')

asyncio.run(run())
