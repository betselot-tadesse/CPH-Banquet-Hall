import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  BarChart3, 
  DollarSign, 
  Target, 
  Calendar, 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownRight, 
  Info,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/costCalculations';
import { BookingEvent } from '../types';

export interface MonthlyComparativeMetric {
  monthKey: string;
  monthLabel: string;
  adSpendAED: number;
  totalBanquetRevenue: number;
  totalDirectCosts: number;
  netProfitAfterMarketing: number;
  roas: number;
  leadsGenerated: number;
  bookingsCount: number;
  finishedCount: number;
  upcomingCount: number;
  conversionRate: number;
  cpr: number;
  cac: number;
  marketingPercentOfRevenue: number;
  monthBookings?: BookingEvent[];
}

interface MarketingRoasBarChartProps {
  data: MonthlyComparativeMetric[];
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
}

export const MarketingRoasBarChart: React.FC<MarketingRoasBarChartProps> = ({
  data,
  selectedMonthKey,
  onSelectMonth,
}) => {
  const [hoveredMonthKey, setHoveredMonthKey] = useState<string | null>(null);

  // Chronologically sorted months for proper progression trend (e.g., Aug -> Sep -> Oct -> Nov)
  const chronologicalData = useMemo(() => {
    return [...data].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [data]);

  // Max revenue across months to calculate relative bar heights (add buffer for clean spacing)
  const maxRevenue = useMemo(() => {
    const highest = Math.max(...chronologicalData.map(d => Math.max(d.totalBanquetRevenue, d.adSpendAED * 5)), 70000);
    return Math.ceil(highest / 10000) * 10000;
  }, [chronologicalData]);

  // Highest ROAS month
  const peakRoasMonth = useMemo(() => {
    if (chronologicalData.length === 0) return null;
    return chronologicalData.reduce((prev, curr) => (curr.roas > prev.roas ? curr : prev), chronologicalData[0]);
  }, [chronologicalData]);

  // Peak Revenue month
  const peakRevenueMonth = useMemo(() => {
    if (chronologicalData.length === 0) return null;
    return chronologicalData.reduce((prev, curr) => (curr.totalBanquetRevenue > prev.totalBanquetRevenue ? curr : prev), chronologicalData[0]);
  }, [chronologicalData]);

  // Average ROAS across recorded months
  const averageRoas = useMemo(() => {
    if (chronologicalData.length === 0) return 0;
    const totalRev = chronologicalData.reduce((sum, d) => sum + d.totalBanquetRevenue, 0);
    const totalSpend = chronologicalData.reduce((sum, d) => sum + d.adSpendAED, 0);
    return totalSpend > 0 ? totalRev / totalSpend : 0;
  }, [chronologicalData]);

  // Active month object (hovered or selected)
  const activeFocusItem = useMemo(() => {
    const key = hoveredMonthKey || selectedMonthKey;
    return chronologicalData.find(d => d.monthKey === key) || chronologicalData[chronologicalData.length - 1];
  }, [chronologicalData, hoveredMonthKey, selectedMonthKey]);

  // Y-axis tick intervals
  const yTicks = [0, maxRevenue * 0.25, maxRevenue * 0.5, maxRevenue * 0.75, maxRevenue];

  return (
    <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-xs space-y-6 font-['Plus_Jakarta_Sans']">
      {/* Header & Strategic Insight Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-[#E2ECE7] gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#236B50] text-xs font-black uppercase tracking-wider">
            <BarChart3 className="w-4 h-4" />
            <span>Executive Performance Visualization</span>
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold text-[#192A24] mt-0.5 tracking-tight">
            Monthly Marketing Spend vs. Banquet Revenue & ROAS Trends
          </h3>
          <p className="text-xs text-[#5A6F66] mt-0.5 max-w-2xl">
            Visualizing the direct multiplier return on Meta Ads (Facebook & Instagram) spend compared with gross banquet party receipts across each operational month.
          </p>
        </div>

        {/* Highlight Badges */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto shrink-0">
          <div className="px-3 py-1.5 rounded-2xl bg-[#EBF5F0] border border-[#B8DFC9] flex items-center space-x-2">
            <span className="text-[10px] font-extrabold uppercase text-[#236B50]">
              Avg. ROAS:
            </span>
            <strong className="text-xs font-black text-[#1D6047]">
              {averageRoas.toFixed(2)}x
            </strong>
          </div>

          {peakRoasMonth && (
            <div className="px-3 py-1.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[10px] font-extrabold uppercase text-amber-900">
                Peak ROAS:
              </span>
              <strong className="text-xs font-black text-amber-900">
                {peakRoasMonth.roas.toFixed(2)}x ({peakRoasMonth.monthLabel.split(' ')[0]})
              </strong>
            </div>
          )}

          {peakRevenueMonth && (
            <div className="px-3 py-1.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center space-x-1.5">
              <span className="text-[10px] font-extrabold uppercase text-[#236B50]">
                Peak Income:
              </span>
              <strong className="text-xs font-black text-[#236B50]">
                {formatCurrency(peakRevenueMonth.totalBanquetRevenue)}
              </strong>
            </div>
          )}
        </div>
      </div>

      {/* Chart Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-[#F8FAF9] p-3 rounded-2xl border border-[#E2ECE7]">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center space-x-2">
            <span className="w-3.5 h-3.5 rounded-md bg-[#236B50] shadow-xs" />
            <span className="font-extrabold text-[#192A24]">Banquet Parties Revenue (AED)</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="w-3.5 h-3.5 rounded-md bg-amber-500 shadow-xs" />
            <span className="font-extrabold text-[#192A24]">Meta Marketing Spend (AED)</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#1D6047] font-black text-[10px] border border-emerald-300">
              XX.Xx ROAS
            </span>
            <span className="font-bold text-[#5A6F66]">Multiplier Ratio Pill</span>
          </div>
        </div>

        <span className="text-[11px] text-[#5A6F66] font-medium hidden sm:inline">
          💡 Click or hover any month to inspect granular metrics
        </span>
      </div>

      {/* Interactive Dual-Bar Chart with ROAS Trend Badges */}
      <div className="relative pt-6 pb-2 overflow-x-auto">
        {/* Y-Axis Grid Lines & Labels */}
        <div className={`relative h-64 sm:h-72 ${chronologicalData.length > 16 ? 'min-w-[1280px]' : chronologicalData.length > 8 ? 'min-w-[920px]' : 'w-full'}`}>
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {yTicks.slice().reverse().map((tick, idx) => (
              <div key={idx} className="flex items-center w-full">
                <span className="w-16 sm:w-20 text-[10px] font-bold text-[#7E968C] tabular-nums shrink-0 text-right pr-2">
                  {tick === 0 ? 'AED 0' : `AED ${(tick / 1000).toFixed(0)}k`}
                </span>
                <div className="flex-1 border-b border-dashed border-[#E2ECE7]" />
              </div>
            ))}
          </div>

          {/* Bars Column Container */}
          <div className="absolute inset-0 pl-16 sm:pl-20 pr-3 flex items-end justify-around gap-2 sm:gap-4">
            {chronologicalData.map((item, idx) => {
              const isSelected = selectedMonthKey === item.monthKey;
              const isHovered = hoveredMonthKey === item.monthKey;
              const isHighlighted = isSelected || isHovered;

              // Height calculations relative to maxRevenue (keep 0 exact for zero months)
              const revHeightPercent = item.totalBanquetRevenue > 0
                ? Math.min(100, Math.max(4, (item.totalBanquetRevenue / maxRevenue) * 100))
                : 0;
              const spendHeightPercent = item.adSpendAED > 0
                ? Math.min(100, Math.max(3, (item.adSpendAED / maxRevenue) * 100))
                : 0;

              // Compute trend relative to previous month
              const prevItem = idx > 0 ? chronologicalData[idx - 1] : null;
              const roasDiff = prevItem && item.adSpendAED > 0 && prevItem.adSpendAED > 0 ? item.roas - prevItem.roas : null;

              return (
                <div
                  key={item.monthKey}
                  onClick={() => onSelectMonth(item.monthKey)}
                  onMouseEnter={() => setHoveredMonthKey(item.monthKey)}
                  onMouseLeave={() => setHoveredMonthKey(null)}
                  className={`flex-1 h-full flex flex-col justify-end items-center group cursor-pointer transition-all duration-200 relative ${
                    isHighlighted ? 'scale-102' : 'opacity-90 hover:opacity-100'
                  }`}
                >
                  {/* Floating ROAS Multiplier Pill above bars */}
                  <div className="mb-2 flex flex-col items-center transition-transform group-hover:-translate-y-1">
                    {item.adSpendAED > 0 ? (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border transition-all shadow-xs whitespace-nowrap ${
                        item.roas >= 11
                          ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-200'
                          : item.roas >= 10
                          ? 'bg-[#236B50] text-white border-[#1D6047]'
                          : 'bg-emerald-100 text-[#1D6047] border-emerald-300'
                      }`}>
                        {item.roas.toFixed(1)}x ROAS
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-50 text-slate-400 border-slate-200 whitespace-nowrap">
                        {item.totalBanquetRevenue > 0 ? 'Organic' : '—'}
                      </span>
                    )}

                    {/* Trend relative to previous month */}
                    {roasDiff !== null && (
                      <span className={`text-[9px] font-extrabold flex items-center mt-0.5 ${
                        roasDiff >= 0 ? 'text-emerald-700' : 'text-amber-700'
                      }`}>
                        {roasDiff >= 0 ? (
                          <>
                            <ArrowUpRight className="w-2.5 h-2.5" />
                            <span>+{roasDiff.toFixed(1)}x</span>
                          </>
                        ) : (
                          <>
                            <ArrowDownRight className="w-2.5 h-2.5" />
                            <span>{roasDiff.toFixed(1)}x</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Dual Bar Pair */}
                  <div className="w-full max-w-[72px] flex items-end justify-center gap-1 sm:gap-1.5">
                    {/* 1. Marketing Spend Bar (Amber/Gold) */}
                    <div
                      style={{ height: `${spendHeightPercent}%` }}
                      className={`w-1/2 rounded-t-xl transition-all duration-300 relative group/bar ${
                        spendHeightPercent === 0
                          ? 'bg-transparent'
                          : isHighlighted
                          ? 'bg-amber-500 shadow-md ring-1 ring-amber-400'
                          : 'bg-amber-500/85 hover:bg-amber-500'
                      }`}
                    >
                      {/* Tooltip on bar hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 rounded bg-amber-950 text-white text-[9px] font-bold opacity-0 group-hover/bar:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-20">
                        Spend: AED {item.adSpendAED.toLocaleString()}
                      </div>
                    </div>

                    {/* 2. Banquet Revenue Bar (Emerald Forest Green) */}
                    <div
                      style={{ height: `${revHeightPercent}%` }}
                      className={`w-1/2 rounded-t-xl transition-all duration-300 relative group/bar ${
                        revHeightPercent === 0
                          ? 'bg-transparent'
                          : isHighlighted
                          ? 'bg-gradient-to-t from-[#153F30] via-[#1D5741] to-[#236B50] shadow-md ring-2 ring-emerald-300'
                          : 'bg-gradient-to-t from-[#1A4F3C] to-[#236B50] hover:brightness-105'
                      }`}
                    >
                      {/* Tooltip on bar hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 rounded bg-[#153F30] text-white text-[9px] font-bold opacity-0 group-hover/bar:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-20">
                        Income: AED {item.totalBanquetRevenue.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Month Label below bars */}
                  <div className="mt-2.5 text-center">
                    <span className={`block text-[11px] font-black tracking-tight ${
                      isHighlighted ? 'text-[#236B50]' : 'text-[#192A24]'
                    }`}>
                      {item.monthLabel.split(' ')[0].slice(0, 3)}
                    </span>
                    <span className="text-[10px] text-[#5A6F66] font-semibold block">
                      {item.monthLabel.split(' ')[1]}
                    </span>
                    {item.monthKey === '2026-08' && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-[#236B50] text-white text-[8px] font-black uppercase">
                        Latest
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dynamic Drilldown Summary for Active Month */}
      {activeFocusItem && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#F6FAF8] via-white to-[#F2F7F5] border border-[#D5E5DE] transition-all">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#236B50] text-white">
                  {activeFocusItem.monthLabel} Snapshot
                </span>
                <span className="text-xs font-extrabold text-[#236B50]">
                  ROAS Multiplier: {activeFocusItem.adSpendAED > 0 ? `${activeFocusItem.roas.toFixed(2)}x` : '—'}
                </span>
              </div>
              <h4 className="text-sm font-extrabold text-[#192A24]">
                AED {activeFocusItem.adSpendAED.toLocaleString()} Ad Spend generated {formatCurrency(activeFocusItem.totalBanquetRevenue)} in Banquet Bookings
              </h4>
              <p className="text-xs text-[#5A6F66]">
                Delivered <strong>{activeFocusItem.leadsGenerated} Meta leads</strong> resulting in <strong>{activeFocusItem.bookingsCount} confirmed banquet hall parties</strong> ({activeFocusItem.finishedCount} completed, {activeFocusItem.upcomingCount} upcoming).
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs shrink-0">
              <div className="bg-white p-2.5 rounded-xl border border-[#E2ECE7]">
                <span className="text-[10px] font-bold text-[#5A6F66] block">CPR (Cost / Lead)</span>
                <strong className="text-xs font-black text-[#192A24]">
                  {activeFocusItem.cpr > 0 ? `AED ${activeFocusItem.cpr.toFixed(2)}` : '—'}
                </strong>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-[#E2ECE7]">
                <span className="text-[10px] font-bold text-[#5A6F66] block">Conversion Rate</span>
                <strong className="text-xs font-black text-blue-700">
                  {activeFocusItem.leadsGenerated > 0 ? `${activeFocusItem.conversionRate.toFixed(1)}%` : '—'}
                </strong>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-[#E2ECE7]">
                <span className="text-[10px] font-bold text-[#5A6F66] block">CAC Per Party</span>
                <strong className="text-xs font-black text-[#192A24]">
                  {activeFocusItem.cac > 0 ? `AED ${activeFocusItem.cac.toFixed(0)}` : '—'}
                </strong>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-[#E2ECE7]">
                <span className="text-[10px] font-bold text-[#5A6F66] block">Net Return After Ads</span>
                <strong className={`text-xs font-black ${activeFocusItem.netProfitAfterMarketing >= 0 ? 'text-[#236B50]' : 'text-rose-700'}`}>
                  {activeFocusItem.netProfitAfterMarketing >= 0
                    ? `+${formatCurrency(activeFocusItem.netProfitAfterMarketing)}`
                    : formatCurrency(activeFocusItem.netProfitAfterMarketing)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
