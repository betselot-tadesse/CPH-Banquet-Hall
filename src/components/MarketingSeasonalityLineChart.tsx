import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  Sparkles, 
  Info, 
  ArrowUpRight, 
  BarChart2, 
  Flame, 
  Sun, 
  Award,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/costCalculations';
import { MonthlyComparativeMetric } from './MarketingRoasBarChart';

interface MarketingSeasonalityLineChartProps {
  data: MonthlyComparativeMetric[];
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
}

export const MarketingSeasonalityLineChart: React.FC<MarketingSeasonalityLineChartProps> = ({
  data,
  selectedMonthKey,
  onSelectMonth,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeMetricFilter, setActiveMetricFilter] = useState<'both' | 'spend' | 'revenue'>('both');

  // Ensure all 12 months of the current year (2026) are represented for comprehensive seasonality tracking
  const allMonths2026 = useMemo(() => {
    const monthDefs = [
      { key: '2026-01', label: 'Jan 2026', short: 'Jan', season: 'Q1 Actuals' },
      { key: '2026-02', label: 'Feb 2026', short: 'Feb', season: 'Q1 Actuals' },
      { key: '2026-03', label: 'Mar 2026', short: 'Mar', season: 'Q1 Actuals' },
      { key: '2026-04', label: 'Apr 2026', short: 'Apr', season: 'Q2 Actuals' },
      { key: '2026-05', label: 'May 2026', short: 'May', season: 'Q2 Actuals' },
      { key: '2026-06', label: 'Jun 2026', short: 'Jun', season: 'Q2 Actuals' },
      { key: '2026-07', label: 'Jul 2026', short: 'Jul', season: 'Q3 Actuals' },
      { key: '2026-08', label: 'Aug 2026', short: 'Aug', season: 'Q3 Actuals (Latest Actual)' },
      { key: '2026-09', label: 'Sep 2026', short: 'Sep', season: 'Q3 Unrecorded' },
      { key: '2026-10', label: 'Oct 2026', short: 'Oct', season: 'Q4 Unrecorded' },
      { key: '2026-11', label: 'Nov 2026', short: 'Nov', season: 'Q4 Unrecorded' },
      { key: '2026-12', label: 'Dec 2026', short: 'Dec', season: 'Q4 Unrecorded' },
    ];

    return monthDefs.map(def => {
      // Only plot actual recorded data; unrecorded months stay at 0
      const actual = data.find(d => d.monthKey === def.key);
      const spend = actual ? actual.adSpendAED : 0;
      const rev = actual ? actual.totalBanquetRevenue : 0;
      const leads = actual ? actual.leadsGenerated : 0;
      const cpr = actual ? actual.cpr : 0;
      const roas = spend > 0 ? rev / spend : 0;
      const convRate = actual ? actual.conversionRate : 0;
      const isActual = !!actual;

      return {
        monthKey: def.key,
        monthLabel: def.label,
        shortLabel: def.short,
        season: def.season,
        adSpendAED: spend,
        totalBanquetRevenue: rev,
        leadsGenerated: leads,
        cpr,
        roas,
        conversionRate: convRate,
        isActual,
        isCurrent: def.key === '2026-08',
      };
    });
  }, [data]);

  // Scaled coordinates for SVG Chart
  // Width: 1000, Height: 300, Padding: Left 55, Right 35, Top 30, Bottom 40
  const svgWidth = 1000;
  const svgHeight = 280;
  const padLeft = 65;
  const padRight = 45;
  const padTop = 30;
  const padBottom = 45;

  const chartWidth = svgWidth - padLeft - padRight;
  const chartHeight = svgHeight - padTop - padBottom;

  // Max revenue scale (Banquet Revenue: e.g. 70,000 AED max)
  const maxRevenue = useMemo(() => {
    const highestRev = Math.max(...allMonths2026.map(m => m.totalBanquetRevenue), 70000);
    return Math.ceil(highestRev / 10000) * 10000;
  }, [allMonths2026]);

  // Max spend scale (Marketing Spend: e.g. 7,000 AED max)
  const maxSpend = useMemo(() => {
    const highestSpend = Math.max(...allMonths2026.map(m => m.adSpendAED), 7000);
    return Math.ceil(highestSpend / 1000) * 1000;
  }, [allMonths2026]);

  // Point positions for each month
  const points = useMemo(() => {
    const count = allMonths2026.length;
    const stepX = chartWidth / (count - 1);

    return allMonths2026.map((m, i) => {
      const x = padLeft + i * stepX;
      // Revenue point (0 to maxRevenue mapped to padTop+chartHeight to padTop)
      const revRatio = Math.min(m.totalBanquetRevenue / maxRevenue, 1);
      const revY = padTop + chartHeight - revRatio * chartHeight;

      // Spend point (0 to maxSpend mapped to padTop+chartHeight to padTop)
      // We align spend on the secondary scale so visual overlay displays trajectory
      const spendRatio = Math.min(m.adSpendAED / maxSpend, 1);
      const spendY = padTop + chartHeight - spendRatio * chartHeight;

      return {
        ...m,
        index: i,
        x,
        revY,
        spendY,
      };
    });
  }, [allMonths2026, chartWidth, chartHeight, maxRevenue, maxSpend]);

  // Create smooth SVG cubic bezier curves
  const makeSmoothPath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const curr = pts[i];
      const next = pts[i + 1];
      const cx1 = curr.x + (next.x - curr.x) / 2;
      const cy1 = curr.y;
      const cx2 = curr.x + (next.x - curr.x) / 2;
      const cy2 = next.y;
      d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${next.x} ${next.y}`;
    }
    return d;
  };

  const revenuePath = useMemo(() => {
    const revPts = points.map(p => ({ x: p.x, y: p.revY }));
    return makeSmoothPath(revPts);
  }, [points]);

  const spendPath = useMemo(() => {
    const spendPts = points.map(p => ({ x: p.x, y: p.spendY }));
    return makeSmoothPath(spendPts);
  }, [points]);

  // Closed area paths for gradient shading
  const revenueAreaPath = useMemo(() => {
    if (points.length === 0) return '';
    const bottom = padTop + chartHeight;
    return `${revenuePath} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`;
  }, [revenuePath, points, chartHeight]);

  const spendAreaPath = useMemo(() => {
    if (points.length === 0) return '';
    const bottom = padTop + chartHeight;
    return `${spendPath} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`;
  }, [spendPath, points, chartHeight]);

  // Selected or hovered point
  const activePoint = useMemo(() => {
    if (hoveredIndex !== null) return points[hoveredIndex];
    return points.find(p => p.monthKey === selectedMonthKey) || points.find(p => p.isCurrent) || points[7];
  }, [points, hoveredIndex, selectedMonthKey]);

  // Seasonality Peak Highlights
  const highestRevMonth = useMemo(() => {
    return [...allMonths2026].sort((a, b) => b.totalBanquetRevenue - a.totalBanquetRevenue)[0];
  }, [allMonths2026]);

  const lowestRevMonth = useMemo(() => {
    return [...allMonths2026].sort((a, b) => a.totalBanquetRevenue - b.totalBanquetRevenue)[0];
  }, [allMonths2026]);

  const bestRoasMonth = useMemo(() => {
    return [...allMonths2026].sort((a, b) => b.roas - a.roas)[0];
  }, [allMonths2026]);

  return (
    <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 sm:p-7 shadow-xs space-y-6 font-['Plus_Jakarta_Sans']">
      {/* Header and Seasonality Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-[#E2ECE7] gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#236B50] text-xs font-black uppercase tracking-wider">
            <TrendingUp className="w-4 h-4" />
            <span>Current Year 2026 • Seasonality & ROAS Trajectory</span>
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold text-[#192A24] mt-0.5 tracking-tight flex items-center space-x-2">
            <span>Total Marketing Spend vs. Banquet Revenue (Monthly Overlay)</span>
          </h3>
          <p className="text-xs text-[#5A6F66] mt-0.5 max-w-2xl">
            Multi-line overlay mapping advertising investment against resulting banquet income across all 12 months of 2026 to detect seasonal spikes, festival surges, and summer lull patterns.
          </p>
        </div>

        {/* Legend & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto shrink-0">
          <div className="inline-flex rounded-xl p-1 bg-[#F4F8F6] border border-[#D5E5DE] text-xs font-bold shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveMetricFilter('both')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeMetricFilter === 'both'
                  ? 'bg-white text-[#192A24] shadow-xs'
                  : 'text-[#5A6F66] hover:text-[#192A24]'
              }`}
            >
              Overlay Both
            </button>
            <button
              type="button"
              onClick={() => setActiveMetricFilter('revenue')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeMetricFilter === 'revenue'
                  ? 'bg-[#236B50] text-white shadow-xs'
                  : 'text-[#236B50] hover:text-[#192A24]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Banquet Revenue</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMetricFilter('spend')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeMetricFilter === 'spend'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-700 hover:text-[#192A24]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Marketing Spend</span>
            </button>
          </div>
        </div>
      </div>

      {/* Seasonality Timeline Legend Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200 flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0"></span>
          <div>
            <div className="font-extrabold text-sky-950 text-[11px]">Q1 (Jan - Mar)</div>
            <div className="text-[10px] text-sky-700">Winter Corporate & Early Spring</div>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200 flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></span>
          <div>
            <div className="font-extrabold text-purple-950 text-[11px]">Q2 (Apr - Jun)</div>
            <div className="text-[10px] text-purple-700">Ramadan Iftar & Eid Receptions</div>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
          <div>
            <div className="font-extrabold text-amber-950 text-[11px]">Q3 (Jul - Sep)</div>
            <div className="text-[10px] text-amber-700">Summer Indoor Discount & Restart</div>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-300 flex items-center space-x-2 ring-1 ring-emerald-300">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0 animate-pulse"></span>
          <div>
            <div className="font-black text-emerald-950 text-[11px]">Q4 (Oct - Dec) • Peak Season</div>
            <div className="text-[10px] text-emerald-800 font-bold">Luxury Weddings & Year-End Galas</div>
          </div>
        </div>
      </div>

      {/* Interactive SVG Multi-Line Chart Canvas */}
      <div className="relative bg-[#FAFCFB] rounded-2xl border border-[#D5E5DE] p-3 sm:p-4 overflow-hidden">
        {/* Left Y-Axis Label (Banquet Revenue AED) */}
        <div className="absolute top-4 left-3 text-[10px] font-black uppercase text-[#236B50] tracking-wider z-10 flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-[#236B50]"></span>
          <span>Banquet Revenue (Left Axis AED)</span>
        </div>

        {/* Right Y-Axis Label (Marketing Spend AED) */}
        <div className="absolute top-4 right-3 text-[10px] font-black uppercase text-amber-700 tracking-wider z-10 flex items-center space-x-1">
          <span>Ad Spend (Right Axis AED)</span>
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
        </div>

        <div className="overflow-x-auto">
          <svg 
            viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
            className="w-full min-w-[700px] h-64 select-none"
          >
            <defs>
              {/* Emerald Revenue Fill Gradient */}
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#236B50" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#236B50" stopOpacity="0.0" />
              </linearGradient>

              {/* Amber Spend Fill Gradient */}
              <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D97706" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#D97706" stopOpacity="0.0" />
              </linearGradient>

              {/* Glowing Drop Shadows */}
              <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#236B50" floodOpacity="0.35" />
              </filter>
              <filter id="amberGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#D97706" floodOpacity="0.35" />
              </filter>
            </defs>

            {/* Horizontal Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y = padTop + chartHeight * (1 - ratio);
              const revVal = maxRevenue * ratio;
              const spendVal = maxSpend * ratio;
              return (
                <g key={`grid_${idx}`}>
                  <line 
                    x1={padLeft} 
                    y1={y} 
                    x2={svgWidth - padRight} 
                    y2={y} 
                    stroke="#E2ECE7" 
                    strokeDasharray={idx === 0 ? 'none' : '3 3'} 
                    strokeWidth={idx === 0 ? '1.5' : '1'} 
                  />
                  {/* Left Label (Revenue) */}
                  <text 
                    x={padLeft - 8} 
                    y={y + 3} 
                    textAnchor="end" 
                    fontSize="9" 
                    fill="#486356" 
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {revVal === 0 ? '0' : `${Math.round(revVal / 1000)}k`}
                  </text>
                  {/* Right Label (Spend) */}
                  <text 
                    x={svgWidth - padRight + 8} 
                    y={y + 3} 
                    textAnchor="start" 
                    fontSize="9" 
                    fill="#B45309" 
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {spendVal === 0 ? '0' : `${(spendVal / 1000).toFixed(1)}k`}
                  </text>
                </g>
              );
            })}

            {/* Shaded Areas */}
            {(activeMetricFilter === 'both' || activeMetricFilter === 'revenue') && (
              <path d={revenueAreaPath} fill="url(#revenueGradient)" />
            )}
            {(activeMetricFilter === 'both' || activeMetricFilter === 'spend') && (
              <path d={spendAreaPath} fill="url(#spendGradient)" />
            )}

            {/* 1. Banquet Revenue Line (Emerald Forest Green) */}
            {(activeMetricFilter === 'both' || activeMetricFilter === 'revenue') && (
              <path
                d={revenuePath}
                fill="none"
                stroke="#236B50"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#emeraldGlow)"
              />
            )}

            {/* 2. Marketing Spend Line (Amber Gold) */}
            {(activeMetricFilter === 'both' || activeMetricFilter === 'spend') && (
              <path
                d={spendPath}
                fill="none"
                stroke="#D97706"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#amberGlow)"
              />
            )}

            {/* Vertical Guide Line on Hover */}
            {hoveredIndex !== null && (
              <line
                x1={points[hoveredIndex].x}
                y1={padTop}
                x2={points[hoveredIndex].x}
                y2={padTop + chartHeight}
                stroke="#192A24"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.4"
              />
            )}

            {/* Interactive Dots for Each Month */}
            {points.map((pt, i) => {
              const isHovered = hoveredIndex === i;
              const isSelected = selectedMonthKey === pt.monthKey;
              const isHighlighted = isHovered || isSelected;

              return (
                <g 
                  key={pt.monthKey} 
                  className="cursor-pointer"
                  onClick={() => onSelectMonth(pt.monthKey)}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Transparent hover target */}
                  <rect
                    x={pt.x - 25}
                    y={padTop}
                    width="50"
                    height={chartHeight + padBottom}
                    fill="transparent"
                  />

                  {/* Revenue Dot */}
                  {(activeMetricFilter === 'both' || activeMetricFilter === 'revenue') && (
                    <circle
                      cx={pt.x}
                      cy={pt.revY}
                      r={isHighlighted ? 7 : 4.5}
                      fill="#FFFFFF"
                      stroke="#236B50"
                      strokeWidth={isHighlighted ? 3.5 : 2.5}
                      className="transition-all duration-150"
                    />
                  )}

                  {/* Spend Dot */}
                  {(activeMetricFilter === 'both' || activeMetricFilter === 'spend') && (
                    <circle
                      cx={pt.x}
                      cy={pt.spendY}
                      r={isHighlighted ? 6 : 4}
                      fill="#FFFFFF"
                      stroke="#D97706"
                      strokeWidth={isHighlighted ? 3 : 2}
                      className="transition-all duration-150"
                    />
                  )}

                  {/* Month Label below chart */}
                  <text
                    x={pt.x}
                    y={padTop + chartHeight + 20}
                    textAnchor="middle"
                    fontSize={isHighlighted ? '11' : '10'}
                    fontWeight={isHighlighted || pt.isCurrent ? '800' : '600'}
                    fill={isHighlighted ? '#236B50' : pt.isCurrent ? '#192A24' : '#5A6F66'}
                  >
                    {pt.shortLabel}
                  </text>

                  {/* Indicator tag for Current Month (Oct) */}
                  {pt.isCurrent && (
                    <text
                      x={pt.x}
                      y={padTop + chartHeight + 32}
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight="900"
                      fill="#236B50"
                    >
                      ★ CURRENT
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Dynamic Month Drilldown Card for Focused Month */}
      {activePoint && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#F6FAF8] via-white to-[#F2F7F5] border border-[#D5E5DE] shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#236B50] text-white">
                  {activePoint.monthLabel}
                </span>
                <span className="text-xs font-bold text-[#5A6F66]">
                  Phase: <strong>{activePoint.season}</strong>
                </span>
                {activePoint.isActual ? (
                  <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                    ✓ Verified Data
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                    No Actual Data
                  </span>
                )}
              </div>
              <h4 className="text-base font-extrabold text-[#192A24]">
                Spend: <span className="text-amber-700">{formatCurrency(activePoint.adSpendAED)}</span> ➔ Generated <span className="text-[#236B50]">{formatCurrency(activePoint.totalBanquetRevenue)}</span> Banquet Revenue
              </h4>
              <p className="text-xs text-[#5A6F66]">
                Efficiency Multiplier: <strong className="text-[#236B50] font-black">{activePoint.adSpendAED > 0 ? `${activePoint.roas.toFixed(2)}x ROAS` : '—'}</strong> • Produced <strong>{activePoint.leadsGenerated} Meta ad leads</strong> at CPR of <strong>{activePoint.cpr > 0 ? `AED ${activePoint.cpr.toFixed(2)}` : '—'}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs shrink-0">
              <div className="bg-white p-2.5 rounded-xl border border-[#E2ECE7] shadow-2xs">
                <span className="text-[10px] font-bold text-[#5A6F66] block">Marketing Spend</span>
                <strong className="text-xs font-black text-amber-800">
                  {activePoint.adSpendAED > 0 ? formatCurrency(activePoint.adSpendAED) : '—'}
                </strong>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-[#E2ECE7] shadow-2xs">
                <span className="text-[10px] font-bold text-[#5A6F66] block">Banquet Revenue</span>
                <strong className="text-xs font-black text-[#236B50]">
                  {activePoint.totalBanquetRevenue > 0 ? formatCurrency(activePoint.totalBanquetRevenue) : '—'}
                </strong>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-[#E2ECE7] shadow-2xs">
                <span className="text-[10px] font-bold text-[#5A6F66] block">ROAS Multiplier</span>
                <strong className="text-xs font-black text-[#236B50]">
                  {activePoint.adSpendAED > 0 ? `${activePoint.roas.toFixed(2)}x` : '—'}
                </strong>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-[#E2ECE7] shadow-2xs">
                <span className="text-[10px] font-bold text-[#5A6F66] block">Net Profit Delta</span>
                {(() => {
                  const delta = activePoint.totalBanquetRevenue * 0.62 - activePoint.adSpendAED;
                  return (
                    <strong className={`text-xs font-black ${delta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {delta >= 0 ? `+${formatCurrency(delta)}` : formatCurrency(delta)}
                    </strong>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seasonality Intelligence & Strategic Takeaways */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#D5E5DE] shadow-2xs space-y-1">
          <div className="flex items-center space-x-2 text-emerald-800 text-xs font-bold uppercase tracking-wider">
            <Award className="w-4 h-4 text-[#236B50]" />
            <span>Peak Revenue Month</span>
          </div>
          <div className="text-lg font-black text-[#192A24]">
            {highestRevMonth.monthLabel} ({formatCurrency(highestRevMonth.totalBanquetRevenue)})
          </div>
          <p className="text-[11px] text-[#5A6F66]">
            Year-end corporate dinners and National Day celebrations push banquet demand to annual maximums.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#D5E5DE] shadow-2xs space-y-1">
          <div className="flex items-center space-x-2 text-[#236B50] text-xs font-bold uppercase tracking-wider">
            <Flame className="w-4 h-4 text-amber-600" />
            <span>Highest ROAS Efficiency</span>
          </div>
          <div className="text-lg font-black text-[#236B50]">
            {bestRoasMonth.monthLabel} ({bestRoasMonth.roas.toFixed(2)}x ROAS)
          </div>
          <p className="text-[11px] text-[#5A6F66]">
            October & November deliver peak conversion rates where wedding families commit immediately to high-tier 80/100 AED packages.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#D5E5DE] shadow-2xs space-y-1">
          <div className="flex items-center space-x-2 text-amber-800 text-xs font-bold uppercase tracking-wider">
            <Sun className="w-4 h-4 text-amber-600" />
            <span>Seasonal Summer Strategy</span>
          </div>
          <div className="text-lg font-black text-[#192A24]">
            July - August (Lower Ad Spend)
          </div>
          <p className="text-[11px] text-[#5A6F66]">
            Summer lull requires maintaining tactical brand presence while conserving advertising budget for the massive Q4 wedding surge.
          </p>
        </div>
      </div>
    </div>
  );
};
