import React, { useState } from 'react';
import { BookOpen, Plus, Search, Tag, X, CheckCircle2 } from 'lucide-react';
import { GlAccount } from '../types';

interface ChartOfAccountsViewProps {
  glAccounts: GlAccount[];
  onAddGlAccount: (account: { code: string; name: string; type: GlAccount['type'] }) => Promise<void>;
}

export const ChartOfAccountsView: React.FC<ChartOfAccountsViewProps> = ({
  glAccounts,
  onAddGlAccount,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<GlAccount['type']>('Expense');

  const filteredAccounts = glAccounts.filter(g => {
    if (typeFilter !== 'all' && g.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return g.code.toLowerCase().includes(q) || g.name.toLowerCase().includes(q);
    }
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) return;
    setIsSubmitting(true);
    try {
      await onAddGlAccount({ code, name, type });
      setShowAddModal(false);
      setCode('');
      setName('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>General Ledger Chart of Accounts</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative accounting categories used by the AI engine to code line items.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New GL Account</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search GL accounts by code or name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          {(['all', 'Expense', 'Cost of Goods Sold', 'Liability', 'Asset'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                typeFilter === t
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'all' ? 'All Types' : t}
            </button>
          ))}
        </div>
      </div>

      {/* GL Accounts Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50 shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0b101c] border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
            <tr>
              <th className="py-3 px-4 w-32">Account Code</th>
              <th className="py-3 px-4">Account Name</th>
              <th className="py-3 px-4">Financial Type</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">AI Predictive Coding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filteredAccounts.map(account => (
              <tr key={account.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-4 font-mono font-bold text-indigo-300">
                  {account.code}
                </td>
                <td className="py-3 px-4 font-medium text-white">{account.name}</td>
                <td className="py-3 px-4 text-slate-300">
                  <span className="text-[11px] px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-300">
                    {account.type}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                    Active
                  </span>
                </td>
                <td className="py-3 px-4 text-right text-slate-400 font-mono text-[11px]">
                  Enabled
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#101726] border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-400" />
                <span>New GL Account</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">Account Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 6070"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Account Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Telecommunications & Cellular"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Account Type</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Expense">Expense</option>
                  <option value="Cost of Goods Sold">Cost of Goods Sold</option>
                  <option value="Asset">Asset</option>
                  <option value="Liability">Liability</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded shadow-sm"
                >
                  {isSubmitting ? 'Saving...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
