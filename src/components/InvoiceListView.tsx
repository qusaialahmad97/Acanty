import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  DownloadCloud,
  CheckSquare,
  Square,
  ArrowUpDown,
  MoreVertical,
  Send,
  Eye,
  Check,
  Link2,
  RefreshCw,
  Ban,
  ShieldAlert,
  X,
  Copy,
  ExternalLink,
  HelpCircle,
  Layers,
  DollarSign,
} from 'lucide-react';
import { Invoice, AccountingConnection, User } from '../types';

interface InvoiceListViewProps {
  invoices: Invoice[];
  initialStatusFilter?: string;
  onOpenReview: (invoice: Invoice) => void;
  onOpenUpload: () => void;
  onBatchExport: (invoiceIds: string[], format: 'CSV' | 'XLSX') => Promise<void>;
  onBulkApprove?: (invoiceIds: string[]) => Promise<void>;
  onBulkReject?: (invoiceIds: string[], reason: string) => Promise<void>;
  currentUser?: User;
  searchQuery: string;
  connections?: AccountingConnection[];
  onSyncSingleBill?: (invoiceId: string) => Promise<void>;
}

interface DuplicateScanResult {
  isDuplicate: boolean;
  matchType: 'EXACT_VENDOR_AND_NUMBER' | 'SAME_VENDOR_DATE_AMOUNT' | 'FLAGGED';
  matchingInvoices: Invoice[];
  duplicateReason: string;
  originalInvoice?: Invoice;
}

export const InvoiceListView: React.FC<InvoiceListViewProps> = ({
  invoices,
  initialStatusFilter,
  onOpenReview,
  onOpenUpload,
  onBatchExport,
  onBulkApprove,
  onBulkReject,
  currentUser,
  searchQuery,
  connections = [],
  onSyncSingleBill,
}) => {
  const [activeTab, setActiveTab] = useState<string>(initialStatusFilter || 'all');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [isBulkRejecting, setIsBulkRejecting] = useState(false);
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('Duplicate invoice - prevents double payment');
  const [syncingBillId, setSyncingBillId] = useState<string | null>(null);

  // Duplicate Inspection Modal
  const [inspectingDuplicate, setInspectingDuplicate] = useState<{
    current: Invoice;
    others: Invoice[];
    reason: string;
  } | null>(null);

  const activeConn = connections.find(c => c.status === 'connected');

  // Normalize string for fuzzy/exact matching
  const cleanStr = (s?: string) => (s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  // Dynamic Scanner: Scan for invoices with the same vendor and invoice number
  const duplicateScanResults = useMemo(() => {
    // 1. Map of (cleanVendor + ':::' + cleanInvoiceNumber) -> Invoice[]
    const vendorNumberMap = new Map<string, Invoice[]>();

    invoices.forEach(inv => {
      const vKey = cleanStr(inv.vendorName);
      const nKey = cleanStr(inv.invoiceNumber);
      if (vKey && nKey) {
        const key = `${vKey}:::${nKey}`;
        const list = vendorNumberMap.get(key) || [];
        list.push(inv);
        vendorNumberMap.set(key, list);
      }
    });

    const resultMap = new Map<string, DuplicateScanResult>();

    invoices.forEach(inv => {
      const vKey = cleanStr(inv.vendorName);
      const nKey = cleanStr(inv.invoiceNumber);
      const key = `${vKey}:::${nKey}`;
      const matches = (vendorNumberMap.get(key) || []).filter(m => m.id !== inv.id);

      if (matches.length > 0) {
        const otherRefs = matches.map(m => `#${m.invoiceNumber} (${m.businessStatus})`).join(', ');
        resultMap.set(inv.id, {
          isDuplicate: true,
          matchType: 'EXACT_VENDOR_AND_NUMBER',
          matchingInvoices: matches,
          duplicateReason: `Duplicate invoice detected: Same vendor '${inv.vendorName}' & invoice #${inv.invoiceNumber} on ${otherRefs}`,
          originalInvoice: matches[0],
        });
      } else if (
        inv.isDuplicate ||
        inv.validationIssues?.some(v => v.rule === 'duplicate_check' && v.status === 'WARNING')
      ) {
        const orig = invoices.find(i => i.id === inv.duplicateOfId);
        resultMap.set(inv.id, {
          isDuplicate: true,
          matchType: 'SAME_VENDOR_DATE_AMOUNT',
          matchingInvoices: orig ? [orig] : [],
          duplicateReason: inv.duplicateWarning || 'Duplicate bill detected for vendor and amount',
          originalInvoice: orig,
        });
      }
    });

    return resultMap;
  }, [invoices]);

  // Unique vendors for filter
  const uniqueVendors = Array.from(new Set(invoices.map(i => i.vendorName))).sort();

  // Duplicate invoices count
  const duplicateCount = invoices.filter(inv => duplicateScanResults.get(inv.id)?.isDuplicate).length;

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    const isDup = Boolean(duplicateScanResults.get(inv.id)?.isDuplicate);

    // Tab filter
    if (activeTab === 'duplicates') {
      if (!isDup) return false;
    } else if (activeTab !== 'all' && inv.businessStatus !== activeTab) {
      return false;
    }
    // Vendor filter
    if (vendorFilter !== 'all' && inv.vendorName !== vendorFilter) {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = inv.invoiceNumber.toLowerCase().includes(q);
      const matchVendor = inv.vendorName.toLowerCase().includes(q);
      const matchPo = inv.purchaseOrderNumber?.toLowerCase().includes(q);
      if (!matchNumber && !matchVendor && !matchPo) return false;
    }
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedInvoiceIds.length === filteredInvoices.length) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(filteredInvoices.map(i => i.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedInvoiceIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectedInvoices = invoices.filter(i => selectedInvoiceIds.includes(i.id));
  const selectedTotalAmount = selectedInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
  const selectedDuplicateCount = selectedInvoices.filter(i => duplicateScanResults.get(i.id)?.isDuplicate).length;

  // Bulk Actions
  const handleExportSelected = async (format: 'CSV' | 'XLSX') => {
    if (selectedInvoiceIds.length === 0) return;
    setIsExporting(true);
    try {
      await onBatchExport(selectedInvoiceIds, format);
      setSelectedInvoiceIds([]);
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedInvoiceIds.length === 0 || !onBulkApprove) return;

    if (selectedDuplicateCount > 0) {
      const confirmed = window.confirm(
        `⚠️ Warning: ${selectedDuplicateCount} of the selected invoices have DUPLICATE warnings.\n\nApproving duplicates may trigger double-payments to suppliers. Are you sure you wish to proceed?`
      );
      if (!confirmed) return;
    }

    setIsBulkApproving(true);
    try {
      await onBulkApprove(selectedInvoiceIds);
      setSelectedInvoiceIds([]);
    } finally {
      setIsBulkApproving(false);
    }
  };

  const handleConfirmBulkReject = async () => {
    if (selectedInvoiceIds.length === 0 || !onBulkReject) return;
    setIsBulkRejecting(true);
    try {
      await onBulkReject(selectedInvoiceIds, bulkRejectReason);
      setShowBulkRejectModal(false);
      setSelectedInvoiceIds([]);
    } finally {
      setIsBulkRejecting(false);
    }
  };

  const tabs = [
    { id: 'all', label: 'All Invoices', count: invoices.length },
    { id: 'Needs Review', label: 'Needs Review', count: invoices.filter(i => i.businessStatus === 'Needs Review').length },
    { id: 'Pending Approval', label: 'Pending Approval', count: invoices.filter(i => i.businessStatus === 'Pending Approval').length },
    { id: 'Approved', label: 'Approved', count: invoices.filter(i => i.businessStatus === 'Approved').length },
    { id: 'Exported', label: 'Exported', count: invoices.filter(i => i.businessStatus === 'Exported').length },
    { id: 'Rejected', label: 'Rejected', count: invoices.filter(i => i.businessStatus === 'Rejected').length },
    ...(duplicateCount > 0 ? [{ id: 'duplicates', label: 'Duplicates Detected', count: duplicateCount, alert: true }] : []),
  ];

  const canApprove = currentUser ? currentUser.role === 'Admin' || currentUser.role === 'Approver' : true;

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Bar with Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        {/* Segmented Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto bg-slate-900/80 p-1 rounded-lg border border-slate-800">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === tab.id
                  ? tab.alert
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-indigo-600 text-white shadow-sm'
                  : tab.alert
                  ? 'text-amber-300 hover:bg-amber-950/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab.alert && <AlertTriangle className="w-3.5 h-3.5 text-amber-300 animate-pulse" />}
              <span>{tab.label}</span>
              <span
                className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                  activeTab === tab.id
                    ? 'bg-black/30 text-white'
                    : tab.alert
                    ? 'bg-amber-950 text-amber-300 border border-amber-600/50'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Vendor Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={vendorFilter}
            onChange={e => setVendorFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Vendors ({uniqueVendors.length})</option>
            {uniqueVendors.map(v => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Duplicate Invoices System Warning Banner */}
      {duplicateCount > 0 && (
        <div className="bg-amber-950/40 border border-amber-500/50 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200 shadow-sm">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="p-1.5 bg-amber-500/20 rounded-lg border border-amber-500/30 text-amber-400 shrink-0">
              <ShieldAlert className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <span className="font-semibold text-white">Double-Payment Protection Warning:</span>{' '}
              <span>
                Scanner identified <strong>{duplicateCount} invoice(s)</strong> with matching vendor and invoice number. Review the highlighted rows to prevent duplicate vendor disbursements.
              </span>
            </div>
          </div>
          <button
            onClick={() => setActiveTab(activeTab === 'duplicates' ? 'all' : 'duplicates')}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-semibold text-[11px] shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          >
            <AlertTriangle className="w-3 h-3" />
            <span>{activeTab === 'duplicates' ? 'Show All Invoices' : `Filter ${duplicateCount} Duplicates`}</span>
          </button>
        </div>
      )}

      {/* Bulk Actions Toolbar */}
      {selectedInvoiceIds.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-indigo-700/70 rounded-xl p-3 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-white">
              <span className="p-1 rounded bg-indigo-600 text-white">
                <CheckSquare className="w-4 h-4" />
              </span>
              <span className="font-bold text-sm">{selectedInvoiceIds.length} invoice(s) selected</span>
              <span className="text-slate-400">·</span>
              <span className="font-mono text-indigo-300 font-semibold text-sm">
                ${selectedTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {selectedDuplicateCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-600/70 text-amber-300 font-semibold text-[11px]">
                <AlertTriangle className="w-3 h-3 text-amber-400 animate-pulse" />
                <span>{selectedDuplicateCount} Duplicate Risk</span>
              </span>
            )}

            <button
              onClick={() => setSelectedInvoiceIds([])}
              className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
            >
              Deselect All
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Bulk Approve */}
            {onBulkApprove && (
              <button
                onClick={handleBulkApprove}
                disabled={isBulkApproving || !canApprove}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                  canApprove
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
                title={canApprove ? 'Approve all selected invoices' : 'Approver or Admin role required'}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isBulkApproving ? 'Approving...' : `Approve (${selectedInvoiceIds.length})`}</span>
              </button>
            )}

            {/* Bulk Reject */}
            {onBulkReject && (
              <button
                onClick={() => setShowBulkRejectModal(true)}
                disabled={isBulkRejecting}
                className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Ban className="w-3.5 h-3.5 text-rose-400" />
                <span>Reject ({selectedInvoiceIds.length})</span>
              </button>
            )}

            <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />

            {/* Bulk Export CSV */}
            <button
              onClick={() => handleExportSelected('CSV')}
              disabled={isExporting}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <DownloadCloud className="w-3.5 h-3.5 text-slate-300" />
              <span>Export CSV</span>
            </button>

            {/* Bulk Export Excel */}
            <button
              onClick={() => handleExportSelected('XLSX')}
              disabled={isExporting}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>
      )}

      {/* Invoices High-Density Data Grid */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50 shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0b101c] border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
            <tr>
              <th className="py-3 px-3 w-10 text-center">
                <button
                  onClick={toggleSelectAll}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Select / Deselect all"
                >
                  {selectedInvoiceIds.length > 0 && selectedInvoiceIds.length === filteredInvoices.length ? (
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                </button>
              </th>
              <th className="py-3 px-3">Invoice # & Duplicate Flag</th>
              <th className="py-3 px-3">Vendor / Supplier</th>
              <th className="py-3 px-3">Date / Due</th>
              <th className="py-3 px-3 text-center">Lines</th>
              <th className="py-3 px-3 text-right">Amount</th>
              <th className="py-3 px-3 text-center">Validation</th>
              <th className="py-3 px-3 text-center">Status</th>
              <th className="py-3 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                  <p className="text-xs">No invoices found matching current filter.</p>
                  <button
                    onClick={onOpenUpload}
                    className="mt-2 text-indigo-400 hover:text-indigo-300 font-medium inline-block cursor-pointer"
                  >
                    Upload an invoice now
                  </button>
                </td>
              </tr>
            ) : (
              filteredInvoices.map(inv => {
                const isSelected = selectedInvoiceIds.includes(inv.id);
                const dupMatch = duplicateScanResults.get(inv.id);
                const isDup = Boolean(dupMatch?.isDuplicate);
                const hasBlockingError = inv.validationIssues?.some(v => v.status === 'ERROR');
                const hasWarning = inv.validationIssues?.some(v => v.status === 'WARNING');

                return (
                  <tr
                    key={inv.id}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-indigo-950/30'
                        : isDup
                        ? 'bg-amber-950/20 border-l-4 border-l-amber-500 hover:bg-amber-950/30'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => toggleSelectOne(inv.id)}
                        className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>

                    {/* Invoice Number & Duplicate Warning Badge */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => onOpenReview(inv)}
                          className="font-mono font-semibold text-white hover:text-indigo-300 transition-colors cursor-pointer text-left"
                        >
                          #{inv.invoiceNumber}
                        </button>

                        {/* Duplicate Invoice Warning Badge */}
                        {isDup && (
                          <button
                            type="button"
                            onClick={() =>
                              setInspectingDuplicate({
                                current: inv,
                                others: dupMatch?.matchingInvoices || [],
                                reason: dupMatch?.duplicateReason || 'Duplicate invoice detected with matching vendor and number',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-500/80 text-amber-300 text-[10px] font-bold tracking-tight shadow-md hover:bg-amber-900 transition-colors cursor-pointer"
                            title="⚠️ Double-Payment Risk: Duplicate invoice detected! Click to compare."
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 animate-pulse" />
                            <span>Duplicate Invoice</span>
                          </button>
                        )}
                      </div>

                      {inv.purchaseOrderNumber && (
                        <p className="text-[10px] text-slate-500 font-mono">PO: {inv.purchaseOrderNumber}</p>
                      )}

                      {/* Double-Payment Warning Subtext */}
                      {isDup && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-400/90 font-mono mt-0.5">
                          <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />
                          <span
                            className="truncate max-w-[230px]"
                            title={dupMatch?.duplicateReason}
                          >
                            {dupMatch?.matchingInvoices?.length
                              ? `Double-payment risk: matches #${dupMatch.matchingInvoices.map(m => m.invoiceNumber).join(', #')}`
                              : 'Double-payment risk: identical vendor & amount'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Vendor */}
                    <td className="py-2.5 px-3">
                      <p className="font-medium text-slate-200 truncate max-w-[200px]">{inv.vendorName}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{inv.vendorTaxId || 'Unregistered Tax ID'}</p>
                    </td>

                    {/* Dates */}
                    <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                      <div>{inv.invoiceDate}</div>
                      <div className="text-slate-500">Due: {inv.dueDate}</div>
                    </td>

                    {/* Line Items */}
                    <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                      {inv.lines?.length || 1}
                    </td>

                    {/* Amount */}
                    <td className="py-2.5 px-3 text-right">
                      <p className={`font-bold font-mono tabular-nums ${isDup ? 'text-amber-300' : 'text-white'}`}>
                        ${inv.totalAmount.toFixed(2)}
                      </p>
                      <p className="text-[10px] font-mono text-slate-500">{inv.currency}</p>
                    </td>

                    {/* Validation Column */}
                    <td className="py-2.5 px-3 text-center">
                      {isDup ? (
                        <button
                          type="button"
                          onClick={() =>
                            setInspectingDuplicate({
                              current: inv,
                              others: dupMatch?.matchingInvoices || [],
                              reason: dupMatch?.duplicateReason || 'Duplicate invoice warning',
                            })
                          }
                          className="inline-flex items-center gap-1 text-[11px] text-amber-300 font-bold px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-500/80 shadow-sm hover:bg-amber-900 cursor-pointer"
                          title="Double-payment risk: identical vendor & invoice number detected"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Duplicate Risk</span>
                        </button>
                      ) : hasBlockingError ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-rose-400" title="Blocking arithmetic discrepancy">
                          <AlertOctagon className="w-3.5 h-3.5" />
                          <span>Error</span>
                        </span>
                      ) : hasWarning ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-400" title="Validation warning">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Warning</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Passed</span>
                        </span>
                      )}
                    </td>

                    {/* Business Status */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          inv.businessStatus === 'Needs Review'
                            ? 'bg-amber-950/50 text-amber-300 border border-amber-800/50'
                            : inv.businessStatus === 'Pending Approval'
                            ? 'bg-blue-950/50 text-blue-300 border border-blue-800/50'
                            : inv.businessStatus === 'Approved'
                            ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/50'
                            : inv.businessStatus === 'Exported'
                            ? 'bg-indigo-950/50 text-indigo-300 border border-indigo-800/50'
                            : 'bg-rose-950/50 text-rose-300 border border-rose-800/50'
                        }`}
                      >
                        {inv.externalRecordId ? 'Synced (Bill)' : inv.businessStatus}
                      </span>
                      {inv.externalRecordId && (
                        <span className="block font-mono text-[9px] text-indigo-300/80 mt-0.5" title={inv.externalRecordId}>
                          {inv.externalRecordId}
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {inv.businessStatus === 'Approved' && activeConn && onSyncSingleBill && (
                          <button
                            onClick={async () => {
                              setSyncingBillId(inv.id);
                              try {
                                await onSyncSingleBill(inv.id);
                              } finally {
                                setSyncingBillId(null);
                              }
                            }}
                            disabled={syncingBillId === inv.id}
                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                            title={`Sync Bill directly to ${activeConn.providerName}`}
                          >
                            <RefreshCw className={`w-2.5 h-2.5 ${syncingBillId === inv.id ? 'animate-spin' : ''}`} />
                            <span>Sync Bill</span>
                          </button>
                        )}

                        <button
                          onClick={() => onOpenReview(inv)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700/80 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-indigo-400" />
                          <span>Review</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Duplicate Invoice Inspection / Double-Payment Risk Dialog */}
      {inspectingDuplicate && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-amber-500/70 rounded-xl p-5 max-w-2xl w-full shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <span>Double-Payment Prevention Alert</span>
                    <span className="px-2 py-0.5 text-[10px] font-mono bg-amber-950 text-amber-300 rounded border border-amber-600">
                      High Risk
                    </span>
                  </h3>
                  <p className="text-xs text-amber-300/90 mt-0.5">
                    Our scanner detected multiple invoice records with the same vendor and invoice number.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectingDuplicate(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-amber-950/30 border border-amber-700/50 rounded-lg p-3 text-xs text-amber-200">
              <p className="font-medium">{inspectingDuplicate.reason}</p>
              <p className="text-[11px] text-amber-300/70 mt-1">
                Authorizing or syncing both invoices to your accounting system will issue double payment to{' '}
                <strong>{inspectingDuplicate.current.vendorName}</strong>. Please reject the duplicate submission.
              </p>
            </div>

            {/* Comparison Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Current Selected Invoice */}
              <div className="bg-slate-900/90 border border-slate-700/80 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Current Record</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-950 text-amber-300 border border-amber-800">
                    {inspectingDuplicate.current.businessStatus}
                  </span>
                </div>
                <div className="font-mono text-sm font-bold text-white">
                  #{inspectingDuplicate.current.invoiceNumber}
                </div>
                <div className="text-slate-300 font-medium">
                  {inspectingDuplicate.current.vendorName}
                </div>
                <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                  <span>Billing Date:</span>
                  <span className="text-white">{inspectingDuplicate.current.invoiceDate}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                  <span>Total Amount:</span>
                  <span className="text-amber-300 font-bold text-xs">
                    ${inspectingDuplicate.current.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Matching Duplicate Record(s) */}
              {inspectingDuplicate.others.map((other, idx) => (
                <div key={other.id || idx} className="bg-slate-900/90 border border-indigo-700/60 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-indigo-300 uppercase">
                      Existing Matching Record
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {other.businessStatus}
                    </span>
                  </div>
                  <div className="font-mono text-sm font-bold text-white">
                    #{other.invoiceNumber}
                  </div>
                  <div className="text-slate-300 font-medium">
                    {other.vendorName}
                  </div>
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                    <span>Billing Date:</span>
                    <span className="text-white">{other.invoiceDate}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                    <span>Total Amount:</span>
                    <span className="text-white font-bold text-xs">
                      ${other.totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setInspectingDuplicate(null)}
                className="px-3 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 text-xs font-medium cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const curr = inspectingDuplicate.current;
                  setInspectingDuplicate(null);
                  onOpenReview(curr);
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open in Review Modal</span>
              </button>
              {onBulkReject && (
                <button
                  type="button"
                  onClick={async () => {
                    const id = inspectingDuplicate.current.id;
                    setInspectingDuplicate(null);
                    await onBulkReject([id], 'Duplicate invoice submission - prevented double-payment');
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Reject as Duplicate</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Reject Modal */}
      {showBulkRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-rose-700/60 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Ban className="w-4 h-4 text-rose-400" />
                <span>Reject {selectedInvoiceIds.length} Selected Invoice(s)</span>
              </h3>
              <button
                onClick={() => setShowBulkRejectModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Provide a financial review reason for rejecting these {selectedInvoiceIds.length} invoice(s). This will update their status to <strong>Rejected</strong> and log an entry in the audit trail.
            </p>

            {/* Quick Reason Chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                'Duplicate invoice - prevents double payment',
                'Line item price discrepancy with vendor quote',
                'Unverified vendor / Missing tax identification',
                'Purchase order mismatch or unauthorized spend',
              ].map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setBulkRejectReason(chip)}
                  className={`text-[10px] px-2 py-1 rounded-md border text-left transition-colors cursor-pointer ${
                    bulkRejectReason === chip
                      ? 'bg-rose-950 border-rose-600 text-rose-200'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>

            <textarea
              value={bulkRejectReason}
              onChange={e => setBulkRejectReason(e.target.value)}
              rows={3}
              placeholder="Enter custom rejection reason..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowBulkRejectModal(false)}
                className="px-3 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBulkReject}
                disabled={isBulkRejecting || !bulkRejectReason.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{isBulkRejecting ? 'Rejecting...' : `Confirm Rejection (${selectedInvoiceIds.length})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
