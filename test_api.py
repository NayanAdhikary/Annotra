import requests

BASE_URL = "http://localhost:8000"
token = None

print("1. Register first user (becomes admin)")
try:
    r1 = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": "admin@annotra.local",
        "username": "admin",
        "password": "Passw0rd!",
        "full_name": "Admin"
    })
    print(f"Status: {r1.status_code}\nBody: {r1.text}")
    
    # Try to extract token, or login if already registered
    if r1.status_code in [200, 201]:
        token = r1.json().get("access_token")
    else:
        print("Registration failed, trying to login as admin to get token...")
        # might be standard oauth2 x-www-form-urlencoded
        r_login = requests.post(f"{BASE_URL}/api/auth/login", data={
            "username": "admin@annotra.local",
            "password": "Passw0rd!"
        })
        if r_login.status_code == 200:
            token = r_login.json().get("access_token")
        else:
            r_login = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "admin@annotra.local",
                "password": "Passw0rd!"
            })
            token = r_login.json().get("access_token")

    print("\n2. Call /me")
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    r2 = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
    print(f"Status: {r2.status_code}\nBody: {r2.text}")

    print("\n3. Register a second user (becomes annotator)")
    r3 = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": "a@annotra.local",
        "username": "annotator1",
        "password": "Passw0rd!",
        "full_name": "A"
    })
    print(f"Status: {r3.status_code}\nBody: {r3.text}")

    print("\n4. Login as admin")
    r4 = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@annotra.local",
        "password": "Passw0rd!"
    })
    if r4.status_code == 422: # might expect form data
        r4 = requests.post(f"{BASE_URL}/api/auth/login", data={
            "username": "admin@annotra.local",
            "password": "Passw0rd!"
        })
    print(f"Status: {r4.status_code}\nBody: {r4.text}")
    
    if r4.status_code == 200:
        token = r4.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}

    print("\n5. List users (only works with admin token)")
    r5 = requests.get(f"{BASE_URL}/api/auth/users", headers=headers)
    print(f"Status: {r5.status_code}\nBody: {r5.text}")

    print("\n6. Hit a protected endpoint without a token -> expect 401")
    r6 = requests.get(f"{BASE_URL}/api/auth/me")
    print(f"Status: {r6.status_code}\nBody: {r6.text}")

except Exception as e:
    print(f"Error connecting to server: {e}")
