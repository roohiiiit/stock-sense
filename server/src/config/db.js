const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', '..', 'data', 'stocksense.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize schema
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('manager', 'staff')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL COLLATE NOCASE,
      otp_code TEXT NOT NULL,
      reset_token TEXT,
      expires_at INTEGER NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operations (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('receipt', 'delivery')),
      vendor_from TEXT NOT NULL,
      destination_to TEXT NOT NULL,
      contact TEXT,
      scheduled_date TEXT NOT NULL,
      source_document TEXT,
      status TEXT NOT NULL CHECK (status IN ('draft', 'waiting', 'ready', 'done', 'cancelled')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operation_items (
      id TEXT PRIMARY KEY,
      operation_id TEXT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      sku TEXT,
      quantity INTEGER NOT NULL,
      unit TEXT DEFAULT 'Units'
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
    CREATE INDEX IF NOT EXISTS idx_operations_type_status ON operations(type, status);
  `);
}

initSchema();

module.exports = db;
