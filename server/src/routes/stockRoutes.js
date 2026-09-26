const express = require('express');
const router = express.Router();
const StockController = require('../controllers/stockController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Stock routes
router.get('/', StockController.getStock);
router.get('/alerts', StockController.getLowStockAlerts);
router.post('/adjust', authenticateToken, StockController.adjustStock);
router.get('/:sku', StockController.getStockBySku);
router.put('/:sku', authenticateToken, StockController.updateStock);

module.exports = router;

