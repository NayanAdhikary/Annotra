import requests
import json

token_url = "http://localhost:8000/api/auth/login"
resp = requests.post(token_url, json={"email": "admin@example.com", "password": "password"})
token = resp.json().get("access_token")
if not token:
    print("Failed to get token:", resp.text)
    exit(1)

headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def test(name, method, url, **kwargs):
    print(f"\n{name}")
    resp = getattr(requests, method)(url, headers=headers, **kwargs)
    try:
        print(json.dumps(resp.json(), indent=2))
    except:
        print(f"Status: {resp.status_code}")
        print(f"Response text: {resp.text}")

test("1. Transition task", "post", "http://localhost:8000/api/tasks/1/transition", json={"to_status": "review"})
test("2. Illegal transition (should 400)", "post", "http://localhost:8000/api/tasks/1/transition", json={"to_status": "annotation"})
test("3. Post comment", "post", "http://localhost:8000/api/tasks/1/comments", json={"body": "Is the object on the left a car or a truck?", "frame": 12})
test("4. My tasks", "get", "http://localhost:8000/api/me/tasks")
test("5. Quality report", "get", "http://localhost:8000/api/admin/quality")
test("6. Duplicate task", "post", "http://localhost:8000/api/tasks/1/duplicate")
