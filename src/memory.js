const sqlite3 = require('sqlite3').verbose();
const { parseJson } = require('./utils');

class MemoryManager {
  constructor(dbPath) {
    this.db = new sqlite3.Database(dbPath);
    this.ready = this.init();
  }

  async init() {
    await this.run('PRAGMA journal_mode = WAL');
    await this.run('PRAGMA busy_timeout = 5000');

    await this.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        user_id TEXT,
        command TEXT,
        plan TEXT,
        progress TEXT,
        result TEXT,
        artifacts TEXT,
        error TEXT,
        status TEXT,
        duration INTEGER,
        created_at INTEGER,
        completed_at INTEGER
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS memory (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER
      )
    `);

    await this.migrate('tasks', 'user_id TEXT');
    await this.migrate('tasks', 'plan TEXT');
    await this.migrate('tasks', 'progress TEXT');
    await this.migrate('tasks', 'artifacts TEXT');
    await this.run('CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id, created_at DESC)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, created_at DESC)');
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function onRun(error) {
        if (error) reject(error);
        else resolve(this);
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (error, row) => {
        if (error) reject(error);
        else resolve(row || null);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (error, rows) => {
        if (error) reject(error);
        else resolve(rows || []);
      });
    });
  }

  async migrate(table, definition) {
    await this.run(`ALTER TABLE ${table} ADD COLUMN ${definition}`).catch((error) => {
      if (!/duplicate column/i.test(error.message)) throw error;
    });
  }

  async saveTask(task) {
    await this.ready;
    await this.run(
      `INSERT OR REPLACE INTO tasks (
        id, session_id, user_id, command, plan, progress, result, artifacts, error, status, duration, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.sessionId,
        task.userId || null,
        task.command,
        JSON.stringify(task.plan || null),
        JSON.stringify(task.progress || []),
        JSON.stringify(task.result || null),
        JSON.stringify(task.artifacts || []),
        task.error || null,
        task.status,
        task.duration || null,
        task.createdAt,
        task.completedAt || null
      ]
    );
  }

  async getTask(id) {
    await this.ready;
    const row = await this.get('SELECT * FROM tasks WHERE id = ?', [id]);
    return row ? this.fromTaskRow(row) : null;
  }

  async getTasksBySession(sessionId, limit = 20) {
    await this.ready;
    const rows = await this.all(
      'SELECT * FROM tasks WHERE session_id = ? ORDER BY created_at DESC LIMIT ?',
      [sessionId, limit]
    );
    return rows.map((row) => this.fromTaskRow(row));
  }

  async searchTasks(term, limit = 10) {
    await this.ready;
    const rows = await this.all(
      'SELECT * FROM tasks WHERE command LIKE ? ORDER BY created_at DESC LIMIT ?',
      [`%${term}%`, limit]
    );
    return rows.map((row) => this.fromTaskRow(row));
  }

  async setMemory(key, value) {
    await this.ready;
    await this.run(
      'INSERT OR REPLACE INTO memory (key, value, updated_at) VALUES (?, ?, ?)',
      [key, JSON.stringify(value), Date.now()]
    );
  }

  async getMemory(key) {
    await this.ready;
    const row = await this.get('SELECT value FROM memory WHERE key = ?', [key]);
    return row ? parseJson(row.value, row.value) : null;
  }

  async listMemory(limit = 20) {
    await this.ready;
    const rows = await this.all('SELECT key, value, updated_at FROM memory ORDER BY updated_at DESC LIMIT ?', [limit]);
    return rows.map((row) => ({
      key: row.key,
      value: parseJson(row.value, row.value),
      updatedAt: row.updated_at
    }));
  }

  async deleteMemory(key) {
    await this.ready;
    const result = await this.run('DELETE FROM memory WHERE key = ?', [key]);
    return result.changes > 0;
  }

  async stats() {
    await this.ready;
    const tasks = await this.get('SELECT COUNT(*) AS count FROM tasks');
    const memory = await this.get('SELECT COUNT(*) AS count FROM memory');
    return { tasks: tasks.count, memory: memory.count };
  }

  fromTaskRow(row) {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      command: row.command,
      plan: parseJson(row.plan),
      progress: parseJson(row.progress, []),
      result: parseJson(row.result),
      artifacts: parseJson(row.artifacts, []),
      error: row.error,
      status: row.status,
      duration: row.duration,
      createdAt: row.created_at,
      completedAt: row.completed_at
    };
  }

  close() {
    this.db.close();
  }
}

module.exports = MemoryManager;
