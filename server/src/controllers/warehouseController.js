const crypto = require('node:crypto');
const db = require('../config/db');

class WarehouseController {
  /**
   * Get primary warehouse details and its configured storage locations.
   */
  static getWarehouse(req, res) {
    try {
      let warehouse = null;

      // Look up warehouse linked to authenticated user first
      if (req.user && req.user.id && req.user.id !== 'default-operator') {
        warehouse = db.prepare('SELECT * FROM warehouses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(req.user.id);
      }

      // Fallback to default/primary warehouse
      if (!warehouse) {
        warehouse = db.prepare('SELECT * FROM warehouses ORDER BY created_at ASC LIMIT 1').get();
      }

      if (!warehouse) {
        return res.status(404).json({
          success: false,
          message: 'No warehouse found.'
        });
      }

      const locations = db.prepare(`
        SELECT id, warehouse_id, name, code, type, created_at, updated_at
        FROM warehouse_locations
        WHERE warehouse_id = ?
        ORDER BY code ASC
      `).all(warehouse.id);

      return res.json({
        success: true,
        warehouse: {
          ...warehouse,
          locations: locations || []
        }
      });
    } catch (err) {
      console.error('Error fetching warehouse:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve warehouse information.'
      });
    }
  }

  /**
   * Update primary warehouse details (Name, Short Code, Address).
   */
  static updateWarehouse(req, res) {
    try {
      const { name, short_code, address } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Warehouse name is required and must be at least 2 characters.'
        });
      }

      if (!short_code || typeof short_code !== 'string' || short_code.trim().length < 1) {
        return res.status(400).json({
          success: false,
          message: 'Short code is required (e.g. WH).'
        });
      }

      if (!address || typeof address !== 'string' || address.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Warehouse address is required.'
        });
      }

      const cleanName = name.trim();
      const cleanShortCode = short_code.trim().toUpperCase();
      const cleanAddress = address.trim();

      let warehouse = null;
      if (req.user && req.user.id && req.user.id !== 'default-operator') {
        warehouse = db.prepare('SELECT * FROM warehouses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(req.user.id);
      }
      if (!warehouse) {
        warehouse = db.prepare('SELECT * FROM warehouses ORDER BY created_at ASC LIMIT 1').get();
      }

      const now = new Date().toISOString();

      if (!warehouse) {
        const whId = crypto.randomUUID();
        const userId = req.user?.id !== 'default-operator' ? req.user.id : null;
        db.prepare(`
          INSERT INTO warehouses (id, user_id, name, short_code, address, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(whId, userId, cleanName, cleanShortCode, cleanAddress, now, now);

        warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(whId);
      } else {
        // Check uniqueness of short_code if changed
        const existingCode = db.prepare('SELECT id FROM warehouses WHERE short_code = ? AND id != ?').get(cleanShortCode, warehouse.id);
        if (existingCode) {
          return res.status(400).json({
            success: false,
            message: `Short code "${cleanShortCode}" is already in use by another warehouse.`
          });
        }

        db.prepare(`
          UPDATE warehouses
          SET name = ?, short_code = ?, address = ?, updated_at = ?
          WHERE id = ?
        `).run(cleanName, cleanShortCode, cleanAddress, now, warehouse.id);

        warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(warehouse.id);
      }

      const locations = db.prepare(`
        SELECT id, warehouse_id, name, code, type, created_at, updated_at
        FROM warehouse_locations
        WHERE warehouse_id = ?
        ORDER BY code ASC
      `).all(warehouse.id);

      return res.json({
        success: true,
        message: 'Warehouse details updated successfully.',
        warehouse: {
          ...warehouse,
          locations: locations || []
        }
      });
    } catch (err) {
      console.error('Error updating warehouse:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to update warehouse details.'
      });
    }
  }

  /**
   * Add a new storage location/zone to the warehouse.
   */
  static addLocation(req, res) {
    try {
      const { name, code, type } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Location name is required (at least 2 characters).'
        });
      }

      if (!code || typeof code !== 'string' || code.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Location code is required (e.g. WH/Stock3 or WH/ZoneA).'
        });
      }

      const validTypes = ['internal', 'incoming', 'outgoing', 'scrap'];
      const locationType = type && validTypes.includes(type.toLowerCase()) ? type.toLowerCase() : 'internal';

      const cleanName = name.trim();
      const cleanCode = code.trim();

      const warehouse = db.prepare('SELECT id FROM warehouses ORDER BY created_at ASC LIMIT 1').get();
      if (!warehouse) {
        return res.status(400).json({
          success: false,
          message: 'Cannot add location: no active warehouse exists.'
        });
      }

      // Check duplicate code
      const existingLoc = db.prepare('SELECT id FROM warehouse_locations WHERE code = ? COLLATE NOCASE').get(cleanCode);
      if (existingLoc) {
        return res.status(400).json({
          success: false,
          message: `Location code "${cleanCode}" already exists. Please choose a unique code.`
        });
      }

      const locId = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO warehouse_locations (id, warehouse_id, name, code, type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(locId, warehouse.id, cleanName, cleanCode, locationType, now, now);

      const createdLocation = db.prepare('SELECT * FROM warehouse_locations WHERE id = ?').get(locId);

      return res.status(201).json({
        success: true,
        message: 'Warehouse location created successfully.',
        location: createdLocation
      });
    } catch (err) {
      console.error('Error adding warehouse location:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to create warehouse location.'
      });
    }
  }

  /**
   * Delete a storage location/zone from the warehouse.
   */
  static deleteLocation(req, res) {
    try {
      const { id } = req.params;

      const loc = db.prepare('SELECT * FROM warehouse_locations WHERE id = ?').get(id);
      if (!loc) {
        return res.status(404).json({
          success: false,
          message: 'Warehouse location not found.'
        });
      }

      db.prepare('DELETE FROM warehouse_locations WHERE id = ?').run(id);

      return res.json({
        success: true,
        message: `Location "${loc.name}" (${loc.code}) deleted successfully.`
      });
    } catch (err) {
      console.error('Error deleting warehouse location:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete warehouse location.'
      });
    }
  }
}

module.exports = WarehouseController;
