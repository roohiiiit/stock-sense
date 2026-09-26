const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { generateToken } = require('../middleware/authMiddleware');
const OtpService = require('../services/otpService');
const { validateStrongPassword } = require('../utils/passwordValidator');

class AuthController {
  static async signup(req, res) {
    try {
      const { name, email, password, role } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Full name, email, and password are required.'
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address.'
        });
      }

      const passCheck = validateStrongPassword(password);
      if (!passCheck.isValid) {
        return res.status(400).json({
          success: false,
          message: passCheck.message,
          errors: passCheck.errors
        });
      }

      const assignedRole = (role === 'manager' || role === 'staff') ? role : 'staff';

      // Check if user already exists
      const existingQuery = db.prepare('SELECT id FROM users WHERE email = ?');
      const existingUser = existingQuery.get(cleanEmail);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email address already exists.'
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const insertStmt = db.prepare(`
        INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insertStmt.run(id, name.trim(), cleanEmail, passwordHash, assignedRole, now, now);

      const user = { id, name: name.trim(), email: cleanEmail, role: assignedRole };
      const token = generateToken(user);

      return res.status(201).json({
        success: true,
        message: 'Account created successfully.',
        token,
        user
      });
    } catch (err) {
      console.error('Error during signup:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error while creating account.'
      });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Please enter both work email and password.'
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const query = db.prepare('SELECT * FROM users WHERE email = ?');
      const user = query.get(cleanEmail);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid work email or password. Please verify your credentials.'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid work email or password. Please verify your credentials.'
        });
      }

      const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      };

      const token = generateToken(safeUser);

      return res.json({
        success: true,
        message: 'Logged in successfully.',
        token,
        user: safeUser
      });
    } catch (err) {
      console.error('Error during login:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error while processing login.'
      });
    }
  }

  static me(req, res) {
    try {
      const query = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?');
      const user = query.get(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User account not found.'
        });
      }

      return res.json({
        success: true,
        user
      });
    } catch (err) {
      console.error('Error in /me:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error.'
      });
    }
  }

  static sendOtp(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Please enter your work email.'
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      // Verify if email belongs to an existing user
      const query = db.prepare('SELECT id, name FROM users WHERE email = ?');
      const user = query.get(cleanEmail);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'No account found with this work email address.'
        });
      }

      const { otpCode, expiresAt } = OtpService.generateOtp(cleanEmail);

      return res.json({
        success: true,
        message: `Verification code sent to ${cleanEmail}`,
        // Included for seamless local dev & testing
        debugOtp: process.env.NODE_ENV === 'production' ? undefined : otpCode,
        expiresAt
      });
    } catch (err) {
      console.error('Error sending OTP:', err);
      return res.status(500).json({
        success: false,
        message: 'Could not generate reset code.'
      });
    }
  }

  static verifyOtp(req, res) {
    try {
      const { email, otpCode } = req.body;
      if (!email || !otpCode) {
        return res.status(400).json({
          success: false,
          message: 'Email and 6-digit verification code are required.'
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const result = OtpService.verifyOtp(cleanEmail, otpCode.toString().trim());

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      return res.json({
        success: true,
        message: 'Verification code confirmed.',
        resetToken: result.resetToken
      });
    } catch (err) {
      console.error('Error verifying OTP:', err);
      return res.status(500).json({
        success: false,
        message: 'Could not verify code.'
      });
    }
  }

  static async resetPassword(req, res) {
    try {
      const { email, resetToken, newPassword } = req.body;
      if (!email || !resetToken || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Email, reset token, and new password are required.'
        });
      }

      const passCheck = validateStrongPassword(newPassword);
      if (!passCheck.isValid) {
        return res.status(400).json({
          success: false,
          message: passCheck.message,
          errors: passCheck.errors
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const sessionResult = OtpService.consumeResetToken(cleanEmail, resetToken);

      if (!sessionResult.success) {
        return res.status(400).json({
          success: false,
          message: sessionResult.message
        });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      const now = new Date().toISOString();

      const updateStmt = db.prepare(`
        UPDATE users 
        SET password_hash = ?, updated_at = ? 
        WHERE email = ?
      `);
      updateStmt.run(passwordHash, now, cleanEmail);

      return res.json({
        success: true,
        message: 'Your password has been successfully reset. Please log in.'
      });
    } catch (err) {
      console.error('Error resetting password:', err);
      return res.status(500).json({
        success: false,
        message: 'Could not reset password.'
      });
    }
  }

  static sendChangePasswordOtp(req, res) {
    try {
      const email = req.user && req.user.email;
      if (!email) {
        return res.status(401).json({ success: false, message: 'Unauthorized session.' });
      }

      const { otpCode, expiresAt } = OtpService.generateOtp(email);
      return res.json({
        success: true,
        message: `Verification code sent to ${email}`,
        debugOtp: process.env.NODE_ENV === 'production' ? undefined : otpCode,
        expiresAt
      });
    } catch (err) {
      console.error('Error sending change password OTP:', err);
      return res.status(500).json({ success: false, message: 'Could not generate reset code.' });
    }
  }

  static async changePasswordWithOtp(req, res) {
    try {
      const email = req.user && req.user.email;
      const { otpCode, newPassword } = req.body;

      if (!email) {
        return res.status(401).json({ success: false, message: 'Unauthorized session.' });
      }
      if (!otpCode || !newPassword) {
        return res.status(400).json({ success: false, message: 'OTP code and new password are required.' });
      }

      const passCheck = validateStrongPassword(newPassword);
      if (!passCheck.isValid) {
        return res.status(400).json({
          success: false,
          message: passCheck.message,
          errors: passCheck.errors
        });
      }

      const verifyResult = OtpService.verifyOtp(email, otpCode.toString().trim());
      if (!verifyResult.success) {
        return res.status(400).json({ success: false, message: verifyResult.message });
      }

      OtpService.consumeResetToken(email, verifyResult.resetToken);

      const passwordHash = await bcrypt.hash(newPassword, 10);
      const now = new Date().toISOString();

      const updateStmt = db.prepare(`
        UPDATE users 
        SET password_hash = ?, updated_at = ? 
        WHERE email = ?
      `);
      updateStmt.run(passwordHash, now, email);

      return res.json({
        success: true,
        message: 'Password successfully changed using OTP verification.'
      });
    } catch (err) {
      console.error('Error changing password with OTP:', err);
      return res.status(500).json({ success: false, message: 'Could not change password.' });
    }
  }
}

module.exports = AuthController;
