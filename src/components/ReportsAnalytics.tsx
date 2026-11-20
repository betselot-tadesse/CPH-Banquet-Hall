import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  UtensilsCrossed, 
  Download, 
  Layers, 
  CheckCircle2, 
  Building2,
  FileSpreadsheet,
  Building,
  Filter,
  DollarSign,
  BarChart3,
  Sparkles,
  ArrowUpRight,
  Receipt,
  ShieldCheck,
  AlertCircle,
  Target
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { BookingEvent, UserProfile, BanquetHall, Invoice, MetaAdMonthlyReport } from '../types';
import { calculateEventFinancials, formatCurrency, formatPercent, getLiveTodayInfo } from '../utils/costCalculations';
import { AppStorage } from '../services/storage';
import { BanquetHistoricalLedgerReport } from './BanquetHistoricalLedgerReport';

interface ReportsAnalyticsProps {
  bookings: BookingEvent[];
  invoices?: Invoice[];
  halls: BanquetHall[];
  currentUser: UserProfile;
  marketingReports?: MetaAdMonthlyReport[];
  onSaveMarketingReport?: (report: MetaAdMonthlyReport) => void;
  onSaveMarketingReportsBatch?: (reports: MetaAdMonthlyReport[], metaSummary: string) => void;
  onRestoreMarketingReports?: (snapshot: MetaAdMonthlyReport[]) => void;
}

export const ReportsAnalytics: React.FC<ReportsAnalyticsProps> = ({
  bookings,
  invoices = [],
  halls,
  currentUser,
  marketingReports: propMarketingReports,
  onSaveMarketingReport,
  onSaveMarketingReportsBatch,
  onRestoreMarketingReports,
}) => {
  // Main view switcher
  const [mainReportView, setMainReportView] = useState<'annual_ledger' | 'trends_invoices' | 'event_ledger'>('annual_ledger');
  
  // Local marketing reports fallback when parent prop is omitted
  const [localReports, setLocalReports] = useState<MetaAdMonthlyReport[]>(() => {
    return propMarketingReports && propMarketingReports.length > 0 
      ? propMarketingReports 
      : AppStorage.getMarketingReports();
  });

  const activeReports = propMarketingReports ?? localReports;

  const handleSaveReport = (report: MetaAdMonthlyReport) => {
    if (onSaveMarketingReport) {
      onSaveMarketingReport(report);
    } else {
      AppStorage.saveMarketingReport(report);
    }
    setLocalReports(AppStorage.getMarketingReports());
  };

  const handleSaveReportsBatch = (reportsToSave: MetaAdMonthlyReport[], metaSummary: string) => {
    if (onSaveMarketingReportsBatch) {
      onSaveMarketingReportsBatch(reportsToSave, metaSummary);
    } else {
      reportsToSave.forEach(r => AppStorage.saveMarketingReport(r));
    }
    setLocalReports(AppStorage.getMarketingReports());
  };

  const handleRestoreReports = (snapshot: MetaAdMonthlyReport[]) => {
    if (onRestoreMarketingReports) {
      onRestoreMarketingReports(snapshot);
    } else {
      AppStorage.setMarketingReports(snapshot);
    }
    setLocalReports(AppStorage.getMarketingReports());
  };

  // Manager's Monthly Banquet Revenue Goal State
  const [revenueGoal, setRevenueGoal] = useState<number>(() => AppStorage.getMonthlyRevenueGoal());
  const [customGoalInput, setCustomGoalInput] = useState<string>('');
  const [goalSavedMsg, setGoalSavedMsg] = useState<string>('');

  const handleUpdateGoal = (newGoal: number) => {
    AppStorage.setMonthlyRevenueGoal(newGoal);
    setRevenueGoal(newGoal);
    setGoalSavedMsg(`Monthly Revenue Goal updated to AED ${newGoal.toLocaleString()}! Live on Dashboard.`);
    setTimeout(() => setGoalSavedMsg(''), 4000);
  };

  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [selectedYear, setSelectedYear] = useState<'2026' | '2025'>('2026');
  // Hall / Venue selector for Crystal Plaza Hotel
  const [selectedHallFilter, setSelectedHallFilter] = useState<string>('all');

  const { todayStr, currentMonthStr, currentMonthLabel, currentYearStr, currentMonthShort, daysInCurrentMonth, weekStartStr, weekEndStr } = getLiveTodayInfo();

  // =========================================================================
  // RECHARTS LINE CHART: FINANCIAL PERFORMANCE (Monthly Net Profit Margin Trends)
  // Based strictly on finalized invoices (Paid, Partially Paid, Issued)
  // =========================================================================
  const finalizedInvoices = useMemo(() => {
    return invoices.filter(inv => 
      inv.status === 'Paid' || inv.status === 'Partially Paid' || inv.status === 'Issued'
    );
  }, [invoices]);

  const monthlyFinancialData = useMemo(() => {
    const map = new Map<string, {
      monthKey: string;
      monthLabel: string;
      revenue: number;
      costs: number;
      netProfit: number;
      invoiceCount: number;
      paidCount: number;
      guestCount: number;
    }>();

    const formatMonthLabel = (key: string) => {
      const [y, m] = key.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const idx = parseInt(m, 10) - 1;
      return `${monthNames[idx] || m} ${y}`;
    };

    finalizedInvoices.forEach(inv => {
      const monthKey = inv.eventDate?.substring(0, 7) || inv.issueDate?.substring(0, 7) || currentMonthStr;
      if (!map.has(monthKey)) {
        map.set(monthKey, {
          monthKey,
          monthLabel: formatMonthLabel(monthKey),
          revenue: 0,
          costs: 0,
          netProfit: 0,
          invoiceCount: 0,
          paidCount: 0,
          guestCount: 0,
        });
      }
      const curr = map.get(monthKey)!;
      const invRevenue = inv.subtotal || inv.grandTotal || 0;
      const invCost = inv.internalTotalCost || 0;
      const invProfit = inv.internalGrossProfit !== undefined ? inv.internalGrossProfit : (invRevenue - invCost);

      curr.revenue += invRevenue;
      curr.costs += invCost;
      curr.netProfit += invProfit;
      curr.invoiceCount += 1;
      if (inv.status === 'Paid') curr.paidCount += 1;
      curr.guestCount += inv.guestCount || 0;
    });

    return Array.from(map.values())
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map(item => {
        const margin = item.revenue > 0 ? (item.netProfit / item.revenue) * 100 : 0;
        return {
          ...item,
          marginPercent: parseFloat(margin.toFixed(1)),
          revenueFormatted: formatCurrency(item.revenue),
          netProfitFormatted: formatCurrency(item.netProfit),
          costsFormatted: formatCurrency(item.costs),
        };
      });
  }, [finalizedInvoices]);

  const overallFinalizedRevenue = monthlyFinancialData.reduce((sum, m) => sum + m.revenue, 0);
  const overallFinalizedProfit = monthlyFinancialData.reduce((sum, m) => sum + m.netProfit, 0);
  const overallFinalizedMarginPercent = overallFinalizedRevenue > 0 
    ? parseFloat(((overallFinalizedProfit / overallFinalizedRevenue) * 100).toFixed(1)) 
    : 0;
  const bestMarginMonth = [...monthlyFinancialData].sort((a, b) => b.marginPercent - a.marginPercent)[0];

  // Custom Tooltip for the Financial Performance Recharts line chart
  const CustomFinancialPerformanceTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isTargetMet = data.marginPercent >= 45.0;
      return (
        <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-[#D5E5DE] text-xs space-y-2 min-w-[240px]">
          <div className="font-extrabold text-[#192A24] text-sm border-b border-[#E2ECE7] pb-1.5 flex justify-between items-center">
            <span>{data.monthLabel}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F5EE] text-[#236B50]">
              {data.invoiceCount} {data.invoiceCount === 1 ? 'Invoice' : 'Invoices'}
            </span>
          </div>

          <div className="space-y-1.5 pt-0.5">
            <div className="flex justify-between items-center">
              <span className="text-[#5A6F66]">Net Profit Margin:</span>
              <span className={`font-extrabold text-sm px-2 py-0.5 rounded-lg ${
                isTargetMet ? 'bg-[#E8F5EE] text-[#236B50]' : 'bg-amber-50 text-amber-700'
              }`}>
                {data.marginPercent}%
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[#5A6F66]">Invoiced Revenue:</span>
              <strong className="text-[#192A24] font-mono">{formatCurrency(data.revenue)}</strong>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[#5A6F66]">Direct COGS / Costs:</span>
              <span className="text-[#5A6F66] font-mono">{formatCurrency(data.costs)}</span>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-[#E2ECE7]">
              <span className="text-[#192A24] font-semibold">Net Realized Profit:</span>
              <strong className="text-[#236B50] font-mono">+{formatCurrency(data.netProfit)}</strong>
            </div>
          </div>

          <div className="pt-1.5 border-t border-[#E2ECE7] text-[10px] text-[#5A6F66] flex items-center justify-between">
            <span>Target Benchmark: 45.0%</span>
            <span className={isTargetMet ? 'text-[#236B50] font-bold' : 'text-amber-600 font-bold'}>
              {isTargetMet ? '✓ Target Exceeded' : '⚠ Below 45% Target'}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // =========================================================================
  // RECHARTS LINE CHART: DAILY BANQUET REVENUE TRENDS (Current Month)
  // =========================================================================
  const chartDaysInMonth = daysInCurrentMonth;
  
  // Filter bookings for chart by selected hall (or all halls in Crystal Plaza Hotel)
  const chartFilteredBookings = bookings.filter(b => {
    if (!b.eventDate.startsWith(currentMonthStr)) return false;
    if (selectedHallFilter === 'all') return true;
    return b.hallId === selectedHallFilter;
  });

  // Construct continuous daily chart data for the active month
  const dailyChartData = Array.from({ length: chartDaysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateStr = `${currentMonthStr}-${dayNum.toString().padStart(2, '0')}`;
    const dayLabel = `${currentMonthShort} ${dayNum}`;

    // Find all bookings on this specific day
    const dayBookings = chartFilteredBookings.filter(b => b.eventDate === dateStr);

    let dayRevenue = 0;
    let dayCosts = 0;
    const dayEventsList: string[] = [];

    dayBookings.forEach(b => {
      const fin = calculateEventFinancials(b);
      dayRevenue += fin.subtotalRevenue;
      dayCosts += fin.totalDirectCosts;
      dayEventsList.push(`${b.clientName} (${b.guestCount}g - ${b.hallName.replace('Crystal Plaza ', '')})`);
    });

    const dayProfit = dayRevenue - dayCosts;
    const dayMargin = dayRevenue > 0 ? (dayProfit / dayRevenue) * 100 : 0;

    return {
      date: dateStr,
      day: dayLabel,
      revenue: parseFloat(dayRevenue.toFixed(2)),
      costs: parseFloat(dayCosts.toFixed(2)),
      profit: parseFloat(dayProfit.toFixed(2)),
      margin: parseFloat(dayMargin.toFixed(1)),
      eventCount: dayBookings.length,
      events: dayEventsList,
    };
  });

  // Chart analytics summary metrics
  const totalChartRevenue = dailyChartData.reduce((sum, d) => sum + d.revenue, 0);
  const totalChartProfit = dailyChartData.reduce((sum, d) => sum + d.profit, 0);
  const daysWithEvents = dailyChartData.filter(d => d.revenue > 0);
  const peakDay = [...dailyChartData].sort((a, b) => b.revenue - a.revenue)[0];
  const averageDayRevenue = daysWithEvents.length > 0 ? totalChartRevenue / daysWithEvents.length : 0;

  // Custom Tooltip for the Recharts line chart
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl border border-[#D5E5DE] text-xs space-y-1.5 min-w-[220px]">
          <div className="font-extrabold text-[#192A24] text-sm border-b border-[#E2ECE7] pb-1 flex justify-between items-center">
            <span>{data.day}, {currentYearStr}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F5EE] text-[#236B50]">
              {data.eventCount} {data.eventCount === 1 ? 'Party' : 'Parties'}
            </span>
          </div>

          <div className="space-y-1 pt-0.5">
            <div className="flex justify-between items-center">
              <span className="text-[#5A6F66] flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#236B50]"></span>
                <span>Billed Revenue:</span>
              </span>
              <strong className="text-[#192A24] font-mono">{formatCurrency(data.revenue)}</strong>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[#5A6F66] flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
                <span>Net Gross Profit:</span>
              </span>
              <strong className="text-[#236B50] font-mono">+{formatCurrency(data.profit)}</strong>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[#5A6F66]">Hotel Direct Cost:</span>
              <span className="text-[#5A6F66] font-mono">{formatCurrency(data.costs)}</span>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-[#E2ECE7]">
              <span className="text-[#192A24] font-semibold">Profit Margin %:</span>
              <span className="font-extrabold text-[#236B50]">{data.margin}%</span>
            </div>
          </div>

          {data.events.length > 0 && (
            <div className="pt-1.5 border-t border-[#E2ECE7] text-[10px] text-[#5A6F66]">
              <div className="font-bold text-[#192A24] mb-0.5">Events Hosted:</div>
              {data.events.map((evt: string, idx: number) => (
                <div key={idx} className="truncate">• {evt}</div>
              ))}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // =========================================================================
  // PERIOD LEDGER TABLE (Daily / Weekly / Monthly)
  // =========================================================================
  const periodBookings = bookings.filter(b => {
    if (reportPeriod === 'daily') {
      return b.eventDate === todayStr;
    }
    if (reportPeriod === 'weekly') {
      return b.eventDate >= weekStartStr && b.eventDate <= weekEndStr;
    }
    if (reportPeriod === 'yearly') {
      return b.eventDate.startsWith(selectedYear);
    }
    return b.eventDate.startsWith(currentMonthStr);
  });

  const eventSummaries = periodBookings.map(b => ({
    booking: b,
    financials: calculateEventFinancials(b),
  }));

  const totalPeriodRevenue = eventSummaries.reduce((sum, item) => sum + item.financials.subtotalRevenue, 0);
  const totalPeriodCosts = eventSummaries.reduce((sum, item) => sum + item.financials.totalDirectCosts, 0);
  const totalPeriodFoodCost = eventSummaries.reduce((sum, item) => sum + item.financials.foodCost, 0);
  const totalPeriodFoodRevenue = eventSummaries.reduce((sum, item) => sum + item.financials.foodRevenue, 0);
  const totalPeriodProfit = totalPeriodRevenue - totalPeriodCosts;
  const averageMarginPercent = totalPeriodRevenue > 0 ? (totalPeriodProfit / totalPeriodRevenue) * 100 : 0;
  const foodCostRatioPercent = totalPeriodFoodRevenue > 0 ? (totalPeriodFoodCost / totalPeriodFoodRevenue) * 100 : 0;

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Booking #', 'Hotel', 'Client', 'Hall', 'Date', 'Guests', 'Revenue (AED)', 'Food Cost (AED)', 'Hall Cost (AED)', 'Staff Cost (AED)', 'Gross Profit (AED)', 'Margin %'];
    const rows = eventSummaries.map(s => [
      s.booking.bookingNumber,
      `"Crystal Plaza Hotel"`,
      `"${s.booking.clientName}"`,
      `"${s.booking.hallName}"`,
      s.booking.eventDate,
      s.booking.guestCount,
      s.financials.subtotalRevenue.toFixed(2),
      s.financials.foodCost.toFixed(2),
      s.financials.hallCost.toFixed(2),
      s.financials.staffingCost.toFixed(2),
      s.financials.netGrossProfit.toFixed(2),
      s.financials.overallProfitMarginPercent.toFixed(1),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `crystal_plaza_hotel_report_${reportPeriod}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-7 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#236B50] text-xs font-extrabold uppercase tracking-wider mb-1">
            <Building2 className="w-3.5 h-3.5" />
            <span>Crystal Plaza Hotel • Financial Intelligence</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#192A24] font-['Plus_Jakarta_Sans'] flex items-center space-x-2.5">
            <TrendingUp className="w-6 h-6 text-[#236B50]" />
            <span>Banquet & Food Profitability Intelligence</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5A6F66] mt-0.5">
            Store every year banquet hall data, sales, reports, Meta Ads ROAS for all 12 months, and generate monthly or annual audit reports.
          </p>
        </div>

        {/* Main Intelligence View Switcher */}
        <div className="bg-[#EBF3EF] p-1.5 rounded-2xl border border-[#D5E5DE] flex flex-wrap gap-1 text-xs font-semibold self-start sm:self-auto shadow-xs">
          <button
            onClick={() => setMainReportView('annual_ledger')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
              mainReportView === 'annual_ledger'
                ? 'bg-[#236B50] text-white font-extrabold shadow-sm'
                : 'text-[#3D5A4E] hover:text-[#192A24]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>12-Month & Yearly Ledger</span>
          </button>
          <button
            onClick={() => setMainReportView('trends_invoices')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
              mainReportView === 'trends_invoices'
                ? 'bg-[#236B50] text-white font-extrabold shadow-sm'
                : 'text-[#3D5A4E] hover:text-[#192A24]'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Daily Trends & Invoices</span>
          </button>
          <button
            onClick={() => setMainReportView('event_ledger')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
              mainReportView === 'event_ledger'
                ? 'bg-[#236B50] text-white font-extrabold shadow-sm'
                : 'text-[#3D5A4E] hover:text-[#192A24]'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Event Costing Ledger</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          MANAGER MONTHLY REVENUE GOAL SETTING CARD
          User request: "Add a feature to the Reports module where the manager can set a 'Monthly Revenue Goal' for the banquet hall"
          ===================================================================== */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#1C5740] to-emerald-900 text-white p-5 sm:p-6 rounded-3xl shadow-sm border border-emerald-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center font-black shadow-md shrink-0">
            <Target className="w-6 h-6 text-amber-950" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                Management Target
              </span>
              <span className="text-xs text-emerald-200">Banquet Operations Benchmark</span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-white mt-0.5">
              Monthly Banquet Revenue Goal: AED {revenueGoal.toLocaleString()}
            </h3>
            <p className="text-xs text-emerald-200/80">
              Set monthly sales benchmark for banquet halls. The live progress bar is reflected immediately on the Executive Dashboard.
            </p>
            {goalSavedMsg && (
              <div className="mt-1.5 text-xs text-amber-300 font-bold flex items-center space-x-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{goalSavedMsg}</span>
              </div>
            )}
          </div>
        </div>

        {currentUser.role !== 'general_manager' ? (
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {/* Quick Preset Buttons */}
            <div className="flex items-center space-x-1 bg-white/10 p-1 rounded-xl border border-white/15">
              {[50000, 75000, 80000, 100000, 120000].map(amt => (
                <button
                  key={amt}
                  onClick={() => handleUpdateGoal(amt)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    revenueGoal === amt
                      ? 'bg-amber-400 text-amber-950 shadow-xs'
                      : 'text-white hover:bg-white/15'
                  }`}
                >
                  {(amt / 1000)}k
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-1.5">
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs font-bold text-neutral-400">AED</span>
                <input
                  type="number"
                  min="10000"
                  step="5000"
                  value={customGoalInput}
                  onChange={(e) => setCustomGoalInput(e.target.value)}
                  placeholder="Custom Goal"
                  className="w-28 pl-10 pr-2 py-1.5 bg-white text-neutral-900 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <button
                onClick={() => {
                  const parsed = parseFloat(customGoalInput);
                  if (parsed > 0) {
                    handleUpdateGoal(parsed);
                    setCustomGoalInput('');
                  }
                }}
                className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 active:scale-98 text-amber-950 font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Set Goal
              </button>
            </div>
          </div>
        ) : (
          <span className="px-3.5 py-1.5 rounded-xl bg-white/10 border border-white/20 text-xs font-extrabold text-amber-200 self-start md:self-auto">
            Read-Only Executive Target View
          </span>
        )}
      </div>

      {/* =====================================================================
          VIEW 1: ANNUAL 12-MONTH LEDGER & MONTHLY/YEARLY REPORT GENERATOR
          ===================================================================== */}
      {mainReportView === 'annual_ledger' && (
        <BanquetHistoricalLedgerReport
          bookings={bookings}
          marketingReports={activeReports}
          currentUser={currentUser}
          onSaveReport={handleSaveReport}
          onSaveReportsBatch={handleSaveReportsBatch}
          onRestoreReports={handleRestoreReports}
        />
      )}

      {/* =====================================================================
          VIEW 2: DAILY REVENUE & INVOICE MARGIN TRENDS
          ===================================================================== */}
      {mainReportView === 'trends_invoices' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E2ECE7]">
            <div className="text-xs text-[#5A6F66]">
              Filter period for daily/weekly/monthly finalized invoices:
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {reportPeriod === 'yearly' && (
                <div className="bg-[#EBF3EF] p-1 rounded-2xl border border-[#D5E5DE] flex text-xs font-semibold">
                  <button
                    onClick={() => setSelectedYear('2026')}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      selectedYear === '2026' ? 'bg-[#236B50] text-white font-bold shadow-xs' : 'text-[#3D5A4E]'
                    }`}
                  >
                    2026
                  </button>
                  <button
                    onClick={() => setSelectedYear('2025')}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      selectedYear === '2025' ? 'bg-[#236B50] text-white font-bold shadow-xs' : 'text-[#3D5A4E]'
                    }`}
                  >
                    2025
                  </button>
                </div>
              )}

              <div className="bg-[#EBF3EF] p-1 rounded-2xl border border-[#D5E5DE] flex text-xs font-semibold">
                <button
                  onClick={() => setReportPeriod('daily')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                    reportPeriod === 'daily'
                      ? 'bg-[#236B50] text-white font-bold shadow-xs'
                      : 'text-[#3D5A4E] hover:text-[#192A24]'
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setReportPeriod('weekly')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                    reportPeriod === 'weekly'
                      ? 'bg-[#236B50] text-white font-bold shadow-xs'
                      : 'text-[#3D5A4E] hover:text-[#192A24]'
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setReportPeriod('monthly')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                    reportPeriod === 'monthly'
                      ? 'bg-[#236B50] text-white font-bold shadow-xs'
                      : 'text-[#3D5A4E] hover:text-[#192A24]'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setReportPeriod('yearly')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                    reportPeriod === 'yearly'
                      ? 'bg-[#236B50] text-white font-bold shadow-xs'
                      : 'text-[#3D5A4E] hover:text-[#192A24]'
                  }`}
                >
                  Yearly
                </button>
              </div>

              <button
                onClick={handleExportCSV}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#236B50] text-xs font-bold transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Remaining charts when mainReportView === 'trends_invoices' */}
      {mainReportView === 'trends_invoices' && (
        <>
        <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-sm space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2ECE7] gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-[#236B50] text-xs font-extrabold uppercase tracking-wider">
              <TrendingUp className="w-4 h-4" />
              <span>Crystal Plaza Hotel • Financial Performance</span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-[#192A24]">
              Monthly Net Profit Margin Trends (Finalized Invoices)
            </h2>
            <p className="text-xs text-[#5A6F66]">
              Historical trajectory of net profit margins across months based strictly on finalized and paid banquet invoices.
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#E8F5EE] text-[#236B50] border border-[#C5E5D5]">
              {finalizedInvoices.length} Finalized Invoices
            </span>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#FAF5E8] text-[#D97706] border border-[#F3E2B8]">
              Target: 45.0% Margin
            </span>
          </div>
        </div>

        {/* Quick KPI Cards for Financial Performance */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-[#E2ECE7]">
            <div className="text-[11px] text-[#5A6F66] font-medium">Average Net Margin</div>
            <div className="text-base sm:text-lg font-extrabold text-[#236B50] mt-0.5">
              {formatPercent(overallFinalizedMarginPercent)}
            </div>
            <div className="text-[10px] text-[#236B50] font-semibold mt-0.5">
              Across all finalized invoices
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-[#E2ECE7]">
            <div className="text-[11px] text-[#5A6F66] font-medium">Best Performing Month</div>
            <div className="text-base sm:text-lg font-extrabold text-[#192A24] mt-0.5">
              {bestMarginMonth?.monthLabel || 'N/A'}
            </div>
            <div className="text-[10px] text-[#236B50] font-bold mt-0.5">
              {bestMarginMonth?.marginPercent || 0}% Peak Margin
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-[#E2ECE7]">
            <div className="text-[11px] text-[#5A6F66] font-medium">Finalized Revenue</div>
            <div className="text-base sm:text-lg font-extrabold text-[#192A24] mt-0.5 font-mono">
              {formatCurrency(overallFinalizedRevenue)}
            </div>
            <div className="text-[10px] text-[#5A6F66] mt-0.5">
              {finalizedInvoices.length} Invoiced Parties
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-[#E2ECE7]">
            <div className="text-[11px] text-[#5A6F66] font-medium">Realized Net Profit</div>
            <div className="text-base sm:text-lg font-extrabold text-[#236B50] mt-0.5 font-mono">
              +{formatCurrency(overallFinalizedProfit)}
            </div>
            <div className="text-[10px] text-[#236B50] font-bold mt-0.5">
              AED Net Profit Generated
            </div>
          </div>
        </div>

        {/* Recharts Line Chart */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={monthlyFinancialData}
              margin={{ top: 15, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2ECE7" vertical={false} />
              <XAxis 
                dataKey="monthLabel" 
                tick={{ fontSize: 11, fill: '#5A6F66' }}
                stroke="#D5E5DE"
              />
              <YAxis 
                yAxisId="margin"
                domain={[0, 60]}
                unit="%"
                tick={{ fontSize: 11, fill: '#5A6F66' }}
                stroke="#D5E5DE"
              />
              <YAxis 
                yAxisId="rev"
                orientation="right"
                tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                unit=" AED"
                tick={{ fontSize: 11, fill: '#5A6F66' }}
                stroke="#D5E5DE"
              />
              <Tooltip content={<CustomFinancialPerformanceTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
              />
              <ReferenceLine 
                yAxisId="margin" 
                y={45} 
                stroke="#D97706" 
                strokeDasharray="4 4" 
                label={{ value: 'Target 45% Margin', fill: '#D97706', fontSize: 10, position: 'insideTopLeft' }} 
              />
              <Line 
                yAxisId="margin"
                type="monotone" 
                dataKey="marginPercent" 
                name="Net Profit Margin (%)" 
                stroke="#236B50" 
                strokeWidth={3}
                dot={{ r: 5, fill: '#236B50', strokeWidth: 2, stroke: '#FFFFFF' }}
                activeDot={{ r: 8, fill: '#1E5D46' }}
              />
              <Line 
                yAxisId="rev"
                type="monotone" 
                dataKey="revenue" 
                name="Invoiced Revenue (AED)" 
                stroke="#10B981" 
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: '#10B981' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Breakdown Cards */}
        <div className="pt-2 border-t border-[#E2ECE7]">
          <div className="text-xs font-bold text-[#192A24] mb-3 flex items-center space-x-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#236B50]" />
            <span>Monthly Finalized Invoices Summary Breakdown</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {monthlyFinancialData.map(m => {
              const meetsTarget = m.marginPercent >= 45.0;
              return (
                <div key={m.monthKey} className="p-3.5 rounded-2xl bg-[#FAFDFB] border border-[#E2ECE7] hover:border-[#CADBD2] transition-colors space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#192A24] text-xs">{m.monthLabel}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      meetsTarget ? 'bg-[#E8F5EE] text-[#236B50]' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {m.marginPercent}% Margin
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px] text-[#5A6F66]">
                    <div className="flex justify-between">
                      <span>Invoiced Revenue:</span>
                      <strong className="text-[#192A24] font-mono">{formatCurrency(m.revenue)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Direct COGS:</span>
                      <span className="font-mono">{formatCurrency(m.costs)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-[#E2ECE7]">
                      <span className="font-bold text-[#236B50]">Net Profit:</span>
                      <strong className="text-[#236B50] font-mono">+{formatCurrency(m.netProfit)}</strong>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#5A6F66] flex justify-between pt-0.5">
                    <span>{m.invoiceCount} Invoices ({m.paidCount} Paid)</span>
                    <span>{m.guestCount} Guests</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =====================================================================
          RECHARTS LINE CHART: DAILY BANQUET REVENUE TRENDS (Current Month: Oct 2026)
          ===================================================================== */}
      <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-sm space-y-6">
        
        {/* Chart Header with Venue / Hall Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2ECE7] gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#236B50]"></span>
              <h2 className="text-base sm:text-lg font-extrabold text-[#192A24]">
                Daily Banquet Revenue Trends — {currentMonthLabel}
              </h2>
            </div>
            <p className="text-xs text-[#5A6F66]">
              Real-time daily revenue and gross profit trajectory across the current month for Crystal Plaza Hotel.
            </p>
          </div>

          {/* Venue / Hall Selector (Allows toggling between all halls or specific halls at Crystal Plaza Hotel) */}
          <div className="flex items-center space-x-2 bg-[#F6FAF8] p-1.5 rounded-2xl border border-[#D5E5DE] self-start sm:self-auto">
            <span className="text-xs font-bold text-[#236B50] pl-2 flex items-center space-x-1">
              <Building className="w-3.5 h-3.5" />
              <span>Venue:</span>
            </span>
            <select
              value={selectedHallFilter}
              onChange={(e) => setSelectedHallFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#192A24] focus:outline-none cursor-pointer py-1 px-2.5 rounded-xl"
            >
              <option value="all">Crystal Plaza Hotel (All Banquet Halls)</option>
              <option value="hall_cph_main">Grand Ballroom (Crystal Plaza)</option>
              <option value="hall_cph_sapphire">Sapphire Pavilion (Crystal Plaza)</option>
              <option value="hall_cph_royal">Royal Sovereign Hall (Crystal Plaza)</option>
              <option value="hall_cph_terrace">Emerald Sky Terrace (Crystal Plaza)</option>
            </select>
          </div>
        </div>

        {/* Quick Analytic Metric Pills for Chart */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-[#E2ECE7]">
            <div className="text-[11px] text-[#5A6F66] font-medium">Month-to-Date Revenue</div>
            <div className="text-base sm:text-lg font-extrabold text-[#192A24] mt-0.5 font-mono">
              {formatCurrency(totalChartRevenue)}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#E8F5EE] border border-[#C5E5D5]">
            <div className="text-[11px] text-[#1D6047] font-medium">Month-to-Date Profit</div>
            <div className="text-base sm:text-lg font-extrabold text-[#236B50] mt-0.5 font-mono">
              +{formatCurrency(totalChartProfit)}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-[#E2ECE7]">
            <div className="text-[11px] text-[#5A6F66] font-medium">Peak Revenue Day</div>
            <div className="text-base sm:text-lg font-extrabold text-[#192A24] mt-0.5 font-mono">
              {peakDay?.revenue > 0 ? `${formatCurrency(peakDay.revenue)} (${peakDay.day})` : '0 AED'}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-[#E2ECE7]">
            <div className="text-[11px] text-[#5A6F66] font-medium">Average Active Day Revenue</div>
            <div className="text-base sm:text-lg font-extrabold text-[#192A24] mt-0.5 font-mono">
              {formatCurrency(averageDayRevenue)}
            </div>
          </div>
        </div>

        {/* The Recharts Line Chart Container */}
        <div className="w-full h-80 sm:h-96 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={dailyChartData}
              margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5EFEA" vertical={false} />
              <XAxis 
                dataKey="day" 
                tick={{ fill: '#5A6F66', fontSize: 11, fontWeight: 500 }}
                axisLine={{ stroke: '#D5E5DE' }}
                tickLine={false}
                interval={2}
              />
              <YAxis 
                tick={{ fill: '#5A6F66', fontSize: 11 }}
                axisLine={{ stroke: '#D5E5DE' }}
                tickLine={false}
                tickFormatter={(value) => `${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
              />
              <Tooltip content={<CustomChartTooltip />} />
              <Legend 
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '16px', fontSize: '12px', fontWeight: 600 }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Daily Banquet Revenue (AED)"
                stroke="#236B50"
                strokeWidth={3}
                dot={{ r: 3.5, fill: '#236B50', strokeWidth: 1.5, stroke: '#FFFFFF' }}
                activeDot={{ r: 6.5, fill: '#236B50', stroke: '#FFFFFF', strokeWidth: 2.5 }}
              />
              <Line
                type="monotone"
                dataKey="profit"
                name="Daily Gross Profit (AED)"
                stroke="#10B981"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 2.5, fill: '#10B981', strokeWidth: 1, stroke: '#FFFFFF' }}
                activeDot={{ r: 5.5, fill: '#10B981', stroke: '#FFFFFF', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      </>
      )}

      {/* =====================================================================
          VIEW 3: EVENT COSTING LEDGER & SUMMARY METRICS
          ===================================================================== */}
      {mainReportView === 'event_ledger' && (
        <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="text-xs font-bold text-[#5A6F66] uppercase tracking-wider">Period Gross Revenue</div>
          <div className="text-2xl font-extrabold text-[#192A24] mt-1.5">{formatCurrency(totalPeriodRevenue)}</div>
          <div className="text-xs text-[#5A6F66] mt-1">{periodBookings.length} Banquet Events ({reportPeriod})</div>
        </div>

        <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="text-xs font-bold text-[#5A6F66] uppercase tracking-wider">Total Direct COGS</div>
          <div className="text-2xl font-extrabold text-[#192A24] mt-1.5">{formatCurrency(totalPeriodCosts)}</div>
          <div className="text-xs text-[#5A6F66] mt-1">Food: {formatCurrency(totalPeriodFoodCost)}</div>
        </div>

        <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="text-xs font-bold text-[#236B50] uppercase tracking-wider">Net Gross Profit</div>
          <div className="text-2xl font-extrabold text-[#236B50] mt-1.5">+{formatCurrency(totalPeriodProfit)}</div>
          <div className="text-xs text-[#236B50] font-bold mt-1">AED Profit Generated</div>
        </div>

        <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="text-xs font-bold text-[#5A6F66] uppercase tracking-wider">Average Profit Margin</div>
          <div className="text-2xl font-extrabold text-[#236B50] mt-1.5">{formatPercent(averageMarginPercent)}</div>
          <div className="text-xs text-[#5A6F66] mt-1">Food Cost: {formatPercent(foodCostRatioPercent)}</div>
        </div>
      </div>

      {/* =====================================================================
          INDIVIDUAL BANQUET EVENT FINANCIAL LEDGER TABLE
          ===================================================================== */}
      <div className="bg-white border border-[#E2ECE7] rounded-3xl overflow-hidden shadow-sm">
        <div className="p-5 sm:p-6 border-b border-[#E2ECE7] flex justify-between items-center">
          <div>
            <h3 className="font-extrabold text-[#192A24] text-base">Individual Banquet Event Financial Ledger</h3>
            <p className="text-xs text-[#5A6F66]">
              Detailed breakdown of revenue, kitchen food cost, and profit margin for each party at Crystal Plaza Hotel.
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#E8F5EE] text-[#236B50] border border-[#C5E5D5]">
            {periodBookings.length} Events in {reportPeriod}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAF9] text-[#5A6F66] border-b border-[#E2ECE7] font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">BEO Number & Client</th>
                <th className="py-3 px-4">Venue & Hall</th>
                <th className="py-3 px-4">Event Date</th>
                <th className="py-3 px-4 text-center">Guests</th>
                <th className="py-3 px-4 text-right">Charged Subtotal</th>
                <th className="py-3 px-4 text-right">Food Cost</th>
                <th className="py-3 px-4 text-right">Gross Profit</th>
                <th className="py-3 px-4 text-right">Profit Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2ECE7]">
              {eventSummaries.map(({ booking, financials }) => (
                <tr key={booking.id} className="hover:bg-[#F6FAF8] transition-colors">
                  <td className="py-3 px-4 font-bold text-[#192A24]">
                    <div>{booking.clientName}</div>
                    <span className="text-[11px] text-[#5A6F66] font-mono font-normal">{booking.bookingNumber}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#192A24]">{booking.hallName}</div>
                    <div className="text-[11px] text-[#236B50] font-bold">Crystal Plaza Hotel</div>
                  </td>
                  <td className="py-3 px-4 text-[#5A6F66] font-medium">{booking.eventDate}</td>
                  <td className="py-3 px-4 text-center font-bold text-[#192A24]">{booking.guestCount}</td>
                  <td className="py-3 px-4 text-right font-extrabold text-[#192A24] font-mono">
                    {formatCurrency(financials.subtotalRevenue)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#5A6F66]">
                    {formatCurrency(financials.foodCost)}
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-[#236B50] font-mono">
                    +{formatCurrency(financials.netGrossProfit)}
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-[#236B50]">
                    <span className="px-2 py-0.5 rounded-full bg-[#E8F5EE] border border-[#C5E5D5]">
                      {formatPercent(financials.overallProfitMarginPercent)}
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
