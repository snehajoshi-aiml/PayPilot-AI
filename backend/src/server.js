import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import aiRoutes from './routes/aiRoutes.js';
import paypalRoutes from './routes/paypalRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend requests
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Parse JSON request bodies
app.use(express.json());

// Basic request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PayPilot AI Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    config: {
      port: PORT,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== ''),
      paypalConfigured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
      paypalMode: process.env.PAYPAL_MODE || 'sandbox'
    }
  });
});

// API Routes
app.use('/api/ai', aiRoutes);
app.use('/api/paypal', paypalRoutes);

// Fallback 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.url}`
  });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    code: err.code || 'INTERNAL_ERROR',
    error: err.message || 'Something went wrong',
    details: err.details || null
  });
});

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`🚀 PayPilot AI Backend is running on:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   AI Parsing:   POST http://localhost:${PORT}/api/ai/parse-invoice`);
  console.log(`   PayPal Status: GET http://localhost:${PORT}/api/paypal/status`);
  console.log(`========================================`);
});
