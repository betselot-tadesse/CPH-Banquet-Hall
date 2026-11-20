import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from 'recharts';
import { Target, TrendingUp, BarChart3, CheckCircle2, AlertTriangle } from 'lucide-react';
import { BookingEvent, MetaAdMonthlyReport } from '../types';
import { formatCurrency, getLiveTodayInfo } from '../utils/costCalculations';
import { AppStorage } from '../services/storage';

interface BookingsVsLeadsChartProps {
  bookings: BookingEvent[];
  marketingReports: MetaAdMonthlyReport[];
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

const TARGET_CONVERSION_BENCHMARK = 2.5; // 2.5% leads -> confirmed banquet booking benchmark
const GAUGE_MAX_PERCENT = 5.0; // Visual dial scale 0% -> 5.0%

export const BookingsVsLeadsChart: React.FC<BookingsVsLeadsChartProps> = ({
  bookings,
  marketingReports,
}) => {
  const { currentYearStr, currentMonthStr } = getLiveTodayInfo();
  const defaultYear = parseInt(currentYearStr, 10) || new Date().getFullYear();

  const availableYears = useMemo(() => {
    const set = new Set<number>([defaultYear, 2026, 2025]);
    marketingReports.forEach(r => {
      const y = parseInt(r.monthKey.substring(0, 4), 10);
      if (!isNaN(y) && y >= 2020 && y <= 2035) set.add(y);
    });
    bookings.forEach(b => {
      if (b.status === 'cancelled' || !b.eventDate) return;
      const y = parseInt(b.eventDate.substring(0, 4), 10);
      if (!isNaN(y) && y >= 2020 && y <= 2035) set.add(y);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [defaultYear, marketingReports, bookings]);

  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [chartView, setChartView] = useState<'volume' | 'efficiency'>('volume');

  const storedLeads = useMemo(() => AppStorage.getBanquetLeads(), []);

  const monthlySeries = useMemo(() => {
    return MONTHS.map(m => {
      const monthKey = `${selectedYear}-${String(m.num).padStart(2, '0')}`;
      const rep = marketingReports.find(r => r.monthKey === monthKey);
      const monthBookings = bookings.filter(
        b => b.status !== 'cancelled' && b.eventDate?.startsWith(monthKey)
      );

      // Confirmed Bookings: live booking records take precedence; otherwise historical actuals count
      const confirmedBookings =
        monthBookings.length > 0
          ? monthBookings.length
          : (rep?.historicalPartiesCount ?? 0);

      // Leads: Meta Ads OCR / historical report leads; fallback to CRM pipeline leads in that month
      const pipelineLeadsCount = storedLeads.filter(
        l => (l.targetEventDate || l.createdAt || '').startsWith(monthKey)
      ).length;
      const leads = rep ? rep.leadsGenerated : pipelineLeadsCount;

      const adSpendAED = rep?.adSpendAED ?? 0;
      const impressions = rep?.impressions ?? 0;
      const conversionRate =
        leads > 0 ? parseFloat(((confirmedBookings / leads) * 100).toFixed(2)) : 0;
      const costPerBooking =
        confirmedBookings > 0 && adSpendAED > 0
          ? parseFloat((adSpendAED / confirmedBookings).toFixed(2))
          : 0;

      return {
        monthKey,
        month: m.short,
        fullMonth: `${m.full} ${selectedYear}`,
        isCurrentMonth: monthKey === currentMonthStr,
        leads,
        confirmedBookings,
        conversionRate,
        adSpendAED,
        impressions,
        costPerBooking,
        hasActivity: leads > 0 || confirmedBookings > 0 || adSpendAED > 0,
      };
    });
  }, [selectedYear, currentMonthStr, bookings, marketingReports, storedLeads]);

  const summary = useMemo(() => {
    const totalLeads = monthlySeries.reduce((s, d) => s + d.leads, 0);
    const totalBookings = monthlySeries.reduce((s, d) => s + d.confirmedBookings, 0);
    const totalSpend = monthlySeries.reduce((s, d) => s + d.adSpendAED, 0);
    const overallEfficiency =
      totalLeads > 0 ? parseFloat(((totalBookings / totalLeads) * 100).toFixed(2)) : 0;
    const avgCostPerBooking =
      totalBookings > 0 && totalSpend > 0 ? totalSpend / totalBookings : 0;

    const bestMonth = [...monthlySeries]
      .filter(d => d.leads > 0 && d.confirmedBookings > 0)
      .sort((a, b) => b.conversionRate - a.conversionRate)[0];

    const hasAnyData = totalLeads > 0 || totalBookings > 0;

    return {
      totalLeads,
      totalBookings,
      totalSpend,
      overallEfficiency,
      avgCostPerBooking,
      bestMonth,
      hasAnyData,
    };
  }, [monthlySeries]);

  // Semi-circular radial gauge data (0% to 5.0% range)
  const gaugeFilled = Math.min(GAUGE_MAX_PERCENT, Math.max(0, summary.overallEfficiency));
  const gaugeRemaining = Math.max(0, GAUGE_MAX_PERCENT - gaugeFilled);
  const gaugeStatus =
    summary.overallEfficiency >= TARGET_CONVERSION_BENCHMARK
      ? { label: 'High Efficiency', color: '#236B50', textClass: 'text-[#236B50]', bgClass: 'bg-emerald-50 border-emerald-200' }
      : summary.overallEfficiency >= 1.0
      ? { label: 'On Benchmark', color: '#0EA5E9', textClass: 'text-sky-700', bgClass: 'bg-sky-50 border-sky-200' }
      : { label: 'Needs Nurturing', color: '#D97706', textClass: 'text-amber-700', bgClass: 'bg-amber-50 border-amber-200' };

  const gaugeData = [
    { name: 'Achieved Conversion', value: gaugeFilled > 0 ? gaugeFilled : 0.001 },
    { name: 'Remaining Headroom', value: gaugeRemaining },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white/95 backdrop-blur-sm p-3.5 rounded-xl shadow-lg border border-[#D5E5DE] text-xs space-y-2 min-w-[230px]">
        <div className="font-extrabold text-[#192A24] border-b border-[#E2ECE7] pb-1.5 flex items-center justify-between gap-3">
          <span>{d.fullMonth}</span>
          <span className="font-mono tabular-nums font-bold text-[#236B50]">
            {d.conversionRate.toFixed(2)}% Conv.
          </span>
        </div>

        <div className="space-y-1 font-mono tabular-nums">
          <div className="flex items-center justify-between gap-4">
            <span className="font-sans text-[#5A6F66] flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#94A3B8] inline-block" />
              <span>Leads Generated:</span>
            </span>
            <strong className="text-[#192A24]">{d.leads.toLocaleString()}</strong>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="font-sans text-[#5A6F66] flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#236B50] inline-block" />
              <span>Confirmed Bookings:</span>
            </span>
            <strong className="text-[#236B50]">{d.confirmedBookings}</strong>
          </div>

          {d.impressions > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="font-sans text-[#5A6F66]">Impressions:</span>
              <span className="text-[#192A24]">{d.impressions.toLocaleString()}</span>
            </div>
          )}

          {d.adSpendAED > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="font-sans text-[#5A6F66]">Meta Spend:</span>
              <span className="text-[#192A24]">{formatCurrency(d.adSpendAED)}</span>
            </div>
          )}

          {d.costPerBooking > 0 && (
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-[#E2ECE7]">
              <span className="font-sans text-[#5A6F66]">Cost / Confirmed Booking:</span>
              <strong className="text-[#192A24]">{formatCurrency(d.costPerBooking)}</strong>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="bg-white rounded-3xl p-5 sm:p-6 border border-[#D5E5DE] space-y-5">
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E2ECE7]">
        <div>
          <div className="text-xs font-semibold text-[#236B50] flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4" />
            <span>Marketing &amp; Management Funnel Analytics</span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#192A24] mt-0.5 font-['Plus_Jakarta_Sans']">
            Confirmed Bookings vs. Leads ({selectedYear})
          </h2>
          <p className="text-xs text-[#5A6F66] mt-0.5 flex flex-wrap items-center gap-1.5">
            <span>Month-over-month lead conversion efficiency</span>
            <span aria-hidden="true">·</span>
            <span>{selectedYear === defaultYear ? 'Current Year' : `FY ${selectedYear}`}</span>
            <span aria-hidden="true">·</span>
            <span>Target Benchmark: {TARGET_CONVERSION_BENCHMARK.toFixed(1)}%</span>
          </p>
        </div>

        {/* Interactive Filter & View Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <div className="flex items-center p-1 bg-[#F4F8F6] rounded-xl border border-[#D5E5DE] text-xs font-semibold">
            {availableYears.map(yr => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedYear === yr
                    ? 'bg-[#236B50] text-white font-bold'
                    : 'text-[#486356] hover:text-[#192A24]'
                }`}
              >
                FY {yr}
              </button>
            ))}
          </div>

          <div className="flex items-center p-1 bg-[#F4F8F6] rounded-xl border border-[#D5E5DE] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setChartView('volume')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                chartView === 'volume'
                  ? 'bg-[#192A24] text-white font-bold'
                  : 'text-[#486356] hover:text-[#192A24]'
              }`}
            >
              Bookings vs. Leads
            </button>
            <button
              type="button"
              onClick={() => setChartView('efficiency')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                chartView === 'efficiency'
                  ? 'bg-[#192A24] text-white font-bold'
                  : 'text-[#486356] hover:text-[#192A24]'
              }`}
            >
              Efficiency % Trend
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Chart (8 cols) + Visual Conversion Gauge (4 cols) */}
      {!summary.hasAnyData ? (
        <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-[#D5E5DE] bg-[#F8FAF9] space-y-2">
          <TrendingUp className="w-8 h-8 text-[#5A6F66] mx-auto" />
          <div className="text-sm font-bold text-[#192A24]">
            No Lead or Booking Activity Recorded for {selectedYear}
          </div>
          <p className="text-xs text-[#5A6F66] max-w-md mx-auto">
            Upload a Meta Ads PDF or image report in the Marketing Manager or register confirmed banquet bookings to visualize conversion efficiency.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
          {/* Left Panel: Month-over-Month Recharts ComposedChart */}
          <div className="xl:col-span-8 flex flex-col justify-between">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={monthlySeries}
                  margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
                  barGap={4}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2ECE7" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#3D5A4E' }}
                    axisLine={{ stroke: '#D5E5DE' }}
                    tickLine={false}
                  />

                  {chartView === 'volume' ? (
                    <>
                      <YAxis
                        yAxisId="leads"
                        orientation="left"
                        tick={{ fontSize: 11, fill: '#5A6F66' }}
                        axisLine={false}
                        tickLine={false}
                        label={{
                          value: 'Leads',
                          angle: -90,
                          position: 'insideLeft',
                          style: { fontSize: 10, fill: '#5A6F66', fontWeight: 700 },
                        }}
                      />
                      <YAxis
                        yAxisId="bookings"
                        orientation="right"
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#236B50', fontWeight: 700 }}
                        axisLine={false}
                        tickLine={false}
                        label={{
                          value: 'Bookings',
                          angle: 90,
                          position: 'insideRight',
                          style: { fontSize: 10, fill: '#236B50', fontWeight: 700 },
                        }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: '12px', fontWeight: 700, paddingTop: '8px' }}
                      />
                      <Bar
                        yAxisId="leads"
                        dataKey="leads"
                        name="Leads Generated"
                        fill="#94A3B8"
                        radius={[5, 5, 0, 0]}
                        maxBarSize={22}
                      />
                      <Bar
                        yAxisId="bookings"
                        dataKey="confirmedBookings"
                        name="Confirmed Bookings"
                        fill="#236B50"
                        radius={[5, 5, 0, 0]}
                        maxBarSize={22}
                      />
                    </>
                  ) : (
                    <>
                      <YAxis
                        yAxisId="rate"
                        orientation="left"
                        unit="%"
                        tick={{ fontSize: 11, fill: '#236B50', fontWeight: 700 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="bookings"
                        orientation="right"
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#5A6F66' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: '12px', fontWeight: 700, paddingTop: '8px' }}
                      />
                      <ReferenceLine
                        yAxisId="rate"
                        y={TARGET_CONVERSION_BENCHMARK}
                        stroke="#D97706"
                        strokeDasharray="4 4"
                        label={{
                          value: `Target ${TARGET_CONVERSION_BENCHMARK}%`,
                          fill: '#B45309',
                          fontSize: 10,
                          fontWeight: 700,
                          position: 'insideTopRight',
                        }}
                      />
                      <Bar
                        yAxisId="bookings"
                        dataKey="confirmedBookings"
                        name="Confirmed Bookings"
                        fill="#CBD5E1"
                        radius={[5, 5, 0, 0]}
                        maxBarSize={20}
                      />
                      <Line
                        yAxisId="rate"
                        type="monotone"
                        dataKey="conversionRate"
                        name="Conversion Efficiency (%)"
                        stroke="#236B50"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#236B50', strokeWidth: 2, stroke: '#FFFFFF' }}
                        activeDot={{ r: 7, fill: '#194D38' }}
                      />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right Panel: Conversion Efficiency Visual Gauge + Tabular Breakdown */}
          <div className="xl:col-span-4 rounded-2xl border border-[#E2ECE7] bg-[#F8FAF9] p-5 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-[#5A6F66]">Conversion Efficiency Gauge</div>
                <div className="text-sm font-extrabold text-[#192A24]">{selectedYear} Lead-to-Booking</div>
              </div>
              <Target className="w-4 h-4 text-[#236B50]" />
            </div>

            {/* Semi-Circular Recharts Gauge */}
            <div className="relative h-40 w-full flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gaugeData}
                    cx="50%"
                    cy="82%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={62}
                    outerRadius={84}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive={false}
                  >
                    <Cell fill={gaugeStatus.color} />
                    <Cell fill="#E2ECE7" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Center Gauge Readout */}
              <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center pointer-events-none">
                <span className="text-2xl font-black font-mono tabular-nums text-[#192A24]">
                  {summary.overallEfficiency.toFixed(2)}%
                </span>
                <div className={`mt-1 flex items-center gap-1 text-[11px] font-bold ${gaugeStatus.textClass}`}>
                  {summary.overallEfficiency >= 1.0 ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  <span>{gaugeStatus.label}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between text-[10px] font-mono tabular-nums text-[#5A6F66] px-4 -mt-2">
              <span>0%</span>
              <span>Target {TARGET_CONVERSION_BENCHMARK.toFixed(1)}%</span>
              <span>{GAUGE_MAX_PERCENT.toFixed(0)}%+</span>
            </div>

            {/* Tabular Funnel Summary */}
            <div className="pt-3 border-t border-[#E2ECE7] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#5A6F66]">Total Leads ({selectedYear})</span>
                <strong className="font-mono tabular-nums text-[#192A24]">
                  {summary.totalLeads.toLocaleString()}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5A6F66]">Confirmed Bookings</span>
                <strong className="font-mono tabular-nums text-[#236B50]">
                  {summary.totalBookings.toLocaleString()}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5A6F66]">Cost per Confirmed Booking</span>
                <strong className="font-mono tabular-nums text-[#192A24]">
                  {summary.avgCostPerBooking > 0 ? formatCurrency(summary.avgCostPerBooking) : '—'}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5A6F66]">Peak Converting Month</span>
                <strong className="font-mono tabular-nums text-[#236B50]">
                  {summary.bestMonth
                    ? `${summary.bestMonth.month} · ${summary.bestMonth.conversionRate.toFixed(1)}%`
                    : '—'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
