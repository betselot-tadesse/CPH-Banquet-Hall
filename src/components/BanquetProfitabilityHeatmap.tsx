import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  usePlotArea,
} from 'recharts';
import { Grid3X3, TrendingUp, Calendar } from 'lucide-react';
import { BookingEvent, MetaAdMonthlyReport } from '../types';
import { calculateEventFinancials, formatCurrency, getLiveTodayInfo } from '../utils/costCalculations';

type GroupingMode = 'menu_tier' | 'event_type';
type MetricMode = 'gross_margin' | 'net_after_ads';

interface BanquetProfitabilityHeatmapProps {
  bookings: BookingEvent[];
  marketingReports: MetaAdMonthlyReport[];
}

interface HeatmapCellDatum {
  monthIndex: number;
  rowIndex: number;
  monthShort: string;
  monthFull: string;
  monthKey: string;
  rowKey: string;
  rowLabel: string;
  partiesCount: number;
  guestsCount: number;
  revenueAED: number;
  directCostsAED: number;
  adSpendAED: number;
  grossProfitAED: number;
  netProfitAED: number;
  grossMarginPct: number;
  netMarginPct: number;
  activeMarginPct: number;
  profitPerBanquetAED: number;
  hasData: boolean;
  isHistoricalAggregate: boolean;
  campaignNote?: string;
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

const TIER_DEFINITIONS: { key: string; label: string }[] = [
  { key: '100_aed', label: 'Royal 100 AED' },
  { key: '80_aed', label: 'Deluxe 80 AED' },
  { key: '60_aed', label: 'Classic 60 AED' },
  { key: 'hall_only', label: 'Hall Only / Custom' },
];

function classifyBookingTier(b: BookingEvent): { key: string; label: string } {
  if (!b.hasFoodFromHotel || b.agreementType === 'hall_only') {
    return { key: 'hall_only', label: 'Hall Only / Custom' };
  }
  if (b.buffetTier === '100_aed' || (b.foodPricePerGuestCharged || 0) >= 95) {
    return { key: '100_aed', label: 'Royal 100 AED' };
  }
  if (b.buffetTier === '80_aed' || ((b.foodPricePerGuestCharged || 0) >= 75 && (b.foodPricePerGuestCharged || 0) < 95)) {
    return { key: '80_aed', label: 'Deluxe 80 AED' };
  }
  if (b.buffetTier === '60_aed' || ((b.foodPricePerGuestCharged || 0) > 0 && (b.foodPricePerGuestCharged || 0) < 75)) {
    return { key: '60_aed', label: 'Classic 60 AED' };
  }
  return { key: 'hall_only', label: 'Hall Only / Custom' };
}

function classifyEventType(b: BookingEvent): { key: string; label: string } {
  const raw = (b.eventType || '').trim();
  const lower = raw.toLowerCase();
  if (!lower) return { key: 'general_banquet', label: 'General Banquet' };
  if (lower.includes('wed') || lower.includes('nikkah') || lower.includes('walima') || lower.includes('engagement')) {
    return { key: 'wedding', label: 'Wedding & Reception' };
  }
  if (lower.includes('corp') || lower.includes('conf') || lower.includes('meeting') || lower.includes('gala') || lower.includes('seminar')) {
    return { key: 'corporate', label: 'Corporate & Gala' };
  }
  if (lower.includes('birth') || lower.includes('kids') || lower.includes('baby')) {
    return { key: 'birthday', label: 'Birthday Party' };
  }
  if (lower.includes('anniv') || lower.includes('family') || lower.includes('get-together') || lower.includes('reunion')) {
    return { key: 'family', label: 'Family & Get-Together' };
  }
  return { key: raw.toLowerCase().replace(/[^a-z0-9]+/g, '_'), label: raw };
}

function getHeatColor(marginPct: number, hasData: boolean): {
  fill: string;
  stroke: string;
  text: string;
  tierLabel: string;
} {
  if (!hasData) {
    return { fill: '#F4F8F6', stroke: '#E2ECE7', text: '#94A3B8', tierLabel: 'No Bookings' };
  }
  if (marginPct >= 65) {
    return { fill: '#166534', stroke: '#14532D', text: '#FFFFFF', tierLabel: 'Peak Margin (65%+)' };
  }
  if (marginPct >= 50) {
    return { fill: '#236B50', stroke: '#1B553F', text: '#FFFFFF', tierLabel: 'Strong Margin (50–64%)' };
  }
  if (marginPct >= 35) {
    return { fill: '#4D9E7B', stroke: '#3B8465', text: '#FFFFFF', tierLabel: 'Healthy (35–49%)' };
  }
  if (marginPct >= 15) {
    return { fill: '#F59E0B', stroke: '#D97706', text: '#192A24', tierLabel: 'Moderate (15–34%)' };
  }
  if (marginPct >= 0) {
    return { fill: '#FB923C', stroke: '#EA580C', text: '#192A24', tierLabel: 'Tight (0–14%)' };
  }
  return { fill: '#DC2626', stroke: '#B91C1C', text: '#FFFFFF', tierLabel: 'Negative Margin (<0%)' };
}

interface HeatCellShapeProps {
  cx?: number;
  cy?: number;
  payload?: HeatmapCellDatum;
  totalRows: number;
  selectedCellKey: string | null;
  onSelectCell: (cell: HeatmapCellDatum) => void;
}

const HeatCellShape: React.FC<HeatCellShapeProps> = ({
  cx,
  cy,
  payload,
  totalRows,
  selectedCellKey,
  onSelectCell,
}) => {
  const plotArea = usePlotArea();
  if (cx === undefined || cy === undefined || !payload || !plotArea) {
    return null;
  }

  const gap = 4;
  const cellW = Math.max(20, plotArea.width / 12 - gap);
  const cellH = Math.max(26, plotArea.height / Math.max(1, totalRows) - gap);
  const x = cx - cellW / 2;
  const y = cy - cellH / 2;

  const palette = getHeatColor(payload.activeMarginPct, payload.hasData);
  const cellId = `${payload.rowKey}_${payload.monthKey}`;
  const isSelected = selectedCellKey === cellId;

  const displayText = payload.hasData
    ? `${payload.activeMarginPct.toFixed(0)}%`
    : '—';

  return (
    <g
      onClick={() => payload.hasData && onSelectCell(payload)}
      style={{ cursor: payload.hasData ? 'pointer' : 'default', pointerEvents: 'all' }}
    >
      <rect
        x={x}
        y={y}
        width={cellW}
        height={cellH}
        rx={6}
        ry={6}
        fill={palette.fill}
        stroke={isSelected ? '#192A24' : palette.stroke}
        strokeWidth={isSelected ? 2 : 1}
      />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fill={palette.text}
        fontSize={cellW < 42 ? 10 : 11}
        fontWeight={payload.hasData ? 700 : 500}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
      >
        {displayText}
      </text>
    </g>
  );
};

export const BanquetProfitabilityHeatmap: React.FC<BanquetProfitabilityHeatmapProps> = ({
  bookings,
  marketingReports,
}) => {
  const { currentYearStr } = getLiveTodayInfo();
  const defaultYear = parseInt(currentYearStr, 10) || new Date().getFullYear();

  const availableYears = useMemo(() => {
    const years = new Set<number>([defaultYear, 2026, 2025]);
    marketingReports.forEach(r => {
      const yr = parseInt(r.monthKey.substring(0, 4), 10);
      if (!isNaN(yr) && yr >= 2020 && yr <= 2035) years.add(yr);
    });
    bookings.forEach(b => {
      if (b.status === 'cancelled' || !b.eventDate) return;
      const yr = parseInt(b.eventDate.substring(0, 4), 10);
      if (!isNaN(yr) && yr >= 2020 && yr <= 2035) years.add(yr);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [defaultYear, marketingReports, bookings]);

  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('menu_tier');

  const yearLiveBookings = useMemo(
    () =>
      bookings.filter(
        b => b.status !== 'cancelled' && b.eventDate?.startsWith(String(selectedYear))
      ),
    [bookings, selectedYear]
  );

  // Default to Net Margin (incl. Meta Ads) when viewing ledger-only years so monthly variance stands out immediately,
  // or Gross Margin % when itemized live banquet bookings exist; user can freely switch anytime.
  const [metricOverride, setMetricOverride] = useState<MetricMode | null>(null);
  const activeMetric: MetricMode =
    metricOverride ?? (yearLiveBookings.length > 0 ? 'gross_margin' : 'net_after_ads');

  const [selectedCell, setSelectedCell] = useState<HeatmapCellDatum | null>(null);

  const { rowDefs, cells } = useMemo(() => {
    const rowMap = new Map<string, string>();
    const hasUnitemizedHistorical = MONTHS.some(m => {
      const monthKey = `${selectedYear}-${String(m.num).padStart(2, '0')}`;
      const hasLive = yearLiveBookings.some(b => b.eventDate.startsWith(monthKey));
      if (hasLive) return false;
      const rep = marketingReports.find(r => r.monthKey === monthKey);
      return Boolean(
        rep &&
          ((rep.historicalBanquetRevenue ?? 0) > 0 || (rep.historicalPartiesCount ?? 0) > 0)
      );
    });

    if (groupingMode === 'menu_tier') {
      if (yearLiveBookings.length > 0) {
        TIER_DEFINITIONS.forEach(t => rowMap.set(t.key, t.label));
      }
      if (hasUnitemizedHistorical || yearLiveBookings.length === 0) {
        rowMap.set('historical_ledger', 'CPH1 Banquet Ledger');
      }
    } else {
      yearLiveBookings.forEach(b => {
        const cls = classifyEventType(b);
        rowMap.set(cls.key, cls.label);
      });
      if (hasUnitemizedHistorical || yearLiveBookings.length === 0) {
        rowMap.set('historical_ledger', 'CPH1 Banquet Ledger');
      }
    }

    const rows = Array.from(rowMap.entries()).map(([key, label], idx) => ({
      key,
      label,
      rowIndex: idx,
    }));

    const matrixCells: HeatmapCellDatum[] = [];

    rows.forEach(row => {
      MONTHS.forEach((m, monthIdx) => {
        const monthKey = `${selectedYear}-${String(m.num).padStart(2, '0')}`;
        const report = marketingReports.find(r => r.monthKey === monthKey);
        const monthBookings = yearLiveBookings.filter(b => b.eventDate.startsWith(monthKey));
        const monthTotalRevenue = monthBookings.reduce(
          (sum, b) => sum + calculateEventFinancials(b).subtotalRevenue,
          0
        );
        const monthAdSpend = report?.adSpendAED ?? 0;

        if (row.key === 'historical_ledger') {
          if (
            monthBookings.length === 0 &&
            report &&
            ((report.historicalBanquetRevenue ?? 0) > 0 || (report.historicalPartiesCount ?? 0) > 0)
          ) {
            const rev = report.historicalBanquetRevenue ?? 0;
            const directCosts =
              report.historicalDirectCosts !== undefined
                ? report.historicalDirectCosts
                : rev * 0.32;
            const parties =
              report.historicalPartiesCount !== undefined
                ? report.historicalPartiesCount
                : rev > 0
                ? Math.max(1, Math.round(rev / 10000))
                : 0;
            const guests = report.historicalGuestsCount ?? parties * 60;
            const grossProfit = rev - directCosts;
            const netProfit = grossProfit - monthAdSpend;
            const grossMarginPct = rev > 0 ? (grossProfit / rev) * 100 : 0;
            const netMarginPct = rev > 0 ? (netProfit / rev) * 100 : 0;
            const activeMarginPct =
              activeMetric === 'gross_margin' ? grossMarginPct : netMarginPct;
            const activeProfit =
              activeMetric === 'gross_margin' ? grossProfit : netProfit;

            matrixCells.push({
              monthIndex: monthIdx,
              rowIndex: row.rowIndex,
              monthShort: m.short,
              monthFull: `${m.full} ${selectedYear}`,
              monthKey,
              rowKey: row.key,
              rowLabel: row.label,
              partiesCount: parties,
              guestsCount: guests,
              revenueAED: rev,
              directCostsAED: directCosts,
              adSpendAED: monthAdSpend,
              grossProfitAED: grossProfit,
              netProfitAED: netProfit,
              grossMarginPct,
              netMarginPct,
              activeMarginPct,
              profitPerBanquetAED: parties > 0 ? activeProfit / parties : 0,
              hasData: true,
              isHistoricalAggregate: true,
              campaignNote: report.topPerformingCampaign,
            });
            return;
          }

          matrixCells.push({
            monthIndex: monthIdx,
            rowIndex: row.rowIndex,
            monthShort: m.short,
            monthFull: `${m.full} ${selectedYear}`,
            monthKey,
            rowKey: row.key,
            rowLabel: row.label,
            partiesCount: 0,
            guestsCount: 0,
            revenueAED: 0,
            directCostsAED: 0,
            adSpendAED: 0,
            grossProfitAED: 0,
            netProfitAED: 0,
            grossMarginPct: 0,
            netMarginPct: 0,
            activeMarginPct: 0,
            profitPerBanquetAED: 0,
            hasData: false,
            isHistoricalAggregate: true,
          });
          return;
        }

        // Live itemized BookingEvent aggregation for this Banquet Type x Month
        const matchingBookings = monthBookings.filter(b => {
          const cls =
            groupingMode === 'menu_tier' ? classifyBookingTier(b) : classifyEventType(b);
          return cls.key === row.key;
        });

        if (matchingBookings.length === 0) {
          matrixCells.push({
            monthIndex: monthIdx,
            rowIndex: row.rowIndex,
            monthShort: m.short,
            monthFull: `${m.full} ${selectedYear}`,
            monthKey,
            rowKey: row.key,
            rowLabel: row.label,
            partiesCount: 0,
            guestsCount: 0,
            revenueAED: 0,
            directCostsAED: 0,
            adSpendAED: 0,
            grossProfitAED: 0,
            netProfitAED: 0,
            grossMarginPct: 0,
            netMarginPct: 0,
            activeMarginPct: 0,
            profitPerBanquetAED: 0,
            hasData: false,
            isHistoricalAggregate: false,
          });
          return;
        }

        let rev = 0;
        let directCosts = 0;
        let guests = 0;
        matchingBookings.forEach(b => {
          const fin = calculateEventFinancials(b);
          rev += fin.subtotalRevenue;
          directCosts += fin.totalDirectCosts;
          guests += b.guestCount || 0;
        });

        // Pro-rate monthly Meta ad spend by revenue share if month has multiple banquet types
        const allocatedAdSpend =
          monthTotalRevenue > 0
            ? monthAdSpend * (rev / monthTotalRevenue)
            : monthAdSpend / Math.max(1, monthBookings.length);

        const grossProfit = rev - directCosts;
        const netProfit = grossProfit - allocatedAdSpend;
        const grossMarginPct = rev > 0 ? (grossProfit / rev) * 100 : 0;
        const netMarginPct = rev > 0 ? (netProfit / rev) * 100 : 0;
        const activeMarginPct =
          activeMetric === 'gross_margin' ? grossMarginPct : netMarginPct;
        const activeProfit =
          activeMetric === 'gross_margin' ? grossProfit : netProfit;

        matrixCells.push({
          monthIndex: monthIdx,
          rowIndex: row.rowIndex,
          monthShort: m.short,
          monthFull: `${m.full} ${selectedYear}`,
          monthKey,
          rowKey: row.key,
          rowLabel: row.label,
          partiesCount: matchingBookings.length,
          guestsCount: guests,
          revenueAED: rev,
          directCostsAED: directCosts,
          adSpendAED: allocatedAdSpend,
          grossProfitAED: grossProfit,
          netProfitAED: netProfit,
          grossMarginPct,
          netMarginPct,
          activeMarginPct,
          profitPerBanquetAED: activeProfit / matchingBookings.length,
          hasData: true,
          isHistoricalAggregate: false,
        });
      });
    });

    return { rowDefs: rows, cells: matrixCells };
  }, [selectedYear, yearLiveBookings, marketingReports, groupingMode, activeMetric]);

  const insights = useMemo(() => {
    const activeCells = cells.filter(c => c.hasData && c.revenueAED > 0);
    if (activeCells.length === 0) {
      return {
        hasAnyData: false,
        peakCell: null as HeatmapCellDatum | null,
        topTypeLabel: '—',
        topTypeMarginPct: 0,
        avgProfitPerBanquet: 0,
        totalActiveParties: 0,
      };
    }

    const peakCell = [...activeCells].sort(
      (a, b) =>
        b.activeMarginPct - a.activeMarginPct ||
        b.profitPerBanquetAED - a.profitPerBanquetAED
    )[0];

    // Aggregate per Banquet Type
    const typeTotals = new Map<
      string,
      { label: string; rev: number; profit: number; parties: number }
    >();
    activeCells.forEach(c => {
      const cur = typeTotals.get(c.rowKey) || {
        label: c.rowLabel,
        rev: 0,
        profit: 0,
        parties: 0,
      };
      cur.rev += c.revenueAED;
      cur.profit +=
        activeMetric === 'gross_margin' ? c.grossProfitAED : c.netProfitAED;
      cur.parties += c.partiesCount;
      typeTotals.set(c.rowKey, cur);
    });

    const sortedTypes = Array.from(typeTotals.values())
      .map(t => ({
        ...t,
        marginPct: t.rev > 0 ? (t.profit / t.rev) * 100 : 0,
      }))
      .sort((a, b) => b.marginPct - a.marginPct);

    const totalParties = activeCells.reduce((s, c) => s + c.partiesCount, 0);
    const totalProfit = activeCells.reduce(
      (s, c) => s + (activeMetric === 'gross_margin' ? c.grossProfitAED : c.netProfitAED),
      0
    );

    return {
      hasAnyData: true,
      peakCell,
      topTypeLabel: sortedTypes[0]?.label || '—',
      topTypeMarginPct: sortedTypes[0]?.marginPct || 0,
      avgProfitPerBanquet: totalParties > 0 ? totalProfit / totalParties : 0,
      totalActiveParties: totalParties,
    };
  }, [cells, activeMetric]);

  const chartHeight = Math.max(170, rowDefs.length * 58 + 56);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const d: HeatmapCellDatum = payload[0].payload;
    if (!d) return null;
    const palette = getHeatColor(d.activeMarginPct, d.hasData);

    return (
      <div className="bg-white/95 backdrop-blur-sm p-3.5 rounded-xl shadow-lg border border-[#D5E5DE] text-xs space-y-2 min-w-[245px]">
        <div className="border-b border-[#E2ECE7] pb-1.5 flex items-center justify-between gap-3">
          <div>
            <div className="font-extrabold text-[#192A24]">{d.rowLabel}</div>
            <div className="text-[11px] text-[#5A6F66]">{d.monthFull}</div>
          </div>
          <span
            className="px-2 py-0.5 rounded-md font-mono tabular-nums font-bold text-[11px]"
            style={{ backgroundColor: palette.fill, color: palette.text }}
          >
            {d.hasData ? `${d.activeMarginPct.toFixed(1)}%` : 'No Data'}
          </span>
        </div>

        {!d.hasData ? (
          <div className="text-[#5A6F66] text-[11px]">
            No banquet events recorded in this category for {d.monthFull}.
          </div>
        ) : (
          <div className="space-y-1 font-mono tabular-nums">
            <div className="flex items-center justify-between gap-4">
              <span className="font-sans text-[#5A6F66]">Banquet Parties:</span>
              <strong className="text-[#192A24]">
                {d.partiesCount} ({d.guestsCount.toLocaleString()} guests)
              </strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-sans text-[#5A6F66]">Banquet Revenue:</span>
              <strong className="text-[#192A24]">{formatCurrency(d.revenueAED)}</strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-sans text-[#5A6F66]">Direct F&amp;B / Hall Cost:</span>
              <span className="text-[#5A6F66]">{formatCurrency(d.directCostsAED)}</span>
            </div>
            {d.adSpendAED > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="font-sans text-[#5A6F66]">Meta Ad Spend:</span>
                <span className="text-amber-800">{formatCurrency(d.adSpendAED)}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-[#E2ECE7]">
              <span className="font-sans text-[#5A6F66]">Gross Margin:</span>
              <strong className="text-[#236B50]">{d.grossMarginPct.toFixed(1)}%</strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-sans text-[#5A6F66]">Net Margin (After Ads):</span>
              <strong className={d.netMarginPct >= 0 ? 'text-[#236B50]' : 'text-rose-700'}>
                {d.netMarginPct.toFixed(1)}%
              </strong>
            </div>
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-[#E2ECE7]">
              <span className="font-sans font-semibold text-[#192A24]">Avg Profit / Banquet:</span>
              <strong className={d.profitPerBanquetAED >= 0 ? 'text-[#236B50]' : 'text-rose-700'}>
                {formatCurrency(d.profitPerBanquetAED)}
              </strong>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="bg-white rounded-3xl p-5 sm:p-6 border border-[#D5E5DE] space-y-5">
      {/* Header & Interactive Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-[#E2ECE7]">
        <div>
          <div className="text-xs font-semibold text-[#236B50] flex items-center gap-1.5">
            <Grid3X3 className="w-4 h-4" />
            <span>Profitability Matrix</span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#192A24] mt-0.5 font-['Plus_Jakarta_Sans']">
            Profitability per Banquet Heat Map ({selectedYear})
          </h2>
          <p className="text-xs text-[#5A6F66] mt-0.5 flex flex-wrap items-center gap-1.5">
            <span>
              {activeMetric === 'gross_margin'
                ? 'Gross banquet margin % across direct food, hall, and staffing costs'
                : 'Net commercial margin % after direct banquet costs and Meta ad spend'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{insights.totalActiveParties} active banquets analyzed</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start xl:self-auto">
          {/* Year Selector */}
          <div className="flex items-center p-1 bg-[#F4F8F6] rounded-xl border border-[#D5E5DE] text-xs font-semibold">
            {availableYears.map(yr => (
              <button
                key={yr}
                type="button"
                onClick={() => {
                  setSelectedYear(yr);
                  setSelectedCell(null);
                }}
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

          {/* Banquet Grouping Selector */}
          <div className="flex items-center p-1 bg-[#F4F8F6] rounded-xl border border-[#D5E5DE] text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setGroupingMode('menu_tier');
                setSelectedCell(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                groupingMode === 'menu_tier'
                  ? 'bg-[#192A24] text-white font-bold'
                  : 'text-[#486356] hover:text-[#192A24]'
              }`}
            >
              By Banquet Tier
            </button>
            <button
              type="button"
              onClick={() => {
                setGroupingMode('event_type');
                setSelectedCell(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                groupingMode === 'event_type'
                  ? 'bg-[#192A24] text-white font-bold'
                  : 'text-[#486356] hover:text-[#192A24]'
              }`}
            >
              By Event Type
            </button>
          </div>

          {/* Margin Basis Selector */}
          <div className="flex items-center p-1 bg-[#F4F8F6] rounded-xl border border-[#D5E5DE] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMetricOverride('gross_margin')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeMetric === 'gross_margin'
                  ? 'bg-[#236B50] text-white font-bold'
                  : 'text-[#486356] hover:text-[#192A24]'
              }`}
            >
              Gross Margin %
            </button>
            <button
              type="button"
              onClick={() => setMetricOverride('net_after_ads')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeMetric === 'net_after_ads'
                  ? 'bg-[#236B50] text-white font-bold'
                  : 'text-[#486356] hover:text-[#192A24]'
              }`}
            >
              Net Margin % (After Ads)
            </button>
          </div>
        </div>
      </div>

      {/* Executive Summary Metrics Strip */}
      {insights.hasAnyData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#E2ECE7] border-b border-[#E2ECE7] pb-4">
          <div className="py-1 sm:pr-5">
            <div className="text-xs font-medium text-[#5A6F66]">Peak Yield Month</div>
            <div className="text-base font-extrabold text-[#192A24] mt-0.5 flex items-baseline justify-between gap-2">
              <span>{insights.peakCell ? insights.peakCell.monthFull : '—'}</span>
              <span className="font-mono tabular-nums text-[#236B50]">
                {insights.peakCell ? `${insights.peakCell.activeMarginPct.toFixed(1)}%` : '—'}
              </span>
            </div>
          </div>

          <div className="py-2 sm:py-1 sm:px-5">
            <div className="text-xs font-medium text-[#5A6F66]">Highest-Margin Banquet Type</div>
            <div className="text-base font-extrabold text-[#192A24] mt-0.5 flex items-baseline justify-between gap-2">
              <span className="truncate">{insights.topTypeLabel}</span>
              <span className="font-mono tabular-nums text-[#236B50] shrink-0">
                {insights.topTypeMarginPct.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="pt-2 sm:py-1 sm:pl-5">
            <div className="text-xs font-medium text-[#5A6F66]">Avg Profit per Banquet</div>
            <div className="text-base font-extrabold text-[#236B50] mt-0.5 font-mono tabular-nums">
              {formatCurrency(insights.avgProfitPerBanquet)}
            </div>
          </div>
        </div>
      )}

      {/* Recharts Heat Map Grid */}
      {!insights.hasAnyData ? (
        <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-[#D5E5DE] bg-[#F8FAF9] space-y-2">
          <TrendingUp className="w-8 h-8 text-[#5A6F66] mx-auto" />
          <div className="text-sm font-bold text-[#192A24]">
            No Banquet Profitability Data for {selectedYear}
          </div>
          <p className="text-xs text-[#5A6F66] max-w-md mx-auto">
            Register confirmed banquet bookings or import historical monthly sales records to populate the calendar heat map.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="w-full overflow-x-auto">
            <div className="min-w-[700px]" style={{ height: `${chartHeight}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 16, bottom: 16, left: 20 }}>
                  <XAxis
                    type="number"
                    dataKey="monthIndex"
                    name="Month"
                    domain={[-0.5, 11.5]}
                    ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}
                    tickFormatter={(val: number) => MONTHS[val]?.short ?? ''}
                    interval={0}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fontWeight: 700, fill: '#3D5A4E' }}
                  />
                  <YAxis
                    type="number"
                    dataKey="rowIndex"
                    name="Banquet Type"
                    domain={[-0.5, rowDefs.length - 0.5]}
                    ticks={rowDefs.map(r => r.rowIndex)}
                    reversed
                    tickFormatter={(val: number) => rowDefs[val]?.label ?? ''}
                    interval={0}
                    width={148}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fontWeight: 700, fill: '#192A24' }}
                  />
                  <ZAxis type="number" dataKey="revenueAED" range={[60, 400]} />
                  <Tooltip
                    cursor={false}
                    content={<CustomTooltip />}
                  />
                  <Scatter
                    data={cells}
                    isAnimationActive={false}
                    shape={(props: unknown) => {
                      const p = props as { cx?: number; cy?: number; payload?: HeatmapCellDatum };
                      return (
                        <HeatCellShape
                          cx={p.cx}
                          cy={p.cy}
                          payload={p.payload}
                          totalRows={rowDefs.length}
                          selectedCellKey={
                            selectedCell
                              ? `${selectedCell.rowKey}_${selectedCell.monthKey}`
                              : null
                          }
                          onSelectCell={setSelectedCell}
                        />
                      );
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Click-to-Inspect Cell Detail Bar */}
          {selectedCell && (
            <div className="px-4 py-3 rounded-xl bg-[#F4F8F6] border border-[#D5E5DE] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-[#192A24]">
                <strong>{selectedCell.rowLabel}</strong>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-[#5A6F66]">{selectedCell.monthFull}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {selectedCell.partiesCount} {selectedCell.partiesCount === 1 ? 'banquet' : 'banquets'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Rev {formatCurrency(selectedCell.revenueAED)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums font-bold text-[#236B50]">
                  Profit/Banquet {formatCurrency(selectedCell.profitPerBanquetAED)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="text-xs font-semibold text-[#5A6F66] hover:text-[#192A24] cursor-pointer whitespace-nowrap"
              >
                Clear selection
              </button>
            </div>
          )}

          {/* Color Scale Legend with Explicit Text Thresholds */}
          <div className="pt-3 border-t border-[#E2ECE7] flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#5A6F66]">
            <span>Margin Scale:</span>
            <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
              {[
                { label: '<0% Loss', color: '#DC2626' },
                { label: '0–14% Tight', color: '#FB923C' },
                { label: '15–34% Moderate', color: '#F59E0B' },
                { label: '35–49% Healthy', color: '#4D9E7B' },
                { label: '50–64% Strong', color: '#236B50' },
                { label: '65%+ Peak', color: '#166534' },
              ].map(item => (
                <span key={item.label} className="inline-flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-xs inline-block shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
