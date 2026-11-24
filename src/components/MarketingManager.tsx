import React, { useState, useMemo, useEffect } from 'react';
import { 
  Megaphone, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Calendar, 
  BarChart3, 
  Target, 
  CheckCircle2, 
  Sparkles, 
  Layers, 
  Plus, 
  Clock, 
  Filter, 
  ArrowUpRight, 
  Copy, 
  Check, 
  Percent, 
  ExternalLink, 
  MessageSquare, 
  MessageCircle, 
  Phone, 
  X, 
  Search, 
  AlertCircle, 
  Building2, 
  UtensilsCrossed, 
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Send,
  ScanText,
  RotateCcw
} from 'lucide-react';
import { 
  BookingEvent, 
  UserProfile, 
  MetaAdMonthlyReport, 
  BanquetLead, 
  InquiryStage, 
  LeadSource, 
  BanquetFollowUpTemplate 
} from '../types';
import { calculateEventFinancials, formatCurrency, formatPercent, getLiveTodayInfo } from '../utils/costCalculations';
import { AppStorage } from '../services/storage';
import { BANQUET_FOLLOW_UP_TEMPLATES } from '../data/initialData';
import { MarketingRoasBarChart, MonthlyComparativeMetric } from './MarketingRoasBarChart';
import { MarketingSeasonalityLineChart } from './MarketingSeasonalityLineChart';
import { MarketingKpiSummaryTable } from './MarketingKpiSummaryTable';
import { HotelRoomGuestWhatsAppRetargeting } from './HotelRoomGuestWhatsAppRetargeting';
import { BanquetHistoricalLedgerReport } from './BanquetHistoricalLedgerReport';
import { MetaAdsOcrImportModal, OcrExtractedRow } from './MetaAdsOcrImportModal';
import { MetaAdsDropzoneCard } from './MetaAdsDropzoneCard';
import { YearOverYearComparisonChart } from './YearOverYearComparisonChart';

interface MarketingManagerProps {
  marketingReports: MetaAdMonthlyReport[];
  bookings: BookingEvent[];
  currentUser: UserProfile;
  onSaveReport: (report: MetaAdMonthlyReport) => void;
  onSaveReportsBatch?: (reports: MetaAdMonthlyReport[], metaSummary: string) => void;
  onRestoreReports?: (snapshot: MetaAdMonthlyReport[]) => void;
  onBookingCreated?: (booking: BookingEvent) => void;
  defaultSubTab?: 'kpi_roas' | 'lead_pipeline' | 'guest_retargeting' | 'insert_data' | 'campaigns';
}

export const MarketingManager: React.FC<MarketingManagerProps> = ({
  marketingReports,
  bookings,
  currentUser,
  onSaveReport,
  onSaveReportsBatch,
  onRestoreReports,
  onBookingCreated,
  defaultSubTab = 'kpi_roas',
}) => {
  const isFrancisOnlyPipeline = currentUser.role === 'fnb_supervisor';

  // Normalize defaultSubTab into the 3 streamlined tabs
  const initialTab: 'kpi_roas' | 'lead_pipeline' | 'guest_retargeting' = 
    isFrancisOnlyPipeline ? 'lead_pipeline' :
    defaultSubTab === 'lead_pipeline' ? 'lead_pipeline' :
    defaultSubTab === 'guest_retargeting' ? 'guest_retargeting' : 'kpi_roas';

  const [activeSubTab, setActiveSubTab] = useState<'kpi_roas' | 'lead_pipeline' | 'guest_retargeting'>(initialTab);

  useEffect(() => {
    setActiveSubTab(
      isFrancisOnlyPipeline ? 'lead_pipeline' :
      defaultSubTab === 'lead_pipeline' ? 'lead_pipeline' :
      defaultSubTab === 'guest_retargeting' ? 'guest_retargeting' : 'kpi_roas'
    );
  }, [defaultSubTab, isFrancisOnlyPipeline]);

  const effectiveSubTab = isFrancisOnlyPipeline ? 'lead_pipeline' : activeSubTab;

  // Month selector for drill-down in ROAS & Performance tab
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('2026-08');
  const [roasViewMode, setRoasViewMode] = useState<'ledger_reports' | 'visual_analytics'>('ledger_reports');

  // Leads & Pipeline State
  const [leads, setLeads] = useState<BanquetLead[]>(() => AppStorage.getBanquetLeads());
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [leadSourceFilter, setLeadSourceFilter] = useState<string>('all');
  const [newLeadModalOpen, setNewLeadModalOpen] = useState(false);

  // 1-Click Conversion Modal State
  const [convertModalLead, setConvertModalLead] = useState<BanquetLead | null>(null);
  const [convertDeposit, setConvertDeposit] = useState<number>(3000);
  const [convertPricePerGuest, setConvertPricePerGuest] = useState<number>(85);

  // WhatsApp Follow-up Modal State
  const [whatsAppModalLead, setWhatsAppModalLead] = useState<BanquetLead | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('tpl_instant_menu');
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  // Simplified Quick Monthly Ad Spend Entry State (Zero raw CSV bloat)
  const [formMonthKey, setFormMonthKey] = useState<string>('2026-08');
  const [formMonthLabel, setFormMonthLabel] = useState<string>('August 2026');
  const [formAdSpend, setFormAdSpend] = useState<number>(0);
  const [formLeadsCount, setFormLeadsCount] = useState<number>(0);
  const [formTopCampaign, setFormTopCampaign] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [ocrModalOpen, setOcrModalOpen] = useState<boolean>(false);
  const [undoSnapshot, setUndoSnapshot] = useState<MetaAdMonthlyReport[] | null>(null);

  const { todayStr } = getLiveTodayInfo();
  const [pipelineFeedback, setPipelineFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Lead Form State
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadDate, setNewLeadDate] = useState(todayStr);
  const [newLeadGuests, setNewLeadGuests] = useState(80);
  const [newLeadBudget, setNewLeadBudget] = useState(10000);
  const [newLeadSource, setNewLeadSource] = useState<LeadSource>('meta_instagram_ad');
  const [newLeadHall, setNewLeadHall] = useState('First Floor Big Hall');
  const [newLeadMenu, setNewLeadMenu] = useState('Royal Wedding Feast (100 AED/pax)');
  const [newLeadNotes, setNewLeadNotes] = useState('');

  // -------------------------------------------------------------
  // Dynamic Performance Metrics & Monthly Aggregates
  // -------------------------------------------------------------
  const monthlyMetrics: MonthlyComparativeMetric[] = useMemo(() => {
    const baseMonthDefs = [
      { key: '2025-01', label: 'January 2025', short: 'Jan 25' },
      { key: '2025-02', label: 'February 2025', short: 'Feb 25' },
      { key: '2025-03', label: 'March 2025', short: 'Mar 25' },
      { key: '2025-04', label: 'April 2025', short: 'Apr 25' },
      { key: '2025-05', label: 'May 2025', short: 'May 25' },
      { key: '2025-06', label: 'June 2025', short: 'Jun 25' },
      { key: '2025-07', label: 'July 2025', short: 'Jul 25' },
      { key: '2025-08', label: 'August 2025', short: 'Aug 25' },
      { key: '2025-09', label: 'September 2025', short: 'Sep 25' },
      { key: '2025-10', label: 'October 2025', short: 'Oct 25' },
      { key: '2025-11', label: 'November 2025', short: 'Nov 25' },
      { key: '2025-12', label: 'December 2025', short: 'Dec 25' },
      { key: '2026-01', label: 'January 2026', short: 'Jan 26' },
      { key: '2026-02', label: 'February 2026', short: 'Feb 26' },
      { key: '2026-03', label: 'March 2026', short: 'Mar 26' },
      { key: '2026-04', label: 'April 2026', short: 'Apr 26' },
      { key: '2026-05', label: 'May 2026', short: 'May 26' },
      { key: '2026-06', label: 'June 2026', short: 'Jun 26' },
      { key: '2026-07', label: 'July 2026', short: 'Jul 26' },
      { key: '2026-08', label: 'August 2026', short: 'Aug 26' },
    ];
    const seenKeys = new Set(baseMonthDefs.map(m => m.key));
    const extraKeys = new Set<string>();
    marketingReports.forEach(r => { if (!seenKeys.has(r.monthKey)) extraKeys.add(r.monthKey); });
    bookings.forEach(b => {
      const k = b.eventDate?.substring(0, 7);
      if (k && !seenKeys.has(k)) extraKeys.add(k);
    });
    const monthDefs = [
      ...baseMonthDefs,
      ...Array.from(extraKeys).sort().map(key => {
        const [y, m] = key.split('-');
        const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        return {
          key,
          label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          short: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        };
      }),
    ];

    return monthDefs.map(m => {
      const rep = marketingReports.find(r => r.monthKey === m.key);
      const bks = bookings.filter(b => b.eventDate.startsWith(m.key));
      const finList = bks.map(b => calculateEventFinancials(b));
      const hasLiveBookings = bks.length > 0;

      const adSpend = rep ? rep.adSpendAED : 0;
      const leadsGen = rep ? rep.leadsGenerated : 0;
      const totalRev = hasLiveBookings
        ? finList.reduce((s, f) => s + f.subtotalRevenue, 0)
        : (rep?.historicalBanquetRevenue ?? 0);
      const directCosts = hasLiveBookings
        ? finList.reduce((s, f) => s + f.totalDirectCosts, 0)
        : (rep?.historicalDirectCosts !== undefined ? rep.historicalDirectCosts : totalRev * 0.32);
      const netProfit = totalRev - directCosts - adSpend;
      const roas = adSpend > 0 ? parseFloat((totalRev / adSpend).toFixed(2)) : 0;
      const cpr = rep?.cprAED && rep.cprAED > 0
        ? rep.cprAED
        : (leadsGen > 0 ? parseFloat((adSpend / leadsGen).toFixed(2)) : 0);
      const bookingsCount = hasLiveBookings
        ? bks.length
        : (rep?.historicalPartiesCount ?? (totalRev > 0 ? Math.max(1, Math.round(totalRev / 10000)) : 0));
      const convRate = leadsGen > 0 ? parseFloat(((bookingsCount / leadsGen) * 100).toFixed(2)) : 0;
      const cac = bookingsCount > 0 ? parseFloat((adSpend / bookingsCount).toFixed(2)) : adSpend;
      const mktPercent = totalRev > 0 ? parseFloat(((adSpend / totalRev) * 100).toFixed(1)) : 0;
      const finishedCount = hasLiveBookings
        ? bks.filter(b => b.partyEnded || b.status === 'completed').length
        : (m.key < '2026-09' ? bookingsCount : 0);
      const upcomingCount = hasLiveBookings
        ? bks.filter(b => !b.partyEnded && b.status !== 'cancelled').length
        : (m.key >= '2026-09' ? bookingsCount : 0);

      return {
        monthKey: m.key,
        monthLabel: m.label,
        adSpendAED: adSpend,
        totalBanquetRevenue: totalRev,
        totalDirectCosts: directCosts,
        netProfitAfterMarketing: netProfit,
        roas,
        leadsGenerated: leadsGen,
        bookingsCount,
        finishedCount,
        upcomingCount,
        conversionRate: convRate,
        cpr,
        cac,
        marketingPercentOfRevenue: mktPercent,
        monthBookings: bks,
      };
    });
  }, [marketingReports, bookings]);

  // Overall totals
  const totalSpendAll = useMemo(() => monthlyMetrics.reduce((s, m) => s + m.adSpendAED, 0), [monthlyMetrics]);
  const totalRevenueAll = useMemo(() => monthlyMetrics.reduce((s, m) => s + m.totalBanquetRevenue, 0), [monthlyMetrics]);
  const totalLeadsAll = useMemo(() => monthlyMetrics.reduce((s, m) => s + m.leadsGenerated, 0), [monthlyMetrics]);
  const totalBookingsAll = useMemo(() => monthlyMetrics.reduce((s, m) => s + m.bookingsCount, 0), [monthlyMetrics]);
  const overallRoas = totalSpendAll > 0 ? (totalRevenueAll / totalSpendAll).toFixed(1) : '0';
  const overallCpr = totalLeadsAll > 0 ? (totalSpendAll / totalLeadsAll).toFixed(2) : '0';

  // -------------------------------------------------------------
  // Quick Monthly Entry Auto-calculations
  // -------------------------------------------------------------
  const formMonthBookings = useMemo(() => bookings.filter(b => b.eventDate.startsWith(formMonthKey)), [bookings, formMonthKey]);
  const formMonthRevenue = useMemo(() => formMonthBookings.reduce((s, b) => s + calculateEventFinancials(b).subtotalRevenue, 0), [formMonthBookings]);
  const autoCpr = formLeadsCount > 0 ? (formAdSpend / formLeadsCount).toFixed(2) : '0.00';
  const autoConvRate = formLeadsCount > 0 ? ((formMonthBookings.length / formLeadsCount) * 100).toFixed(1) : '0.0';
  const autoRoas = formAdSpend > 0 ? (formMonthRevenue / formAdSpend).toFixed(2) : '0.00';

  const handleSaveMonthlyReport = (e: React.FormEvent) => {
    e.preventDefault();
    const cpr = formLeadsCount > 0 ? parseFloat((formAdSpend / formLeadsCount).toFixed(2)) : 0;
    const convRate = formLeadsCount > 0 ? parseFloat(((formMonthBookings.length / formLeadsCount) * 100).toFixed(2)) : 0;
    const roas = formAdSpend > 0 ? parseFloat((formMonthRevenue / formAdSpend).toFixed(2)) : 0;

    const existing = marketingReports.find(r => r.monthKey === formMonthKey);
    const newReport: MetaAdMonthlyReport = {
      id: existing?.id || `meta_rep_${formMonthKey.replace('-', '_')}`,
      monthKey: formMonthKey,
      monthLabel: formMonthLabel,
      adSpendAED: Number(formAdSpend),
      impressions: existing?.impressions || 0,
      clicks: existing?.clicks || 0,
      leadsGenerated: Number(formLeadsCount),
      cprAED: cpr,
      ctrPercent: existing?.ctrPercent || 0,
      conversionRatePercent: convRate,
      roasMultiplier: roas,
      historicalBanquetRevenue: existing?.historicalBanquetRevenue,
      historicalDirectCosts: existing?.historicalDirectCosts,
      historicalPartiesCount: existing?.historicalPartiesCount,
      historicalGuestsCount: existing?.historicalGuestsCount,
      topPerformingCampaign: formTopCampaign,
      notes: formNotes,
      insertedAt: new Date().toISOString(),
      insertedBy: currentUser.name,
    };

    onSaveReport(newReport);
    setSaveSuccessMsg(`Ad spend & KPI report for ${formMonthLabel} saved. ROAS: ${roas}x, CPR: ${cpr} AED.`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  const handleApplyOcrToForm = (row: OcrExtractedRow) => {
    if (row.monthKey) {
      setFormMonthKey(row.monthKey);
      setFormMonthLabel(row.monthLabel);
    }
    setFormAdSpend(row.adSpendAED);
    setFormLeadsCount(row.leadsGenerated);
    if (row.topPerformingCampaign) setFormTopCampaign(row.topPerformingCampaign);
    setFormNotes(`OCR verified from Meta Ads report (${new Date().toLocaleDateString()})`);
    setSaveSuccessMsg(`OCR figures loaded into form for ${row.monthLabel}. Review and click "Save Ad Record" to commit.`);
    setTimeout(() => setSaveSuccessMsg(null), 6000);
  };

  const handleCommitOcrBatch = (reportsToSave: MetaAdMonthlyReport[], metaSummary: string) => {
    setUndoSnapshot([...marketingReports]);
    if (onSaveReportsBatch) {
      onSaveReportsBatch(reportsToSave, metaSummary);
    } else {
      reportsToSave.forEach(r => onSaveReport(r));
    }
    if (reportsToSave.length > 0) {
      setSelectedMonthKey(reportsToSave[reportsToSave.length - 1].monthKey);
    }
    setSaveSuccessMsg(`Safely imported ${reportsToSave.length} verified Meta Ads month(s) via OCR.`);
    setTimeout(() => setSaveSuccessMsg(null), 7000);
  };

  const handleUndoOcrImport = () => {
    if (!undoSnapshot) return;
    if (onRestoreReports) {
      onRestoreReports(undoSnapshot);
    } else {
      AppStorage.setMarketingReports(undoSnapshot);
    }
    setUndoSnapshot(null);
    setSaveSuccessMsg('Reverted last OCR import cleanly.');
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // -------------------------------------------------------------
  // Pipeline Handlers
  // -------------------------------------------------------------
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (leadSourceFilter !== 'all' && l.source !== leadSourceFilter) return false;
      if (!leadSearchQuery.trim()) return true;
      const q = leadSearchQuery.toLowerCase();
      return (
        l.clientName.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        (l.hallPreference || '').toLowerCase().includes(q) ||
        (l.adCampaignName || '').toLowerCase().includes(q)
      );
    });
  }, [leads, leadSourceFilter, leadSearchQuery]);

  const kanbanColumns: { stage: InquiryStage; label: string; color: string; badgeBg: string; borderCol: string }[] = [
    { stage: 'new_lead', label: '1. New Ad Inquiries', color: 'text-blue-900', badgeBg: 'bg-blue-100 text-blue-900 border-blue-300', borderCol: 'border-blue-200' },
    { stage: 'menu_sent', label: '2. Menu & Quote Sent', color: 'text-indigo-900', badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300', borderCol: 'border-indigo-200' },
    { stage: 'tasting_hall_tour', label: '3. Tasting & Hall Tour', color: 'text-amber-900', badgeBg: 'bg-amber-100 text-amber-900 border-amber-300', borderCol: 'border-amber-200' },
    { stage: 'tentative_hold', label: '4. 48h Tentative Hold', color: 'text-purple-900', badgeBg: 'bg-purple-100 text-purple-900 border-purple-300', borderCol: 'border-purple-200' },
    { stage: 'converted_won', label: '5. Converted & Booked (Won)', color: 'text-emerald-900', badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300', borderCol: 'border-emerald-300' },
  ];

  const handleMoveStage = (leadId: string, newStage: InquiryStage) => {
    const updated = AppStorage.updateLeadStage(leadId, newStage, currentUser);
    if (updated) {
      setLeads(AppStorage.getBanquetLeads());
    }
  };

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName.trim() || !newLeadPhone.trim()) {
      setPipelineFeedback({ type: 'error', text: 'Please enter guest name and phone number.' });
      setTimeout(() => setPipelineFeedback(null), 4000);
      return;
    }

    const clean = newLeadPhone.replace(/[^0-9]/g, '');
    const newLead: BanquetLead = {
      id: `lead_${Date.now()}`,
      clientName: newLeadName.trim(),
      phone: newLeadPhone.trim(),
      cleanPhone: clean.startsWith('971') ? clean : `971${clean.replace(/^0+/, '')}`,
      email: newLeadEmail.trim() || undefined,
      source: newLeadSource,
      stage: 'new_lead',
      targetEventDate: newLeadDate,
      estimatedGuests: Number(newLeadGuests) || 60,
      budgetAED: Number(newLeadBudget) || 8000,
      hallPreference: newLeadHall,
      buffetPreference: newLeadMenu,
      adCampaignName: 'Royal Wedding & Mega Reception (100 AED Buffet)',
      notes: newLeadNotes.trim() || undefined,
      followUpStatus: 'requires_urgent_call',
      createdAt: new Date().toISOString(),
    };

    AppStorage.saveBanquetLead(newLead);
    setLeads(AppStorage.getBanquetLeads());
    setNewLeadModalOpen(false);

    // Reset form
    setNewLeadName('');
    setNewLeadPhone('');
    setNewLeadEmail('');
    setNewLeadNotes('');
  };

  // 1-Click Convert Lead to Confirmed Banquet Booking!
  const handleExecuteConversion = () => {
    if (!convertModalLead) return;

    try {
      const halls = AppStorage.getHalls();
      const matchedHall = halls.find(h => h.name === convertModalLead.hallPreference) || halls[0];
      const packages = AppStorage.getPackages();

      const { booking } = AppStorage.convertLeadToBooking(
        convertModalLead.id,
        {
          hallId: matchedHall.id,
          packageId: packages[0]?.id,
          foodPricePerGuestCharged: convertPricePerGuest,
          depositAmount: convertDeposit,
        },
        currentUser
      );

      setLeads(AppStorage.getBanquetLeads());
      if (onBookingCreated) {
        onBookingCreated(booking);
      }
      setConvertModalLead(null);
      setPipelineFeedback({
        type: 'success',
        text: `Lead "${convertModalLead.clientName}" converted to confirmed booking #${booking.bookingNumber} on ${booking.eventDate}. Advance of ${convertDeposit} AED recorded.`,
      });
      setTimeout(() => setPipelineFeedback(null), 6000);
    } catch (err: any) {
      setPipelineFeedback({
        type: 'error',
        text: `Failed to convert lead: ${err.message || 'Unknown error'}`,
      });
      setTimeout(() => setPipelineFeedback(null), 5000);
    }
  };

  // Helper to compile dynamic WhatsApp text
  const compileWhatsAppText = (tpl: BanquetFollowUpTemplate, lead: BanquetLead) => {
    return tpl.messageText
      .replace(/{client_name}/g, lead.clientName)
      .replace(/{date}/g, lead.targetEventDate || 'your upcoming date')
      .replace(/{guests}/g, String(lead.estimatedGuests || 80))
      .replace(/{hall_name}/g, lead.hallPreference || 'First Floor Big Hall');
  };

  return (
    <div className="space-y-6 pb-16">
      {/* =====================================================================
          TOP HEADER & 3 STREAMLINED SUBTABS SWITCHER
          ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-600 to-[#1C5740] text-white flex items-center justify-center shadow-md">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#192A24] font-['Plus_Jakarta_Sans']">
                {isFrancisOnlyPipeline ? 'Banquet Inquiry Pipeline (Kanban)' : 'Banquet Marketing & Growth Hub'}
              </h1>
              <p className="text-xs text-[#5A6F66]">
                {isFrancisOnlyPipeline
                  ? 'Live Banquet Inquiry Pipeline • Track Leads & Convert Inquiries to Bookings'
                  : 'Meta Ads ROAS Analytics • Live Lead Pipeline (Kanban) • WhatsApp Nurture Templates'}
              </p>
            </div>
          </div>
        </div>

        {/* 3 Streamlined Subtabs (For Francis, strictly show Inquiry Pipeline only) */}
        {isFrancisOnlyPipeline ? (
          <div className="bg-[#EBF3EF] p-1.5 rounded-2xl border border-[#D5E5DE] flex items-center text-xs font-semibold self-start sm:self-auto shadow-xs">
            <div className="px-4 py-2 rounded-xl bg-[#236B50] text-white font-extrabold shadow-sm flex items-center space-x-2">
              <Target className="w-4 h-4" />
              <span>Inquiry Pipeline (Kanban)</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 text-current font-black">
                {leads.filter(l => l.stage !== 'converted_won' && l.stage !== 'lost').length}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-[#EBF3EF] p-1.5 rounded-2xl border border-[#D5E5DE] flex flex-wrap gap-1 text-xs font-semibold self-start sm:self-auto shadow-xs">
            <button
              onClick={() => setActiveSubTab('kpi_roas')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-2 cursor-pointer ${
                effectiveSubTab === 'kpi_roas'
                  ? 'bg-[#236B50] text-white font-extrabold shadow-sm'
                  : 'text-[#3D5A4E] hover:text-[#192A24]'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>ROAS & Ad Performance</span>
            </button>

            <button
              onClick={() => setActiveSubTab('lead_pipeline')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-2 cursor-pointer ${
                effectiveSubTab === 'lead_pipeline'
                  ? 'bg-[#236B50] text-white font-extrabold shadow-sm'
                  : 'text-[#3D5A4E] hover:text-[#192A24]'
              }`}
            >
              <Target className="w-4 h-4" />
              <span>Inquiry Pipeline (Kanban)</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 text-current font-black">
                {leads.filter(l => l.stage !== 'converted_won' && l.stage !== 'lost').length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('guest_retargeting')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-2 cursor-pointer ${
                effectiveSubTab === 'guest_retargeting'
                  ? 'bg-[#236B50] text-white font-extrabold shadow-sm'
                  : 'text-[#3D5A4E] hover:text-[#192A24]'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp Follow-Ups & Guests</span>
            </button>
          </div>
        )}
      </div>

      {pipelineFeedback && (
        <div className={`px-4 py-3 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-xs ${
          pipelineFeedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center space-x-2">
            {pipelineFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{pipelineFeedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setPipelineFeedback(null)}
            className="text-current/70 hover:text-current p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =====================================================================
          TAB 1: ROAS & AD PERFORMANCE (Simplified, zero CSV parser clutter)
          ===================================================================== */}
      {effectiveSubTab === 'kpi_roas' && !isFrancisOnlyPipeline && (
        <div className="space-y-6">
          {/* Top Performance KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-3xl p-5 border border-[#D5E5DE] shadow-xs space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#5A6F66]">
                Total Meta Ad Spend
              </span>
              <div className="text-xl sm:text-2xl font-black text-[#192A24]">
                AED {totalSpendAll.toLocaleString()}
              </div>
              <div className="text-[11px] text-teal-800 font-bold flex items-center space-x-1">
                <span>{totalLeadsAll} Inquiries Generated</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-[#D5E5DE] shadow-xs space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#5A6F66]">
                Attributed Banquet Revenue
              </span>
              <div className="text-xl sm:text-2xl font-black text-[#236B50]">
                AED {totalRevenueAll.toLocaleString()}
              </div>
              <div className="text-[11px] text-emerald-800 font-bold flex items-center space-x-1">
                <span>{totalBookingsAll} Confirmed Parties</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-[#D5E5DE] shadow-xs space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#5A6F66]">
                Blended ROAS Multiplier
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-700">
                {overallRoas}x
              </div>
              <div className="text-[11px] text-[#5A6F66]">
                Every 1 AED spent returned {overallRoas} AED
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-[#D5E5DE] shadow-xs space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#5A6F66]">
                Cost Per Lead (CPR)
              </span>
              <div className="text-xl sm:text-2xl font-black text-[#192A24]">
                AED {overallCpr}
              </div>
              <div className="text-[11px] text-emerald-700 font-bold">
                Healthy benchmark (&lt; 45 AED)
              </div>
            </div>
          </div>

          {/* Inline Drag-and-Drop PDF / Image Meta Ads OCR Uploader */}
          <MetaAdsDropzoneCard
            existingReports={marketingReports}
            currentUser={currentUser}
            onCommitReports={handleCommitOcrBatch}
            onUndoImport={handleUndoOcrImport}
            canUndo={Boolean(undoSnapshot)}
            onOpenFullModal={() => setOcrModalOpen(true)}
          />

          {/* Sub-view switcher for ROAS & Ad Performance tab */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#D5E5DE] shadow-xs">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#236B50]"></span>
              <span className="text-xs font-extrabold text-[#192A24]">Marketing Performance Engine:</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-[#EBF3EF] p-1 rounded-xl border border-[#D5E5DE] text-xs font-semibold">
              <button
                onClick={() => setRoasViewMode('ledger_reports')}
                className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  roasViewMode === 'ledger_reports'
                    ? 'bg-[#236B50] text-white font-extrabold shadow-2xs'
                    : 'text-[#3D5A4E] hover:text-[#192A24]'
                }`}
              >
                12-Month & Yearly Ledger & Reports
              </button>
              <button
                onClick={() => setRoasViewMode('visual_analytics')}
                className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  roasViewMode === 'visual_analytics'
                    ? 'bg-[#236B50] text-white font-extrabold shadow-2xs'
                    : 'text-[#3D5A4E] hover:text-[#192A24]'
                }`}
              >
                ROAS Visual Charts & Tables
              </button>
            </div>
          </div>

          {roasViewMode === 'ledger_reports' ? (
            <BanquetHistoricalLedgerReport
              bookings={bookings}
              marketingReports={marketingReports}
              currentUser={currentUser}
              onSaveReport={onSaveReport}
              onSaveReportsBatch={onSaveReportsBatch}
              onRestoreReports={onRestoreReports}
            />
          ) : (
            <>
              {/* Interactive ROAS Bar Chart */}
              <MarketingRoasBarChart
                data={monthlyMetrics}
                selectedMonthKey={selectedMonthKey}
                onSelectMonth={setSelectedMonthKey}
              />

              {/* Seasonality Line Chart */}
              <MarketingSeasonalityLineChart
            data={monthlyMetrics}
            selectedMonthKey={selectedMonthKey}
            onSelectMonth={setSelectedMonthKey}
          />

          {/* Year-to-Year Monthly Comparison Chart (2025 vs 2026) */}
          <YearOverYearComparisonChart
            bookings={bookings}
            marketingReports={marketingReports}
          />

          {/* Monthly KPI Summary Table */}
          <MarketingKpiSummaryTable
            data={monthlyMetrics}
            selectedMonthKey={selectedMonthKey}
            onSelectMonth={setSelectedMonthKey}
          />

          {/* Clean Quick Monthly Entry Form (NO bulky CSV text parser!) */}
          <div className="bg-gradient-to-r from-white to-[#F6FAF8] border-2 border-[#C5E5D5] rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#D5E5DE]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#236B50] text-white flex items-center justify-center font-bold">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#192A24] text-sm">
                    Quick Monthly Meta Ads Entry
                  </h3>
                  <p className="text-xs text-[#5A6F66]">
                    Enter your total monthly ad spend and leads from Meta Ads Manager. CPR and ROAS calculate automatically.
                  </p>
                </div>
              </div>

              {/* Dynamic Auto-Calculated Badges + Safe OCR Import Trigger */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="px-2.5 py-1 rounded-xl bg-teal-50 text-teal-900 border border-teal-200">
                  CPR: <strong>AED {autoCpr}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-purple-50 text-purple-900 border border-purple-200">
                  Conv: <strong>{autoConvRate}%</strong>
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 font-black">
                  ROAS: <strong>{autoRoas}x</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setOcrModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#236B50] hover:bg-[#1B553F] text-amber-200 font-black text-xs shadow-sm border border-amber-300/30 flex items-center space-x-1.5 cursor-pointer transition-all"
                >
                  <ScanText className="w-3.5 h-3.5 text-amber-300" />
                  <span>Import Meta Ads Report (OCR / File)</span>
                </button>
              </div>
            </div>

            {saveSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 font-bold flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{saveSuccessMsg}</span>
                </div>
                {undoSnapshot && (
                  <button
                    type="button"
                    onClick={handleUndoOcrImport}
                    className="px-2.5 py-1 rounded-lg bg-white border border-emerald-400 text-emerald-900 hover:bg-emerald-100 font-extrabold text-[11px] flex items-center space-x-1 cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Undo OCR Import</span>
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSaveMonthlyReport} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#192A24] mb-1">Select Month</label>
                <select
                  value={formMonthKey}
                  onChange={(e) => {
                    const k = e.target.value;
                    setFormMonthKey(k);
                    const labels: Record<string, string> = {
                      '2026-08': 'August 2026',
                      '2026-09': 'September 2026',
                      '2026-10': 'October 2026',
                      '2026-11': 'November 2026',
                      '2026-12': 'December 2026',
                    };
                    setFormMonthLabel(labels[k] || k);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                >
                  <option value="2026-08">August 2026</option>
                  <option value="2026-09">September 2026</option>
                  <option value="2026-10">October 2026</option>
                  <option value="2026-11">November 2026</option>
                  <option value="2026-12">December 2026</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#192A24] mb-1">Total Meta Ad Spend (AED)</label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={formAdSpend}
                  onChange={(e) => setFormAdSpend(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-white"
                  placeholder="5200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#192A24] mb-1">Inquiries / Leads Generated</label>
                <input
                  type="number"
                  min="0"
                  value={formLeadsCount}
                  onChange={(e) => setFormLeadsCount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-white"
                  placeholder="158"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#192A24] mb-1">Top Performing Campaign</label>
                <input
                  type="text"
                  value={formTopCampaign}
                  onChange={(e) => setFormTopCampaign(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                  placeholder="Royal Wedding 100 AED Buffet"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-[#192A24] mb-1">Campaign Notes / Key Observations</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                  placeholder="e.g. Wedding campaign saw 12% boost from Instagram Reels video"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Ad Record</span>
                </button>
              </div>
            </form>
          </div>
          </>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: LIVE BANQUET INQUIRY PIPELINE (KANBAN BOARD)
          ===================================================================== */}
      {effectiveSubTab === 'lead_pipeline' && (
        <div className="space-y-5">
          {/* Pipeline Header Bar & Search / Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4.5 rounded-3xl border border-[#D5E5DE] shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={leadSearchQuery}
                  onChange={(e) => setLeadSearchQuery(e.target.value)}
                  placeholder="Search inquiries by name, phone..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#236B50]"
                />
              </div>

              <select
                value={leadSourceFilter}
                onChange={(e) => setLeadSourceFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white text-[#192A24]"
              >
                <option value="all">All Lead Sources</option>
                <option value="meta_instagram_ad">Instagram Ads</option>
                <option value="meta_facebook_lead">Facebook Leads</option>
                <option value="whatsapp_direct">WhatsApp Direct</option>
                <option value="hotel_guest_referral">In-House Guest</option>
              </select>
            </div>

            <button
              onClick={() => setNewLeadModalOpen(true)}
              className="px-4 py-2 rounded-2xl bg-[#236B50] hover:bg-[#1C5740] text-white font-black text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Banquet Inquiry</span>
            </button>
          </div>

          {/* Kanban Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 items-start">
            {kanbanColumns.map(col => {
              const colLeads = filteredLeads.filter(l => l.stage === col.stage);

              return (
                <div 
                  key={col.stage}
                  className={`bg-[#F9FCFA] rounded-3xl p-3 border-2 ${col.borderCol} space-y-3 min-h-[500px] flex flex-col shadow-xs`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-2 pt-1">
                    <span className={`text-xs font-black ${col.color}`}>
                      {col.label}
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${col.badgeBg}`}>
                      {colLeads.length}
                    </span>
                  </div>

                  {/* Cards container */}
                  <div className="space-y-2.5 flex-1 overflow-y-auto">
                    {colLeads.length === 0 ? (
                      <div className="p-4 text-center text-[11px] text-slate-400 italic bg-white/60 rounded-2xl border border-dashed border-slate-200">
                        No inquiries in this stage
                      </div>
                    ) : (
                      colLeads.map(lead => {
                        const isWon = lead.stage === 'converted_won';

                        return (
                          <div
                            key={lead.id}
                            className={`p-3.5 rounded-2xl bg-white border shadow-xs space-y-2.5 transition-all hover:shadow-md ${
                              isWon 
                                ? 'border-emerald-300 ring-1 ring-emerald-200' 
                                : lead.followUpStatus === 'requires_urgent_call'
                                ? 'border-rose-300 ring-1 ring-rose-200'
                                : 'border-[#E2ECE7] hover:border-[#236B50]'
                            }`}
                          >
                            {/* Card Top: Client name and source */}
                            <div>
                              <div className="flex items-start justify-between gap-1">
                                <h4 className="font-black text-xs text-[#192A24] leading-tight">
                                  {lead.clientName}
                                </h4>
                                {lead.followUpStatus === 'requires_urgent_call' && !isWon && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 shrink-0">
                                    Urgent
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-1.5 text-[11px] text-[#5A6F66] mt-0.5">
                                <Phone className="w-3 h-3 text-[#236B50]" />
                                <span className="font-mono">{lead.phone}</span>
                              </div>
                            </div>

                            {/* Details Pill: Date & Guests */}
                            <div className="bg-[#F6FAF8] p-2 rounded-xl text-[11px] text-[#284B3D] space-y-1">
                              <div className="flex items-center justify-between">
                                <span>Date: <strong>{lead.targetEventDate || 'TBD'}</strong></span>
                                <span>~<strong>{lead.estimatedGuests}</strong> Guests</span>
                              </div>
                              <div className="text-[10px] text-[#5A6F66] truncate">
                                Hall: {lead.hallPreference || 'First Floor Big Hall'}
                              </div>
                            </div>

                            {/* Source Badge */}
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                                {lead.source === 'meta_instagram_ad' ? '📷 Instagram Ad' :
                                 lead.source === 'meta_facebook_lead' ? '📘 Facebook Lead' :
                                 lead.source === 'whatsapp_direct' ? '💬 WhatsApp Direct' : '🏨 Hotel Guest'}
                              </span>
                              {lead.budgetAED && (
                                <span className="font-mono font-black text-[#236B50]">
                                  AED {lead.budgetAED.toLocaleString()}
                                </span>
                              )}
                            </div>

                            {/* Actions on Card */}
                            <div className="pt-1.5 border-t border-slate-100 flex flex-col gap-1.5">
                              {/* 1-Click WhatsApp Follow-up (Hidden for Francis) */}
                              {!isFrancisOnlyPipeline && (
                                <button
                                  type="button"
                                  onClick={() => setWhatsAppModalLead(lead)}
                                  className="w-full py-1.5 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-extrabold text-[11px] transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>WhatsApp Follow-Up</span>
                                </button>
                              )}

                              {/* 1-Click Convert to Booking! */}
                              {!isWon ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConvertModalLead(lead);
                                    setConvertDeposit(Math.round(((lead.estimatedGuests || 60) * 85) * 0.3));
                                  }}
                                  className="w-full py-1.5 px-2.5 rounded-xl bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white font-black text-[11px] shadow-xs transition-all flex items-center justify-center space-x-1 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>1-Click Convert to Booking</span>
                                </button>
                              ) : (
                                <div className="text-[10px] font-black text-emerald-800 bg-emerald-100/60 p-1 rounded text-center">
                                  ✓ Confirmed in Calendar
                                </div>
                              )}

                              {/* Stage Mover Selector */}
                              {!isWon && (
                                <select
                                  value={lead.stage}
                                  onChange={(e) => handleMoveStage(lead.id, e.target.value as InquiryStage)}
                                  className="w-full px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600 bg-white"
                                >
                                  <option value="new_lead">Stage: New Lead</option>
                                  <option value="menu_sent">Stage: Menu Sent</option>
                                  <option value="tasting_hall_tour">Stage: Tasting/Tour</option>
                                  <option value="tentative_hold">Stage: 48h Hold</option>
                                  <option value="converted_won">Stage: Converted (Won)</option>
                                  <option value="lost">Stage: Lost / Archive</option>
                                </select>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: WHATSAPP FOLLOW-UP TEMPLATES & ROOM GUEST RETARGETING
          ===================================================================== */}
      {effectiveSubTab === 'guest_retargeting' && !isFrancisOnlyPipeline && (
        <div className="space-y-6">
          {/* Section 1: Automated WhatsApp Follow-Up Templates for UAE Banquet Clients */}
          <div className="bg-white border-2 border-emerald-500/40 rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
                  <MessageCircle className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#192A24] text-base">
                    Automated WhatsApp Follow-Up Templates (UAE Banquet Clients)
                  </h3>
                  <p className="text-xs text-[#5A6F66]">
                    High-converting hospitality scripts crafted for WhatsApp discussions with UAE banquet hosts.
                  </p>
                </div>
              </div>
              <span className="text-xs font-black px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 self-start sm:self-auto">
                4 High-Conversion UAE Scripts
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {BANQUET_FOLLOW_UP_TEMPLATES.map(tpl => (
                <div 
                  key={tpl.id}
                  className="bg-[#F8FCFA] border-2 border-[#D5E5DE] hover:border-emerald-500 rounded-2xl p-4.5 space-y-3 transition-colors shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-[#192A24]">{tpl.title}</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                      {tpl.badge}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-mono text-slate-800 whitespace-pre-line leading-relaxed max-h-44 overflow-y-auto">
                    {tpl.messageText}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-500 font-bold">
                      Goal: {tpl.actionHook}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const targetLead = leads.find(l => l.stage !== 'converted_won') || leads[0];
                        if (targetLead) {
                          setWhatsAppModalLead(targetLead);
                          setSelectedTemplateId(tpl.id);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-all flex items-center space-x-1 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Test with Lead</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Hotel Room Guest Retargeting */}
          <HotelRoomGuestWhatsAppRetargeting currentUser={currentUser} />
        </div>
      )}

      {/* =====================================================================
          MODAL 1: 1-CLICK CONVERT LEAD TO CONFIRMED BANQUET BOOKING
          ===================================================================== */}
      {convertModalLead && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border-2 border-emerald-500/40 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-[#236B50] to-[#1C5740] text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 text-white flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">
                    1-Click Convert Lead to Confirmed Booking
                  </h3>
                  <p className="text-xs text-emerald-100">
                    Instantly creates confirmed booking in calendar & updates pipeline
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConvertModalLead(null)}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="bg-[#F6FAF8] p-4 rounded-2xl border border-[#D5E5DE] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-[#236B50]">Client Name</span>
                    <div className="text-base font-black text-[#192A24]">{convertModalLead.clientName}</div>
                    <div className="text-xs text-slate-500">{convertModalLead.phone}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase text-[#236B50]">Target Date</span>
                    <div className="text-sm font-black text-[#192A24]">{convertModalLead.targetEventDate}</div>
                    <div className="text-xs text-slate-500">{convertModalLead.estimatedGuests} Guests</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Buffet Rate / Guest (AED)</label>
                  <input
                    type="number"
                    value={convertPricePerGuest}
                    onChange={(e) => {
                      const p = parseFloat(e.target.value) || 0;
                      setConvertPricePerGuest(p);
                      setConvertDeposit(Math.round(((convertModalLead.estimatedGuests || 60) * p) * 0.3));
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Advance Deposit (AED)</label>
                  <input
                    type="number"
                    value={convertDeposit}
                    onChange={(e) => setConvertDeposit(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-xs text-emerald-800"
                  />
                </div>
              </div>

              <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                <div className="font-bold flex items-center space-x-1">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Automated System Synchronization:</span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Creates official booking number (CPH-2026-...), locks event date under the "One Party Per Date" rule, issues receipt for advance deposit of {convertDeposit} AED, and moves lead to "Converted & Booked (Won)".
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#F6FAF8] border-t border-[#D5E5DE] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setConvertModalLead(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteConversion}
                className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs shadow-md shadow-emerald-600/30 transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Create Booking</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: WHATSAPP DIRECT DISPATCHER
          ===================================================================== */}
      {!isFrancisOnlyPipeline && whatsAppModalLead && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border-2 border-emerald-500/40 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-[#1C5740] text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 text-white flex items-center justify-center font-bold">
                  <MessageCircle className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">
                    Send WhatsApp Follow-Up
                  </h3>
                  <p className="text-xs text-emerald-100">
                    To: {whatsAppModalLead.clientName} ({whatsAppModalLead.phone})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWhatsAppModalLead(null)}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Hospitality Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800"
                >
                  {BANQUET_FOLLOW_UP_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.title} ({t.badge})</option>
                  ))}
                </select>
              </div>

              {/* Message Preview */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Compiled Message Preview</label>
                  <button
                    type="button"
                    onClick={() => {
                      const tpl = BANQUET_FOLLOW_UP_TEMPLATES.find(t => t.id === selectedTemplateId) || BANQUET_FOLLOW_UP_TEMPLATES[0];
                      const txt = compileWhatsAppText(tpl, whatsAppModalLead);
                      navigator.clipboard.writeText(txt);
                      setCopiedTemplate(true);
                      setTimeout(() => setCopiedTemplate(false), 2000);
                    }}
                    className="text-[11px] font-bold text-[#236B50] hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedTemplate ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTemplate ? 'Copied!' : 'Copy Text'}</span>
                  </button>
                </div>

                <div className="p-3.5 bg-emerald-50/40 rounded-2xl border border-emerald-200 text-xs font-mono text-slate-800 whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto">
                  {compileWhatsAppText(
                    BANQUET_FOLLOW_UP_TEMPLATES.find(t => t.id === selectedTemplateId) || BANQUET_FOLLOW_UP_TEMPLATES[0],
                    whatsAppModalLead
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#F6FAF8] border-t border-[#D5E5DE] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setWhatsAppModalLead(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Close
              </button>

              <a
                href={`https://wa.me/${whatsAppModalLead.cleanPhone}?text=${encodeURIComponent(
                  compileWhatsAppText(
                    BANQUET_FOLLOW_UP_TEMPLATES.find(t => t.id === selectedTemplateId) || BANQUET_FOLLOW_UP_TEMPLATES[0],
                    whatsAppModalLead
                  )
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  AppStorage.updateLeadStage(whatsAppModalLead.id, 'menu_sent', currentUser);
                  setLeads(AppStorage.getBanquetLeads());
                  setWhatsAppModalLead(null);
                }}
                className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs shadow-md shadow-emerald-600/30 transition-all flex items-center space-x-1.5 cursor-pointer no-underline"
              >
                <Send className="w-4 h-4" />
                <span>Launch WhatsApp Chat</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: ADD NEW BANQUET INQUIRY
          ===================================================================== */}
      {newLeadModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border-2 border-[#236B50]/30 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-[#236B50] to-[#1C5740] text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 text-white flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">
                    Add New Banquet Lead / Inquiry
                  </h3>
                  <p className="text-xs text-emerald-100">
                    Captures direct phone, WhatsApp or Meta ad inquiries
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNewLeadModalOpen(false)}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateLead} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Host / Client Name *</label>
                  <input
                    type="text"
                    required
                    value={newLeadName}
                    onChange={(e) => setNewLeadName(e.target.value)}
                    placeholder="e.g. Al-Sayed Family"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number (WhatsApp) *</label>
                  <input
                    type="text"
                    required
                    value={newLeadPhone}
                    onChange={(e) => setNewLeadPhone(e.target.value)}
                    placeholder="+971 50 123 4567"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Date</label>
                  <input
                    type="date"
                    value={newLeadDate}
                    onChange={(e) => setNewLeadDate(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Guests</label>
                  <input
                    type="number"
                    min="10"
                    value={newLeadGuests}
                    onChange={(e) => setNewLeadGuests(parseInt(e.target.value) || 0)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Budget (AED)</label>
                  <input
                    type="number"
                    min="0"
                    value={newLeadBudget}
                    onChange={(e) => setNewLeadBudget(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lead Source</label>
                  <select
                    value={newLeadSource}
                    onChange={(e) => setNewLeadSource(e.target.value as LeadSource)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                  >
                    <option value="meta_instagram_ad">Instagram Ad</option>
                    <option value="meta_facebook_lead">Facebook Lead</option>
                    <option value="whatsapp_direct">WhatsApp Direct</option>
                    <option value="google_maps">Google Local / Maps</option>
                    <option value="walk_in">Walk-In Client</option>
                    <option value="hotel_guest_referral">In-House Hotel Guest</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Hall</label>
                  <select
                    value={newLeadHall}
                    onChange={(e) => setNewLeadHall(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                  >
                    <option value="First Floor Big Hall">First Floor Big Hall</option>
                    <option value="Suite room Hall">Suite room Hall</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Client Notes / Requirements</label>
                <input
                  type="text"
                  value={newLeadNotes}
                  onChange={(e) => setNewLeadNotes(e.target.value)}
                  placeholder="e.g. Wedding reception, vegetarian options required, requested bridal stage"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setNewLeadModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-2xl bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white font-black text-xs shadow-md shadow-[#236B50]/30 transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save to Pipeline</span>
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
        initialMonthKey={formMonthKey}
        onApplySingleToForm={handleApplyOcrToForm}
        onCommitReports={handleCommitOcrBatch}
      />
    </div>
  );
};
