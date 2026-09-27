import React, { useState, useEffect } from 'react';
import {
  Link2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Power,
  Sliders,
  ShieldCheck,
  Building,
  ArrowRight,
  Sparkles,
  Info,
  X,
  FileCheck,
  CheckSquare
} from 'lucide-react';
import { AccountingConnection, GlAccount, Invoice, User } from '../types';

interface AccountingConnectionsViewProps {
  connections: AccountingConnection[];
  glAccounts: GlAccount[];
  invoices: Invoice[];
  currentUser: User;
  onRefreshConnections: () => Promise<void>;
  onTriggerSync: (connectionId: string) => Promise<{ syncedCount: number; syncedTotal: number }>;
  onDisconnect: (connectionId: string) => Promise<void>;
  onUpdateSettings: (
    connectionId: string,
    settings: { autoSyncOnApproval?: boolean; defaultApAccountId?: string; syncFrequency?: any }
  ) => Promise<void>;
  onSimulateConnect: (provider: string, companyName?: string, externalCompanyId?: string) => Promise<void>;
}

export const AccountingConnectionsView: React.FC<AccountingConnectionsViewProps> = ({
  connections,
  glAccounts,
  invoices,
  currentUser,
  onRefreshConnections,
  onTriggerSync,
  onDisconnect,
  onUpdateSettings,
  onSimulateConnect,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [activeSettingsConn, setActiveSettingsConn] = useState<AccountingConnection | null>(null);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Listen for OAuth popup completion
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin for preview or localhost
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }

      if (event.data?.type === 'ACCOUNTING_OAUTH_SUCCESS') {
        setShowConnectModal(false);
        onRefreshConnections();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onRefreshConnections]);

  const handleLaunchOAuth = async (provider: string) => {
    setIsConnecting(true);
    try {
      const res = await fetch(`/api/accounting/oauth/url?provider=${provider}`);
      if (!res.ok) throw new Error('Failed to obtain authorization URL');
      const data = await res.json();

      // Open OAuth provider directly in popup window per oauth-integration guidelines
      const popup = window.open(
        data.url,
        'accounting_oauth_popup',
        'width=650,height=750,left=200,top=100'
      );

      if (!popup) {
        alert('Please allow popups to authenticate with your accounting provider.');
      }
    } catch (err: any) {
      alert('OAuth initialization error: ' + err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSimulateQuickConnect = async (provider: string) => {
    setIsConnecting(true);
    try {
      await onSimulateConnect(provider);
      setShowConnectModal(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSyncBills = async (connectionId: string) => {
    setIsSyncing(connectionId);
    setSyncFeedback(null);
    try {
      const res = await onTriggerSync(connectionId);
      setSyncFeedback(
        `Successfully posted ${res.syncedCount} approved vendor bill(s) ($${res.syncedTotal.toFixed(
          2
        )}) to accounting ledger.`
      );
    } catch (err: any) {
      setSyncFeedback('Sync error: ' + (err.message || 'Failed to sync bills'));
    } finally {
      setIsSyncing(null);
    }
  };

  const approvedInvoicesCount = invoices.filter(i => i.businessStatus === 'Approved').length;

  const providers = [
    {
      id: 'quickbooks',
      name: 'QuickBooks Online',
      logo: 'https://plugin-icons.make.com/quickbooks.png',
      badge: 'Most Popular for SMBs',
      description: 'Intuit QuickBooks Online OAuth 2.0 direct connection. Automatically posts approved bills to Accounts Payable, links line item expenses, and synchronizes chart of accounts.',
      authScopes: 'com.intuit.quickbooks.accounting',
      docUrl: 'https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0',
    },
    {
      id: 'xero',
      name: 'Xero Cloud Accounting',
      logo: 'https://plugin-icons.make.com/xero.png',
      badge: 'Global & UK/EU Standard',
      description: 'Official Xero Identity OAuth 2.0 flow. Synchronizes supplier bills, invoice attachments, tax codes, and multi-currency exchange adjustments into Xero Bills to Pay.',
      authScopes: 'accounting.transactions accounting.settings offline_access',
      docUrl: 'https://developer.xero.com/documentation/guides/oauth2/overview/',
    },
    {
      id: 'netsuite',
      name: 'Oracle NetSuite',
      logo: 'https://plugin-icons.make.com/netsuite.png',
      badge: 'Enterprise ERP',
      description: 'Enterprise NetSuite SuiteTalk REST Web Services & Token-Based Authentication. Posts bills directly into subsidiary vendor records with department and class dimensions.',
      authScopes: 'rest_webservices suiteanalytics_connect',
      docUrl: 'https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/',
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <Link2 className="w-4 h-4 text-indigo-400" />
            <span>Accounting System Connections & Automated Bill Sync</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Authorize your cloud accounting platform once via OAuth 2.0. Approved supplier invoices are automatically posted as formal <strong>Vendor Bills</strong> (never loose journal entries).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {approvedInvoicesCount > 0 ? (
            <span className="text-xs text-amber-300 bg-amber-950/40 border border-amber-800/40 px-3 py-1 rounded font-mono">
              {approvedInvoicesCount} approved bill(s) ready to sync
            </span>
          ) : (
            <span className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1 rounded font-mono">
              All approved bills synchronized
            </span>
          )}
        </div>
      </div>

      {/* Sync Status Feedback Toast */}
      {syncFeedback && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
          <button
            onClick={() => setSyncFeedback(null)}
            className="text-slate-400 hover:text-white text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Provider Connection Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {providers.map(prov => {
          const conn = connections.find(c => c.provider === prov.id);
          const isConnected = conn && conn.status === 'connected';

          return (
            <div
              key={prov.id}
              className={`rounded-xl border p-5 flex flex-col justify-between transition-colors relative ${
                isConnected
                  ? 'bg-indigo-950/20 border-indigo-500/80 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-slate-800 text-indigo-300">
                      {prov.badge}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1.5">{prov.name}</h3>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-600'
                      }`}
                    />
                    <span
                      className={`text-xs font-mono font-medium ${
                        isConnected ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {isConnected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-4">{prov.description}</p>

                {isConnected && conn && (
                  <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-1.5 text-xs mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Linked Entity:</span>
                      <span className="font-semibold text-white truncate max-w-[180px]">
                        {conn.companyName || 'Company Connected'}
                      </span>
                    </div>
                    {conn.externalCompanyId && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-mono">Company / Realm ID:</span>
                        <span className="font-mono text-slate-300">{conn.externalCompanyId}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-mono">Auto-Sync On Approval:</span>
                      <span className={`font-mono ${conn.autoSyncOnApproval ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {conn.autoSyncOnApproval ? 'Active (Instant)' : 'Manual Sync'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-mono">Total Bills Synced:</span>
                      <span className="font-mono font-bold text-white">{conn.syncedBillsCount} bills</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-slate-800 flex flex-col gap-2">
                {isConnected && conn ? (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSyncBills(conn.id)}
                        disabled={isSyncing === conn.id}
                        className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing === conn.id ? 'animate-spin' : ''}`} />
                        <span>{isSyncing === conn.id ? 'Posting Bills...' : 'Sync Approved Bills'}</span>
                      </button>

                      <button
                        onClick={() => setActiveSettingsConn(conn)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
                        title="Configure Sync & Account Settings"
                      >
                        <Sliders className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={() => onDisconnect(conn.id)}
                      className="w-full py-1 text-slate-400 hover:text-rose-400 text-[11px] font-medium transition-colors"
                    >
                      Disconnect Integration
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedProvider(prov.id);
                      setShowConnectModal(true);
                    }}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Connect {prov.name}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Architectural Guarantee Box: Why We Record as Bills */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Accounting Best Practice: Vendor Bills vs. Journal Entries</span>
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          Acanty syncs directly to your accounting provider’s <strong>Bill (Vendor Bill)</strong> subledger instead of creating loose journal entries.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-1">
          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg">
            <p className="font-semibold text-indigo-300 mb-1">A/P Aging & Subledger</p>
            <p className="text-slate-400 text-[11px]">
              Bills automatically populate the Accounts Payable Aging reports (Current, 30, 60, 90+ days), giving management accurate cash flow views.
            </p>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg">
            <p className="font-semibold text-indigo-300 mb-1">Bank Reconciliation & Pay Bills</p>
            <p className="text-slate-400 text-[11px]">
              When bills are settled via bank transfer, check, or credit card, QuickBooks and Xero automatically match payments to the open Bill record.
            </p>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg">
            <p className="font-semibold text-indigo-300 mb-1">Double-Entry Integrity</p>
            <p className="text-slate-400 text-[11px]">
              QuickBooks automatically performs the exact accounting entry: <strong>Debit</strong> GL Expense accounts per line item, and <strong>Credit</strong> A/P Clearing liability.
            </p>
          </div>
        </div>
      </div>

      {/* OAuth Connection Modal */}
      {showConnectModal && selectedProvider && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#101726] border border-slate-700 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">
                  Connect {providers.find(p => p.id === selectedProvider)?.name}
                </h3>
              </div>
              <button
                onClick={() => setShowConnectModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <p className="leading-relaxed">
                Connect your organization to sync approved bills, chart of accounts, and payment terms in real time.
              </p>

              {/* Method 1: Live OAuth 2.0 Popup Flow */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Method 1: Live OAuth 2.0 Authorization</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                    Production
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Opens the official {selectedProvider === 'quickbooks' ? 'Intuit App Center' : 'Xero'} authorization page directly in a secure popup window.
                </p>

                <div className="text-[11px] font-mono text-slate-400 bg-slate-900 p-2 rounded border border-slate-800 overflow-x-auto">
                  <span>Redirect Callback URI: </span>
                  <code className="text-indigo-300">
                    {window.location.origin}/auth/accounting/callback
                  </code>
                </div>

                <button
                  onClick={() => handleLaunchOAuth(selectedProvider)}
                  disabled={isConnecting}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Launch {providers.find(p => p.id === selectedProvider)?.name} OAuth</span>
                </button>
              </div>

              {/* Method 2: Instant Sandbox / Simulator Connect */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Method 2: 1-Click Sandbox Test Connection</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Instant Demo
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Instantly simulates a successful OAuth handshake with demo company credentials ({selectedProvider === 'quickbooks' ? 'QBO Sandbox Realm #93414520934123' : 'Xero Demo Org'}) so you can test end-to-end bill syncing immediately.
                </p>

                <button
                  onClick={() => handleSimulateQuickConnect(selectedProvider)}
                  disabled={isConnecting}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Activate Sandbox Demo Connection</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Configuration Drawer Modal */}
      {activeSettingsConn && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#101726] border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>{activeSettingsConn.providerName} Sync Settings</span>
              </h3>
              <button
                onClick={() => setActiveSettingsConn(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">
                  Default Accounts Payable Liability GL Account
                </label>
                <select
                  value={activeSettingsConn.defaultApAccountId || 'gl-2000'}
                  onChange={e =>
                    onUpdateSettings(activeSettingsConn.id, {
                      defaultApAccountId: e.target.value,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                >
                  {glAccounts
                    .filter(g => g.type === 'Liability' || g.code.startsWith('2'))
                    .map(g => (
                      <option key={g.id} value={g.id}>
                        {g.code} - {g.name}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Credit entry account credited when new bills are recorded.
                </p>
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Sync Cadence</label>
                <select
                  value={activeSettingsConn.syncFrequency || 'instant'}
                  onChange={e =>
                    onUpdateSettings(activeSettingsConn.id, {
                      syncFrequency: e.target.value,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="instant">Instant (Immediately upon final invoice approval)</option>
                  <option value="hourly">Hourly Batch Sync</option>
                  <option value="daily">Daily End-of-Day Batch</option>
                  <option value="manual">Manual Execution Only</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                <div>
                  <p className="font-semibold text-white">Auto-Sync On Approval</p>
                  <p className="text-[11px] text-slate-400">
                    Automatically trigger bill creation in {activeSettingsConn.providerName} when approved.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={activeSettingsConn.autoSyncOnApproval}
                  onChange={e =>
                    onUpdateSettings(activeSettingsConn.id, {
                      autoSyncOnApproval: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setActiveSettingsConn(null)}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
