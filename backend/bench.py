import requests
import time
import os
import sqlite3
import json

BASE_URL = "http://localhost:8000/api"

# Get token
def get_token():
    resp = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": "bench@test.com", "password": "x"}
    )
    if resp.status_code != 200:
        resp = requests.post(f"{BASE_URL}/auth/login", data={"username": "bench@test.com", "password": "x"})
    
    if resp.status_code == 200:
        return resp.json()["access_token"]
    
    # Register if not found
    requests.post(f"{BASE_URL}/auth/register", json={
        "email": "bench@test.com",
        "username": "bench_user",
        "password": "x",
        "full_name": "Bench"
    })
    resp = requests.post(f"{BASE_URL}/auth/login", data={"username": "bench@test.com", "password": "x"})
    return resp.json()["access_token"]

def measure(url, headers, name):
    times = []
    size = 0
    for i in range(5):
        t0 = time.time()
        resp = requests.get(url, headers=headers)
        t1 = time.time()
        times.append(t1 - t0)
        size = len(resp.content)
        if resp.status_code != 200:
            print(f"Error for {name}: {resp.status_code} {resp.text}")
    times.sort()
    median = times[2]
    print(f"{name} median time: {median*1000:.2f}ms, size: {size / 1024:.2f} KB")

def main():
    try:
        token = get_token()
        headers = {"Authorization": f"Bearer {token}", "Accept-Encoding": "gzip"}
        
        # B1
        measure(f"{BASE_URL}/tasks/9999", headers, "B1")
        
        # B2
        measure(f"{BASE_URL}/tasks/9999/annotations?limit=2000", headers, "B2 (paginated limit=2000)")
        
        # B3
        measure(f"{BASE_URL}/me/tasks", headers, "B3")
        
        # B8
        conn = sqlite3.connect("annotra.db")
        cur = conn.cursor()
        cur.execute("EXPLAIN QUERY PLAN SELECT * FROM annotations WHERE task_id=9999 LIMIT 2000")
        print("B8 Query Plan:")
        for row in cur.fetchall():
            print(row)
        
    except Exception as e:
        print("Exception:", e)

if __name__ == "__main__":
    main()
