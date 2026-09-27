import React from 'react';
import { Upload, Search, Bell, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onOpenUpload: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  pendingApprovalsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenUpload,
  searchQuery,
  onSearchChange,
  pendingApprovalsCount,
}) => {
  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return 'Executive Overview';
      case 'invoices':
        return 'Invoice Processing';
      case 'approvals':
        return 'Financial Approval Queue';
      case 'vendors':
        return 'Vendor Directory';
      case 'gl-accounts':
        return 'General Ledger Chart of Accounts';
      case 'connections':
        return 'Accounting Connections & Auto-Sync';
      case 'exports':
        return 'Accounting Integration & Exports';
      case 'reports':
        return 'Financial Reports & Analytics';
      case 'audit':
        return 'Immutable Audit Trail';
      case 'settings':
        return 'Settings & Subscription';
      default:
        return 'Accounts Payable';
    }
  };

  return (
    <header className="h-14 border-b border-slate-800/80 bg-[#0d131f] px-6 flex items-center justify-between shrink-0 z-10">
      {/* Zone 1: Breadcrumb Title */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400 font-medium">Acanty</span>
        <span className="text-slate-600">/</span>
        <span className="text-slate-100 font-semibold">{getTabTitle(currentTab)}</span>
      </div>

      {/* Zone 2: Quick Search */}
      <div className="flex-1 max-w-md mx-6">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by invoice #, vendor, PO number..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors"
          />
        </div>
      </div>

      {/* Zone 3: Primary Actions */}
      <div className="flex items-center gap-3">
        {pendingApprovalsCount > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-400/90 bg-amber-950/20 border border-amber-800/40 px-2.5 py-1 rounded">
            <Bell className="w-3 h-3 text-amber-400" />
            <span className="font-mono">{pendingApprovalsCount}</span>
            <span>awaiting approval</span>
          </div>
        )}

        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Invoice</span>
        </button>
      </div>
    </header>
  );
};
