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

    CREATE TABLE IF NOT EXISTS warehouses (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      short_code TEXT NOT NULL UNIQUE,
      address TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS warehouse_locations (
      id TEXT PRIMARY KEY,
      warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK (type IN ('internal', 'incoming', 'outgoing', 'scrap')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_items (
      sku TEXT PRIMARY KEY,
      product_name TEXT NOT NULL,
      category TEXT DEFAULT 'General',
      location TEXT NOT NULL,
      on_hand INTEGER NOT NULL DEFAULT 0,
      min_threshold INTEGER NOT NULL DEFAULT 10,
      unit TEXT DEFAULT 'Units',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
    CREATE INDEX IF NOT EXISTS idx_operations_type_status ON operations(type, status);
    CREATE INDEX IF NOT EXISTS idx_warehouse_locations_code ON warehouse_locations(code);
    CREATE INDEX IF NOT EXISTS idx_stock_items_location ON stock_items(location);
  `);

  // Safe migration check for existing databases
  try {
    db.exec('ALTER TABLE warehouses ADD COLUMN user_id TEXT;');
  } catch (e) {
    // Column already exists or table newly created
  }

  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_warehouses_user ON warehouses(user_id);');
  } catch (e) {
    // ignore
  }

  // Ensure default primary warehouse exists
  const existingWh = db.prepare('SELECT id FROM warehouses LIMIT 1').get();
  if (!existingWh) {
    const whId = 'wh-default-001';
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO warehouses (id, name, short_code, address, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      whId,
      'Central Warehouse',
      'WH',
      '100 Logistics Blvd, Dock 4, Chicago, IL 60601',
      now,
      now
    );

    const defaultLocations = [
      { id: 'loc-001', name: 'Main Storage A', code: 'WH/Stock1', type: 'internal' },
      { id: 'loc-002', name: 'Rack Storage B', code: 'WH/Stock2', type: 'internal' },
      { id: 'loc-003', name: 'Inbound Receiving Dock', code: 'WH/InputDock', type: 'incoming' },
      { id: 'loc-004', name: 'Outbound Shipping Dock', code: 'WH/Output', type: 'outgoing' }
    ];

    const insertLoc = db.prepare(`
      INSERT INTO warehouse_locations (id, warehouse_id, name, code, type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const loc of defaultLocations) {
      insertLoc.run(loc.id, whId, loc.name, loc.code, loc.type, now, now);
    }
  }
}

initSchema();

module.exports = db;
