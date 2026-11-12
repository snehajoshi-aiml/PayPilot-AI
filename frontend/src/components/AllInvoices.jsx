import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Eye,
  PlusCircle,
  ShieldCheck,
  AlertCircle,
  Send,
  RefreshCw,
  AlertTriangle,
  X,
  Check,
  Sparkles,
  CreditCard
} from 'lucide-react';
import { apiUrl } from '../config/api';

export default function AllInvoices({ onNavigate }) {
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // PayPal action state
  const [actionLoading, setActionLoading] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  // Explicit Send Confirmation Modal state
  const [invoiceToSend, setInvoiceToSend] = useState(null);
  const [userConfirmedSend, setUserConfirmedSend] = useState(false);
  const [emailSubject, setEmailSubject] = useState('Invoice from PayPilot AI Merchant');
  const [emailNote, setEmailNote] = useState('Thank you for your business. Please complete your payment securely via PayPal.');

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = () => {
    const raw = localStorage.getItem('paypilot_invoices');
    if (raw) {
      try {
        setInvoices(JSON.parse(raw));
      } catch (e) {
        console.error('Failed to parse stored invoices', e);
        setInvoices([]);
      }
    } else {
      setInvoices([]);
    }
  };

  const updateStoredInvoice = (updated) => {
    const list = invoices.map((i) => (i.invoiceNumber === updated.invoiceNumber ? updated : i));
    setInvoices(list);
    localStorage.setItem('paypilot_invoices', JSON.stringify(list));
  };

  // Sync / Create Invoice in PayPal Sandbox
  const handlePushToPayPal = async (inv) => {
    setActionLoading(inv.invoiceNumber);
    setActionNotice(null);

    try {
      const res = await fetch(apiUrl('/api/paypal/invoices'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inv)
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'PAYPAL_CONFIG_REQUIRED') {
          setActionNotice({
            type: 'config',
            message: 'PayPal Sandbox Credentials Required',
            instructions: 'Please configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in backend/.env to sync with PayPal.'
          });
        } else if (data.code === 'CONVERSION_RATE_MISSING') {
          setActionNotice({
            type: 'config',
            message: 'Currency Conversion Rate Required',
            instructions: data.instructions || 'Please set INR_TO_USD_RATE in the backend environment (e.g. 0.012).'
          });
        } else {
          setActionNotice({
            type: 'error',
            message: data.error || 'Failed to create invoice in PayPal Sandbox.'
          });
        }
        return;
      }

      const paypalId = data.data?.id || `INV2-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const convInfo = data.data?._conversionInfo;
      const updatedInv = {
        ...inv,
        paypalInvoiceId: paypalId,
        paypalStatus: 'DRAFT',
        status: 'PAYPAL_DRAFT',
        paypalHref: data.data?.href,
        lastUpdatedTime: new Date().toISOString(),
        ...(convInfo ? { paypalConversionInfo: convInfo } : {})
      };

      updateStoredInvoice(updatedInv);

      // Build success message with conversion details when applicable
      let successMsg = `Invoice ${inv.invoiceNumber} synced to PayPal Sandbox as DRAFT (${paypalId})!`;
      if (convInfo && convInfo.conversionApplied) {
        successMsg = `Invoice ${inv.invoiceNumber} synced to PayPal Sandbox as DRAFT (${paypalId}). Amount converted: ${convInfo.originalCurrency} ${Number(convInfo.originalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} → USD ${Number(convInfo.paypalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} (rate: ${convInfo.conversionRate}).`;
      }
      setActionNotice({
        type: 'success',
        message: successMsg
      });
    } catch (err) {
      console.error('PayPal push error:', err);
      setActionNotice({
        type: 'error',
        message: 'Unable to connect to PayPilot backend.'
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Open the explicit confirmation modal before sending
  const handleOpenSendModal = (inv) => {
    setUserConfirmedSend(false);
    setEmailSubject(`Invoice ${inv.invoiceNumber} from PayPilot AI Merchant`);
    setInvoiceToSend(inv);
  };

  // Execute Send after explicit confirmation
  const handleExecuteSend = async () => {
    if (!invoiceToSend || !userConfirmedSend) return;

    const inv = invoiceToSend;
    setActionLoading(inv.invoiceNumber);
    setInvoiceToSend(null);
    setActionNotice(null);

    try {
      let paypalId = inv.paypalInvoiceId;
      if (!paypalId) {
        const createRes = await fetch(apiUrl('/api/paypal/invoices'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inv)
        });
        const createData = await createRes.json();
        if (!createRes.ok) {
          if (createData.code === 'PAYPAL_CONFIG_REQUIRED') {
            setActionNotice({
              type: 'config',
              message: 'PayPal Sandbox Credentials Required',
              instructions: 'Please configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in backend/.env to send via PayPal.'
            });
          } else {
            setActionNotice({
              type: 'error',
              message: createData.error || 'Failed to initialize invoice in PayPal Sandbox.'
            });
          }
          return;
        }
        paypalId = createData.data?.id;
      }

      const sendRes = await fetch(apiUrl(`/api/paypal/invoices/${encodeURIComponent(paypalId)}/send`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed: true,
          subject: emailSubject,
          note: emailNote
        })
      });

      const sendData = await sendRes.json();
      if (!sendRes.ok) {
        setActionNotice({
          type: 'error',
          message: sendData.error || 'Failed to dispatch invoice via PayPal.'
        });
        return;
      }

      const updated = {
        ...inv,
        paypalInvoiceId: paypalId,
        paypalStatus: 'SENT',
        status: 'SENT',
        sentAt: new Date().toISOString(),
        lastUpdatedTime: new Date().toISOString()
      };
      updateStoredInvoice(updated);
      setActionNotice({
        type: 'success',
        message: `Invoice ${inv.invoiceNumber} dispatched via PayPal Sandbox to ${inv.customerEmail}!`
      });
    } catch (err) {
      console.error('Send error:', err);
      setActionNotice({
        type: 'error',
        message: 'Failed to communicate with backend while sending invoice.'
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Refresh status from PayPal using tracking endpoint
  const handleRefreshStatus = async (inv) => {
    if (!inv.paypalInvoiceId) return;
    setActionLoading(inv.invoiceNumber);
    setActionNotice(null);

    try {
      const res = await fetch(apiUrl(`/api/paypal/invoices/${encodeURIComponent(inv.paypalInvoiceId)}/tracking`));
      const result = await res.json();

      if (!res.ok) {
        if (result.code === 'RATE_LIMITED') {
          setActionNotice({
            type: 'error',
            message: result.error || 'Please wait a few seconds before refreshing again.'
          });
        } else {
          setActionNotice({
            type: 'error',
            message: result.error || 'Could not fetch PayPal status.'
          });
        }
        return;
      }

      const live = result.data;
      const updated = {
        ...inv,
        paypalStatus: live.status,
        status: live.status,
        isOverdue: live.isOverdue,
        lastUpdatedTime: live.dates?.lastUpdatedTime || new Date().toISOString()
      };
      updateStoredInvoice(updated);
      setActionNotice({
        type: 'success',
        message: `Verified status for ${inv.invoiceNumber}: ${live.displayStatus}`
      });
    } catch (err) {
      console.error('Refresh status error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredInvoices = invoices.filter((inv) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (inv.customerName || '').toLowerCase().includes(term) ||
      (inv.invoiceNumber || '').toLowerCase().includes(term) ||
      (inv.serviceDescription || '').toLowerCase().includes(term);

    const isSynced = Boolean(inv.paypalInvoiceId);
    const curStatus = (inv.paypalStatus || inv.status || 'DRAFT').toUpperCase();
    const isOverdue = curStatus === 'SENT' && inv.dueDate && inv.dueDate < todayStr;

    let matchesStatus = true;
    if (filterStatus === 'LOCAL_DRAFT') {
      matchesStatus = !isSynced;
    } else if (filterStatus === 'PAYPAL_SYNCED') {
      matchesStatus = isSynced;
    } else if (filterStatus === 'PAID') {
      matchesStatus = curStatus === 'PAID';
    } else if (filterStatus === 'SENT') {
      matchesStatus = curStatus === 'SENT';
    } else if (filterStatus === 'OVERDUE') {
      matchesStatus = isOverdue || curStatus === 'OVERDUE';
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            All Invoices
          </h2>
          <p className="text-sm text-slate-500">
            Distinguish between local AI drafts and PayPal Sandbox registered invoices.
          </p>
        </div>
        <button
          onClick={() => onNavigate('ai-generator')}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-brand-600/20 transition-all self-start md:self-auto"
        >
          <PlusCircle className="h-4 w-4" />
          <span>New AI Invoice</span>
        </button>
      </div>

      {/* Action Notice Alert */}
      {actionNotice && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between shadow-xs ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : actionNotice.type === 'config'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-start gap-3">
            {actionNotice.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />}
            {actionNotice.type === 'config' && <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />}
            {actionNotice.type === 'error' && <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />}
            <div>
              <p className="text-xs font-bold">{actionNotice.message}</p>
              {actionNotice.instructions && (
                <p className="text-[11px] mt-1 font-mono text-slate-700">{actionNotice.instructions}</p>
              )}
            </div>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by client, invoice # or service..."
            className="w-full rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs text-slate-700 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="ALL">All Invoices</option>
            <option value="LOCAL_DRAFT">Local AI Drafts Only</option>
            <option value="PAYPAL_SYNCED">PayPal Synced Invoices</option>
            <option value="SENT">Sent Invoices</option>
            <option value="PAID">Paid Invoices</option>
            <option value="OVERDUE">Overdue Invoices</option>
          </select>
        </div>
      </div>

      {/* Invoices List / Table */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-brand-50 text-brand-600 mx-auto flex items-center justify-center">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              No Invoices Found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {searchTerm || filterStatus !== 'ALL'
                ? 'Try adjusting your search query or filter.'
                : 'Create your first invoice in seconds using the AI Invoice Generator.'}
            </p>
          </div>
          <button
            onClick={() => onNavigate('ai-generator')}
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Generate with AI</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="p-4">Invoice #</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Origin & Type</th>
                  <th className="p-4">Due Date</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => {
                  const isCurrentAction = actionLoading === inv.invoiceNumber;
                  const hasPayPalId = Boolean(inv.paypalInvoiceId);
                  const curStatus = (inv.paypalStatus || inv.status || 'DRAFT').toUpperCase();
                  const isOverdue = curStatus === 'SENT' && inv.dueDate && inv.dueDate < todayStr;

                  return (
                    <tr key={inv.invoiceNumber} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4 font-mono font-medium text-slate-800">
                        <div className="font-bold">{inv.invoiceNumber}</div>
                        {hasPayPalId && (
                          <div className="text-[10px] font-mono text-brand-600">{inv.paypalInvoiceId}</div>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="font-semibold text-slate-900">{inv.customerName}</div>
                        <div className="text-[11px] text-slate-400">{inv.customerEmail}</div>
                      </td>

                      {/* Origin & Lifecycle badge */}
                      <td className="p-4">
                        {hasPayPalId ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                            <CreditCard className="h-3 w-3" />
                            PayPal Synced
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            <Sparkles className="h-3 w-3" />
                            Local AI Draft
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-slate-600">
                        {inv.dueDate}
                      </td>

                      <td className="p-4 text-right font-bold text-slate-900">
                        {inv.currency} {Number(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            curStatus === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isOverdue
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : curStatus === 'SENT'
                              ? 'bg-blue-50 text-brand-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {isOverdue ? 'OVERDUE' : curStatus}
                        </span>
                      </td>

                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Preview</span>
                        </button>

                        {!hasPayPalId && (
                          <button
                            onClick={() => handlePushToPayPal(inv)}
                            disabled={isCurrentAction}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-brand-700 border border-brand-200 inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                          >
                            <CreditCard className="h-3 w-3" />
                            <span>Sync PayPal</span>
                          </button>
                        )}

                        {curStatus !== 'PAID' && curStatus !== 'SENT' && (
                          <button
                            onClick={() => handleOpenSendModal(inv)}
                            disabled={isCurrentAction}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1 shadow-xs transition-colors disabled:opacity-50"
                          >
                            <Send className="h-3 w-3" />
                            <span>Send</span>
                          </button>
                        )}

                        {hasPayPalId && (
                          <button
                            onClick={() => handleRefreshStatus(inv)}
                            disabled={isCurrentAction}
                            title="Refresh status from PayPal Sandbox"
                            className="text-slate-400 hover:text-brand-600 p-1"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${isCurrentAction ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Explicit User Confirmation Modal for Sending Invoice */}
      {invoiceToSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Send className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Authorize PayPal Invoice Dispatch
                  </h3>
                  <p className="text-xs text-slate-500">
                    Explicit confirmation is required before notifying customer.
                  </p>
                </div>
              </div>
              <button onClick={() => setInvoiceToSend(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Recipient Email:</span>
                <span className="font-bold text-slate-900">{invoiceToSend.customerEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Recipient Name:</span>
                <span className="font-semibold text-slate-800">{invoiceToSend.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Billed:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {invoiceToSend.currency} {Number(invoiceToSend.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Due Date:</span>
                <span className="font-semibold text-slate-800">{invoiceToSend.dueDate}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Subject:
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Note to Customer:
                </label>
                <textarea
                  rows={2}
                  value={emailNote}
                  onChange={(e) => setEmailNote(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={userConfirmedSend}
                onChange={(e) => setUserConfirmedSend(e.target.checked)}
                className="mt-1 h-4 w-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
              />
              <span className="text-xs text-amber-900 leading-relaxed font-medium">
                I understand this will dispatch an official PayPal billing email via PayPal Sandbox to <strong>{invoiceToSend.customerEmail}</strong>. I explicitly authorize sending this invoice.
              </span>
            </label>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setInvoiceToSend(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!userConfirmedSend}
                onClick={handleExecuteSend}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-600/20 transition-all flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                <span>Confirm & Send via PayPal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Invoice Details: {selectedInvoice.invoiceNumber}
              </h3>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between p-3 rounded-lg bg-slate-50">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-800">{selectedInvoice.customerName} ({selectedInvoice.customerEmail})</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-slate-50">
                <span className="text-slate-500">Service:</span>
                <span className="font-semibold text-slate-800">{selectedInvoice.serviceDescription}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-slate-50">
                <span className="text-slate-500">Amount:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {selectedInvoice.currency} {Number(selectedInvoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-slate-50">
                <span className="text-slate-500">Due Date:</span>
                <span className="font-semibold text-slate-800">{selectedInvoice.dueDate}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-slate-50">
                <span className="text-slate-500">Origin / Type:</span>
                <span className="font-bold text-slate-800">
                  {selectedInvoice.paypalInvoiceId ? `PayPal Sandbox (${selectedInvoice.paypalInvoiceId})` : 'Local AI Draft'}
                </span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-slate-50">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-brand-600">{selectedInvoice.paypalStatus || selectedInvoice.status}</span>
              </div>
              {selectedInvoice.lastUpdatedTime && (
                <div className="flex justify-between p-3 rounded-lg bg-slate-50">
                  <span className="text-slate-500">Last Verified:</span>
                  <span className="text-slate-700">{new Date(selectedInvoice.lastUpdatedTime).toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
