import os
import time
import requests

API_URL = "http://localhost:8000/api"

def main():
    print("Logging in...")
    resp = requests.post(
        f"http://localhost:8000/api/auth/login",
        json={"email": "admin@example.com", "password": "Passw0rd!"}
    )
    if resp.status_code != 200:
        print("Failed to login. Response:", resp.text)
        return
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create project
    resp = requests.post(f"{API_URL}/projects", headers=headers, json={"name": "Test Project", "description": ""})
    project_id = resp.json()["id"]

    # Create task
    resp = requests.post(f"{API_URL}/projects/{project_id}/tasks", headers=headers, json={"name": "Test Task", "task_type": "video"})
    task_id = resp.json()["id"]

    # Create label
    resp = requests.post(f"{API_URL}/tasks/{task_id}/labels", headers=headers, json={"name": "Object", "color": "#ff0000"})
    if resp.status_code != 201:
        print("Label creation failed:", resp.text)
    label_id = resp.json()["id"]

    # 1. Upload a video
    print(f"1. Uploading video for task {task_id}...")
    with open("test.mp4", "rb") as f:
        resp = requests.post(
            f"{API_URL}/tasks/{task_id}/videos/upload",
            headers=headers,
            files={"file": f}
        )
    print("Upload response:", resp.status_code, resp.text)
    if resp.status_code != 200:
        return
    video_id = resp.json()["id"]

    # 2 & 3. Wait and Check status
    print("2 & 3. Waiting for extraction...")
    for _ in range(20):
        resp = requests.get(f"{API_URL}/videos/{video_id}", headers=headers)
        data = resp.json()
        if data["extraction_status"] == "done":
            print("Extraction done!")
            print("Video metadata:", data)
            break
        elif data["extraction_status"] == "failed":
            print("Extraction failed!", data)
            return
        time.sleep(1)
    else:
        print("Timeout waiting for extraction")
        return

    # 4. List frames
    print("4. Listing frames...")
    resp = requests.get(f"{API_URL}/videos/{video_id}/frames", headers=headers)
    print("Frames response:", resp.status_code)
    frames_data = resp.json()
    print("Total frames listed:", len(frames_data.get("frame_urls", [])))
    if frames_data.get("frame_urls"):
        first_frame_url = frames_data["frame_urls"][0]

        # 5. Verify frame serving
        print("5. Verifying frame serving:", first_frame_url)
        resp = requests.head(f"http://localhost:8000{first_frame_url}")
        print("Frame serving HEAD response:", resp.status_code, resp.headers.get("content-type"))

    # 6. Create a track
    print("6. Creating track...")
    resp = requests.post(
        f"{API_URL}/tasks/{task_id}/tracks",
        headers=headers,
        json={"label_id": label_id, "shape_type": "rectangle", "points": [100, 100, 300, 300], "frame": 0}
    )
    print("Create track response:", resp.status_code, resp.text)
    if resp.status_code != 200:
        return
    track_id = resp.json()["track_id"]

    # 7. Add keyframe
    print(f"7. Adding keyframe to track {track_id}...")
    resp = requests.post(
        f"{API_URL}/tracks/{track_id}/keyframes",
        headers=headers,
        json={"frame": 60, "points": [500, 300, 700, 500], "outside": False, "occluded": False}
    )
    print("Add keyframe response:", resp.status_code, resp.text)

    # 8. List tracks
    print(f"8. Listing tracks for task {task_id}...")
    resp = requests.get(f"{API_URL}/tasks/{task_id}/tracks", headers=headers)
    print("List tracks response:", resp.status_code)
    tracks = resp.json()
    for t in tracks:
        print(f"Track {t['track_id']} has {len(t['keyframes'])} keyframes")

if __name__ == "__main__":
    main()
