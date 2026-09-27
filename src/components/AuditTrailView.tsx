import React, { useState } from 'react';
import { History, Search, Filter, ShieldCheck, FileText, User } from 'lucide-react';
import { AuditEvent } from '../types';

interface AuditTrailViewProps {
  auditEvents: AuditEvent[];
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ auditEvents }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const filteredEvents = auditEvents.filter(evt => {
    if (actionFilter !== 'all' && evt.action !== actionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        evt.description.toLowerCase().includes(q) ||
        evt.actorName.toLowerCase().includes(q) ||
        evt.entityId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const uniqueActions = Array.from(new Set(auditEvents.map(e => e.action))).sort();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-400" />
            <span>Immutable Financial Audit Trail</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Complete cryptographic audit trail of all financial entity modifications, approvals, and exports.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1 rounded font-mono">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Tamper-evident logs enabled</span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search audit trail by actor, invoice, description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
          >
            <option value="all">All Action Types ({uniqueActions.length})</option>
            {uniqueActions.map(act => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50 shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0b101c] border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
            <tr>
              <th className="py-3 px-4 w-40">Timestamp</th>
              <th className="py-3 px-4 w-44">Actor / Origin</th>
              <th className="py-3 px-4 w-40">Action</th>
              <th className="py-3 px-4 w-28">Entity</th>
              <th className="py-3 px-4">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500 text-xs">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                  <p className="text-slate-300 font-medium">No audit events found</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Financial modifications, invoice reviews, approvals, and ERP exports will be logged here in chronological order.
                  </p>
                </td>
              </tr>
            ) : (
              filteredEvents.map(evt => (
              <tr key={evt.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                  {new Date(evt.timestamp).toLocaleString()}
                </td>
                <td className="py-3 px-4">
                  <p className="font-semibold text-white">{evt.actorName}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{evt.actorRole}</p>
                </td>
                <td className="py-3 px-4 font-mono">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      evt.action.includes('APPROVED')
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                        : evt.action.includes('REJECTED')
                        ? 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                        : evt.action.includes('EXPORT')
                        ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/60'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {evt.action}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-slate-300 text-[11px]">
                  {evt.entityType} ({evt.entityId})
                </td>
                <td className="py-3 px-4 text-slate-200">{evt.description}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
