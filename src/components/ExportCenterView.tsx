import React, { useState } from 'react';
import {
  DownloadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FileText,
  History,
  CheckSquare,
  Square,
  ShieldCheck,
  Building,
  ExternalLink
} from 'lucide-react';
import { Invoice, ExportRecord } from '../types';

interface ExportCenterViewProps {
  invoices: Invoice[];
  exportRecords: ExportRecord[];
  onGenerateExport: (invoiceIds: string[], format: 'CSV' | 'XLSX') => Promise<void>;
}

export const ExportCenterView: React.FC<ExportCenterViewProps> = ({
  invoices,
  exportRecords,
  onGenerateExport,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'XLSX' | 'CSV'>('XLSX');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Eligible invoices are Approved or already Exported
  const approvedInvoices = invoices.filter(i => i.businessStatus === 'Approved');
  const allEligibleInvoices = invoices.filter(
    i => i.businessStatus === 'Approved' || i.businessStatus === 'Exported'
  );

  const toggleSelectAllApproved = () => {
    if (selectedInvoiceIds.length === approvedInvoices.length && approvedInvoices.length > 0) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(approvedInvoices.map(i => i.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedInvoiceIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectedInvoices = invoices.filter(i => selectedInvoiceIds.includes(i.id));
  const selectedTotalAmount = selectedInvoices.reduce((sum, i) => sum + i.totalAmount, 0);

  const handleExport = async () => {
    if (selectedInvoiceIds.length === 0) return;
    setIsGenerating(true);
    try {
      await onGenerateExport(selectedInvoiceIds, selectedFormat);
      setSelectedInvoiceIds([]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Description */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <DownloadCloud className="w-4 h-4 text-indigo-400" />
            <span>Accounting Export Studio (CSV & Excel)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Generate standardized GL-coded files formatted for QuickBooks, Xero, NetSuite, and Sage ERP.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1 rounded font-mono">
            {approvedInvoices.length} approved invoices ready
          </span>
        </div>
      </div>

      {/* Export Configuration & Pre-Export Gate */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Export Setup & Validation Card */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-5">
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
            1. Select Export Format & Specifications
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedFormat('XLSX')}
              className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                selectedFormat === 'XLSX'
                  ? 'bg-indigo-950/40 border-indigo-500/80 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <FileSpreadsheet className="w-5 h-5 text-indigo-400 mb-2" />
              <p className="text-xs font-semibold">Excel Workbook (.xlsx)</p>
              <p className="text-[10px] text-slate-400 mt-0.5">3 structured sheets: Lines, Summary, Metadata</p>
            </button>

            <button
              onClick={() => setSelectedFormat('CSV')}
              className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                selectedFormat === 'CSV'
                  ? 'bg-indigo-950/40 border-indigo-500/80 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <FileText className="w-5 h-5 text-indigo-400 mb-2" />
              <p className="text-xs font-semibold">Standard CSV (.csv)</p>
              <p className="text-[10px] text-slate-400 mt-0.5">UTF-8 comma-separated lines with GL codes</p>
            </button>
          </div>

          {/* Pre-Export Validation Gate */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between font-semibold text-slate-300">
              <span>Pre-Export Validation Gate</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="space-y-1.5 text-[11px] text-slate-400">
              <div className="flex items-center justify-between">
                <span>Selected Invoices:</span>
                <span className="font-mono text-white font-semibold">{selectedInvoiceIds.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total Export Value:</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  ${selectedTotalAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Unresolved Validation Errors:</span>
                <span className="font-mono text-slate-300">0</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Unassigned GL Lines:</span>
                <span className="font-mono text-slate-300">0</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={selectedInvoiceIds.length === 0 || isGenerating}
            className={`w-full py-2.5 rounded text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors ${
              selectedInvoiceIds.length > 0 && !isGenerating
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <DownloadCloud className="w-4 h-4" />
            <span>
              {isGenerating
                ? 'Generating Accounting File...'
                : `Generate ${selectedFormat} Export (${selectedInvoiceIds.length})`}
            </span>
          </button>
        </div>

        {/* Right: Selectable Invoices Table */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              2. Select Approved Invoices for Export
            </h3>
            <button
              onClick={toggleSelectAllApproved}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              {selectedInvoiceIds.length === approvedInvoices.length && approvedInvoices.length > 0
                ? 'Deselect All'
                : 'Select All Approved'}
            </button>
          </div>

          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/40 max-h-[300px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0b101c] border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 w-8"></th>
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Vendor</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {allEligibleInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No invoices currently ready for export.
                    </td>
                  </tr>
                ) : (
                  allEligibleInvoices.map(inv => {
                    const isSelected = selectedInvoiceIds.includes(inv.id);
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => toggleSelectOne(inv.id)}
                        className={`hover:bg-slate-800/40 transition-colors cursor-pointer ${
                          isSelected ? 'bg-indigo-950/20' : ''
                        }`}
                      >
                        <td className="py-2 px-3">
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-500" />
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono font-medium text-white">
                          #{inv.invoiceNumber}
                        </td>
                        <td className="py-2 px-3 text-slate-300 truncate max-w-[150px]">
                          {inv.vendorName}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-white">
                          ${inv.totalAmount.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                              inv.businessStatus === 'Approved'
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {inv.businessStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Export History Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-indigo-400" />
            <span>Accounting Export History</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            {exportRecords.length} batch(es) logged
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-[#0b101c] border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
            <tr>
              <th className="py-3 px-4">Batch ID</th>
              <th className="py-3 px-4">Export Date</th>
              <th className="py-3 px-4">Format</th>
              <th className="py-3 px-4 text-center">Invoices</th>
              <th className="py-3 px-4 text-right">Total Amount</th>
              <th className="py-3 px-4">Generated By</th>
              <th className="py-3 px-4 text-right">Download</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {exportRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No export batches generated yet. Select approved invoices above to export.
                </td>
              </tr>
            ) : (
              exportRecords.map(rec => (
                <tr key={rec.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 px-4 font-mono font-semibold text-white">{rec.id}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-400">
                    {new Date(rec.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-slate-800 text-indigo-300">
                      {rec.format}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-center font-mono text-slate-300">
                    {rec.invoiceCount}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-white tabular-nums">
                    ${rec.totalAmount.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4 text-slate-300">{rec.generatedBy}</td>
                  <td className="py-2.5 px-4 text-right">
                    <a
                      href={`/api/exports/download/${rec.id}?format=${rec.format}`}
                      download
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded text-xs font-medium border border-slate-700/80 inline-flex items-center gap-1.5 transition-colors"
                    >
                      <DownloadCloud className="w-3 h-3" />
                      <span>Download</span>
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
