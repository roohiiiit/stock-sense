const express = require('express');
const cors = require('cors');
const path = require('node:path');

const authRoutes = require('./routes/authRoutes');
const operationsRoutes = require('./routes/operationsRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const stockRoutes = require('./routes/stockRoutes');
const historyRoutes = require('./routes/historyRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'StockSense Warehouse Management API',
    timestamp: new Date().toISOString()
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/move-history', historyRoutes);

// Serve frontend static assets from project root
const publicDir = path.join(__dirname, '..', '..');
app.use(express.static(publicDir));

// Fallback to index.html for SPA routing (Express 5 compatible)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    return res.sendFile(path.join(publicDir, 'index.html'));
  }
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API endpoint not found' });
  }
  next();
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: 'An unexpected internal error occurred.'
  });
});

module.exports = app;
