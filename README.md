# PayPilot AI 🚀
> **Your Intelligent Invoice and Payment Assistant**
> *Built for the PayPal AI Hackathon 2026*

PayPilot AI is a fintech assistant engineered for freelancers, contractors, and small business owners. It bridges conversational AI and automated financial infrastructure by transforming natural-language descriptions into professional invoices, managing invoicing lifecycles, integrating directly with the **PayPal Invoicing REST API Sandbox**, and delivering intelligent payment follow-up assistance.

---

## 📌 Problem Statement

Freelancers and small businesses often struggle with tedious billing administration:
1. **Manual Invoicing Friction**: Manually filling line items, calculating totals, assigning invoice IDs, and configuring payment terms is time-consuming and error-prone.
2. **Missing Customer Data**: Traditional billing systems either fail without clear guidance or risk sending inaccurate invoices.
3. **Delayed Settlements & Follow-Up Anxiety**: Following up on overdue payments is awkward, leading to delayed collections and compromised client relationships.
4. **Integration Complexity**: Integrating secure payment APIs (like PayPal) while protecting secrets and preventing accidental real-money transactions requires careful architecture.

---

## 💡 Proposed Solution & Key Features

PayPilot AI solves these challenges through a unified, secure, AI-powered fintech workflow:

### 1. 📊 Executive Fintech Dashboard (Stage 1)
* **Fintech Overview Metrics**: Aggregates *Total Invoices*, *Paid Invoices (PayPal verified)*, *Pending Invoices*, and *Total Invoiced Value*.
* **Live System Health**: Header indicator monitoring connectivity between the React frontend and Express backend via `/api/health`.
* **Recent Activity Feed**: Quick inspection of recent billing actions.

### 2. ⚡ AI Invoice Generator (Stage 2)
* **Natural-Language Entity Extraction**: Uses Google Gemini to extract client names, email addresses, line items, amounts, currency codes, and due dates from free-form prompts (e.g., *"Create an invoice for Rahul Sharma for website development worth ₹15,000, due on 25 November 2026"*).
* **Strict Prompt Constraints & Missing-Field Detection**: Explicit system prompts instruct Gemini never to assume or invent missing customer details, emails, or amounts; any omitted field is extracted as `null`.
* **Backend Validation Layer**: An independent validation service (`invoiceValidator.js`) inspects the extracted entities, detects missing mandatory fields, and marks drafts as incomplete with visual indicators until the user completes the data.
* **Two-Way Synchronized Editor**: Full editing of customer details, dates, and dynamic line items with real-time UI updates.
* **Live Invoice Sheet Preview**: Side-by-side rendering of an authentic corporate billing sheet.
* **Mandatory Authorization**: Requires explicit user consent before saving or staging drafts.

### 3. 💳 Official PayPal REST API Sandbox Integration (Stage 3)
* **OAuth 2.0 Authentication**: Secure backend token acquisition via Client Credentials with automated TTL caching.
* **REST Invoicing v2 Schema**: Converts internal invoice models into compliant PayPal Invoicing API v2 structures with two-decimal precision.
* **Zero Real-Money Risk**: All calls target `https://api-m.sandbox.paypal.com`.
* **Explicit Dispatch Authorization**: Invoices cannot be dispatched without explicit checkbox consent in a dedicated modal.

### 4. 📈 PayPal Payment Status Tracking & Lifecycle Monitoring (Stage 4)
* **Authentic Status Normalization**: Ingests and normalizes genuine PayPal statuses: `DRAFT`, `SENT`, `PAID`, `MARKED_AS_PAID`, `CANCELLED`, `REFUNDED`, `PARTIALLY_PAID`, and `OVERDUE`.
* **Dynamic Overdue Intelligence**: Automatically detects overdue status when an invoice is `SENT` and today's date exceeds the specified due date.
* **Genuine Payment Extractor**: Extracts official transaction IDs (`capture_id`) and settlement timestamps without fabricating payment confirmations.
* **On-Demand Manual & Batch Refresh**: Status updates occur through individual manual refresh queries (`/api/paypal/invoices/:id/tracking`) or batch synchronization queries (`/api/paypal/invoices/batch-status`), protected by intelligent rate-limiting cooldowns (10s per invoice, 30s per batch). Continuous background polling and webhooks are not implemented in this MVP.
* **Clear Origin Differentiation**: Distinct visual tags distinguishing **Local AI Drafts** from **PayPal Synced** invoices.

### 5. 🤖 AI Payment Assistant & Tone Customization (Stage 5)
* **Contextual Follow-Up Drafting**: Crafts personalized email follow-ups referencing invoice ID, outstanding balance, due date, and client name.
* **Three Selectable Communication Tones**:
  * 👔 **Professional**: Formal, structured, business-standard etiquette.
  * ☕ **Friendly**: Warm, conversational, relationship-preserving.
  * ⚠️ **Firm but Polite**: Assertive, urgent, emphasizing terms for overdue accounts.
* **Follow-Up Intelligence**: Dynamically calculates next suggested follow-up dates based on due dates and delinquency length.
* **Eligibility Guardrails**: Prohibits generating reminders for already `PAID` or `CANCELLED` invoices.
* **Honest Delivery Reporting**: Acknowledges that SMTP email relays are not configured in the MVP, providing a one-click **Copy to Clipboard** workflow rather than falsely claiming an email was sent.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, JavaScript (ES6+), Tailwind CSS (Custom Fintech Palette), Lucide React |
| **Backend** | Node.js (v24), Express.js (v4), Axios, Dotenv, CORS |
| **AI / NLP Engine** | Google Gemini API via official `@google/generative-ai` SDK |
| **Payment Gateway** | PayPal Invoicing REST API v2 Sandbox (OAuth 2.0 Client Credentials) |
| **Testing** | Native Node.js Test Harness (Unit, Validation, HTTP Mock & Live Error Handlers) |

---

## 🏗️ System Architecture & Workflow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PAYPILOT AI FRONTEND                            │
│                 (React 18 + Vite + Tailwind CSS)                       │
│                                                                        │
│   [Dashboard]    [AI Generator]   [Invoices]   [Payments]  [Assistant] │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Proxied via Vite (/api -> :5000)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        PAYPILOT AI BACKEND                             │
│                      (Node.js + Express.js)                            │
│                                                                        │
│   ├── /api/health                   (Server & Config Health)           │
│   ├── /api/ai/parse-invoice         (Natural Language Entity Parser)   │
│   ├── /api/ai/generate-reminder     (Contextual Follow-up Assistant)   │
│   ├── /api/ai/send-reminder         (Authorization & Dispatch Check)   │
│   ├── /api/paypal/status            (OAuth & Gateway Health)           │
│   ├── /api/paypal/invoices          (Draft Creation & Listing)         │
│   ├── /api/paypal/invoices/:id      (Raw Invoice Retrieval)            │
│   ├── /api/paypal/invoices/:id/tracking (Normalized Lifecycle Data)    │
│   └── /api/paypal/invoices/:id/send (Explicit Authorized Dispatch)     │
└───────────────────────┬────────────────────────┬───────────────────────┘
                        │                        │
       Secured with     │                        │ Secured with
       GEMINI_API_KEY   │                        │ PAYPAL_CLIENT_ID / SECRET
                        ▼                        ▼
      ┌───────────────────────────┐    ┌──────────────────────────────────┐
      │     Google Gemini API     │    │   PayPal REST API Sandbox        │
      │   (gemini-1.5-flash)      │    │  (api-m.sandbox.paypal.com)      │
      └───────────────────────────┘    └──────────────────────────────────┘
```

---

## 📁 Project Folder Structure

```
paypilot-ai/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── aiController.js           # Handles AI invoice extraction
│   │   │   ├── assistantController.js    # Handles reminder generation & send checks
│   │   │   └── paypalController.js       # Handles PayPal OAuth, invoices, tracking & dispatch
│   │   ├── routes/
│   │   │   ├── aiRoutes.js               # Express router for AI endpoints
│   │   │   └── paypalRoutes.js           # Express router for PayPal endpoints
│   │   ├── services/
│   │   │   ├── geminiService.js          # Google Gemini generative SDK integration
│   │   │   ├── invoiceValidator.js       # Entity normalization & missing field checks
│   │   │   ├── paypalService.js          # PayPal REST API OAuth 2.0 & v2 Invoicing client
│   │   │   └── paymentTrackingService.js # Status normalization, overdue logic & rate limits
│   │   └── server.js                     # Main Express server entry point
│   ├── tests/
│   │   ├── test_ai_endpoints.js          # Unit tests: prompt parsing & entity validation
│   │   ├── test_http_ai_endpoint.js      # Integration tests: HTTP error handling & codes
│   │   ├── test_paypal_payload.js        # Unit tests: PayPal v2 payload compliance
│   │   ├── test_paypal_http_endpoints.js # Integration tests: PayPal routes & confirmation
│   │   ├── test_payment_tracking.js      # Unit tests: Status mapping, overdue & rate limiting
│   │   ├── test_ai_assistant.js          # Unit tests: 3 tones, ineligible statuses & copy logic
│   │   └── test_paypal_auth_handling.js  # Integration test: Authentic OAuth error handling
│   ├── .env.example                      # Template for backend configuration
│   ├── .env                              # Local environment file (git-ignored)
│   ├── .gitignore                        # Backend git-ignore file
│   └── package.json                      # Backend dependencies & start scripts
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AiInvoiceGenerator.jsx    # NL prompt input, editable sheet & preview
│   │   │   ├── AiPaymentAssistant.jsx    # Tone selector, reminder preview & clipboard copy
│   │   │   ├── AllInvoices.jsx           # Invoice table, type badges & PayPal dispatch
│   │   │   └── PaymentsView.jsx          # Live gateway tracking, metrics & batch refresh
│   │   ├── App.jsx                       # Main shell, navy sidebar & global state
│   │   ├── main.jsx                      # React 18 DOM mount point
│   │   └── index.css                     # Tailwind CSS directives & scrollbar styles
│   ├── index.html                        # Application HTML shell with Inter typography
│   ├── vite.config.js                    # Vite bundler configuration with /api proxy
│   ├── tailwind.config.js                # Custom fintech theme configuration
│   ├── postcss.config.js                 # PostCSS setup
│   ├── .gitignore                        # Frontend git-ignore file
│   └── package.json                      # Frontend dependencies & build scripts
├── .gitignore                            # Root git-ignore file
└── README.md                             # Project documentation
```

---

## 🚦 Setup and Installation Instructions

### 1. Prerequisites
* **Node.js**: v18.0.0+ (Tested and verified on Node v24.21.0)
* **npm**: v10.0.0+ (Tested and verified on npm v11.19.0)

### 2. Configure Environment Variables
Navigate to the `backend/` directory and create your `.env` file from `.env.example`:
```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and supply your credentials:
```env
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Google Gemini API Key (Get free key from https://aistudio.google.com/)
GEMINI_API_KEY=your_gemini_api_key_here

# PayPal Sandbox Credentials (Get from https://developer.paypal.com/)
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret_here
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
```
*(Note: If keys are omitted, the application runs in Configuration Mode, cleanly reporting required credentials without crashing or faking success).*

---

## 💻 Instructions to Run Frontend and Backend

Open two separate terminals:

### Terminal 1: Backend Server
```bash
cd backend
npm install
npm run dev
```
> The Express server will start on **`http://localhost:5000`**.
> The `--watch` flag automatically detects changes.

### Terminal 2: Frontend Client
```bash
cd frontend
npm install
npm run dev
```
> The Vite development server will start on **`http://localhost:5173`**.

Open **`http://localhost:5173`** in your browser. The connection badge in the top right will turn green: **"Backend: Connected (Port 5000)"**.

---

## 📡 Verified API Endpoints

All endpoints have been implemented and verified against the backend source code:

| Method | Endpoint | Description | Status Codes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health & integration readiness status | `200` |
| `POST` | `/api/ai/parse-invoice` | Extracts structured JSON invoice from natural language | `200`, `400`, `503` |
| `POST` | `/api/ai/generate-reminder` | Drafts contextual payment reminder across 3 tones | `200`, `400`, `503` |
| `POST` | `/api/ai/send-reminder` | Validates explicit authorization for reminder dispatch | `200`, `400` |
| `GET` | `/api/paypal/status` | Checks PayPal Sandbox OAuth 2.0 connectivity | `200` |
| `POST` | `/api/paypal/invoices` | Creates a new draft invoice in PayPal Sandbox | `201`, `400`, `503` |
| `GET` | `/api/paypal/invoices` | Lists recent invoices from PayPal Sandbox | `200`, `503` |
| `GET` | `/api/paypal/invoices/:id` | Retrieves raw invoice record from PayPal Sandbox | `200`, `400`, `503` |
| `GET` | `/api/paypal/invoices/:id/tracking` | Retrieves normalized status, overdue & settlement data | `200`, `400`, `429`, `503` |
| `POST` | `/api/paypal/invoices/:id/send` | Dispatches invoice to client (requires `confirmed: true`) | `200`, `400`, `503` |
| `POST` | `/api/paypal/invoices/batch-status` | Synchronizes multiple invoice statuses (up to 20) | `200`, `400`, `503` |

---

## 🧪 How to Run Automated Tests

The backend includes a comprehensive, dependency-free test suite covering unit logic, validation rules, HTTP endpoints, and live Sandbox error handling.

To run all automated test suites, execute the following commands in the `backend/` directory:

```bash
cd backend

# 1. Natural Language Extraction & Missing Entity Tests (18 tests)
node tests/test_ai_endpoints.js

# 2. AI HTTP Endpoints & Validation Error Handling (7 tests)
node tests/test_http_ai_endpoint.js

# 3. PayPal Invoicing REST v2 Schema Formatter Tests (13 tests)
node tests/test_paypal_payload.js

# 4. PayPal Express Endpoints & Authorization Tests (8 tests)
node tests/test_paypal_http_endpoints.js

# 5. PayPal Payment Status Tracking, Overdue & Rate Limiter Tests (32 tests)
node tests/test_payment_tracking.js

# 6. AI Assistant 3-Tone Generator & Guardrail Tests (23 tests)
node tests/test_ai_assistant.js

# 7. Authentic PayPal Sandbox OAuth Handshake Test (1 test)
node tests/test_paypal_auth_handling.js
```
**Total: 102 passing tests, 0 failures.**

To test the frontend production build:
```bash
cd frontend
npm run build
```
*(Compiles all 2,101 modules in ~10 seconds with 0 warnings or errors).*

---

## 🔒 Security & PayPal Sandbox Architecture

* **Strict Credential Isolation**: All Client IDs, Secrets, and AI keys are stored exclusively in `backend/.env`. No secrets are bundled into or accessible by client-side code.
* **Git Protection**: All `.env` and `.env.*` files are explicitly blocked across root, backend, and frontend `.gitignore` configurations.
* **Sandbox Exclusivity**: Requests strictly target `https://api-m.sandbox.paypal.com`. No live payment endpoints or real financial accounts are ever contacted.
* **Mandatory Explicit Consent**: Both PayPal invoice sending and AI payment reminders require deliberate user authorization checkboxes before execution.
* **Zero Fake Transactions**: If PayPal credentials or payments are unverified, PayPilot displays clear configuration-required messages rather than fabricating fake success states.

---

## ⚠️ Current Scope & Limitations

1. **Gemini API Key Required for Live AI Generation**:
   * Natural-language parsing and reminder generation require a valid `GEMINI_API_KEY` in `backend/.env`. Without it, endpoints return a `503 CONFIG_MISSING` error with instructions.
2. **PayPal Sandbox Credentials Required for Remote Dispatch**:
   * Creating and dispatching invoices through PayPal requires `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` from a PayPal Developer Sandbox account.
3. **Email Delivery (SMTP Relay)**:
   * Direct SMTP or transactional email delivery (e.g., SendGrid/Amazon SES) is not configured in this MVP. The system accurately reports this status and provides a one-click clipboard copy workflow rather than claiming an email was sent.
4. **Pre-Production Testing**:
   * The application is verified in Sandbox Mode. Production transition requires updating `PAYPAL_API_BASE` to `https://api-m.paypal.com` and completing PayPal account onboarding.

---

## 👥 Hackathon Submission Details

* **Project Name**: PayPilot AI
* **Event**: PayPal AI Hackathon 2026
* **Category**: AI in FinTech / Invoicing & Payments
* **License**: MIT
