import sqlite3
import re
c = sqlite3.connect('annotra.db')
for t in ['tool_configs', 'user_preferences']:
  res = c.execute(f'SELECT sql FROM sqlite_master WHERE type="table" AND name="old_{t}"').fetchone()
  print(res[0])
