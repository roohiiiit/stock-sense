const express = require('express');
const router = express.Router();
const OperationsController = require('../controllers/operationsController');
const { authenticateToken } = require('../middleware/authMiddleware');

// --- RECEIPTS ENDPOINTS ---
router.get('/receipts', OperationsController.getReceipts);
router.get('/receipts/:id', OperationsController.getReceiptById);
router.post('/receipts', authenticateToken, OperationsController.createReceipt);
router.put('/receipts/:id', authenticateToken, OperationsController.updateOperation);
router.patch('/receipts/:id/status', authenticateToken, OperationsController.updateOperationStatus);
router.delete('/receipts/:id', authenticateToken, OperationsController.deleteOperation);

// --- DELIVERIES ENDPOINTS ---
router.get('/deliveries', OperationsController.getDeliveries);
router.get('/deliveries/:id', OperationsController.getDeliveryById);
router.post('/deliveries', authenticateToken, OperationsController.createDelivery);
router.put('/deliveries/:id', authenticateToken, OperationsController.updateOperation);
router.patch('/deliveries/:id/status', authenticateToken, OperationsController.updateOperationStatus);
router.delete('/deliveries/:id', authenticateToken, OperationsController.deleteOperation);

// --- GENERIC OPERATIONS ENDPOINTS ---
router.get('/', OperationsController.getOperations);
router.post('/', authenticateToken, OperationsController.createOperation);
router.get('/:id', OperationsController.getOperationById);
router.put('/:id', authenticateToken, OperationsController.updateOperation);
router.patch('/:id/status', authenticateToken, OperationsController.updateOperationStatus);
router.delete('/:id', authenticateToken, OperationsController.deleteOperation);

module.exports = router;
