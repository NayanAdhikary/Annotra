import sqlite3
conn = sqlite3.connect('annotra.db')
tables = ['admin_notifications', 'api_keys', 'export_jobs', 'import_jobs', 'notifications']
conn.execute('PRAGMA foreign_keys=off;')
conn.execute('BEGIN TRANSACTION;')
for t in tables:
  try:
    schema = conn.execute(f'SELECT sql FROM sqlite_master WHERE type="table" AND name="{t}"').fetchone()[0]
    if 'id BIGINT NOT NULL' in schema:
        new_schema = schema.replace('id BIGINT NOT NULL', 'id INTEGER PRIMARY KEY AUTOINCREMENT').replace('PRIMARY KEY (id)', '')
        new_schema = new_schema.replace(', \n\t\n', '\n') # Cleanup empty trailing commas if any
        conn.execute(f'ALTER TABLE {t} RENAME TO old_{t};')
        conn.execute(new_schema)
        cols = conn.execute(f'PRAGMA table_info(old_{t})').fetchall()
        col_names = ", ".join([c[1] for c in cols])
        conn.execute(f'INSERT INTO {t} ({col_names}) SELECT {col_names} FROM old_{t};')
        conn.execute(f'DROP TABLE old_{t};')
  except Exception as e:
    print('error', t, e)
conn.commit()
conn.execute('PRAGMA foreign_keys=on;')
print('Done')
