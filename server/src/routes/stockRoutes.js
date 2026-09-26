const express = require('express');
const router = express.Router();
const StockController = require('../controllers/stockController');

router.get('/', StockController.getStock);
router.get('/:sku', StockController.getStockBySku);

module.exports = router;
