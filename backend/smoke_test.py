import sys, time, subprocess, requests
sys.path.append('.')
from app.core.security import create_access_token

admin_token = create_access_token("1", "admin")
annotator_token = create_access_token("2", "annotator")

def do_req(method, url, token, json_data=None):
    headers = {"Authorization": f"Bearer {token}"}
    if method == "GET":
        resp = requests.get(url, headers=headers)
    elif method == "POST":
        resp = requests.post(url, headers=headers, json=json_data)
    elif method == "PATCH":
        resp = requests.patch(url, headers=headers, json=json_data)
    print(f"{method} {url} -> {resp.status_code}")
    if resp.status_code >= 400:
        print("  " + resp.text)
    return resp

print("Starting uvicorn...")
server = subprocess.Popen(["uvicorn", "app.main:app", "--port", "8000"])
time.sleep(3) # wait for startup

try:
    print("--- Admin Tests ---")
    do_req("GET", "http://localhost:8000/api/admin/stats", admin_token)

    resp = do_req("POST", "http://localhost:8000/api/admin/users", admin_token, {
        "email": "rev1@annotra.com",
        "username": "reviewer1",
        "password": "Passw0rd!",
        "role": "reviewer"
    })
    if resp.status_code == 201:
        user_id = resp.json()["id"]
        do_req("GET", "http://localhost:8000/api/admin/users?q=reviewer", admin_token)
        do_req("PATCH", f"http://localhost:8000/api/admin/users/{user_id}", admin_token, {"role": "manager"})
        do_req("POST", f"http://localhost:8000/api/admin/users/{user_id}/revoke-sessions", admin_token)

    do_req("GET", "http://localhost:8000/api/admin/audit?limit=20", admin_token)
    do_req("GET", "http://localhost:8000/api/admin/health", admin_token)

    print("--- Annotator Tests (Should be 403) ---")
    do_req("GET", "http://localhost:8000/api/admin/stats", annotator_token)
finally:
    server.terminate()
