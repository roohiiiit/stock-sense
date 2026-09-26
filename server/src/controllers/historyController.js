const db = require('../config/db');

class HistoryController {
  static getHistory(req, res) {
    try {
      const { type, limit = 50, search } = req.query;

      let queryStr = `
        SELECT 
          op.id as operation_id,
          op.reference,
          op.type,
          op.vendor_from,
          op.destination_to,
          op.contact,
          op.scheduled_date,
          op.source_document,
          op.status,
          op.created_at,
          op.updated_at,
          oi.id as item_id,
          oi.product_name,
          oi.sku,
          oi.quantity,
          oi.unit
        FROM operations op
        LEFT JOIN operation_items oi ON op.id = oi.operation_id
        WHERE 1=1
      `;
      const params = [];

      if (type && type !== 'all') {
        queryStr += ' AND op.type = ?';
        params.push(type.toLowerCase());
      }

      if (search && search.trim()) {
        const wild = `%${search.trim()}%`;
        queryStr += ' AND (op.reference LIKE ? OR op.vendor_from LIKE ? OR op.destination_to LIKE ? OR oi.product_name LIKE ? OR oi.sku LIKE ?)';
        params.push(wild, wild, wild, wild, wild);
      }

      queryStr += ' ORDER BY op.created_at DESC, op.updated_at DESC LIMIT ?';
      params.push(Number(limit) || 50);

      const rows = db.prepare(queryStr).all(...params);

      return res.json({
        success: true,
        count: rows.length,
        data: rows
      });
    } catch (err) {
      console.error('Error fetching move history:', err);
      return res.status(500).json({ success: false, message: 'Could not fetch move history.' });
    }
  }
}

module.exports = HistoryController;
