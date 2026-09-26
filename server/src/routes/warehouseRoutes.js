const express = require('express');
const router = express.Router();
const WarehouseController = require('../controllers/warehouseController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Warehouse Details & Locations Routes
router.get('/', authenticateToken, WarehouseController.getWarehouse);
router.put('/', authenticateToken, WarehouseController.updateWarehouse);
router.post('/locations', authenticateToken, WarehouseController.addLocation);
router.delete('/locations/:id', authenticateToken, WarehouseController.deleteLocation);

module.exports = router;
