const crypto = require('node:crypto');
const db = require('../config/db');

class OperationsController {
  /**
   * Helper to query operations by type ('receipt' | 'delivery' | all)
   */
  static _fetchOperations(type, query) {
    const { status, search } = query;
    let queryStr = `SELECT * FROM operations WHERE 1=1`;
    const params = [];

    if (type && type !== 'all') {
      queryStr += ` AND type = ?`;
      params.push(type.toLowerCase());
    }

    if (status && status !== 'all') {
      queryStr += ` AND status = ?`;
      params.push(status.toLowerCase());
    }

    if (search && search.trim()) {
      queryStr += ` AND (reference LIKE ? OR vendor_from LIKE ? OR destination_to LIKE ? OR contact LIKE ? OR source_document LIKE ?)`;
      const wild = `%${search.trim()}%`;
      params.push(wild, wild, wild, wild, wild);
    }

    queryStr += ` ORDER BY created_at DESC`;

    const records = db.prepare(queryStr).all(...params);
    const getItems = db.prepare('SELECT * FROM operation_items WHERE operation_id = ?');

    return records.map(r => ({
      ...r,
      items: getItems.all(r.id)
    }));
  }

  // --- RECEIPT HANDLERS ---
  static getReceipts(req, res) {
    try {
      const receipts = OperationsController._fetchOperations('receipt', req.query);
      return res.json({
        success: true,
        count: receipts.length,
        data: receipts
      });
    } catch (err) {
      console.error('Error fetching receipts:', err);
      return res.status(500).json({ success: false, message: 'Could not fetch receipts.' });
    }
  }

  static getReceiptById(req, res) {
    req.params.type = 'receipt';
    return OperationsController.getOperationById(req, res);
  }

  static createReceipt(req, res) {
    req.body.type = 'receipt';
    return OperationsController.createOperation(req, res);
  }

  // --- DELIVERY HANDLERS ---
  static getDeliveries(req, res) {
    try {
      const deliveries = OperationsController._fetchOperations('delivery', req.query);
      return res.json({
        success: true,
        count: deliveries.length,
        data: deliveries
      });
    } catch (err) {
      console.error('Error fetching deliveries:', err);
      return res.status(500).json({ success: false, message: 'Could not fetch deliveries.' });
    }
  }

  static getDeliveryById(req, res) {
    req.params.type = 'delivery';
    return OperationsController.getOperationById(req, res);
  }

  static createDelivery(req, res) {
    req.body.type = 'delivery';
    return OperationsController.createOperation(req, res);
  }

  // --- UNIFIED OPERATIONS HANDLERS ---
  static getOperations(req, res) {
    try {
      const type = req.query.type || 'all';
      const operations = OperationsController._fetchOperations(type, req.query);
      return res.json({
        success: true,
        count: operations.length,
        data: operations
      });
    } catch (err) {
      console.error('Error fetching operations:', err);
      return res.status(500).json({ success: false, message: 'Could not fetch operations.' });
    }
  }

  static getOperationById(req, res) {
    try {
      const { id } = req.params;
      const type = req.params.type;

      let queryStr = 'SELECT * FROM operations WHERE (id = ? OR reference = ?)';
      const params = [id, id];

      if (type) {
        queryStr += ' AND type = ?';
        params.push(type.toLowerCase());
      }

      const operation = db.prepare(queryStr).get(...params);

      if (!operation) {
        return res.status(404).json({
          success: false,
          message: `${type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Operation'} not found.`
        });
      }

      operation.items = db.prepare('SELECT * FROM operation_items WHERE operation_id = ?').all(operation.id);

      return res.json({
        success: true,
        data: operation
      });
    } catch (err) {
      console.error('Error fetching operation by ID:', err);
      return res.status(500).json({ success: false, message: 'Could not retrieve operation.' });
    }
  }

  static createOperation(req, res) {
    try {
      const {
        type = 'receipt',
        reference,
        vendor_from,
        destination_to,
        contact = '',
        scheduled_date,
        source_document = '',
        status = 'ready',
        items = []
      } = req.body;

      const opType = type.toLowerCase() === 'delivery' ? 'delivery' : 'receipt';
      const fromLoc = vendor_from || (opType === 'delivery' ? 'WH/Stock' : '');
      const toLoc = destination_to || (opType === 'receipt' ? 'WH/Stock' : 'Customer');

      if (!fromLoc && opType === 'receipt') {
        return res.status(400).json({
          success: false,
          message: 'Vendor / Source location is required for receipts.'
        });
      }

      if (!toLoc && opType === 'delivery') {
        return res.status(400).json({
          success: false,
          message: 'Destination / Customer is required for deliveries.'
        });
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const schedDate = scheduled_date || now.split('T')[0];

      // Auto-generate reference if not provided with conflict avoidance
      let finalRef = reference;
      if (!finalRef) {
        const prefix = opType === 'delivery' ? 'WH/OUT/' : 'WH/IN/';
        const existingOps = db.prepare('SELECT reference FROM operations WHERE reference LIKE ?').all(`${prefix}%`);
        let maxNum = 0;
        for (const op of existingOps) {
          const numPart = parseInt(op.reference.replace(prefix, ''), 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        }
        finalRef = `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
      }

      const insertOp = db.prepare(`
        INSERT INTO operations (
          id, reference, type, vendor_from, destination_to, contact, 
          scheduled_date, source_document, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertOp.run(
        id,
        finalRef,
        opType,
        fromLoc,
        toLoc,
        contact,
        schedDate,
        source_document,
        status.toLowerCase(),
        now,
        now
      );

      // Insert line items
      if (Array.isArray(items) && items.length > 0) {
        const insertItem = db.prepare(`
          INSERT INTO operation_items (id, operation_id, product_name, sku, quantity, unit)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const item of items) {
          insertItem.run(
            crypto.randomUUID(),
            id,
            item.product_name || 'Standard Product',
            item.sku || 'SKU-GEN',
            Number(item.quantity) || 1,
            item.unit || 'Units'
          );
        }
      }

      const created = db.prepare('SELECT * FROM operations WHERE id = ?').get(id);
      created.items = db.prepare('SELECT * FROM operation_items WHERE operation_id = ?').all(id);

      return res.status(201).json({
        success: true,
        message: `${opType === 'delivery' ? 'Delivery order' : 'Receipt order'} created successfully.`,
        data: created
      });
    } catch (err) {
      console.error('Error creating operation:', err);
      return res.status(500).json({ success: false, message: 'Could not create operation.' });
    }
  }

  static updateOperation(req, res) {
    try {
      const { id } = req.params;
      const {
        vendor_from,
        destination_to,
        contact,
        scheduled_date,
        source_document,
        status,
        items
      } = req.body;

      const existing = db.prepare('SELECT * FROM operations WHERE id = ? OR reference = ?').get(id, id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Operation not found.' });
      }

      const now = new Date().toISOString();
      const updatedFrom = vendor_from !== undefined ? vendor_from : existing.vendor_from;
      const updatedTo = destination_to !== undefined ? destination_to : existing.destination_to;
      const updatedContact = contact !== undefined ? contact : existing.contact;
      const updatedDate = scheduled_date !== undefined ? scheduled_date : existing.scheduled_date;
      const updatedSource = source_document !== undefined ? source_document : existing.source_document;
      const updatedStatus = status !== undefined ? status.toLowerCase() : existing.status;

      db.prepare(`
        UPDATE operations 
        SET vendor_from = ?, destination_to = ?, contact = ?, scheduled_date = ?, source_document = ?, status = ?, updated_at = ? 
        WHERE id = ?
      `).run(updatedFrom, updatedTo, updatedContact, updatedDate, updatedSource, updatedStatus, now, existing.id);

      if (Array.isArray(items)) {
        db.prepare('DELETE FROM operation_items WHERE operation_id = ?').run(existing.id);
        const insertItem = db.prepare(`
          INSERT INTO operation_items (id, operation_id, product_name, sku, quantity, unit)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const item of items) {
          insertItem.run(
            crypto.randomUUID(),
            existing.id,
            item.product_name || 'Standard Product',
            item.sku || 'SKU-GEN',
            Number(item.quantity) || 1,
            item.unit || 'Units'
          );
        }
      }

      const updated = db.prepare('SELECT * FROM operations WHERE id = ?').get(existing.id);
      updated.items = db.prepare('SELECT * FROM operation_items WHERE operation_id = ?').all(existing.id);

      return res.json({
        success: true,
        message: 'Operation updated successfully.',
        data: updated
      });
    } catch (err) {
      console.error('Error updating operation:', err);
      return res.status(500).json({ success: false, message: 'Could not update operation.' });
    }
  }

  static updateOperationStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['draft', 'waiting', 'ready', 'done', 'cancelled'];
      if (!status || !validStatuses.includes(status.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      const existing = db.prepare('SELECT id, type FROM operations WHERE id = ? OR reference = ?').get(id, id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Operation not found.'
        });
      }

      const now = new Date().toISOString();
      const updateStmt = db.prepare(`
        UPDATE operations 
        SET status = ?, updated_at = ? 
        WHERE id = ?
      `);
      updateStmt.run(status.toLowerCase(), now, existing.id);

      const updated = db.prepare('SELECT * FROM operations WHERE id = ?').get(existing.id);
      updated.items = db.prepare('SELECT * FROM operation_items WHERE operation_id = ?').all(existing.id);
      return res.json({
        success: true,
        message: `Status updated to ${status}.`,
        data: updated
      });
    } catch (err) {
      console.error('Error updating operation status:', err);
      return res.status(500).json({ success: false, message: 'Could not update status.' });
    }
  }

  static deleteOperation(req, res) {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT id FROM operations WHERE id = ? OR reference = ?').get(id, id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Operation not found.' });
      }

      db.prepare('DELETE FROM operations WHERE id = ?').run(existing.id);
      return res.json({ success: true, message: 'Operation deleted successfully.' });
    } catch (err) {
      console.error('Error deleting operation:', err);
      return res.status(500).json({ success: false, message: 'Could not delete operation.' });
    }
  }
}

module.exports = OperationsController;
