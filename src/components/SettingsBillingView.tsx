import React, { useState, useMemo } from 'react';
import {
  Settings,
  CreditCard,
  Building2,
  Check,
  ArrowRight,
  ShieldCheck,
  Zap,
  Link2,
  ShieldAlert,
  DollarSign,
  Sliders,
  Layers,
  Lock,
  Unlock,
  RefreshCw,
  Play,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Info,
  HelpCircle,
  Save,
  Clock,
  UserCheck,
  RotateCcw,
} from 'lucide-react';
import { Organization, User, Invoice, Vendor, ApprovalThresholds } from '../types';

interface SettingsBillingViewProps {
  organization: Organization;
  currentUser: User;
  invoices?: Invoice[];
  vendors?: Vendor[];
  onUpdatePlan: (plan: Organization['plan']) => Promise<void>;
  onUpdateApprovalThresholds?: (thresholds: Partial<ApprovalThresholds>) => Promise<void>;
  onApplyAutoApproval?: () => Promise<void>;
  onNavigateConnections?: () => void;
}

export const SettingsBillingView: React.FC<SettingsBillingViewProps> = ({
  organization,
  currentUser,
  invoices = [],
  vendors = [],
  onUpdatePlan,
  onUpdateApprovalThresholds,
  onApplyAutoApproval,
  onNavigateConnections,
}) => {
  const [activeTab, setActiveTab] = useState<'thresholds' | 'billing' | 'profile'>('thresholds');
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const [isSavingThresholds, setIsSavingThresholds] = useState(false);
  const [isApplyingAutoApproval, setIsApplyingAutoApproval] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);

  const isAdmin = currentUser.role === 'Admin';

  // Current thresholds from org or defaults
  const defaultThresholds: ApprovalThresholds = {
    autoApprovalEnabled: true,
    autoApprovalLimit: 750,
    requireVerifiedVendor: true,
    requireZeroValidationErrors: true,
    requirePoMatch: false,
    minGlConfidence: 85,
    managerApprovalLimit: 5000,
    lastUpdatedBy: 'Alex Vance (Admin)',
    lastUpdatedAt: new Date().toISOString(),
  };

  const initialThresholds: ApprovalThresholds = organization.approvalThresholds || defaultThresholds;

  // Local state for editable thresholds
  const [thresholds, setThresholds] = useState<ApprovalThresholds>(initialThresholds);
  const [hasChanges, setHasChanges] = useState(false);

  // Live Simulator state
  const [simAmount, setSimAmount] = useState<number>(450);
  const [simVendor, setSimVendor] = useState<string>('Amazon Web Services, Inc.');
  const [simHasErrors, setSimHasErrors] = useState<boolean>(false);
  const [simHasPo, setSimHasPo] = useState<boolean>(true);

  const updateThresholdField = <K extends keyof ApprovalThresholds>(key: K, value: ApprovalThresholds[K]) => {
    if (!isAdmin) return;
    setThresholds(prev => {
      const next = { ...prev, [key]: value };
      setHasChanges(true);
      return next;
    });
  };

  const handleSaveThresholds = async () => {
    if (!isAdmin || !onUpdateApprovalThresholds) return;
    setIsSavingThresholds(true);
    try {
      await onUpdateApprovalThresholds(thresholds);
      setHasChanges(false);
    } finally {
      setIsSavingThresholds(false);
    }
  };

  const handleResetDefaults = () => {
    if (!isAdmin) return;
    setThresholds(defaultThresholds);
    setHasChanges(true);
  };

  const handleRunAutoApproval = async () => {
    if (!isAdmin || !onApplyAutoApproval) return;
    setIsApplyingAutoApproval(true);
    setApplyResult(null);
    try {
      await onApplyAutoApproval();
      setApplyResult('Autonomous evaluation executed successfully.');
      setTimeout(() => setApplyResult(null), 5000);
    } finally {
      setIsApplyingAutoApproval(false);
    }
  };

  // Compute eligible pending invoices under current threshold policy
  const pendingInvoices = useMemo(() => {
    return invoices.filter(
      i => i.organizationId === organization.id && (i.businessStatus === 'Needs Review' || i.businessStatus === 'Pending Approval')
    );
  }, [invoices, organization.id]);

  const eligibleInvoices = useMemo(() => {
    if (!thresholds.autoApprovalEnabled) return [];

    return pendingInvoices.filter(inv => {
      if (inv.totalAmount > thresholds.autoApprovalLimit) return false;
      if (inv.isDuplicate) return false;
      if (inv.validationIssues?.some(v => v.status === 'ERROR')) return false;
      if (thresholds.requireZeroValidationErrors && inv.validationIssues?.some(v => v.status === 'WARNING')) return false;
      if (thresholds.requireVerifiedVendor) {
        const vendorExists = vendors.some(
          v => v.id === inv.vendorId || (v.name && v.name.toLowerCase() === inv.vendorName?.toLowerCase())
        );
        if (!vendorExists) return false;
      }
      if (thresholds.requirePoMatch && !inv.purchaseOrderNumber) return false;
      return true;
    });
  }, [pendingInvoices, thresholds, vendors]);

  const eligibleTotalValue = eligibleInvoices.reduce((sum, i) => sum + i.totalAmount, 0);

  // Live Simulator Routing Verdict
  const simulationResult = useMemo(() => {
    if (!thresholds.autoApprovalEnabled) {
      return {
        verdict: 'MANUAL_REVIEW',
        tier: 'Standard Manual Review',
        reason: 'Auto-approval policy is currently disabled. All invoices require manual review.',
        color: 'text-blue-400',
        bg: 'bg-blue-950/40 border-blue-700/60',
        badge: 'Requires Sign-Off',
      };
    }

    if (simHasErrors) {
      return {
        verdict: 'BLOCKED_ERROR',
        tier: 'Validation Failed',
        reason: 'Contains unresolved validation errors or variance. Bypasses auto-approval and blocked until manual correction.',
        color: 'text-rose-400',
        bg: 'bg-rose-950/40 border-rose-700/60',
        badge: 'Blocked for Review',
      };
    }

    if (thresholds.requirePoMatch && !simHasPo) {
      return {
        verdict: 'BLOCKED_PO',
        tier: 'Standard Review',
        reason: 'Missing required Purchase Order. Rule requires PO match for autonomous sign-off.',
        color: 'text-amber-400',
        bg: 'bg-amber-950/40 border-amber-700/60',
        badge: 'PO Required',
      };
    }

    if (simAmount <= thresholds.autoApprovalLimit) {
      return {
        verdict: 'AUTO_APPROVED',
        tier: 'Tier 1: Autonomous Auto-Approval',
        reason: `Amount ($${simAmount.toFixed(2)}) is <= $${thresholds.autoApprovalLimit.toFixed(2)} limit and passes all integrity checks. Auto-approved without human delay!`,
        color: 'text-emerald-400',
        bg: 'bg-emerald-950/40 border-emerald-700/60',
        badge: '✅ Auto-Approved',
      };
    }

    if (simAmount <= thresholds.managerApprovalLimit) {
      return {
        verdict: 'MANAGER_REVIEW',
        tier: 'Tier 2: Single Departmental Approval',
        reason: `Amount ($${simAmount.toFixed(2)}) exceeds $${thresholds.autoApprovalLimit.toFixed(2)} auto-limit. Assigned to Marcus Brody (Approver) for authorization.`,
        color: 'text-blue-400',
        bg: 'bg-blue-950/40 border-blue-700/60',
        badge: 'Requires 1 Approver',
      };
    }

    return {
      verdict: 'EXECUTIVE_REVIEW',
      tier: 'Tier 3: Executive Dual Sign-off',
      reason: `Amount ($${simAmount.toFixed(2)}) exceeds $${thresholds.managerApprovalLimit.toFixed(2)} threshold. Requires executive authorization from Finance Director / Admin.`,
      color: 'text-amber-400',
      bg: 'bg-amber-950/40 border-amber-700/60',
      badge: 'Executive Authorization Required',
    };
  }, [simAmount, simHasErrors, simHasPo, thresholds]);

  const plans = [
    {
      id: 'Starter',
      name: 'Starter Plan',
      price: '$29',
      period: 'per month',
      description: 'Ideal for small businesses processing up to 50 invoices monthly.',
      quota: 50,
      features: [
        '50 AI Invoice Extractions / mo',
        'Deterministic validation engine',
        'Standard CSV & Excel export',
        '1 Admin & 2 Reviewers',
        '30-day document retention',
      ],
    },
    {
      id: 'Growth',
      name: 'Growth Plan',
      price: '$79',
      period: 'per month',
      description: 'For growing companies with multi-level financial approvals.',
      quota: 250,
      popular: true,
      features: [
        '250 AI Invoice Extractions / mo',
        'AI GL Code auto-recommendation',
        'Multi-tiered approval workflows',
        'Configurable Auto-Approval Limits',
        'Up to 10 team members with RBAC',
        'Priority background OCR queue',
        'Unlimited document archiving',
      ],
    },
    {
      id: 'Pro',
      name: 'Pro Enterprise',
      price: '$149',
      period: 'per month',
      description: 'For high-volume accounts payable departments & finance teams.',
      quota: 750,
      features: [
        '750 AI Invoice Extractions / mo',
        'Custom GL hierarchy rules',
        'Advanced Approval Rules Engine',
        'Unlimited approvers & auditors',
        'Audit trail tamper-proof logging',
        'Dedicated SLA & support desk',
        'Multi-currency tolerance checks',
      ],
    },
  ];

  const handleSelectPlan = async (planId: Organization['plan']) => {
    if (planId === organization.plan) return;
    setIsUpdatingPlan(true);
    try {
      await onUpdatePlan(planId);
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const usagePercent = Math.min(
    100,
    Math.round((organization.invoicesThisMonth / organization.monthlyQuota) * 100)
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Settings Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-400" />
            <span>Settings & Financial Policies</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure automated approval thresholds, multi-tier limits, organization profile, and subscription quotas.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('thresholds')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'thresholds'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Approval Thresholds</span>
            {thresholds.autoApprovalEnabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'billing'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Billing & Quota</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Workspace Profile</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* APPROVAL THRESHOLDS VIEW */}
      {/* ======================================================== */}
      {activeTab === 'thresholds' && (
        <div className="space-y-6">
          {/* Admin Role Permission Banner */}
          {!isAdmin ? (
            <div className="bg-amber-950/40 border border-amber-500/50 rounded-xl p-3.5 flex items-center justify-between text-xs text-amber-200">
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Read-Only Access:</strong> You are currently signed in as <strong>{currentUser.name}</strong> ({currentUser.role}). Only administrators can modify financial approval limits and auto-approval policies.
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-amber-900/60 border border-amber-600/60 text-amber-300 text-[11px] font-mono">
                Admin Required
              </span>
            </div>
          ) : (
            <div className="bg-indigo-950/30 border border-indigo-700/50 rounded-xl p-3 flex items-center justify-between text-xs text-indigo-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>Admin Configuration Mode:</strong> Changes saved here will immediately apply to incoming and uploaded invoices across <strong>{organization.name}</strong>.
                </span>
              </div>
              {thresholds.lastUpdatedAt && (
                <span className="text-[11px] text-slate-400 font-mono">
                  Last updated: {new Date(thresholds.lastUpdatedAt).toLocaleDateString()} by {thresholds.lastUpdatedBy || 'Admin'}
                </span>
              )}
            </div>
          )}

          {/* Master Auto-Approval Policy Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg border ${
                    thresholds.autoApprovalEnabled
                      ? 'bg-emerald-950/80 border-emerald-600/60 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                    {thresholds.autoApprovalEnabled ? <Zap className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Low-Value Invoice Auto-Approval</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                        thresholds.autoApprovalEnabled
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/70'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {thresholds.autoApprovalEnabled ? `Active (≤ $${thresholds.autoApprovalLimit})` : 'Disabled'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Automatically approve and authorize low-risk invoices below a specified threshold that pass all deterministic validation tests.
                    </p>
                  </div>
                </div>
              </div>

              {/* Master Toggle */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-300 font-medium">
                  {thresholds.autoApprovalEnabled ? 'Enabled' : 'Disabled'}
                </span>
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => updateThresholdField('autoApprovalEnabled', !thresholds.autoApprovalEnabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    thresholds.autoApprovalEnabled ? 'bg-indigo-600' : 'bg-slate-700'
                  }`}
                  aria-label="Toggle auto-approval"
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      thresholds.autoApprovalEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Threshold Amount Configurator */}
            <div className={`space-y-4 transition-opacity ${thresholds.autoApprovalEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <label className="text-xs font-bold text-white uppercase tracking-wider block">
                    Auto-Approval Threshold Limit ($)
                  </label>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Invoices totaling less than or equal to this dollar amount skip the manual review queue and transition directly to <strong>Approved</strong>.
                  </p>
                </div>

                {/* Number Input */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm font-bold">$</span>
                    <input
                      type="number"
                      disabled={!isAdmin || !thresholds.autoApprovalEnabled}
                      min={0}
                      max={10000}
                      step={50}
                      value={thresholds.autoApprovalLimit}
                      onChange={e => updateThresholdField('autoApprovalLimit', Math.max(0, Number(e.target.value) || 0))}
                      className="bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-sm font-bold font-mono text-white w-32 focus:outline-none focus:border-indigo-500 text-right"
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-mono">USD</span>
                </div>
              </div>

              {/* Range Slider */}
              <div className="space-y-2">
                <input
                  type="range"
                  disabled={!isAdmin || !thresholds.autoApprovalEnabled}
                  min={100}
                  max={2500}
                  step={50}
                  value={thresholds.autoApprovalLimit}
                  onChange={e => updateThresholdField('autoApprovalLimit', Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>$100 (Micro-expenses)</span>
                  <span>$500</span>
                  <span>$1,000 (Standard Limit)</span>
                  <span>$1,750</span>
                  <span>$2,500 (Aggressive Auto)</span>
                </div>
              </div>

              {/* Preset Quick Chips */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-xs text-slate-400 font-medium">Quick Presets:</span>
                {[250, 500, 750, 1000, 1500, 2000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    disabled={!isAdmin || !thresholds.autoApprovalEnabled}
                    onClick={() => updateThresholdField('autoApprovalLimit', amt)}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors cursor-pointer border ${
                      thresholds.autoApprovalLimit === amt
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Multi-Tier Approval Hierarchy Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
            <div>
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Multi-Tiered Financial Approval Hierarchy</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Enforce automatic tier routing based on invoice invoice total to safeguard against unauthorized disbursements.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Tier 1: Autonomous Auto-Approval */}
              <div className="bg-slate-950/70 border border-emerald-800/40 rounded-xl p-4 space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400 uppercase tracking-wider text-[10px]">Tier 1</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-semibold">
                    0 Approvers (Auto)
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Low-Value Autonomous</h4>
                  <p className="font-mono text-emerald-300 font-bold text-xs mt-0.5">
                    $0.01 – ${thresholds.autoApprovalLimit.toFixed(2)}
                  </p>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Invoices beneath this limit skip review queues entirely if deterministic validation passes. Instantly marked ready for ERP batch posting.
                </p>
                <div className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                  <Check className="w-3.5 h-3.5" />
                  <span>No manual reviewer intervention</span>
                </div>
              </div>

              {/* Tier 2: Standard Departmental Approval */}
              <div className="bg-slate-950/70 border border-blue-800/40 rounded-xl p-4 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-400 uppercase tracking-wider text-[10px]">Tier 2</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-700/60 font-semibold">
                    1 Approver Required
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Departmental Sign-Off</h4>
                  <p className="font-mono text-blue-300 font-bold text-xs mt-0.5">
                    ${(thresholds.autoApprovalLimit + 0.01).toFixed(2)} – ${thresholds.managerApprovalLimit.toFixed(2)}
                  </p>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Routine operational spend routed to assigned departmental Approver (Marcus Brody) for verification and line-item confirmation.
                </p>
                <div className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-blue-400 font-medium">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Assigned to Marcus Brody (Approver)</span>
                </div>
              </div>

              {/* Tier 3: Executive Dual Sign-off */}
              <div className="bg-slate-950/70 border border-amber-800/40 rounded-xl p-4 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400 uppercase tracking-wider text-[10px]">Tier 3</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-700/60 font-semibold">
                    Executive Sign-Off
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">High-Value Capital Spend</h4>
                  <p className="font-mono text-amber-300 font-bold text-xs mt-0.5">
                    &gt; ${thresholds.managerApprovalLimit.toFixed(2)}
                  </p>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Large capital expenditures (e.g. Dell hardware procurement, annual software leases) trigger strict approval threshold alerts requiring Finance Director / Admin authorization.
                </p>
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Executive Limit:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500 font-mono">$</span>
                    <input
                      type="number"
                      disabled={!isAdmin}
                      min={1000}
                      max={50000}
                      step={500}
                      value={thresholds.managerApprovalLimit}
                      onChange={e => updateThresholdField('managerApprovalLimit', Math.max(1000, Number(e.target.value) || 5000))}
                      className="w-20 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white font-mono text-right"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Strict Safety Guardrails & Prerequisites */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
            <div>
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Deterministic Safety Guardrails & Validation Prerequisites</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                To prevent fraudulent, mistaken, or duplicate disbursements, auto-approval will ONLY execute if all enabled guardrails pass.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Guardrail 1: Zero Validation Errors */}
              <label className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={thresholds.requireZeroValidationErrors}
                  onChange={e => updateThresholdField('requireZeroValidationErrors', e.target.checked)}
                  className="mt-0.5 accent-indigo-600 rounded"
                />
                <div>
                  <span className="font-semibold text-white block">Strict Arithmetic Balance Required</span>
                  <span className="text-slate-400 text-[11px] leading-relaxed block mt-0.5">
                    Subtotal, calculated tax, discounts, and line totals must balance to 100% precision. Any discrepancy aborts auto-approval.
                  </span>
                </div>
              </label>

              {/* Guardrail 2: Registered & Verified Vendors Only */}
              <label className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={thresholds.requireVerifiedVendor}
                  onChange={e => updateThresholdField('requireVerifiedVendor', e.target.checked)}
                  className="mt-0.5 accent-indigo-600 rounded"
                />
                <div>
                  <span className="font-semibold text-white block">Verified Vendor Registry Only</span>
                  <span className="text-slate-400 text-[11px] leading-relaxed block mt-0.5">
                    Only auto-approve invoices from established suppliers existing in your active Vendor directory. First-time or unknown suppliers require human review.
                  </span>
                </div>
              </label>

              {/* Guardrail 3: Strict Duplicate Prevention Gate */}
              <div className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-950/70 border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white">Double-Payment Scanner (Enforced)</span>
                    <span className="text-[10px] font-mono text-emerald-400 font-semibold bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800/60">
                      Mandatory
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px] leading-relaxed block mt-0.5">
                    Never auto-approves if the scanner detects matching vendor, billing date, and amount or an identical invoice number to protect against duplicate payment.
                  </span>
                </div>
              </div>

              {/* Guardrail 4: Require PO Match */}
              <label className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={thresholds.requirePoMatch}
                  onChange={e => updateThresholdField('requirePoMatch', e.target.checked)}
                  className="mt-0.5 accent-indigo-600 rounded"
                />
                <div>
                  <span className="font-semibold text-white block">Require Purchase Order (PO) Match</span>
                  <span className="text-slate-400 text-[11px] leading-relaxed block mt-0.5">
                    Require an authorized PO number on the invoice before approving autonomously. Non-PO invoices will be held for manual review.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Interactive Policy Simulator & Queue Impact */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Live Routing Simulator */}
            <div className="lg:col-span-6 bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Interactive Policy Routing Simulator</span>
                </h3>
                <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800">
                  Live Preview
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Test any prospective invoice amount and criteria to preview exactly how the approval rules engine will route it.
              </p>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Simulated Invoice Total ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">$</span>
                    <input
                      type="number"
                      step={25}
                      value={simAmount}
                      onChange={e => setSimAmount(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simHasErrors}
                      onChange={e => setSimHasErrors(e.target.checked)}
                      className="accent-indigo-600 rounded"
                    />
                    <span>Has validation errors</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simHasPo}
                      onChange={e => setSimHasPo(e.target.checked)}
                      className="accent-indigo-600 rounded"
                    />
                    <span>Has verified PO</span>
                  </label>
                </div>

                {/* Routing Verdict Box */}
                <div className={`p-4 rounded-xl border space-y-1.5 transition-all ${simulationResult.bg}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Engine Verdict:
                    </span>
                    <span className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-black/40 ${simulationResult.color}`}>
                      {simulationResult.badge}
                    </span>
                  </div>
                  <h4 className={`text-sm font-bold ${simulationResult.color}`}>{simulationResult.tier}</h4>
                  <p className="text-slate-300 text-xs leading-relaxed">{simulationResult.reason}</p>
                </div>
              </div>
            </div>

            {/* Right: Current Pending Queue Impact */}
            <div className="lg:col-span-6 bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                    <Play className="w-4 h-4 text-emerald-400" />
                    <span>Current Queue Impact</span>
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    {pendingInvoices.length} Invoices Pending
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Evaluate how many invoices in your current review queue qualify for auto-approval under this policy limit.
                </p>

                <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Pending Invoices Eligible for Auto-Approval:</span>
                    <span className="font-bold text-emerald-400 font-mono text-sm">
                      {eligibleInvoices.length} of {pendingInvoices.length}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Total Eligible Dollar Amount:</span>
                    <span className="font-bold font-mono text-white text-sm">
                      ${eligibleTotalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {eligibleInvoices.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Qualifying Invoices:</span>
                      {eligibleInvoices.slice(0, 3).map(inv => (
                        <div key={inv.id} className="flex items-center justify-between text-[11px] text-slate-300">
                          <span className="font-mono text-indigo-300">#{inv.invoiceNumber} ({inv.vendorName})</span>
                          <span className="font-mono font-semibold">${inv.totalAmount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {applyResult && (
                  <div className="mt-3 p-2.5 rounded bg-emerald-950/60 border border-emerald-600/60 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{applyResult}</span>
                  </div>
                )}
              </div>

              {/* Action Button: Apply to Current Queue */}
              <div className="pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  disabled={!isAdmin || isApplyingAutoApproval || eligibleInvoices.length === 0}
                  onClick={handleRunAutoApproval}
                  className={`w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                    isAdmin && eligibleInvoices.length > 0
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isApplyingAutoApproval ? 'animate-spin' : ''}`} />
                  <span>
                    {isApplyingAutoApproval
                      ? 'Evaluating & Auto-Approving...'
                      : eligibleInvoices.length > 0
                      ? `Auto-Approve ${eligibleInvoices.length} Eligible Invoice(s) Now`
                      : 'No Pending Invoices Match Threshold'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Sticky / Bottom Action Bar for Saving Thresholds */}
          {isAdmin && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-2">
                {hasChanges ? (
                  <span className="flex items-center gap-1.5 text-xs text-amber-300 font-semibold font-mono">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>Unsaved policy modifications</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Approval policy is up to date and active.</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  disabled={isSavingThresholds}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Reset Defaults</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveThresholds}
                  disabled={!hasChanges || isSavingThresholds}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                    hasChanges
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingThresholds ? 'Saving Changes...' : 'Save Approval Thresholds'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* WORKSPACE PROFILE VIEW */}
      {/* ======================================================== */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>Organization Profile</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">Company / Entity Name</label>
                <input
                  type="text"
                  disabled
                  value={organization.name}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded px-3 py-1.5 text-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">Primary Currency</label>
                <input
                  type="text"
                  disabled
                  value={`${organization.defaultCurrency} (${organization.country})`}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded px-3 py-1.5 text-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">Timezone</label>
                <input
                  type="text"
                  disabled
                  value={organization.timezone}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded px-3 py-1.5 text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Accounting Platform Integrations Quick Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <Link2 className="w-4 h-4 text-indigo-400" />
                <span>Accounting Platform Integrations (QuickBooks Online & Xero)</span>
              </h3>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Connect your General Ledger via OAuth 2.0 to automate bill posting upon invoice approval. Low-value invoices that pass auto-approval thresholds will automatically post into your accounting software.
              </p>
            </div>
            {onNavigateConnections && (
              <button
                onClick={onNavigateConnections}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-sm cursor-pointer"
              >
                <span>Manage Connections</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BILLING & SUBSCRIPTION VIEW */}
      {/* ======================================================== */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          {/* Quota Usage Gauge */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Monthly Processing Usage</span>
              </h3>
              <span className="text-xs font-mono text-slate-300">
                {organization.invoicesThisMonth} of {organization.monthlyQuota} Invoices Processed ({usagePercent}%)
              </span>
            </div>

            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  usagePercent > 80 ? 'bg-amber-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>

            <p className="text-[11px] text-slate-400">
              Quota resets on the 1st of next month. Invoices beyond the limit are queued or billed under flex overage.
            </p>
          </div>

          {/* Subscription Pricing Tiers */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-400" />
              <span>Subscription Plans</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map(plan => {
                const isCurrent = organization.plan === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={`rounded-xl border p-6 flex flex-col justify-between transition-colors relative ${
                      isCurrent
                        ? 'bg-indigo-950/20 border-indigo-500/80'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {plan.popular && (
                      <span className="absolute -top-2.5 right-6 px-2.5 py-0.5 rounded bg-indigo-600 text-white font-semibold text-[10px] tracking-wider uppercase">
                        Recommended
                      </span>
                    )}

                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-bold text-white">{plan.name}</h4>
                        <p className="text-xs text-slate-400 mt-1">{plan.description}</p>
                      </div>

                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold font-mono text-white tabular-nums">
                          {plan.price}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">/{plan.period}</span>
                      </div>

                      <div className="border-t border-slate-800/80 pt-4 space-y-2">
                        <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                          Included in tier:
                        </p>
                        {plan.features.map((feat, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                            <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800/80">
                      <button
                        onClick={() => handleSelectPlan(plan.id as any)}
                        disabled={isCurrent || isUpdatingPlan}
                        className={`w-full py-2 rounded text-xs font-semibold shadow-sm transition-colors ${
                          isCurrent
                            ? 'bg-slate-800 text-indigo-300 border border-slate-700 cursor-default'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                        }`}
                      >
                        {isCurrent ? 'Current Active Tier' : `Switch to ${plan.id}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
