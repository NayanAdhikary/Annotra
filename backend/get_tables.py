import sqlite3
print([t[0] for t in sqlite3.connect('annotra.db').execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()])
