import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import aiRoutes from './routes/aiRoutes.js';
import paypalRoutes from './routes/paypalRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Configure exact CORS allowlist from FRONTEND_URL environment variable and local development
const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const configuredOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((u) => u.trim()).filter(Boolean)
  : [];

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...configuredOrigins]));

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser / server-to-server requests (e.g., curl, Render health probes)
    if (!origin) return callback(null, true);

    // Verify exact match against allowlist or authorized Vercel deployment
    const isExactMatch = allowedOrigins.includes(origin);
    const isVercelDeployment =
      origin.endsWith('.vercel.app') &&
      configuredOrigins.some((c) => c.endsWith('.vercel.app'));

    if (isExactMatch || isVercelDeployment) {
      return callback(null, true);
    }

    // Reject unauthorized external origins
    const corsError = new Error(`CORS Error: Origin ${origin} not allowed by PayPilot AI.`);
    corsError.status = 403;
    return callback(corsError, false);
  },
  credentials: true
}));

// Parse JSON request bodies
app.use(express.json());

// Basic request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint (for Render / cloud uptime monitoring)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PayPilot AI Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    config: {
      port: PORT,
      host: HOST,
      nodeEnv: process.env.NODE_ENV || 'development',
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

app.listen(PORT, HOST, () => {
  console.log(`========================================`);
  console.log(`🚀 PayPilot AI Backend is running on:`);
  console.log(`   Host: ${HOST} | Port: ${PORT}`);
  console.log(`   Health check: http://${HOST}:${PORT}/api/health`);
  console.log(`   AI Parsing:   POST http://${HOST}:${PORT}/api/ai/parse-invoice`);
  console.log(`   PayPal Status: GET http://${HOST}:${PORT}/api/paypal/status`);
  console.log(`========================================`);
});
