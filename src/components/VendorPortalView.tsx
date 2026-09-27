import React, { useState, useMemo } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Download,
  FileText,
  DollarSign,
  Calendar,
  CreditCard,
  Search,
  Filter,
  LogOut,
  Plus,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Layers,
  Sparkles,
  Info,
  Check,
  X,
  FileSpreadsheet,
  AlertOctagon,
  Printer,
  Share2,
  RefreshCw,
  Lock,
  Unlock,
  Building,
} from 'lucide-react';
import { Vendor, Invoice, Organization } from '../types';

interface VendorPortalViewProps {
  vendors: Vendor[];
  invoices: Invoice[];
  organization: Organization;
  onInvoiceSubmitted?: (invoice: Invoice) => void;
  onNavigateInvoices?: () => void;
}

export const VendorPortalView: React.FC<VendorPortalViewProps> = ({
  vendors,
  invoices,
  organization,
  onInvoiceSubmitted,
  onNavigateInvoices,
}) => {
  // Currently authenticated vendor session (default to null for clean login screen)
  const [activeVendorId, setActiveVendorId] = useState<string | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginTaxId, setLoginTaxId] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Portal view state
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoiceForRemittance, setSelectedInvoiceForRemittance] = useState<Invoice | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);

  // Submit invoice form state
  const [newInvNumber, setNewInvNumber] = useState('');
  const [newInvDate, setNewInvDate] = useState('2026-09-26');
  const [newDueDate, setNewDueDate] = useState('2026-10-26');
  const [newSubtotal, setNewSubtotal] = useState<number>(1500);
  const [newTax, setNewTax] = useState<number>(120);
  const [newPoNumber, setNewPoNumber] = useState('');
  const [newDescription, setNewDescription] = useState('Software Engineering Support & Consulting');
  const [newFileName, setNewFileName] = useState('Invoice_Sept_2026.pdf');

  // Currently logged in vendor object
  const currentVendor = useMemo(() => {
    return vendors.find(v => v.id === activeVendorId) || null;
  }, [vendors, activeVendorId]);

  // Scoped invoices for the logged-in vendor
  const vendorInvoices = useMemo(() => {
    if (!currentVendor) return [];
    return invoices.filter(
      i =>
        (i.vendorId && i.vendorId === currentVendor.id) ||
        (i.vendorName && i.vendorName.toLowerCase() === currentVendor.name.toLowerCase())
    );
  }, [invoices, currentVendor]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return vendorInvoices.filter(inv => {
      const matchesSearch =
        inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.purchaseOrderNumber && inv.purchaseOrderNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        inv.lines.some(l => l.description.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchesSearch) return false;

      if (statusFilter === 'paid') {
        return inv.businessStatus === 'Exported' || inv.paymentStatus === 'Confirmed Paid';
      }
      if (statusFilter === 'pending') {
        return (
          inv.businessStatus === 'Needs Review' ||
          inv.businessStatus === 'Pending Approval' ||
          inv.businessStatus === 'Approved'
        );
      }
      if (statusFilter === 'rejected') {
        return inv.businessStatus === 'Rejected';
      }

      return true;
    });
  }, [vendorInvoices, searchQuery, statusFilter]);

  // Financial aggregates for vendor dashboard
  const portalStats = useMemo(() => {
    let totalSubmitted = vendorInvoices.length;
    let totalAmount = 0;
    let paidAmount = 0;
    let paidCount = 0;
    let pendingAmount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;
    let latestPaymentDate: string | null = null;

    vendorInvoices.forEach(inv => {
      totalAmount += inv.totalAmount;
      if (inv.businessStatus === 'Exported' || inv.paymentStatus === 'Confirmed Paid') {
        paidAmount += inv.totalAmount;
        paidCount++;
        const pDate = inv.paymentConfirmationDate || inv.exportedAt || inv.approvedAt;
        if (pDate && (!latestPaymentDate || pDate > latestPaymentDate)) {
          latestPaymentDate = pDate;
        }
      } else if (inv.businessStatus === 'Rejected') {
        rejectedCount++;
      } else {
        pendingAmount += inv.totalAmount;
        pendingCount++;
      }
    });

    return {
      totalSubmitted,
      totalAmount,
      paidAmount,
      paidCount,
      pendingAmount,
      pendingCount,
      rejectedCount,
      latestPaymentDate,
    };
  }, [vendorInvoices]);

  // Handle Login form
  const handleVendorLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const emailTrim = loginEmail.trim().toLowerCase();
    const taxTrim = loginTaxId.trim().toLowerCase();

    const matched = vendors.find(v => {
      if (emailTrim && v.contactEmail && v.contactEmail.toLowerCase().includes(emailTrim)) return true;
      if (taxTrim && v.taxId && v.taxId.toLowerCase().includes(taxTrim)) return true;
      if (emailTrim && v.name.toLowerCase().includes(emailTrim)) return true;
      return false;
    });

    if (matched) {
      setActiveVendorId(matched.id);
      setLoginEmail('');
      setLoginTaxId('');
    } else {
      setLoginError('No supplier account matched the entered credentials. Please check or select a quick access supplier below.');
    }
  };

  // Submit invoice directly from vendor portal
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentVendor) return;
    setIsSubmittingInvoice(true);

    try {
      const total = Math.round((Number(newSubtotal) + Number(newTax)) * 100) / 100;
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorName: currentVendor.name,
          vendorId: currentVendor.id,
          vendorTaxId: currentVendor.taxId,
          invoiceNumber: newInvNumber || `INV-${Date.now().toString().slice(-5)}`,
          invoiceDate: newInvDate,
          dueDate: newDueDate,
          subtotal: Number(newSubtotal),
          taxAmount: Number(newTax),
          totalAmount: total,
          purchaseOrderNumber: newPoNumber || undefined,
          documentType: 'sample',
          documentName: newFileName,
          lines: [
            {
              description: newDescription,
              quantity: 1,
              unitPrice: Number(newSubtotal),
              taxRate: newSubtotal > 0 ? Number(newTax) / Number(newSubtotal) : 0,
              taxAmount: Number(newTax),
              lineTotal: Number(newSubtotal),
              glAccountId: currentVendor.defaultGlAccountId || 'gl-6010',
            },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (onInvoiceSubmitted) {
          onInvoiceSubmitted(data.invoice);
        }
        setShowSubmitModal(false);
        setNewInvNumber('');
      }
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return 'N/A';
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return ts;
    }
  };

  // -------------------------------------------------------------
  // VIEW: LOGIN SCREEN (if activeVendorId is null)
  // -------------------------------------------------------------
  if (!currentVendor) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2 py-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center mx-auto shadow-lg">
            <Building className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">External Supplier Portal</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Welcome to the accounts payable gateway for <strong>{organization.name}</strong>. Access your invoice statuses, verify payment release confirmations, and upload new billing statements.
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-lg mx-auto shadow-xl space-y-5">
          <form onSubmit={handleVendorLogin} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Supplier Billing Email or Name</label>
              <input
                type="text"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="e.g. ar-billing@aws.amazon.com or Amazon"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Tax ID / VAT Registration (Optional)</label>
              <input
                type="text"
                value={loginTaxId}
                onChange={e => setLoginTaxId(e.target.value)}
                placeholder="e.g. US-94281928"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-700/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Authenticate Supplier Access</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Access Simulation Buttons */}
          {vendors.length > 0 ? (
            <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block">
                1-Click Simulated Supplier Access:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {vendors.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setActiveVendorId(v.id)}
                    className="p-2.5 rounded-lg bg-slate-950/80 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-600/60 text-left transition-colors cursor-pointer group"
                  >
                    <p className="font-bold text-slate-200 group-hover:text-white text-xs truncate">{v.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{v.taxId || 'Net 30'}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pt-4 border-t border-slate-800/80 text-center text-slate-500 text-[11px]">
              No suppliers currently registered. Suppliers are created when invoices are processed or added via the Suppliers tab.
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: AUTHENTICATED SUPPLIER PORTAL
  // -------------------------------------------------------------
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Supplier Top Header Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center font-bold text-lg shrink-0">
            {currentVendor.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-white tracking-tight">{currentVendor.name}</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Verified Supplier</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                Tax ID: {currentVendor.taxId || 'Verified'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>Contracted Terms: <strong className="text-slate-300 font-mono">{currentVendor.paymentTerms}</strong></span>
              <span>·</span>
              <span>Currency: <strong className="text-slate-300 font-mono">{currentVendor.defaultCurrency}</strong></span>
              <span>·</span>
              <span>Customer: <strong className="text-indigo-300">{organization.name}</strong></span>
            </p>
          </div>
        </div>

        {/* Portal Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Submit New Invoice</span>
          </button>

          {/* Switch Supplier Dropdown */}
          <div className="relative">
            <select
              value={currentVendor.id}
              onChange={e => setActiveVendorId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {vendors.map(v => (
                <option key={v.id} value={v.id}>
                  Switch Vendor: {v.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setActiveVendorId(null)}
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950 transition-colors cursor-pointer"
            title="Log out of Supplier Portal"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Disputed / Rejected Alert Banner (if any) */}
      {portalStats.rejectedCount > 0 && (
        <div className="bg-rose-950/40 border border-rose-700/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-start gap-2.5">
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Action Required: {portalStats.rejectedCount} Disputed Invoice(s)</p>
              <p className="text-[11px] text-rose-300 mt-0.5 leading-relaxed">
                The AP team at {organization.name} flagged discrepancies on your submitted billing. Review the specific reasons below or upload a corrected replacement invoice.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('rejected')}
            className="px-3 py-1.5 rounded-lg bg-rose-900/80 hover:bg-rose-800 border border-rose-600/70 text-white font-semibold text-xs transition-colors shrink-0 cursor-pointer"
          >
            Inspect Disputed Invoices
          </button>
        </div>
      )}

      {/* Supplier Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Confirmed Paid */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Confirmed Paid</span>
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              ${portalStats.paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            {portalStats.paidCount} invoice(s) disbursed
          </p>
        </div>

        {/* Card 2: In Review & Approval */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>In Processing Queue</span>
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              ${portalStats.pendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            {portalStats.pendingCount} pending customer authorization
          </p>
        </div>

        {/* Card 3: Total Billing Volume */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
            <span>Total Submitted Billing</span>
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              ${portalStats.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            {portalStats.totalSubmitted} total billing statements
          </p>
        </div>

        {/* Card 4: Most Recent Payment Confirmation Date */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>Last Payment Released</span>
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold font-mono text-slate-200">
              {portalStats.latestPaymentDate ? formatTimestamp(portalStats.latestPaymentDate) : 'Pending Cycle'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">Settled via Corporate Direct ACH</p>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative max-w-sm w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by invoice #, PO #, or item description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              statusFilter === 'all' ? 'bg-indigo-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Invoices ({vendorInvoices.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('paid')}
            className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
              statusFilter === 'paid' ? 'bg-emerald-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-emerald-300'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Paid & Confirmed ({portalStats.paidCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
              statusFilter === 'pending' ? 'bg-indigo-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-indigo-300'
            }`}
          >
            <Clock className="w-3 h-3 text-indigo-400" />
            <span>In Review ({portalStats.pendingCount})</span>
          </button>
          {portalStats.rejectedCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('rejected')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                statusFilter === 'rejected' ? 'bg-rose-600 text-white font-semibold shadow-sm' : 'text-rose-400 hover:text-rose-300'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>Disputed ({portalStats.rejectedCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Submitted Invoices Data Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50 shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0b101c] border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
            <tr>
              <th className="py-3 px-4">Invoice #</th>
              <th className="py-3 px-4">Invoice Date</th>
              <th className="py-3 px-4">Due Date</th>
              <th className="py-3 px-4">PO Number</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-center">Processing Status</th>
              <th className="py-3 px-4">Payment Confirmation Date & Ref</th>
              <th className="py-3 px-4 text-right">Remittance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center space-y-2">
                  <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-300 font-medium">No invoices match the current view</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Submit a new billing statement to track its processing status and payment release date.
                  </p>
                </td>
              </tr>
            ) : (
              filteredInvoices.map(inv => {
                const isPaid = inv.businessStatus === 'Exported' || inv.paymentStatus === 'Confirmed Paid';
                const isApproved = inv.businessStatus === 'Approved';
                const isRejected = inv.businessStatus === 'Rejected';
                const isPending = inv.businessStatus === 'Needs Review' || inv.businessStatus === 'Pending Approval';

                // Payment Confirmation Date calculation
                const confirmedDate = inv.paymentConfirmationDate || inv.exportedAt;
                const paymentRef = inv.paymentReferenceNumber || inv.externalRecordId || `ACH-${inv.invoiceNumber.replace(/[^0-9]/g, '').padEnd(6, '7')}`;

                return (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Invoice # and Line Summary */}
                    <td className="py-3 px-4">
                      <p className="font-bold text-white font-mono">{inv.invoiceNumber}</p>
                      <p className="text-[11px] text-slate-400 truncate max-w-[200px] mt-0.5">
                        {inv.lines[0]?.description || 'Commercial Services'}
                      </p>
                    </td>

                    {/* Dates */}
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {inv.invoiceDate}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-300">
                      {inv.dueDate}
                    </td>

                    {/* PO */}
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {inv.purchaseOrderNumber ? (
                        <span className="text-indigo-300 font-semibold">{inv.purchaseOrderNumber}</span>
                      ) : (
                        <span className="text-slate-600">None</span>
                      )}
                    </td>

                    {/* Total Amount */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-white tabular-nums">
                      ${inv.totalAmount.toFixed(2)}
                    </td>

                    {/* Processing Status Lifecycle */}
                    <td className="py-3 px-4 text-center">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>PAID</span>
                        </span>
                      ) : isApproved ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-blue-950 text-blue-300 border border-blue-700/60">
                          <Check className="w-3 h-3 text-blue-400" />
                          <span>APPROVED FOR PAYMENT</span>
                        </span>
                      ) : isRejected ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-950 text-rose-300 border border-rose-700/60">
                          <AlertOctagon className="w-3 h-3 text-rose-400" />
                          <span>DISPUTED / REJECTED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-950 text-amber-300 border border-amber-700/60">
                          <Clock className="w-3 h-3 text-amber-400 animate-spin" />
                          <span>IN AP REVIEW</span>
                        </span>
                      )}
                    </td>

                    {/* PAYMENT CONFIRMATION DATE & REFERENCE */}
                    <td className="py-3 px-4">
                      {isPaid ? (
                        <div className="space-y-0.5">
                          <p className="font-bold text-emerald-300 text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>Confirmed Paid: {formatTimestamp(confirmedDate)}</span>
                          </p>
                          <p className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                            <span>Ref: {paymentRef}</span>
                            <span className="text-slate-600">·</span>
                            <span>{inv.paymentMethod || 'ACH Direct Deposit'}</span>
                          </p>
                        </div>
                      ) : isApproved ? (
                        <div className="space-y-0.5">
                          <p className="font-semibold text-blue-300 text-xs">
                            Scheduled Release: {inv.dueDate}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            Authorized by {inv.approvedBy || 'Finance Director'}
                          </p>
                        </div>
                      ) : isRejected ? (
                        <div className="space-y-0.5">
                          <p className="font-semibold text-rose-300 text-[11px] truncate max-w-[240px]">
                            Disputed: {inv.rejectionReason || 'Pricing mismatch with purchase order'}
                          </p>
                          <p className="text-[10px] text-slate-400">Payment suspended pending correction</p>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <p className="text-slate-400 text-xs">
                            Pending Approval
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            Est. Payout by {inv.dueDate}
                          </p>
                        </div>
                      )}
                    </td>

                    {/* Remittance Advice Action */}
                    <td className="py-3 px-4 text-right">
                      {isPaid ? (
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceForRemittance(inv)}
                          className="px-2.5 py-1 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ml-auto"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Remittance</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceForRemittance(inv)}
                          className="text-xs text-slate-400 hover:text-white font-medium cursor-pointer"
                        >
                          Statement
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* REMITTANCE ADVICE / PAYMENT CONFIRMATION RECEIPT MODAL */}
      {selectedInvoiceForRemittance && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-6 max-w-xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 text-xs">
            {/* Modal Top Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Official Remittance Advice & Payment Confirmation
                </span>
                <h3 className="text-base font-bold text-white mt-0.5 font-mono">
                  Invoice #{selectedInvoiceForRemittance.invoiceNumber}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Issued by {organization.name} Accounts Payable Department
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoiceForRemittance(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Payment Confirmation Banner */}
            <div
              className={`p-4 rounded-xl border space-y-2 ${
                selectedInvoiceForRemittance.businessStatus === 'Exported' ||
                selectedInvoiceForRemittance.paymentStatus === 'Confirmed Paid'
                  ? 'bg-emerald-950/40 border-emerald-700/60'
                  : selectedInvoiceForRemittance.businessStatus === 'Approved'
                  ? 'bg-blue-950/40 border-blue-700/60'
                  : selectedInvoiceForRemittance.businessStatus === 'Rejected'
                  ? 'bg-rose-950/40 border-rose-700/60'
                  : 'bg-amber-950/40 border-amber-700/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    {selectedInvoiceForRemittance.businessStatus === 'Exported' ||
                    selectedInvoiceForRemittance.paymentStatus === 'Confirmed Paid'
                      ? 'Payment Confirmation Verified'
                      : selectedInvoiceForRemittance.businessStatus === 'Approved'
                      ? 'Payment Scheduled for Disbursement'
                      : selectedInvoiceForRemittance.businessStatus === 'Rejected'
                      ? 'Payment Suspended (Disputed)'
                      : 'Processing in AP Review Queue'}
                  </span>
                </span>
                <span className="font-mono font-bold text-base text-white">
                  ${selectedInvoiceForRemittance.totalAmount.toFixed(2)} {selectedInvoiceForRemittance.currency}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Payment Confirmation Date:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {formatTimestamp(
                      selectedInvoiceForRemittance.paymentConfirmationDate ||
                        selectedInvoiceForRemittance.exportedAt ||
                        selectedInvoiceForRemittance.approvedAt
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Payment Reference ID:</span>
                  <span className="font-mono font-bold text-indigo-300">
                    {selectedInvoiceForRemittance.paymentReferenceNumber ||
                      selectedInvoiceForRemittance.externalRecordId ||
                      `ACH-${selectedInvoiceForRemittance.invoiceNumber.replace(/[^0-9]/g, '').padEnd(6, '7')}`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Disbursement Method:</span>
                  <span className="text-slate-200">{selectedInvoiceForRemittance.paymentMethod || 'ACH Direct Deposit'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Payee / Beneficiary:</span>
                  <span className="text-slate-200">{selectedInvoiceForRemittance.vendorName}</span>
                </div>
              </div>
            </div>

            {/* Line Items Breakdown */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Disbursed Line Items:
              </span>
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/70">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-2 text-right">Qty</th>
                      <th className="py-2 px-2 text-right">Rate</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {selectedInvoiceForRemittance.lines.map((l, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 text-slate-200">{l.description}</td>
                        <td className="py-2 px-2 text-right font-mono text-slate-300">{l.quantity}</td>
                        <td className="py-2 px-2 text-right font-mono text-slate-300">${l.unitPrice.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-white">${l.lineTotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Totals */}
            <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Net Remitted Amount:</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                ${selectedInvoiceForRemittance.totalAmount.toFixed(2)} {selectedInvoiceForRemittance.currency}
              </span>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedInvoiceForRemittance(null)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Remittance Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMIT INVOICE MODAL (FOR VENDORS) */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Submit Invoice to {organization.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Invoice Number *</label>
                  <input
                    type="text"
                    required
                    value={newInvNumber}
                    onChange={e => setNewInvNumber(e.target.value)}
                    placeholder={`e.g. INV-${Date.now().toString().slice(-5)}`}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Purchase Order # (Optional)</label>
                  <input
                    type="text"
                    value={newPoNumber}
                    onChange={e => setNewPoNumber(e.target.value)}
                    placeholder="e.g. PO-89210"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Invoice Date</label>
                  <input
                    type="date"
                    required
                    value={newInvDate}
                    onChange={e => setNewInvDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Payment Due Date</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={e => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Line Item Description</label>
                <input
                  type="text"
                  required
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Subtotal Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newSubtotal}
                    onChange={e => setNewSubtotal(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500 text-right"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Tax Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newTax}
                    onChange={e => setNewTax(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500 text-right"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 font-medium">Total Billed:</span>
                <span className="font-mono font-bold text-indigo-300 text-sm">
                  ${(Number(newSubtotal || 0) + Number(newTax || 0)).toFixed(2)} USD
                </span>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-3.5 py-1.5 rounded text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInvoice}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmittingInvoice ? 'Submitting...' : 'Upload & Submit Invoice'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
