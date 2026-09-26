const crypto = require('node:crypto');
const db = require('../config/db');

class OtpService {
  /**
   * Generates and stores a 6-digit OTP code for password reset.
   * Expires in 10 minutes.
   */
  static generateOtp(email) {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    // Invalidate previous active OTPs for this email
    const invalidateStmt = db.prepare(`
      UPDATE password_resets 
      SET used = 1 
      WHERE email = ? AND used = 0
    `);
    invalidateStmt.run(email);

    // Save new OTP
    const insertStmt = db.prepare(`
      INSERT INTO password_resets (id, email, otp_code, expires_at, used, created_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `);
    insertStmt.run(id, email, otpCode, expiresAt, createdAt);

    console.log(`[AUTH-OTP] Generated OTP for ${email}: ${otpCode} (Expires in 10 min)`);
    return { otpCode, expiresAt };
  }

  /**
   * Verifies the OTP code for an email and issues a temporary reset token.
   */
  static verifyOtp(email, otpCode) {
    const query = db.prepare(`
      SELECT * FROM password_resets 
      WHERE email = ? AND otp_code = ? AND used = 0
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    const record = query.get(email, otpCode);

    if (!record) {
      return { success: false, message: 'Invalid or expired verification code.' };
    }

    if (Date.now() > record.expires_at) {
      return { success: false, message: 'Verification code has expired. Please request a new one.' };
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const updateStmt = db.prepare(`
      UPDATE password_resets 
      SET reset_token = ? 
      WHERE id = ?
    `);
    updateStmt.run(resetToken, record.id);

    return { success: true, resetToken };
  }

  /**
   * Validates reset token and marks it as used.
   */
  static consumeResetToken(email, resetToken) {
    const query = db.prepare(`
      SELECT * FROM password_resets 
      WHERE email = ? AND reset_token = ? AND used = 0
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    const record = query.get(email, resetToken);

    if (!record) {
      return { success: false, message: 'Invalid or expired reset session. Please request a new code.' };
    }

    if (Date.now() > record.expires_at + 15 * 60 * 1000) {
      return { success: false, message: 'Reset session expired. Please try again.' };
    }

    // Mark as used
    const markUsed = db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?');
    markUsed.run(record.id);

    return { success: true };
  }
}

module.exports = OtpService;
