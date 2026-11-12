import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Sparkles,
  FileText,
  CreditCard,
  Bot,
  Settings,
  PlusCircle,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Key
} from 'lucide-react';
import AiInvoiceGenerator from './components/AiInvoiceGenerator';
import AllInvoices from './components/AllInvoices';
import PaymentsView from './components/PaymentsView';
import AiPaymentAssistant from './components/AiPaymentAssistant';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [backendHealth, setBackendHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [invoices, setInvoices] = useState([]);

  // Load invoices from localStorage
  const loadStoredInvoices = () => {
    try {
      const stored = localStorage.getItem('paypilot_invoices');
      if (stored) {
        setInvoices(JSON.parse(stored));
      } else {
        setInvoices([]);
      }
    } catch (e) {
      console.error('Error loading invoices:', e);
    }
  };

  useEffect(() => {
    checkBackendHealth();
    loadStoredInvoices();
  }, []);

  const checkBackendHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setBackendHealth(data);
      } else {
        setBackendHealth({ status: 'error', message: 'Non-200 response' });
      }
    } catch (err) {
      console.warn('Backend connection error:', err);
      setBackendHealth({ status: 'offline', message: 'Backend unreachable' });
    } finally {
      setLoadingHealth(false);
    }
  };

  const handleInvoiceCreated = (newInv) => {
    loadStoredInvoices();
  };

  // Compute metrics
  const totalInvoicesCount = invoices.length;
  const totalInvoicesValue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
  const paidInvoicesCount = invoices.filter((i) => (i.paypalStatus || i.status) === 'PAID').length;
  const pendingInvoicesCount = invoices.filter((i) => (i.paypalStatus || i.status) !== 'PAID').length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ai-generator', label: 'AI Invoice Generator', icon: Sparkles, badge: 'Gemini' },
    { id: 'invoices', label: 'All Invoices', icon: FileText, count: invoices.length },
    { id: 'payments', label: 'Payments', icon: CreditCard, badge: 'Sandbox' },
    { id: 'assistant', label: 'AI Assistant', icon: Bot, badge: 'Gemini' },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans">
      {/* Deep Navy Sidebar */}
      <aside className="w-64 bg-navy-900 border-r border-navy-800 flex flex-col justify-between shrink-0 select-none">
        <div>
          {/* Brand Logo & Title */}
          <div className="p-6 border-b border-navy-800">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
                <Zap className="h-5 w-5 fill-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  PayPilot <span className="text-xs px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 font-semibold border border-brand-500/30">AI</span>
                </h1>
                <p className="text-xs text-slate-400 font-medium">Smart Invoicing & Pay</p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 font-semibold'
                      : 'text-slate-400 hover:text-white hover:bg-navy-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge ? (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-accent-500/20 text-accent-400 border border-accent-500/30">
                      {item.badge}
                    </span>
                  ) : item.count > 0 ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-navy-800 text-slate-300">
                      {item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Hackathon Badge & PayPal Sandbox Status */}
        <div className="p-4 border-t border-navy-800 space-y-3">
          <div className="rounded-xl bg-navy-850 p-3 border border-navy-800">
            <div className="flex items-center justify-between text-xs text-slate-300 font-medium mb-1">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                PayPal Sandbox
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <p className="text-[11px] text-slate-400">
              PayPal AI Hackathon 2026 Mode
            </p>
          </div>

          <div className="text-center text-[11px] text-slate-500 font-medium">
            PayPilot AI MVP v1.0.0
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 sticky top-0 z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h2>
            <p className="text-xs text-slate-500">
              Your Intelligent Invoice and Payment Assistant
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Backend status indicator */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                backendHealth?.status === 'ok'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  backendHealth?.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'
                }`}
              />
              <span>
                Backend:{' '}
                {loadingHealth
                  ? 'Checking...'
                  : backendHealth?.status === 'ok'
                  ? 'Connected (Port 5000)'
                  : 'Disconnected'}
              </span>
              <button
                onClick={checkBackendHealth}
                title="Retry backend ping"
                className="hover:opacity-75 transition-opacity"
              >
                <RefreshCw className={`h-3 w-3 ${loadingHealth ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Quick Action: New Invoice */}
            <button
              onClick={() => setActiveTab('ai-generator')}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm shadow-brand-600/30 transition-all hover:shadow"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create Invoice</span>
            </button>
          </div>
        </header>

        {/* Tab Content Rendering */}
        <div className="p-8">
          {activeTab === 'dashboard' && (
            <div className="space-y-8 max-w-7xl mx-auto">
              {/* Welcome Banner */}
              <div className="rounded-2xl bg-gradient-to-r from-navy-900 via-navy-850 to-brand-900 p-6 text-white relative overflow-hidden shadow-lg border border-navy-800">
                <div className="relative z-10 max-w-2xl">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 mb-3">
                    <Sparkles className="h-3.5 w-3.5 text-brand-400" />
                    AI-Powered Fintech Assistant
                  </span>
                  <h3 className="text-2xl font-extrabold tracking-tight mb-2">
                    Turn plain English into PayPal invoices in seconds
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed mb-4">
                    PayPilot AI combines Google Gemini natural language understanding with PayPal Invoicing REST APIs to streamline billing, track statuses, and suggest smart payment follow-ups.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveTab('ai-generator')}
                      className="bg-brand-500 hover:bg-brand-600 text-white font-medium text-xs px-4 py-2 rounded-lg transition-all shadow-md flex items-center gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Try Natural Language Generator
                    </button>
                  </div>
                </div>
                <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-gradient-to-l from-white to-transparent pointer-events-none" />
              </div>

              {/* Core Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Invoices</span>
                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-brand-600 flex items-center justify-center">
                      <FileText className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">{totalInvoicesCount}</div>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
                    <span>Generated in PayPilot</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Paid Invoices</span>
                    <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">{paidInvoicesCount}</div>
                  <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium mt-2">
                    <TrendingUp className="h-3 w-3" />
                    <span>Verified by PayPal</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending / Staged</span>
                    <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Clock className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">{pendingInvoicesCount}</div>
                  <div className="flex items-center gap-1 text-xs text-amber-600 font-medium mt-2">
                    <span>Awaiting payment / dispatch</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Value</span>
                    <div className="h-8 w-8 rounded-lg bg-purple-50 text-accent-600 flex items-center justify-center">
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">
                    ${totalInvoicesValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
                    <span>Cumulative invoice total</span>
                  </div>
                </div>
              </div>

              {/* Recent Invoices Table */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-brand-600" />
                    Recent Invoices
                  </h4>
                  <button
                    onClick={() => setActiveTab('invoices')}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                  >
                    <span>View all</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>

                {invoices.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs text-slate-500 mb-3">
                      No invoices created yet. Test the AI generator with a quick prompt!
                    </p>
                    <button
                      onClick={() => setActiveTab('ai-generator')}
                      className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2 rounded-lg"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Generate First Invoice
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {invoices.slice(0, 5).map((inv) => (
                      <div key={inv.invoiceNumber} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{inv.customerName}</p>
                          <p className="text-[11px] text-slate-500">{inv.serviceDescription}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-900">
                            {inv.currency} {Number(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                            {inv.paypalStatus || inv.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'ai-generator' && (
            <AiInvoiceGenerator
              onInvoiceCreated={handleInvoiceCreated}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'invoices' && (
            <AllInvoices
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentsView
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'assistant' && (
            <AiPaymentAssistant
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'settings' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm max-w-4xl mx-auto space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-slate-100 text-slate-700">
                  <Settings className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Environment & Integration Settings
                  </h3>
                  <p className="text-xs text-slate-500">
                    PayPilot AI connects securely through backend environment variables.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Key className="h-4 w-4 text-brand-600" />
                      Google Gemini API Configuration
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Powers natural language invoice parsing and intelligent reminder drafting.
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      backendHealth?.config?.geminiConfigured
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {backendHealth?.config?.geminiConfigured ? 'Configured' : 'Not Configured (Add to backend/.env)'}
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-brand-600" />
                      PayPal Sandbox REST API
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Enables creating, dispatching, and tracking official Sandbox invoices.
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      backendHealth?.config?.paypalConfigured
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {backendHealth?.config?.paypalConfigured ? 'Configured' : 'Not Configured (Add to backend/.env)'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
