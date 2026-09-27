import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { InvoiceListView } from './components/InvoiceListView';
import { InvoiceReviewModal } from './components/InvoiceReviewModal';
import { UploadModal } from './components/UploadModal';
import { ApprovalQueueView } from './components/ApprovalQueueView';
import { ExportCenterView } from './components/ExportCenterView';
import { VendorsView } from './components/VendorsView';
import { ChartOfAccountsView } from './components/ChartOfAccountsView';
import { ReportsView } from './components/ReportsView';
import { AuditTrailView } from './components/AuditTrailView';
import { SettingsBillingView } from './components/SettingsBillingView';
import { AccountingConnectionsView } from './components/AccountingConnectionsView';
import { VendorPortalView } from './components/VendorPortalView';
import { Organization, User, Invoice, Vendor, GlAccount, AuditEvent, ExportRecord, AccountingConnection, ApprovalThresholds } from './types';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data State
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [glAccounts, setGlAccounts] = useState<GlAccount[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [exportRecords, setExportRecords] = useState<ExportRecord[]>([]);
  const [connections, setConnections] = useState<AccountingConnection[]>([]);

  // Modals & UI State
  const [activeReviewInvoice, setActiveReviewInvoice] = useState<Invoice | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load initial data
  const loadInitialData = async () => {
    try {
      const [sessRes, invRes, venRes, glRes, audRes, expRes, connRes] = await Promise.all([
        fetch('/api/session'),
        fetch('/api/invoices'),
        fetch('/api/vendors'),
        fetch('/api/gl-accounts'),
        fetch('/api/audit-events'),
        fetch('/api/exports'),
        fetch('/api/accounting/connections'),
      ]);

      if (sessRes.ok) {
        const sessData = await sessRes.json();
        setOrganization(sessData.organization);
        setOrganizations(sessData.organizations);
        setCurrentUser(sessData.user);
        if (sessData.users) setUsers(sessData.users);
      }

      if (invRes.ok) {
        const invData = await invRes.json();
        setInvoices(invData.invoices);
      }

      if (venRes.ok) {
        const venData = await venRes.json();
        setVendors(venData.vendors);
      }

      if (glRes.ok) {
        const glData = await glRes.json();
        setGlAccounts(glData.glAccounts);
      }

      if (audRes.ok) {
        const audData = await audRes.json();
        setAuditEvents(audData.auditEvents);
      }

      if (expRes.ok) {
        const expData = await expRes.json();
        setExportRecords(expData.exportRecords);
      }

      if (connRes.ok) {
        const connData = await connRes.json();
        setConnections(connData.connections);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Organization switch
  const handleSwitchOrg = async (orgId: string) => {
    try {
      const res = await fetch('/api/session/switch-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      });
      if (res.ok) {
        await loadInitialData();
        showToast('Switched organization workspace.');
      }
    } catch (err) {
      showToast('Failed to switch workspace', 'error');
    }
  };

  // Role switch
  const handleSwitchRole = async (role: User['role']) => {
    try {
      const res = await fetch('/api/session/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        showToast(`Role updated to ${role} (Testing permissions)`);
      }
    } catch (err) {
      showToast('Failed to switch role', 'error');
    }
  };

  // Invoice Save
  const handleSaveInvoice = async (updated: Invoice) => {
    try {
      const res = await fetch(`/api/invoices/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(prev => prev.map(i => (i.id === data.invoice.id ? data.invoice : i)));
        setActiveReviewInvoice(data.invoice);
        showToast(`Saved changes for invoice #${data.invoice.invoiceNumber}`);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save invoice', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error');
    }
  };

  // Submit for Approval
  const handleSubmitApproval = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/submit-approval`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(prev => prev.map(i => (i.id === data.invoice.id ? data.invoice : i)));
        showToast(`Invoice #${data.invoice.invoiceNumber} submitted for authorization`);
      } else {
        const err = await res.json();
        showToast(err.error || 'Submission failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Submission failed', 'error');
    }
  };

  // Approve Invoice
  const handleApproveInvoice = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/approve`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(prev => prev.map(i => (i.id === data.invoice.id ? data.invoice : i)));
        showToast(`Invoice #${data.invoice.invoiceNumber} approved for payment`);
      } else {
        const err = await res.json();
        showToast(err.error || 'Approval failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Approval failed', 'error');
    }
  };

  // Reject Invoice
  const handleRejectInvoice = async (invoiceId: string, reason: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(prev => prev.map(i => (i.id === data.invoice.id ? data.invoice : i)));
        showToast(`Invoice #${data.invoice.invoiceNumber} rejected: ${reason}`, 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Rejection failed', 'error');
    }
  };

  // Bulk Approve Invoices
  const handleBulkApproveInvoices = async (invoiceIds: string[]) => {
    try {
      const res = await fetch('/api/invoices/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds }),
      });
      if (res.ok) {
        const data = await res.json();
        const updatedMap = new Map<string, Invoice>(data.invoices.map((i: Invoice) => [i.id, i]));
        setInvoices(prev => prev.map(i => updatedMap.get(i.id) || i));
        showToast(`Approved ${data.updatedCount} invoice(s) for payment`);
      } else {
        const err = await res.json();
        showToast(err.error || 'Bulk approval failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Bulk approval failed', 'error');
    }
  };

  // Bulk Reject Invoices
  const handleBulkRejectInvoices = async (invoiceIds: string[], reason: string) => {
    try {
      const res = await fetch('/api/invoices/bulk-reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds, reason }),
      });
      if (res.ok) {
        const data = await res.json();
        const updatedMap = new Map<string, Invoice>(data.invoices.map((i: Invoice) => [i.id, i]));
        setInvoices(prev => prev.map(i => updatedMap.get(i.id) || i));
        showToast(`Rejected ${data.updatedCount} invoice(s): ${reason}`, 'error');
      } else {
        const err = await res.json();
        showToast(err.error || 'Bulk rejection failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Bulk rejection failed', 'error');
    }
  };

  // Batch Export
  const handleBatchExport = async (invoiceIds: string[], format: 'CSV' | 'XLSX') => {
    try {
      const res = await fetch('/api/exports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds, format }),
      });
      if (res.ok) {
        const data = await res.json();
        setExportRecords(prev => [data.exportRecord, ...prev]);
        // Update local invoice statuses
        setInvoices(prev =>
          prev.map(i =>
            invoiceIds.includes(i.id) ? { ...i, businessStatus: 'Exported', exportBatchId: data.exportRecord.id } : i
          )
        );
        // Trigger download
        window.location.href = data.downloadUrl;
        showToast(`Exported ${invoiceIds.length} invoice(s) as ${format}`);
      } else {
        const err = await res.json();
        showToast(err.error || 'Export generation failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Export failed', 'error');
    }
  };

  // Add Vendor
  const handleAddVendor = async (vendorData: Partial<Vendor>) => {
    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendorData),
      });
      if (res.ok) {
        const data = await res.json();
        setVendors(prev => [data.vendor, ...prev]);
        showToast(`Added vendor ${data.vendor.name}`);
      }
    } catch (err) {
      showToast('Failed to add vendor', 'error');
    }
  };

  // Add GL Account
  const handleAddGlAccount = async (glData: { code: string; name: string; type: GlAccount['type'] }) => {
    try {
      const res = await fetch('/api/gl-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(glData),
      });
      if (res.ok) {
        const data = await res.json();
        setGlAccounts(prev => [...prev, data.glAccount]);
        showToast(`Added GL account ${data.glAccount.code} - ${data.glAccount.name}`);
      }
    } catch (err) {
      showToast('Failed to add GL account', 'error');
    }
  };

  // Update Plan
  const handleUpdatePlan = async (plan: Organization['plan']) => {
    try {
      const res = await fetch('/api/billing/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrganization(data.organization);
        showToast(`Subscription tier upgraded to ${plan}`);
      }
    } catch (err) {
      showToast('Failed to update plan', 'error');
    }
  };

  // Update Approval Thresholds
  const handleUpdateApprovalThresholds = async (thresholds: Partial<ApprovalThresholds>) => {
    try {
      const res = await fetch('/api/organization/approval-thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(thresholds),
      });
      if (res.ok) {
        const data = await res.json();
        setOrganization(data.organization);
        showToast('Approval thresholds updated successfully');
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update approval thresholds', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update approval thresholds', 'error');
    }
  };

  // Run Auto-Approval on Pending Invoices
  const handleApplyAutoApproval = async () => {
    try {
      const res = await fetch('/api/invoices/apply-auto-approval', {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.updatedCount > 0) {
          const updatedMap = new Map<string, Invoice>(data.invoices.map((i: Invoice) => [i.id, i]));
          setInvoices(prev => prev.map(i => updatedMap.get(i.id) || i));
          showToast(`Autonomous approval executed: ${data.updatedCount} low-value invoice(s) approved!`);
        } else {
          showToast('No pending invoices qualified under current threshold policy');
        }
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to apply auto-approval', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to apply auto-approval', 'error');
    }
  };

  // Accounting Connections Handlers
  const handleRefreshConnections = async () => {
    try {
      const [connRes, invRes, audRes] = await Promise.all([
        fetch('/api/accounting/connections'),
        fetch('/api/invoices'),
        fetch('/api/audit-events'),
      ]);
      if (connRes.ok) {
        const data = await connRes.json();
        setConnections(data.connections);
      }
      if (invRes.ok) {
        const invData = await invRes.json();
        setInvoices(invData.invoices);
      }
      if (audRes.ok) {
        const audData = await audRes.json();
        setAuditEvents(audData.auditEvents);
      }
    } catch (err) {
      console.error('Failed to refresh connections:', err);
    }
  };

  const handleTriggerSync = async (connectionId: string) => {
    const res = await fetch(`/api/accounting/connections/${connectionId}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to sync bills');
    }
    const data = await res.json();
    await handleRefreshConnections();
    showToast(`Successfully posted ${data.syncedCount} bill(s) to ${data.connection.providerName}`);
    return { syncedCount: data.syncedCount, syncedTotal: data.syncedTotal };
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      const res = await fetch(`/api/accounting/connections/${connectionId}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        await handleRefreshConnections();
        showToast('Accounting provider disconnected');
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to disconnect', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Disconnect failed', 'error');
    }
  };

  const handleUpdateConnectionSettings = async (
    connectionId: string,
    settings: { autoSyncOnApproval?: boolean; defaultApAccountId?: string; syncFrequency?: any }
  ) => {
    try {
      const res = await fetch(`/api/accounting/connections/${connectionId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        await handleRefreshConnections();
        showToast('Accounting sync settings updated');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update settings', 'error');
    }
  };

  const handleSimulateConnect = async (provider: string, companyName?: string, externalCompanyId?: string) => {
    try {
      const res = await fetch('/api/accounting/oauth/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, companyName, externalCompanyId }),
      });
      if (res.ok) {
        await handleRefreshConnections();
        const provName = provider === 'quickbooks' ? 'QuickBooks Online' : provider === 'xero' ? 'Xero' : 'NetSuite';
        showToast(`Connected ${provName} Sandbox successfully!`);
      } else {
        const err = await res.json();
        showToast(err.error || 'Connection failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Connection failed', 'error');
    }
  };

  const handleSyncSingleBill = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/sync-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(prev => prev.map(i => (i.id === data.invoice.id ? data.invoice : i)));
        await handleRefreshConnections();
        showToast(`Posted bill #${data.invoice.invoiceNumber} to ${data.invoice.accountingProvider} (${data.externalRecordId})`);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to sync bill', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Sync failed', 'error');
    }
  };

  const handleNavigateTab = (tab: string, filterStatus?: string) => {
    setCurrentTab(tab);
    if (filterStatus) {
      setInvoiceStatusFilter(filterStatus);
    }
  };

  if (!organization || !currentUser) {
    return (
      <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center text-slate-400 font-mono text-xs">
        Initializing Acanty Accounts Payable Platform...
      </div>
    );
  }

  const needsReviewCount = invoices.filter(i => i.businessStatus === 'Needs Review').length;
  const pendingApprovalCount = invoices.filter(i => i.businessStatus === 'Pending Approval').length;

  return (
    <div className="flex h-screen bg-[#0b0f17] overflow-hidden text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg border shadow-xl flex items-center gap-2.5 text-xs font-medium transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-700/80 text-emerald-200'
              : 'bg-rose-950/90 border-rose-700/80 text-rose-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={tab => {
          setCurrentTab(tab);
          if (tab === 'invoices') setInvoiceStatusFilter('all');
        }}
        organization={organization}
        organizations={organizations}
        onSwitchOrg={handleSwitchOrg}
        currentUser={currentUser}
        onSwitchRole={handleSwitchRole}
        needsReviewCount={needsReviewCount}
        pendingApprovalCount={pendingApprovalCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          onOpenUpload={() => setIsUploadOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          pendingApprovalsCount={pendingApprovalCount}
        />

        {/* View Routing */}
        <main className="flex-1 overflow-y-auto bg-[#090d15]">
          {currentTab === 'dashboard' && (
            <DashboardView
              invoices={invoices}
              auditEvents={auditEvents}
              organization={organization}
              glAccounts={glAccounts}
              vendors={vendors}
              onNavigateTab={handleNavigateTab}
              onOpenReview={inv => setActiveReviewInvoice(inv)}
              onOpenUpload={() => setIsUploadOpen(true)}
            />
          )}

          {currentTab === 'invoices' && (
            <InvoiceListView
              invoices={invoices}
              initialStatusFilter={invoiceStatusFilter}
              onOpenReview={inv => setActiveReviewInvoice(inv)}
              onOpenUpload={() => setIsUploadOpen(true)}
              onBatchExport={handleBatchExport}
              onBulkApprove={handleBulkApproveInvoices}
              onBulkReject={handleBulkRejectInvoices}
              currentUser={currentUser}
              searchQuery={searchQuery}
              connections={connections}
              onSyncSingleBill={handleSyncSingleBill}
            />
          )}

          {currentTab === 'approvals' && (
            <ApprovalQueueView
              invoices={invoices}
              currentUser={currentUser}
              onOpenReview={inv => setActiveReviewInvoice(inv)}
              onApprove={handleApproveInvoice}
              onReject={handleRejectInvoice}
            />
          )}

          {currentTab === 'vendors' && (
            <VendorsView
              vendors={vendors}
              glAccounts={glAccounts}
              invoices={invoices}
              onAddVendor={handleAddVendor}
              onSelectVendorInvoices={vendorName => {
                setSearchQuery(vendorName);
                setCurrentTab('invoices');
              }}
              onOpenVendorPortal={() => setCurrentTab('vendor-portal')}
            />
          )}

          {currentTab === 'vendor-portal' && (
            <VendorPortalView
              vendors={vendors}
              invoices={invoices}
              organization={organization}
              onInvoiceSubmitted={newInv => {
                setInvoices(prev => [newInv, ...prev]);
                showToast(`Invoice #${newInv.invoiceNumber} submitted successfully to Accounts Payable`);
              }}
              onNavigateInvoices={() => setCurrentTab('invoices')}
            />
          )}

          {currentTab === 'gl-accounts' && (
            <ChartOfAccountsView
              glAccounts={glAccounts}
              onAddGlAccount={handleAddGlAccount}
            />
          )}

          {currentTab === 'connections' && (
            <AccountingConnectionsView
              connections={connections}
              glAccounts={glAccounts}
              invoices={invoices}
              currentUser={currentUser}
              onRefreshConnections={handleRefreshConnections}
              onTriggerSync={handleTriggerSync}
              onDisconnect={handleDisconnect}
              onUpdateSettings={handleUpdateConnectionSettings}
              onSimulateConnect={handleSimulateConnect}
            />
          )}

          {currentTab === 'exports' && (
            <ExportCenterView
              invoices={invoices}
              exportRecords={exportRecords}
              onGenerateExport={handleBatchExport}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsView
              invoices={invoices}
              organization={organization}
              glAccounts={glAccounts}
              vendors={vendors}
            />
          )}

          {currentTab === 'audit' && (
            <AuditTrailView auditEvents={auditEvents} />
          )}

          {currentTab === 'settings' && (
            <SettingsBillingView
              organization={organization}
              currentUser={currentUser}
              invoices={invoices}
              vendors={vendors}
              onUpdatePlan={handleUpdatePlan}
              onUpdateApprovalThresholds={handleUpdateApprovalThresholds}
              onApplyAutoApproval={handleApplyAutoApproval}
              onNavigateConnections={() => setCurrentTab('connections')}
            />
          )}
        </main>
      </div>

      {/* Invoice Review & Correction Split Modal */}
      {activeReviewInvoice && (
        <InvoiceReviewModal
          invoice={activeReviewInvoice}
          isOpen={!!activeReviewInvoice}
          onClose={() => setActiveReviewInvoice(null)}
          onSave={handleSaveInvoice}
          onSubmitApproval={handleSubmitApproval}
          onApprove={handleApproveInvoice}
          onReject={handleRejectInvoice}
          vendors={vendors}
          glAccounts={glAccounts}
          currentUser={currentUser}
          users={users}
          auditEvents={auditEvents}
        />
      )}

      {/* Upload & Extraction Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onInvoiceCreated={newInv => {
          setInvoices(prev => [newInv, ...prev]);
          if (organization) {
            setOrganization(prev => prev ? { ...prev, invoicesThisMonth: prev.invoicesThisMonth + 1 } : null);
          }
          setActiveReviewInvoice(newInv);
          showToast(`Invoice #${newInv.invoiceNumber} extracted and ready for review`);
        }}
      />
    </div>
  );
}
