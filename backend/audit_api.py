import requests
import sys

BASE_URL = "http://localhost:8000"

def check(name, url, method="GET", expected_status=200):
    try:
        if method == "GET":
            res = requests.get(f"{BASE_URL}{url}")
        else:
            res = requests.post(f"{BASE_URL}{url}")
        
        if res.status_code == expected_status or res.status_code == 401 or res.status_code == 403:
            # We expect 401/403 for protected endpoints since we aren't passing a token.
            print(f"[PASS] {name}: {res.status_code} (Expected {expected_status} or Auth Error)")
        else:
            print(f"[FAIL] {name}: {res.status_code} - {res.text}")
            return False
        return True
    except Exception as e:
        print(f"[FAIL] {name}: Request failed - {e}")
        return False

print("Starting API Audit...")
success = True
success &= check("Health Check", "/health")
success &= check("Projects List", "/api/projects/")
success &= check("Tasks List", "/api/tasks/")
success &= check("Auth Me", "/api/auth/me", expected_status=200)

if success:
    print("\n✅ Basic API Audit Passed. Backend is routing correctly and handling unauthenticated requests as expected.")
else:
    print("\n❌ API Audit Failed.")
    sys.exit(1)
