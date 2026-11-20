import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Target, 
  BarChart3, 
  Printer, 
  Download, 
  Plus, 
  Edit3, 
  CheckCircle2, 
  FileSpreadsheet, 
  Sparkles, 
  ChevronRight, 
  ChevronDown, 
  Users, 
  Building2, 
  UtensilsCrossed, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  Filter, 
  X, 
  Layers, 
  Check, 
  PieChart as PieChartIcon,
  ScanText,
  RotateCcw
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ComposedChart,
  Area
} from 'recharts';
import { BookingEvent, MetaAdMonthlyReport, UserProfile } from '../types';
import { calculateEventFinancials, formatCurrency, formatPercent } from '../utils/costCalculations';
import { 
  MonthlyDetailedAggregate, 
  MonthlyReportDocModal, 
  YearlyReportDocModal 
} from './YearlyMonthlyReportModal';
import { MetaAdsOcrImportModal, OcrExtractedRow } from './MetaAdsOcrImportModal';
import { YearOverYearComparisonChart } from './YearOverYearComparisonChart';

interface BanquetHistoricalLedgerReportProps {
  bookings: BookingEvent[];
  marketingReports: MetaAdMonthlyReport[];
  currentUser: UserProfile;
  onSaveReport: (report: MetaAdMonthlyReport) => void;
  onSaveReportsBatch?: (reports: MetaAdMonthlyReport[], metaSummary: string) => void;
  onRestoreReports?: (snapshot: MetaAdMonthlyReport[]) => void;
}

export const BanquetHistoricalLedgerReport: React.FC<BanquetHistoricalLedgerReportProps> = ({
  bookings,
  marketingReports,
  currentUser,
  onSaveReport,
  onSaveReportsBatch,
  onRestoreReports,
}) => {
  const isReadOnlyGM = currentUser.role === 'general_manager';

  // Available Years
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [customYears, setCustomYears] = useState<number[]>([2025, 2026]);
  const [activeView, setActiveView] = useState<'grid' | 'table' | 'quarters' | 'charts' | 'yoy'>('grid');

  // Modals
  const [selectedMonthForDoc, setSelectedMonthForDoc] = useState<MonthlyDetailedAggregate | null>(null);
  const [yearlyDocOpen, setYearlyDocOpen] = useState<boolean>(false);
  const [editModalMonth, setEditModalMonth] = useState<MonthlyDetailedAggregate | null>(null);
  const [newYearInputOpen, setNewYearInputOpen] = useState<boolean>(false);
  const [newYearInputValue, setNewYearInputValue] = useState<string>('2028');
  const [ocrModalOpen, setOcrModalOpen] = useState<boolean>(false);
  const [ocrInitialMonthKey, setOcrInitialMonthKey] = useState<string>('');
  const [ocrStatusMsg, setOcrStatusMsg] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<MetaAdMonthlyReport[] | null>(null);

  // Form State for editing month
  const [formSpend, setFormSpend] = useState<string>('');
  const [formFbSpend, setFormFbSpend] = useState<string>('');
  const [formIgSpend, setFormIgSpend] = useState<string>('');
  const [formWaSpend, setFormWaSpend] = useState<string>('');
  const [formLeads, setFormLeads] = useState<string>('');
  const [formImpressions, setFormImpressions] = useState<string>('');
  const [formClicks, setFormClicks] = useState<string>('');
  const [formHistRevenue, setFormHistRevenue] = useState<string>('');
  const [formHistParties, setFormHistParties] = useState<string>('');
  const [formHistGuests, setFormHistGuests] = useState<string>('');
  const [formCampaign, setFormCampaign] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // Months definition
  const MONTH_NAMES = [
    { num: 1, name: 'January', short: 'Jan' },
    { num: 2, name: 'February', short: 'Feb' },
    { num: 3, name: 'March', short: 'Mar' },
    { num: 4, name: 'April', short: 'Apr' },
    { num: 5, name: 'May', short: 'May' },
    { num: 6, name: 'June', short: 'Jun' },
    { num: 7, name: 'July', short: 'Jul' },
    { num: 8, name: 'August', short: 'Aug' },
    { num: 9, name: 'September', short: 'Sep' },
    { num: 10, name: 'October', short: 'Oct' },
    { num: 11, name: 'November', short: 'Nov' },
    { num: 12, name: 'December', short: 'Dec' },
  ];

  // --------------------------------------------------------------------------
  // Compute Complete 12-Month Aggregates for the Selected Year
  // --------------------------------------------------------------------------
  const monthsData: MonthlyDetailedAggregate[] = useMemo(() => {
    return MONTH_NAMES.map((m) => {
      const monthKey = `${selectedYear}-${m.num.toString().padStart(2, '0')}`;
      const monthLabel = `${m.name} ${selectedYear}`;
      
      // Match marketing report if exists
      const report = marketingReports.find(r => r.monthKey === monthKey);

      // Match actual bookings held in this month
      const monthBookings = bookings.filter(b => b.eventDate.startsWith(monthKey));
      const hasLiveBookings = monthBookings.length > 0;

      // Calculate financials from live bookings if present
      const finList = monthBookings.map(b => calculateEventFinancials(b));
      const liveRevenue = finList.reduce((s, f) => s + f.subtotalRevenue, 0);
      const liveFoodCost = finList.reduce((s, f) => s + f.foodCost, 0);
      const liveDirectCosts = finList.reduce((s, f) => s + f.totalDirectCosts, 0);
      const liveGuests = monthBookings.reduce((s, b) => s + (b.guestCount || 0), 0);

      // Determine Revenue & Costs (Use live bookings if available, else historical report values)
      let grossRevenueAED = liveRevenue;
      let foodCostAED = liveFoodCost;
      let totalDirectCostsAED = liveDirectCosts;
      let partiesCount = monthBookings.length;
      let totalGuests = liveGuests;

      if (!hasLiveBookings) {
        if (report?.historicalBanquetRevenue !== undefined) {
          grossRevenueAED = report.historicalBanquetRevenue;
          totalDirectCostsAED = report.historicalDirectCosts !== undefined ? report.historicalDirectCosts : (grossRevenueAED * 0.32);
          foodCostAED = totalDirectCostsAED * 0.85;
          partiesCount = report.historicalPartiesCount !== undefined
            ? report.historicalPartiesCount
            : (grossRevenueAED > 0 ? Math.max(1, Math.round(grossRevenueAED / 10000)) : 0);
          totalGuests = report.historicalGuestsCount !== undefined ? report.historicalGuestsCount : (partiesCount * 70);
        } else if (report?.roasMultiplier && report?.adSpendAED) {
          grossRevenueAED = report.adSpendAED * report.roasMultiplier;
          totalDirectCostsAED = grossRevenueAED * 0.32;
          foodCostAED = totalDirectCostsAED * 0.85;
          partiesCount = Math.max(1, Math.round(grossRevenueAED / 10000));
          totalGuests = partiesCount * 70;
        }
      }

      const grossProfitAED = grossRevenueAED - totalDirectCostsAED;
      const grossMarginPercent = grossRevenueAED > 0 ? (grossProfitAED / grossRevenueAED) * 100 : 0;

      // Marketing figures
      const adSpendAED = report?.adSpendAED || 0;
      const impressions = report?.impressions || 0;
      const clicks = report?.clicks || 0;
      const leadsGenerated = report?.leadsGenerated || 0;
      const ctrPercent = report?.ctrPercent || (impressions > 0 ? (clicks / impressions) * 100 : 0);
      const cprAED = report?.cprAED && report.cprAED > 0 ? report.cprAED : (leadsGenerated > 0 ? (adSpendAED / leadsGenerated) : 0);
      const cacAED = partiesCount > 0 ? (adSpendAED / partiesCount) : adSpendAED;
      const roas = adSpendAED > 0 ? parseFloat((grossRevenueAED / adSpendAED).toFixed(2)) : 0;
      const netProfitAfterMarketingAED = grossProfitAED - adSpendAED;
      const netMarginPercent = grossRevenueAED > 0 ? (netProfitAfterMarketingAED / grossRevenueAED) * 100 : 0;

      const completedCount = monthBookings.filter(b => b.partyEnded || b.status === 'completed').length;
      const upcomingCount = monthBookings.filter(b => !b.partyEnded && b.status !== 'cancelled').length;

      return {
        monthKey,
        monthNumber: m.num,
        monthLabel,
        monthShort: m.short,
        year: selectedYear,
        partiesCount,
        completedPartiesCount: completedCount,
        upcomingPartiesCount: upcomingCount,
        totalGuests,
        grossRevenueAED,
        foodCostAED,
        hallCostAED: Math.max(0, totalDirectCostsAED - foodCostAED),
        totalDirectCostsAED,
        grossProfitAED,
        grossMarginPercent,
        adSpendAED,
        impressions,
        clicks,
        ctrPercent,
        leadsGenerated,
        cprAED,
        cacAED,
        roas,
        netProfitAfterMarketingAED,
        netMarginPercent,
        topPerformingCampaign: report?.topPerformingCampaign,
        notes: report?.notes,
        monthBookings,
        reportRecord: report,
      };
    });
  }, [selectedYear, bookings, marketingReports]);

  // --------------------------------------------------------------------------
  // Full Year Summary Totals
  // --------------------------------------------------------------------------
  const yearTotals = useMemo(() => {
    const totalParties = monthsData.reduce((s, m) => s + m.partiesCount, 0);
    const totalGuests = monthsData.reduce((s, m) => s + m.totalGuests, 0);
    const totalSales = monthsData.reduce((s, m) => s + m.grossRevenueAED, 0);
    const totalCosts = monthsData.reduce((s, m) => s + m.totalDirectCostsAED, 0);
    const totalGrossProfit = totalSales - totalCosts;
    const overallGrossMargin = totalSales > 0 ? (totalGrossProfit / totalSales) * 100 : 0;
    
    const totalSpend = monthsData.reduce((s, m) => s + m.adSpendAED, 0);
    const totalLeads = monthsData.reduce((s, m) => s + m.leadsGenerated, 0);
    const overallRoas = totalSpend > 0 ? totalSales / totalSpend : 0;
    const overallCpr = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const overallCac = totalParties > 0 ? totalSpend / totalParties : totalSpend;
    const totalNetProfit = totalGrossProfit - totalSpend;
    const overallNetMargin = totalSales > 0 ? (totalNetProfit / totalSales) * 100 : 0;

    const activeMonths = monthsData.filter(m => m.grossRevenueAED > 0 || m.adSpendAED > 0);
    const count = activeMonths.length > 0 ? activeMonths.length : 12;

    return {
      totalParties,
      totalGuests,
      totalSales,
      totalCosts,
      totalGrossProfit,
      overallGrossMargin,
      totalSpend,
      totalLeads,
      overallRoas,
      overallCpr,
      overallCac,
      totalNetProfit,
      overallNetMargin,
      avgMonthlySales: totalSales / count,
      avgMonthlySpend: totalSpend / count,
      avgMonthlyParties: totalParties / count,
    };
  }, [monthsData]);

  // Open Edit Month Modal
  const handleOpenEditMonth = (month: MonthlyDetailedAggregate) => {
    setEditModalMonth(month);
    const rep = month.reportRecord;
    setFormSpend(rep?.adSpendAED ? rep.adSpendAED.toString() : month.adSpendAED > 0 ? month.adSpendAED.toString() : '');
    setFormFbSpend(rep?.platformBreakdown?.facebookSpendAED ? rep.platformBreakdown.facebookSpendAED.toString() : '');
    setFormIgSpend(rep?.platformBreakdown?.instagramSpendAED ? rep.platformBreakdown.instagramSpendAED.toString() : '');
    setFormWaSpend(rep?.platformBreakdown?.whatsappSpendAED ? rep.platformBreakdown.whatsappSpendAED.toString() : '');
    setFormLeads(rep?.leadsGenerated ? rep.leadsGenerated.toString() : month.leadsGenerated > 0 ? month.leadsGenerated.toString() : '');
    setFormImpressions(rep?.impressions ? rep.impressions.toString() : month.impressions > 0 ? month.impressions.toString() : '');
    setFormClicks(rep?.clicks ? rep.clicks.toString() : month.clicks > 0 ? month.clicks.toString() : '');
    setFormHistRevenue(rep?.historicalBanquetRevenue ? rep.historicalBanquetRevenue.toString() : month.grossRevenueAED > 0 ? month.grossRevenueAED.toString() : '');
    setFormHistParties(rep?.historicalPartiesCount ? rep.historicalPartiesCount.toString() : month.partiesCount > 0 ? month.partiesCount.toString() : '');
    setFormHistGuests(rep?.historicalGuestsCount ? rep.historicalGuestsCount.toString() : month.totalGuests > 0 ? month.totalGuests.toString() : '');
    setFormCampaign(rep?.topPerformingCampaign || month.topPerformingCampaign || '');
    setFormNotes(rep?.notes || month.notes || '');
  };

  // Save Month Data
  const handleSaveMonthData = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalMonth) return;

    const spend = parseFloat(formSpend) || 0;
    const fb = parseFloat(formFbSpend) || 0;
    const ig = parseFloat(formIgSpend) || 0;
    const wa = parseFloat(formWaSpend) || 0;
    const leads = parseInt(formLeads, 10) || 0;
    const impressions = parseInt(formImpressions, 10) || 0;
    const clicks = parseInt(formClicks, 10) || 0;
    const histRev = parseFloat(formHistRevenue) || 0;
    const histParties = parseInt(formHistParties, 10) || 0;
    const histGuests = parseInt(formHistGuests, 10) || 0;

    const updatedReport: MetaAdMonthlyReport = {
      id: editModalMonth.reportRecord?.id || `meta_rep_${editModalMonth.monthKey.replace('-', '_')}`,
      monthKey: editModalMonth.monthKey,
      monthLabel: editModalMonth.monthLabel,
      adSpendAED: spend,
      impressions,
      clicks,
      leadsGenerated: leads,
      cprAED: leads > 0 ? parseFloat((spend / leads).toFixed(2)) : 0,
      ctrPercent: impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0,
      topPerformingCampaign: formCampaign.trim() || undefined,
      notes: formNotes.trim() || undefined,
      platformBreakdown: (fb > 0 || ig > 0 || wa > 0) ? {
        facebookSpendAED: fb,
        instagramSpendAED: ig,
        whatsappSpendAED: wa,
      } : undefined,
      historicalBanquetRevenue: histRev > 0 ? histRev : undefined,
      historicalDirectCosts: histRev > 0 ? parseFloat((histRev * 0.32).toFixed(2)) : undefined,
      historicalPartiesCount: histParties > 0 ? histParties : undefined,
      historicalGuestsCount: histGuests > 0 ? histGuests : undefined,
      insertedAt: new Date().toISOString(),
      insertedBy: currentUser.name,
    };

    onSaveReport(updatedReport);
    setEditModalMonth(null);
  };

  const handleCommitOcrReports = (reportsToSave: MetaAdMonthlyReport[], metaSummary: string) => {
    setUndoSnapshot([...marketingReports]);
    if (onSaveReportsBatch) {
      onSaveReportsBatch(reportsToSave, metaSummary);
    } else {
      reportsToSave.forEach(r => onSaveReport(r));
    }
    setEditModalMonth(null);

    // Ensure any newly imported years appear in year selector tabs
    const importedYears = Array.from(
      new Set(
        reportsToSave
          .map(r => parseInt(r.monthKey.substring(0, 4), 10))
          .filter(y => !isNaN(y) && y >= 2020 && y <= 2035)
      )
    );
    if (importedYears.length > 0) {
      setCustomYears(prev => Array.from(new Set([...prev, ...importedYears])).sort((a, b) => a - b));
      setSelectedYear(importedYears[importedYears.length - 1]);
    }

    setOcrStatusMsg(`Safely imported ${reportsToSave.length} verified Meta Ads month(s) via OCR.`);
    setTimeout(() => setOcrStatusMsg(null), 8000);
  };

  const handleApplyOcrToEditModal = (row: OcrExtractedRow) => {
    setFormSpend(row.adSpendAED > 0 ? row.adSpendAED.toString() : '0');
    if (row.facebookSpendAED > 0) setFormFbSpend(row.facebookSpendAED.toString());
    if (row.instagramSpendAED > 0) setFormIgSpend(row.instagramSpendAED.toString());
    if (row.whatsappSpendAED > 0) setFormWaSpend(row.whatsappSpendAED.toString());
    setFormLeads(row.leadsGenerated > 0 ? row.leadsGenerated.toString() : '0');
    if (row.impressions > 0) setFormImpressions(row.impressions.toString());
    if (row.clicks > 0) setFormClicks(row.clicks.toString());
    if (row.banquetSalesAED > 0) setFormHistRevenue(row.banquetSalesAED.toString());
    if (row.topPerformingCampaign) setFormCampaign(row.topPerformingCampaign);
    setFormNotes(`OCR scanned & verified (${new Date().toLocaleDateString()})`);
  };

  const handleUndoOcr = () => {
    if (!undoSnapshot || !onRestoreReports) return;
    onRestoreReports(undoSnapshot);
    setUndoSnapshot(null);
    setOcrStatusMsg('Reverted last OCR import cleanly.');
    setTimeout(() => setOcrStatusMsg(null), 5000);
  };

  // Add custom year
  const handleAddYear = () => {
    const yr = parseInt(newYearInputValue, 10);
    if (yr && !customYears.includes(yr)) {
      const nextList = [...customYears, yr].sort((a, b) => b - a);
      setCustomYears(nextList);
      setSelectedYear(yr);
      setNewYearInputOpen(false);
    }
  };

  // Export full year CSV
  const handleExportYearCSV = () => {
    const headers = [
      'Month',
      'Events Count',
      'Guests Count',
      'Banquet Sales AED',
      'Direct Costs AED',
      'Gross Profit AED',
      'Gross Margin %',
      'Meta Ad Spend AED',
      'Leads Generated',
      'CPR AED',
      'CAC AED',
      'ROAS',
      'Net Profit After Ads AED',
    ];

    const rows = monthsData.map(m => [
      m.monthLabel,
      m.partiesCount,
      m.totalGuests,
      m.grossRevenueAED.toFixed(2),
      m.totalDirectCostsAED.toFixed(2),
      m.grossProfitAED.toFixed(2),
      `${m.grossMarginPercent.toFixed(1)}%`,
      m.adSpendAED.toFixed(2),
      m.leadsGenerated,
      m.cprAED.toFixed(2),
      m.cacAED.toFixed(2),
      `${m.roas.toFixed(2)}x`,
      m.netProfitAfterMarketingAED.toFixed(2),
    ]);

    rows.push([
      `YEAR ${selectedYear} TOTAL`,
      yearTotals.totalParties,
      yearTotals.totalGuests,
      yearTotals.totalSales.toFixed(2),
      yearTotals.totalCosts.toFixed(2),
      yearTotals.totalGrossProfit.toFixed(2),
      `${yearTotals.overallGrossMargin.toFixed(1)}%`,
      yearTotals.totalSpend.toFixed(2),
      yearTotals.totalLeads,
      yearTotals.overallCpr.toFixed(2),
      yearTotals.overallCac.toFixed(2),
      `${yearTotals.overallRoas.toFixed(2)}x`,
      yearTotals.totalNetProfit.toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(e => e.map(x => `"${x}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CPH_Annual_Banquet_Ledger_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Recharts Chart Data
  const chartData = monthsData.map(m => ({
    name: m.monthShort,
    monthLabel: m.monthLabel,
    sales: m.grossRevenueAED,
    costs: m.totalDirectCostsAED,
    spend: m.adSpendAED,
    profit: m.grossProfitAED,
    roas: m.roas,
    leads: m.leadsGenerated,
  }));

  return (
    <div className="space-y-6">
      
      {/* =====================================================================
          TOP ACTION BAR: YEAR SELECTOR & GLOBAL REPORT GENERATORS
          ===================================================================== */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E2ECE7] shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        
        {/* Year Pills & Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 mr-2 text-xs font-bold text-[#5A6F66]">
            <Calendar className="w-4 h-4 text-[#236B50]" />
            <span>Select Year:</span>
          </div>

          {customYears.map((yr) => (
            <button
              key={yr}
              onClick={() => setSelectedYear(yr)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                selectedYear === yr
                  ? 'bg-[#236B50] text-amber-200 shadow-md ring-2 ring-[#236B50]/30'
                  : 'bg-[#F4F8F6] text-[#192A24] hover:bg-[#E8F3EE] border border-[#D5E5DE]'
              }`}
            >
              FY {yr}
            </button>
          ))}

          {/* Add Year Button (hidden for read-only GM) */}
          {!isReadOnlyGM && (
            newYearInputOpen ? (
              <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-[#236B50]">
                <input
                  type="number"
                  min="2020"
                  max="2035"
                  value={newYearInputValue}
                  onChange={(e) => setNewYearInputValue(e.target.value)}
                  className="w-16 px-1.5 py-0.5 text-xs font-bold font-mono focus:outline-none"
                />
                <button
                  onClick={handleAddYear}
                  className="px-2 py-0.5 text-[10px] font-bold bg-[#236B50] text-white rounded-lg"
                >
                  Add
                </button>
                <button
                  onClick={() => setNewYearInputOpen(false)}
                  className="p-0.5 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setNewYearInputOpen(true)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#236B50] bg-[#E8F5EE] hover:bg-[#D5EFE3] border border-[#C5E5D5] transition-colors flex items-center space-x-1 cursor-pointer"
                title="Add a custom year to store past or future records"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Year</span>
              </button>
            )
          )}
        </div>

        {/* Global Report Generator Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-[#F4F8F6] rounded-2xl border border-[#D5E5DE]">
            <button
              onClick={() => setActiveView('grid')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeView === 'grid' ? 'bg-white text-[#236B50] shadow-xs' : 'text-[#5A6F66]'
              }`}
            >
              12-Month Cards
            </button>
            <button
              onClick={() => setActiveView('table')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeView === 'table' ? 'bg-white text-[#236B50] shadow-xs' : 'text-[#5A6F66]'
              }`}
            >
              Comparative Table
            </button>
            <button
              onClick={() => setActiveView('quarters')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeView === 'quarters' ? 'bg-white text-[#236B50] shadow-xs' : 'text-[#5A6F66]'
              }`}
            >
              Quarterly (Q1-Q4)
            </button>
            <button
              onClick={() => setActiveView('charts')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeView === 'charts' ? 'bg-white text-[#236B50] shadow-xs' : 'text-[#5A6F66]'
              }`}
            >
              ROAS Charts
            </button>
            <button
              onClick={() => setActiveView('yoy')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeView === 'yoy' ? 'bg-white text-[#236B50] shadow-xs' : 'text-[#5A6F66]'
              }`}
            >
              Year-to-Year (YoY)
            </button>
          </div>

          {!isReadOnlyGM && (
            <button
              type="button"
              onClick={() => {
                setOcrInitialMonthKey('');
                setOcrModalOpen(true);
              }}
              className="px-3.5 py-2 text-xs font-extrabold rounded-2xl bg-[#1A4D3A] hover:bg-[#133B2C] text-amber-200 border border-amber-300/30 transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <ScanText className="w-3.5 h-3.5 text-amber-300" />
              <span>OCR Import Meta Report</span>
            </button>
          )}

          <button
            onClick={handleExportYearCSV}
            className="px-3.5 py-2 text-xs font-bold rounded-2xl bg-white hover:bg-neutral-50 text-[#192A24] border border-[#D5E5DE] transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          {/* 1-Click Generate Yearly Report */}
          <button
            onClick={() => setYearlyDocOpen(true)}
            className="px-4 py-2 text-xs font-extrabold rounded-2xl bg-[#236B50] hover:bg-[#1B553F] text-amber-200 shadow-md transition-all flex items-center space-x-2 border border-amber-300/30 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>Generate FY {selectedYear} Report</span>
          </button>
        </div>
      </div>

      {ocrStatusMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 font-bold flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{ocrStatusMsg}</span>
          </div>
          {undoSnapshot && onRestoreReports && (
            <button
              type="button"
              onClick={handleUndoOcr}
              className="px-3 py-1 rounded-xl bg-white border border-emerald-400 text-emerald-900 hover:bg-emerald-100 font-extrabold text-[11px] flex items-center space-x-1 cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo OCR Import</span>
            </button>
          )}
        </div>
      )}

      {/* =====================================================================
          ANNUAL EXECUTIVE SUMMARY BANNER
          ===================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        <div className="p-3 bg-white rounded-2xl border border-[#E2ECE7] shadow-xs">
          <div className="text-[10px] text-[#5A6F66] font-bold uppercase">Total Sales</div>
          <div className="text-sm sm:text-base font-black text-[#192A24] font-mono mt-0.5">
            {formatCurrency(yearTotals.totalSales)}
          </div>
          <div className="text-[9px] text-[#5A6F66] mt-0.5">{yearTotals.totalParties} Events</div>
        </div>

        <div className="p-3 bg-white rounded-2xl border border-[#E2ECE7] shadow-xs">
          <div className="text-[10px] text-[#5A6F66] font-bold uppercase">Direct Costs</div>
          <div className="text-sm sm:text-base font-black text-amber-800 font-mono mt-0.5">
            {formatCurrency(yearTotals.totalCosts)}
          </div>
          <div className="text-[9px] text-[#5A6F66] mt-0.5">Food & Venue</div>
        </div>

        <div className="p-3 bg-[#E8F5EE] rounded-2xl border border-[#C5E5D5] shadow-xs">
          <div className="text-[10px] text-[#1E5D46] font-bold uppercase">Gross Profit</div>
          <div className="text-sm sm:text-base font-black text-[#236B50] font-mono mt-0.5">
            +{formatCurrency(yearTotals.totalGrossProfit)}
          </div>
          <div className="text-[9px] text-[#236B50] font-bold mt-0.5">{yearTotals.overallGrossMargin.toFixed(1)}% Margin</div>
        </div>

        <div className="p-3 bg-white rounded-2xl border border-[#E2ECE7] shadow-xs">
          <div className="text-[10px] text-[#5A6F66] font-bold uppercase">Meta Ad Spend</div>
          <div className="text-sm sm:text-base font-black text-[#192A24] font-mono mt-0.5">
            {formatCurrency(yearTotals.totalSpend)}
          </div>
          <div className="text-[9px] text-[#5A6F66] mt-0.5">FB, IG & WA</div>
        </div>

        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 shadow-xs">
          <div className="text-[10px] text-amber-900 font-bold uppercase">Blended ROAS</div>
          <div className="text-sm sm:text-base font-black text-amber-950 font-mono mt-0.5">
            {yearTotals.overallRoas.toFixed(2)}x
          </div>
          <div className="text-[9px] text-amber-800 mt-0.5">Multiplier</div>
        </div>

        <div className="p-3 bg-white rounded-2xl border border-[#E2ECE7] shadow-xs">
          <div className="text-[10px] text-[#5A6F66] font-bold uppercase">Total Leads</div>
          <div className="text-sm sm:text-base font-black text-[#192A24] font-mono mt-0.5">
            {yearTotals.totalLeads}
          </div>
          <div className="text-[9px] text-[#5A6F66] mt-0.5">Inquiries</div>
        </div>

        <div className="p-3 bg-white rounded-2xl border border-[#E2ECE7] shadow-xs">
          <div className="text-[10px] text-[#5A6F66] font-bold uppercase">Average CPR</div>
          <div className="text-sm sm:text-base font-black text-[#192A24] font-mono mt-0.5">
            {formatCurrency(yearTotals.overallCpr)}
          </div>
          <div className="text-[9px] text-[#5A6F66] mt-0.5">Per Result</div>
        </div>

        <div className="p-3 bg-[#E8F5EE] rounded-2xl border border-[#C5E5D5] shadow-xs">
          <div className="text-[10px] text-[#1E5D46] font-bold uppercase">Net Profit</div>
          <div className="text-sm sm:text-base font-black text-[#236B50] font-mono mt-0.5">
            +{formatCurrency(yearTotals.totalNetProfit)}
          </div>
          <div className="text-[9px] text-[#236B50] font-bold mt-0.5">After Ads</div>
        </div>
      </div>

      {/* =====================================================================
          VIEW 1: 12-MONTH CARDS GRID (FULL YEAR AT A GLANCE)
          ===================================================================== */}
      {activeView === 'grid' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-extrabold text-[#192A24] flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#236B50]" />
              <span>Full 12-Month Performance Grid — Financial Year {selectedYear}</span>
            </h3>
            <span className="text-xs text-[#5A6F66]">
              Click <strong>Generate Report</strong> on any month to view or print the official A4 audit
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {monthsData.map((m) => {
              const hasActivity = m.grossRevenueAED > 0 || m.adSpendAED > 0;
              return (
                <div 
                  key={m.monthKey}
                  className={`rounded-3xl p-5 border transition-all flex flex-col justify-between ${
                    hasActivity 
                      ? 'bg-white border-[#E2ECE7] shadow-xs hover:border-[#236B50]/40 hover:shadow-md'
                      : 'bg-neutral-50/70 border-dashed border-neutral-300 opacity-80'
                  }`}
                >
                  {/* Month Header */}
                  <div>
                    <div className="flex items-center justify-between border-b border-[#E2ECE7] pb-2.5">
                      <div>
                        <span className="text-[10px] font-extrabold text-[#236B50] uppercase tracking-wider block">
                          Month {m.monthNumber}
                        </span>
                        <h4 className="text-base font-black text-[#192A24] tracking-tight">
                          {m.monthLabel}
                        </h4>
                      </div>

                      <div className="text-right">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          m.roas >= 15 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : m.roas > 0 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-neutral-100 text-neutral-500'
                        }`}>
                          {m.roas > 0 ? `${m.roas.toFixed(1)}x ROAS` : 'No Ads'}
                        </span>
                      </div>
                    </div>

                    {/* Core Financial Numbers */}
                    <div className="space-y-2 py-3 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-500">Gross Banquet Sales:</span>
                        <strong className="font-mono text-sm text-[#192A24]">
                          {formatCurrency(m.grossRevenueAED)}
                        </strong>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-neutral-500">Direct Kitchen & Hall Cost:</span>
                        <span className="font-mono text-amber-800">
                          {formatCurrency(m.totalDirectCostsAED)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-1 border-t border-neutral-100">
                        <span className="font-bold text-[#236B50]">Gross Margin:</span>
                        <strong className="font-mono text-[#236B50]">
                          +{formatCurrency(m.grossProfitAED)} ({m.grossMarginPercent.toFixed(1)}%)
                        </strong>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-neutral-500">Meta Ad Spend:</span>
                        <span className="font-mono text-neutral-700">
                          {formatCurrency(m.adSpendAED)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-neutral-500">Inquiries / Leads:</span>
                        <strong className="text-neutral-800">{m.leadsGenerated} Leads</strong>
                      </div>

                      <div className="flex justify-between items-center pt-1 border-t border-neutral-100 text-[11px]">
                        <span className="text-neutral-500">Events Executed:</span>
                        <span className="font-bold text-neutral-800">
                          {m.partiesCount} Parties ({m.totalGuests} Guests)
                        </span>
                      </div>
                    </div>

                    {m.topPerformingCampaign && (
                      <div className="text-[10px] text-neutral-500 line-clamp-1 bg-neutral-50 p-1.5 rounded-lg border border-neutral-200">
                        <strong>Top Ad:</strong> {m.topPerformingCampaign}
                      </div>
                    )}
                  </div>

                  {/* Actions for this Month */}
                  <div className="pt-3 border-t border-[#E2ECE7] flex items-center justify-between gap-2 mt-2">
                    {!isReadOnlyGM ? (
                      <button
                        onClick={() => handleOpenEditMonth(m)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors flex items-center space-x-1 cursor-pointer"
                        title="Edit month spend or revenue numbers"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-neutral-500" />
                        <span>Edit</span>
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-[#5A6F66] uppercase tracking-wide">
                        Read-Only Report
                      </span>
                    )}

                    <button
                      onClick={() => setSelectedMonthForDoc(m)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#E8F5EE] hover:bg-[#D4EFE1] text-[#236B50] border border-[#C5E5D5] transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Generate Report</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 2: FULL COMPARATIVE TABLE (JAN TO DEC + TOTALS + AVERAGES)
          ===================================================================== */}
      {activeView === 'table' && (
        <div className="bg-white rounded-3xl border border-[#E2ECE7] shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#E2ECE7] flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-[#192A24] text-sm sm:text-base flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-[#236B50]" />
                <span>Financial Year {selectedYear} — 12-Month Comparative Ledger</span>
              </h3>
              <p className="text-xs text-[#5A6F66]">
                Side-by-side comparison of banquet revenue, kitchen food costing, ad expenditure and realized ROAS.
              </p>
            </div>
            <button
              onClick={handleExportYearCSV}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-neutral-100 hover:bg-neutral-200 text-[#192A24] transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAF9] text-[#5A6F66] font-bold uppercase text-[9px] border-b border-[#E2ECE7]">
                <tr>
                  <th className="py-3 px-3.5">Month</th>
                  <th className="py-3 px-2 text-center">Events</th>
                  <th className="py-3 px-2 text-center">Guests</th>
                  <th className="py-3 px-3 text-right">Banquet Sales (AED)</th>
                  <th className="py-3 px-3 text-right">Direct Costs</th>
                  <th className="py-3 px-3 text-right">Gross Profit</th>
                  <th className="py-3 px-2 text-right">Margin %</th>
                  <th className="py-3 px-3 text-right">Ad Spend</th>
                  <th className="py-3 px-2 text-center">Leads</th>
                  <th className="py-3 px-2 text-center">ROAS</th>
                  <th className="py-3 px-3 text-right">Net Profit</th>
                  <th className="py-3 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2ECE7] text-[11px]">
                {monthsData.map((m) => (
                  <tr key={m.monthKey} className="hover:bg-[#F6FAF8] transition-colors">
                    <td className="py-2.5 px-3.5 font-bold text-[#192A24]">
                      {m.monthLabel}
                    </td>
                    <td className="py-2.5 px-2 text-center font-semibold">{m.partiesCount}</td>
                    <td className="py-2.5 px-2 text-center text-neutral-600">{m.totalGuests}</td>
                    <td className="py-2.5 px-3 text-right font-bold font-mono text-[#192A24]">
                      {formatCurrency(m.grossRevenueAED)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-800">
                      {formatCurrency(m.totalDirectCostsAED)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold font-mono text-[#236B50]">
                      +{formatCurrency(m.grossProfitAED)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold text-[#236B50]">
                      {m.grossMarginPercent.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-neutral-700">
                      {formatCurrency(m.adSpendAED)}
                    </td>
                    <td className="py-2.5 px-2 text-center font-semibold text-neutral-800">
                      {m.leadsGenerated}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        m.roas >= 15 ? 'bg-emerald-100 text-emerald-800' : m.roas > 0 ? 'bg-amber-100 text-amber-800' : 'text-neutral-400'
                      }`}>
                        {m.roas > 0 ? `${m.roas.toFixed(1)}x` : '-'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold font-mono text-[#236B50]">
                      +{formatCurrency(m.netProfitAfterMarketingAED)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        {!isReadOnlyGM && (
                          <button
                            onClick={() => handleOpenEditMonth(m)}
                            className="p-1 rounded-lg hover:bg-neutral-200 text-neutral-600 transition-colors"
                            title="Edit month numbers"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedMonthForDoc(m)}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[#E8F5EE] text-[#236B50] hover:bg-[#D5EFE3] transition-colors"
                          title="Generate official monthly A4 report"
                        >
                          Report
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#F8FAF9] font-bold text-xs border-t-2 border-[#D5E5DE]">
                <tr className="border-b border-[#E2ECE7] text-[#192A24]">
                  <td className="py-3 px-3.5 font-extrabold uppercase text-[10px]">FY {selectedYear} Total</td>
                  <td className="py-3 px-2 text-center">{yearTotals.totalParties}</td>
                  <td className="py-3 px-2 text-center">{yearTotals.totalGuests}</td>
                  <td className="py-3 px-3 text-right font-mono">{formatCurrency(yearTotals.totalSales)}</td>
                  <td className="py-3 px-3 text-right font-mono">{formatCurrency(yearTotals.totalCosts)}</td>
                  <td className="py-3 px-3 text-right font-mono text-[#236B50]">+{formatCurrency(yearTotals.totalGrossProfit)}</td>
                  <td className="py-3 px-2 text-right text-[#236B50]">{yearTotals.overallGrossMargin.toFixed(1)}%</td>
                  <td className="py-3 px-3 text-right font-mono">{formatCurrency(yearTotals.totalSpend)}</td>
                  <td className="py-3 px-2 text-center">{yearTotals.totalLeads}</td>
                  <td className="py-3 px-2 text-center font-extrabold text-amber-900">{yearTotals.overallRoas.toFixed(2)}x</td>
                  <td className="py-3 px-3 text-right font-mono text-[#236B50]">+{formatCurrency(yearTotals.totalNetProfit)}</td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => setYearlyDocOpen(true)}
                      className="px-2.5 py-1 text-[10px] font-extrabold rounded-lg bg-[#236B50] text-amber-200 hover:bg-[#1B553F]"
                    >
                      Print Full Year
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 3: QUARTERLY PERFORMANCE (Q1, Q2, Q3, Q4)
          ===================================================================== */}
      {activeView === 'quarters' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: 'Q1: Winter Weddings & Corporate Kickoff', range: 'January – March', months: monthsData.filter(m => m.monthNumber >= 1 && m.monthNumber <= 3) },
              { name: 'Q2: Holy Ramadan, Eid & Graduations', range: 'April – June', months: monthsData.filter(m => m.monthNumber >= 4 && m.monthNumber <= 6) },
              { name: 'Q3: Summer Promotions & Autumn Prep', range: 'July – September', months: monthsData.filter(m => m.monthNumber >= 7 && m.monthNumber <= 9) },
              { name: 'Q4: Grand Gala & Year-End Banquets', range: 'October – December', months: monthsData.filter(m => m.monthNumber >= 10 && m.monthNumber <= 12) },
            ].map((q) => {
              const qRev = q.months.reduce((s, m) => s + m.grossRevenueAED, 0);
              const qCosts = q.months.reduce((s, m) => s + m.totalDirectCostsAED, 0);
              const qSpend = q.months.reduce((s, m) => s + m.adSpendAED, 0);
              const qLeads = q.months.reduce((s, m) => s + m.leadsGenerated, 0);
              const qParties = q.months.reduce((s, m) => s + m.partiesCount, 0);
              const qProfit = qRev - qCosts;
              const qRoas = qSpend > 0 ? qRev / qSpend : 0;
              const qMargin = qRev > 0 ? (qProfit / qRev) * 100 : 0;

              return (
                <div key={q.name} className="bg-white rounded-3xl p-5 border border-[#E2ECE7] shadow-xs space-y-3">
                  <div className="border-b border-neutral-100 pb-2">
                    <span className="text-[10px] font-extrabold text-[#236B50] uppercase tracking-wider block">
                      {q.range}
                    </span>
                    <h4 className="font-extrabold text-[#192A24] text-sm">
                      {q.name}
                    </h4>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Banquet Sales:</span>
                      <strong className="font-mono text-sm text-[#192A24]">{formatCurrency(qRev)}</strong>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-neutral-500">Direct Costs:</span>
                      <span className="font-mono text-amber-800">{formatCurrency(qCosts)}</span>
                    </div>

                    <div className="flex justify-between pt-1 border-t border-neutral-100">
                      <span className="font-bold text-[#236B50]">Gross Margin:</span>
                      <strong className="font-mono text-[#236B50]">+{formatCurrency(qProfit)} ({qMargin.toFixed(1)}%)</strong>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-neutral-500">Meta Ad Spend:</span>
                      <span className="font-mono text-neutral-700">{formatCurrency(qSpend)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-neutral-500">Quarter ROAS:</span>
                      <strong className="font-mono text-amber-900">{qRoas.toFixed(2)}x</strong>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-neutral-500">Events Executed:</span>
                      <span className="font-bold text-neutral-800">{qParties} Parties</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 4: INTERACTIVE 12-MONTH RECHARTS VISUALIZATION
          ===================================================================== */}
      {activeView === 'charts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Monthly Sales vs Ad Spend */}
          <div className="bg-white p-5 rounded-3xl border border-[#E2ECE7] shadow-xs space-y-4">
            <div>
              <h4 className="font-extrabold text-sm text-[#192A24] flex items-center space-x-1.5">
                <BarChart3 className="w-4 h-4 text-[#236B50]" />
                <span>12-Month Sales vs Direct Costs vs Ad Spend — FY {selectedYear}</span>
              </h4>
              <p className="text-xs text-[#5A6F66]">
                Gross Banquet Sales, Direct Kitchen Costs and Meta Marketing Investment in AED.
              </p>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2ECE7" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5A6F66' }} />
                  <YAxis 
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} 
                    tick={{ fontSize: 11, fill: '#5A6F66' }}
                  />
                  <Tooltip 
                    formatter={(val: any) => formatCurrency(Number(val))}
                    labelFormatter={(label) => `Month: ${label} ${selectedYear}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="sales" name="Banquet Sales (AED)" fill="#236B50" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="costs" name="Direct Costs (AED)" fill="#D97706" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spend" name="Ad Spend (AED)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ROAS Multiplier & Inquiries Curve */}
          <div className="bg-white p-5 rounded-3xl border border-[#E2ECE7] shadow-xs space-y-4">
            <div>
              <h4 className="font-extrabold text-sm text-[#192A24] flex items-center space-x-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>12-Month ROAS Trend & Inquiry Generation Curve — FY {selectedYear}</span>
              </h4>
              <p className="text-xs text-[#5A6F66]">
                Return on Ad Spend multiplier trajectory and inquiries generated.
              </p>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2ECE7" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5A6F66' }} />
                  <YAxis 
                    yAxisId="roas"
                    unit="x"
                    domain={[0, 'auto']}
                    tick={{ fontSize: 11, fill: '#5A6F66' }}
                  />
                  <YAxis 
                    yAxisId="leads"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#5A6F66' }}
                  />
                  <Tooltip 
                    labelFormatter={(label) => `Month: ${label} ${selectedYear}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line 
                    yAxisId="roas"
                    type="monotone" 
                    dataKey="roas" 
                    name="ROAS Multiplier" 
                    stroke="#236B50" 
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#236B50' }}
                  />
                  <Line 
                    yAxisId="leads"
                    type="monotone" 
                    dataKey="leads" 
                    name="Leads Generated" 
                    stroke="#10B981" 
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3, fill: '#10B981' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-2">
            <YearOverYearComparisonChart
              bookings={bookings}
              marketingReports={marketingReports}
            />
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 5: YEAR-TO-YEAR MONTHLY COMPARISON (2025 vs 2026)
          ===================================================================== */}
      {activeView === 'yoy' && (
        <YearOverYearComparisonChart
          bookings={bookings}
          marketingReports={marketingReports}
        />
      )}

      {/* =====================================================================
          MODAL 1: MONTHLY REPORT OFFICIAL DOCUMENT VIEW (PRINT / PDF)
          ===================================================================== */}
      {selectedMonthForDoc && (
        <MonthlyReportDocModal
          data={selectedMonthForDoc}
          currentUser={currentUser}
          onClose={() => setSelectedMonthForDoc(null)}
          onEdit={() => {
            const m = selectedMonthForDoc;
            setSelectedMonthForDoc(null);
            handleOpenEditMonth(m);
          }}
        />
      )}

      {/* =====================================================================
          MODAL 2: YEARLY REPORT OFFICIAL DOCUMENT VIEW (PRINT / PDF)
          ===================================================================== */}
      {yearlyDocOpen && (
        <YearlyReportDocModal
          year={selectedYear}
          monthsData={monthsData}
          currentUser={currentUser}
          onClose={() => setYearlyDocOpen(false)}
        />
      )}

      {/* =====================================================================
          MODAL 3: EDIT / INPUT MONTH DATA
          ===================================================================== */}
      {editModalMonth && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border-2 border-[#236B50]/30 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="p-4 sm:px-6 bg-[#0E1E17] text-white flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase tracking-widest font-extrabold text-amber-400">
                  Update Monthly Performance Data
                </span>
                <h3 className="text-base font-extrabold">
                  {editModalMonth.monthLabel}
                </h3>
              </div>
              <button
                onClick={() => setEditModalMonth(null)}
                className="p-1.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveMonthData} className="p-5 sm:p-6 space-y-4 text-xs">
              <div className="p-2.5 rounded-2xl bg-[#F2F7F5] border border-[#D5E5DE] flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[#192A24]">
                  Have a Meta Ads screenshot or PDF for {editModalMonth.monthLabel}?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOcrInitialMonthKey(editModalMonth.monthKey);
                    setOcrModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#236B50] hover:bg-[#1B553F] text-white text-[11px] font-extrabold flex items-center space-x-1.5 cursor-pointer shrink-0"
                >
                  <ScanText className="w-3.5 h-3.5 text-amber-300" />
                  <span>Scan Meta Report (OCR)</span>
                </button>
              </div>
              
              {/* Ad Spend & Split */}
              <div className="space-y-1.5">
                <label className="font-extrabold text-neutral-800">
                  Total Meta / Digital Ad Spend (AED)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-neutral-400 font-bold">AED</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formSpend}
                    onChange={(e) => setFormSpend(e.target.value)}
                    placeholder="e.g. 4200"
                    className="w-full pl-12 pr-4 py-2 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#236B50] font-mono text-sm"
                  />
                </div>
              </div>

              {/* Spend split (Facebook, Instagram, WhatsApp) */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-neutral-500 font-bold block mb-1">Facebook Spend</label>
                  <input
                    type="number"
                    value={formFbSpend}
                    onChange={(e) => setFormFbSpend(e.target.value)}
                    placeholder="e.g. 1800"
                    className="w-full px-2 py-1.5 rounded-lg border border-neutral-300 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-500 font-bold block mb-1">Instagram Spend</label>
                  <input
                    type="number"
                    value={formIgSpend}
                    onChange={(e) => setFormIgSpend(e.target.value)}
                    placeholder="e.g. 1900"
                    className="w-full px-2 py-1.5 rounded-lg border border-neutral-300 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-500 font-bold block mb-1">WhatsApp Spend</label>
                  <input
                    type="number"
                    value={formWaSpend}
                    onChange={(e) => setFormWaSpend(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full px-2 py-1.5 rounded-lg border border-neutral-300 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Leads, Impressions, Clicks */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-extrabold text-neutral-800 block mb-1">Inquiries / Leads</label>
                  <input
                    type="number"
                    value={formLeads}
                    onChange={(e) => setFormLeads(e.target.value)}
                    placeholder="e.g. 95"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-neutral-300 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Impressions</label>
                  <input
                    type="number"
                    value={formImpressions}
                    onChange={(e) => setFormImpressions(e.target.value)}
                    placeholder="e.g. 150000"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-neutral-300 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Clicks</label>
                  <input
                    type="number"
                    value={formClicks}
                    onChange={(e) => setFormClicks(e.target.value)}
                    placeholder="e.g. 5200"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-neutral-300 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Historical / Offline Revenue & Event Count Override */}
              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2">
                <span className="font-extrabold text-neutral-800 block">
                  Banquet Sales Override (For Past Years or Target Projection)
                </span>
                <p className="text-[10px] text-neutral-500">
                  Note: If live bookings exist for this month in the system, they are automatically calculated. You can enter or override historical revenue here.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-500 font-bold block mb-1">Gross Sales (AED)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formHistRevenue}
                      onChange={(e) => setFormHistRevenue(e.target.value)}
                      placeholder="e.g. 62000"
                      className="w-full px-2 py-1.5 rounded-lg border border-neutral-300 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 font-bold block mb-1">Parties Count</label>
                    <input
                      type="number"
                      value={formHistParties}
                      onChange={(e) => setFormHistParties(e.target.value)}
                      placeholder="e.g. 6"
                      className="w-full px-2 py-1.5 rounded-lg border border-neutral-300 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 font-bold block mb-1">Total Guests</label>
                    <input
                      type="number"
                      value={formHistGuests}
                      onChange={(e) => setFormHistGuests(e.target.value)}
                      placeholder="e.g. 580"
                      className="w-full px-2 py-1.5 rounded-lg border border-neutral-300 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Campaign name */}
              <div className="space-y-1">
                <label className="font-bold text-neutral-700">Top Performing Ad Campaign</label>
                <input
                  type="text"
                  value={formCampaign}
                  onChange={(e) => setFormCampaign(e.target.value)}
                  placeholder="e.g. Grand Wedding Reception - Free Hall Promo"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="font-bold text-neutral-700">Audit Notes / Commentary</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Key observations, seasonal factors, corporate bookings..."
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end space-x-2 pt-2 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setEditModalMonth(null)}
                  className="px-4 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#236B50] hover:bg-[#1B553F] text-amber-200 font-extrabold shadow-md"
                >
                  Save Monthly Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Meta Ads Report OCR Safe Import Modal */}
      <MetaAdsOcrImportModal
        isOpen={ocrModalOpen}
        onClose={() => setOcrModalOpen(false)}
        existingReports={marketingReports}
        currentUser={currentUser}
        initialMonthKey={ocrInitialMonthKey}
        onApplySingleToForm={editModalMonth ? handleApplyOcrToEditModal : undefined}
        onCommitReports={handleCommitOcrReports}
      />

    </div>
  );
};
