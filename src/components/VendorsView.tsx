import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Building,
  Mail,
  MapPin,
  Calendar,
  X,
  CreditCard,
  DollarSign,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  TrendingDown,
  TrendingUp,
  ChevronRight,
  Filter,
  CheckCircle2,
  FileText,
  AlertOctagon,
  ArrowUpDown,
  Info,
  Globe,
} from 'lucide-react';
import { Vendor, GlAccount, Invoice } from '../types';

interface VendorsViewProps {
  vendors: Vendor[];
  glAccounts: GlAccount[];
  invoices?: Invoice[];
  onAddVendor: (vendor: Partial<Vendor>) => Promise<void>;
  onSelectVendorInvoices: (vendorName: string) => void;
  onOpenVendorPortal?: (vendorId?: string) => void;
}

export interface VendorRiskData {
  vendorId: string;
  vendorName: string;
  score: number; // 0 to 100
  level: 'Low' | 'Medium' | 'High';
  totalInvoices: number;
  rejectedCount: number;
  rejectionRate: number; // percentage
  lateCount: number;
  lateRate: number; // percentage
  overdueCount: number;
  discrepancyCount: number;
  rejectedInvoices: Invoice[];
  lateInvoices: Invoice[];
  reasons: string[];
}

export const VendorsView: React.FC<VendorsViewProps> = ({
  vendors,
  glAccounts,
  invoices = [],
  onAddVendor,
  onSelectVendorInvoices,
  onOpenVendorPortal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'High' | 'Medium' | 'Low'>('all');
  const [sortBy, setSortBy] = useState<'risk-desc' | 'risk-asc' | 'spend-desc' | 'name-asc'>('risk-desc');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRiskVendor, setSelectedRiskVendor] = useState<VendorRiskData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New vendor form state
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [defaultGlAccountId, setDefaultGlAccountId] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Current reference date (September 2026 for simulation)
  const referenceDateStr = '2026-09-26';

  // Calculate dynamic risk scores for every vendor based on rejection frequency & late payment history
  const vendorRiskMap = useMemo(() => {
    const map = new Map<string, VendorRiskData>();

    vendors.forEach(v => {
      // Find invoices matching vendor ID or name
      const vendorInvoices = invoices.filter(
        i => (i.vendorId && i.vendorId === v.id) || (i.vendorName && i.vendorName.toLowerCase() === v.name.toLowerCase())
      );

      const totalInvoices = Math.max(vendorInvoices.length, v.invoiceCount || 0);

      // 1. Rejection analysis
      const rejectedInvoices = vendorInvoices.filter(i => i.businessStatus === 'Rejected');
      const rejectedCount = rejectedInvoices.length;
      const rejectionRate = totalInvoices > 0 ? (rejectedCount / totalInvoices) * 100 : 0;

      // 2. Late payment history & overdue analysis
      const lateInvoices: Invoice[] = [];
      let overdueCount = 0;

      vendorInvoices.forEach(inv => {
        if (!inv.dueDate) return;
        const isPastDue = inv.dueDate < referenceDateStr;
        const isUnapproved = inv.businessStatus !== 'Approved' && inv.businessStatus !== 'Exported';

        // Currently overdue without approval
        if (isPastDue && isUnapproved) {
          overdueCount++;
          lateInvoices.push(inv);
          return;
        }

        // Historically approved past due date
        const approvedLate = inv.approvedAt && inv.approvedAt.split('T')[0] > inv.dueDate;
        const exportedLate = inv.exportedAt && inv.exportedAt.split('T')[0] > inv.dueDate;
        if (approvedLate || exportedLate) {
          lateInvoices.push(inv);
        }
      });

      const lateCount = lateInvoices.length;
      const lateRate = totalInvoices > 0 ? (lateCount / totalInvoices) * 100 : 0;

      // 3. Validation errors / discrepancies
      const discrepancyInvoices = vendorInvoices.filter(i =>
        i.validationIssues?.some(issue => issue.status === 'ERROR') || i.isDuplicate
      );
      const discrepancyCount = discrepancyInvoices.length;

      // Compute weighted Risk Score (0 - 100)
      let score = 10; // baseline for verified vendor
      const reasons: string[] = [];

      if (rejectedCount > 0) {
        const rejectionPenalty = Math.round(rejectionRate * 0.5 + rejectedCount * 18);
        score += rejectionPenalty;
        reasons.push(
          `${rejectedCount} rejected invoice(s) (${rejectionRate.toFixed(0)}% rejection frequency)`
        );
      }

      if (lateCount > 0) {
        const latePenalty = Math.round(lateRate * 0.35 + lateCount * 12);
        score += latePenalty;
        reasons.push(
          `${lateCount} delayed or overdue invoice(s) (${lateRate.toFixed(0)}% payment delay rate)`
        );
      }

      if (discrepancyCount > 0) {
        score += discrepancyCount * 12;
        reasons.push(`${discrepancyCount} arithmetic or duplicate billing warning(s)`);
      }

      // Bound score
      score = Math.min(99, Math.max(5, score));

      let level: 'Low' | 'Medium' | 'High' = 'Low';
      if (score >= 60) level = 'High';
      else if (score >= 30) level = 'Medium';

      if (reasons.length === 0) {
        reasons.push('Clean payment record, 0 rejections, verified tax compliance');
      }

      map.set(v.id, {
        vendorId: v.id,
        vendorName: v.name,
        score,
        level,
        totalInvoices,
        rejectedCount,
        rejectionRate,
        lateCount,
        lateRate,
        overdueCount,
        discrepancyCount,
        rejectedInvoices,
        lateInvoices,
        reasons,
      });
    });

    return map;
  }, [vendors, invoices]);

  // Aggregate Portfolio Risk Stats
  const riskStats = useMemo(() => {
    let totalScore = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let totalRejected = 0;
    let totalLate = 0;

    vendorRiskMap.forEach(r => {
      totalScore += r.score;
      if (r.level === 'High') highCount++;
      else if (r.level === 'Medium') mediumCount++;
      else lowCount++;
      totalRejected += r.rejectedCount;
      totalLate += r.lateCount;
    });

    const avgScore = vendors.length > 0 ? Math.round(totalScore / vendors.length) : 0;

    return {
      avgScore,
      highCount,
      mediumCount,
      lowCount,
      totalRejected,
      totalLate,
    };
  }, [vendorRiskMap, vendors.length]);

  // Filter and sort vendors
  const displayedVendors = useMemo(() => {
    return vendors
      .filter(v => {
        const matchesQuery =
          v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.taxId?.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesQuery) return false;

        if (riskFilter !== 'all') {
          const risk = vendorRiskMap.get(v.id);
          if (risk?.level !== riskFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const riskA = vendorRiskMap.get(a.id)?.score || 0;
        const riskB = vendorRiskMap.get(b.id)?.score || 0;

        if (sortBy === 'risk-desc') return riskB - riskA;
        if (sortBy === 'risk-asc') return riskA - riskB;
        if (sortBy === 'spend-desc') return b.totalSpend - a.totalSpend;
        return a.name.localeCompare(b.name);
      });
  }, [vendors, searchQuery, riskFilter, sortBy, vendorRiskMap]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddVendor({
        name,
        taxId,
        address,
        paymentTerms,
        defaultCurrency,
        defaultGlAccountId,
        contactEmail,
      });
      setShowAddModal(false);
      setName('');
      setTaxId('');
      setAddress('');
      setContactEmail('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Supplier & Vendor Directory</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-semibold">
              Risk Scoring Engine
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Maintain verified supplier profiles, default tax IDs, and monitor automated <strong>Risk Scores</strong> calculated from invoice rejection frequency and late payment history.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {onOpenVendorPortal && (
            <button
              type="button"
              onClick={() => onOpenVendorPortal()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>Launch Vendor Portal</span>
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Supplier Profile</span>
          </button>
        </div>
      </div>

      {/* Portfolio Risk Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Portfolio Risk Index</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {riskStats.avgScore}
              <span className="text-xs text-slate-500 font-normal">/100</span>
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                riskStats.avgScore < 30
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                  : riskStats.avgScore < 60
                  ? 'bg-amber-950 text-amber-300 border border-amber-700/60'
                  : 'bg-rose-950 text-rose-300 border border-rose-700/60'
              }`}
            >
              {riskStats.avgScore < 30 ? 'Low Exposure' : riskStats.avgScore < 60 ? 'Moderate' : 'Elevated'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">Across {vendors.length} registered corporate suppliers</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">High Risk Suppliers</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono tabular-nums ${riskStats.highCount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
              {riskStats.highCount}
            </span>
            <span className="text-xs text-slate-500 font-mono">vendor(s)</span>
          </div>
          <p className="text-[11px] text-slate-500">Trigger manual approval review mandates</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Rejected Invoices</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono tabular-nums ${riskStats.totalRejected > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {riskStats.totalRejected}
            </span>
            <span className="text-xs text-slate-500 font-mono">disputed bills</span>
          </div>
          <p className="text-[11px] text-slate-500">Arithmetic or contract terms discrepancy</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Delayed or Overdue</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {riskStats.totalLate}
            </span>
            <span className="text-xs text-slate-500 font-mono">past-due events</span>
          </div>
          <p className="text-[11px] text-slate-500">Invoices exceeding agreed payment terms</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative max-w-sm w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search suppliers by name or tax ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Risk Filter Chips & Sort Select */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-0.5 flex items-center">
            <button
              onClick={() => setRiskFilter('all')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                riskFilter === 'all' ? 'bg-indigo-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({vendors.length})
            </button>
            <button
              onClick={() => setRiskFilter('High')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                riskFilter === 'High' ? 'bg-rose-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>High Risk ({riskStats.highCount})</span>
            </button>
            <button
              onClick={() => setRiskFilter('Medium')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                riskFilter === 'Medium' ? 'bg-amber-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              Medium ({riskStats.mediumCount})
            </button>
            <button
              onClick={() => setRiskFilter('Low')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                riskFilter === 'Low' ? 'bg-emerald-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              Low ({riskStats.lowCount})
            </button>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300">
            <ArrowUpDown className="w-3 h-3 text-slate-500" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="risk-desc" className="bg-slate-900">Sort: Highest Risk</option>
              <option value="risk-asc" className="bg-slate-900">Sort: Lowest Risk</option>
              <option value="spend-desc" className="bg-slate-900">Sort: Total Spend</option>
              <option value="name-asc" className="bg-slate-900">Sort: Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Vendors Data Grid */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50 shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0b101c] border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
            <tr>
              <th className="py-3 px-4">Vendor Profile</th>
              <th className="py-3 px-4">Tax / VAT ID</th>
              <th className="py-3 px-4">Terms</th>
              <th className="py-3 px-4">Default GL Account</th>
              <th className="py-3 px-4 text-center">Invoices</th>
              <th className="py-3 px-4 text-right">Total Spend</th>
              <th className="py-3 px-4 text-center">
                <span className="flex items-center justify-center gap-1">
                  <span>Risk Score</span>
                  <span title="Calculated from rejection rate, late payments, and billing errors">
                    <Info className="w-3 h-3 text-slate-500" />
                  </span>
                </span>
              </th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {displayedVendors.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                  No suppliers matching filter criteria.
                </td>
              </tr>
            ) : (
              displayedVendors.map(vendor => {
                const defaultGl = glAccounts.find(g => g.id === vendor.defaultGlAccountId);
                const risk = vendorRiskMap.get(vendor.id) || {
                  score: 10,
                  level: 'Low',
                  rejectedCount: 0,
                  lateCount: 0,
                  reasons: ['No recorded discrepancies'],
                };

                return (
                  <tr
                    key={vendor.id}
                    onClick={() => {
                      const rData = vendorRiskMap.get(vendor.id);
                      if (rData) setSelectedRiskVendor(rData);
                    }}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4">
                      <p className="font-bold text-white group-hover:text-indigo-300 transition-colors">{vendor.name}</p>
                      {vendor.contactEmail && (
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                          <Mail className="w-2.5 h-2.5 text-slate-500" />
                          <span>{vendor.contactEmail}</span>
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-300">
                      {vendor.taxId || 'N/A'}
                    </td>

                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                      {vendor.paymentTerms}
                    </td>

                    <td className="py-3 px-4">
                      {defaultGl ? (
                        <span className="text-slate-300 truncate max-w-[180px] block">
                          <strong className="text-indigo-300 font-mono">{defaultGl.code}</strong> - {defaultGl.name}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">None configured</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center font-mono text-slate-200">
                      {vendor.invoiceCount}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-white tabular-nums">
                      ${vendor.totalSpend.toFixed(2)}
                    </td>

                    {/* RISK SCORE INDICATOR CELL */}
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono flex items-center gap-1.5 transition-all shadow-sm ${
                            risk.level === 'High'
                              ? 'bg-rose-950/80 text-rose-300 border border-rose-600/70 hover:bg-rose-900/80 ring-1 ring-rose-500/50'
                              : risk.level === 'Medium'
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-600/70 hover:bg-amber-900/80'
                              : 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/70 hover:bg-emerald-900/80'
                          }`}
                          title="Click to view full Risk Assessment breakdown"
                        >
                          {risk.level === 'High' ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : risk.level === 'Medium' ? (
                            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                          <span>{risk.score}/100</span>
                          <span className="text-[10px] uppercase font-sans font-semibold">({risk.level})</span>
                        </span>

                        {/* Micro Risk Sub-label */}
                        <span className="text-[9px] font-mono text-slate-400 mt-0.5">
                          {risk.rejectedCount > 0
                            ? `${risk.rejectedCount} Rejected`
                            : risk.lateCount > 0
                            ? `${risk.lateCount} Delayed`
                            : 'Clean Record'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                        {vendor.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const rData = vendorRiskMap.get(vendor.id);
                            if (rData) setSelectedRiskVendor(rData);
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Risk Details</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                        <span className="text-slate-600">·</span>
                        <button
                          type="button"
                          onClick={() => onSelectVendorInvoices(vendor.name)}
                          className="text-xs text-slate-400 hover:text-white font-medium cursor-pointer"
                        >
                          Invoices
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

      {/* VENDOR RISK SCORE DETAILS MODAL */}
      {selectedRiskVendor && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Supplier Risk Assessment
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">{selectedRiskVendor.vendorName}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Calculated based on invoice rejection frequency and late payment history.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRiskVendor(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Score Visual Gauge Card */}
            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                selectedRiskVendor.level === 'High'
                  ? 'bg-rose-950/40 border-rose-700/60'
                  : selectedRiskVendor.level === 'Medium'
                  ? 'bg-amber-950/40 border-amber-700/60'
                  : 'bg-emerald-950/40 border-emerald-700/60'
              }`}
            >
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Computed Composite Risk
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-3xl font-extrabold font-mono ${
                      selectedRiskVendor.level === 'High'
                        ? 'text-rose-400'
                        : selectedRiskVendor.level === 'Medium'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {selectedRiskVendor.score}
                    <span className="text-base text-slate-500 font-normal">/100</span>
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      selectedRiskVendor.level === 'High'
                        ? 'bg-rose-950 text-rose-300 border border-rose-600/70'
                        : selectedRiskVendor.level === 'Medium'
                        ? 'bg-amber-950 text-amber-300 border border-amber-600/70'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-600/70'
                    }`}
                  >
                    {selectedRiskVendor.level} Risk Supplier
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Invoices</span>
                <span className="text-base font-bold font-mono text-white">
                  {selectedRiskVendor.totalInvoices}
                </span>
              </div>
            </div>

            {/* Risk Factor Breakdown Meters */}
            <div className="space-y-3 text-xs">
              <h4 className="text-[11px] uppercase font-bold text-slate-300 tracking-wider">
                Risk Driver Metrics:
              </h4>

              {/* Metric 1: Invoice Rejection Frequency */}
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                    <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                    <span>Invoice Rejection Frequency:</span>
                  </div>
                  <span className="font-mono font-bold text-rose-300">
                    {selectedRiskVendor.rejectedCount} of {selectedRiskVendor.totalInvoices} ({selectedRiskVendor.rejectionRate.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, selectedRiskVendor.rejectionRate)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  {selectedRiskVendor.rejectedCount > 0
                    ? 'Invoices rejected due to discrepancies in subtotal math, line item mismatch, or unauthorized pricing.'
                    : 'Zero recorded rejections. High billing accuracy.'}
                </p>
              </div>

              {/* Metric 2: Late Payment History & Overdue */}
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Late Payment / Overdue History:</span>
                  </div>
                  <span className="font-mono font-bold text-amber-300">
                    {selectedRiskVendor.lateCount} event(s) ({selectedRiskVendor.lateRate.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, selectedRiskVendor.lateRate)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  {selectedRiskVendor.lateCount > 0
                    ? 'Invoices past due or requiring extended approval cycles beyond standard payment terms.'
                    : 'All invoices approved within contracted payment terms.'}
                </p>
              </div>
            </div>

            {/* Specific Identified Risk Reasons */}
            <div className="space-y-2">
              <h4 className="text-[11px] uppercase font-bold text-slate-300 tracking-wider">
                Risk Engine Findings:
              </h4>
              <div className="space-y-1.5">
                {selectedRiskVendor.reasons.map((r, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                    <span className="leading-relaxed">{r}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedRiskVendor(null)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = selectedRiskVendor.vendorName;
                  setSelectedRiskVendor(null);
                  onSelectVendorInvoices(name);
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>View Flagged Invoices</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Vendor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#101726] border border-slate-700 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-400" />
                <span>Add Supplier Profile</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Stripe, Inc."
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Tax / VAT ID</label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={e => setTaxId(e.target.value)}
                    placeholder="e.g. US-81290382"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                    <option value="Due on Receipt">Due on Receipt</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Default GL Expense Account</label>
                <select
                  value={defaultGlAccountId}
                  onChange={e => setDefaultGlAccountId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">None (Auto-predict with AI)</option>
                  {glAccounts.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.code} - {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Billing Contact Email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="billing@supplier.com"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Registered Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Street, City, State, Country"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded shadow-sm"
                >
                  {isSubmitting ? 'Saving...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
