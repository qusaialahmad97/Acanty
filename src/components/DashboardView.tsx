import React from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  DownloadCloud,
  ArrowUpRight,
  TrendingUp,
  Building,
  ShieldAlert,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Invoice, AuditEvent, Organization, GlAccount, Vendor } from '../types';
import { SpendTrendsWidget } from './SpendTrendsWidget';

interface DashboardViewProps {
  invoices: Invoice[];
  auditEvents: AuditEvent[];
  organization: Organization;
  glAccounts?: GlAccount[];
  vendors?: Vendor[];
  onNavigateTab: (tab: string, filterStatus?: string) => void;
  onOpenReview: (invoice: Invoice) => void;
  onOpenUpload: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  invoices,
  auditEvents,
  organization,
  glAccounts = [],
  vendors = [],
  onNavigateTab,
  onOpenReview,
  onOpenUpload,
}) => {
  const needsReview = invoices.filter(i => i.businessStatus === 'Needs Review');
  const pendingApproval = invoices.filter(i => i.businessStatus === 'Pending Approval');
  const approvedReady = invoices.filter(i => i.businessStatus === 'Approved');
  const exported = invoices.filter(i => i.businessStatus === 'Exported');
  const rejected = invoices.filter(i => i.businessStatus === 'Rejected');

  const totalSpend = invoices.reduce((sum, i) => sum + i.totalAmount, 0);
  const totalApprovedValue = approvedReady.reduce((sum, i) => sum + i.totalAmount, 0);

  const kpis = [
    {
      title: 'Awaiting Review',
      value: needsReview.length,
      subtitle: `${needsReview.reduce((s, i) => s + i.totalAmount, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} total`,
      status: 'review',
      filter: 'Needs Review',
      icon: Clock,
      color: 'text-amber-400',
      bgColor: 'bg-amber-950/20',
      borderColor: 'border-amber-800/40',
    },
    {
      title: 'Pending Approval',
      value: pendingApproval.length,
      subtitle: `${pendingApproval.reduce((s, i) => s + i.totalAmount, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} awaiting signoff`,
      status: 'approval',
      filter: 'Pending Approval',
      icon: AlertTriangle,
      color: 'text-blue-400',
      bgColor: 'bg-blue-950/20',
      borderColor: 'border-blue-800/40',
    },
    {
      title: 'Ready for Export',
      value: approvedReady.length,
      subtitle: `${totalApprovedValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} approved for ERP`,
      status: 'export',
      filter: 'Approved',
      icon: DownloadCloud,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-950/20',
      borderColor: 'border-emerald-800/40',
    },
    {
      title: 'Total Monthly Invoices',
      value: organization.invoicesThisMonth,
      subtitle: `Quota: ${organization.monthlyQuota} (${Math.round((organization.invoicesThisMonth / organization.monthlyQuota) * 100)}% utilized)`,
      status: 'quota',
      filter: 'all',
      icon: FileText,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-950/20',
      borderColor: 'border-indigo-800/40',
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight">
            Accounts Payable Pipeline
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Autonomous AI extraction and deterministic validation for {organization.name}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateTab('exports')}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700 transition-colors"
          >
            Export Accounting Batch
          </button>
          <button
            onClick={onOpenUpload}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold shadow-sm transition-colors"
          >
            + Upload Invoice
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <button
              key={idx}
              onClick={() => onNavigateTab(kpi.status === 'approval' ? 'approvals' : 'invoices', kpi.filter)}
              className={`p-4 rounded-xl border ${kpi.borderColor} ${kpi.bgColor} text-left transition-all hover:border-slate-600 group cursor-pointer`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{kpi.title}</span>
                <Icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
                {kpi.value}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span className="truncate">{kpi.subtitle}</span>
                <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors shrink-0 ml-1" />
              </p>
            </button>
          );
        })}
      </div>

      {/* Recharts Analytics Visualization: Monthly Spend Trends by Category */}
      <SpendTrendsWidget
        invoices={invoices}
        glAccounts={glAccounts}
        onNavigateTab={onNavigateTab}
      />

      {/* Two-Column Grid: Urgent Action Items & Activity Audit Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Action Required Invoices */}
        <div className="lg:col-span-8 bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                Invoices Requiring Attention
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Extracted supplier bills awaiting review or approval verification
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('invoices')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              <span>View all invoices</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-slate-800/80">
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-2.5">
                <div className="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 flex items-center justify-center mx-auto">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="font-semibold text-slate-200">No invoices in the system</p>
                  <p className="text-[11px] text-slate-500">Upload your first vendor invoice to begin AI document extraction.</p>
                </div>
                <button
                  type="button"
                  onClick={onOpenUpload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Upload First Invoice</span>
                </button>
              </div>
            ) : invoices.filter(i => i.businessStatus === 'Needs Review' || i.businessStatus === 'Pending Approval').length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p>All invoices are currently reviewed and approved!</p>
              </div>
            ) : (
              invoices
                .filter(i => i.businessStatus === 'Needs Review' || i.businessStatus === 'Pending Approval')
                .slice(0, 5)
                .map(inv => (
                  <div
                    key={inv.id}
                    onClick={() => onOpenReview(inv)}
                    className="p-3.5 hover:bg-slate-800/40 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-slate-300">
                        <FileText className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white font-mono">
                            #{inv.invoiceNumber}
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className="text-xs text-slate-300 font-medium">{inv.vendorName}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
                          <span>Date: {inv.invoiceDate}</span>
                          <span>·</span>
                          <span>Due: {inv.dueDate}</span>
                          {inv.validationIssues.some(v => v.status === 'ERROR') && (
                            <span className="text-rose-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Arithmetic variance
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs font-bold font-mono text-white tabular-nums">
                          ${inv.totalAmount.toFixed(2)}
                        </p>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                            inv.businessStatus === 'Needs Review'
                              ? 'bg-amber-950/40 text-amber-300 border border-amber-800/50'
                              : 'bg-blue-950/40 text-blue-300 border border-blue-800/50'
                          }`}
                        >
                          {inv.businessStatus}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Right Column: Live Audit Trail Stream */}
        <div className="lg:col-span-4 bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Financial Audit Log
            </h3>
            <button
              onClick={() => onNavigateTab('audit')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Full Trail
            </button>
          </div>

          <div className="p-4 divide-y divide-slate-800/60 flex-1 overflow-y-auto max-h-[380px] space-y-3">
            {auditEvents.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs space-y-1">
                <Clock className="w-6 h-6 mx-auto mb-1 text-slate-600 opacity-60" />
                <p className="text-slate-400 font-medium">No audit events logged yet</p>
                <p className="text-[11px] text-slate-600">Actions on invoices and exports will be recorded here.</p>
              </div>
            ) : (
              auditEvents.slice(0, 6).map(evt => (
                <div key={evt.id} className="pt-3 first:pt-0">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">{evt.actorName}</span>
                    <span className="font-mono text-slate-500">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 mt-1 leading-snug">{evt.description}</p>
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 font-mono">
                    <span>{evt.action}</span>
                    <span>·</span>
                    <span>{evt.entityType}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
