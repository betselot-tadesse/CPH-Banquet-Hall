import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  Tooltip,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from 'lucide-react';
import { BookingEvent, MetaAdMonthlyReport } from '../types';
import {
  calculateEventFinancials,
  formatCurrency,
  getLiveTodayInfo,
} from '../utils/costCalculations';

interface MomRevenueGrowthRadialChartProps {
  bookings: BookingEvent[];
  marketingReports: MetaAdMonthlyReport[];
}

interface MonthRevenueRecord {
  monthKey: string;
  shortLabel: string;
  fullLabel: string;
  revenue: number;
  partiesCount: number;
  hasRecord: boolean;
}

function addMonths(monthKey: string, delta: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(y) || isNaN(m)) return monthKey;
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string, style: 'short' | 'long' = 'long'): string {
  const [yStr, mStr] = monthKey.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(y) || isNaN(m)) return monthKey;
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString('en-US', {
    month: style === 'short' ? 'short' : 'long',
    year: 'numeric',
  });
}

function buildMonthSequence(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let cursor = startKey;
  let guard = 0;
  while (cursor <= endKey && guard < 120) {
    keys.push(cursor);
    cursor = addMonths(cursor, 1);
    guard += 1;
  }
  return keys;
}

export const MomRevenueGrowthRadialChart: React.FC<MomRevenueGrowthRadialChartProps> = ({
  bookings,
  marketingReports,
}) => {
  const { currentMonthStr } = getLiveTodayInfo();

  const {
    monthMap,
    orderedKeys,
    latestActiveKey,
    selectableKeys,
  } = useMemo(() => {
    const nonCancelledBookings = bookings.filter(b => b.status !== 'cancelled');
    const discoveredKeys = new Set<string>([currentMonthStr]);

    marketingReports.forEach(r => {
      if (/^\d{4}-\d{2}$/.test(r.monthKey)) {
        discoveredKeys.add(r.monthKey);
      }
    });
    nonCancelledBookings.forEach(b => {
      if (b.eventDate && b.eventDate.length >= 7) {
        const key = b.eventDate.substring(0, 7);
        if (/^\d{4}-\d{2}$/.test(key)) discoveredKeys.add(key);
      }
    });

    const sortedDiscovered = Array.from(discoveredKeys).sort();
    const minKey = sortedDiscovered[0] || currentMonthStr;
    const maxKey = sortedDiscovered[sortedDiscovered.length - 1] || currentMonthStr;
    const fullRange = buildMonthSequence(minKey, maxKey);

    const map = new Map<string, MonthRevenueRecord>();
    fullRange.forEach(key => {
      const rep = marketingReports.find(r => r.monthKey === key);
      const monthBookings = nonCancelledBookings.filter(b =>
        b.eventDate?.startsWith(key)
      );
      const hasLiveBookings = monthBookings.length > 0;
      const revenue = hasLiveBookings
        ? monthBookings.reduce(
            (sum, b) => sum + calculateEventFinancials(b).subtotalRevenue,
            0
          )
        : rep?.historicalBanquetRevenue ?? 0;

      const partiesCount = hasLiveBookings
        ? monthBookings.length
        : rep?.historicalPartiesCount ?? 0;

      const hasRecord =
        hasLiveBookings ||
        (Boolean(rep) &&
          ((rep?.historicalBanquetRevenue ?? 0) > 0 ||
            (rep?.adSpendAED ?? 0) > 0 ||
            (rep?.leadsGenerated ?? 0) > 0));

      map.set(key, {
        monthKey: key,
        shortLabel: formatMonthLabel(key, 'short'),
        fullLabel: formatMonthLabel(key, 'long'),
        revenue: parseFloat(revenue.toFixed(2)),
        partiesCount,
        hasRecord,
      });
    });

    const activeRevenueKeys = fullRange.filter(
      k => (map.get(k)?.revenue ?? 0) > 0
    );
    const latestActive =
      activeRevenueKeys.length > 0
        ? activeRevenueKeys[activeRevenueKeys.length - 1]
        : currentMonthStr;

    // Selectable months: active revenue months + current calendar month
    const selectableSet = new Set<string>([...activeRevenueKeys, currentMonthStr]);
    const selectable = Array.from(selectableSet).sort().reverse();

    return {
      monthMap: map,
      orderedKeys: fullRange,
      latestActiveKey: latestActive,
      selectableKeys: selectable,
    };
  }, [bookings, marketingReports, currentMonthStr]);

  // Auto-select latest recorded month if current calendar month has no revenue yet;
  // automatically picks currentMonthStr as soon as currentMonthStr logs bookings/revenue.
  const currentMonthHasRevenue = (monthMap.get(currentMonthStr)?.revenue ?? 0) > 0;
  const defaultTargetKey = currentMonthHasRevenue ? currentMonthStr : latestActiveKey;

  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const activeKey =
    selectedMonthKey && monthMap.has(selectedMonthKey)
      ? selectedMonthKey
      : defaultTargetKey;

  const metrics = useMemo(() => {
    const currRec = monthMap.get(activeKey) || {
      monthKey: activeKey,
      shortLabel: formatMonthLabel(activeKey, 'short'),
      fullLabel: formatMonthLabel(activeKey, 'long'),
      revenue: 0,
      partiesCount: 0,
      hasRecord: false,
    };

    const prevKey = addMonths(activeKey, -1);
    const prevRec = monthMap.get(prevKey) || {
      monthKey: prevKey,
      shortLabel: formatMonthLabel(prevKey, 'short'),
      fullLabel: formatMonthLabel(prevKey, 'long'),
      revenue: 0,
      partiesCount: 0,
      hasRecord: false,
    };

    // Trailing 3-month average (excluding current month)
    const trailingKeys = [-1, -2, -3].map(offset => addMonths(activeKey, offset));
    const trailingValues = trailingKeys
      .map(k => monthMap.get(k)?.revenue ?? 0)
      .filter(v => v > 0);
    const trailing3Avg =
      trailingValues.length > 0
        ? trailingValues.reduce((s, v) => s + v, 0) / trailingValues.length
        : 0;

    const deltaAED = currRec.revenue - prevRec.revenue;

    let momGrowthPct: number | null = null;
    let isNewSurge = false;
    if (prevRec.revenue > 0) {
      momGrowthPct = ((currRec.revenue - prevRec.revenue) / prevRec.revenue) * 100;
    } else if (currRec.revenue > 0 && prevRec.revenue === 0) {
      momGrowthPct = 100;
      isNewSurge = true;
    } else {
      momGrowthPct = null;
    }

    const vsTrailingAvgPct =
      trailing3Avg > 0
        ? ((currRec.revenue - trailing3Avg) / trailing3Avg) * 100
        : null;

    // Recent 6 active months timeline for quick comparison & drill-down
    const activeTrendKeys = orderedKeys
      .filter(k => k <= activeKey && ((monthMap.get(k)?.revenue ?? 0) > 0 || k === activeKey))
      .slice(-6);

    const recentMonths = activeTrendKeys.map(k => {
      const rec = monthMap.get(k)!;
      const pk = addMonths(k, -1);
      const pRev = monthMap.get(pk)?.revenue ?? 0;
      const pct =
        pRev > 0
          ? ((rec.revenue - pRev) / pRev) * 100
          : rec.revenue > 0
          ? 100
          : null;
      return {
        monthKey: k,
        shortLabel: rec.shortLabel,
        revenue: rec.revenue,
        momPct: pct,
        isNewSurge: pRev === 0 && rec.revenue > 0,
      };
    });

    // Trend classification
    const direction: 'up' | 'down' | 'flat' =
      momGrowthPct === null
        ? 'flat'
        : momGrowthPct > 0.5
        ? 'up'
        : momGrowthPct < -0.5
        ? 'down'
        : 'flat';

    // Radial gauge scale [0..100]:
    // Outer ring: MoM Growth Magnitude (capped at 100% visually, actual signed % printed inside)
    // Inner ring: Revenue Index vs Prior Month (100% prior month = 50 on bar, 200%+ = 100 on bar)
    const growthRadialFill =
      momGrowthPct === null
        ? 0
        : Math.max(4, Math.min(100, Math.abs(momGrowthPct)));

    const retentionIndex =
      prevRec.revenue > 0
        ? Math.max(4, Math.min(100, (currRec.revenue / prevRec.revenue) * 50))
        : currRec.revenue > 0
        ? 100
        : 0;

    return {
      currRec,
      prevRec,
      deltaAED,
      momGrowthPct,
      isNewSurge,
      trailing3Avg,
      vsTrailingAvgPct,
      recentMonths,
      direction,
      growthRadialFill,
      retentionIndex,
    };
  }, [activeKey, monthMap, orderedKeys]);

  const accentHex =
    metrics.direction === 'up'
      ? '#236B50'
      : metrics.direction === 'down'
      ? '#DC2626'
      : '#64748B';

  const secondaryHex =
    metrics.direction === 'up'
      ? '#4D9E7B'
      : metrics.direction === 'down'
      ? '#F59E0B'
      : '#94A3B8';

  const radialData = useMemo(
    () => [
      {
        name: 'Prior Month Pace Index',
        value: parseFloat(metrics.retentionIndex.toFixed(1)),
        displayMetric:
          metrics.prevRec.revenue > 0
            ? `${((metrics.currRec.revenue / metrics.prevRec.revenue) * 100).toFixed(0)}% of prior month`
            : metrics.currRec.revenue > 0
            ? 'New revenue baseline'
            : 'No activity',
        fill: secondaryHex,
      },
      {
        name: 'MoM Revenue Growth %',
        value: parseFloat(metrics.growthRadialFill.toFixed(1)),
        displayMetric:
          metrics.momGrowthPct === null
            ? 'No baseline'
            : metrics.isNewSurge
            ? '+100%+ (New surge)'
            : `${metrics.momGrowthPct >= 0 ? '+' : ''}${metrics.momGrowthPct.toFixed(1)}%`,
        fill: accentHex,
      },
    ],
    [metrics, accentHex, secondaryHex]
  );

  const formattedPctText =
    metrics.momGrowthPct === null
      ? '—'
      : metrics.isNewSurge
      ? '+100%+'
      : `${metrics.momGrowthPct > 0 ? '+' : ''}${metrics.momGrowthPct.toFixed(1)}%`;

  const trendHeadline =
    metrics.direction === 'up'
      ? 'Trending Upwards'
      : metrics.direction === 'down'
      ? 'Trending Downwards'
      : 'Flat / Unchanged';

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    return (
      <div className="bg-white/95 backdrop-blur-sm px-3.5 py-2.5 rounded-xl shadow-lg border border-[#D5E5DE] text-xs space-y-1">
        <div className="font-extrabold text-[#192A24]">{item.name}</div>
        <div className="font-mono tabular-nums font-bold text-[#236B50]">
          {item.displayMetric}
        </div>
        <div className="text-[11px] text-[#5A6F66]">
          {metrics.currRec.shortLabel} vs {metrics.prevRec.shortLabel}
        </div>
      </div>
    );
  };

  return (
    <section className="bg-white rounded-3xl p-5 sm:p-6 border border-[#D5E5DE] space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E2ECE7]">
        <div>
          <div className="text-xs font-semibold text-[#236B50] flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            <span>Month-over-Month Momentum</span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#192A24] mt-0.5 font-['Plus_Jakarta_Sans']">
            Month-over-Month Revenue Growth ({metrics.currRec.fullLabel})
          </h2>
          <p className="text-xs text-[#5A6F66] mt-0.5 flex flex-wrap items-center gap-1.5">
            <span>
              Comparing <strong>{metrics.currRec.fullLabel}</strong> against{' '}
              <strong>{metrics.prevRec.fullLabel}</strong>
            </span>
            {!currentMonthHasRevenue && activeKey === latestActiveKey && (
              <>
                <span aria-hidden="true">·</span>
                <span>Showing latest verified month with banquet sales</span>
              </>
            )}
          </p>
        </div>

        {/* Month Selector Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <div className="flex items-center p-1 bg-[#F4F8F6] rounded-xl border border-[#D5E5DE] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSelectedMonthKey(latestActiveKey)}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeKey === latestActiveKey
                  ? 'bg-[#236B50] text-white font-bold'
                  : 'text-[#486356] hover:text-[#192A24]'
              }`}
            >
              Latest Recorded ({formatMonthLabel(latestActiveKey, 'short')})
            </button>
            {latestActiveKey !== currentMonthStr && (
              <button
                type="button"
                onClick={() => setSelectedMonthKey(currentMonthStr)}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeKey === currentMonthStr
                    ? 'bg-[#192A24] text-white font-bold'
                    : 'text-[#486356] hover:text-[#192A24]'
                }`}
              >
                Current ({formatMonthLabel(currentMonthStr, 'short')})
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F4F8F6] rounded-xl border border-[#D5E5DE] text-xs font-semibold text-[#192A24]">
            <Calendar className="w-3.5 h-3.5 text-[#236B50] shrink-0" />
            <select
              aria-label="Inspect Month-over-Month Growth for Month"
              value={activeKey}
              onChange={e => setSelectedMonthKey(e.target.value)}
              className="bg-transparent font-bold text-[#192A24] focus:outline-none cursor-pointer pr-1"
            >
              {selectableKeys.map(k => (
                <option key={k} value={k}>
                  {formatMonthLabel(k, 'long')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Split: Radial Bar Chart (Left) + Executive Variance Breakdown (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Recharts RadialBarChart */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center py-2">
          <div className="relative w-full max-w-[300px] h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="54%"
                innerRadius="54%"
                outerRadius="92%"
                barSize={16}
                data={radialData}
                startAngle={215}
                endAngle={-35}
              >
                <PolarAngleAxis
                  type="number"
                  domain={[0, 100]}
                  angleAxisId={0}
                  tick={false}
                />
                <RadialBar
                  background={{ fill: '#EEF4F1' }}
                  dataKey="value"
                  cornerRadius={10}
                />
                <Tooltip content={<CustomTooltip />} />
              </RadialBarChart>
            </ResponsiveContainer>

            {/* Centered MoM Growth Readout */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pt-3">
              <div
                className={`flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider ${
                  metrics.direction === 'up'
                    ? 'text-[#236B50]'
                    : metrics.direction === 'down'
                    ? 'text-rose-700'
                    : 'text-[#5A6F66]'
                }`}
              >
                {metrics.direction === 'up' ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : metrics.direction === 'down' ? (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                ) : (
                  <Minus className="w-3.5 h-3.5" />
                )}
                <span>{trendHeadline}</span>
              </div>

              <div
                className={`text-3xl sm:text-4xl font-black font-mono tabular-nums tracking-tight mt-0.5 ${
                  metrics.direction === 'up'
                    ? 'text-[#192A24]'
                    : metrics.direction === 'down'
                    ? 'text-rose-700'
                    : 'text-[#5A6F66]'
                }`}
              >
                {formattedPctText}
              </div>

              <div className="text-[11px] font-semibold text-[#5A6F66] mt-0.5">
                vs. {metrics.prevRec.shortLabel}
              </div>
            </div>
          </div>

          {/* Ring Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-semibold text-[#5A6F66] -mt-2">
            <span className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: accentHex }}
              />
              <span>Outer Ring: MoM Growth Rate</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: secondaryHex }}
              />
              <span>Inner Ring: Prior-Month Pace</span>
            </span>
          </div>
        </div>

        {/* Right: Month-to-Month Financial Snapshot & 6-Month Trajectory */}
        <div className="lg:col-span-7 lg:border-l lg:border-[#E2ECE7] lg:pl-6 space-y-5">
          {/* Hairline-divided Metric Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#E2ECE7] border-b border-[#E2ECE7] pb-4">
            <div className="py-2 sm:py-0 sm:pr-4">
              <div className="text-[11px] font-semibold text-[#5A6F66] uppercase tracking-wider">
                {metrics.currRec.shortLabel} Revenue
              </div>
              <div className="text-lg font-black text-[#192A24] font-mono tabular-nums mt-0.5">
                {formatCurrency(metrics.currRec.revenue)}
              </div>
              <div className="text-[11px] text-[#5A6F66] mt-0.5 font-mono tabular-nums">
                {metrics.currRec.partiesCount} confirmed{' '}
                {metrics.currRec.partiesCount === 1 ? 'party' : 'parties'}
              </div>
            </div>

            <div className="py-2 sm:py-0 sm:px-4">
              <div className="text-[11px] font-semibold text-[#5A6F66] uppercase tracking-wider">
                {metrics.prevRec.shortLabel} Revenue
              </div>
              <div className="text-lg font-black text-[#486356] font-mono tabular-nums mt-0.5">
                {formatCurrency(metrics.prevRec.revenue)}
              </div>
              <div className="text-[11px] text-[#5A6F66] mt-0.5 font-mono tabular-nums">
                {metrics.prevRec.partiesCount} confirmed{' '}
                {metrics.prevRec.partiesCount === 1 ? 'party' : 'parties'}
              </div>
            </div>

            <div className="py-2 sm:py-0 sm:pl-4">
              <div className="text-[11px] font-semibold text-[#5A6F66] uppercase tracking-wider">
                Net Monthly Change
              </div>
              <div
                className={`text-lg font-black font-mono tabular-nums mt-0.5 flex items-center gap-1 ${
                  metrics.deltaAED > 0
                    ? 'text-[#236B50]'
                    : metrics.deltaAED < 0
                    ? 'text-rose-700'
                    : 'text-[#5A6F66]'
                }`}
              >
                {metrics.deltaAED > 0 ? (
                  <TrendingUp className="w-4 h-4 shrink-0" />
                ) : metrics.deltaAED < 0 ? (
                  <TrendingDown className="w-4 h-4 shrink-0" />
                ) : null}
                <span>
                  {metrics.deltaAED > 0 ? '+' : ''}
                  {formatCurrency(metrics.deltaAED)}
                </span>
              </div>
              <div className="text-[11px] text-[#5A6F66] mt-0.5 font-mono tabular-nums">
                {metrics.vsTrailingAvgPct !== null
                  ? `${metrics.vsTrailingAvgPct >= 0 ? '+' : ''}${metrics.vsTrailingAvgPct.toFixed(1)}% vs 3-mo avg`
                  : 'Single-month baseline'}
              </div>
            </div>
          </div>

          {/* Interactive Recent Months MoM Momentum Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-[#192A24]">
                Recent Month-over-Month Trajectory (Click to Inspect)
              </span>
              {metrics.trailing3Avg > 0 && (
                <span className="font-mono tabular-nums text-[11px] text-[#5A6F66]">
                  3-Mo Avg: {formatCurrency(metrics.trailing3Avg)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {metrics.recentMonths.map(item => {
                const isSelected = item.monthKey === activeKey;
                const isUp = item.momPct !== null && item.momPct > 0.5;
                const isDown = item.momPct !== null && item.momPct < -0.5;
                return (
                  <button
                    key={item.monthKey}
                    type="button"
                    onClick={() => setSelectedMonthKey(item.monthKey)}
                    className={`text-left px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#E8F5EE] border-[#236B50]'
                        : 'bg-[#F8FAF9] border-[#E2ECE7] hover:border-[#B6D0C4]'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-[#486356] whitespace-nowrap">
                      {item.shortLabel}
                    </div>
                    <div
                      className={`text-sm font-black font-mono tabular-nums mt-0.5 ${
                        isUp
                          ? 'text-[#236B50]'
                          : isDown
                          ? 'text-rose-700'
                          : 'text-[#5A6F66]'
                      }`}
                    >
                      {item.momPct === null
                        ? '—'
                        : item.isNewSurge
                        ? '+100%+'
                        : `${item.momPct > 0 ? '+' : ''}${item.momPct.toFixed(1)}%`}
                    </div>
                    <div className="text-[10px] font-mono tabular-nums text-[#5A6F66] truncate">
                      {Math.round(item.revenue).toLocaleString()} AED
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
