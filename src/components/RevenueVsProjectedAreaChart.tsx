import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingUp, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { BookingEvent, InquiryStage, MetaAdMonthlyReport } from '../types';
import { calculateEventFinancials, formatCurrency, getLiveTodayInfo } from '../utils/costCalculations';
import { AppStorage } from '../services/storage';

type ProjectionBasis = 'pipeline_model' | 'yoy_target' | 'monthly_goal';
type SeriesView = 'monthly' | 'cumulative';

interface RevenueVsProjectedAreaChartProps {
  bookings: BookingEvent[];
  marketingReports: MetaAdMonthlyReport[];
  monthlyRevenueGoal: number;
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

const STAGE_PROBABILITY: Record<InquiryStage, number> = {
  new_lead: 0.2,
  menu_sent: 0.35,
  tasting_hall_tour: 0.55,
  tentative_hold: 0.75,
  converted_won: 1.0,
  lost: 0,
};

export const RevenueVsProjectedAreaChart: React.FC<RevenueVsProjectedAreaChartProps> = ({
  bookings,
  marketingReports,
  monthlyRevenueGoal,
}) => {
  const { todayStr, currentYearStr, currentMonthStr } = getLiveTodayInfo();
  const defaultYear = parseInt(currentYearStr, 10) || new Date().getFullYear();

  const availableYears = useMemo(() => {
    const years = new Set<number>([defaultYear, 2026, 2025]);
    marketingReports.forEach(r => {
      const y = parseInt(r.monthKey.substring(0, 4), 10);
      if (!isNaN(y) && y >= 2020 && y <= 2035) years.add(y);
    });
    bookings.forEach(b => {
      if (b.status === 'cancelled' || !b.eventDate) return;
      const y = parseInt(b.eventDate.substring(0, 4), 10);
      if (!isNaN(y) && y >= 2020 && y <= 2035) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [defaultYear, marketingReports, bookings]);

  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [projectionBasis, setProjectionBasis] = useState<ProjectionBasis>('pipeline_model');
  const [seriesView, setSeriesView] = useState<SeriesView>('monthly');

  const storedLeads = useMemo(() => AppStorage.getBanquetLeads(), []);

  const { chartData, summary } = useMemo(() => {
    const nonCancelledBookings = bookings.filter(b => b.status !== 'cancelled');
    const avgBookingVal =
      nonCancelledBookings.length > 0
        ? nonCancelledBookings.reduce(
            (s, b) => s + calculateEventFinancials(b).subtotalRevenue,
            0
          ) / nonCancelledBookings.length
        : 8500;

    // Average monthly revenue across recorded active months of selectedYear (used as run-rate fallback when prior year has 0)
    const activeCurrentYearRevs: number[] = [];
    MONTHS.forEach(m => {
      const key = `${selectedYear}-${String(m.num).padStart(2, '0')}`;
      const rep = marketingReports.find(r => r.monthKey === key);
      const bks = nonCancelledBookings.filter(b => b.eventDate?.startsWith(key));
      const rev =
        bks.length > 0
          ? bks.reduce((s, b) => s + calculateEventFinancials(b).subtotalRevenue, 0)
          : rep?.historicalBanquetRevenue ?? 0;
      if (rev > 0) activeCurrentYearRevs.push(rev);
    });
    const ytdRunRateAvg =
      activeCurrentYearRevs.length > 0
        ? activeCurrentYearRevs.reduce((s, v) => s + v, 0) / activeCurrentYearRevs.length
        : monthlyRevenueGoal;

    // Compute Year-over-Year growth multiplier on matched months where both selectedYear & selectedYear-1 have actuals
    let matchedCurrSum = 0;
    let matchedPrevSum = 0;
    MONTHS.forEach(m => {
      const currKey = `${selectedYear}-${String(m.num).padStart(2, '0')}`;
      const prevKey = `${selectedYear - 1}-${String(m.num).padStart(2, '0')}`;
      const currRep = marketingReports.find(r => r.monthKey === currKey);
      const prevRep = marketingReports.find(r => r.monthKey === prevKey);
      const currBks = nonCancelledBookings.filter(b => b.eventDate?.startsWith(currKey));
      const prevBks = nonCancelledBookings.filter(b => b.eventDate?.startsWith(prevKey));
      const cRev =
        currBks.length > 0
          ? currBks.reduce((s, b) => s + calculateEventFinancials(b).subtotalRevenue, 0)
          : currRep?.historicalBanquetRevenue ?? 0;
      const pRev =
        prevBks.length > 0
          ? prevBks.reduce((s, b) => s + calculateEventFinancials(b).subtotalRevenue, 0)
          : prevRep?.historicalBanquetRevenue ?? 0;
      if (cRev > 0 && pRev > 0) {
        matchedCurrSum += cRev;
        matchedPrevSum += pRev;
      }
    });
    // Capped multiplier to prevent wild skew from small-base months
    const yoyFactor =
      matchedPrevSum > 0
        ? Math.min(2.5, Math.max(1.1, matchedCurrSum / matchedPrevSum))
        : 1.2;

    let runningActual = 0;
    let runningProjected = 0;

    const monthlyRows = MONTHS.map(m => {
      const monthKey = `${selectedYear}-${String(m.num).padStart(2, '0')}`;
      const prevYearKey = `${selectedYear - 1}-${String(m.num).padStart(2, '0')}`;
      const report = marketingReports.find(r => r.monthKey === monthKey);
      const prevReport = marketingReports.find(r => r.monthKey === prevYearKey);

      const monthBookings = nonCancelledBookings.filter(b => b.eventDate?.startsWith(monthKey));
      const realizedBookings = monthBookings.filter(
        b => b.eventDate < todayStr || b.partyEnded || b.status === 'completed'
      );
      const upcomingConfirmed = monthBookings.filter(
        b => b.eventDate >= todayStr && !b.partyEnded && b.status !== 'completed'
      );

      const realizedBookingsRev = realizedBookings.reduce(
        (s, b) => s + calculateEventFinancials(b).subtotalRevenue,
        0
      );
      const upcomingConfirmedRev = upcomingConfirmed.reduce(
        (s, b) => s + calculateEventFinancials(b).subtotalRevenue,
        0
      );

      // Actual Revenue: live bookings revenue if bookings exist (realized or full month), otherwise verified ledger actual
      const hasLiveBookings = monthBookings.length > 0;
      const actualRevenue = hasLiveBookings
        ? realizedBookingsRev + upcomingConfirmedRev
        : report?.historicalBanquetRevenue ?? 0;

      // Prior Year Revenue for seasonal benchmark
      const prevBookings = nonCancelledBookings.filter(b => b.eventDate?.startsWith(prevYearKey));
      const prevYearRevenue =
        prevBookings.length > 0
          ? prevBookings.reduce((s, b) => s + calculateEventFinancials(b).subtotalRevenue, 0)
          : prevReport?.historicalBanquetRevenue ?? 0;

      // Open CRM pipeline leads targeting this month
      const monthOpenLeads = storedLeads.filter(
        l =>
          l.stage !== 'converted_won' &&
          l.stage !== 'lost' &&
          (l.targetEventDate || '').startsWith(monthKey)
      );
      const pipelineWeightedUpside = monthOpenLeads.reduce(
        (s, l) => s + (STAGE_PROBABILITY[l.stage] || 0.2) * avgBookingVal,
        0
      );

      // Projected Revenue based on active projection basis
      let projectedRevenue = 0;
      if (projectionBasis === 'monthly_goal') {
        projectedRevenue = monthlyRevenueGoal;
      } else if (projectionBasis === 'yoy_target') {
        projectedRevenue =
          prevYearRevenue > 0 ? prevYearRevenue * 1.2 : ytdRunRateAvg;
      } else {
        // 'pipeline_model': actual + weighted pipeline upside when pipeline or upcoming exist;
        // otherwise seasonal prior-year scaled by YoY growth or YTD run-rate average
        if (pipelineWeightedUpside > 0 || upcomingConfirmedRev > 0) {
          projectedRevenue = Math.max(
            actualRevenue + pipelineWeightedUpside,
            prevYearRevenue > 0 ? prevYearRevenue * 1.15 : 0
          );
        } else if (prevYearRevenue > 0) {
          projectedRevenue = prevYearRevenue * yoyFactor;
        } else {
          projectedRevenue = ytdRunRateAvg;
        }
      }

      const roundedActual = parseFloat(actualRevenue.toFixed(2));
      const roundedProjected = parseFloat(projectedRevenue.toFixed(2));
      runningActual += roundedActual;
      runningProjected += roundedProjected;

      const hasActualRecord = hasLiveBookings || Boolean(report && (report.historicalBanquetRevenue ?? 0) > 0);
      const displayActual = seriesView === 'monthly' ? roundedActual : runningActual;
      const displayProjected = seriesView === 'monthly' ? roundedProjected : runningProjected;
      const variance = displayActual - displayProjected;
      const attainmentPct =
        displayProjected > 0 ? (displayActual / displayProjected) * 100 : 0;

      return {
        monthKey,
        month: m.short,
        fullMonth: `${m.full} ${selectedYear}`,
        isCurrentMonth: monthKey === currentMonthStr,
        hasActualRecord,
        partiesCount: hasLiveBookings
          ? monthBookings.length
          : report?.historicalPartiesCount ?? 0,
        openLeadsCount: monthOpenLeads.length,
        monthlyActual: roundedActual,
        monthlyProjected: roundedProjected,
        actual: parseFloat(displayActual.toFixed(2)),
        projected: parseFloat(displayProjected.toFixed(2)),
        variance: parseFloat(variance.toFixed(2)),
        attainmentPct: parseFloat(attainmentPct.toFixed(1)),
      };
    });

    const totalActualYTD = monthlyRows.reduce((s, r) => s + r.monthlyActual, 0);
    const activeMonths = monthlyRows.filter(r => r.hasActualRecord || r.monthlyActual > 0);
    const matchedProjectedYTD = activeMonths.reduce((s, r) => s + r.monthlyProjected, 0);
    const fullYearProjected = monthlyRows.reduce((s, r) => s + r.monthlyProjected, 0);
    const ytdAttainmentPct =
      matchedProjectedYTD > 0 ? (totalActualYTD / matchedProjectedYTD) * 100 : 0;
    const ytdVariance = totalActualYTD - matchedProjectedYTD;
    const bestOutperformMonth = [...activeMonths].sort(
      (a, b) => (b.monthlyActual - b.monthlyProjected) - (a.monthlyActual - a.monthlyProjected)
    )[0];

    return {
      chartData: monthlyRows,
      summary: {
        totalActualYTD,
        matchedProjectedYTD,
        fullYearProjected,
        ytdAttainmentPct,
        ytdVariance,
        activeMonthsCount: activeMonths.length,
        bestOutperformMonth,
      },
    };
  }, [
    bookings,
    marketingReports,
    monthlyRevenueGoal,
    selectedYear,
    projectionBasis,
    seriesView,
    todayStr,
    currentMonthStr,
    storedLeads,
  ]);

  const formatYAxis = (v: number) => {
    if (v === 0) return '0';
    return `${(v / 1000).toFixed(0)}k`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    const isAhead = d.variance >= 0;

    return (
      <div className="bg-white/95 backdrop-blur-sm p-3.5 rounded-xl shadow-lg border border-[#D5E5DE] text-xs space-y-2 min-w-[235px]">
        <div className="font-extrabold text-[#192A24] border-b border-[#E2ECE7] pb-1.5 flex items-center justify-between gap-3">
          <span>
            {d.fullMonth} ({seriesView === 'monthly' ? 'Monthly' : 'Cumulative'})
          </span>
          <span
            className={`font-mono tabular-nums font-bold ${
              isAhead ? 'text-[#236B50]' : 'text-amber-700'
            }`}
          >
            {d.projected > 0 ? `${d.attainmentPct.toFixed(0)}%` : '—'}
          </span>
        </div>

        <div className="space-y-1 font-mono tabular-nums">
          <div className="flex items-center justify-between gap-4">
            <span className="font-sans text-[#5A6F66] flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#236B50] inline-block" />
              <span>Actual Revenue:</span>
            </span>
            <strong className="text-[#192A24]">
              {d.hasActualRecord || d.actual > 0 ? formatCurrency(d.actual) : 'AED 0.00'}
            </strong>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="font-sans text-[#5A6F66] flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#D97706] inline-block" />
              <span>Projected Revenue:</span>
            </span>
            <strong className="text-amber-800">{formatCurrency(d.projected)}</strong>
          </div>

          <div className="flex items-center justify-between gap-4 pt-1 border-t border-[#E2ECE7]">
            <span className="font-sans text-[#5A6F66]">
              {isAhead ? 'Ahead of Target:' : 'Gap to Target:'}
            </span>
            <strong className={isAhead ? 'text-[#236B50]' : 'text-rose-700'}>
              {d.variance > 0 ? '+' : ''}
              {formatCurrency(d.variance)}
            </strong>
          </div>

          {(d.partiesCount > 0 || d.openLeadsCount > 0) && (
            <div className="pt-1 border-t border-[#E2ECE7] font-sans text-[11px] text-[#5A6F66] flex items-center justify-between">
              <span>{d.partiesCount} confirmed parties</span>
              {d.openLeadsCount > 0 && <span>{d.openLeadsCount} open pipeline leads</span>}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="bg-white rounded-3xl p-5 sm:p-6 border border-[#D5E5DE] space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-[#E2ECE7]">
        <div>
          <div className="text-xs font-semibold text-[#236B50] flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            <span>Revenue Target &amp; Trajectory</span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#192A24] mt-0.5 font-['Plus_Jakarta_Sans']">
            Monthly Actual vs. Projected Revenue ({selectedYear})
          </h2>
          <p className="text-xs text-[#5A6F66] mt-0.5 flex flex-wrap items-center gap-1.5">
            <span>Realized banquet billing compared against seasonal &amp; target projections</span>
            <span aria-hidden="true">·</span>
            <span>{summary.activeMonthsCount} active months recorded</span>
            <span aria-hidden="true">·</span>
            <span>Monthly Goal: {formatCurrency(monthlyRevenueGoal)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start xl:self-auto">
          {/* Year Selector */}
          <div className="flex items-center p-1 bg-[#F4F8F6] rounded-xl border border-[#D5E5DE] text-xs font-semibold">
            {availableYears.map(yr => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1 ${
                  selectedYear === yr
                    ? 'bg-[#236B50] text-white font-bold'
                    : 'text-[#486356] hover:text-[#192A24]'
                }`}
              >
                <Calendar className="w-3 h-3" />
                <span>FY {yr}</span>
              </button>
            ))}
          </div>

          {/* Series View Toggle */}
          <div className="flex items-center p-1 bg-[#F4F8F6] rounded-xl border border-[#D5E5DE] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSeriesView('monthly')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                seriesView === 'monthly'
                  ? 'bg-[#192A24] text-white font-bold'
                  : 'text-[#486356] hover:text-[#192A24]'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setSeriesView('cumulative')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                seriesView === 'cumulative'
                  ? 'bg-[#192A24] text-white font-bold'
                  : 'text-[#486356] hover:text-[#192A24]'
              }`}
            >
              Cumulative YTD
            </button>
          </div>

          {/* Projection Basis Selector */}
          <div className="flex items-center p-1 bg-[#F4F8F6] rounded-xl border border-[#D5E5DE] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setProjectionBasis('pipeline_model')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                projectionBasis === 'pipeline_model'
                  ? 'bg-[#236B50] text-white font-bold'
                  : 'text-[#486356] hover:text-[#192A24]'
              }`}
            >
              Pipeline &amp; Seasonal
            </button>
            <button
              type="button"
              onClick={() => setProjectionBasis('yoy_target')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                projectionBasis === 'yoy_target'
                  ? 'bg-[#236B50] text-white font-bold'
                  : 'text-[#486356] hover:text-[#192A24]'
              }`}
            >
              +20% YoY
            </button>
            <button
              type="button"
              onClick={() => setProjectionBasis('monthly_goal')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                projectionBasis === 'monthly_goal'
                  ? 'bg-[#236B50] text-white font-bold'
                  : 'text-[#486356] hover:text-[#192A24]'
              }`}
            >
              Monthly Goal
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E2ECE7] border-b border-[#E2ECE7] pb-4">
        <div className="py-1 sm:pr-5">
          <div className="text-xs font-medium text-[#5A6F66]">
            Actual Revenue ({summary.activeMonthsCount}m YTD)
          </div>
          <div className="text-lg font-extrabold text-[#192A24] mt-0.5 font-mono tabular-nums">
            {formatCurrency(summary.totalActualYTD)}
          </div>
        </div>

        <div className="py-2 sm:py-1 sm:px-5">
          <div className="text-xs font-medium text-[#5A6F66]">
            Projected Revenue ({seriesView === 'monthly' ? `${summary.activeMonthsCount}m Matched` : 'Full Year'})
          </div>
          <div className="text-lg font-extrabold text-amber-800 mt-0.5 font-mono tabular-nums">
            {formatCurrency(
              seriesView === 'monthly' ? summary.matchedProjectedYTD : summary.fullYearProjected
            )}
          </div>
        </div>

        <div className="py-2 sm:py-1 sm:px-5">
          <div className="text-xs font-medium text-[#5A6F66]">Matched Target Attainment</div>
          <div className="text-lg font-extrabold mt-0.5 font-mono tabular-nums flex items-center gap-1.5">
            <span className={summary.ytdVariance >= 0 ? 'text-[#236B50]' : 'text-amber-700'}>
              {summary.ytdAttainmentPct.toFixed(1)}%
            </span>
            <span
              className={`text-xs font-semibold inline-flex items-center ${
                summary.ytdVariance >= 0 ? 'text-[#236B50]' : 'text-rose-700'
              }`}
            >
              {summary.ytdVariance >= 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              {summary.ytdVariance >= 0 ? '+' : ''}
              {formatCurrency(summary.ytdVariance)}
            </span>
          </div>
        </div>

        <div className="pt-2 sm:py-1 sm:pl-5">
          <div className="text-xs font-medium text-[#5A6F66]">Peak Month vs. Projection</div>
          <div className="text-base font-extrabold text-[#192A24] mt-0.5 flex items-baseline justify-between gap-2">
            <span>{summary.bestOutperformMonth ? summary.bestOutperformMonth.month : '—'}</span>
            <span className="font-mono tabular-nums text-[#236B50] text-sm">
              {summary.bestOutperformMonth
                ? formatCurrency(summary.bestOutperformMonth.monthlyActual)
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Recharts AreaChart */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 12, right: 16, left: 4, bottom: 4 }}
          >
            <defs>
              <linearGradient id="actualRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#236B50" stopOpacity={0.32} />
                <stop offset="95%" stopColor="#236B50" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="projectedRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D97706" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#D97706" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2ECE7" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fontWeight: 700, fill: '#3D5A4E' }}
              axisLine={{ stroke: '#D5E5DE' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fontSize: 11, fill: '#5A6F66' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px', fontWeight: 700, paddingTop: '8px' }}
            />
            <Area
              type="monotone"
              dataKey="projected"
              name="Projected Revenue (AED)"
              stroke="#D97706"
              strokeWidth={2}
              strokeDasharray="5 4"
              fillOpacity={1}
              fill="url(#projectedRevenueFill)"
              activeDot={{ r: 5, fill: '#D97706', stroke: '#FFFFFF', strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="actual"
              name="Actual Total Revenue (AED)"
              stroke="#236B50"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#actualRevenueFill)"
              activeDot={{ r: 6, fill: '#194D38', stroke: '#FFFFFF', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
