const db = require('../config/db');

class StockController {
  /**
   * Internal helper to compute real-time aggregated warehouse stock
   * including on-hand ledger, incoming commitments, outgoing commitments,
   * forecasted balances, safety thresholds, and low-stock alert evaluations.
   */
  static _computeStock(search = '', threshold = 10) {
    const defaultThreshold = Number.isInteger(threshold) && threshold >= 0 ? threshold : 10;

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

    // Standard warehouse catalog baseline
    const catalogDefaults = [
      { sku: 'FUR-001', name: 'Office Chair Ergonomic', location: 'WH/Stock1', category: 'Furniture', min_threshold: 10 },
      { sku: 'FUR-002', name: 'Standing Desk Frame', location: 'WH/Stock1', category: 'Furniture', min_threshold: 10 },
      { sku: 'DEC-011', name: 'Acoustic Wall Panels', location: 'WH/Stock2', category: 'Decor', min_threshold: 15 },
      { sku: 'MAT-004', name: 'Anti-fatigue Floor Mat', location: 'WH/Stock1', category: 'Accessories', min_threshold: 10 },
      { sku: 'WOD-008', name: 'Solid Oak Tabletop', location: 'WH/Stock1', category: 'Raw Materials', min_threshold: 10 },
      { sku: 'STG-003', name: 'Industrial Shelving Rack', location: 'WH/Stock2', category: 'Storage', min_threshold: 10 },
      { sku: 'MET-020', name: 'Steel Angle Brackets', location: 'WH/Stock1', category: 'Hardware', min_threshold: 25 },
      { sku: 'EQP-009', name: 'Hydraulic Pallet Jack', location: 'WH/InputDock', category: 'Equipment', min_threshold: 5 }
    ];

    for (const def of catalogDefaults) {
      stockMap.set(def.sku, {
        sku: def.sku,
        product_name: def.name,
        category: def.category,
        location: def.location,
        unit: 'Units',
        min_threshold: def.min_threshold || defaultThreshold,
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
          min_threshold: defaultThreshold,
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

    let result = Array.from(stockMap.values()).map(item => {
      const minThreshold = item.min_threshold || defaultThreshold;
      const isOutOfStock = item.on_hand === 0;
      const isLowStock = item.on_hand <= minThreshold;
      const stockStatus = isOutOfStock ? 'out_of_stock' : isLowStock ? 'low_stock' : 'in_stock';
      const severity = isOutOfStock ? 'critical' : isLowStock ? 'warning' : 'normal';

      return {
        ...item,
        min_threshold: minThreshold,
        forecasted: item.on_hand + item.incoming - item.outgoing,
        is_low_stock: isLowStock,
        is_out_of_stock: isOutOfStock,
        stock_status: stockStatus,
        severity
      };
    });

    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      result = result.filter(item => 
        item.product_name.toLowerCase().includes(s) || 
        item.sku.toLowerCase().includes(s) ||
        item.location.toLowerCase().includes(s)
      );
    }

    return result;
  }

  static getStock(req, res) {
    try {
      const OperationsController = require('./operationsController');
      OperationsController._checkAndPromoteWaitingDeliveries();

      const { search, filter } = req.query;
      let result = StockController._computeStock(search);

      const totalTracked = result.length;
      const outOfStockCount = result.filter(item => item.is_out_of_stock).length;
      const lowStockCount = result.filter(item => item.is_low_stock).length;

      if (filter === 'low_stock') {
        result = result.filter(item => item.is_low_stock);
      } else if (filter === 'out_of_stock') {
        result = result.filter(item => item.is_out_of_stock);
      } else if (filter === 'in_stock') {
        result = result.filter(item => !item.is_low_stock);
      }

      return res.json({
        success: true,
        count: result.length,
        totalTracked,
        lowStockCount,
        outOfStockCount,
        data: result
      });
    } catch (err) {
      console.error('Error fetching stock:', err);
      return res.status(500).json({ success: false, message: 'Could not fetch stock inventory.' });
    }
  }

  static getLowStockAlerts(req, res) {
    try {
      const thresholdParam = req.query.threshold ? parseInt(req.query.threshold, 10) : 10;
      const allStock = StockController._computeStock('', thresholdParam);

      const alerts = allStock.filter(item => item.is_low_stock);
      const criticalAlerts = alerts.filter(item => item.is_out_of_stock);
      const warningAlerts = alerts.filter(item => !item.is_out_of_stock && item.is_low_stock);

      return res.json({
        success: true,
        threshold: thresholdParam,
        totalAlerts: alerts.length,
        criticalCount: criticalAlerts.length,
        warningCount: warningAlerts.length,
        criticalItems: criticalAlerts,
        warningItems: warningAlerts,
        alerts
      });
    } catch (err) {
      console.error('Error fetching low stock alerts:', err);
      return res.status(500).json({ success: false, message: 'Could not fetch low stock alerts.' });
    }
  }

  static getStockBySku(req, res) {
    try {
      const { sku } = req.params;
      const allStock = StockController._computeStock();
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

  static adjustStock(req, res) {
    try {
      const { sku, quantity, product_name, reason } = req.body;
      const targetQty = Number(quantity);
      if (isNaN(targetQty) || targetQty < 0) {
        return res.status(400).json({ success: false, message: 'Valid quantity is required.' });
      }

      const allStock = StockController._computeStock();
      const existing = allStock.find(s => (s.sku && sku && s.sku.toLowerCase() === sku.toLowerCase()) || 
                                          (s.product_name && product_name && s.product_name.toLowerCase() === product_name.toLowerCase()));
      const currentOnHand = existing ? (existing.on_hand || 0) : 0;
      const delta = targetQty - currentOnHand;

      if (delta !== 0) {
        const crypto = require('node:crypto');
        const opId = crypto.randomUUID();
        const now = new Date().toISOString();
        const refNum = Math.floor(1000 + Math.random() * 9000);
        const ref = `WH/ADJ/${refNum}`;
        const opType = delta > 0 ? 'receipt' : 'delivery';
        const absQty = Math.abs(delta);
        const resolvedSku = sku || (existing ? existing.sku : 'SKU-GEN');
        const resolvedName = product_name || (existing ? existing.product_name : 'Warehouse Item');

        db.prepare(`
          INSERT INTO operations (id, reference, type, vendor_from, destination_to, contact, scheduled_date, source_document, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          opId,
          ref,
          opType,
          opType === 'receipt' ? 'Inventory Adjustment' : 'WH/Stock',
          opType === 'receipt' ? 'WH/Stock' : 'Inventory Adjustment',
          req.user ? req.user.name : 'Warehouse Operator',
          now.split('T')[0],
          reason || 'Physical Count Adjustment',
          'done',
          now,
          now
        );

        db.prepare(`
          INSERT INTO operation_items (id, operation_id, product_name, sku, quantity, unit)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          opId,
          resolvedName,
          resolvedSku,
          absQty,
          existing ? existing.unit : 'Units'
        );
      }

      const OperationsController = require('./operationsController');
      OperationsController._checkAndPromoteWaitingDeliveries();

      const updatedStock = StockController._computeStock();
      const updatedItem = updatedStock.find(s => (s.sku && sku && s.sku.toLowerCase() === sku.toLowerCase()) || 
                                                (s.product_name && product_name && s.product_name.toLowerCase() === product_name.toLowerCase()));

      return res.json({
        success: true,
        message: 'Stock adjusted successfully.',
        data: updatedItem
      });
    } catch (err) {
      console.error('Error adjusting stock:', err);
      return res.status(500).json({ success: false, message: 'Could not adjust stock.' });
    }
  }
}

module.exports = StockController;
