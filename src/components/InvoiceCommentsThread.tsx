import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  Tag,
  AlertCircle,
  CornerDownRight,
  Filter,
  Trash2,
  Sparkles,
  HelpCircle,
  FileSpreadsheet,
  Check,
  RotateCcw,
  UserCheck,
  Shield,
  Layers,
  AtSign,
  Activity,
  History,
  FileText,
  AlertTriangle,
  RefreshCw,
  Ban,
  ArrowRight,
  User as UserIcon,
  ChevronDown,
} from 'lucide-react';
import { InvoiceComment, InvoiceLine, User, AuditEvent } from '../types';

interface InvoiceCommentsThreadProps {
  comments: InvoiceComment[];
  lines: InvoiceLine[];
  currentUser: User;
  users?: User[];
  auditEvents?: AuditEvent[];
  invoiceId?: string;
  invoiceNumber?: string;
  onAddComment: (data: {
    content: string;
    lineItemId?: string;
    lineItemDescription?: string;
    category?: 'general' | 'line_item' | 'coding_issue' | 'tax' | 'approval';
    taggedUserIds?: string[];
    taggedUserNames?: string[];
  }) => Promise<void>;
  onToggleResolve: (commentId: string, currentResolved: boolean) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  onHighlightLine?: (lineId: string | null) => void;
  selectedLineItemId?: string | null;
  onSelectLineItem?: (lineId: string | null) => void;
  className?: string;
}

interface ActivityItem {
  id: string;
  type: 'comment' | 'audit';
  timestamp: string;
  actorName: string;
  actorRole: string;
  title: string;
  description?: string;
  comment?: InvoiceComment;
  audit?: AuditEvent;
  category?: string;
  isResolved?: boolean;
}

export const InvoiceCommentsThread: React.FC<InvoiceCommentsThreadProps> = ({
  comments,
  lines,
  currentUser,
  users = [],
  auditEvents = [],
  invoiceId,
  invoiceNumber,
  onAddComment,
  onToggleResolve,
  onDeleteComment,
  onHighlightLine,
  selectedLineItemId,
  onSelectLineItem,
  className = '',
}) => {
  const [commentText, setCommentText] = useState('');
  const [targetLineId, setTargetLineId] = useState<string>(selectedLineItemId || '');
  const [category, setCategory] = useState<'general' | 'line_item' | 'coding_issue' | 'tax' | 'approval'>('general');
  const [viewTab, setViewTab] = useState<'all' | 'notes' | 'audit'>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'unresolved' | 'line_items' | 'mentions'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Mention State
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedTaggedUsers, setSelectedTaggedUsers] = useState<User[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Default team members if none passed
  const availableTeam: User[] = useMemo(() => {
    if (users && users.length > 0) return users;
    return [
      { id: 'usr-1', name: 'Alex Vance', role: 'Admin', email: 'alex.vance@acmetech.com', organizationId: 'org-acme' },
      { id: 'usr-2', name: 'Sarah Chen', role: 'Accountant', email: 'sarah.chen@acmetech.com', organizationId: 'org-acme' },
      { id: 'usr-3', name: 'Marcus Brody', role: 'Approver', email: 'marcus.brody@acmetech.com', organizationId: 'org-acme' },
      { id: 'usr-4', name: 'Elena Rostova', role: 'Read-Only', email: 'elena.r@acmetech.com', organizationId: 'org-acme' },
    ];
  }, [users]);

  // Sync with prop when parent updates selected line
  useEffect(() => {
    if (selectedLineItemId) {
      setTargetLineId(selectedLineItemId);
      setCategory('line_item');
    }
  }, [selectedLineItemId]);

  // Quick Approval Templates
  const quickTemplates = [
    { label: 'Ready for Approval', text: `@Marcus Brody - Line item coding & tax verified. Ready for sign-off.` },
    { label: 'Check GL Code', text: `@Sarah Chen - Please verify the GL account coding on this line item.` },
    { label: 'PO Match Confirmed', text: `Verified against Purchase Order. Stated prices match supplier contract.` },
    { label: 'Tax Discrepancy', text: `Flagging potential tax rate variance with billing statement.` },
  ];

  // Insert @mention into textarea
  const handleTagUser = (user: User) => {
    if (!selectedTaggedUsers.some(u => u.id === user.id)) {
      setSelectedTaggedUsers(prev => [...prev, user]);
    }

    const tagStr = `@${user.name} `;
    setCommentText(prev => {
      // If user was typing @query, replace it
      const atIndex = prev.lastIndexOf('@');
      if (atIndex !== -1 && showMentionMenu) {
        return prev.slice(0, atIndex) + tagStr;
      }
      return prev ? `${prev.trimEnd()} ${tagStr}` : tagStr;
    });

    setShowMentionMenu(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Handle Text Change & Detect `@` symbol
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCommentText(text);

    // Check for '@' mention trigger
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if (charBeforeAt === ' ' || charBeforeAt === '\n') {
        const query = textBeforeCursor.slice(lastAtIndex + 1);
        if (!query.includes(' ') && query.length <= 20) {
          setMentionQuery(query.toLowerCase());
          setShowMentionMenu(true);
          return;
        }
      }
    }

    setShowMentionMenu(false);
  };

  // Filtered mention users for dropdown
  const filteredMentionUsers = useMemo(() => {
    if (!mentionQuery) return availableTeam;
    return availableTeam.filter(
      u => u.name.toLowerCase().includes(mentionQuery) || u.role.toLowerCase().includes(mentionQuery)
    );
  }, [availableTeam, mentionQuery]);

  const handlePostComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentText.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const selectedLine = lines.find(l => l.id === targetLineId);

      // Extract all tagged names in text
      const taggedInText = availableTeam.filter(u => commentText.includes(`@${u.name}`));
      const finalTaggedUsers = Array.from(new Set([...selectedTaggedUsers, ...taggedInText]));

      await onAddComment({
        content: commentText.trim(),
        lineItemId: targetLineId || undefined,
        lineItemDescription: selectedLine?.description,
        category: targetLineId ? 'line_item' : category,
        taggedUserIds: finalTaggedUsers.map(u => u.id),
        taggedUserNames: finalTaggedUsers.map(u => u.name),
      });

      setCommentText('');
      setSelectedTaggedUsers([]);
      setShowMentionMenu(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handlePostComment();
    }
    if (e.key === 'Escape' && showMentionMenu) {
      setShowMentionMenu(false);
    }
  };

  // Role Badge Styling
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-purple-950/80 text-purple-300 border-purple-800/60';
      case 'Accountant':
        return 'bg-blue-950/80 text-blue-300 border-blue-800/60';
      case 'Approver':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getCategoryBadge = (cat?: string) => {
    switch (cat) {
      case 'coding_issue':
        return { label: 'GL Coding', color: 'bg-amber-950/70 text-amber-300 border-amber-800/50' };
      case 'line_item':
        return { label: 'Line Item', color: 'bg-indigo-950/70 text-indigo-300 border-indigo-800/50' };
      case 'tax':
        return { label: 'Tax Discrepancy', color: 'bg-rose-950/70 text-rose-300 border-rose-800/50' };
      case 'approval':
        return { label: 'Approval Note', color: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/50' };
      default:
        return { label: 'Internal Note', color: 'bg-slate-800/80 text-slate-300 border-slate-700/60' };
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(ts);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  // Relevant Audit Events for this specific invoice
  const invoiceAuditEvents = useMemo(() => {
    return auditEvents.filter(evt => {
      if (invoiceId && evt.entityId === invoiceId) return true;
      if (invoiceNumber && evt.description.includes(invoiceNumber)) return true;
      return false;
    });
  }, [auditEvents, invoiceId, invoiceNumber]);

  // Combined Activity Stream (Comments + Audit Events)
  const unifiedActivity = useMemo(() => {
    const list: ActivityItem[] = [];

    // Add comments
    comments.forEach(c => {
      list.push({
        id: c.id,
        type: 'comment',
        timestamp: c.timestamp,
        actorName: c.authorName,
        actorRole: c.authorRole,
        title: c.category === 'approval' ? 'Approval Discussion' : 'Internal Review Note',
        description: c.content,
        comment: c,
        category: c.category,
        isResolved: c.resolved,
      });
    });

    // Add audit events
    invoiceAuditEvents.forEach(evt => {
      list.push({
        id: evt.id,
        type: 'audit',
        timestamp: evt.timestamp,
        actorName: evt.actorName,
        actorRole: evt.actorRole,
        title: evt.action.replace(/_/g, ' '),
        description: evt.description,
        audit: evt,
      });
    });

    // Sort descending by timestamp
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [comments, invoiceAuditEvents]);

  // Filtered Activity based on viewTab and filterMode
  const displayedActivity = useMemo(() => {
    let items = unifiedActivity;

    if (viewTab === 'notes') {
      items = items.filter(i => i.type === 'comment');
    } else if (viewTab === 'audit') {
      items = items.filter(i => i.type === 'audit');
    }

    if (filterMode === 'unresolved') {
      items = items.filter(i => i.type === 'comment' && !i.isResolved);
    } else if (filterMode === 'line_items') {
      items = items.filter(i => i.type === 'comment' && Boolean(i.comment?.lineItemId));
    } else if (filterMode === 'mentions') {
      items = items.filter(
        i =>
          i.type === 'comment' &&
          (Boolean(i.comment?.taggedUserNames?.length) || i.description?.includes('@'))
      );
    }

    return items;
  }, [unifiedActivity, viewTab, filterMode]);

  const unresolvedCount = comments.filter(c => !c.resolved).length;
  const mentionsCount = comments.filter(
    c => Boolean(c.taggedUserNames?.length) || c.content.includes('@')
  ).length;

  // Render text with styled @mention pills
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(@[A-Za-z0-9_.\s]+(?=\s|[.,!?]|$))/g);
    return parts.map((part, idx) => {
      if (part.startsWith('@')) {
        const potentialName = part.slice(1).trim();
        const matched = availableTeam.find(u => u.name.toLowerCase() === potentialName.toLowerCase());
        return (
          <span
            key={idx}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-700/60 font-semibold font-mono text-[11px]"
          >
            <AtSign className="w-2.5 h-2.5" />
            <span>{potentialName}</span>
            {matched && <span className="text-[9px] text-slate-400">({matched.role})</span>}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className={`bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col ${className}`}>
      {/* Header with Navigation Views */}
      <div className="p-4 border-b border-slate-800/90 bg-slate-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-950/80 border border-indigo-700/60 rounded-lg text-indigo-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold text-white tracking-tight uppercase">
                Review Notes & Activity Feed
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                {comments.length} notes · {invoiceAuditEvents.length} events
              </span>
              {unresolvedCount > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-600/70 text-amber-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>{unresolvedCount} Open Discussion(s)</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Leave internal review notes, tag colleagues (@Marcus, @Sarah) for sign-off, and track chronological workflow events.
            </p>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setViewTab('all')}
            className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1 cursor-pointer ${
              viewTab === 'all'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>All Activity</span>
          </button>
          <button
            type="button"
            onClick={() => setViewTab('notes')}
            className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1 cursor-pointer ${
              viewTab === 'notes'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Notes & Mentions ({comments.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewTab('audit')}
            className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1 cursor-pointer ${
              viewTab === 'audit'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail ({invoiceAuditEvents.length})</span>
          </button>
        </div>
      </div>

      {/* Filter & Mention Chips Sub-bar */}
      {viewTab !== 'audit' && (
        <div className="px-4 py-2 border-b border-slate-800/60 bg-slate-950/40 flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-slate-500" />
            <span className="text-[11px] text-slate-400 font-medium mr-1">Filter:</span>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                filterMode === 'all' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('unresolved')}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                filterMode === 'unresolved' ? 'bg-amber-950 text-amber-300 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Open ({unresolvedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('mentions')}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer flex items-center gap-1 ${
                filterMode === 'mentions' ? 'bg-indigo-950 text-indigo-300 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AtSign className="w-2.5 h-2.5" />
              <span>Mentions ({mentionsCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('line_items')}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                filterMode === 'line_items' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Line Items
            </button>
          </div>

          {/* Quick Tagging Shortcut Bar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <AtSign className="w-3 h-3 text-indigo-400" />
              <span>Tag Member:</span>
            </span>
            {availableTeam.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleTagUser(u)}
                className="px-2 py-0.5 rounded-full bg-slate-900 hover:bg-indigo-950/80 border border-slate-700/80 hover:border-indigo-600/60 text-slate-300 hover:text-indigo-200 text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                title={`Tag ${u.name} in comment`}
              >
                <span>@{u.name.split(' ')[0]}</span>
                <span className="text-[9px] text-slate-500 font-mono">({u.role})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Activity & Comments List Stream */}
      <div className="p-4 space-y-3 max-h-[380px] overflow-y-auto bg-slate-950/30 divide-y divide-slate-800/40">
        {displayedActivity.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-800/70 border border-slate-700/80 flex items-center justify-center mx-auto text-slate-400">
              <MessageSquare className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xs text-slate-300 font-medium">No activity or notes to display in this view</p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Leave an internal review note, question coding with colleagues, or tag an approver using @name.
            </p>
          </div>
        ) : (
          displayedActivity.map(item => {
            if (item.type === 'comment' && item.comment) {
              const comment = item.comment;
              const isResolved = Boolean(comment.resolved);
              const matchedLine = lines.find(l => l.id === comment.lineItemId);
              const catInfo = getCategoryBadge(comment.category);
              const hasTagged = (comment.taggedUserNames && comment.taggedUserNames.length > 0) || comment.content.includes('@');

              return (
                <div
                  key={comment.id}
                  className={`pt-3 first:pt-0 transition-all rounded-lg p-3 ${
                    isResolved
                      ? 'bg-slate-950/30 border border-slate-800/40 opacity-75'
                      : 'bg-slate-900/70 border border-slate-800/80 shadow-sm'
                  }`}
                >
                  {/* Author, Tagged Users & Status Bar */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Initials Avatar */}
                      <div className="w-6 h-6 rounded-full bg-indigo-700 text-white font-bold flex items-center justify-center text-[10px] uppercase shrink-0 border border-indigo-500/50">
                        {comment.authorName.slice(0, 2)}
                      </div>
                      <span className="text-xs font-bold text-white">{comment.authorName}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${getRoleBadge(comment.authorRole)}`}>
                        {comment.authorRole}
                      </span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-600" />
                        <span>{formatTimestamp(comment.timestamp)}</span>
                      </span>

                      {/* Tagged badge if present */}
                      {comment.taggedUserNames && comment.taggedUserNames.length > 0 && (
                        <div className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-indigo-950/90 border border-indigo-600/70 text-indigo-300 text-[10px] font-mono font-semibold">
                          <AtSign className="w-2.5 h-2.5 text-indigo-400" />
                          <span>Notified: @{comment.taggedUserNames.join(', @')}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions: Resolve / Delete */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={togglingId === comment.id}
                        onClick={async () => {
                          setTogglingId(comment.id);
                          try {
                            await onToggleResolve(comment.id, isResolved);
                          } finally {
                            setTogglingId(null);
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 transition-all cursor-pointer ${
                          isResolved
                            ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/70'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                        title={isResolved ? 'Reopen discussion' : 'Mark as resolved'}
                      >
                        {isResolved ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Resolved</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-slate-400" />
                            <span>Mark Resolved</span>
                          </>
                        )}
                      </button>

                      {onDeleteComment && (currentUser.id === comment.authorId || currentUser.role === 'Admin') && (
                        <button
                          type="button"
                          onClick={() => onDeleteComment(comment.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors rounded hover:bg-slate-800"
                          title="Delete note"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Line Item / Category Reference */}
                  {(comment.lineItemId || comment.category) && (
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      {comment.lineItemId && (
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectLineItem) onSelectLineItem(comment.lineItemId || null);
                            if (onHighlightLine) onHighlightLine(comment.lineItemId || null);
                          }}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 text-[11px] font-medium hover:bg-indigo-900/80 transition-colors cursor-pointer"
                          title="Focus and highlight this line item"
                        >
                          <CornerDownRight className="w-3 h-3 text-indigo-400 shrink-0" />
                          <span className="font-mono">Line Item:</span>
                          <span className="truncate max-w-[240px]">
                            {matchedLine?.description || comment.lineItemDescription || 'Referenced Item'}
                          </span>
                          {matchedLine && (
                            <span className="font-mono text-indigo-200 font-semibold ml-0.5">
                              (${matchedLine.lineTotal.toFixed(2)})
                            </span>
                          )}
                        </button>
                      )}

                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium border ${catInfo.color}`}>
                        <Tag className="w-2.5 h-2.5" />
                        <span>{catInfo.label}</span>
                      </span>
                    </div>
                  )}

                  {/* Formatted Comment Text with @mentions highlighted */}
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap pl-0.5">
                    {renderFormattedText(comment.content)}
                  </p>
                </div>
              );
            }

            // Otherwise, render Audit Event Item
            const audit = item.audit!;
            return (
              <div key={audit.id} className="pt-3 first:pt-0 flex items-start gap-2.5 text-xs text-slate-300">
                <div className="p-1 rounded bg-slate-800 text-slate-400 mt-0.5 shrink-0 border border-slate-700">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-white">{audit.actorName}</span>
                      <span className="text-[10px] font-mono px-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {audit.actorRole}
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                        {audit.action}
                      </span>
                    </div>
                    <span className="font-mono text-slate-500 text-[10px]">
                      {formatTimestamp(audit.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">{audit.description}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Approval Review Templates */}
      <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/60 flex items-center gap-1.5 overflow-x-auto text-xs">
        <span className="text-[10px] uppercase font-semibold text-slate-500 shrink-0">Quick Note:</span>
        {quickTemplates.map((tpl, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setCommentText(prev => (prev ? `${prev}\n${tpl.text}` : tpl.text));
              if (textareaRef.current) textareaRef.current.focus();
            }}
            className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-[10px] whitespace-nowrap transition-colors cursor-pointer shrink-0"
          >
            {tpl.label}
          </button>
        ))}
      </div>

      {/* Internal Note / Comment Composer */}
      <form onSubmit={handlePostComment} className="p-3.5 bg-slate-950/95 border-t border-slate-800 space-y-3 relative">
        {/* Context Attachment Selectors */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <span className="text-[11px] text-slate-400 font-medium shrink-0 flex items-center gap-1">
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
              <span>Attach To:</span>
            </span>
            <select
              value={targetLineId}
              onChange={e => {
                const val = e.target.value;
                setTargetLineId(val);
                if (val) {
                  setCategory('line_item');
                  if (onSelectLineItem) onSelectLineItem(val);
                }
              }}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 w-full max-w-[340px]"
            >
              <option value="">Whole Invoice (General Review)</option>
              {lines.map((l, idx) => (
                <option key={l.id || idx} value={l.id}>
                  Line #{idx + 1}: {l.description.slice(0, 32)}... (${l.lineTotal.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => setCategory('coding_issue')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                category === 'coding_issue'
                  ? 'bg-amber-950 border-amber-600 text-amber-200'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-300'
              }`}
            >
              GL Coding
            </button>
            <button
              type="button"
              onClick={() => setCategory('approval')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                category === 'approval'
                  ? 'bg-emerald-950 border-emerald-600 text-emerald-200'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-300'
              }`}
            >
              Approval
            </button>
            <button
              type="button"
              onClick={() => setCategory('tax')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                category === 'tax'
                  ? 'bg-rose-950 border-rose-600 text-rose-200'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-300'
              }`}
            >
              Tax
            </button>
          </div>
        </div>

        {/* Text Input with Floating Mention Popup */}
        <div className="relative">
          {/* Autocomplete Mention Menu */}
          {showMentionMenu && (
            <div className="absolute bottom-full left-0 mb-1 w-64 bg-[#0f172a] border border-indigo-700/80 rounded-xl shadow-2xl overflow-hidden z-30 divide-y divide-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="p-2 bg-indigo-950/70 border-b border-indigo-800/60 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-indigo-300 flex items-center gap-1">
                  <AtSign className="w-3 h-3 text-indigo-400" />
                  <span>Tag a team member</span>
                </span>
                <span className="text-[10px] text-slate-400">Esc to cancel</span>
              </div>
              <div className="max-h-44 overflow-y-auto p-1 space-y-0.5">
                {filteredMentionUsers.length === 0 ? (
                  <div className="p-2 text-center text-slate-400 text-xs">No team member matches</div>
                ) : (
                  filteredMentionUsers.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleTagUser(user)}
                      className="w-full text-left p-1.5 hover:bg-indigo-950/80 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[9px] uppercase">
                          {user.name.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-semibold text-white text-xs">{user.name}</p>
                          <p className="text-[10px] text-slate-400">{user.email}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${getRoleBadge(user.role)}`}>
                        {user.role}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={commentText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={
              targetLineId
                ? 'Leave a note on this line item. Type @ to tag Marcus Brody, Sarah Chen, or other colleagues...'
                : 'Write an internal note or tag team members (e.g. @Marcus Brody) for review or sign-off...'
            }
            rows={2}
            className="w-full bg-slate-900/90 border border-slate-700/90 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none pr-24"
          />

          <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
            <button
              type="submit"
              disabled={!commentText.trim() || isSubmitting}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Send className="w-3 h-3" />
              <span>{isSubmitting ? 'Posting...' : 'Post Note'}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-1">
            <span>Signed in as <strong className="text-slate-300">{currentUser.name}</strong> ({currentUser.role})</span>
            {selectedTaggedUsers.length > 0 && (
              <span className="text-indigo-400 ml-1">
                · Will notify {selectedTaggedUsers.map(u => u.name).join(', ')}
              </span>
            )}
          </div>
          <span className="font-mono">Type @ to mention · ⌘ + Enter to send</span>
        </div>
      </form>
    </div>
  );
};
