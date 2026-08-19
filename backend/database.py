import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "detection_system.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database tables and default settings."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create logs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            threat_category TEXT NOT NULL,
            target_detail TEXT NOT NULL,
            action_taken TEXT NOT NULL
        )
    """)
    
    # Create settings table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    
    # Insert default active_mode setting if not present
    cursor.execute("""
        INSERT OR IGNORE INTO settings (key, value)
        VALUES ('active_mode', '0')
    """)
    
    conn.commit()
    conn.close()

def get_active_mode() -> bool:
    """Retrieve the current mode: True for Active (Force Kill), False for Passive (Monitor Only)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = 'active_mode'")
    row = cursor.fetchone()
    conn.close()
    if row:
        return row['value'] == '1'
    return False

def set_active_mode(active: bool):
    """Set the system mode."""
    value = '1' if active else '0'
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('active_mode', ?)", (value,))
    conn.commit()
    conn.close()

def log_incident(threat_category: str, target_detail: str, action_taken: str):
    """Insert a new threat detection log."""
    timestamp = datetime.now().isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO logs (timestamp, threat_category, target_detail, action_taken)
        VALUES (?, ?, ?, ?)
    """, (timestamp, threat_category, target_detail, action_taken))
    conn.commit()
    conn.close()
    return {
        "timestamp": timestamp,
        "threat_category": threat_category,
        "target_detail": target_detail,
        "action_taken": action_taken
    }

def get_logs(limit: int = 100):
    """Retrieve history of logged incidents."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, timestamp, threat_category, target_detail, action_taken FROM logs ORDER BY timestamp DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def clear_logs():
    """Clear all incident logs."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM logs")
    conn.commit()
    conn.close()

# Automatically initialize database when database module is imported
init_db()
