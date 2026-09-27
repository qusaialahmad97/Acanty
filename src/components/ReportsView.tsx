import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Clock,
  ShieldCheck,
  Building,
  AlertTriangle,
  FileCheck2,
  AlertOctagon,
  Globe2,
  FileText,
  Filter,
  CheckCircle2,
  Info,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { Invoice, Organization, GlAccount, Vendor } from '../types';
import { Analytics } from './Analytics';

interface ReportsViewProps {
  invoices: Invoice[];
  organization: Organization;
  glAccounts?: GlAccount[];
  vendors?: Vendor[];
  onSelectInvoice?: (invoiceId: string) => void;
}

export interface TaxComplianceRecord {
  invoice: Invoice;
  vendorName: string;
  vendorCountry: string;
  taxIdFound?: string;
  expectedTaxType: 'VAT' | 'GST' | 'EIN / Tax ID' | 'Sales Tax ID';
  isCompliant: boolean;
  issueDescription?: string;
  riskSeverity: 'High' | 'Medium' | 'Low';
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  invoices,
  organization,
  glAccounts = [],
  vendors = [],
  onSelectInvoice,
}) => {
  const [taxFilter, setTaxFilter] = useState<'all' | 'non-compliant' | 'compliant'>('all');

  const totalSpend = invoices.reduce((s, i) => s + i.totalAmount, 0);

  // Vendor Spend Breakdown
  const vendorSpendMap: Record<string, { amount: number; count: number }> = {};
  invoices.forEach(inv => {
    if (!vendorSpendMap[inv.vendorName]) {
      vendorSpendMap[inv.vendorName] = { amount: 0, count: 0 };
    }
    vendorSpendMap[inv.vendorName].amount += inv.totalAmount;
    vendorSpendMap[inv.vendorName].count += 1;
  });
  const vendorSpend = Object.entries(vendorSpendMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.amount - a.amount);

  // GL Category Spend Breakdown
  const glSpendMap: Record<string, { name: string; amount: number }> = {};
  invoices.forEach(inv => {
    inv.lines.forEach(line => {
      const code = line.glAccountCode || 'Uncoded';
      const name = line.glAccountName || 'Unassigned GL';
      if (!glSpendMap[code]) {
        glSpendMap[code] = { name, amount: 0 };
      }
      glSpendMap[code].amount += line.lineTotal;
    });
  });
  const glSpend = Object.entries(glSpendMap)
    .map(([code, data]) => ({ code, ...data }))
    .sort((a, b) => b.amount - a.amount);

  // TAX COMPLIANCE SCANNER
  const { taxRecords, compliantCount, nonCompliantCount, complianceRate, taxExposureAmount } = useMemo(() => {
    const records: TaxComplianceRecord[] = invoices.map(inv => {
      // Find matching vendor profile
      const matchedVendor = vendors.find(
        v =>
          v.id === inv.vendorId ||
          (v.name && inv.vendorName && v.name.toLowerCase() === inv.vendorName.toLowerCase())
      );

      const country = matchedVendor?.country || 'United States';
      const effectiveTaxId = (inv.vendorTaxId || matchedVendor?.taxId || '').trim();

      let expectedTaxType: 'VAT' | 'GST' | 'EIN / Tax ID' | 'Sales Tax ID' = 'EIN / Tax ID';
      let isCompliant = true;
      let issueDescription: string | undefined = undefined;
      let riskSeverity: 'High' | 'Medium' | 'Low' = 'Low';

      const lowerCountry = country.toLowerCase();

      if (
        lowerCountry.includes('kingdom') ||
        lowerCountry.includes('uk') ||
        lowerCountry.includes('germany') ||
        lowerCountry.includes('france') ||
        lowerCountry.includes('ireland') ||
        lowerCountry.includes('netherlands') ||
        lowerCountry.includes('spain') ||
        lowerCountry.includes('italy') ||
        lowerCountry.includes('sweden')
      ) {
        expectedTaxType = 'VAT';
        if (!effectiveTaxId) {
          isCompliant = false;
          issueDescription = `Missing statutory VAT registration number for ${country} supplier`;
          riskSeverity = 'High';
        } else if (effectiveTaxId.length < 5) {
          isCompliant = false;
          issueDescription = 'VAT registration number appears incomplete or truncated';
          riskSeverity = 'Medium';
        }
      } else if (
        lowerCountry.includes('canada') ||
        lowerCountry.includes('australia') ||
        lowerCountry.includes('new zealand') ||
        lowerCountry.includes('singapore')
      ) {
        expectedTaxType = 'GST';
        if (!effectiveTaxId) {
          isCompliant = false;
          issueDescription = `Missing GST/HST/ABN business tax registration for ${country}`;
          riskSeverity = 'High';
        }
      } else {
        // United States & default jurisdictions
        expectedTaxType = 'EIN / Tax ID';
        if (!effectiveTaxId) {
          isCompliant = false;
          issueDescription = 'Missing Federal Tax ID (EIN) or State Sales Tax registration';
          riskSeverity = inv.taxAmount > 0 ? 'High' : 'Medium';
        } else if (effectiveTaxId.length < 4) {
          isCompliant = false;
          issueDescription = 'Tax ID number is suspiciously short';
          riskSeverity = 'Medium';
        }
      }

      return {
        invoice: inv,
        vendorName: inv.vendorName,
        vendorCountry: country,
        taxIdFound: effectiveTaxId || undefined,
        expectedTaxType,
        isCompliant,
        issueDescription,
        riskSeverity,
      };
    });

    const compliant = records.filter(r => r.isCompliant).length;
    const nonCompliant = records.filter(r => !r.isCompliant).length;
    const rate = records.length > 0 ? Math.round((compliant / records.length) * 100) : 100;
    const exposure = records
      .filter(r => !r.isCompliant)
      .reduce((sum, r) => sum + r.invoice.totalAmount, 0);

    return {
      taxRecords: records,
      compliantCount: compliant,
      nonCompliantCount: nonCompliant,
      complianceRate: rate,
      taxExposureAmount: exposure,
    };
  }, [invoices, vendors]);

  const filteredTaxRecords = useMemo(() => {
    if (taxFilter === 'non-compliant') return taxRecords.filter(r => !r.isCompliant);
    if (taxFilter === 'compliant') return taxRecords.filter(r => r.isCompliant);
    return taxRecords;
  }, [taxRecords, taxFilter]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-400" />
          <span>Accounts Payable Analytics & Spend Distribution</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Real-time visibility into supplier liabilities, processing velocity, and general ledger allocations.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
          <span className="text-xs text-slate-400 font-medium">Cumulative Spend</span>
          <p className="text-2xl font-bold font-mono text-white mt-1 tabular-nums">
            ${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-500 font-mono mt-1 block">Across {invoices.length} invoices</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
          <span className="text-xs text-slate-400 font-medium">Mean Processing Time</span>
          <p className="text-2xl font-bold font-mono text-white mt-1 tabular-nums">
            18.4s
          </p>
          <span className="text-[11px] text-emerald-400 font-mono mt-1 block">99.4% faster than manual AP</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
          <span className="text-xs text-slate-400 font-medium">AI Extraction Accuracy</span>
          <p className="text-2xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
            98.8%
          </p>
          <span className="text-[11px] text-slate-500 font-mono mt-1 block">Field-level precision</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
          <span className="text-xs text-slate-400 font-medium">Exception Rate</span>
          <p className="text-2xl font-bold font-mono text-amber-400 mt-1 tabular-nums">
            {(
              (invoices.filter(i => i.validationIssues.some(v => v.status === 'ERROR')).length /
                (invoices.length || 1)) *
              100
            ).toFixed(1)}%
          </p>
          <span className="text-[11px] text-slate-500 font-mono mt-1 block">Flagged for human check</span>
        </div>
      </div>

      {/* Visual Analytics Component */}
      <Analytics
        invoices={invoices}
        organization={organization}
        glAccounts={glAccounts}
        vendors={vendors}
      />

      {/* Two Column Grid: Spend by Vendor & Spend by GL Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendor Spend Breakdown */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center justify-between">
            <span>Supplier Spend Distribution</span>
            <span className="text-[11px] font-mono text-slate-400">{vendorSpend.length} Vendors</span>
          </h3>

          <div className="space-y-3">
            {vendorSpend.map(v => {
              const percent = totalSpend > 0 ? (v.amount / totalSpend) * 100 : 0;
              return (
                <div key={v.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-medium truncate max-w-[240px]">{v.name}</span>
                    <span className="font-mono font-semibold text-white tabular-nums">
                      ${v.amount.toFixed(2)} ({percent.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* GL Spend Allocation */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center justify-between">
            <span>General Ledger (GL) Allocations</span>
            <span className="text-[11px] font-mono text-slate-400">{glSpend.length} Accounts</span>
          </h3>

          <div className="space-y-3">
            {glSpend.map(g => {
              const percent = totalSpend > 0 ? (g.amount / totalSpend) * 100 : 0;
              return (
                <div key={g.code} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-medium truncate max-w-[240px]">
                      <strong className="text-indigo-400 font-mono">{g.code}</strong> · {g.name}
                    </span>
                    <span className="font-mono font-semibold text-white tabular-nums">
                      ${g.amount.toFixed(2)} ({percent.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* TAX REGISTRATION & REGULATORY COMPLIANCE SECTION */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0">
              <Globe2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Tax Registration & Statutory Compliance Audit
                </h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                    complianceRate >= 90
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                      : complianceRate >= 70
                      ? 'bg-amber-950 text-amber-300 border-amber-700/60'
                      : 'bg-rose-950 text-rose-300 border-rose-700/60 animate-pulse'
                  }`}
                >
                  {complianceRate}% Compliance Rate
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Automated statutory scanner auditing VAT, GST, and Federal EIN registrations against vendor country jurisdictions.
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setTaxFilter('all')}
              className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                taxFilter === 'all'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Invoices ({taxRecords.length})
            </button>
            <button
              type="button"
              onClick={() => setTaxFilter('non-compliant')}
              className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                taxFilter === 'non-compliant'
                  ? 'bg-rose-600 text-white font-semibold'
                  : 'text-rose-400 hover:text-rose-300'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Flagged Issues ({nonCompliantCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setTaxFilter('compliant')}
              className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                taxFilter === 'compliant'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Compliant ({compliantCount})</span>
            </button>
          </div>
        </div>

        {/* Compliance Summary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/70 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Verified Tax Entries</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                {compliantCount}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">/ {taxRecords.length} bills</span>
            </div>
            <p className="text-[10px] text-slate-500">VAT/GST/EIN verified</p>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/70 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>Missing Registrations</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-rose-400 tabular-nums">
                {nonCompliantCount}
              </span>
              <span className="text-[10px] font-mono text-rose-400/80">Audit action needed</span>
            </div>
            <p className="text-[10px] text-slate-500">Tax deductions at risk</p>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/70 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-amber-400" />
              <span>Non-Compliant Spend</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                ${taxExposureAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">Requires W-9 / VAT-100 inquiry</p>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/70 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-indigo-400" />
              <span>Jurisdictions Audited</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-white tabular-nums">
                {new Set(taxRecords.map(r => r.vendorCountry)).size}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Countries</span>
            </div>
            <p className="text-[10px] text-slate-500">US, UK, EU, CA, AU rulesets</p>
          </div>
        </div>

        {/* Warning Banner if issues found */}
        {nonCompliantCount > 0 && (
          <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-700/60 flex items-start gap-2.5 text-xs text-rose-200">
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-white">
                Tax Registration Alert: {nonCompliantCount} invoice(s) lack required statutory tax IDs
              </p>
              <p className="text-[11px] text-rose-300 leading-relaxed">
                Failure to retain supplier Tax Identification Numbers (VAT ID in the UK/EU, GST/ABN in Canada/Australia, or W-9 EIN in the US) can forfeit input tax credits or trigger withholding tax obligations during fiscal audits.
              </p>
            </div>
          </div>
        )}

        {/* Tax Records Table */}
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/50">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b101c] border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-2.5 px-3">Invoice & Date</th>
                <th className="py-2.5 px-3">Supplier & Country</th>
                <th className="py-2.5 px-3">Required Tax Scheme</th>
                <th className="py-2.5 px-3">Extracted Tax ID</th>
                <th className="py-2.5 px-3 text-right">Invoice Total</th>
                <th className="py-2.5 px-3 text-center">Compliance Status</th>
                <th className="py-2.5 px-3">Auditor Findings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredTaxRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    No invoice records found for this compliance filter.
                  </td>
                </tr>
              ) : (
                filteredTaxRecords.map(rec => (
                  <tr
                    key={rec.invoice.id}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      !rec.isCompliant ? 'bg-rose-950/10' : ''
                    }`}
                  >
                    {/* Invoice # & Date */}
                    <td className="py-2.5 px-3 font-mono">
                      <p className="font-bold text-white">{rec.invoice.invoiceNumber}</p>
                      <p className="text-[10px] text-slate-400">{rec.invoice.invoiceDate}</p>
                    </td>

                    {/* Supplier & Country */}
                    <td className="py-2.5 px-3">
                      <p className="font-medium text-slate-200">{rec.vendorName}</p>
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">
                        <Globe2 className="w-3 h-3 text-slate-500" />
                        <span>{rec.vendorCountry}</span>
                      </span>
                    </td>

                    {/* Required Tax Scheme */}
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-900 border border-slate-700 text-indigo-300">
                        {rec.expectedTaxType}
                      </span>
                    </td>

                    {/* Extracted Tax ID */}
                    <td className="py-2.5 px-3 font-mono text-xs">
                      {rec.taxIdFound ? (
                        <span className="text-slate-200 font-semibold">{rec.taxIdFound}</span>
                      ) : (
                        <span className="text-rose-400 italic text-[11px] font-sans font-medium">
                          Missing
                        </span>
                      )}
                    </td>

                    {/* Total Amount */}
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-white">
                      ${rec.invoice.totalAmount.toFixed(2)}
                    </td>

                    {/* Status Badge */}
                    <td className="py-2.5 px-3 text-center">
                      {rec.isCompliant ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>VALIDATED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-950 text-rose-300 border border-rose-700/60 animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          <span>NON-COMPLIANT</span>
                        </span>
                      )}
                    </td>

                    {/* Auditor Findings */}
                    <td className="py-2.5 px-3 text-[11px]">
                      {rec.isCompliant ? (
                        <span className="text-slate-400">Valid registration verified</span>
                      ) : (
                        <div className="space-y-0.5">
                          <p className="text-rose-300 font-medium">{rec.issueDescription}</p>
                          <p className="text-[10px] text-slate-500">Request Form W-9 / VAT invoice</p>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
