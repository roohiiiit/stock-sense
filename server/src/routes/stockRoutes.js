const express = require('express');
const router = express.Router();
const StockController = require('../controllers/stockController');

// Stock routes
router.get('/', StockController.getStock);
router.get('/alerts', StockController.getLowStockAlerts);
router.get('/:sku', StockController.getStockBySku);

module.exports = router;
