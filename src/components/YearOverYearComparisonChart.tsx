import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { BookingEvent, MetaAdMonthlyReport } from '../types';
import { calculateEventFinancials, formatCurrency } from '../utils/costCalculations';

type ComparisonMetric = 'revenue' | 'spend' | 'leads' | 'cpl' | 'roas' | 'netProfit';

interface YearOverYearComparisonChartProps {
  bookings: BookingEvent[];
  marketingReports: MetaAdMonthlyReport[];
  title?: string;
  subtitle?: string;
}

const MONTHS = [
  { num: 1, short: 'Jan', full: 'January' },
  { num: 2, short: 'Feb', full: 'February' },
  { num: 3, short: 'Mar', full: 'March' },
  { num: 4, short: 'Apr', full: 'April' },
  { num: 5, short: 'May', full: 'May' },
  { num: 6, short: 'Jun', full: 'June' },
  { num: 7, short: 'Jul', full: 'July' },
  { num: 8, short: 'Aug', full: 'August' },
  { num: 9, short: 'Sep', full: 'September' },
  { num: 10, short: 'Oct', full: 'October' },
  { num: 11, short: 'Nov', full: 'November' },
  { num: 12, short: 'Dec', full: 'December' },
];

export const YearOverYearComparisonChart: React.FC<YearOverYearComparisonChartProps> = ({
  bookings,
  marketingReports,
  title = 'Year-to-Year Monthly Comparison',
  subtitle = 'Side-by-side monthly performance comparison across calendar years using verified ledger & live booking data.',
}) => {
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>([2025, 2026]);
    marketingReports.forEach(r => {
      const yr = parseInt(r.monthKey.substring(0, 4), 10);
      if (!isNaN(yr) && yr >= 2020 && yr <= 2035) yearSet.add(yr);
    });
    bookings.forEach(b => {
      if (b.status === 'cancelled' || !b.eventDate) return;
      const yr = parseInt(b.eventDate.substring(0, 4), 10);
      if (!isNaN(yr) && yr >= 2020 && yr <= 2035) yearSet.add(yr);
    });
    return Array.from(yearSet).sort((a, b) => a - b);
  }, [marketingReports, bookings]);

  const [baseYear, setBaseYear] = useState<number>(2025);
  const [compareYear, setCompareYear] = useState<number>(2026);
  const [metric, setMetric] = useState<ComparisonMetric>('revenue');

  const computeMonthMetricForYear = (year: number, monthNum: number) => {
    const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`;
    const report = marketingReports.find(r => r.monthKey === monthKey);
    const monthBookings = bookings.filter(
      b => b.status !== 'cancelled' && b.eventDate.startsWith(monthKey)
    );
    const hasLiveBookings = monthBookings.length > 0;

    let revenue = 0;
    let directCosts = 0;

    if (hasLiveBookings) {
      monthBookings.forEach(b => {
        const fin = calculateEventFinancials(b);
        revenue += fin.subtotalRevenue;
        directCosts += fin.totalDirectCosts;
      });
    } else if (report?.historicalBanquetRevenue !== undefined) {
      revenue = report.historicalBanquetRevenue;
      directCosts =
        report.historicalDirectCosts !== undefined
          ? report.historicalDirectCosts
          : revenue * 0.32;
    } else if (report?.roasMultiplier && report?.adSpendAED) {
      revenue = report.adSpendAED * report.roasMultiplier;
      directCosts = revenue * 0.32;
    }

    const adSpend = report?.adSpendAED || 0;
    const leads = report?.leadsGenerated || 0;
    const cpl =
      report?.cprAED && report.cprAED > 0
        ? report.cprAED
        : leads > 0
        ? adSpend / leads
        : 0;
    const roas = adSpend > 0 ? revenue / adSpend : 0;
    const netProfit = revenue - directCosts - adSpend;

    const hasRecord = Boolean(report) || hasLiveBookings;

    return {
      hasRecord,
      revenue: parseFloat(revenue.toFixed(2)),
      spend: parseFloat(adSpend.toFixed(2)),
      leads,
      cpl: parseFloat(cpl.toFixed(2)),
      roas: parseFloat(roas.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
    };
  };

  const chartData = useMemo(() => {
    return MONTHS.map(m => {
      const a = computeMonthMetricForYear(baseYear, m.num);
      const b = computeMonthMetricForYear(compareYear, m.num);

      const valA = a[metric];
      const valB = b[metric];
      const delta = parseFloat((valB - valA).toFixed(2));
      const pctChange =
        valA > 0 ? parseFloat((((valB - valA) / valA) * 100).toFixed(1)) : null;

      return {
        month: m.short,
        fullMonth: m.full,
        monthNum: m.num,
        valA,
        valB,
        hasA: a.hasRecord,
        hasB: b.hasRecord,
        delta,
        pctChange,
      };
    });
  }, [baseYear, compareYear, metric, bookings, marketingReports]);

  // Summary Totals (Full Year & Apples-to-Apples Matched Active Months)
  const summary = useMemo(() => {
    const totalA = chartData.reduce((s, d) => s + d.valA, 0);
    const totalB = chartData.reduce((s, d) => s + d.valB, 0);

    // Apples-to-apples comparison across months where Compare Year has recorded actuals
    const activeMonths = chartData.filter(d => d.hasB || d.valB > 0);
    const matchedTotalA = activeMonths.reduce((s, d) => s + d.valA, 0);
    const matchedTotalB = activeMonths.reduce((s, d) => s + d.valB, 0);

    const isRatioMetric = metric === 'cpl' || metric === 'roas';
    const displayA = isRatioMetric
      ? (activeMonths.filter(d => d.valA > 0).length > 0
          ? activeMonths.reduce((s, d) => s + d.valA, 0) / activeMonths.filter(d => d.valA > 0).length
          : 0)
      : matchedTotalA;
    const displayB = isRatioMetric
      ? (activeMonths.filter(d => d.valB > 0).length > 0
          ? activeMonths.reduce((s, d) => s + d.valB, 0) / activeMonths.filter(d => d.valB > 0).length
          : 0)
      : matchedTotalB;

    const matchedGrowthPct =
      displayA > 0 ? ((displayB - displayA) / displayA) * 100 : null;

    const bestGrowthMonth = [...chartData]
      .filter(d => d.delta > 0 && d.hasB)
      .sort((a, b) => b.delta - a.delta)[0];

    return {
      fullYearA: totalA,
      fullYearB: totalB,
      displayA,
      displayB,
      activeCount: activeMonths.length,
      matchedGrowthPct,
      bestGrowthMonth,
      isRatioMetric,
    };
  }, [chartData, metric]);

  const formatMetricValue = (val: number) => {
    if (metric === 'leads') return `${Math.round(val).toLocaleString()} Leads`;
    if (metric === 'roas') return `${val.toFixed(2)}x`;
    return formatCurrency(val);
  };

  const formatYAxis = (v: number) => {
    if (metric === 'leads') return v.toLocaleString();
    if (metric === 'roas') return `${v}x`;
    if (metric === 'cpl') return `${v}`;
    return v >= 1000 || v <= -1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`;
  };

  const metricOptions: { id: ComparisonMetric; label: string }[] = [
    { id: 'revenue', label: 'Banquet Sales (AED)' },
    { id: 'spend', label: 'Meta Ad Spend' },
    { id: 'leads', label: 'Inquiries / Leads' },
    { id: 'cpl', label: 'Cost per Lead' },
    { id: 'roas', label: 'ROAS (x)' },
    { id: 'netProfit', label: 'Net Profit' },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    const lowerIsBetter = metric === 'cpl';
    const isPositive = lowerIsBetter ? d.delta <= 0 : d.delta >= 0;

    return (
      <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl border border-[#D5E5DE] text-xs space-y-2 min-w-[230px]">
        <div className="font-black text-[#192A24] border-b border-[#E2ECE7] pb-1.5 flex items-center justify-between">
          <span>{d.fullMonth} Comparison</span>
          {d.pctChange !== null && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                isPositive
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {d.pctChange > 0 ? '+' : ''}
              {d.pctChange}% YoY
            </span>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center space-x-1.5 text-[#5A6F66] font-semibold">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
              <span>FY {baseYear}:</span>
            </span>
            <strong className="font-mono text-[#192A24]">
              {d.hasA || d.valA !== 0 ? formatMetricValue(d.valA) : 'No Data'}
            </strong>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center space-x-1.5 text-[#5A6F66] font-semibold">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#236B50] inline-block" />
              <span>FY {compareYear}:</span>
            </span>
            <strong className="font-mono text-[#236B50]">
              {d.hasB || d.valB !== 0 ? formatMetricValue(d.valB) : 'No Data'}
            </strong>
          </div>
        </div>

        {(d.hasA || d.hasB) && (
          <div className="pt-1.5 border-t border-[#E2ECE7] flex items-center justify-between text-[11px]">
            <span className="text-[#5A6F66]">Difference:</span>
            <strong className={isPositive ? 'text-emerald-700 font-mono' : 'text-rose-700 font-mono'}>
              {d.delta > 0 ? '+' : ''}
              {formatMetricValue(d.delta)}
            </strong>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#D5E5DE] shadow-xs space-y-5">
      {/* Header & Year Selectors */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E2ECE7]">
        <div>
          <div className="flex items-center space-x-2 text-[#236B50] text-xs font-extrabold uppercase tracking-wider">
            <BarChart3 className="w-4 h-4" />
            <span>Multi-Year Performance Benchmark</span>
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-[#192A24] mt-0.5">
            {title} ({baseYear} vs {compareYear})
          </h3>
          <p className="text-xs text-[#5A6F66]">{subtitle}</p>
        </div>

        {/* Year A vs Year B Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <div className="flex items-center space-x-1.5 bg-[#F4F8F6] px-3 py-1.5 rounded-2xl border border-[#D5E5DE] text-xs">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span className="font-bold text-[#5A6F66]">Base:</span>
            <select
              value={baseYear}
              onChange={(e) => setBaseYear(Number(e.target.value))}
              className="bg-transparent font-black text-[#192A24] focus:outline-none cursor-pointer"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr}>
                  FY {yr}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs font-black text-[#5A6F66]">vs</span>

          <div className="flex items-center space-x-1.5 bg-[#E8F5EE] px-3 py-1.5 rounded-2xl border border-[#B8DFC9] text-xs">
            <Calendar className="w-3.5 h-3.5 text-[#236B50]" />
            <span className="font-bold text-[#236B50]">Compare:</span>
            <select
              value={compareYear}
              onChange={(e) => setCompareYear(Number(e.target.value))}
              className="bg-transparent font-black text-[#192A24] focus:outline-none cursor-pointer"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr}>
                  FY {yr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Metric Filter Pills + YoY Summary Chips */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F4F8F6] rounded-2xl border border-[#D5E5DE]">
          {metricOptions.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMetric(opt.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                metric === opt.id
                  ? 'bg-[#236B50] text-white shadow-xs'
                  : 'text-[#486356] hover:text-[#192A24] hover:bg-white/70'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Matched YTD Comparison Chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 font-bold">
            FY {baseYear} ({summary.activeCount}m):{' '}
            <strong className="font-mono">{formatMetricValue(summary.displayA)}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#E8F5EE] border border-[#B8DFC9] text-[#192A24] font-bold">
            FY {compareYear} ({summary.activeCount}m):{' '}
            <strong className="font-mono text-[#236B50]">{formatMetricValue(summary.displayB)}</strong>
          </div>
          {summary.matchedGrowthPct !== null && (
            <div
              className={`px-3 py-1.5 rounded-xl font-black border flex items-center space-x-1 ${
                (metric === 'cpl' ? summary.matchedGrowthPct <= 0 : summary.matchedGrowthPct >= 0)
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : 'bg-rose-100 text-rose-900 border-rose-300'
              }`}
            >
              {summary.matchedGrowthPct >= 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              <span>
                {summary.matchedGrowthPct > 0 ? '+' : ''}
                {summary.matchedGrowthPct.toFixed(1)}% YoY
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Grouped Bar Chart: Jan - Dec */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 15, left: 5, bottom: 5 }}
            barGap={4}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E2ECE7" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fontWeight: 700, fill: '#3D5A4E' }}
              axisLine={{ stroke: '#D5E5DE' }}
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fontSize: 11, fill: '#5A6F66' }}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px', fontWeight: 700, paddingTop: '8px' }}
            />
            <Bar
              dataKey="valA"
              name={`FY ${baseYear}`}
              fill="#D97706"
              radius={[5, 5, 0, 0]}
              maxBarSize={26}
            />
            <Bar
              dataKey="valB"
              name={`FY ${compareYear}`}
              fill="#236B50"
              radius={[5, 5, 0, 0]}
              maxBarSize={26}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Concise 12-Month YoY Delta Strip */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 pt-2 border-t border-[#E2ECE7]">
        {chartData.map(d => {
          const lowerIsBetter = metric === 'cpl';
          const isPositive = lowerIsBetter ? d.delta <= 0 : d.delta >= 0;
          const hasData = d.hasA || d.hasB;
          return (
            <div
              key={d.month}
              className={`p-2 rounded-xl border text-center space-y-0.5 ${
                !hasData
                  ? 'bg-slate-50 border-slate-100 opacity-60'
                  : d.pctChange === null
                  ? 'bg-[#F8FAF9] border-[#E2ECE7]'
                  : isPositive
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : 'bg-rose-50/60 border-rose-200'
              }`}
            >
              <span className="text-[10px] font-black text-[#192A24] block">{d.month}</span>
              <span className="text-[10px] font-mono text-[#5A6F66] block truncate">
                {d.hasB ? formatYAxis(d.valB) : '—'}
              </span>
              <span
                className={`text-[10px] font-extrabold block ${
                  !d.hasB || d.pctChange === null
                    ? 'text-slate-400'
                    : isPositive
                    ? 'text-emerald-700'
                    : 'text-rose-700'
                }`}
              >
                {d.hasB && d.pctChange !== null
                  ? `${d.pctChange > 0 ? '+' : ''}${d.pctChange}%`
                  : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
