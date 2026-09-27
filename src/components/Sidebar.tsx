import React from 'react';
import {
  FileText,
  CheckSquare,
  Users,
  BookOpen,
  DownloadCloud,
  History,
  BarChart3,
  Settings,
  LayoutDashboard,
  Building2,
  Shield,
  ChevronDown,
  Link2,
  Globe,
} from 'lucide-react';
import { Organization, User } from '../types';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  organization: Organization;
  organizations: Organization[];
  onSwitchOrg: (orgId: string) => void;
  currentUser: User;
  onSwitchRole: (role: 'Admin' | 'Accountant' | 'Approver' | 'Read-Only') => void;
  needsReviewCount: number;
  pendingApprovalCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  organization,
  organizations,
  onSwitchOrg,
  currentUser,
  onSwitchRole,
  needsReviewCount,
  pendingApprovalCount,
}) => {
  const [showOrgDropdown, setShowOrgDropdown] = React.useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = React.useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'invoices',
      label: 'Invoices',
      icon: FileText,
      count: needsReviewCount > 0 ? needsReviewCount : undefined,
      countLabel: 'need review'
    },
    {
      id: 'approvals',
      label: 'Approvals',
      icon: CheckSquare,
      count: pendingApprovalCount > 0 ? pendingApprovalCount : undefined,
      countLabel: 'pending'
    },
    { id: 'vendors', label: 'Vendors', icon: Users },
    { id: 'vendor-portal', label: 'Vendor Portal', icon: Globe, badge: 'External' },
    { id: 'gl-accounts', label: 'Chart of Accounts', icon: BookOpen },
    { id: 'connections', label: 'Accounting Connections', icon: Link2 },
    { id: 'exports', label: 'Accounting Export', icon: DownloadCloud },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'audit', label: 'Audit Trail', icon: History },
    { id: 'settings', label: 'Settings & Billing', icon: Settings },
  ];

  const quotaPercent = Math.min(
    100,
    Math.round((organization.invoicesThisMonth / organization.monthlyQuota) * 100)
  );

  return (
    <aside className="w-64 bg-[#0d131f] border-r border-slate-800/80 flex flex-col h-screen select-none shrink-0">
      {/* Brand & Organization Switcher */}
      <div className="p-4 border-b border-slate-800/80">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center text-white font-bold text-sm tracking-wider shadow-sm">
              A
            </div>
            <span className="font-semibold text-base tracking-tight text-white">Acanty</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono tracking-tight">v1.4</span>
        </div>

        {/* Workspace Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
            className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-left transition-colors"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <div className="truncate">
                <p className="text-xs font-medium text-slate-200 truncate">{organization.name}</p>
                <p className="text-[10px] text-slate-500 font-mono">{organization.defaultCurrency} · {organization.plan} Plan</p>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {showOrgDropdown && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
              <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Switch Workspace</p>
              {organizations.map(org => (
                <button
                  key={org.id}
                  onClick={() => {
                    onSwitchOrg(org.id);
                    setShowOrgDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-800 transition-colors ${
                    org.id === organization.id ? 'text-indigo-400 bg-indigo-950/30' : 'text-slate-300'
                  }`}
                >
                  <span className="truncate">{org.name}</span>
                  <span className="text-[10px] font-mono text-slate-500">{org.defaultCurrency}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600/15 text-indigo-300 border-l-2 border-indigo-500'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && (
                <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 font-medium">
                  {item.count}
                </span>
              )}
              {item.badge && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/60 font-semibold uppercase tracking-wider">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Usage Quota Card */}
      <div className="p-3 mx-3 mb-3 bg-slate-900/60 rounded-lg border border-slate-800/60">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-400">Monthly Usage</span>
          <span className="font-mono text-slate-300 font-medium">{organization.invoicesThisMonth} / {organization.monthlyQuota}</span>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              quotaPercent > 90 ? 'bg-amber-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${quotaPercent}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5 flex items-center justify-between">
          <span>{organization.plan} Tier</span>
          <button
            onClick={() => onSelectTab('settings')}
            className="text-indigo-400 hover:text-indigo-300 font-medium"
          >
            Manage
          </button>
        </p>
      </div>

      {/* User & Role Switcher */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src="/src/assets/images/avatar_executive_alex_1790322395111.jpg"
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border border-slate-700"
              />
              <div className="truncate">
                <p className="text-xs font-semibold text-slate-200 truncate">{currentUser.name}</p>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Shield className="w-3 h-3 text-indigo-400" />
                  <span>{currentUser.role}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              title="Test role permissions"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {showRoleDropdown && (
            <div className="absolute left-0 right-0 bottom-full mb-2 bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-50 py-1">
              <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Test RBAC Role</p>
              {(['Admin', 'Accountant', 'Approver', 'Read-Only'] as const).map(role => (
                <button
                  key={role}
                  onClick={() => {
                    onSwitchRole(role);
                    setShowRoleDropdown(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-slate-800 transition-colors ${
                    currentUser.role === role ? 'text-indigo-400 bg-indigo-950/30' : 'text-slate-300'
                  }`}
                >
                  <span>{role}</span>
                  {currentUser.role === role && <span className="text-[10px] font-mono">active</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
