const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const db = require('./src/config/db');

async function seed() {
  console.log('--- Starting StockSense Database Seeding ---');

  // Clear existing data for fresh seed
  db.exec('DELETE FROM operation_items;');
  db.exec('DELETE FROM operations;');
  db.exec('DELETE FROM password_resets;');
  db.exec('DELETE FROM users;');

  // 1. Seed Default Users
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const now = new Date().toISOString();

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    crypto.randomUUID(),
    'Marcus Vance',
    'marcus.v@stocksense.io',
    passwordHash,
    'manager',
    now,
    now
  );

  insertUser.run(
    crypto.randomUUID(),
    'Alex Rivera',
    'operator@stocksense.io',
    passwordHash,
    'staff',
    now,
    now
  );

  insertUser.run(
    crypto.randomUUID(),
    'Alex Rivera',
    'operator@logistics.corp',
    passwordHash,
    'staff',
    now,
    now
  );

  console.log('✓ Users seeded: marcus.v@stocksense.io, operator@stocksense.io, and operator@logistics.corp (Password: Password123!)');

  // 2. Seed Warehouse Receipts
  const receipts = [
    {
      ref: 'WH/IN/0001',
      from: 'Azure Interior',
      to: 'WH/Stock',
      contact: 'Azure Interior',
      date: '2026-09-24',
      source: 'PO00012',
      status: 'ready',
      items: [
        { name: 'Office Chair Ergonomic', sku: 'FUR-001', qty: 25 },
        { name: 'Standing Desk Frame', sku: 'FUR-002', qty: 10 }
      ]
    },
    {
      ref: 'WH/IN/0002',
      from: 'Deco Addict',
      to: 'WH/Stock',
      contact: 'Deco Addict',
      date: '2026-09-25',
      source: 'PO00014',
      status: 'waiting',
      items: [
        { name: 'Acoustic Wall Panels', sku: 'DEC-011', qty: 50 }
      ]
    },
    {
      ref: 'WH/IN/0003',
      from: 'Ready Mat',
      to: 'WH/Stock',
      contact: 'Ready Mat',
      date: '2026-09-23',
      source: 'PO00011',
      status: 'done',
      items: [
        { name: 'Anti-fatigue Floor Mat', sku: 'MAT-004', qty: 30 }
      ]
    },
    {
      ref: 'WH/IN/0004',
      from: 'Lumber Inc',
      to: 'WH/Stock',
      contact: 'Lumber Inc',
      date: '2026-09-26',
      source: 'PO00015',
      status: 'ready',
      items: [
        { name: 'Solid Oak Tabletop', sku: 'WOD-008', qty: 15 }
      ]
    },
    {
      ref: 'WH/IN/0005',
      from: 'Gemini Supply',
      to: 'WH/Stock',
      contact: 'Gemini Supply',
      date: '2026-09-22',
      source: 'PO00009',
      status: 'cancelled',
      items: [
        { name: 'Industrial Shelving Rack', sku: 'STG-003', qty: 8 }
      ]
    },
    {
      ref: 'WH/IN/0006',
      from: 'Steel Works',
      to: 'WH/Stock',
      contact: 'Steel Works',
      date: '2026-09-27',
      source: 'PO00018',
      status: 'ready',
      items: [
        { name: 'Steel Angle Brackets', sku: 'MET-020', qty: 200 }
      ]
    }
  ];

  const insertOp = db.prepare(`
    INSERT INTO operations (
      id, reference, type, vendor_from, destination_to, contact, 
      scheduled_date, source_document, status, created_at, updated_at
    ) VALUES (?, ?, 'receipt', ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO operation_items (id, operation_id, product_name, sku, quantity, unit)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const r of receipts) {
    const opId = crypto.randomUUID();
    insertOp.run(
      opId,
      r.ref,
      r.from,
      r.to,
      r.contact,
      r.date,
      r.source,
      r.status,
      now,
      now
    );

    for (const item of r.items) {
      insertItem.run(
        crypto.randomUUID(),
        opId,
        item.name,
        item.sku,
        item.qty,
        'Units'
      );
    }
  }

  console.log(`✓ Seeded ${receipts.length} receipt operations with inventory items.`);

  // 3. Seed Deliveries
  const deliveries = [
    {
      ref: 'WH/OUT/0001',
      from: 'WH/Stock',
      to: 'Anita Oliver',
      contact: 'Anita Oliver',
      date: '2026-09-24',
      source: 'SO0004',
      status: 'ready',
      items: [
        { name: 'Office Chair Ergonomic', sku: 'FUR-001', qty: 4 }
      ]
    },
    {
      ref: 'WH/OUT/0002',
      from: 'WH/Stock',
      to: 'Brandon Freeman',
      contact: 'Brandon Freeman',
      date: '2026-09-25',
      source: 'SO0005',
      status: 'waiting',
      items: [
        { name: 'Standing Desk Frame', sku: 'FUR-002', qty: 2 }
      ]
    },
    {
      ref: 'WH/OUT/0003',
      from: 'WH/Stock',
      to: 'Colleen Diaz',
      contact: 'Colleen Diaz',
      date: '2026-09-26',
      source: 'SO0006',
      status: 'ready',
      items: [
        { name: 'Solid Oak Tabletop', sku: 'WOD-008', qty: 2 }
      ]
    }
  ];

  const insertDeliv = db.prepare(`
    INSERT INTO operations (
      id, reference, type, vendor_from, destination_to, contact, 
      scheduled_date, source_document, status, created_at, updated_at
    ) VALUES (?, ?, 'delivery', ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const d of deliveries) {
    const delivId = crypto.randomUUID();
    insertDeliv.run(
      delivId,
      d.ref,
      d.from,
      d.to,
      d.contact,
      d.date,
      d.source,
      d.status,
      now,
      now
    );

    for (const item of d.items) {
      insertItem.run(
        crypto.randomUUID(),
        delivId,
        item.name,
        item.sku,
        item.qty,
        'Units'
      );
    }
  }

  console.log(`✓ Seeded ${deliveries.length} delivery operations with items.`);
  console.log('--- Database Seeding Completed Successfully ---');
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
