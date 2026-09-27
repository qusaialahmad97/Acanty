import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Calendar,
  Building2,
  BookOpen,
  Layers,
  ArrowUpRight,
  Filter,
  Sparkles,
  PieChart as PieIcon,
  ChevronRight,
} from 'lucide-react';
import { Invoice, Organization, GlAccount, Vendor } from '../types';

interface AnalyticsProps {
  invoices: Invoice[];
  organization: Organization;
  glAccounts?: GlAccount[];
  vendors?: Vendor[];
  onNavigateTab?: (tab: string, filterStatus?: string) => void;
  className?: string;
}

// Sophisticated SaaS color palette
const PALETTE = [
  '#6366f1', // Indigo
  '#0ea5e9', // Sky
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f43f5e', // Rose
];

export const Analytics: React.FC<AnalyticsProps> = ({
  invoices,
  organization,
  glAccounts = [],
  vendors = [],
  onNavigateTab,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'trends' | 'vendors' | 'glCategories'>('trends');
  const [timeRange, setTimeRange] = useState<'all' | 'last3' | 'q3'>('all');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  // Filter invoices based on timeRange
  const scopedInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (!inv.invoiceDate) return false;
      const date = inv.invoiceDate.split('T')[0];
      if (timeRange === 'last3') {
        return date >= '2026-07-01' && date <= '2026-09-30';
      }
      if (timeRange === 'q3') {
        return date >= '2026-07-01' && date <= '2026-09-30';
      }
      return true; // 'all'
    });
  }, [invoices, timeRange]);

  // Aggregate by Month
  const monthlyData = useMemo(() => {
    const map: Record<
      string,
      {
        monthKey: string;
        displayMonth: string;
        totalSpend: number;
        invoiceCount: number;
        vendors: Record<string, number>;
        categories: Record<string, number>;
      }
    > = {};

    scopedInvoices.forEach(inv => {
      if (!inv.invoiceDate) return;
      const dateStr = inv.invoiceDate.split('T')[0];
      const [year, month] = dateStr.split('-');
      if (!year || !month) return;
      const key = `${year}-${month}`;

      if (!map[key]) {
        const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
        const displayMonth = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        map[key] = {
          monthKey: key,
          displayMonth,
          totalSpend: 0,
          invoiceCount: 0,
          vendors: {},
          categories: {},
        };
      }

      const invAmount = inv.totalAmount || 0;
      map[key].totalSpend += invAmount;
      map[key].invoiceCount += 1;

      // Vendor spend
      const vName = inv.vendorName || 'Other Suppliers';
      map[key].vendors[vName] = (map[key].vendors[vName] || 0) + invAmount;

      // Category spend from lines
      if (inv.lines && inv.lines.length > 0) {
        inv.lines.forEach(line => {
          const cat = line.glAccountName || 'General Expense';
          map[key].categories[cat] = (map[key].categories[cat] || 0) + (line.lineTotal || 0);
        });
      } else {
        const cat = 'Unassigned Expense';
        map[key].categories[cat] = (map[key].categories[cat] || 0) + invAmount;
      }
    });

    return Object.values(map).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [scopedInvoices]);

  // Top Vendors across scoped data
  const topVendors = useMemo(() => {
    const map: Record<string, number> = {};
    scopedInvoices.forEach(inv => {
      const vName = inv.vendorName || 'Other Suppliers';
      map[vName] = (map[vName] || 0) + (inv.totalAmount || 0);
    });
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [scopedInvoices]);

  // Top GL Categories across scoped data
  const topCategories = useMemo(() => {
    const map: Record<string, number> = {};
    scopedInvoices.forEach(inv => {
      if (inv.lines && inv.lines.length > 0) {
        inv.lines.forEach(l => {
          const cat = l.glAccountName || 'General Expense';
          map[cat] = (map[cat] || 0) + (l.lineTotal || 0);
        });
      } else {
        map['Unassigned Expense'] = (map['Unassigned Expense'] || 0) + (inv.totalAmount || 0);
      }
    });
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [scopedInvoices]);

  // Formatted data for Vendor Stacked Bar Chart
  const vendorChartData = useMemo(() => {
    const top4Vendors = topVendors.slice(0, 4).map(v => v.name);
    return monthlyData.map(m => {
      const row: any = {
        month: m.displayMonth,
        monthKey: m.monthKey,
        Total: m.totalSpend,
      };
      let otherTotal = 0;
      Object.entries(m.vendors).forEach(([vName, amt]) => {
        if (top4Vendors.includes(vName)) {
          row[vName] = Math.round(amt);
        } else {
          otherTotal += amt;
        }
      });
      if (otherTotal > 0) {
        row['Other Vendors'] = Math.round(otherTotal);
      }
      return row;
    });
  }, [monthlyData, topVendors]);

  // Formatted data for GL Category Stacked Bar Chart
  const categoryChartData = useMemo(() => {
    const top4Cats = topCategories.slice(0, 4).map(c => c.name);
    return monthlyData.map(m => {
      const row: any = {
        month: m.displayMonth,
        monthKey: m.monthKey,
        Total: m.totalSpend,
      };
      let otherTotal = 0;
      Object.entries(m.categories).forEach(([cName, amt]) => {
        if (top4Cats.includes(cName)) {
          row[cName] = Math.round(amt);
        } else {
          otherTotal += amt;
        }
      });
      if (otherTotal > 0) {
        row['Other GL Accounts'] = Math.round(otherTotal);
      }
      return row;
    });
  }, [monthlyData, topCategories]);

  // Summary Metrics
  const totalSpend = useMemo(
    () => scopedInvoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0),
    [scopedInvoices]
  );

  const avgMonthlySpend = useMemo(() => {
    if (monthlyData.length === 0) return 0;
    return totalSpend / monthlyData.length;
  }, [totalSpend, monthlyData]);

  const peakMonth = useMemo(() => {
    if (monthlyData.length === 0) return null;
    return [...monthlyData].sort((a, b) => b.totalSpend - a.totalSpend)[0];
  }, [monthlyData]);

  // Month-over-month change for latest 2 months
  const momGrowth = useMemo(() => {
    if (monthlyData.length < 2) return 0;
    const latest = monthlyData[monthlyData.length - 1].totalSpend;
    const prev = monthlyData[monthlyData.length - 2].totalSpend;
    if (prev === 0) return 0;
    return ((latest - prev) / prev) * 100;
  }, [monthlyData]);

  // Custom Recharts Dark Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0f172a] border border-slate-700/80 rounded-xl p-3 shadow-2xl text-xs space-y-1.5 min-w-[200px]">
          <p className="font-semibold text-white border-b border-slate-800 pb-1 flex items-center justify-between">
            <span>{label}</span>
            <span className="text-[10px] text-slate-400 font-mono">AP Spend</span>
          </p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={`item-${index}`} className="flex items-center justify-between text-[11px] gap-3">
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: entry.color || entry.fill }}
                  />
                  <span className="text-slate-300 truncate max-w-[140px]">{entry.name}</span>
                </div>
                <span className="font-mono font-semibold text-white tabular-nums">
                  ${Number(entry.value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-5 shadow-sm ${className}`}>
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-950/70 border border-indigo-700/50 rounded-lg text-indigo-400">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Spend Trends & Analytics
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60">
              Live Recharts
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Monthly accounts payable trends grouped by supplier volume and general ledger classification.
          </p>
        </div>

        {/* View Switcher & Timeframe Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Tabs */}
          <div className="bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 flex items-center text-xs">
            <button
              onClick={() => setActiveTab('trends')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                activeTab === 'trends'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Overall Trend
            </button>
            <button
              onClick={() => setActiveTab('vendors')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                activeTab === 'vendors'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              By Vendor
            </button>
            <button
              onClick={() => setActiveTab('glCategories')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                activeTab === 'glCategories'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              By GL Category
            </button>
          </div>

          {/* Time Range Filter */}
          <div className="bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 flex items-center text-xs">
            <button
              onClick={() => setTimeRange('all')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                timeRange === 'all' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeRange('last3')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                timeRange === 'last3' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Q3 2026
            </button>
          </div>
        </div>
      </div>

      {/* KPI Insight Micro-Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Total Spend</span>
            <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
          </span>
          <p className="text-xl font-bold font-mono text-white tabular-nums">
            ${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <div className="flex items-center gap-1 text-[10px] font-mono">
            {momGrowth >= 0 ? (
              <span className="text-emerald-400 flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" />+{momGrowth.toFixed(1)}% MoM
              </span>
            ) : (
              <span className="text-rose-400 flex items-center">
                <TrendingDown className="w-3 h-3 mr-0.5" />{momGrowth.toFixed(1)}% MoM
              </span>
            )}
            <span className="text-slate-500">· {scopedInvoices.length} bills</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Avg Monthly Run Rate</span>
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
          </span>
          <p className="text-xl font-bold font-mono text-white tabular-nums">
            ${avgMonthlySpend.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <span className="text-[10px] text-slate-400 font-mono block">
            Across {monthlyData.length} recorded months
          </span>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Top Supplier</span>
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
          </span>
          <p className="text-sm font-bold text-white truncate" title={topVendors[0]?.name}>
            {topVendors[0]?.name || 'N/A'}
          </p>
          <span className="text-[10px] text-amber-300 font-mono block">
            ${(topVendors[0]?.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
            ({totalSpend ? Math.round(((topVendors[0]?.amount || 0) / totalSpend) * 100) : 0}% of spend)
          </span>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Leading GL Account</span>
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
          </span>
          <p className="text-sm font-bold text-white truncate" title={topCategories[0]?.name}>
            {topCategories[0]?.name || 'N/A'}
          </p>
          <span className="text-[10px] text-emerald-400 font-mono block">
            ${(topCategories[0]?.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
            ({totalSpend ? Math.round(((topCategories[0]?.amount || 0) / totalSpend) * 100) : 0}% share)
          </span>
        </div>
      </div>

      {/* Main Chart Visualization Section */}
      <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4">
        {/* Sub-header inside chart card */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <h4 className="text-xs font-semibold text-slate-200">
              {activeTab === 'trends' && 'Monthly Aggregate Spend Trajectory'}
              {activeTab === 'vendors' && 'Monthly Spend Distribution by Top Suppliers'}
              {activeTab === 'glCategories' && 'Monthly Spend Distribution by General Ledger Account'}
            </h4>
          </div>

          {activeTab === 'trends' && (
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-0.5 text-[11px]">
              <button
                onClick={() => setChartType('area')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  chartType === 'area' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400'
                }`}
              >
                Area
              </button>
              <button
                onClick={() => setChartType('bar')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  chartType === 'bar' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400'
                }`}
              >
                Bar
              </button>
            </div>
          )}
        </div>

        {/* 1. Overall Trends Chart */}
        {activeTab === 'trends' && (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="displayMonth"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={val => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="totalSpend"
                    name="Monthly Spend"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#spendGradient)"
                  />
                </AreaChart>
              ) : (
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="displayMonth"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={val => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="totalSpend" name="Monthly Spend" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* 2. Spend by Vendor Stacked Bar Chart */}
        {activeTab === 'vendors' && (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendorChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={val => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  formatter={(value: string) => <span className="text-slate-300">{value}</span>}
                />
                {topVendors.slice(0, 4).map((v, idx) => (
                  <Bar
                    key={v.name}
                    dataKey={v.name}
                    stackId="a"
                    fill={PALETTE[idx % PALETTE.length]}
                    radius={idx === 3 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
                <Bar
                  dataKey="Other Vendors"
                  stackId="a"
                  fill="#475569"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 3. Spend by GL Category Stacked Bar Chart */}
        {activeTab === 'glCategories' && (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={val => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  formatter={(value: string) => <span className="text-slate-300">{value}</span>}
                />
                {topCategories.slice(0, 4).map((c, idx) => (
                  <Bar
                    key={c.name}
                    dataKey={c.name}
                    stackId="gl"
                    fill={PALETTE[(idx + 2) % PALETTE.length]}
                    radius={idx === 3 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
                <Bar
                  dataKey="Other GL Accounts"
                  stackId="gl"
                  fill="#475569"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Distribution Breakdown Panels: Top Suppliers & GL Allocations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Vendors Progress List */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Spend Share by Supplier</span>
            </span>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('vendors')}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-0.5 cursor-pointer"
              >
                <span>Directory</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {topVendors.slice(0, 5).map((v, i) => {
              const percent = totalSpend ? Math.round((v.amount / totalSpend) * 100) : 0;
              return (
                <div key={v.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-medium truncate max-w-[200px]" title={v.name}>
                      {v.name}
                    </span>
                    <span className="font-mono text-white tabular-nums">
                      ${v.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                      <span className="text-slate-500 font-normal">({percent}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: PALETTE[i % PALETTE.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top GL Categories Progress List */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>General Ledger Expense Allocation</span>
            </span>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('gl-accounts')}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-0.5 cursor-pointer"
              >
                <span>Chart of Accounts</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {topCategories.slice(0, 5).map((c, i) => {
              const percent = totalSpend ? Math.round((c.amount / totalSpend) * 100) : 0;
              return (
                <div key={c.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-medium truncate max-w-[200px]" title={c.name}>
                      {c.name}
                    </span>
                    <span className="font-mono text-white tabular-nums">
                      ${c.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                      <span className="text-slate-500 font-normal">({percent}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: PALETTE[(i + 2) % PALETTE.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
