const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'stocksense-super-secret-development-key-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.split(' ')[1] 
    : (req.query.token || null);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. No token provided.'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token. Please log in again.'
      });
    }
    req.user = decoded;
    next();
  });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.split(' ')[1] 
    : (req.query.token || null);

  if (!token) {
    req.user = {
      id: 'default-operator',
      name: 'Warehouse Operator',
      email: 'operator@stocksense.io',
      role: 'staff'
    };
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token. Please log in again.'
      });
    }
    req.user = decoded;
    next();
  });
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to perform this action.'
      });
    }
    next();
  };
}

module.exports = {
  generateToken,
  requireAuth,
  authenticateToken,
  requireRole,
  JWT_SECRET
};
