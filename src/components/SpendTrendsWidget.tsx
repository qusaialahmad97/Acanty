import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Layers,
  Sparkles,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle2,
  DollarSign,
  Filter,
  PieChart as PieIcon,
  ChevronRight,
  RefreshCw,
  Eye,
  Info,
} from 'lucide-react';
import { Invoice, GlAccount } from '../types';

interface SpendTrendsWidgetProps {
  invoices: Invoice[];
  glAccounts?: GlAccount[];
  onNavigateTab?: (tab: string, filterStatus?: string) => void;
  className?: string;
}

// Sophisticated AP Category color mapping
const CATEGORY_COLORS: Record<string, string> = {
  'Software & Cloud Infrastructure': '#6366f1', // Indigo
  'Office Rent & Facilities': '#3b82f6', // Blue
  'Hardware & Tech Equipment': '#10b981', // Emerald
  'Professional & Legal Advisory': '#f59e0b', // Amber
  'Legal & Professional Services': '#f59e0b', // Amber (alias)
  'Hosting & Server Subscriptions': '#8b5cf6', // Violet
  'Marketing & Digital Advertising': '#ec4899', // Pink
  'Travel, Lodging & Client Meals': '#06b6d4', // Cyan
  'Accounts Payable Clearing': '#64748b', // Slate
  'General Expense': '#94a3b8', // Gray
  'Other Categories': '#cbd5e1', // Light Slate
};

const FALLBACK_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f43f5e',
  '#14b8a6',
];

export const SpendTrendsWidget: React.FC<SpendTrendsWidgetProps> = ({
  invoices,
  glAccounts = [],
  onNavigateTab,
  className = '',
}) => {
  const [timeRange, setTimeRange] = useState<'all' | 'last3' | 'last6'>('all');
  const [chartType, setChartType] = useState<'stacked' | 'area' | 'grouped' | 'percent'>('stacked');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Map GL accounts by ID for fast lookup
  const glMap = useMemo(() => {
    const map = new Map<string, string>();
    glAccounts.forEach(gl => {
      map.set(gl.id, gl.name);
    });
    return map;
  }, [glAccounts]);

  // Normalize category name
  const resolveCategoryName = (lineGlName?: string, lineGlId?: string): string => {
    if (lineGlName && lineGlName.trim()) {
      if (lineGlName === 'Legal & Professional Services') return 'Professional & Legal Advisory';
      return lineGlName;
    }
    if (lineGlId && glMap.has(lineGlId)) {
      const mapped = glMap.get(lineGlId)!;
      if (mapped === 'Legal & Professional Services') return 'Professional & Legal Advisory';
      return mapped;
    }
    return 'Software & Cloud Infrastructure';
  };

  // Filter invoices by time range
  const scopedInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (!inv.invoiceDate) return false;
      const date = inv.invoiceDate.split('T')[0];
      if (timeRange === 'last3') {
        return date >= '2026-07-01' && date <= '2026-09-30';
      }
      if (timeRange === 'last6') {
        return date >= '2026-04-01' && date <= '2026-09-30';
      }
      return true;
    });
  }, [invoices, timeRange]);

  // Aggregate monthly totals by category
  const { monthlyData, allCategories } = useMemo(() => {
    const monthMap: Record<
      string,
      {
        monthKey: string;
        displayMonth: string;
        totalSpend: number;
        invoiceCount: number;
        categories: Record<string, number>;
      }
    > = {};

    const categorySet = new Set<string>();

    scopedInvoices.forEach(inv => {
      if (!inv.invoiceDate) return;
      const dateStr = inv.invoiceDate.split('T')[0];
      const [year, month] = dateStr.split('-');
      if (!year || !month) return;
      const key = `${year}-${month}`;

      if (!monthMap[key]) {
        const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
        const displayMonth = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        monthMap[key] = {
          monthKey: key,
          displayMonth,
          totalSpend: 0,
          invoiceCount: 0,
          categories: {},
        };
      }

      monthMap[key].invoiceCount += 1;
      const invTotal = inv.totalAmount || 0;
      monthMap[key].totalSpend += invTotal;

      if (inv.lines && inv.lines.length > 0) {
        inv.lines.forEach(line => {
          const cat = resolveCategoryName(line.glAccountName, line.glAccountId);
          categorySet.add(cat);
          const lineVal = line.lineTotal || 0;
          monthMap[key].categories[cat] = (monthMap[key].categories[cat] || 0) + lineVal;
        });
      } else {
        const cat = 'General Expense';
        categorySet.add(cat);
        monthMap[key].categories[cat] = (monthMap[key].categories[cat] || 0) + invTotal;
      }
    });

    const sortedMonths = Object.values(monthMap).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    return {
      monthlyData: sortedMonths,
      allCategories: Array.from(categorySet),
    };
  }, [scopedInvoices, glMap]);

  // Overall Category Spend Summary
  const categorySummaries = useMemo(() => {
    const totals: Record<string, { total: number; latestMonth: number; previousMonth: number; monthlyAmounts: number[] }> = {};

    allCategories.forEach(cat => {
      totals[cat] = { total: 0, latestMonth: 0, previousMonth: 0, monthlyAmounts: [] };
    });

    const monthCount = monthlyData.length;
    const latestMonthObj = monthCount > 0 ? monthlyData[monthCount - 1] : null;
    const prevMonthObj = monthCount > 1 ? monthlyData[monthCount - 2] : null;

    monthlyData.forEach(m => {
      allCategories.forEach(cat => {
        const val = m.categories[cat] || 0;
        totals[cat].total += val;
        totals[cat].monthlyAmounts.push(val);
      });
    });

    allCategories.forEach(cat => {
      totals[cat].latestMonth = latestMonthObj?.categories[cat] || 0;
      totals[cat].previousMonth = prevMonthObj?.categories[cat] || 0;
    });

    const overallTotal = Object.values(totals).reduce((sum, item) => sum + item.total, 0);

    return Object.entries(totals)
      .map(([name, data]) => {
        const pctOfTotal = overallTotal > 0 ? (data.total / overallTotal) * 100 : 0;
        const momGrowth =
          data.previousMonth > 0
            ? ((data.latestMonth - data.previousMonth) / data.previousMonth) * 100
            : data.latestMonth > 0
            ? 100
            : 0;

        // Pattern Classification
        let patternTag = 'Stable';
        if (momGrowth > 20) patternTag = 'Surging';
        else if (momGrowth < -15) patternTag = 'Decreasing';
        else if (pctOfTotal > 30) patternTag = 'Primary Driver';

        return {
          name,
          total: data.total,
          latestMonth: data.latestMonth,
          previousMonth: data.previousMonth,
          pctOfTotal,
          momGrowth,
          patternTag,
          color: CATEGORY_COLORS[name] || FALLBACK_COLORS[Math.abs(name.length) % FALLBACK_COLORS.length],
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [allCategories, monthlyData]);

  // Formatted data for Recharts
  const chartData = useMemo(() => {
    return monthlyData.map(m => {
      const row: Record<string, any> = {
        month: m.displayMonth,
        monthKey: m.monthKey,
        _totalSpend: m.totalSpend,
        _invoiceCount: m.invoiceCount,
      };

      let sum = 0;
      allCategories.forEach(cat => {
        const val = Math.round(m.categories[cat] || 0);
        row[cat] = val;
        sum += val;
      });

      // Percent distribution calculation for 100% chart
      if (chartType === 'percent' && sum > 0) {
        allCategories.forEach(cat => {
          row[cat] = Number(((row[cat] / sum) * 100).toFixed(1));
        });
      }

      return row;
    });
  }, [monthlyData, allCategories, chartType]);

  // Detected Patterns & Insights
  const patterns = useMemo(() => {
    if (categorySummaries.length === 0 || monthlyData.length < 2) return [];

    const insights = [];

    // 1. Highest Spender
    const topSpender = categorySummaries[0];
    if (topSpender && topSpender.total > 0) {
      insights.push({
        type: 'driver',
        title: 'Largest Spend Driver',
        category: topSpender.name,
        color: topSpender.color,
        description: `${topSpender.name} represents ${topSpender.pctOfTotal.toFixed(0)}% ($${Math.round(
          topSpender.total
        ).toLocaleString()}) of cumulative accounts payable.`,
        metric: `${topSpender.pctOfTotal.toFixed(0)}% of AP`,
        icon: DollarSign,
      });
    }

    // 2. Fastest Growing / Surging Category
    const surging = [...categorySummaries]
      .filter(c => c.previousMonth > 0 && c.latestMonth > 0)
      .sort((a, b) => b.momGrowth - a.momGrowth)[0];

    if (surging && surging.momGrowth > 10) {
      insights.push({
        type: 'surge',
        title: 'Spending Surge Pattern',
        category: surging.name,
        color: surging.color,
        description: `${surging.name} accelerated by +${surging.momGrowth.toFixed(
          0
        )}% month-over-month, rising to $${Math.round(surging.latestMonth).toLocaleString()} in the latest billing cycle.`,
        metric: `+${surging.momGrowth.toFixed(0)}% MoM`,
        icon: TrendingUp,
      });
    }

    // 3. Decreasing / Cost Reduction Pattern
    const decreasing = [...categorySummaries]
      .filter(c => c.previousMonth > 0 && c.latestMonth > 0)
      .sort((a, b) => a.momGrowth - b.momGrowth)[0];

    if (decreasing && decreasing.momGrowth < -5) {
      insights.push({
        type: 'reduction',
        title: 'Cost Contraction Pattern',
        category: decreasing.name,
        color: decreasing.color,
        description: `${decreasing.name} decreased by ${Math.abs(decreasing.momGrowth).toFixed(
          0
        )}% compared to the prior period ($${Math.round(decreasing.latestMonth).toLocaleString()}).`,
        metric: `${decreasing.momGrowth.toFixed(0)}% MoM`,
        icon: TrendingDown,
      });
    }

    // 4. Fixed / Predictable Overhead
    const stable = categorySummaries.find(
      c => Math.abs(c.momGrowth) <= 5 && c.total > 5000 && c.previousMonth > 0
    );
    if (stable) {
      insights.push({
        type: 'stable',
        title: 'Stable Fixed Overhead',
        category: stable.name,
        color: stable.color,
        description: `${stable.name} exhibits predictable recurring run-rate of ~$${Math.round(
          stable.latestMonth
        ).toLocaleString()}/month with minimal variance.`,
        metric: 'Stable',
        icon: CheckCircle2,
      });
    }

    return insights;
  }, [categorySummaries, monthlyData]);

  // Key KPI numbers
  const totalPeriodSpend = useMemo(
    () => scopedInvoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0),
    [scopedInvoices]
  );

  const currentMonthSpend = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].totalSpend : 0;
  const prevMonthSpend = monthlyData.length > 1 ? monthlyData[monthlyData.length - 2].totalSpend : 0;
  const overallMoMGrowth =
    prevMonthSpend > 0 ? ((currentMonthSpend - prevMonthSpend) / prevMonthSpend) * 100 : 0;

  // Custom Recharts Dark Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const monthTotal = payload[0]?.payload?._totalSpend || 0;
      const invCount = payload[0]?.payload?._invoiceCount || 0;

      return (
        <div className="bg-[#0b101c] border border-slate-700/80 rounded-xl p-3.5 shadow-2xl text-xs space-y-2 min-w-[240px] backdrop-blur-md">
          <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
            <div>
              <span className="font-bold text-white text-sm">{label}</span>
              <p className="text-[10px] text-slate-400">{invCount} processed invoices</p>
            </div>
            {chartType !== 'percent' && (
              <span className="font-mono font-bold text-indigo-300 text-sm">
                ${monthTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>

          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
            {payload
              .filter((entry: any) => entry.value > 0)
              .sort((a: any, b: any) => b.value - a.value)
              .map((entry: any, index: number) => {
                const color = entry.color || entry.fill;
                const valueFormatted =
                  chartType === 'percent'
                    ? `${entry.value}%`
                    : `$${Number(entry.value).toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}`;

                return (
                  <div key={`item-${index}`} className="flex items-center justify-between text-[11px] gap-2">
                    <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-slate-300 truncate">{entry.name}</span>
                    </div>
                    <span className="font-mono font-semibold text-white tabular-nums">{valueFormatted}</span>
                  </div>
                );
              })}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className={`bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-5 shadow-sm transition-all ${className}`}
    >
      {/* Widget Header & Pattern Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-950/80 border border-indigo-700/60 rounded-lg text-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>Spend Trends</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-semibold">
                Recharts Analytics
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Visualize monthly invoice totals broken down by GL expense category to identify spending velocity, anomalies,
            and cost allocation patterns.
          </p>
        </div>

        {/* Controls: Chart Type & Time Period */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Type Toggle */}
          <div className="bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 flex items-center text-xs">
            <button
              onClick={() => setChartType('stacked')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1 ${
                chartType === 'stacked'
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Stacked Category Bars (Total Monthly Spend)"
            >
              <BarChart3 className="w-3 h-3" />
              <span>Stacked</span>
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1 ${
                chartType === 'area'
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Continuous Category Spend Streams"
            >
              <TrendingUp className="w-3 h-3" />
              <span>Area Stream</span>
            </button>
            <button
              onClick={() => setChartType('grouped')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1 ${
                chartType === 'grouped'
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Side-by-Side Category Comparison"
            >
              <Layers className="w-3 h-3" />
              <span>Grouped</span>
            </button>
            <button
              onClick={() => setChartType('percent')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1 ${
                chartType === 'percent'
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="100% Proportional Budget Allocation"
            >
              <PieIcon className="w-3 h-3" />
              <span>% Share</span>
            </button>
          </div>

          {/* Time Range Filter */}
          <div className="bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 flex items-center text-xs">
            <button
              onClick={() => setTimeRange('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                timeRange === 'all' ? 'bg-slate-800 text-slate-100 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeRange('last6')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                timeRange === 'last6' ? 'bg-slate-800 text-slate-100 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              6 Months
            </button>
            <button
              onClick={() => setTimeRange('last3')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                timeRange === 'last3' ? 'bg-slate-800 text-slate-100 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Q3 2026
            </button>
          </div>
        </div>
      </div>

      {scopedInvoices.length === 0 ? (
        <div className="bg-[#0b101c] border border-slate-800 rounded-xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-slate-200">No Historical Spend Data</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Upload your company invoices to populate multi-month spending trendlines, automated category allocations, and month-over-month variance analytics.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Top Stat Summary Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Analyzed Spend</span>
              <p className="text-base font-bold font-mono text-white mt-0.5 tabular-nums">
                ${totalPeriodSpend.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <span className="text-[10px] text-slate-500 font-mono">{scopedInvoices.length} invoices across {allCategories.length} categories</span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Latest Month Total</span>
              <p className="text-base font-bold font-mono text-white mt-0.5 tabular-nums">
                ${currentMonthSpend.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <div className="flex items-center gap-1 text-[10px] font-mono mt-0.5">
                {overallMoMGrowth > 0 ? (
                  <span className="text-amber-400 flex items-center">
                    <ArrowUpRight className="w-3 h-3" />+{overallMoMGrowth.toFixed(1)}% MoM
                  </span>
                ) : overallMoMGrowth < 0 ? (
                  <span className="text-emerald-400 flex items-center">
                    <ArrowDownRight className="w-3 h-3" />{overallMoMGrowth.toFixed(1)}% MoM
                  </span>
                ) : (
                  <span className="text-slate-400 flex items-center">
                    <Minus className="w-3 h-3" />0.0% MoM
                  </span>
                )}
                <span className="text-slate-500">vs prev</span>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Top Expense Category</span>
              <p className="text-xs font-bold text-indigo-300 mt-1 truncate" title={categorySummaries[0]?.name}>
                {categorySummaries[0]?.name || 'N/A'}
              </p>
              <span className="text-[10px] text-slate-400 font-mono">
                ${Math.round(categorySummaries[0]?.total || 0).toLocaleString()} ({(categorySummaries[0]?.pctOfTotal || 0).toFixed(0)}%)
              </span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Average Monthly AP</span>
              <p className="text-base font-bold font-mono text-white mt-0.5 tabular-nums">
                ${monthlyData.length > 0 ? Math.round(totalPeriodSpend / monthlyData.length).toLocaleString() : '0'}
              </p>
              <span className="text-[10px] text-slate-500 font-mono">Run-rate across {monthlyData.length} months</span>
            </div>
          </div>

      {/* Spot Spending Patterns: Intelligent Insight Cards */}
      {patterns.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Detected Spending Patterns</span>
            </span>
            <span className="text-[10px] text-slate-500">Automated AP Pattern Recognition</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {patterns.slice(0, 3).map((pat, idx) => {
              const Icon = pat.icon;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedCategory(selectedCategory === pat.category ? null : pat.category)}
                  className={`p-3 rounded-lg border text-xs transition-all cursor-pointer relative overflow-hidden group ${
                    selectedCategory === pat.category
                      ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500'
                      : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="p-1.5 rounded-md shrink-0"
                        style={{ backgroundColor: `${pat.color}20`, color: pat.color }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="font-semibold text-white text-[11px] block">{pat.title}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{pat.category}</span>
                      </div>
                    </div>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0"
                      style={{ backgroundColor: `${pat.color}25`, color: pat.color }}
                    >
                      {pat.metric}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">{pat.description}</p>
                  <div className="mt-2 text-[10px] text-indigo-400 flex items-center gap-1 font-medium group-hover:text-indigo-300">
                    <span>{selectedCategory === pat.category ? 'Showing all categories' : 'Isolate this trend'}</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Recharts Visualization */}
      <div className="bg-[#0b101c] border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200">
              {selectedCategory ? `Isolated Trend: ${selectedCategory}` : 'Monthly Invoice Totals by Category'}
            </span>
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition-colors cursor-pointer"
              >
                Reset to All
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {chartType === 'percent' ? '% Allocation per Month' : 'USD ($) Invoiced'}
          </span>
        </div>

        {/* Recharts Canvas */}
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  {allCategories.map((cat, idx) => {
                    const color =
                      CATEGORY_COLORS[cat] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                    return (
                      <linearGradient key={`grad-${idx}`} id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis dataKey="month" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={val => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip content={<CustomTooltip />} />
                {allCategories.map((cat, idx) => {
                  if (selectedCategory && selectedCategory !== cat) return null;
                  const color =
                    CATEGORY_COLORS[cat] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                  return (
                    <Area
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      name={cat}
                      stackId="1"
                      stroke={color}
                      strokeWidth={2}
                      fill={`url(#grad-${idx})`}
                    />
                  );
                })}
              </AreaChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                barCategoryGap="20%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis dataKey="month" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={val =>
                    chartType === 'percent'
                      ? `${val}%`
                      : `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`
                  }
                />
                <Tooltip content={<CustomTooltip />} />
                {allCategories.map((cat, idx) => {
                  if (selectedCategory && selectedCategory !== cat) return null;
                  const color =
                    CATEGORY_COLORS[cat] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                  return (
                    <Bar
                      key={cat}
                      dataKey={cat}
                      name={cat}
                      stackId={chartType === 'grouped' ? undefined : 'stack'}
                      fill={color}
                      radius={chartType === 'grouped' ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  );
                })}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Interactive Category Chips Legend */}
        <div className="flex items-center justify-center flex-wrap gap-2 pt-2 border-t border-slate-800/80">
          {categorySummaries.map(cat => {
            const isSelected = selectedCategory === cat.name;
            const isFaded = selectedCategory && selectedCategory !== cat.name;

            return (
              <button
                key={cat.name}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? null : cat.name)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border ${
                  isSelected
                    ? 'bg-slate-800 text-white border-indigo-500 shadow-md ring-1 ring-indigo-500'
                    : isFaded
                    ? 'bg-slate-950/40 text-slate-500 border-slate-800/50 opacity-50'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
                title={`Click to filter trends by ${cat.name}`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                <span>{cat.name}</span>
                <span className="font-mono text-[10px] text-slate-400">
                  ${Math.round(cat.total).toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Spend Breakdown Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <span>Category Spend Patterns & Velocity</span>
            <span className="text-[10px] text-slate-400 font-normal">({categorySummaries.length} active classifications)</span>
          </h4>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('gl-accounts')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Chart of Accounts</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-800/60 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b101c] text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-2.5 px-4">Expense Category</th>
                <th className="py-2.5 px-4 text-right">Latest Month Spend</th>
                <th className="py-2.5 px-4 text-right">Prior Month</th>
                <th className="py-2.5 px-4 text-center">MoM Velocity</th>
                <th className="py-2.5 px-4 text-right">Total Invoiced</th>
                <th className="py-2.5 px-4 text-center">Budget Share</th>
                <th className="py-2.5 px-4 text-center">Pattern Tag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {categorySummaries.map(cat => (
                <tr
                  key={cat.name}
                  onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                  className={`hover:bg-slate-800/30 transition-colors cursor-pointer ${
                    selectedCategory === cat.name ? 'bg-indigo-950/30' : ''
                  }`}
                >
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="font-medium text-white">{cat.name}</span>
                    </div>
                  </td>

                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-200">
                    ${cat.latestMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  <td className="py-2.5 px-4 text-right font-mono text-slate-400">
                    ${cat.previousMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  <td className="py-2.5 px-4 text-center font-mono text-[11px]">
                    {cat.previousMonth === 0 ? (
                      <span className="text-slate-500">New</span>
                    ) : cat.momGrowth > 0 ? (
                      <span className="text-amber-400 font-semibold inline-flex items-center gap-0.5">
                        <ArrowUpRight className="w-3 h-3" />+{cat.momGrowth.toFixed(1)}%
                      </span>
                    ) : cat.momGrowth < 0 ? (
                      <span className="text-emerald-400 font-semibold inline-flex items-center gap-0.5">
                        <ArrowDownRight className="w-3 h-3" />{cat.momGrowth.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-slate-400">0.0%</span>
                    )}
                  </td>

                  <td className="py-2.5 px-4 text-right font-mono font-bold text-white">
                    ${cat.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  <td className="py-2.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(cat.pctOfTotal, 100)}%`, backgroundColor: cat.color }}
                        />
                      </div>
                      <span className="font-mono text-[11px] text-slate-300 w-8 text-right">
                        {cat.pctOfTotal.toFixed(0)}%
                      </span>
                    </div>
                  </td>

                  <td className="py-2.5 px-4 text-center">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        cat.patternTag === 'Surging'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60'
                          : cat.patternTag === 'Primary Driver'
                          ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/60'
                          : cat.patternTag === 'Decreasing'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                          : 'bg-slate-800/80 text-slate-300 border border-slate-700/60'
                      }`}
                    >
                      {cat.patternTag}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  );
};
