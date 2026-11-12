import React, { useState, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Calendar,
  User,
  DollarSign,
  FileText,
  ShieldAlert,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight
} from 'lucide-react';

const TONE_OPTIONS = [
  {
    id: 'professional',
    label: 'Professional',
    badge: 'Business Standard',
    description: 'Courteous, structured, and formal. Ideal for corporate clients and standard billing cycles.',
    icon: '👔'
  },
  {
    id: 'friendly',
    label: 'Friendly',
    badge: 'Warm & Casual',
    description: 'Approachable, warm, and conversational. Great for long-term clients, freelancers, and retainers.',
    icon: '☕'
  },
  {
    id: 'firm',
    label: 'Firm but Polite',
    badge: 'Urgent & Assertive',
    description: 'Direct, clear, and focused on immediate settlement without being discourteous. Best for overdue accounts.',
    icon: '⚠️'
  }
];

export default function AiPaymentAssistant({ onNavigate }) {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState('');
  const [selectedTone, setSelectedTone] = useState('professional');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReminder, setGeneratedReminder] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [copied, setCopied] = useState(false);

  // Send Confirmation Modal state
  const [showSendModal, setShowSendModal] = useState(false);
  const [userAuthorized, setUserAuthorized] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = () => {
    try {
      const stored = localStorage.getItem('paypilot_invoices');
      if (stored) {
        const parsed = JSON.parse(stored);
        setInvoices(parsed);
        if (parsed.length > 0) {
          // Default to first pending or overdue invoice
          const pending = parsed.find((i) => i.status !== 'PAID' && i.status !== 'CANCELLED');
          setSelectedInvoiceNumber(pending ? pending.invoiceNumber : parsed[0].invoiceNumber);
        }
      }
    } catch (e) {
      console.error('Error loading invoices:', e);
    }
  };

  const selectedInvoice = invoices.find((i) => i.invoiceNumber === selectedInvoiceNumber);
  const isPaidOrCancelled =
    selectedInvoice &&
    (selectedInvoice.status === 'PAID' ||
      selectedInvoice.status === 'MARKED_AS_PAID' ||
      selectedInvoice.status === 'CANCELLED');

  const todayStr = new Date().toISOString().split('T')[0];
  const isOverdue =
    selectedInvoice &&
    selectedInvoice.status === 'SENT' &&
    selectedInvoice.dueDate &&
    selectedInvoice.dueDate < todayStr;

  // Generate reminder message
  const handleGenerateReminder = async () => {
    if (!selectedInvoice) return;

    if (isPaidOrCancelled) {
      setErrorNotice('Reminders cannot be generated for settled or cancelled invoices.');
      return;
    }

    setIsGenerating(true);
    setErrorNotice(null);
    setDeliveryResult(null);

    try {
      const res = await fetch('/api/ai/generate-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice: selectedInvoice,
          tone: selectedTone
        })
      });

      const result = await res.json();

      if (!res.ok) {
        if (result.code === 'CONFIG_MISSING') {
          setErrorNotice(
            'Google Gemini API key is missing. Please add GEMINI_API_KEY in backend/.env to generate AI reminders.'
          );
        } else {
          setErrorNotice(result.error || 'Failed to generate reminder.');
        }
        return;
      }

      setGeneratedReminder(result.data);
    } catch (err) {
      console.error('Generation error:', err);
      setErrorNotice('Network error communicating with PayPilot AI assistant service.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy message to clipboard
  const handleCopyToClipboard = () => {
    if (!generatedReminder) return;

    const fullText = `Subject: ${generatedReminder.subject}\n\n${generatedReminder.messageBody}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Authorize and attempt send
  const handleConfirmSend = async () => {
    if (!userAuthorized || !generatedReminder) return;

    setIsSending(true);

    try {
      const res = await fetch('/api/ai/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed: true,
          recipient: { email: selectedInvoice.customerEmail },
          subject: generatedReminder.subject,
          messageBody: generatedReminder.messageBody
        })
      });

      const data = await res.json();

      // Honest delivery reporting: never claim fake email success
      setDeliveryResult(data);
      setShowSendModal(false);
    } catch (err) {
      console.error('Send error:', err);
      setErrorNotice('Failed to communicate with reminder dispatch service.');
      setShowSendModal(false);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 font-sans">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="p-1 rounded bg-purple-100 text-accent-600">
            <Bot className="h-4 w-4" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-accent-600">
            Powered by Google Gemini 1.5
          </span>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          AI Payment Assistant
        </h2>
        <p className="text-sm text-slate-500">
          Draft intelligent, contextual payment follow-ups with tone customization, overdue intelligence, and suggested reminder dates.
        </p>
      </div>

      {/* Error Notice */}
      {errorNotice && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <span className="text-xs font-semibold">{errorNotice}</span>
          </div>
          <button onClick={() => setErrorNotice(null)} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Honest Delivery Notification Banner */}
      {deliveryResult && (
        <div className="p-5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-950">
            <CheckCircle2 className="h-5 w-5 text-brand-600" />
            <span>Reminder Prepared for {deliveryResult.recipientEmail}</span>
          </div>
          <p className="text-xs text-blue-800 leading-relaxed">
            {deliveryResult.message}
          </p>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleCopyToClipboard}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-2 shadow-xs transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Formatted Email'}</span>
            </button>
            <button
              onClick={() => setDeliveryResult(null)}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Invoice Selection & Tone Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Invoice Selector & Tone */}
        <div className="lg:col-span-5 space-y-6">
          {/* Invoice Picker Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              1. Select Invoice to Follow Up
            </label>

            {invoices.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-50 text-center border border-slate-100 space-y-2">
                <p className="text-xs text-slate-500">No invoices available in PayPilot.</p>
                <button
                  onClick={() => onNavigate('ai-generator')}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  Create an invoice first →
                </button>
              </div>
            ) : (
              <select
                value={selectedInvoiceNumber}
                onChange={(e) => {
                  setSelectedInvoiceNumber(e.target.value);
                  setGeneratedReminder(null);
                  setErrorNotice(null);
                }}
                className="w-full text-xs rounded-xl p-3 border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {invoices.map((inv) => (
                  <option key={inv.invoiceNumber} value={inv.invoiceNumber}>
                    {inv.invoiceNumber} — {inv.customerName} ({inv.currency} {inv.amount}) [{inv.status}]
                  </option>
                ))}
              </select>
            )}

            {/* Selected Invoice Mini Card */}
            {selectedInvoice && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Client:</span>
                  <span className="font-semibold text-slate-800">{selectedInvoice.customerName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-medium text-slate-700">{selectedInvoice.customerEmail || 'No email provided'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Amount Due:</span>
                  <span className="font-bold text-slate-900">
                    {selectedInvoice.currency} {Number(selectedInvoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Due Date:</span>
                  <span className="font-semibold text-slate-800">{selectedInvoice.dueDate}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Lifecycle Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      selectedInvoice.status === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800'
                        : isOverdue
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {isOverdue ? 'OVERDUE' : selectedInvoice.status}
                  </span>
                </div>
              </div>
            )}

            {/* Warning if Paid or Cancelled */}
            {isPaidOrCancelled && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5 text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  This invoice is already {selectedInvoice?.status}. Payment reminders cannot and should not be dispatched for settled or cancelled invoices.
                </span>
              </div>
            )}
          </div>

          {/* Tone Selector */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              2. Choose Communication Tone
            </label>

            <div className="space-y-2.5">
              {TONE_OPTIONS.map((t) => {
                const isSelected = selectedTone === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTone(t.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/40 shadow-xs ring-1 ring-brand-500'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{t.icon}</span>
                        <span className="text-xs font-bold text-slate-900">{t.label}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {t.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed pl-6">
                      {t.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Generate Trigger */}
            <button
              onClick={handleGenerateReminder}
              disabled={isGenerating || !selectedInvoice || isPaidOrCancelled}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-700 hover:to-accent-700 text-white text-xs font-semibold py-3 rounded-xl shadow-md shadow-brand-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Drafting Contextual Message...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate Follow-Up with AI</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Editable Preview Workspace */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Message Preview & Customization
              </h3>
              <p className="text-xs text-slate-500">
                Review and edit the message before sending. You retain full control over every word.
              </p>
            </div>
            {generatedReminder && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-purple-50 text-accent-700 border border-purple-200">
                Tone: {generatedReminder.tone}
              </span>
            )}
          </div>

          {!generatedReminder ? (
            <div className="p-12 text-center rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-purple-50 text-accent-600 mx-auto flex items-center justify-center">
                <Bot className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-bold text-slate-700">
                No Reminder Drafted Yet
              </h4>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Select an invoice on the left, choose your desired tone (Professional, Friendly, or Firm), and click "Generate Follow-Up with AI".
              </p>
            </div>
          ) : (
            <div className="space-y-4 animate-fadeIn">
              {/* Follow-up Intelligence Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="h-4 w-4 text-brand-600" />
                  <span>
                    Suggested Next Follow-up: <strong className="text-slate-900">{generatedReminder.suggestedFollowUpDate}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 sm:justify-end">
                  <Clock className="h-4 w-4 text-accent-600" />
                  <span>
                    Urgency Status: <strong className="text-slate-900">{generatedReminder.urgencyLevel}</strong>
                  </span>
                </div>
              </div>

              {/* Editable Subject */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Subject Line:
                </label>
                <input
                  type="text"
                  value={generatedReminder.subject}
                  onChange={(e) =>
                    setGeneratedReminder({ ...generatedReminder, subject: e.target.value })
                  }
                  className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Editable Body */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Message Body:
                </label>
                <textarea
                  rows={9}
                  value={generatedReminder.messageBody}
                  onChange={(e) =>
                    setGeneratedReminder({ ...generatedReminder, messageBody: e.target.value })
                  }
                  className="w-full text-xs text-slate-800 leading-relaxed rounded-xl border border-slate-300 p-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500 font-sans"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCopyToClipboard}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span className="text-emerald-700">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy Formatted Email</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUserAuthorized(false);
                    setShowSendModal(true);
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-600/20 transition-all"
                >
                  <Send className="h-4 w-4" />
                  <span>Send Reminder Email</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Explicit User Authorization Modal */}
      {showSendModal && generatedReminder && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Authorize Reminder Dispatch
                  </h3>
                  <p className="text-xs text-slate-500">
                    Explicit consent required before notifying customer.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowSendModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Recipient Email:</span>
                <span className="font-bold text-slate-900">{selectedInvoice.customerEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Recipient Name:</span>
                <span className="font-semibold text-slate-800">{selectedInvoice.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Subject:</span>
                <span className="text-slate-700 truncate max-w-xs">{generatedReminder.subject}</span>
              </div>
            </div>

            {/* Mandatory Checkbox */}
            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-brand-50/50 border border-brand-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={userAuthorized}
                onChange={(e) => setUserAuthorized(e.target.checked)}
                className="mt-1 h-4 w-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
              />
              <span className="text-xs text-slate-700 leading-relaxed font-medium">
                I have reviewed the subject, tone, and body. I explicitly authorize sending this reminder to <strong>{selectedInvoice.customerEmail}</strong>.
              </span>
            </label>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSendModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!userAuthorized || isSending}
                onClick={handleConfirmSend}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-600/20 transition-all flex items-center gap-2"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Authorize & Dispatch</span>
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
