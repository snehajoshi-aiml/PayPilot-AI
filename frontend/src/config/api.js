// Central API configuration for PayPilot AI frontend.
//
// In DEVELOPMENT (npm run dev):
//   - VITE_API_BASE_URL is not set (or empty)
//   - All fetch calls use relative paths like '/api/health'
//   - Vite's dev server proxy forwards '/api/*' to http://localhost:5000
//
// In PRODUCTION (Vercel / static build):
//   - VITE_API_BASE_URL must be set to the deployed backend URL
//     e.g. https://paypilot-ai-backend.onrender.com
//   - All fetch calls become 'https://paypilot-ai-backend.onrender.com/api/health'
//   - No proxy is involved; the browser calls the backend directly via CORS

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Build a full API URL from a relative path.
 *
 * @param {string} path - API path starting with '/' (e.g. '/api/health')
 * @returns {string} Full URL in production, relative path in development
 *
 * @example
 *   apiUrl('/api/health')
 *   // dev:  '/api/health'
 *   // prod: 'https://paypilot-ai-backend.onrender.com/api/health'
 */
export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}
