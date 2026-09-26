const db = require('../config/db');

class StockController {
  static getStock(req, res) {
    try {
      const { search } = req.query;

      // Base query for aggregated stock
      // Sum received (done receipts), delivered (done deliveries),
      // incoming (ready/waiting receipts), outgoing (ready/waiting deliveries)
      const items = db.prepare(`
        SELECT 
          oi.sku,
          oi.product_name,
          oi.unit,
          op.destination_to,
          op.vendor_from,
          op.type,
          op.status,
          oi.quantity
        FROM operation_items oi
        JOIN operations op ON oi.operation_id = op.id
      `).all();

      const stockMap = new Map();

      // Seed standard catalog defaults so all products are tracked
      const catalogDefaults = [
        { sku: 'FUR-001', name: 'Office Chair Ergonomic', location: 'WH/Stock1', category: 'Furniture' },
        { sku: 'FUR-002', name: 'Standing Desk Frame', location: 'WH/Stock1', category: 'Furniture' },
        { sku: 'DEC-011', name: 'Acoustic Wall Panels', location: 'WH/Stock2', category: 'Decor' },
        { sku: 'MAT-004', name: 'Anti-fatigue Floor Mat', location: 'WH/Stock1', category: 'Accessories' },
        { sku: 'WOD-008', name: 'Solid Oak Tabletop', location: 'WH/Stock1', category: 'Raw Materials' },
        { sku: 'STG-003', name: 'Industrial Shelving Rack', location: 'WH/Stock2', category: 'Storage' },
        { sku: 'MET-020', name: 'Steel Angle Brackets', location: 'WH/Stock1', category: 'Hardware' },
        { sku: 'EQP-009', name: 'Hydraulic Pallet Jack', location: 'WH/InputDock', category: 'Equipment' }
      ];

      for (const def of catalogDefaults) {
        stockMap.set(def.sku, {
          sku: def.sku,
          product_name: def.name,
          category: def.category,
          location: def.location,
          unit: 'Units',
          on_hand: 0,
          incoming: 0,
          outgoing: 0,
          forecasted: 0
        });
      }

      for (const row of items) {
        const sku = row.sku || 'SKU-GEN';
        if (!stockMap.has(sku)) {
          stockMap.set(sku, {
            sku,
            product_name: row.product_name,
            category: 'General',
            location: row.destination_to || 'WH/Stock',
            unit: row.unit || 'Units',
            on_hand: 0,
            incoming: 0,
            outgoing: 0,
            forecasted: 0
          });
        }

        const entry = stockMap.get(sku);

        if (row.type === 'receipt') {
          if (row.status === 'done') {
            entry.on_hand += Number(row.quantity) || 0;
          } else if (['ready', 'waiting'].includes(row.status)) {
            entry.incoming += Number(row.quantity) || 0;
          }
        } else if (row.type === 'delivery') {
          if (row.status === 'done') {
            entry.on_hand = Math.max(0, entry.on_hand - (Number(row.quantity) || 0));
          } else if (['ready', 'waiting'].includes(row.status)) {
            entry.outgoing += Number(row.quantity) || 0;
          }
        }
      }

      // Compute forecasted = on_hand + incoming - outgoing
      let result = Array.from(stockMap.values()).map(item => ({
        ...item,
        forecasted: item.on_hand + item.incoming - item.outgoing
      }));

      if (search && search.trim()) {
        const s = search.trim().toLowerCase();
        result = result.filter(item => 
          item.product_name.toLowerCase().includes(s) || 
          item.sku.toLowerCase().includes(s) ||
          item.location.toLowerCase().includes(s)
        );
      }

      return res.json({
        success: true,
        count: result.length,
        data: result
      });
    } catch (err) {
      console.error('Error fetching stock:', err);
      return res.status(500).json({ success: false, message: 'Could not fetch stock inventory.' });
    }
  }

  static getStockBySku(req, res) {
    try {
      const { sku } = req.params;
      const allStock = StockController._getAllStockInternal();
      const match = allStock.find(s => s.sku.toLowerCase() === sku.toLowerCase());
      if (!match) {
        return res.status(404).json({ success: false, message: `Product SKU ${sku} not found.` });
      }
      return res.json({ success: true, data: match });
    } catch (err) {
      console.error('Error fetching stock by SKU:', err);
      return res.status(500).json({ success: false, message: 'Could not fetch stock item.' });
    }
  }
}

module.exports = StockController;
