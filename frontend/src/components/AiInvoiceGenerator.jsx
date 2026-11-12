import React, { useState } from 'react';
import {
  Sparkles,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Send,
  RefreshCw,
  FileText,
  DollarSign,
  Calendar,
  Mail,
  User,
  ShieldAlert,
  ArrowRight,
  Eye,
  Check,
  X,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Info
} from 'lucide-react';

const SAMPLE_PROMPTS = [
  {
    title: 'Missing Email (Test Missing Field)',
    text: 'Create an invoice for Rahul Sharma for website development worth ₹15,000, due on 25 November 2026.'
  },
  {
    title: 'Complete Invoice (USD)',
    text: 'Create an invoice for Sarah Miller, email sarah@designcraft.com, for Brand Identity Design worth 450 USD, due in 14 days.'
  },
  {
    title: 'Consulting Project (EUR)',
    text: 'Bill TechNova Corp, contact accounts@technova.io, for 1200 EUR for Cloud Architecture Consulting due on December 15, 2026.'
  }
];

const POPULAR_CURRENCIES = ['USD', 'EUR', 'INR', 'GBP', 'CAD', 'AUD', 'SGD', 'JPY'];

export default function AiInvoiceGenerator({ onInvoiceCreated, onNavigate }) {
  // Natural language prompt input
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [configMissingNotice, setConfigMissingNotice] = useState(null);

  // Extracted invoice state
  const [invoice, setInvoice] = useState(null);
  const [validation, setValidation] = useState(null);
  const [aiNotes, setAiNotes] = useState('');

  // Confirmation modal state (Requirement 9: explicit confirmation)
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [userConfirmedConsent, setUserConfirmedConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState(null);

  // Handle Natural Language Generation
  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || prompt.trim().length < 5) {
      setErrorMessage('Please enter a descriptive prompt with at least 5 characters.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setConfigMissingNotice(null);
    setSuccessToast(null);

    try {
      const response = await fetch('/api/ai/parse-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: prompt.trim() })
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.code === 'CONFIG_MISSING') {
          setConfigMissingNotice({
            message: result.error,
            instructions: result.instructions || 'Add GEMINI_API_KEY to your backend/.env file and restart.'
          });
        } else {
          setErrorMessage(result.error || 'Failed to parse invoice with AI.');
        }
        return;
      }

      if (result.success && result.data) {
        setInvoice(result.data.invoice);
        setValidation(result.data.validation);
        setAiNotes(result.data.aiNotes || '');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setErrorMessage('Unable to connect to PayPilot backend. Please ensure the server is running on port 5000.');
    } finally {
      setIsLoading(false);
    }
  };

  // Field change handlers for editable preview
  const handleFieldChange = (field, value) => {
    setInvoice((prev) => {
      const updated = { ...prev, [field]: value };

      // If amount changed, update the primary item price too
      if (field === 'amount') {
        const numVal = parseFloat(value) || 0;
        if (updated.items && updated.items.length > 0) {
          updated.items = updated.items.map((it, idx) =>
            idx === 0 ? { ...it, unitPrice: numVal, total: numVal * it.quantity } : it
          );
        }
      }

      // If serviceDescription changed, update the primary item description too
      if (field === 'serviceDescription' && updated.items && updated.items.length > 0) {
        updated.items = updated.items.map((it, idx) =>
          idx === 0 ? { ...it, name: value, description: value } : it
        );
      }

      return updated;
    });

    // Re-evaluate missing fields in real-time
    setValidation((prev) => {
      if (!prev) return prev;
      const isProvided = value && String(value).trim() !== '';
      let missing = [...prev.missingFields];
      if (isProvided) {
        missing = missing.filter((f) => f !== field);
      } else if (!missing.includes(field)) {
        missing.push(field);
      }
      return {
        ...prev,
        missingFields: missing,
        isComplete: missing.length === 0
      };
    });
  };

  // Line item handlers
  const handleItemChange = (index, field, value) => {
    setInvoice((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };

      if (field === 'quantity' || field === 'unitPrice') {
        const qty = parseFloat(items[index].quantity) || 0;
        const price = parseFloat(items[index].unitPrice) || 0;
        items[index].total = Math.round(qty * price * 100) / 100;
      }

      // Re-sum total amount
      const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
      return {
        ...prev,
        items,
        amount: Math.round(totalAmount * 100) / 100
      };
    });
  };

  const handleAddItem = () => {
    setInvoice((prev) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        {
          name: 'Additional Service / Expense',
          description: '',
          quantity: 1,
          unitPrice: 0,
          total: 0
        }
      ]
    }));
  };

  const handleRemoveItem = (index) => {
    setInvoice((prev) => {
      const items = prev.items.filter((_, i) => i !== index);
      const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
      return {
        ...prev,
        items,
        amount: Math.round(totalAmount * 100) / 100
      };
    });
  };

  // Open confirmation modal
  const handleInitiateConfirmation = () => {
    // Check if required fields exist
    if (!invoice.customerName || !invoice.customerEmail || !invoice.amount || !invoice.currency || !invoice.dueDate) {
      setErrorMessage('Please complete all mandatory fields (Name, Email, Amount, Currency, Due Date) before confirming.');
      return;
    }
    setUserConfirmedConsent(false);
    setShowConfirmModal(true);
  };

  // Explicit confirmation submit
  const handleConfirmAndSave = () => {
    if (!userConfirmedConsent) return;

    setIsSubmitting(true);
    setTimeout(() => {
      // Save invoice to local storage or callback
      const savedInvoices = JSON.parse(localStorage.getItem('paypilot_invoices') || '[]');
      const newInvoice = {
        ...invoice,
        id: invoice.invoiceNumber,
        status: 'READY_FOR_PAYPAL',
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('paypilot_invoices', JSON.stringify([newInvoice, ...savedInvoices]));

      setIsSubmitting(false);
      setShowConfirmModal(false);
      setSuccessToast(`Invoice ${invoice.invoiceNumber} verified and staged for PayPal Sandbox dispatch!`);

      if (onInvoiceCreated) {
        onInvoiceCreated(newInvoice);
      }
    }, 600);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="p-1 rounded bg-brand-100 text-brand-600">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
            Powered by Google Gemini 1.5
          </span>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          AI Invoice Generator
        </h2>
        <p className="text-sm text-slate-500">
          Describe your invoice naturally. Gemini extracts all client, line item, and currency data into a structured, editable invoice draft.
        </p>
      </div>

      {/* Success Notification */}
      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{successToast}</p>
              <p className="text-xs text-emerald-600">
                You can view this invoice under "All Invoices" or proceed to PayPal integration in the next stage.
              </p>
            </div>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('invoices')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              View All Invoices
            </button>
          )}
        </div>
      )}

      {/* Configuration Missing Notice */}
      {configMissingNotice && (
        <div className="p-5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 shadow-sm space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <span>Gemini API Key Required</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            {configMissingNotice.message}
          </p>
          <div className="p-3 bg-white rounded-lg border border-amber-200 text-xs font-mono text-slate-700">
            1. Open <span className="font-bold">backend/.env</span><br />
            2. Add: <span className="text-brand-600 font-semibold">GEMINI_API_KEY=your_actual_key_here</span><br />
            3. Restart your backend server with <span className="font-semibold">npm run dev</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 shadow-sm">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <p className="text-xs font-medium">{errorMessage}</p>
        </div>
      )}

      {/* AI Prompt Input Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <label className="block text-sm font-bold text-slate-800">
          Describe your invoice in plain English:
        </label>
        <div className="relative">
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Create an invoice for Rahul Sharma, email rahul@example.com, for website development worth 100 USD, due in 7 days."
            className="w-full rounded-xl border border-slate-300 p-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all shadow-inner"
            disabled={isLoading}
          />
        </div>

        {/* Sample Prompt Pills */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Quick Examples to try:
          </span>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_PROMPTS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(sample.text)}
                className="text-xs text-slate-600 bg-slate-100 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 border border-slate-200 rounded-lg px-3 py-1.5 transition-all text-left flex items-center gap-1.5"
              >
                <Sparkles className="h-3 w-3 text-brand-500" />
                <span className="font-medium">{sample.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button & Status */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-100">
          <span className="text-xs text-slate-400">
            {prompt.length} characters
          </span>
          <button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-700 hover:to-accent-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-brand-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Gemini is extracting invoice data...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Generate Invoice Draft</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Extracted Invoice Review Section */}
      {invoice && (
        <div className="space-y-6 animate-fadeIn">
          {/* Missing Fields Banner if any */}
          {validation && !validation.isComplete && (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm flex items-start gap-4">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-amber-900">
                    Missing Information Required
                  </h4>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-200/60 text-amber-800">
                    Action Needed
                  </span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  {aiNotes || 'The AI extracted what was mentioned in your prompt, but some mandatory fields are missing. PayPilot never invents customer or financial information. Please complete the missing fields below.'}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {validation.missingFields.map((field) => (
                    <span
                      key={field}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-white border border-amber-300 text-amber-900 shadow-xs"
                    >
                      <X className="h-3 w-3 text-rose-500" />
                      Missing {field.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AI Notes Banner when complete */}
          {validation && validation.isComplete && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <span className="font-bold">Extraction Complete: </span>
                <span>{aiNotes || 'All required invoice details have been successfully identified and validated.'}</span>
              </div>
            </div>
          )}

          {/* Dual Panel: Editable Form (Left) & Real-time Invoice Sheet Preview (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Editable Form */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Edit Extracted Details
                  </h3>
                  <p className="text-xs text-slate-500">
                    Review and modify fields. Every field is fully editable.
                  </p>
                </div>
                <span className="text-xs font-mono font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                  {invoice.invoiceNumber}
                </span>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Customer Name *</span>
                    {!invoice.customerName && (
                      <span className="text-[10px] text-rose-600 font-medium">Required</span>
                    )}
                  </label>
                  <div className="relative">
                    <User className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="text"
                      value={invoice.customerName || ''}
                      onChange={(e) => handleFieldChange('customerName', e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className={`w-full rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 border focus:outline-none focus:ring-2 transition-all ${
                        !invoice.customerName
                          ? 'border-rose-300 bg-rose-50/30 focus:ring-rose-500'
                          : 'border-slate-300 focus:ring-brand-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Customer Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Customer Email *</span>
                    {!invoice.customerEmail && (
                      <span className="text-[10px] text-rose-600 font-medium">Required for PayPal</span>
                    )}
                  </label>
                  <div className="relative">
                    <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="email"
                      value={invoice.customerEmail || ''}
                      onChange={(e) => handleFieldChange('customerEmail', e.target.value)}
                      placeholder="e.g. client@example.com"
                      className={`w-full rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 border focus:outline-none focus:ring-2 transition-all ${
                        !invoice.customerEmail
                          ? 'border-rose-300 bg-rose-50/30 focus:ring-rose-500'
                          : 'border-slate-300 focus:ring-brand-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Total Amount *</span>
                    {(!invoice.amount || invoice.amount <= 0) && (
                      <span className="text-[10px] text-rose-600 font-medium">Required</span>
                    )}
                  </label>
                  <div className="relative">
                    <DollarSign className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={invoice.amount || ''}
                      onChange={(e) => handleFieldChange('amount', e.target.value)}
                      placeholder="100.00"
                      className={`w-full rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 border focus:outline-none focus:ring-2 transition-all ${
                        !invoice.amount || invoice.amount <= 0
                          ? 'border-rose-300 bg-rose-50/30 focus:ring-rose-500'
                          : 'border-slate-300 focus:ring-brand-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Currency */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Currency *</span>
                    {!invoice.currency && (
                      <span className="text-[10px] text-rose-600 font-medium">Required</span>
                    )}
                  </label>
                  <select
                    value={invoice.currency || 'USD'}
                    onChange={(e) => handleFieldChange('currency', e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-xs text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all bg-white"
                  >
                    {POPULAR_CURRENCIES.map((curr) => (
                      <option key={curr} value={curr}>
                        {curr}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Due Date *</span>
                    {!invoice.dueDate && (
                      <span className="text-[10px] text-rose-600 font-medium">Required</span>
                    )}
                  </label>
                  <div className="relative">
                    <Calendar className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="date"
                      value={invoice.dueDate || ''}
                      onChange={(e) => handleFieldChange('dueDate', e.target.value)}
                      className={`w-full rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 border focus:outline-none focus:ring-2 transition-all ${
                        !invoice.dueDate
                          ? 'border-rose-300 bg-rose-50/30 focus:ring-rose-500'
                          : 'border-slate-300 focus:ring-brand-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Issue Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Issue Date
                  </label>
                  <div className="relative">
                    <Calendar className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="date"
                      value={invoice.issueDate || ''}
                      onChange={(e) => handleFieldChange('issueDate', e.target.value)}
                      className="w-full rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              </div>

              {/* Service Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Service / Work Description *
                </label>
                <textarea
                  rows={2}
                  value={invoice.serviceDescription || ''}
                  onChange={(e) => handleFieldChange('serviceDescription', e.target.value)}
                  placeholder="Detailed description of services provided..."
                  className="w-full rounded-xl p-3 text-xs text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Line Items Section */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Line Items
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {invoice.items && invoice.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-6">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                          placeholder="Item name / description"
                          className="w-full rounded-lg px-2.5 py-1.5 text-xs border border-slate-300 bg-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          placeholder="Qty"
                          className="w-full rounded-lg px-2 py-1.5 text-xs border border-slate-300 bg-white text-center"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                          placeholder="Price"
                          className="w-full rounded-lg px-2 py-1.5 text-xs border border-slate-300 bg-white text-right"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        {invoice.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setInvoice(null);
                    setValidation(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                >
                  Discard Draft
                </button>

                <button
                  type="button"
                  onClick={handleInitiateConfirmation}
                  className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-6 py-2.5 rounded-xl shadow-md shadow-brand-600/30 transition-all"
                >
                  <Check className="h-4 w-4" />
                  <span>Review & Confirm Invoice</span>
                </button>
              </div>
            </div>

            {/* Right Column: Live Professional Invoice Preview Sheet */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-7 shadow-sm sticky top-24 space-y-6">
              {/* Preview Sheet Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-brand-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Live Invoice Preview
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {invoice.status || 'DRAFT'}
                </span>
              </div>

              {/* Invoice Body */}
              <div className="space-y-5 text-xs">
                {/* Brand & Invoice Number */}
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-base font-extrabold text-navy-900 tracking-tight">
                      PayPilot AI
                    </h4>
                    <p className="text-[11px] text-slate-500">Invoice #{invoice.invoiceNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-slate-500">Issue Date: <span className="font-semibold text-slate-700">{invoice.issueDate || '—'}</span></p>
                    <p className="text-[11px] text-slate-500">Due Date: <span className="font-semibold text-slate-700">{invoice.dueDate || '—'}</span></p>
                  </div>
                </div>

                {/* Bill To */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    Billed To:
                  </span>
                  <p className="font-bold text-slate-900 text-sm">
                    {invoice.customerName || <span className="text-rose-500 font-normal italic">[Name Missing]</span>}
                  </p>
                  <p className="text-slate-600">
                    {invoice.customerEmail || <span className="text-rose-500 italic">[Email Missing]</span>}
                  </p>
                </div>

                {/* Line Items Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-2.5">Item</th>
                        <th className="p-2.5 text-center">Qty</th>
                        <th className="p-2.5 text-right">Price</th>
                        <th className="p-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoice.items && invoice.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-medium text-slate-800">
                            {it.name || 'Service Item'}
                          </td>
                          <td className="p-2.5 text-center text-slate-600">
                            {it.quantity}
                          </td>
                          <td className="p-2.5 text-right text-slate-600">
                            {it.unitPrice?.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-right font-semibold text-slate-900">
                            {it.total?.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Total Summary */}
                <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Amount Due ({invoice.currency || 'USD'})
                    </span>
                    <div className="text-xl font-extrabold tracking-tight">
                      {invoice.currency === 'INR' ? '₹' : invoice.currency === 'EUR' ? '€' : invoice.currency === 'GBP' ? '£' : '$'}
                      {invoice.amount ? Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Due by</span>
                    <span className="text-xs font-semibold text-brand-300">{invoice.dueDate || 'Pending'}</span>
                  </div>
                </div>

                {/* PayPal Sandbox Notice */}
                <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200/60 text-blue-900 flex items-start gap-2 text-[11px] leading-relaxed">
                  <ShieldCheck className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
                  <span>
                    Upon your confirmation, this invoice can be submitted through PayPal's official Sandbox REST Invoicing API.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal (Requirement 9: Explicit user confirmation) */}
      {showConfirmModal && invoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Confirm Invoice Authorization
                  </h3>
                  <p className="text-xs text-slate-500">
                    Explicit approval is required before payment/dispatch actions.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Invoice Summary Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice Number:</span>
                <span className="font-semibold text-slate-800">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold text-slate-800">{invoice.customerName} ({invoice.customerEmail})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Service:</span>
                <span className="font-semibold text-slate-800">{invoice.serviceDescription}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Due:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {invoice.currency} {Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Due Date:</span>
                <span className="font-semibold text-slate-800">{invoice.dueDate}</span>
              </div>
            </div>

            {/* Explicit Consent Checkbox */}
            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-brand-50/50 border border-brand-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={userConfirmedConsent}
                onChange={(e) => setUserConfirmedConsent(e.target.checked)}
                className="mt-1 h-4 w-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
              />
              <span className="text-xs text-slate-700 leading-relaxed font-medium">
                I have reviewed the customer information, amount, and dates. I explicitly authorize creating and staging this invoice in PayPilot AI.
              </span>
            </label>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!userConfirmedConsent || isSubmitting}
                onClick={handleConfirmAndSave}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-600/20 transition-all flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Authorize & Save Invoice</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
