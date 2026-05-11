import sqlite3
import os

DB_PATH = "/app/data/spik.db"

def init_db():
    os.makedirs("/app/data", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS voices (
        id TEXT PRIMARY KEY,
        name TEXT,
        language TEXT,
        prompt TEXT,
        emotion TEXT,
        file_path TEXT,
        status TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        type TEXT,
        status TEXT DEFAULT 'QUEUED',
        voice_id TEXT,
        voice_name TEXT,
        input_text TEXT,
        output_filename TEXT,
        error TEXT,
        duration_s REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
    )''')
    conn.commit()
    conn.close()

def add_voice(voice_id, name, language, prompt, emotion, file_path, status="ready"):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO voices (id, name, language, prompt, emotion, file_path, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
              (voice_id, name, language, prompt, emotion, file_path, status))
    conn.commit()
    conn.close()

def get_voices():
    if not os.path.exists(DB_PATH):
        return []
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM voices ORDER BY created_at DESC")
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_voice(voice_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM voices WHERE id = ?", (voice_id,))
    conn.commit()
    conn.close()

def get_voice(voice_id):
    if not os.path.exists(DB_PATH):
        return None
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM voices WHERE id = ?", (voice_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

# ── Jobs audit ────────────────────────────────────────────────

def log_job(job_id, job_type, voice_id=None, voice_name=None, input_text=None):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "INSERT OR IGNORE INTO jobs (id, type, status, voice_id, voice_name, input_text) VALUES (?, ?, 'QUEUED', ?, ?, ?)",
        (job_id, job_type, voice_id, voice_name, input_text)
    )
    conn.commit()
    conn.close()

def update_job(job_id, status, output_filename=None, error=None, duration_s=None):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """UPDATE jobs SET
            status = ?,
            output_filename = COALESCE(?, output_filename),
            error = COALESCE(?, error),
            duration_s = COALESCE(?, duration_s),
            completed_at = CASE WHEN ? IN ('SUCCESS','FAILURE') THEN datetime('now') ELSE completed_at END
           WHERE id = ?""",
        (status, output_filename, error, duration_s, status, job_id)
    )
    conn.commit()
    conn.close()

def get_jobs(limit=100):
    if not os.path.exists(DB_PATH):
        return []
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]
