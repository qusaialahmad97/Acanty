import React, { useState } from 'react';
import {
  CheckSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Check,
  Ban,
  AlertTriangle,
  Building,
  UserCheck,
  ShieldAlert
} from 'lucide-react';
import { Invoice, User } from '../types';

interface ApprovalQueueViewProps {
  invoices: Invoice[];
  currentUser: User;
  onOpenReview: (invoice: Invoice) => void;
  onApprove: (invoiceId: string) => Promise<void>;
  onReject: (invoiceId: string, reason: string) => Promise<void>;
}

export const ApprovalQueueView: React.FC<ApprovalQueueViewProps> = ({
  invoices,
  currentUser,
  onOpenReview,
  onApprove,
  onReject,
}) => {
  const [filterState, setFilterState] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [activeRejectId, setActiveRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const pendingList = invoices.filter(i => i.businessStatus === 'Pending Approval');
  const approvedList = invoices.filter(i => i.businessStatus === 'Approved' || i.businessStatus === 'Exported');
  const rejectedList = invoices.filter(i => i.businessStatus === 'Rejected');

  const displayedList =
    filterState === 'pending'
      ? pendingList
      : filterState === 'approved'
      ? approvedList
      : rejectedList;

  const canApprove = currentUser.role === 'Admin' || currentUser.role === 'Approver';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-indigo-400" />
            <span>Financial Authorization & Approval Queue</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Formal multi-tier approval workflow for supplier invoices before accounting sync.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setFilterState('pending')}
            className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
              filterState === 'pending'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Pending Sign-off ({pendingList.length})</span>
          </button>
          <button
            onClick={() => setFilterState('approved')}
            className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
              filterState === 'approved'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Approved ({approvedList.length})</span>
          </button>
          <button
            onClick={() => setFilterState('rejected')}
            className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
              filterState === 'rejected'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <XCircle className="w-3 h-3" />
            <span>Rejected ({rejectedList.length})</span>
          </button>
        </div>
      </div>

      {!canApprove && (
        <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg flex items-center gap-2 text-xs text-amber-300">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>
            You are logged in with the <strong>{currentUser.role}</strong> role. Only <strong>Approvers</strong> or <strong>Admins</strong> can authorize invoices. Switch role in the sidebar to test.
          </span>
        </div>
      )}

      {/* Invoices List for Approvers */}
      <div className="space-y-3">
        {displayedList.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
            <p className="text-xs">No invoices currently in the {filterState} state.</p>
          </div>
        ) : (
          displayedList.map(inv => (
            <div
              key={inv.id}
              className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded bg-slate-800 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-bold font-mono text-white">#{inv.invoiceNumber}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-xs font-semibold text-slate-200">{inv.vendorName}</span>
                    {inv.totalAmount > 5000 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
                        High Value Threshold (&gt;$5,000)
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 mt-1">
                    Submitted by <strong className="text-slate-300">{inv.uploaderName || 'Sarah Chen'}</strong> · Assigned to <strong className="text-slate-300">{inv.assignedApproverName || 'Marcus Brody'}</strong>
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-1.5">
                    <span>Invoice Date: {inv.invoiceDate}</span>
                    <span>·</span>
                    <span>Due: {inv.dueDate}</span>
                    <span>·</span>
                    <span>{inv.lines.length} Line item(s)</span>
                  </div>

                  {inv.rejectionReason && (
                    <p className="text-xs text-rose-300 bg-rose-950/40 p-2 rounded mt-2 border border-rose-900/40">
                      Rejection Reason: {inv.rejectionReason}
                    </p>
                  )}
                </div>
              </div>

              {/* Amount and Approver Actions */}
              <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
                <div className="text-right">
                  <p className="text-base font-bold font-mono text-white tabular-nums">
                    ${inv.totalAmount.toFixed(2)}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">{inv.currency}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenReview(inv)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Audit Review</span>
                  </button>

                  {filterState === 'pending' && canApprove && (
                    <>
                      <button
                        onClick={() => setActiveRejectId(inv.id)}
                        className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-200 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                      <button
                        onClick={() => onApprove(inv.id)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reject Modal */}
      {activeRejectId && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-700 rounded-lg p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Ban className="w-4 h-4 text-rose-400" />
              <span>Reject Financial Authorization</span>
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Provide feedback for why this invoice cannot be authorized. It will be sent back to review.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Line pricing discrepancy, requires revised vendor quote, tax rate mismatch..."
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-rose-500 mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setActiveRejectId(null);
                  setRejectReason('');
                }}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onReject(activeRejectId, rejectReason);
                  setActiveRejectId(null);
                  setRejectReason('');
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
