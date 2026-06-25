// SQLite 初始化与建表（按 PRD：题目/选项、投票、留言）
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 数据库文件放在 server/data/ 下（已在 .gitignore 中忽略）
// 测试时可通过环境变量 DB_PATH 指向一个临时库，避免污染开发数据
const dbPath = process.env.DB_PATH
  ? process.env.DB_PATH
  : path.join(__dirname, 'data', 'app.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 建表（IF NOT EXISTS，重复启动安全）
db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    text       TEXT    NOT NULL,
    is_active  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS options (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    label       TEXT    NOT NULL,
    position    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS votes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    option_id   INTEGER NOT NULL REFERENCES options(id)   ON DELETE CASCADE,
    voter_token TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    content        TEXT    NOT NULL,
    masked_content TEXT,
    status         TEXT    NOT NULL DEFAULT 'visible',
    sender_token   TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- 仅用于启动自检：验证数据库能写入再读出
  CREATE TABLE IF NOT EXISTS _healthcheck (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    note       TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_options_question  ON options(question_id);
  CREATE INDEX IF NOT EXISTS idx_votes_question    ON votes(question_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created  ON messages(created_at);
`);

export default db;
export { dbPath };
