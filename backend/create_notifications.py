import sqlite3
sql = """
CREATE TABLE notifications (
    id INTEGER NOT NULL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    kind VARCHAR(50) NOT NULL,
    title VARCHAR(225) NOT NULL,
    body TEXT,
    link VARCHAR(500),
    resource_type VARCHAR(30),
    resource_id INTEGER,
    read_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_notifications_user_id ON notifications (user_id);
CREATE INDEX ix_notifications_kind ON notifications (kind);
CREATE INDEX ix_notifications_read_at ON notifications (read_at);
CREATE INDEX ix_notifications_created_at ON notifications (created_at);
"""
conn = sqlite3.connect('annotra.db')
conn.executescript(sql)
conn.commit()
print("Table created.")
