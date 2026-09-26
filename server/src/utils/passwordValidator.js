/**
 * Password strength validator for StockSense
 * Enforces strong password security:
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 * - At least one special character (!@#$%^&* etc.)
 */

function validateStrongPassword(password) {
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      message: 'Password is required.',
      errors: ['Password is required.']
    };
  }

  const errors = [];

  if (password.length < 8) {
    errors.push('at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('at least one uppercase letter (A-Z)');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('at least one lowercase letter (a-z)');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('at least one number (0-9)');
  }

  // Special characters: non-alphanumeric and non-whitespace characters
  if (!/[^A-Za-z0-9\s]/.test(password)) {
    errors.push('at least one special character (!@#$%^&* etc.)');
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      message: `Password must contain ${errors.join(', ')}.`,
      errors
    };
  }

  return {
    isValid: true
  };
}

module.exports = {
  validateStrongPassword
};
