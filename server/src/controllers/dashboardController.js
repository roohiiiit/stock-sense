const db = require('../config/db');

class DashboardController {
  static getStats(req, res) {
    try {
      // Receipts stats
      const receiptsToReceive = db.prepare(`
        SELECT COUNT(*) as count 
        FROM operations 
        WHERE type = 'receipt' AND status IN ('ready', 'waiting')
      `).get().count;

      const totalReceipts = db.prepare(`
        SELECT COUNT(*) as count 
        FROM operations 
        WHERE type = 'receipt'
      `).get().count;

      // Delivery stats
      const deliveriesToDeliver = db.prepare(`
        SELECT COUNT(*) as count 
        FROM operations 
        WHERE type = 'delivery' AND status IN ('ready', 'waiting')
      `).get().count;

      const totalDeliveries = db.prepare(`
        SELECT COUNT(*) as count 
        FROM operations 
        WHERE type = 'delivery'
      `).get().count;

      // Status breakdown for receipts
      const statusCounts = db.prepare(`
        SELECT status, COUNT(*) as count 
        FROM operations 
        WHERE type = 'receipt' 
        GROUP BY status
      `).all();

      const breakdown = {
        draft: 0,
        waiting: 0,
        ready: 0,
        done: 0,
        cancelled: 0
      };

      for (const row of statusCounts) {
        if (breakdown[row.status] !== undefined) {
          breakdown[row.status] = row.count;
        }
      }

      // Recent movements for dashboard preview
      const recentOps = db.prepare(`
        SELECT id, reference, type, vendor_from, destination_to, contact, scheduled_date, source_document, status, created_at
        FROM operations 
        ORDER BY created_at DESC 
        LIMIT 6
      `).all();

      const getItems = db.prepare('SELECT product_name, sku, quantity, unit FROM operation_items WHERE operation_id = ?');
      const recentMovements = recentOps.map(op => ({
        ...op,
        items: getItems.all(op.id)
      }));

      return res.json({
        success: true,
        data: {
          receipts: {
            toReceive: receiptsToReceive,
            totalOperations: totalReceipts,
            breakdown
          },
          deliveries: {
            toDeliver: deliveriesToDeliver,
            totalOperations: totalDeliveries
          },
          recentMovements
        }
      });
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      return res.status(500).json({
        success: false,
        message: 'Could not fetch dashboard statistics.'
      });
    }
  }
}

module.exports = DashboardController;
