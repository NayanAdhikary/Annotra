import requests

r = requests.post('http://localhost:8000/api/auth/login', json={'username': 'admin@annotra.com', 'password': 'password'})
token = r.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

r = requests.post('http://localhost:8000/api/projects', json={'name': 'Test Project'}, headers=headers)
p = r.json()
r = requests.post(f"http://localhost:8000/api/projects/{p['id']}/tasks", json={'name': 'Test Task'}, headers=headers)
t = r.json()
task_id = t['id']

print(f'Using task_id: {task_id}')

print('\n--- Create Label ---')
r = requests.post(f'http://localhost:8000/api/tasks/{task_id}/labels', json={
    'name': 'Car',
    'color': '#FF0000',
    'attributes': [
      {'name': 'color', 'input_type': 'select', 'values': ['red','blue','white','black'], 'default': 'red'},
      {'name': 'damaged', 'input_type': 'checkbox', 'default': False},
      {'name': 'confidence', 'input_type': 'number', 'default': 0}
    ]
}, headers=headers)
print(r.status_code, r.text)
label_id = r.json()['id']

print('\n--- Create Valid Annotation ---')
r = requests.post(f'http://localhost:8000/api/tasks/{task_id}/annotations', json={
    'label_id': label_id,
    'shape_type': 'rectangle',
    'points': [10, 10, 100, 100],
    'attributes': [{'name': 'color', 'value': 'blue'}, {'name': 'damaged', 'value': True}]
}, headers=headers)
print(r.status_code, r.text)

print('\n--- Create Invalid Annotation ---')
r = requests.post(f'http://localhost:8000/api/tasks/{task_id}/annotations', json={
    'label_id': label_id,
    'shape_type': 'rectangle',
    'points': [10, 10, 100, 100],
    'attributes': [{'name': 'color', 'value': 'purple'}]
}, headers=headers)
print(r.status_code, r.text)
