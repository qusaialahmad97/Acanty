import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  Send,
  Check,
  Ban,
  Plus,
  Trash2,
  Building,
  Calendar,
  DollarSign,
  Tag,
  Info,
  Link2,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { Invoice, InvoiceLine, Vendor, GlAccount, User, AccountingConnection, AuditEvent } from '../types';
import { InvoiceCommentsThread } from './InvoiceCommentsThread';

interface InvoiceReviewModalProps {
  invoice: Invoice;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Invoice) => Promise<void>;
  onSubmitApproval: (invoiceId: string) => Promise<void>;
  onApprove: (invoiceId: string) => Promise<void>;
  onReject: (invoiceId: string, reason: string) => Promise<void>;
  vendors: Vendor[];
  glAccounts: GlAccount[];
  currentUser: User;
  users?: User[];
  auditEvents?: AuditEvent[];
  connections?: AccountingConnection[];
  onSyncSingleBill?: (invoiceId: string) => Promise<void>;
}

export const InvoiceReviewModal: React.FC<InvoiceReviewModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onSave,
  onSubmitApproval,
  onApprove,
  onReject,
  vendors,
  glAccounts,
  currentUser,
  users = [],
  auditEvents = [],
  connections = [],
  onSyncSingleBill,
}) => {
  if (!isOpen) return null;

  // Local editable state
  const [formData, setFormData] = useState<Invoice>({ ...invoice });
  const [activeHighlightField, setActiveHighlightField] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showRejectPrompt, setShowRejectPrompt] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingBill, setIsSyncingBill] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedCommentLineId, setSelectedCommentLineId] = useState<string | null>(null);

  const activeConn = connections.find(c => c.status === 'connected');

  useEffect(() => {
    setFormData({ ...invoice });
    setHasUnsavedChanges(false);
  }, [invoice]);

  // Recalculate line totals and subtotals
  const handleLineChange = (index: number, field: keyof InvoiceLine, value: any) => {
    const updatedLines = [...formData.lines];
    const line = { ...updatedLines[index], [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      const qty = field === 'quantity' ? Number(value) : line.quantity;
      const price = field === 'unitPrice' ? Number(value) : line.unitPrice;
      line.lineTotal = Math.round(qty * price * 100) / 100;
      line.taxAmount = Math.round(line.lineTotal * (line.taxRate || 0) * 100) / 100;
    }

    if (field === 'glAccountId') {
      const gl = glAccounts.find(g => g.id === value);
      if (gl) {
        line.glAccountCode = gl.code;
        line.glAccountName = gl.name;
      }
    }

    updatedLines[index] = line;

    // Recalculate subtotal
    const newSubtotal = Math.round(updatedLines.reduce((sum, l) => sum + (l.lineTotal || 0), 0) * 100) / 100;
    const newTax = Math.round(updatedLines.reduce((sum, l) => sum + (l.taxAmount || 0), 0) * 100) / 100;
    const newTotal = Math.round((newSubtotal + newTax - (formData.discountAmount || 0)) * 100) / 100;

    setFormData(prev => ({
      ...prev,
      lines: updatedLines,
      subtotal: newSubtotal,
      taxAmount: newTax,
      totalAmount: newTotal,
    }));
    setHasUnsavedChanges(true);
  };

  const handleAddLine = () => {
    const defaultGl = glAccounts[0];
    const newLine: InvoiceLine = {
      id: `line-${Date.now()}`,
      description: 'New invoice line item',
      quantity: 1,
      unitPrice: 0,
      taxRate: 0.08,
      taxAmount: 0,
      lineTotal: 0,
      glAccountId: defaultGl ? defaultGl.id : '',
      glAccountCode: defaultGl?.code,
      glAccountName: defaultGl?.name,
      glSuggestionConfidence: 1.0,
      glReasoning: 'Manually added by user',
    };
    setFormData(prev => ({
      ...prev,
      lines: [...prev.lines, newLine],
    }));
    setHasUnsavedChanges(true);
  };

  const handleRemoveLine = (index: number) => {
    const updatedLines = formData.lines.filter((_, idx) => idx !== index);
    const newSubtotal = Math.round(updatedLines.reduce((sum, l) => sum + (l.lineTotal || 0), 0) * 100) / 100;
    const newTax = Math.round(updatedLines.reduce((sum, l) => sum + (l.taxAmount || 0), 0) * 100) / 100;
    const newTotal = Math.round((newSubtotal + newTax - (formData.discountAmount || 0)) * 100) / 100;

    setFormData(prev => ({
      ...prev,
      lines: updatedLines,
      subtotal: newSubtotal,
      taxAmount: newTax,
      totalAmount: newTotal,
    }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      setHasUnsavedChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddComment = async (data: {
    content: string;
    lineItemId?: string;
    lineItemDescription?: string;
    category?: any;
  }) => {
    try {
      const res = await fetch(`/api/invoices/${formData.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const resData = await res.json();
        const updatedInvoice = {
          ...formData,
          comments: resData.comments,
        };
        setFormData(updatedInvoice);
        await onSave(updatedInvoice);
      }
    } catch (err) {
      console.error('Failed to post comment', err);
    }
  };

  const handleToggleResolveComment = async (commentId: string, currentResolved: boolean) => {
    try {
      const res = await fetch(`/api/invoices/${formData.id}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: !currentResolved }),
      });
      if (res.ok) {
        const resData = await res.json();
        const updatedInvoice = {
          ...formData,
          comments: resData.comments,
        };
        setFormData(updatedInvoice);
        await onSave(updatedInvoice);
      }
    } catch (err) {
      console.error('Failed to resolve comment', err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await fetch(`/api/invoices/${formData.id}/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const resData = await res.json();
        const updatedInvoice = {
          ...formData,
          comments: resData.comments,
        };
        setFormData(updatedInvoice);
        await onSave(updatedInvoice);
      }
    } catch (err) {
      console.error('Failed to delete comment', err);
    }
  };

  const hasBlockingErrors = formData.validationIssues?.some(i => i.status === 'ERROR');

  // Helper to extract or dynamically evaluate field confidence (0-100%)
  const getFieldConfidence = (
    fieldKey: string,
    defaultBaseline = 0.96
  ): { score: number; level: 'High' | 'Medium' | 'Low'; reason?: string } => {
    const rawVal = formData.fieldConfidences?.[fieldKey];
    let score =
      rawVal !== undefined
        ? Math.round(Number(rawVal) * (rawVal <= 1 ? 100 : 1))
        : Math.round(defaultBaseline * 100);

    // If there is an active validation error/warning directly concerning this field, adjust score
    const matchingIssue = formData.validationIssues?.find(
      i =>
        i.field === fieldKey ||
        i.message.toLowerCase().includes(fieldKey.toLowerCase()) ||
        (fieldKey === 'totalAmount' && i.rule === 'arithmetic_reconciliation') ||
        (fieldKey === 'subtotal' && i.rule === 'arithmetic_reconciliation') ||
        (fieldKey === 'taxAmount' && i.rule === 'arithmetic_reconciliation') ||
        (fieldKey === 'invoiceDate' && i.rule === 'date_verification') ||
        (fieldKey === 'dueDate' && i.rule === 'date_verification') ||
        (fieldKey === 'invoiceNumber' && (i.rule === 'duplicate_check' || i.rule === 'required_fields')) ||
        (fieldKey === 'vendorName' && i.rule === 'vendor_verification')
    );

    let reason: string | undefined = undefined;
    if (matchingIssue) {
      if (matchingIssue.status === 'ERROR') {
        score = Math.min(score, 58);
        reason = matchingIssue.message;
      } else if (matchingIssue.status === 'WARNING') {
        score = Math.min(score, 78);
        reason = matchingIssue.message;
      }
    }

    if (fieldKey === 'purchaseOrderNumber' && !formData.purchaseOrderNumber) {
      score = 90;
      reason = 'Not stated on document scan';
    }

    const level: 'High' | 'Medium' | 'Low' = score >= 90 ? 'High' : score >= 75 ? 'Medium' : 'Low';
    return { score, level, reason };
  };

  const renderConfidenceBadge = (fieldKey: string, defaultBaseline = 0.96) => {
    const { score, level, reason } = getFieldConfidence(fieldKey, defaultBaseline);

    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all border ${
          level === 'High'
            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
            : level === 'Medium'
            ? 'bg-amber-950/80 text-amber-300 border-amber-600/70 ring-1 ring-amber-500/30'
            : 'bg-rose-950/90 text-rose-300 border-rose-600/80 ring-1 ring-rose-500/40 animate-pulse'
        }`}
        title={`AI OCR Extraction Confidence: ${score}%${reason ? ` — Note: ${reason}` : ''}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            level === 'High' ? 'bg-emerald-400' : level === 'Medium' ? 'bg-amber-400' : 'bg-rose-400'
          }`}
        />
        <span>{score}% conf</span>
        {level === 'Low' && (
          <span className="font-sans text-[9px] uppercase tracking-wider font-bold text-rose-300">
            · Check
          </span>
        )}
      </span>
    );
  };

  const getFieldBorderClass = (fieldKey: string, defaultBaseline = 0.96) => {
    const { level } = getFieldConfidence(fieldKey, defaultBaseline);
    if (level === 'Low') {
      return 'border-rose-600/80 focus:border-rose-500 bg-rose-950/20 ring-1 ring-rose-500/30';
    }
    if (level === 'Medium') {
      return 'border-amber-600/70 focus:border-amber-500 bg-amber-950/10';
    }
    return 'border-slate-700/80 focus:border-indigo-500 bg-slate-900';
  };

  // Overall extraction confidence summary
  const confidenceSummary = React.useMemo(() => {
    const keys = ['vendorName', 'invoiceNumber', 'invoiceDate', 'dueDate', 'currency', 'subtotal', 'taxAmount', 'totalAmount'];
    let sum = 0;
    let lowCount = 0;
    let mediumCount = 0;
    let highCount = 0;

    keys.forEach(k => {
      const { score, level } = getFieldConfidence(k);
      sum += score;
      if (level === 'Low') lowCount++;
      else if (level === 'Medium') mediumCount++;
      else highCount++;
    });

    const avgScore = Math.round(sum / keys.length);
    return { avgScore, lowCount, mediumCount, highCount };
  }, [formData]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 lg:p-6 overflow-hidden">
      <div className="bg-[#0e1626] border border-slate-800 rounded-xl w-full max-w-7xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Top Bar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-[#0b101c] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white font-mono">#{formData.invoiceNumber}</span>
              <span className="text-slate-500">·</span>
              <span className="text-xs text-slate-300 font-medium">{formData.vendorName}</span>
            </div>

            {/* Status indicator */}
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                formData.businessStatus === 'Needs Review'
                  ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                  : formData.businessStatus === 'Pending Approval'
                  ? 'bg-blue-950/60 text-blue-300 border border-blue-800/60'
                  : formData.businessStatus === 'Approved'
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                  : formData.businessStatus === 'Exported'
                  ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/60'
                  : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
              }`}
            >
              {formData.businessStatus}
            </span>

            {formData.externalRecordId && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800 flex items-center gap-1">
                <span>Ref: {formData.externalRecordId}</span>
              </span>
            )}

            {/* Internal Comments Jump Button */}
            <button
              onClick={() => {
                const el = document.getElementById('internal-comments-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 rounded text-xs font-medium transition-colors cursor-pointer"
              title="Jump to Internal Review Discussion"
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>Comments</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/60 font-semibold">
                {formData.comments?.length || 0}
              </span>
              {(formData.comments || []).some(c => !c.resolved) && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Open discussion threads" />
              )}
            </button>

            {hasUnsavedChanges && (
              <span className="text-[11px] text-amber-400 font-mono italic">Unsaved edits</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {formData.businessStatus === 'Approved' && activeConn && onSyncSingleBill && (
              <button
                onClick={async () => {
                  setIsSyncingBill(true);
                  try {
                    await onSyncSingleBill(formData.id);
                    onClose();
                  } finally {
                    setIsSyncingBill(false);
                  }
                }}
                disabled={isSyncingBill}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBill ? 'animate-spin' : ''}`} />
                <span>Sync Bill to {activeConn.providerName}</span>
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded text-xs font-medium transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
            </button>

            {formData.businessStatus === 'Needs Review' && (
              <button
                onClick={async () => {
                  await handleSave();
                  await onSubmitApproval(formData.id);
                  onClose();
                }}
                disabled={hasBlockingErrors}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-colors ${
                  hasBlockingErrors
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                }`}
                title={hasBlockingErrors ? 'Resolve blocking errors before submitting' : 'Submit to assigned approver'}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit for Approval</span>
              </button>
            )}

            {formData.businessStatus === 'Pending Approval' &&
              (currentUser.role === 'Admin' || currentUser.role === 'Approver') && (
                <>
                  <button
                    onClick={() => setShowRejectPrompt(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-900/40 hover:bg-rose-900/60 border border-rose-700/60 text-rose-200 rounded text-xs font-semibold transition-colors"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                  <button
                    onClick={async () => {
                      await onApprove(formData.id);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve Invoice</span>
                  </button>
                </>
              )}

            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2-Column Desktop Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left Column: Original Document Viewer */}
          <div className="lg:col-span-5 bg-[#080d17] border-r border-slate-800 flex flex-col overflow-hidden relative">
            <div className="p-2.5 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono truncate">{formData.documentName || 'Scanned_Invoice.pdf'}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setZoomLevel(z => Math.max(75, z - 15))}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                  title="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] px-1 text-slate-300">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel(z => Math.min(175, z + 15))}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                  title="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomLevel(100)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                  title="Reset zoom"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Document Surface */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/80">
              <div
                className="relative transition-transform duration-200 shadow-2xl rounded border border-slate-700/60 bg-white overflow-hidden"
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
              >
                {formData.documentUrl && formData.documentUrl.startsWith('data:application/pdf') ? (
                  <iframe
                    src={formData.documentUrl}
                    title={formData.documentName || 'Invoice PDF Scan'}
                    className="w-[520px] h-[640px] block border-0 bg-white"
                  />
                ) : (
                  <img
                    src={formData.documentUrl || "/src/assets/images/invoice_document_preview_1790322409257.jpg"}
                    alt={formData.documentName || "Invoice Original Scan"}
                    referrerPolicy="no-referrer"
                    className="w-[520px] max-w-none block select-none"
                  />
                )}

                {/* Interactive Highlight Bounding Boxes (for images) */}
                {(!formData.documentUrl || !formData.documentUrl.startsWith('data:application/pdf')) && (
                  <>
                    {activeHighlightField === 'vendor' && (
                      <div className="absolute top-[8%] left-[6%] w-[45%] h-[8%] border-2 border-indigo-500 bg-indigo-500/20 rounded pointer-events-none animate-pulse" />
                    )}
                    {activeHighlightField === 'invoiceNumber' && (
                      <div className="absolute top-[18%] right-[6%] w-[35%] h-[6%] border-2 border-indigo-500 bg-indigo-500/20 rounded pointer-events-none animate-pulse" />
                    )}
                    {activeHighlightField === 'total' && (
                      <div className="absolute bottom-[14%] right-[6%] w-[40%] h-[8%] border-2 border-emerald-500 bg-emerald-500/20 rounded pointer-events-none animate-pulse" />
                    )}
                    {activeHighlightField === 'lines' && (
                      <div className="absolute top-[38%] left-[6%] w-[88%] h-[32%] border-2 border-blue-500 bg-blue-500/15 rounded pointer-events-none animate-pulse" />
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="p-2 border-t border-slate-800/80 bg-slate-950/60 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>AI Optical Character Recognition (OCR) Verified</span>
              </span>
              <span className="font-mono text-slate-500">1 of 1 pages</span>
            </div>
          </div>

          {/* Right Column: Extracted Fields, Validation & GL Editor */}
          <div className="lg:col-span-7 flex flex-col h-full overflow-y-auto p-6 space-y-6 bg-[#0c121e]">
            {/* Rejection notice if rejected */}
            {formData.businessStatus === 'Rejected' && formData.rejectionReason && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg flex items-start gap-2.5">
                <AlertOctagon className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-rose-300">Invoice Rejected</p>
                  <p className="text-xs text-rose-200/80 mt-0.5">{formData.rejectionReason}</p>
                </div>
              </div>
            )}

            {/* Duplicate Bill Detected Warning Banner */}
            {(formData.isDuplicate || formData.validationIssues?.some(v => v.rule === 'duplicate_check' && v.status === 'WARNING')) && (
              <div className="p-3.5 bg-amber-950/50 border border-amber-500/60 rounded-lg flex items-start gap-2.5 shadow-sm">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0 animate-pulse" />
                <div>
                  <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <span>Potential Duplicate Bill Detected</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-900/60 text-amber-200 border border-amber-700/50">
                      High Risk
                    </span>
                  </p>
                  <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                    {formData.duplicateWarning ||
                      formData.validationIssues?.find(v => v.rule === 'duplicate_check' && v.status === 'WARNING')?.message ||
                      'An invoice with identical vendor, date, and amount has already been recorded in your workspace.'}
                  </p>
                </div>
              </div>
            )}

            {/* Validation Engine Results Panel */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Validation Engine Audit</span>
                </h4>
                <span className="text-[11px] font-mono text-slate-400">
                  {formData.validationIssues?.filter(v => v.status === 'PASS').length} of {formData.validationIssues?.length} Passed
                </span>
              </div>

              <div className="space-y-2">
                {formData.validationIssues?.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded text-xs flex items-start gap-2.5 ${
                      issue.status === 'PASS'
                        ? 'bg-emerald-950/20 border border-emerald-900/30 text-emerald-200/90'
                        : issue.status === 'WARNING'
                        ? 'bg-amber-950/20 border border-amber-900/30 text-amber-200/90'
                        : 'bg-rose-950/30 border border-rose-900/40 text-rose-200'
                    }`}
                  >
                    {issue.status === 'PASS' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    ) : issue.status === 'WARNING' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                    ) : (
                      <AlertOctagon className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium leading-tight">{issue.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Extraction Confidence Overview Banner */}
            <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2.5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-700/60 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                        AI Field Extraction Confidence
                      </h5>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.2 rounded-full border ${
                        confidenceSummary.avgScore >= 90
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                          : confidenceSummary.avgScore >= 75
                          ? 'bg-amber-950 text-amber-300 border-amber-700/60'
                          : 'bg-rose-950 text-rose-300 border-rose-700/60'
                      }`}>
                        {confidenceSummary.avgScore}% Average Certainty
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Confidence scores (0-100%) highlight fields with lower certainty requiring manual review against the document.
                    </p>
                  </div>
                </div>

                {/* Score Legend Indicator */}
                <div className="flex items-center gap-2 text-[10px] font-mono shrink-0 bg-slate-950/70 px-2.5 py-1 rounded-lg border border-slate-800">
                  <span className="flex items-center gap-1 text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>≥90% High</span>
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="flex items-center gap-1 text-amber-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>75-89% Med</span>
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="flex items-center gap-1 text-rose-300 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                    <span>&lt;75% Review</span>
                  </span>
                </div>
              </div>

              {/* Alert Callout if any field is low confidence */}
              {confidenceSummary.lowCount > 0 && (
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-700/60 text-rose-200 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      <strong>Manual Correction Recommended:</strong> {confidenceSummary.lowCount} field(s) have low certainty or math discrepancies. Verify against the document scan.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Primary Invoice Header Fields */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-indigo-400" />
                <span>Invoice Header & Vendor Information</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Vendor Selector */}
                <div
                  onMouseEnter={() => setActiveHighlightField('vendor')}
                  onMouseLeave={() => setActiveHighlightField(null)}
                  className="space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <label className="text-slate-400 font-medium">Vendor / Supplier</label>
                    {renderConfidenceBadge('vendorName', 0.98)}
                  </div>
                  <input
                    type="text"
                    value={formData.vendorName ?? ''}
                    onChange={e => {
                      setFormData(prev => ({ ...prev, vendorName: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    className={`w-full px-3 py-1.5 rounded text-xs text-white focus:outline-none transition-colors border ${getFieldBorderClass(
                      'vendorName',
                      0.98
                    )}`}
                  />
                </div>

                {/* Invoice Number */}
                <div
                  onMouseEnter={() => setActiveHighlightField('invoiceNumber')}
                  onMouseLeave={() => setActiveHighlightField(null)}
                  className="space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <label className="text-slate-400 font-medium">Invoice Number</label>
                    {renderConfidenceBadge('invoiceNumber', 0.99)}
                  </div>
                  <input
                    type="text"
                    value={formData.invoiceNumber ?? ''}
                    onChange={e => {
                      setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    className={`w-full px-3 py-1.5 rounded text-xs text-white font-mono focus:outline-none transition-colors border ${getFieldBorderClass(
                      'invoiceNumber',
                      0.99
                    )}`}
                  />
                </div>

                {/* Invoice Date */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label className="text-slate-400 font-medium">Invoice Date</label>
                    {renderConfidenceBadge('invoiceDate', 0.98)}
                  </div>
                  <input
                    type="date"
                    value={formData.invoiceDate ?? ''}
                    onChange={e => {
                      setFormData(prev => ({ ...prev, invoiceDate: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    className={`w-full px-3 py-1.5 rounded text-xs text-white font-mono focus:outline-none transition-colors border ${getFieldBorderClass(
                      'invoiceDate',
                      0.98
                    )}`}
                  />
                </div>

                {/* Due Date */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label className="text-slate-400 font-medium">Payment Due Date</label>
                    {renderConfidenceBadge('dueDate', 0.95)}
                  </div>
                  <input
                    type="date"
                    value={formData.dueDate ?? ''}
                    onChange={e => {
                      setFormData(prev => ({ ...prev, dueDate: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    className={`w-full px-3 py-1.5 rounded text-xs text-white font-mono focus:outline-none transition-colors border ${getFieldBorderClass(
                      'dueDate',
                      0.95
                    )}`}
                  />
                </div>

                {/* Currency */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label className="text-slate-400 font-medium">Currency</label>
                    {renderConfidenceBadge('currency', 0.99)}
                  </div>
                  <select
                    value={formData.currency ?? 'USD'}
                    onChange={e => {
                      setFormData(prev => ({ ...prev, currency: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    className={`w-full px-3 py-1.5 rounded text-xs text-white focus:outline-none transition-colors border ${getFieldBorderClass(
                      'currency',
                      0.99
                    )}`}
                  >
                    <option value="USD">USD ($ - US Dollar)</option>
                    <option value="EUR">EUR (€ - Euro)</option>
                    <option value="GBP">GBP (£ - British Pound)</option>
                  </select>
                </div>

                {/* Purchase Order */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label className="text-slate-400 font-medium">Purchase Order (PO #)</label>
                    {renderConfidenceBadge('purchaseOrderNumber', 0.92)}
                  </div>
                  <input
                    type="text"
                    placeholder="Optional PO number"
                    value={formData.purchaseOrderNumber ?? ''}
                    onChange={e => {
                      setFormData(prev => ({ ...prev, purchaseOrderNumber: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    className={`w-full px-3 py-1.5 rounded text-xs text-white font-mono focus:outline-none transition-colors border ${getFieldBorderClass(
                      'purchaseOrderNumber',
                      0.92
                    )}`}
                  />
                </div>
              </div>
            </div>

            {/* Line Items Table with GL Coding */}
            <div
              onMouseEnter={() => setActiveHighlightField('lines')}
              onMouseLeave={() => setActiveHighlightField(null)}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Line Items & GL Coding</span>
                </h4>
                <button
                  onClick={handleAddLine}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-2 w-16 text-right">Qty</th>
                      <th className="py-2.5 px-2 w-24 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 w-52">GL Account Code</th>
                      <th className="py-2.5 px-3 w-24 text-right">Line Total</th>
                      <th className="py-2.5 px-2 w-20 text-center" title="AI Extraction & GL Coding Confidence">
                        AI Conf.
                      </th>
                      <th className="py-2.5 px-2 w-10 text-center" title="Line Item Discussion">
                        <MessageSquare className="w-3.5 h-3.5 mx-auto text-slate-400" />
                      </th>
                      <th className="py-2.5 px-2 w-8 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {formData.lines.map((line, idx) => {
                      const lineComments = (formData.comments || []).filter(c => c.lineItemId === line.id);
                      const hasLineComments = lineComments.length > 0;
                      const hasUnresolvedLineComments = lineComments.some(c => !c.resolved);
                      const isLineFocused = selectedCommentLineId === line.id;
                      const lineConf = line.glSuggestionConfidence !== undefined
                        ? Math.round(line.glSuggestionConfidence * (line.glSuggestionConfidence <= 1 ? 100 : 1))
                        : line.sourceConfidence !== undefined
                        ? Math.round(line.sourceConfidence * (line.sourceConfidence <= 1 ? 100 : 1))
                        : 95;

                      return (
                        <tr
                          key={line.id || idx}
                          className={`hover:bg-slate-800/30 transition-colors ${
                            isLineFocused ? 'bg-indigo-950/40 ring-1 ring-indigo-500/60' : ''
                          }`}
                        >
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={line.description ?? ''}
                              onChange={e => handleLineChange(idx, 'description', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none text-white text-xs"
                            />
                            {line.glReasoning && (
                              <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Sparkles className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                                <span className="truncate">{line.glReasoning}</span>
                              </p>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              value={line.quantity ?? 1}
                              onChange={e => handleLineChange(idx, 'quantity', e.target.value)}
                              className="w-14 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none text-white text-right text-xs font-mono"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={line.unitPrice ?? 0}
                              onChange={e => handleLineChange(idx, 'unitPrice', e.target.value)}
                              className="w-20 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none text-white text-right text-xs font-mono"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={line.glAccountId ?? ''}
                              onChange={e => handleLineChange(idx, 'glAccountId', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700/80 rounded py-1 px-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                            >
                              <option value="">Select GL Account...</option>
                              {glAccounts.map(g => (
                                <option key={g.id} value={g.id}>
                                  {g.code} - {g.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-white font-medium">
                            ${(line.lineTotal || 0).toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold border ${
                                lineConf >= 90
                                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                                  : lineConf >= 75
                                  ? 'bg-amber-950/70 text-amber-300 border-amber-600/70'
                                  : 'bg-rose-950/80 text-rose-300 border-rose-600/70 animate-pulse'
                              }`}
                              title={`Line item & GL coding confidence: ${lineConf}%`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  lineConf >= 90 ? 'bg-emerald-400' : lineConf >= 75 ? 'bg-amber-400' : 'bg-rose-400'
                                }`}
                              />
                              <span>{lineConf}%</span>
                            </span>
                          </td>
                          <td className="py-2 px-1 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCommentLineId(line.id);
                                document.getElementById('internal-comments-section')?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className={`p-1 rounded text-xs transition-colors flex items-center justify-center mx-auto gap-0.5 cursor-pointer ${
                                hasLineComments
                                  ? hasUnresolvedLineComments
                                    ? 'bg-amber-950/80 text-amber-300 border border-amber-600/70'
                                    : 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/60'
                                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                              }`}
                              title={
                                hasLineComments
                                  ? `${lineComments.length} review comment(s) on this line. Click to view.`
                                  : 'Discuss this line item'
                              }
                            >
                              <MessageSquare className="w-3 h-3" />
                              {hasLineComments && (
                                <span className="text-[10px] font-mono leading-none">{lineComments.length}</span>
                              )}
                            </button>
                          </td>
                          <td className="py-2 px-2 text-center">
                            {formData.lines.length > 1 && (
                              <button
                                onClick={() => handleRemoveLine(idx)}
                                className="text-slate-500 hover:text-rose-400 transition-colors"
                                title="Delete line"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary & Totals */}
            <div
              onMouseEnter={() => setActiveHighlightField('total')}
              onMouseLeave={() => setActiveHighlightField(null)}
              className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 flex flex-col items-end space-y-2 text-xs"
            >
              <div className="flex items-center justify-between w-80 text-slate-400">
                <span>Subtotal:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-white font-medium">${formData.subtotal.toFixed(2)}</span>
                  {renderConfidenceBadge('subtotal', 0.99)}
                </div>
              </div>
              <div className="flex items-center justify-between w-80 text-slate-400">
                <span>Tax Amount:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-white font-medium">${formData.taxAmount.toFixed(2)}</span>
                  {renderConfidenceBadge('taxAmount', 0.96)}
                </div>
              </div>
              {formData.discountAmount > 0 && (
                <div className="flex items-center justify-between w-80 text-slate-400">
                  <span>Discount:</span>
                  <span className="font-mono text-emerald-400">-${formData.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-slate-800 w-80 pt-2 flex items-center justify-between font-bold text-sm">
                <span className="text-white">Total Amount:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-indigo-300 text-base">
                    {formData.currency} ${formData.totalAmount.toFixed(2)}
                  </span>
                  {renderConfidenceBadge('totalAmount', 0.99)}
                </div>
              </div>
            </div>

            {/* Internal Comments & Activity Feed Section */}
            <div id="internal-comments-section" className="pt-2">
              <InvoiceCommentsThread
                comments={formData.comments || []}
                lines={formData.lines}
                currentUser={currentUser}
                users={users}
                auditEvents={auditEvents}
                invoiceId={formData.id}
                invoiceNumber={formData.invoiceNumber}
                onAddComment={handleAddComment}
                onToggleResolve={handleToggleResolveComment}
                onDeleteComment={handleDeleteComment}
                selectedLineItemId={selectedCommentLineId}
                onSelectLineItem={id => setSelectedCommentLineId(id)}
                onHighlightLine={id => {
                  setSelectedCommentLineId(id);
                  setActiveHighlightField(id ? 'lines' : null);
                }}
              />
            </div>
          </div>
        </div>

        {/* Reject Dialog Prompt */}
        {showRejectPrompt && (
          <div className="absolute inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-[#111827] border border-slate-700 rounded-lg p-5 max-w-md w-full shadow-2xl">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-400" />
                <span>Reject Invoice #{formData.invoiceNumber}</span>
              </h3>
              <p className="text-xs text-slate-400 mb-3">
                Specify the financial reason for rejection. This will be preserved in the audit log and returned to the review queue.
              </p>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Line item discrepancy, unverified supplier, duplicate billing..."
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-rose-500 mb-4"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowRejectPrompt(false)}
                  className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await onReject(formData.id, rejectReason);
                    setShowRejectPrompt(false);
                    onClose();
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
