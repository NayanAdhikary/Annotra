from fastapi.testclient import TestClient
from app.main import app
from app.core.deps import get_current_user
from app.models.user import User

client = TestClient(app)

def override_get_current_user():
    return User(id=1, email="test@example.com", full_name="Test User", role="admin", is_active=True)

app.dependency_overrides[get_current_user] = override_get_current_user

def test_endpoints():
    print("Testing GET /api/orgs/1/tool-config")
    res = client.get("/api/orgs/1/tool-config")
    print(res.status_code, res.json())
    
    print("\nTesting PATCH /api/orgs/1/tool-config")
    res = client.patch("/api/orgs/1/tool-config", json={"default_tool": "polygon"})
    print(res.status_code, res.json())
    
    print("\nTesting GET /api/me/preferences")
    res = client.get("/api/me/preferences")
    print(res.status_code, res.json())
    
    print("\nTesting PUT /api/me/preferences")
    res = client.put("/api/me/preferences", json={"overrides": {"brush_size_default": 50}})
    print(res.status_code, res.json())
    
    print("\nTesting GET /api/orgs/1/effective-config")
    res = client.get("/api/orgs/1/effective-config")
    print(res.status_code, res.json())

if __name__ == "__main__":
    test_endpoints()
