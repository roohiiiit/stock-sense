const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

// Public auth endpoints
router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);

// Forgot Password Flow
router.post('/forgot-password/send-otp', AuthController.sendOtp);
router.post('/forgot-password/verify-otp', AuthController.verifyOtp);
router.post('/forgot-password/reset-password', AuthController.resetPassword);

// Protected session check
router.get('/me', requireAuth, AuthController.me);

module.exports = router;
