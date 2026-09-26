const express = require('express');
const router = express.Router();
const HistoryController = require('../controllers/historyController');

router.get('/', HistoryController.getHistory);

module.exports = router;
