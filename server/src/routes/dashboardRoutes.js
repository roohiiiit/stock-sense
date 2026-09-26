const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');

// Dashboard statistics
router.get('/stats', DashboardController.getStats);

module.exports = router;
