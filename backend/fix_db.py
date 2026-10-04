import sqlite3
import re
conn = sqlite3.connect('annotra.db')
tables = ['tool_configs', 'user_preferences']
for t in tables:
  try:
    res = conn.execute(f'SELECT sql FROM sqlite_master WHERE type="table" AND name="old_{t}"').fetchone()
    if not res: continue
    schema = res[0]
    # replace name
    new_schema = schema.replace(f'CREATE TABLE "old_{t}"', f'CREATE TABLE {t}')
    # replace primary key constraints. use regex to avoid project_id
    new_schema = re.sub(r'\bid BIGINT NOT NULL', 'id INTEGER PRIMARY KEY AUTOINCREMENT', new_schema)
    new_schema = new_schema.replace('PRIMARY KEY (id),', '')
    
    conn.execute(new_schema)
    cols = conn.execute(f'PRAGMA table_info({t})').fetchall()
    col_names = ", ".join([c[1] for c in cols])
    conn.execute(f'INSERT INTO {t} ({col_names}) SELECT {col_names} FROM old_{t};')
    conn.execute(f'DROP TABLE old_{t};')
    print(f'Restored and Fixed {t}')
  except Exception as e:
    print('error', t, e)
conn.commit()
print('Done')
