import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  Send,
  FileText,
  Key,
  ShieldAlert,
  ArrowUpRight,
  Filter,
  Search,
  Eye,
  Calendar,
  DollarSign,
  AlertCircle,
  X,
  Lock
} from 'lucide-react';
import { apiUrl } from '../config/api';

export default function PaymentsView({ onNavigate }) {
  const [paypalStatus, setPaypalStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Tracking refresh states
  const [refreshingId, setRefreshingId] = useState(null);
  const [isBatchRefreshing, setIsBatchRefreshing] = useState(false);
  const [batchCooldown, setBatchCooldown] = useState(0);
  const [notification, setNotification] = useState(null);
  const [selectedTracking, setSelectedTracking] = useState(null);

  useEffect(() => {
    checkGatewayStatus();
    loadInvoices();
  }, []);

  // Cooldown countdown effect
  useEffect(() => {
    if (batchCooldown > 0) {
      const timer = setTimeout(() => setBatchCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [batchCooldown]);

  const checkGatewayStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch(apiUrl('/api/paypal/status'));
      const data = await res.json();
      setPaypalStatus(data);
    } catch (err) {
      console.error('Error fetching PayPal status:', err);
      setPaypalStatus({
        configured: false,
        status: 'OFFLINE',
        message: 'Could not connect to backend server.'
      });
    } finally {
      setLoadingStatus(false);
    }
  };

  const loadInvoices = () => {
    try {
      const stored = localStorage.getItem('paypilot_invoices');
      if (stored) {
        setInvoices(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading invoices:', e);
    }
  };

  const updateStoredInvoice = (updated) => {
    const list = invoices.map((i) => (i.invoiceNumber === updated.invoiceNumber ? updated : i));
    setInvoices(list);
    localStorage.setItem('paypilot_invoices', JSON.stringify(list));
  };

  // Synced invoices in PayPal Sandbox
  const syncedInvoices = invoices.filter((i) => Boolean(i.paypalInvoiceId));

  // Compute metrics (genuine PayPal tracking)
  const totalSyncedCount = syncedInvoices.length;
  const totalSyncedValue = syncedInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
  const paidInvoices = syncedInvoices.filter((i) => (i.paypalStatus || i.status) === 'PAID');
  const paidTotalValue = paidInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
  const sentInvoices = syncedInvoices.filter((i) => (i.paypalStatus || i.status) === 'SENT');
  const sentTotalValue = sentInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
  const draftInvoices = syncedInvoices.filter((i) => (i.paypalStatus || i.status) === 'DRAFT' || (i.paypalStatus || i.status) === 'PAYPAL_DRAFT');

  // Check overdue invoices
  const todayStr = new Date().toISOString().split('T')[0];
  const overdueInvoices = syncedInvoices.filter(
    (i) => (i.paypalStatus || i.status) === 'SENT' && i.dueDate && i.dueDate < todayStr
  );

  // Manual single invoice status refresh
  const handleRefreshSingle = async (inv) => {
    if (!inv.paypalInvoiceId) return;

    setRefreshingId(inv.invoiceNumber);
    setNotification(null);

    try {
      const res = await fetch(apiUrl(`/api/paypal/invoices/${encodeURIComponent(inv.paypalInvoiceId)}/tracking`));
      const result = await res.json();

      if (!res.ok) {
        if (result.code === 'RATE_LIMITED') {
          setNotification({
            type: 'warning',
            message: result.error || 'Please wait a few seconds before refreshing this invoice.'
          });
        } else if (result.code === 'PAYPAL_CONFIG_REQUIRED') {
          setNotification({
            type: 'warning',
            message: 'PayPal Sandbox credentials not configured. Status updates require valid credentials in backend/.env.'
          });
        } else {
          setNotification({
            type: 'error',
            message: result.error || 'Failed to refresh invoice status.'
          });
        }
        return;
      }

      const tracking = result.data;
      const updatedInv = {
        ...inv,
        paypalStatus: tracking.status,
        status: tracking.status,
        lastUpdatedTime: tracking.dates?.lastUpdatedTime || new Date().toISOString(),
        isOverdue: tracking.isOverdue,
        paymentDetails: tracking.payments
      };

      updateStoredInvoice(updatedInv);
      setNotification({
        type: 'success',
        message: `Status updated for ${inv.invoiceNumber}: ${tracking.displayStatus}`
      });
    } catch (err) {
      console.error('Refresh error:', err);
      setNotification({
        type: 'error',
        message: 'Network error communicating with backend.'
      });
    } finally {
      setRefreshingId(null);
    }
  };

  // Batch refresh with sensible rate limiting (30s cooldown)
  const handleBatchRefresh = async () => {
    if (syncedInvoices.length === 0 || batchCooldown > 0) return;

    setIsBatchRefreshing(true);
    setNotification(null);

    try {
      const invoiceIds = syncedInvoices.map((i) => i.paypalInvoiceId).filter(Boolean);
      const res = await fetch(apiUrl('/api/paypal/invoices/batch-status'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds })
      });

      const result = await res.json();

      if (!res.ok) {
        if (result.code === 'PAYPAL_CONFIG_REQUIRED') {
          setNotification({
            type: 'warning',
            message: 'PayPal credentials required in backend/.env to poll live Sandbox statuses.'
          });
        } else {
          setNotification({
            type: 'error',
            message: result.error || 'Batch status refresh failed.'
          });
        }
        return;
      }

      if (result.data?.records) {
        const recordsMap = new Map();
        result.data.records.forEach((rec) => recordsMap.set(rec.invoiceId, rec));

        const updatedList = invoices.map((inv) => {
          if (inv.paypalInvoiceId && recordsMap.has(inv.paypalInvoiceId)) {
            const track = recordsMap.get(inv.paypalInvoiceId);
            return {
              ...inv,
              paypalStatus: track.status,
              status: track.status,
              lastUpdatedTime: track.dates?.lastUpdatedTime || new Date().toISOString(),
              isOverdue: track.isOverdue,
              paymentDetails: track.payments
            };
          }
          return inv;
        });

        setInvoices(updatedList);
        localStorage.setItem('paypilot_invoices', JSON.stringify(updatedList));

        setNotification({
          type: 'success',
          message: `Successfully synchronized ${result.data.records.length} invoice(s) with PayPal Sandbox!`
        });
      }

      // Enforce 30-second cooldown
      setBatchCooldown(30);
    } catch (err) {
      console.error('Batch refresh error:', err);
      setNotification({
        type: 'error',
        message: 'Error communicating with backend.'
      });
    } finally {
      setIsBatchRefreshing(false);
    }
  };

  // Filter invoices
  const filteredInvoices = syncedInvoices.filter((inv) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (inv.customerName || '').toLowerCase().includes(term) ||
      (inv.invoiceNumber || '').toLowerCase().includes(term) ||
      (inv.paypalInvoiceId || '').toLowerCase().includes(term) ||
      (inv.serviceDescription || '').toLowerCase().includes(term);

    const currentStatus = (inv.paypalStatus || inv.status || '').toUpperCase();
    const isOverdue = currentStatus === 'SENT' && inv.dueDate && inv.dueDate < todayStr;

    let matchesFilter = true;
    if (filterStatus === 'PAID') {
      matchesFilter = currentStatus === 'PAID' || currentStatus === 'MARKED_AS_PAID';
    } else if (filterStatus === 'SENT') {
      matchesFilter = currentStatus === 'SENT' && !isOverdue;
    } else if (filterStatus === 'DRAFT') {
      matchesFilter = currentStatus === 'DRAFT' || currentStatus === 'PAYPAL_DRAFT';
    } else if (filterStatus === 'OVERDUE') {
      matchesFilter = isOverdue || currentStatus === 'OVERDUE';
    } else if (filterStatus === 'CANCELLED') {
      matchesFilter = currentStatus === 'CANCELLED';
    }

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 font-sans">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded bg-blue-100 text-brand-600">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
              Real-Time PayPal Sandbox Tracking
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Payment Tracking & Lifecycle
          </h2>
          <p className="text-sm text-slate-500">
            Monitor verified PayPal statuses, payment receipts, balance tracking, and overdue invoices.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={checkGatewayStatus}
            disabled={loadingStatus}
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
            <span>Check Gateway</span>
          </button>

          {syncedInvoices.length > 0 && (
            <button
              onClick={handleBatchRefresh}
              disabled={isBatchRefreshing || batchCooldown > 0}
              className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isBatchRefreshing ? 'animate-spin' : ''}`} />
              <span>
                {batchCooldown > 0
                  ? `Cooldown (${batchCooldown}s)`
                  : isBatchRefreshing
                  ? 'Syncing with PayPal...'
                  : 'Sync All Statuses'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-xs animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : notification.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {notification.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />}
            {notification.type === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />}
            {notification.type === 'error' && <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />}
            <span className="text-xs font-semibold">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Gateway Connection Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-brand-600 flex items-center justify-center shrink-0">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              PayPal REST Invoicing Sandbox Gateway
            </h4>
            <p className="text-xs text-slate-500">
              Endpoint: <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded font-mono">https://api-m.sandbox.paypal.com</code>
            </p>
          </div>
        </div>

        <div>
          {loadingStatus ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-600">
              <RefreshCw className="h-3 w-3 animate-spin" /> Verifying...
            </span>
          ) : paypalStatus?.status === 'CONNECTED' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              Gateway Connected (OAuth 2.0 Live)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              Configuration Required
            </span>
          )}
        </div>
      </div>

      {/* Payment Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Synced */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">PayPal Invoices</span>
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-brand-600 flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{totalSyncedCount}</div>
          <div className="text-xs text-slate-500 mt-2">
            Volume: <span className="font-semibold text-slate-700">${totalSyncedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Verified Paid */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verified Paid</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            ${paidTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium mt-2">
            <ShieldCheck className="h-3 w-3" />
            <span>{paidInvoices.length} settled payments</span>
          </div>
        </div>

        {/* Sent / Awaiting */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Awaiting Payment</span>
            <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            ${sentTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-amber-600 font-medium mt-2">
            <span>{sentInvoices.length} dispatched to client</span>
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overdue Invoices</span>
            <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{overdueInvoices.length}</div>
          <div className="text-xs text-rose-600 font-medium mt-2">
            <span>Past specified due date</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by client, invoice # or PayPal ID..."
            className="w-full rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {['ALL', 'SENT', 'PAID', 'DRAFT', 'OVERDUE', 'CANCELLED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all ${
                filterStatus === status
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status === 'ALL' ? 'All' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Synced Invoices List */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 text-brand-600 mx-auto flex items-center justify-center">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              No Tracked PayPal Invoices
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {searchTerm || filterStatus !== 'ALL'
                ? 'No synced invoices match your current search or filter.'
                : 'Create an invoice with the AI Generator and sync it to PayPal Sandbox from "All Invoices".'}
            </p>
          </div>
          {syncedInvoices.length === 0 && (
            <button
              onClick={() => onNavigate('invoices')}
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <span>View All Invoices</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="p-4">Invoice & PayPal ID</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Due Date</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 text-center">PayPal Status</th>
                  <th className="p-4 text-center">Settlement</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => {
                  const isRefreshing = refreshingId === inv.invoiceNumber;
                  const currentStatus = (inv.paypalStatus || inv.status || 'DRAFT').toUpperCase();
                  const isOverdue = currentStatus === 'SENT' && inv.dueDate && inv.dueDate < todayStr;

                  return (
                    <tr key={inv.invoiceNumber} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4">
                        <div className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</div>
                        <div className="font-mono text-[11px] text-brand-600">{inv.paypalInvoiceId}</div>
                      </td>

                      <td className="p-4">
                        <div className="font-semibold text-slate-900">{inv.customerName}</div>
                        <div className="text-[11px] text-slate-400">{inv.customerEmail}</div>
                      </td>

                      <td className="p-4 text-slate-600">
                        <div>{inv.dueDate || '—'}</div>
                        {isOverdue && (
                          <span className="text-[10px] text-rose-600 font-bold block">Past Due</span>
                        )}
                      </td>

                      <td className="p-4 text-right font-bold text-slate-900">
                        {inv.currency} {Number(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            currentStatus === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isOverdue || currentStatus === 'OVERDUE'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : currentStatus === 'SENT'
                              ? 'bg-blue-50 text-brand-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {isOverdue ? 'OVERDUE' : currentStatus}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        {currentStatus === 'PAID' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Verified
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            Awaiting
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => setSelectedTracking(inv)}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Details</span>
                        </button>

                        <button
                          onClick={() => handleRefreshSingle(inv)}
                          disabled={isRefreshing}
                          title="Refresh status from PayPal"
                          className="text-xs font-semibold p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1 shadow-xs transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                          <span>Refresh</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Detailed Tracking Modal */}
      {selectedTracking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-brand-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Payment Lifecycle Details
                </h3>
              </div>
              <button onClick={() => setSelectedTracking(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice Number:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedTracking.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">PayPal Invoice ID:</span>
                  <span className="font-mono font-semibold text-brand-600">{selectedTracking.paypalInvoiceId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Billed Recipient:</span>
                  <span className="font-semibold text-slate-800">{selectedTracking.customerName} ({selectedTracking.customerEmail})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Billed:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedTracking.currency} {Number(selectedTracking.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Due Date:</span>
                  <span className="font-semibold text-slate-800">{selectedTracking.dueDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">PayPal Live Status:</span>
                  <span className="font-bold uppercase text-brand-600">{selectedTracking.paypalStatus || selectedTracking.status}</span>
                </div>
              </div>

              {/* Verified Payment Information */}
              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/60 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-blue-950">
                  <Lock className="h-3.5 w-3.5 text-brand-600" />
                  <span>PayPal Verification Source</span>
                </div>
                <p className="text-[11px] text-blue-900 leading-relaxed">
                  Authentic status retrieved directly from <span className="font-mono font-semibold">PayPal REST API v2</span>. Transactions are verified and never fabricated.
                </p>
                {selectedTracking.lastUpdatedTime && (
                  <p className="text-[10px] text-blue-700">
                    Last Verified: {new Date(selectedTracking.lastUpdatedTime).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedTracking(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
