import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Users, 
  Building, 
  FileText, 
  ChefHat,
  ChevronRight,
  Sparkles,
  PieChart as PieIcon,
  Plus,
  Coins,
  Percent,
  Calculator,
  ArrowRight,
  Filter,
  CheckCircle,
  Clock4,
  DollarSign,
  Megaphone,
  BarChart2,
  AlertTriangle,
  AlertCircle,
  ArrowUpRight,
  UtensilsCrossed,
  CreditCard,
  Banknote,
  Target
} from 'lucide-react';
import { BookingEvent, RawIngredient, UserProfile, RecipeMenuItem, BanquetHall, Invoice, MetaAdMonthlyReport } from '../types';
import { calculateEventFinancials, getBookingPaymentSummary, getLiveTodayInfo, formatCurrency, formatPercent } from '../utils/costCalculations';
import { AppStorage } from '../services/storage';
import { PostingReportModal } from './PostingReportModal';
import { QuickCashSettlementModal } from './QuickCashSettlementModal';
import { MarketingRollingForecastWidget } from './MarketingRollingForecastWidget';
import { YearOverYearComparisonChart } from './YearOverYearComparisonChart';
import { BookingsVsLeadsChart } from './BookingsVsLeadsChart';

interface DashboardProps {
  bookings: BookingEvent[];
  invoices?: Invoice[];
  ingredients: RawIngredient[];
  recipes: RecipeMenuItem[];
  halls: BanquetHall[];
  currentUser: UserProfile;
  marketingReports?: MetaAdMonthlyReport[];
  onNavigate: (tab: string, meta?: any) => void;
  onOpenBookingModal: () => void;
  onOpenChefUsageModal: (booking: BookingEvent) => void;
  onConfirmPartyEnded?: (bookingId: string) => void;
  onSettleCashBalance?: (booking: BookingEvent) => void;
}

interface MonthlyPartySummary {
  monthKey: string; // '2026-08', '2026-09', '2026-10', '2026-11'
  monthLabel: string; // 'August 2026', 'September 2026', etc.
  totalParties: number;
  finishedParties: number;
  upcomingParties: number;
  totalGuests: number;
  totalRevenue: number;
  parties: BookingEvent[];
}

export const Dashboard: React.FC<DashboardProps> = ({
  bookings,
  invoices = [],
  halls,
  currentUser,
  marketingReports = [],
  onNavigate,
  onOpenBookingModal,
  onOpenChefUsageModal,
  onConfirmPartyEnded,
  onSettleCashBalance,
}) => {
  const [quickCashModalBooking, setQuickCashModalBooking] = useState<BookingEvent | null>(null);

  // Live current system date baseline
  const { todayStr, currentMonthStr, currentMonthLabel } = getLiveTodayInfo();
  const currentMonthShort = new Date().toLocaleDateString('en-US', { month: 'short' });

  // Monthly Revenue Goal set by Manager in Reports
  const monthlyRevenueGoal = useMemo(() => {
    return AppStorage.getMonthlyRevenueGoal();
  }, []);

  // Current Month Performance
  const currentMonthRevenue = useMemo(() => {
    const monthBookings = bookings.filter(b => b.eventDate.startsWith(currentMonthStr) && b.status !== 'cancelled');
    const bksRev = monthBookings.reduce((sum, b) => {
      const bill = getBookingPaymentSummary(b).totalBill;
      return sum + bill;
    }, 0);
    const monthRep = marketingReports.find(r => r.monthKey === currentMonthStr);
    return monthRep ? Math.max(bksRev, monthRep.historicalBanquetRevenue || 0) : bksRev;
  }, [bookings, currentMonthStr, marketingReports]);

  const goalProgressPercent = useMemo(() => {
    if (monthlyRevenueGoal <= 0) return 0;
    return parseFloat(((currentMonthRevenue / monthlyRevenueGoal) * 100).toFixed(1));
  }, [currentMonthRevenue, monthlyRevenueGoal]);

  const remainingToGoal = useMemo(() => {
    return Math.max(0, monthlyRevenueGoal - currentMonthRevenue);
  }, [monthlyRevenueGoal, currentMonthRevenue]);

  // High-level party tabs: 'booked' (going to be held) vs 'finished' (already concluded)
  const [partyStatusTab, setPartyStatusTab] = useState<'booked' | 'finished'>('booked');
  
  // Selected month filter for drill-down breakdown ('all' or '2026-09', '2026-10', etc.)
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');
  
  // Posting report inspection modal
  const [selectedPostingReportBooking, setSelectedPostingReportBooking] = useState<BookingEvent | null>(null);

  // Yearly and Monthly Banquet Analysis state (for Accounts and Marketing)
  const [analysisPeriod, setAnalysisPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedAnalysisYear, setSelectedAnalysisYear] = useState<'2026' | '2025'>('2026');

  // =========================================================================
  // RECENT COSTING ALERTS: PARTIES WITH FOOD COST VARIANCE > 10%
  // Summarizes any parties requiring immediate attention from Chef Karim or Arun Kumar
  // =========================================================================
  const costingAlertParties = useMemo(() => {
    return bookings
      .filter(b => {
        if (b.status === 'cancelled') return false;
        if (b.hasFoodFromHotel === false) return false;
        const targetFoodCost = (b.foodCostPerGuestTheoretical || 22) * b.guestCount;
        if (targetFoodCost <= 0) return false;

        const actualFoodCost = b.foodCostActualTotal !== undefined && b.foodCostActualTotal > 0
          ? b.foodCostActualTotal
          : (b.chefPartyEntries && b.chefPartyEntries.length > 0
              ? b.chefPartyEntries.reduce((sum: number, e) => sum + (e.calculatedCostAED || 0), 0)
              : 0);

        if (actualFoodCost <= 0) return false;
        const varianceAed = actualFoodCost - targetFoodCost;
        const variancePercent = (varianceAed / targetFoodCost) * 100;
        return variancePercent > 10.0;
      })
      .map(b => {
        const targetFoodCost = (b.foodCostPerGuestTheoretical || 22) * b.guestCount;
        const actualFoodCost = b.foodCostActualTotal !== undefined && b.foodCostActualTotal > 0
          ? b.foodCostActualTotal
          : (b.chefPartyEntries && b.chefPartyEntries.length > 0
              ? b.chefPartyEntries.reduce((sum: number, e) => sum + (e.calculatedCostAED || 0), 0)
              : 0);
        const varianceAed = actualFoodCost - targetFoodCost;
        const variancePercent = (varianceAed / targetFoodCost) * 100;

        let reason = b.chefNotes;
        if (!reason) {
          if (variancePercent >= 15) {
            reason = 'Heavy meat & seafood portion replenishments logged during peak banquet service.';
          } else {
            reason = 'Kitchen ingredient usage exceeds theoretical portioning targets by >10%.';
          }
        }

        return {
          booking: b,
          targetFoodCost,
          actualFoodCost,
          varianceAed,
          variancePercent: parseFloat(variancePercent.toFixed(1)),
          reason,
        };
      })
      .sort((a, b) => b.variancePercent - a.variancePercent);
  }, [bookings]);

  const totalCostingVarianceAed = costingAlertParties.reduce((sum, a) => sum + a.varianceAed, 0);

  // =========================================================================
  // 1. MONTHLY PARTY COUNTS CLASSIFICATION & BREAKDOWN
  // "In September, how many parties? In October, how many parties? Like this."
  // =========================================================================
  const monthlySummaries: MonthlyPartySummary[] = useMemo(() => {
    const monthMap = new Map<string, BookingEvent[]>();

    bookings.forEach(b => {
      const monthKey = b.eventDate ? b.eventDate.substring(0, 7) : '2026-10';
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, []);
      }
      monthMap.get(monthKey)!.push(b);
    });

    const monthNames: Record<string, string> = {
      '2026-08': 'August 2026',
      '2026-09': 'September 2026',
      '2026-10': 'October 2026',
      '2026-11': 'November 2026',
      '2026-12': 'December 2026',
    };

    // Sort months chronologically
    const sortedKeys = Array.from(monthMap.keys()).sort();

    return sortedKeys.map(key => {
      const monthParties = monthMap.get(key) || [];
      const finished = monthParties.filter(b => b.eventDate < todayStr || b.partyEnded || b.status === 'completed');
      const upcoming = monthParties.filter(b => b.eventDate >= todayStr && !b.partyEnded && b.status !== 'completed');
      const guests = monthParties.reduce((sum, b) => sum + (b.guestCount || 0), 0);
      const revenue = monthParties.reduce((sum, b) => sum + calculateEventFinancials(b).subtotalRevenue, 0);

      // Pretty month label
      let label = monthNames[key];
      if (!label) {
        const [y, m] = key.split('-');
        const d = new Date(parseInt(y), parseInt(m) - 1, 1);
        label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }

      return {
        monthKey: key,
        monthLabel: label,
        totalParties: monthParties.length,
        finishedParties: finished.length,
        upcomingParties: upcoming.length,
        totalGuests: guests,
        totalRevenue: revenue,
        parties: monthParties,
      };
    });
  }, [bookings, todayStr]);

  // Current month stats (October 2026)
  const currentMonthBookings = useMemo(() => {
    return bookings.filter(b => b.eventDate.startsWith(currentMonthStr));
  }, [bookings, currentMonthStr]);

  const currentMonthFinancials = useMemo(() => {
    return currentMonthBookings.map(b => calculateEventFinancials(b));
  }, [currentMonthBookings]);

  const totalMonthlyRevenue = currentMonthFinancials.reduce((sum, f) => sum + f.subtotalRevenue, 0);
  const totalMonthlyCosts = currentMonthFinancials.reduce((sum, f) => sum + f.totalDirectCosts, 0);
  const totalMonthlyProfit = totalMonthlyRevenue - totalMonthlyCosts;
  const currentMonthBanquetCount = currentMonthBookings.length;
  const averageProfitMarginPercent = totalMonthlyRevenue > 0 ? (totalMonthlyProfit / totalMonthlyRevenue) * 100 : 0;
  const totalMonthlyGuests = currentMonthBookings.reduce((sum, b) => sum + (b.guestCount || 0), 0);

  // =========================================================================
  // 2. TWO HIGH-LEVEL PARTY CLASSIFICATIONS (Booked / Upcoming vs Finished)
  // =========================================================================
  const allBookedParties = useMemo(() => {
    return bookings
      .filter(b => b.eventDate >= todayStr && !b.partyEnded && b.status !== 'completed')
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  }, [bookings, todayStr]);

  const allFinishedParties = useMemo(() => {
    return bookings
      .filter(b => b.eventDate < todayStr || b.partyEnded || b.status === 'completed')
      .sort((a, b) => b.eventDate.localeCompare(a.eventDate)); // Most recently finished first
  }, [bookings, todayStr]);

  // Parties filtered by selected month drill-down
  const displayedParties = useMemo(() => {
    const baseList = partyStatusTab === 'booked' ? allBookedParties : allFinishedParties;
    if (selectedMonthFilter === 'all') return baseList;
    return baseList.filter(b => b.eventDate.startsWith(selectedMonthFilter));
  }, [partyStatusTab, allBookedParties, allFinishedParties, selectedMonthFilter]);

  // =========================================================================
  // 3. WORKFLOW STAGES (Sequenced & Classified: Francis -> Chef -> Arun)
  // =========================================================================
  // Stage 1: Bookings needing supervisor check or balance collection
  const pendingArrivals = useMemo(() => {
    return bookings.filter(b => {
      if (b.status === 'cancelled') return false;
      const summary = getBookingPaymentSummary(b);
      return !summary.isBalanceSettled && summary.balanceToPay > 0.01;
    });
  }, [bookings]);

  // Stage 1.5: Parties whose event date has arrived/passed and need Francis confirmation
  const unconfirmedEndedParties = useMemo(() => {
    return bookings.filter(b => 
      b.eventDate <= todayStr && 
      !b.partyEnded && 
      b.status !== 'cancelled'
    );
  }, [bookings, todayStr]);

  // Stage 1.6: Concluded/ended parties that have outstanding unpaid balance (Mandatory settlement for Francis)
  // User request: "make sure to send notification for francis after the party ends he have to settle balance that is must"
  const endedPartiesNeedingBalanceSettlement = useMemo(() => {
    return bookings.filter(b => {
      if (b.status === 'cancelled') return false;
      const isEnded = b.partyEnded || b.status === 'completed' || b.eventDate <= todayStr;
      if (!isEnded) return false;
      const summary = getBookingPaymentSummary(b);
      return summary.balanceToPay > 0.01 && !summary.isBalanceSettled;
    });
  }, [bookings, todayStr]);

  // Stage 2: Concluded parties needing Chef ingredient logging & stamp
  const chefPendingEndedParties = useMemo(() => {
    return bookings.filter(b => 
      (b.costingStatus === 'party_ended_pending_chef' || (b.partyEnded && !b.chefApproved)) && 
      b.hasFoodFromHotel &&
      b.costingStatus !== 'forwarded_to_accounts' &&
      b.costingStatus !== 'costed_by_arun'
    );
  }, [bookings]);

  // Stage 3: Accounts FIFO Queue (Chef-stamped vouchers awaiting Arun's costing & GL posting)
  const arunFifoQueue = useMemo(() => {
    return [...bookings]
      .filter(b =>
        (b.costingStatus === 'forwarded_to_accounts' || 
         (b.chefApproved && !b.arunCostedAt && b.costingStatus !== 'costed_by_arun') ||
         (b.partyEnded && !b.arunCostedAt && b.costingStatus !== 'costed_by_arun' && b.costingStatus !== 'approved')) &&
        b.hasFoodFromHotel
      )
      .sort((a, b) => {
        const timeA = new Date(a.chefApprovedAt || a.eventDate).getTime();
        const timeB = new Date(b.chefApprovedAt || b.eventDate).getTime();
        return timeA - timeB; // Earliest chef stamp first: strict FIFO
      });
  }, [bookings]);

  // Stage 4: Completed GL posted parties
  const costedPostingParties = useMemo(() => {
    return bookings.filter(b => b.costingStatus === 'costed_by_arun' || b.postingReportGenerated);
  }, [bookings]);

  // Roles permitted to view Banquet Yearly & Monthly Analysis
  const canViewBanquetAnalysis = currentUser.role === 'general_manager' || 
    currentUser.role === 'accounts_executive' || 
    currentUser.role === 'marketing_executive';

  const effectivePerspective = useMemo<'accounts' | 'marketing' | 'gm'>(() => {
    if (currentUser.role === 'accounts_executive') return 'accounts';
    if (currentUser.role === 'marketing_executive') return 'marketing';
    return 'gm';
  }, [currentUser.role]);

  // Yearly and Monthly Banquet Analysis Data Model
  const banquetYearlyMonthlyStats = useMemo(() => {
    const yearBookings = bookings.filter(b => b.eventDate.startsWith(selectedAnalysisYear));
    
    const monthDefs = [
      { key: `${selectedAnalysisYear}-01`, name: 'January', short: 'Jan' },
      { key: `${selectedAnalysisYear}-02`, name: 'February', short: 'Feb' },
      { key: `${selectedAnalysisYear}-03`, name: 'March', short: 'Mar' },
      { key: `${selectedAnalysisYear}-04`, name: 'April', short: 'Apr' },
      { key: `${selectedAnalysisYear}-05`, name: 'May', short: 'May' },
      { key: `${selectedAnalysisYear}-06`, name: 'June', short: 'Jun' },
      { key: `${selectedAnalysisYear}-07`, name: 'July', short: 'Jul' },
      { key: `${selectedAnalysisYear}-08`, name: 'August', short: 'Aug' },
      { key: `${selectedAnalysisYear}-09`, name: 'September', short: 'Sep' },
      { key: `${selectedAnalysisYear}-10`, name: 'October', short: 'Oct' },
      { key: `${selectedAnalysisYear}-11`, name: 'November', short: 'Nov' },
      { key: `${selectedAnalysisYear}-12`, name: 'December', short: 'Dec' },
    ];

    const monthsData = monthDefs.map(m => {
      const bks = yearBookings.filter(b => b.eventDate.startsWith(m.key));
      const finList = bks.map(b => calculateEventFinancials(b));
      const report = marketingReports.find(r => r.monthKey === m.key);
      const hasLiveBookings = bks.length > 0;
      const useHistoricalFallback = !hasLiveBookings && report && report.historicalBanquetRevenue !== undefined;

      const totalParties = hasLiveBookings
        ? bks.length
        : (useHistoricalFallback
            ? (report.historicalPartiesCount !== undefined
                ? report.historicalPartiesCount
                : (report.historicalBanquetRevenue! > 0 ? Math.max(1, Math.round(report.historicalBanquetRevenue! / 10000)) : 0))
            : 0);
      const finishedParties = hasLiveBookings
        ? bks.filter(b => b.eventDate < todayStr || b.partyEnded || b.status === 'completed').length
        : (m.key < currentMonthStr ? totalParties : 0);
      const bookedParties = Math.max(0, totalParties - finishedParties);
      const guests = hasLiveBookings
        ? bks.reduce((sum, b) => sum + (b.guestCount || 0), 0)
        : (useHistoricalFallback
            ? (report.historicalGuestsCount !== undefined ? report.historicalGuestsCount : totalParties * 70)
            : 0);

      const totalRevenue = hasLiveBookings
        ? finList.reduce((sum, f) => sum + f.subtotalRevenue, 0)
        : (useHistoricalFallback ? (report.historicalBanquetRevenue ?? 0) : 0);

      const totalDirectCosts = hasLiveBookings
        ? finList.reduce((sum, f) => sum + f.totalDirectCosts, 0)
        : (useHistoricalFallback
            ? (report.historicalDirectCosts !== undefined ? report.historicalDirectCosts : totalRevenue * 0.32)
            : 0);

      const foodCostActual = hasLiveBookings
        ? bks.reduce((sum, b) => {
            const fin = calculateEventFinancials(b);
            return sum + (b.foodCostActualTotal || fin.foodCost);
          }, 0)
        : (totalDirectCosts * 0.85);

      const foodCostTheoretical = hasLiveBookings
        ? bks.reduce((sum, b) => {
            return sum + ((b.foodCostPerGuestTheoretical || 22) * (b.guestCount || 30));
          }, 0)
        : (guests * 22);

      const foodCostVariance = foodCostActual - foodCostTheoretical;
      const grossProfit = totalRevenue - totalDirectCosts;
      const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      const foodCostPercent = totalRevenue > 0 ? (foodCostActual / totalRevenue) * 100 : 0;
      const avgRevenuePerParty = totalParties > 0 ? totalRevenue / totalParties : 0;
      const avgSpendPerGuest = guests > 0 ? totalRevenue / guests : 0;

      // Marketing Meta metrics (strict check on report presence so 0 spend stays 0)
      const adSpend = report ? report.adSpendAED : (totalParties > 0 ? totalParties * 650 : 0);
      const leads = report ? report.leadsGenerated : (totalParties > 0 ? totalParties * 18 : 0);
      const roas = adSpend > 0 ? totalRevenue / adSpend : 0;
      const cac = totalParties > 0 ? adSpend / totalParties : 0;
      const conversionRate = leads > 0 ? (totalParties / leads) * 100 : 0;

      // GL Postings count
      const glPostedCount = bks.filter(b => b.costingStatus === 'costed_by_arun' || b.postingReportGenerated).length;
      const pendingCostingCount = bks.filter(b => 
        (b.costingStatus === 'forwarded_to_accounts' || (b.chefApproved && !b.arunCostedAt)) && b.hasFoodFromHotel
      ).length;

      return {
        monthKey: m.key,
        monthName: m.name,
        monthShort: m.short,
        totalParties,
        finishedParties,
        bookedParties,
        guests,
        totalRevenue,
        foodCostActual,
        foodCostTheoretical,
        foodCostVariance,
        totalDirectCosts,
        grossProfit,
        grossMarginPercent,
        foodCostPercent,
        avgRevenuePerParty,
        avgSpendPerGuest,
        adSpend,
        leads,
        roas,
        cac,
        conversionRate,
        glPostedCount,
        pendingCostingCount,
        hasActivity: totalParties > 0 || totalRevenue > 0 || adSpend > 0 || leads > 0,
      };
    });

    const yearTotalParties = monthsData.reduce((sum, m) => sum + m.totalParties, 0);
    const yearFinishedParties = monthsData.reduce((sum, m) => sum + m.finishedParties, 0);
    const yearBookedParties = Math.max(0, yearTotalParties - yearFinishedParties);
    const yearTotalGuests = monthsData.reduce((sum, m) => sum + m.guests, 0);
    const yearTotalRevenue = monthsData.reduce((sum, m) => sum + m.totalRevenue, 0);
    const yearFoodCostActual = monthsData.reduce((sum, m) => sum + m.foodCostActual, 0);
    const yearFoodCostTheoretical = monthsData.reduce((sum, m) => sum + m.foodCostTheoretical, 0);
    const yearFoodCostVariance = yearFoodCostActual - yearFoodCostTheoretical;
    const yearTotalDirectCosts = monthsData.reduce((sum, m) => sum + m.totalDirectCosts, 0);
    const yearGrossProfit = yearTotalRevenue - yearTotalDirectCosts;
    const yearGrossMarginPercent = yearTotalRevenue > 0 ? (yearGrossProfit / yearTotalRevenue) * 100 : 0;
    const yearFoodCostPercent = yearTotalRevenue > 0 ? (yearFoodCostActual / yearTotalRevenue) * 100 : 0;
    const yearAvgRevenuePerParty = yearTotalParties > 0 ? yearTotalRevenue / yearTotalParties : 0;
    const yearAvgSpendPerGuest = yearTotalGuests > 0 ? yearTotalRevenue / yearTotalGuests : 0;
    const yearAdSpend = monthsData.reduce((sum, m) => sum + m.adSpend, 0);
    const yearLeads = monthsData.reduce((sum, m) => sum + m.leads, 0);
    const yearRoas = yearAdSpend > 0 ? yearTotalRevenue / yearAdSpend : 0;
    const yearCac = yearTotalParties > 0 ? yearAdSpend / yearTotalParties : 0;
    const yearGlPostedCount = monthsData.reduce((sum, m) => sum + m.glPostedCount, 0);
    const yearPendingCostingCount = monthsData.reduce((sum, m) => sum + m.pendingCostingCount, 0);

    const packageCounts: { [pkg: string]: { count: number; revenue: number } } = {};
    yearBookings.forEach(b => {
      const pkg = b.buffetTier === '100_aed' ? 'Royal Imperial Feast (100 AED)'
        : (b.buffetTier === '80_aed' ? 'Executive Deluxe (80 AED)'
        : (b.buffetTier === '60_aed' ? 'Classic Celebration (60 AED)'
        : 'Hall Only / Custom'));
      if (!packageCounts[pkg]) packageCounts[pkg] = { count: 0, revenue: 0 };
      packageCounts[pkg].count += 1;
      packageCounts[pkg].revenue += getBookingPaymentSummary(b).totalBill;
    });

    return {
      monthsData,
      activeMonths: monthsData.filter(m => m.hasActivity),
      yearSummary: {
        year: selectedAnalysisYear,
        totalParties: yearTotalParties,
        finishedParties: yearFinishedParties,
        bookedParties: yearBookedParties,
        totalGuests: yearTotalGuests,
        totalRevenue: yearTotalRevenue,
        foodCostActual: yearFoodCostActual,
        foodCostTheoretical: yearFoodCostTheoretical,
        foodCostVariance: yearFoodCostVariance,
        totalDirectCosts: yearTotalDirectCosts,
        grossProfit: yearGrossProfit,
        grossMarginPercent: yearGrossMarginPercent,
        foodCostPercent: yearFoodCostPercent,
        avgRevenuePerParty: yearAvgRevenuePerParty,
        avgSpendPerGuest: yearAvgSpendPerGuest,
        adSpend: yearAdSpend,
        leads: yearLeads,
        roas: yearRoas,
        cac: yearCac,
        glPostedCount: yearGlPostedCount,
        pendingCostingCount: yearPendingCostingCount,
        packageCounts,
      }
    };
  }, [bookings, selectedAnalysisYear, todayStr, marketingReports]);

  // Marketing Executive (Betselot) Current Month Meta Ads KPIs
  const currentMonthMarketingReport = useMemo(() => {
    return marketingReports.find(r => r.monthKey === currentMonthStr);
  }, [marketingReports, currentMonthStr]);

  const octMetaSpend = currentMonthMarketingReport ? currentMonthMarketingReport.adSpendAED : 0;
  const octRoas = octMetaSpend > 0 ? totalMonthlyRevenue / octMetaSpend : 0;
  const octCpr = currentMonthMarketingReport
    ? (currentMonthMarketingReport.cprAED || (currentMonthMarketingReport.leadsGenerated > 0 ? currentMonthMarketingReport.adSpendAED / currentMonthMarketingReport.leadsGenerated : 0))
    : 0;
  const octLeads = currentMonthMarketingReport ? currentMonthMarketingReport.leadsGenerated : 0;
  const octConversionRate = octLeads > 0 ? (currentMonthBanquetCount / octLeads) * 100 : 0;

  // =========================================================================
  // GENERAL MANAGER (GM): CLEAN READ-ONLY EXECUTIVE REPORTS PORTAL
  // Zero bulky operational queues, booking directories, or Francis alerts.
  // =========================================================================
  if (currentUser.role === 'general_manager') {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const getMonthData = (year: number, monthIndex: number) => {
      const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      const rep = marketingReports.find(r => r.monthKey === monthKey);
      const bks = bookings.filter(b => b.status !== 'cancelled' && b.eventDate.startsWith(monthKey));
      const sales = bks.length > 0
        ? bks.reduce((s, b) => s + calculateEventFinancials(b).subtotalRevenue, 0)
        : (rep?.historicalBanquetRevenue || 0);
      const spend = rep?.adSpendAED || 0;
      const leads = rep?.leadsGenerated || 0;
      const cpl = rep?.cprAED && rep.cprAED > 0 ? rep.cprAED : (leads > 0 ? spend / leads : 0);
      const roas = spend > 0 ? sales / spend : 0;
      return { monthKey, sales, spend, leads, cpl, roas, hasRecord: Boolean(rep) || bks.length > 0 };
    };

    const yoyRows = monthNames.map((name, idx) => {
      const y25 = getMonthData(2025, idx);
      const y26 = getMonthData(2026, idx);
      const delta = y26.sales - y25.sales;
      const yoyPct = y25.sales > 0 && y26.hasRecord ? ((y26.sales - y25.sales) / y25.sales) * 100 : null;
      return { name, y25, y26, delta, yoyPct };
    });

    const total2025Full = yoyRows.reduce((s, r) => s + r.y25.sales, 0);
    const active2026Rows = yoyRows.filter(r => r.y26.hasRecord || r.y26.sales > 0 || r.y26.spend > 0);
    const total2026Sales = active2026Rows.reduce((s, r) => s + r.y26.sales, 0);
    const matched2025Sales = active2026Rows.reduce((s, r) => s + r.y25.sales, 0);
    const yoySalesGrowthPct = matched2025Sales > 0 ? ((total2026Sales - matched2025Sales) / matched2025Sales) * 100 : null;
    const total2026Spend = active2026Rows.reduce((s, r) => s + r.y26.spend, 0);
    const total2026Leads = active2026Rows.reduce((s, r) => s + r.y26.leads, 0);
    const avg2026Roas = total2026Spend > 0 ? total2026Sales / total2026Spend : 0;
    const avg2026Cpl = total2026Leads > 0 ? total2026Spend / total2026Leads : 0;

    return (
      <div className="space-y-6 pb-12">
        {/* Clean Executive Banner */}
        <div className="bg-gradient-to-r from-[#236B50] via-[#1E5D46] to-[#153F30] text-white rounded-3xl p-6 sm:p-7 shadow-lg shadow-[#236B50]/15 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-emerald-200 text-xs font-bold uppercase tracking-wider">
              <Building className="w-3.5 h-3.5" />
              <span>Crystal Plaza Hotel • General Manager Reports View</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold font-['Plus_Jakarta_Sans'] tracking-tight">
              Executive Financial &amp; YoY Performance Reports
            </h1>
            <p className="text-xs text-emerald-100/90 max-w-2xl">
              Logged in as <strong className="text-white">{currentUser.name}</strong> ({currentUser.title}). Read-only executive reporting across Banquet Sales, Meta Ads ROAS, and Year-over-Year trends.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-full bg-white text-[#236B50] hover:bg-emerald-50 font-black text-xs shadow-md transition-all cursor-pointer self-start md:self-auto shrink-0"
          >
            <FileText className="w-4 h-4" />
            <span>Open Full Printable Reports</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Concise Executive KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-3xl p-5 border border-[#D5E5DE] shadow-xs space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#5A6F66] block">
              2026 YTD Verified Sales ({active2026Rows.length}m)
            </span>
            <div className="text-2xl font-black text-[#192A24] font-mono">
              {formatCurrency(total2026Sales)}
            </div>
            <div className="text-xs font-bold text-[#236B50]">
              {yoySalesGrowthPct !== null
                ? `${yoySalesGrowthPct >= 0 ? '+' : ''}${yoySalesGrowthPct.toFixed(1)}% vs same months 2025`
                : 'Verified actual banquet sales'}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-[#D5E5DE] shadow-xs space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#5A6F66] block">
              2026 YTD Meta Ad Spend &amp; ROAS
            </span>
            <div className="text-2xl font-black text-amber-800 font-mono">
              {formatCurrency(total2026Spend)}
            </div>
            <div className="text-xs font-extrabold text-[#236B50]">
              Blended ROAS: {avg2026Roas.toFixed(2)}x
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-[#D5E5DE] shadow-xs space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#5A6F66] block">
              2026 Verified Leads &amp; Avg CPL
            </span>
            <div className="text-2xl font-black text-[#192A24] font-mono">
              {total2026Leads.toLocaleString()} Leads
            </div>
            <div className="text-xs font-bold text-[#5A6F66]">
              Avg Cost per Lead: AED {avg2026Cpl.toFixed(2)}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-[#D5E5DE] shadow-xs space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#5A6F66] block">
              2025 Full-Year Sales Baseline
            </span>
            <div className="text-2xl font-black text-[#192A24] font-mono">
              {formatCurrency(total2025Full)}
            </div>
            <div className="text-xs font-bold text-[#5A6F66]">
              12-month historical benchmark
            </div>
          </div>
        </div>

        {/* Monthly Banquet Revenue Goal Progress (Read-Only) */}
        <section className="bg-white rounded-3xl p-5 border border-[#E2ECE7] shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5">
              <Target className="w-5 h-5 text-[#236B50]" />
              <div>
                <h2 className="text-sm font-black text-[#192A24]">
                  Monthly Revenue Goal Progress ({currentMonthLabel})
                </h2>
                <p className="text-xs text-[#5A6F66]">
                  Current: <strong>{formatCurrency(currentMonthRevenue)}</strong> of Target <strong>{formatCurrency(monthlyRevenueGoal)}</strong>
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-[#E8F5EE] text-[#236B50] border border-[#C5E5D5]">
              {goalProgressPercent}% Achieved
            </span>
          </div>
          <div className="w-full bg-neutral-100 h-3.5 rounded-full overflow-hidden border border-neutral-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#236B50] to-emerald-500 transition-all duration-700"
              style={{ width: `${Math.min(100, goalProgressPercent)}%` }}
            />
          </div>
        </section>

        {/* Year-to-Year Monthly Comparison Chart */}
        <YearOverYearComparisonChart
          bookings={bookings}
          marketingReports={marketingReports}
          title="Year-to-Year Monthly Performance Comparison"
          subtitle="Read-only executive comparison across every month (Jan–Dec) between FY 2025 and FY 2026."
        />

        {/* Confirmed Bookings vs. Leads Conversion Efficiency Gauge */}
        <BookingsVsLeadsChart
          bookings={bookings}
          marketingReports={marketingReports}
        />

        {/* Clean 12-Month Executive Summary Table (No bulky operational rows) */}
        <section className="bg-white rounded-3xl border border-[#D5E5DE] shadow-xs overflow-hidden">
          <div className="p-5 border-b border-[#E2ECE7] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-[#192A24]">
                Month-by-Month Executive Summary (2025 vs 2026 Actuals)
              </h3>
              <p className="text-xs text-[#5A6F66]">
                Concise read-only comparison of banquet revenue, YoY variance, Meta Ad spend, inquiries, and ROAS.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="px-3.5 py-1.5 rounded-xl bg-[#E8F5EE] hover:bg-[#D5EFE3] text-[#236B50] text-xs font-extrabold cursor-pointer self-start sm:self-auto"
            >
              Print / Export Reports &rarr;
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F8F6] text-[#5A6F66] uppercase text-[10px] font-extrabold border-b border-[#E2ECE7]">
                <tr>
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4 text-right">2025 Sales</th>
                  <th className="py-3 px-4 text-right">2026 Sales</th>
                  <th className="py-3 px-4 text-right">YoY Growth</th>
                  <th className="py-3 px-4 text-right">2026 Ad Spend</th>
                  <th className="py-3 px-4 text-center">2026 Leads</th>
                  <th className="py-3 px-4 text-right">2026 CPL</th>
                  <th className="py-3 px-4 text-center">2026 ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2ECE7]">
                {yoyRows.map(row => (
                  <tr key={row.name} className="hover:bg-[#FAFDFB]">
                    <td className="py-2.5 px-4 font-extrabold text-[#192A24]">{row.name}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-[#5A6F66]">
                      {row.y25.sales > 0 ? formatCurrency(row.y25.sales) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-[#192A24]">
                      {row.y26.hasRecord || row.y26.sales > 0 ? formatCurrency(row.y26.sales) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold">
                      {row.yoyPct !== null ? (
                        <span className={row.yoyPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          {row.yoyPct > 0 ? '+' : ''}
                          {row.yoyPct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-amber-800">
                      {row.y26.spend > 0 ? formatCurrency(row.y26.spend) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-center font-semibold text-[#192A24]">
                      {row.y26.leads > 0 ? row.y26.leads.toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-[#5A6F66]">
                      {row.y26.cpl > 0 ? `AED ${row.y26.cpl.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {row.y26.roas > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                          {row.y26.roas.toFixed(2)}x
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-7 pb-12">
      {/* =====================================================================
          EXECUTIVE BANNER & ROLE RECOGNITION
          ===================================================================== */}
      <div className="bg-gradient-to-r from-[#236B50] via-[#1E5D46] to-[#153F30] text-white rounded-3xl p-6 sm:p-7 shadow-lg shadow-[#236B50]/15 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-emerald-200 text-xs font-bold uppercase tracking-wider">
            <Building className="w-3.5 h-3.5" />
            <span>Crystal Plaza Hotel • Banquet Operations</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold font-['Plus_Jakarta_Sans'] tracking-tight">
            Banquet Hall Bookings & Food Costing Dashboard
          </h1>
          <p className="text-xs text-emerald-100/90 max-w-2xl">
            Logged in as <strong className="text-white">{currentUser.name}</strong> ({currentUser.title}). Live tracking of banquet hall parties, monthly counts, and structured hand-offs.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 self-start md:self-auto shrink-0">
          {currentUser.role === 'marketing_executive' && (
            <button
              onClick={() => onNavigate('marketing')}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/20 transition-all cursor-pointer"
            >
              <Megaphone className="w-4 h-4" />
              <span>Meta Ads Manager</span>
            </button>
          )}

          {currentUser.permissions.canManageBookings && (
            <button
              onClick={onOpenBookingModal}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-full bg-white text-[#236B50] hover:bg-emerald-50 active:scale-98 font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Register Banquet Party</span>
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          MONTHLY BANQUET REVENUE GOAL PROGRESS BAR WIDGET
          Shown strictly to Commercial/Finance roles (Marketing & Accounts)
          ===================================================================== */}
      {(currentUser.role === 'marketing_executive' || currentUser.role === 'accounts_executive') && (
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E2ECE7] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2ECE7]">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-[#E8F5EE] border border-[#C5E5D5] flex items-center justify-center text-[#236B50] font-black shrink-0 shadow-xs">
                <Target className="w-6 h-6 text-[#236B50]" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#236B50] bg-[#E8F5EE] px-2.5 py-0.5 rounded-full border border-[#C5E5D5]">
                    Monthly Revenue Target
                  </span>
                  <span className="text-xs text-[#5A6F66]">
                    {currentMonthLabel} Milestone
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-[#192A24] mt-0.5">
                  Current Performance: AED {currentMonthRevenue.toLocaleString()} of AED {monthlyRevenueGoal.toLocaleString()}
                </h2>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <span className={`px-3 py-1 rounded-full text-xs font-black border ${
                goalProgressPercent >= 100
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : goalProgressPercent >= 75
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-teal-50 text-teal-900 border-teal-200'
              }`}>
                {goalProgressPercent >= 100 ? '🎉 Goal Exceeded!' : goalProgressPercent >= 75 ? '🔥 On Track' : '📈 Campaign Active'}
              </span>
              <button
                onClick={() => onNavigate('reports')}
                className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-neutral-100 hover:bg-neutral-200 text-[#192A24] transition-colors flex items-center space-x-1 cursor-pointer"
                title="Adjust monthly revenue goal in Reports module"
              >
                <span>Set Goal</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Progress Bar Container */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-[#5A6F66]">
                {goalProgressPercent}% Completed ({formatCurrency(currentMonthRevenue)})
              </span>
              <span className={remainingToGoal === 0 ? 'text-[#236B50] font-black' : 'text-amber-700 font-extrabold'}>
                {remainingToGoal === 0 
                  ? `Target Met! +AED ${(currentMonthRevenue - monthlyRevenueGoal).toLocaleString()} Surplus` 
                  : `AED ${remainingToGoal.toLocaleString()} remaining to hit goal`}
              </span>
            </div>

            <div className="w-full bg-neutral-100 h-5 rounded-full overflow-hidden p-0.5 border border-neutral-200 shadow-inner relative">
              <div 
                className={`h-full rounded-full transition-all duration-700 shadow-xs flex items-center justify-end pr-2 text-[10px] font-black text-white ${
                  goalProgressPercent >= 100
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-[#194D38]'
                    : goalProgressPercent >= 75
                    ? 'bg-gradient-to-r from-teal-500 to-[#236B50]'
                    : 'bg-gradient-to-r from-amber-500 to-emerald-600'
                }`}
                style={{ width: `${Math.min(100, goalProgressPercent)}%` }}
              >
                {goalProgressPercent > 12 && `${goalProgressPercent}%`}
              </div>
            </div>

            {/* Target Milestones */}
            <div className="flex justify-between items-center text-[10px] text-neutral-400 font-bold px-1">
              <span>0 AED</span>
              <span>25% (AED {(monthlyRevenueGoal * 0.25).toLocaleString()})</span>
              <span>50% (AED {(monthlyRevenueGoal * 0.5).toLocaleString()})</span>
              <span>75% (AED {(monthlyRevenueGoal * 0.75).toLocaleString()})</span>
              <span className="text-[#236B50] font-extrabold">Goal: AED {monthlyRevenueGoal.toLocaleString()}</span>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          SUPERVISOR (FRANCIS) PARTY CONCLUSION PROMPT BANNER
          User request: "and for francis after the party date he should get notification that the party is ended u want to confirm?"
          ===================================================================== */}
      {(currentUser.role === 'fnb_supervisor' || currentUser.role === 'banquet_manager') && unconfirmedEndedParties.length > 0 && (
        <section className="bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-teal-500/15 border-2 border-amber-400 rounded-3xl p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-300/60">
            <div className="flex items-start sm:items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-amber-950">
                    Party Date Ended — Action Required
                  </span>
                  <span className="text-xs text-amber-900 font-semibold">
                    Francis F&B Confirmation Prompt
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-[#192A24] mt-0.5">
                  The party date has passed. Do you want to confirm the party has ended?
                </h2>
                <p className="text-xs text-[#3D5A4E]">
                  Confirming will immediately transition the banquet into Chef Karim's <strong>Costing Required</strong> tab for kitchen ingredient entry.
                </p>
              </div>
            </div>
            <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 shrink-0 self-start sm:self-auto">
              {unconfirmedEndedParties.length} Party Awaiting Confirmation
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {unconfirmedEndedParties.map(party => (
              <div 
                key={party.id}
                className="bg-white rounded-2xl p-4 border border-amber-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-sm text-[#192A24]">{party.clientName}</span>
                    <span className="font-mono text-xs text-[#5A6F66]">({party.bookingNumber})</span>
                  </div>
                  <div className="text-xs text-[#5A6F66]">
                    Event Date: <strong className="text-amber-800">{party.eventDate}</strong> • {party.guestCount} Guests • {party.hallName}
                  </div>
                  <div className="text-[11px] text-[#236B50] font-semibold">
                    {party.selectedMenuName || (party.hasFoodFromHotel ? 'Buffet Package' : 'Hall Only')}
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {onConfirmPartyEnded && (
                    <button
                      type="button"
                      onClick={() => onConfirmPartyEnded(party.id)}
                      className="px-4 py-2.5 rounded-xl bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white font-black text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Party Ended</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =====================================================================
          MANDATORY BALANCE SETTLEMENT BANNER FOR FRANCIS (F&B SUPERVISOR)
          User request: "make sure to send notification for francis after the party ends he have to settle balance that is must"
          ===================================================================== */}
      {(currentUser.role === 'fnb_supervisor' || currentUser.role === 'banquet_manager') && endedPartiesNeedingBalanceSettlement.length > 0 && (
        <section className="bg-gradient-to-r from-rose-500/15 via-red-500/10 to-amber-500/15 border-2 border-rose-500 rounded-3xl p-5 sm:p-6 shadow-md space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rose-300">
            <div className="flex items-start sm:items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <CreditCard className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs">
                    ⚠️ Mandatory Action Required
                  </span>
                  <span className="text-xs text-rose-900 font-bold">
                    Francis Balance Settlement Must-Do
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-rose-950 mt-0.5">
                  Concluded Parties Awaiting Final Balance Settlement
                </h2>
                <p className="text-xs text-rose-900 font-medium">
                  The party has ended. Francis <strong>must</strong> collect and settle the outstanding client balance before financial close-out.
                </p>
              </div>
            </div>
            <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-rose-100 text-rose-900 border border-rose-300 shrink-0 self-start sm:self-auto">
              {endedPartiesNeedingBalanceSettlement.length} Pending Settlement{endedPartiesNeedingBalanceSettlement.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {endedPartiesNeedingBalanceSettlement.map(party => {
              const summary = getBookingPaymentSummary(party);
              const totalPaid = summary.totalPaid;
              const grandTotal = summary.totalBill;
              const balance = summary.balanceToPay;

              return (
                <div 
                  key={party.id}
                  className="bg-white rounded-2xl p-4 border-2 border-rose-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-rose-400 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-sm text-[#192A24]">{party.clientName}</span>
                      <span className="font-mono text-xs text-[#5A6F66]">({party.bookingNumber})</span>
                    </div>
                    <div className="text-xs text-[#5A6F66]">
                      Ended Date: <strong className="text-[#192A24]">{party.eventDate}</strong> • {party.guestCount} Guests • {party.hallName}
                    </div>
                    <div className="flex items-center space-x-3 text-xs pt-1 flex-wrap gap-y-1">
                      <span className="text-slate-600">Total: <strong>AED {grandTotal.toLocaleString()}</strong></span>
                      <span className="text-emerald-700">Paid: <strong>AED {totalPaid.toLocaleString()}</strong></span>
                      <span className="text-rose-700 font-extrabold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                        Balance to Settle: AED {balance.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (onSettleCashBalance) {
                          onSettleCashBalance(party);
                        } else {
                          setQuickCashModalBooking(party);
                        }
                      }}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Banknote className="w-4 h-4 stroke-[2.2]" />
                      <span>Settle by Cash (Must)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* =====================================================================
          EXECUTIVE CHEF (KARIM) PRIORITY QUEUE: TOP-OF-DASHBOARD COSTING ACTION
          ===================================================================== */}
      {currentUser.role === 'executive_chef' && chefPendingEndedParties.length > 0 && (
        <section className="bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/10 border-2 border-amber-400 rounded-3xl p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-300">
            <div className="flex items-start sm:items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ChefHat className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-amber-950 animate-pulse">
                    Chef Costing Required
                  </span>
                  <span className="text-xs text-amber-900 font-semibold">
                    Concluded Parties Forwarded by Francis
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-[#192A24] mt-0.5">
                  {chefPendingEndedParties.length} Concluded Banquet{chefPendingEndedParties.length > 1 ? 's' : ''} Awaiting Kitchen Ingredient Quantities
                </h2>
                <p className="text-xs text-[#3D5A4E]">
                  Francis has confirmed these parties have ended. Log the actual bulk ingredients used (cartons, kg, liters) and stamp to forward to Accounts.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChefUsageModal(chefPendingEndedParties[0])}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-amber-950 font-black text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto"
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Log Quantities ({chefPendingEndedParties[0].clientName})</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {chefPendingEndedParties.map(party => (
              <div 
                key={party.id}
                className="bg-white rounded-2xl p-4 border border-amber-200 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#192A24]">{party.clientName}</span>
                    <span className="font-mono text-[11px] text-[#5A6F66]">{party.bookingNumber}</span>
                  </div>
                  <div className="text-xs text-[#5A6F66]">
                    Date: {party.eventDate} • {party.guestCount} Guests • {party.hallName}
                  </div>
                  <div className="text-[11px] text-amber-800 font-bold bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                    Confirmed ended by {party.partyEndedConfirmedBy || "Francis"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChefUsageModal(party)}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-black rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Log Actual Quantities & Stamp
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =====================================================================
          ACCOUNTS EXECUTIVE PRIORITY QUEUE: TOP-OF-DASHBOARD COSTING ACTION
          Explicit user request: "and for accounts whenevver there a costing that he had to do it should be on notification and on top of his dashboard"
          ===================================================================== */}
      {currentUser.role === 'accounts_executive' && (
        arunFifoQueue.length > 0 ? (
          <section className="bg-gradient-to-r from-purple-900 via-indigo-950 to-[#2A164D] text-white rounded-3xl p-6 sm:p-7 shadow-xl border-2 border-purple-400/40 relative overflow-hidden space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/15">
              <div className="flex items-start sm:items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/30">
                  <Calculator className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-amber-950 animate-pulse">
                      Urgent Action Required
                    </span>
                    <span className="text-xs text-purple-200 font-medium">
                      🔔 Notification active in alert tray
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-white mt-1">
                    {arunFifoQueue.length} Banquet Costing{arunFifoQueue.length > 1 ? 's' : ''} Awaiting Purchase Price Entry
                  </h2>
                  <p className="text-xs text-purple-200/90 mt-0.5">
                    Executive Chef Karim has submitted ingredient usage quantities. Complete costing to finalize food cost % and post journal entries to the GL.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 self-start md:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenChefUsageModal(arunFifoQueue[0])}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs transition-all shadow-md flex items-center space-x-2 cursor-pointer active:scale-98"
                >
                  <Calculator className="w-4 h-4" />
                  <span>Cost Next in Queue (FIFO #1: {arunFifoQueue[0].clientName})</span>
                </button>
              </div>
            </div>

            {/* List of pending banquet vouchers */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {arunFifoQueue.map((party, idx) => (
                <div 
                  key={party.id} 
                  className="bg-white/10 hover:bg-white/15 transition-all backdrop-blur-md rounded-2xl p-4 border border-white/15 flex flex-col justify-between space-y-3.5"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-purple-400/30 text-purple-200 text-[10px] font-bold">
                        FIFO Queue #{idx + 1}
                      </span>
                      <span className="font-mono text-[11px] text-purple-200 font-semibold">
                        {party.bookingNumber}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-sm sm:text-base leading-snug">
                      {party.clientName}
                    </h3>

                    <div className="text-xs text-purple-200/80 space-y-0.5">
                      <p>{party.eventType} • {party.guestCount} Guests</p>
                      <p className="text-[11px] text-purple-300/80">Date: {party.eventDate} • {halls.find(h => h.id === party.hallId)?.name || 'Banquet Hall'}</p>
                    </div>

                    <div className="text-[11px] text-amber-200 bg-amber-950/40 p-2 rounded-xl border border-amber-500/30 flex items-center space-x-2">
                      <ChefHat className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        Chef Karim quantities logged ({party.chefPartyEntries?.length || 'Menu'} items). Awaiting purchase prices.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenChefUsageModal(party)}
                    className="w-full py-2.5 rounded-xl bg-white hover:bg-purple-50 text-purple-950 font-extrabold text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-sm active:scale-98"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Apply Purchase Prices & Finish</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-xs flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#192A24] text-sm">Accounts Costing Queue: All Caught Up!</h3>
                <p className="text-xs text-[#5A6F66]">Zero pending kitchen vouchers awaiting purchasing prices. All concluded banquets are fully costed and reconciled.</p>
              </div>
            </div>
            <span className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
              0 Pending Costings
            </span>
          </div>
        )
      )}

      {/* MARKETING EXECUTIVE (BETSELOT) & GM: META ADS & ROAS ACQUISITION KPI STRIP */}
      {currentUser.role === 'marketing_executive' && (
        <div className="bg-gradient-to-r from-emerald-950 via-[#1B4B38] to-[#123627] text-white rounded-3xl p-5 sm:p-6 border border-emerald-800/40 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/10 gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center text-emerald-300">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-sm tracking-tight text-white">
                    Meta Ads Acquisition & Banquet ROAS Overview
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-400 text-emerald-950 uppercase">
                    Betselot Portal
                  </span>
                </div>
                <p className="text-xs text-emerald-200/80">
                  {currentMonthLabel} performance: Facebook &amp; Instagram Ads vs. Banquet Parties Income
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => onNavigate('marketing')}
                className="px-3.5 py-1.5 rounded-xl bg-white text-[#236B50] hover:bg-emerald-50 text-xs font-black transition-colors cursor-pointer flex items-center space-x-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Insert Meta Data</span>
              </button>
              <button
                onClick={() => onNavigate('marketing_kpi')}
                className="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 border border-white/20"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Inquiries Pipeline</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
            <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider block">
                {currentMonthShort} Ad Spend
              </span>
              <div className="text-base sm:text-lg font-black text-white mt-1">
                {formatCurrency(octMetaSpend)}
              </div>
              <div className="text-[10px] text-emerald-200/70">Meta (FB + IG)</div>
            </div>

            <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider block">
                Banquet Revenue
              </span>
              <div className="text-base sm:text-lg font-black text-emerald-300 mt-1">
                {formatCurrency(totalMonthlyRevenue)}
              </div>
              <div className="text-[10px] text-emerald-200/70">{currentMonthBanquetCount} Parties</div>
            </div>

            <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider block">
                ROAS Multiplier
              </span>
              <div className="text-base sm:text-lg font-black text-amber-300 mt-1">
                {octRoas.toFixed(2)}x
              </div>
              <div className="text-[10px] text-emerald-200/70">AED {(octRoas).toFixed(1)} rev / AED 1 spend</div>
            </div>

            <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider block">
                CPR (Cost / Lead)
              </span>
              <div className="text-base sm:text-lg font-black text-white mt-1">
                AED {octCpr.toFixed(2)}
              </div>
              <div className="text-[10px] text-emerald-200/70">Meta result cost</div>
            </div>

            <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider block">
                Leads Generated
              </span>
              <div className="text-base sm:text-lg font-black text-white mt-1">
                {octLeads}
              </div>
              <div className="text-[10px] text-emerald-200/70">Inquiries received</div>
            </div>

            <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider block">
                Conversion Rate
              </span>
              <div className="text-base sm:text-lg font-black text-cyan-300 mt-1">
                {octConversionRate.toFixed(1)}%
              </div>
              <div className="text-[10px] text-emerald-200/70">Leads → Bookings</div>
            </div>
          </div>
        </div>
      )}

      {/* MARKETING EXECUTIVE (BETSELOT ONLY): 3-MONTH ROLLING REVENUE FORECAST WIDGET */}
      {currentUser.role === 'marketing_executive' && (
        <MarketingRollingForecastWidget
          bookings={bookings}
          todayStr={todayStr}
          onNavigate={onNavigate}
        />
      )}

      {/* MARKETING & MANAGEMENT ROLES: CONFIRMED BOOKINGS VS. LEADS & CONVERSION EFFICIENCY GAUGE */}
      {(currentUser.role === 'marketing_executive' ||
        currentUser.role === 'banquet_manager' ||
        currentUser.role === 'accounts_executive') && (
        <BookingsVsLeadsChart
          bookings={bookings}
          marketingReports={marketingReports}
        />
      )}

      {/* =====================================================================
          EXECUTIVE METRIC TILES: CLASSIFIED & CLEAN (NO BULK WORDS)
          ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        {currentUser.permissions.canViewProfits && currentUser.permissions.canViewRevenue ? (
          <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-[#236B50]/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5A6F66]">
                Net Profit ({currentMonthShort})
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#236B50] flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#236B50] font-['Plus_Jakarta_Sans']">
                +{formatCurrency(totalMonthlyProfit)}
              </div>
              <div className="text-[11px] text-[#5A6F66] mt-1 flex items-center space-x-1.5">
                <span>Billed: {formatCurrency(totalMonthlyRevenue)}</span>
                <span>·</span>
                <span>Cost: {formatCurrency(totalMonthlyCosts)}</span>
              </div>
            </div>
          </div>
        ) : currentUser.permissions.canViewRevenue ? (
          <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-[#236B50]/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5A6F66]">
                Total Billed ({currentMonthShort})
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#236B50] flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#192A24] font-['Plus_Jakarta_Sans']">
                {formatCurrency(totalMonthlyRevenue)}
              </div>
              <div className="text-[11px] text-[#5A6F66] mt-1">
                Client banquet billing · {currentMonthBanquetCount} Events
              </div>
            </div>
          </div>
        ) : currentUser.permissions.canViewCosting ? (
          <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-[#236B50]/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Kitchen Food Cost ({currentMonthShort})
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <ChefHat className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-800 font-['Plus_Jakarta_Sans'] font-mono">
                {formatCurrency(totalMonthlyCosts)}
              </div>
              <div className="text-[11px] text-[#5A6F66] mt-1">
                Direct ingredient and provisioning expense
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-[#236B50]/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5A6F66]">
                Total Bookings ({currentMonthShort})
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#192A24] font-['Plus_Jakarta_Sans']">
                {currentMonthBanquetCount} <span className="text-base font-bold text-[#5A6F66]">Banquets</span>
              </div>
              <div className="text-[11px] text-[#5A6F66] mt-1">
                Scheduled in Crystal Plaza &amp; Casmia
              </div>
            </div>
          </div>
        )}

        {/* Metric 2: Monthly Banquet Count / Operational Queue */}
        <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-[#236B50]/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5A6F66]">
              {currentUser.role === 'executive_chef' ? `Kitchen Queue (${currentMonthShort})` : `Parties (${currentMonthShort})`}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#192A24] font-['Plus_Jakarta_Sans']">
              {currentMonthBanquetCount} <span className="text-base font-bold text-[#5A6F66]">Events</span>
            </div>
            <div className="text-[11px] text-[#5A6F66] mt-1 flex items-center space-x-1.5">
              <span className="text-emerald-700 font-semibold">{currentMonthBookings.filter(b => b.eventDate < todayStr || b.status === 'completed').length} Finished</span>
              <span>·</span>
              <span className="text-blue-700 font-semibold">{currentMonthBookings.filter(b => b.eventDate >= todayStr && b.status !== 'completed').length} Upcoming</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Average Margin for Accounts/GM or Cost/Guest for Chef or Upcoming for Supervisor */}
        {currentUser.permissions.canViewRevenue && currentUser.permissions.canViewCosting ? (
          <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-[#236B50]/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5A6F66]">
                Profit Margin %
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#236B50] font-['Plus_Jakarta_Sans']">
                {formatPercent(averageProfitMarginPercent)}
              </div>
              <div className="text-[11px] text-[#5A6F66] mt-1">
                Target Margin: &gt; 55% per banquet
              </div>
            </div>
          </div>
        ) : currentUser.permissions.canViewCosting ? (
          <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-[#236B50]/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Avg Food Cost / Guest
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-800 font-['Plus_Jakarta_Sans'] font-mono">
                {formatCurrency(totalMonthlyGuests > 0 ? totalMonthlyCosts / totalMonthlyGuests : 0)}
              </div>
              <div className="text-[11px] text-[#5A6F66] mt-1">
                Average per-portion ingredient expense
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-[#236B50]/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Upcoming Banquets
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-800 font-['Plus_Jakarta_Sans']">
                {currentMonthBookings.filter(b => b.eventDate >= todayStr && b.status !== 'completed').length} <span className="text-base font-bold text-[#5A6F66]">To Be Held</span>
              </div>
              <div className="text-[11px] text-[#5A6F66] mt-1">
                Dates confirmed & reserved
              </div>
            </div>
          </div>
        )}

        {/* Metric 4: Guests Attending MTD */}
        <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-[#236B50]/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5A6F66]">
              {currentUser.role === 'executive_chef' ? `Guests to Feed (${currentMonthShort})` : `Guests Catered (${currentMonthShort})`}
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#192A24] font-['Plus_Jakarta_Sans']">
              {totalMonthlyGuests} <span className="text-base font-bold text-[#5A6F66]">Guests</span>
            </div>
            <div className="text-[11px] text-[#5A6F66] mt-1">
              Across Crystal Plaza Ballrooms
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          RECENT COSTING ALERTS CARD: FOOD COST VARIANCE > 10%
          Requires immediate attention from Chef Karim (Kitchen) or Arun Kumar (Accounts)
          ===================================================================== */}
      {currentUser.permissions.canViewCosting && (
        costingAlertParties.length > 0 ? (
          <section className="bg-gradient-to-br from-rose-50/70 via-white to-amber-50/40 border border-rose-200/90 rounded-3xl p-6 shadow-sm space-y-5">
          {/* Card Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rose-100">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shadow-xs shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2 text-rose-700 text-xs font-extrabold uppercase tracking-wider">
                  <span>F&B Cost Control Alert</span>
                  <span>•</span>
                  <span>Immediate Attention Required</span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-[#192A24] mt-0.5 flex items-center space-x-2">
                  <span>Recent Costing Alerts</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                    Food Variance &gt; 10%
                  </span>
                </h2>
                <p className="text-xs text-[#5A6F66] mt-0.5">
                  Parties where kitchen ingredient expenditure exceeded theoretical target food cost by more than 10%. Requires immediate costing audit and sign-off by Chef Karim or Arun Kumar.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
              <span className="text-xs font-extrabold px-3 py-1.5 rounded-full bg-rose-600 text-white shadow-xs">
                {costingAlertParties.length} {costingAlertParties.length === 1 ? 'Party Overrun' : 'Parties Overrun'}
              </span>
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                +AED {totalCostingVarianceAed.toFixed(2)} Total Excess
              </span>
            </div>
          </div>

          {/* Alert Parties Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {costingAlertParties.map(alert => {
              const isChefApproved = alert.booking.chefApproved;
              const isArunCosted = alert.booking.costingStatus === 'costed_by_arun' || alert.booking.arunApproved;

              return (
                <div
                  key={alert.booking.id}
                  className="p-5 rounded-2xl bg-white border border-rose-200 hover:border-rose-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative"
                >
                  {/* Top row: Client & Event Meta */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold text-[#5A6F66]">
                        {alert.booking.bookingNumber}
                      </span>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                        +{alert.variancePercent}% Over Target
                      </span>
                    </div>

                    <h4 className="text-sm font-extrabold text-[#192A24] truncate">
                      {alert.booking.clientName}
                    </h4>

                    <div className="flex items-center space-x-2 text-xs text-[#5A6F66]">
                      <span className="font-semibold text-[#192A24]">{alert.booking.eventDate}</span>
                      <span>•</span>
                      <span>{alert.booking.guestCount} Guests</span>
                      <span>•</span>
                      <span className="text-[#236B50] font-medium truncate">{alert.booking.hallName.replace('Crystal Plaza ', '')}</span>
                    </div>
                  </div>

                  {/* Financial Variance Strip */}
                  <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 text-xs space-y-1.5">
                    <div className="flex justify-between items-center text-[#5A6F66]">
                      <span>Target Food Cost:</span>
                      <span className="font-mono">{formatCurrency(alert.targetFoodCost)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-rose-800 font-bold">Actual Kitchen Cost:</span>
                      <strong className="text-rose-700 font-mono font-extrabold">{formatCurrency(alert.actualFoodCost)}</strong>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-rose-200/60 font-bold">
                      <span className="text-rose-700">Cost Variance:</span>
                      <span className="text-rose-700 font-mono">+{formatCurrency(alert.varianceAed)} (+{alert.variancePercent}%)</span>
                    </div>
                  </div>

                  {/* Kitchen Context Reason */}
                  <div className="text-[11px] text-[#5A6F66] bg-[#FAFDFB] p-2.5 rounded-xl border border-[#E2ECE7] flex items-start space-x-2">
                    <ChefHat className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="line-clamp-2">
                      <strong className="text-[#192A24]">Kitchen Reason: </strong>
                      {alert.reason}
                    </div>
                  </div>

                  {/* Status & Action Buttons */}
                  <div className="pt-2 border-t border-[#E2ECE7] flex items-center justify-between gap-2">
                    <div className="text-[10px]">
                      {isArunCosted ? (
                        <span className="text-emerald-700 font-bold flex items-center space-x-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>Costed by Accounts</span>
                        </span>
                      ) : isChefApproved ? (
                        <span className="text-blue-700 font-bold flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Awaiting Arun Costing</span>
                        </span>
                      ) : (
                        <span className="text-amber-700 font-bold flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Pending Chef Karim</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => onOpenChefUsageModal(alert.booking)}
                        className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-[11px] transition-colors cursor-pointer flex items-center space-x-1 shadow-2xs"
                        title="Inspect Kitchen Usage & Ingredients"
                      >
                        <ChefHat className="w-3 h-3" />
                        <span>Review Kitchen</span>
                      </button>
                      <button
                        onClick={() => setSelectedPostingReportBooking(alert.booking)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#236B50] hover:bg-[#1B5540] text-white font-bold text-[11px] transition-colors cursor-pointer flex items-center space-x-1 shadow-2xs"
                        title="Open Posting Report"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Posting Report</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-[#192A24] text-sm">Recent Costing Alerts: Kitchen Budgets Normal</h3>
              <p className="text-xs text-[#5A6F66]">All banquet parties are operating strictly within the ±10% target food cost tolerance.</p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            0 Variances &gt;10%
          </span>
        </div>
        )
      )}

      {/* =====================================================================
          FEATURED SECTION: MONTHLY PARTY COUNTS & VOLUME CLASSIFICATION
          Explicit user request: "In September, how many parties? In October, how many parties? Like this."
          ===================================================================== */}
      <section className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2ECE7]">
          <div>
            <div className="flex items-center space-x-2 text-[#236B50] text-xs font-extrabold uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5" />
              <span>Monthly Party Volume & History</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#192A24] mt-0.5">
              Banquet Parties Count by Month
            </h2>
            <p className="text-xs text-[#5A6F66]">
              Detailed breakdown of how many banquet parties were held in September, October, and other months. Click any month card to view its exact events.
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <button
              onClick={() => setSelectedMonthFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedMonthFilter === 'all'
                  ? 'bg-[#236B50] text-white shadow-xs'
                  : 'bg-[#F2F7F5] text-[#486356] hover:bg-[#E5EFEA]'
              }`}
            >
              All Months ({bookings.length} Total)
            </button>
          </div>
        </div>

        {/* Month by Month Classification Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {monthlySummaries.map(summary => {
            const isSelected = selectedMonthFilter === summary.monthKey;
            const isCurrentMonth = summary.monthKey === currentMonthStr;

            return (
              <div
                key={summary.monthKey}
                onClick={() => setSelectedMonthFilter(isSelected ? 'all' : summary.monthKey)}
                className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 relative overflow-hidden ${
                  isSelected
                    ? 'bg-[#EBF5F0] border-[#236B50] ring-2 ring-[#236B50]/20 shadow-md'
                    : isCurrentMonth
                    ? 'bg-white border-[#B8DFC9] hover:border-[#236B50]/50 hover:shadow-sm'
                    : 'bg-[#FAFDFB] border-[#E2ECE7] hover:border-[#CADBD2] hover:bg-white'
                }`}
              >
                {isCurrentMonth && (
                  <span className="absolute top-3 right-3 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#236B50] text-white">
                    Current Month
                  </span>
                )}

                <div>
                  <div className="text-xs font-bold text-[#5A6F66] uppercase tracking-wide">
                    {summary.monthLabel}
                  </div>
                  
                  {/* Big clear party count */}
                  <div className="mt-1 flex items-baseline space-x-1.5">
                    <span className="text-3xl font-extrabold text-[#192A24] font-['Plus_Jakarta_Sans']">
                      {summary.totalParties}
                    </span>
                    <span className="text-sm font-bold text-[#5A6F66]">
                      {summary.totalParties === 1 ? 'Party' : 'Parties'}
                    </span>
                  </div>
                </div>

                {/* Sub-breakdown: Finished vs Booked */}
                <div className="pt-2 border-t border-[#E2ECE7] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[#3D5A4E]">
                    <span className="flex items-center space-x-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Finished Parties:</span>
                    </span>
                    <strong className="text-[#192A24] font-bold">{summary.finishedParties}</strong>
                  </div>

                  <div className="flex items-center justify-between text-[#3D5A4E]">
                    <span className="flex items-center space-x-1">
                      <Clock4 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Upcoming Booked:</span>
                    </span>
                    <strong className="text-[#192A24] font-bold">{summary.upcomingParties}</strong>
                  </div>

                  <div className="flex items-center justify-between text-[#5A6F66] text-[11px] pt-1">
                    <span>{summary.totalGuests} Guests</span>
                    {currentUser.permissions.canViewRevenue ? (
                      <span className="font-semibold text-[#236B50]">{formatCurrency(summary.totalRevenue)}</span>
                    ) : (
                      <span className="font-semibold text-[#236B50]">{summary.totalParties} Events</span>
                    )}
                  </div>
                </div>

                <div className={`text-[11px] font-bold flex items-center justify-between pt-1 ${
                  isSelected ? 'text-[#236B50]' : 'text-[#5A6F66]'
                }`}>
                  <span>{isSelected ? '✓ Filter Active' : 'Click to inspect'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          YEARLY & MONTHLY BANQUET PERFORMANCE ANALYSIS
          Added for: General Manager (GM), Accounts, and Marketing roles
          Replaces the former Operational Hand-offs card as requested.
          ===================================================================== */}
      {canViewBanquetAnalysis && (
        <section className="bg-white border border-[#E2ECE7] rounded-3xl p-6 sm:p-7 shadow-xs space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E2ECE7]">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-[#236B50] text-xs font-extrabold uppercase tracking-wider">
                <TrendingUp className="w-4 h-4" />
                <span>Executive Operations & Commercial Analysis</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#192A24] tracking-tight">
                Banquet Yearly & Monthly Analysis
              </h2>
              <p className="text-xs text-[#5A6F66]">
                Multi-year revenue, food costing variance, and guest volume analytics tailored for GM, Accounts, and Marketing.
              </p>
            </div>

            {/* Controls: Monthly vs Yearly & Year Selector */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Year Selector */}
              <div className="flex items-center bg-[#F2F7F5] rounded-xl p-1 border border-[#DCE8E2]">
                <button
                  type="button"
                  onClick={() => setSelectedAnalysisYear('2026')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    selectedAnalysisYear === '2026'
                      ? 'bg-[#236B50] text-white shadow-xs'
                      : 'text-[#486356] hover:text-[#192A24]'
                  }`}
                >
                  Year 2026
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAnalysisYear('2025')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    selectedAnalysisYear === '2025'
                      ? 'bg-[#236B50] text-white shadow-xs'
                      : 'text-[#486356] hover:text-[#192A24]'
                  }`}
                >
                  Year 2025
                </button>
              </div>

              {/* Monthly vs Yearly Period Toggle */}
              <div className="flex items-center bg-[#F2F7F5] rounded-xl p-1 border border-[#DCE8E2]">
                <button
                  type="button"
                  onClick={() => setAnalysisPeriod('monthly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    analysisPeriod === 'monthly'
                      ? 'bg-[#192A24] text-white shadow-xs'
                      : 'text-[#486356] hover:text-[#192A24]'
                  }`}
                >
                  Monthly View
                </button>
                <button
                  type="button"
                  onClick={() => setAnalysisPeriod('yearly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    analysisPeriod === 'yearly'
                      ? 'bg-[#192A24] text-white shadow-xs'
                      : 'text-[#486356] hover:text-[#192A24]'
                  }`}
                >
                  Year Overview
                </button>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#EBF3EF] border border-[#C5E5D5] text-[#236B50] font-bold text-xs transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Full Reports</span>
              </button>
            </div>
          </div>

          {/* Role-Specific Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {effectivePerspective === 'gm' && (
              <>
                <div className="p-4 rounded-2xl bg-[#F6FAF8] border border-[#D5E5DE] space-y-1">
                  <span className="text-[11px] font-bold text-[#486356] uppercase tracking-wide">Total Banquet Revenue ({selectedAnalysisYear})</span>
                  <div className="text-2xl font-black text-[#192A24] font-['Plus_Jakarta_Sans']">
                    {formatCurrency(banquetYearlyMonthlyStats.yearSummary.totalRevenue)}
                  </div>
                  <p className="text-[11px] text-[#5A6F66]">
                    Across {banquetYearlyMonthlyStats.yearSummary.totalParties} banquet bookings
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F6FAF8] border border-[#D5E5DE] space-y-1">
                  <span className="text-[11px] font-bold text-[#486356] uppercase tracking-wide">Parties & Guest Volume</span>
                  <div className="text-2xl font-black text-[#192A24] font-['Plus_Jakarta_Sans']">
                    {banquetYearlyMonthlyStats.yearSummary.totalParties} <span className="text-sm font-semibold text-[#5A6F66]">Parties</span>
                  </div>
                  <p className="text-[11px] text-[#5A6F66]">
                    {banquetYearlyMonthlyStats.yearSummary.totalGuests.toLocaleString()} total guests hosted
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F6FAF8] border border-[#D5E5DE] space-y-1">
                  <span className="text-[11px] font-bold text-[#486356] uppercase tracking-wide">Average Spend & Value</span>
                  <div className="text-2xl font-black text-[#192A24] font-['Plus_Jakarta_Sans']">
                    {formatCurrency(banquetYearlyMonthlyStats.yearSummary.avgSpendPerGuest)} <span className="text-xs font-normal text-[#5A6F66]">/guest</span>
                  </div>
                  <p className="text-[11px] text-[#5A6F66]">
                    {formatCurrency(banquetYearlyMonthlyStats.yearSummary.avgRevenuePerParty)} avg per banquet party
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F6FAF8] border border-[#D5E5DE] space-y-1">
                  <span className="text-[11px] font-bold text-[#486356] uppercase tracking-wide">Gross Margin & Profit</span>
                  <div className="text-2xl font-black text-[#236B50] font-['Plus_Jakarta_Sans']">
                    {formatPercent(banquetYearlyMonthlyStats.yearSummary.grossMarginPercent)}
                  </div>
                  <p className="text-[11px] text-[#5A6F66]">
                    {formatCurrency(banquetYearlyMonthlyStats.yearSummary.grossProfit)} net gross profit
                  </p>
                </div>
              </>
            )}

            {effectivePerspective === 'accounts' && (
              <>
                <div className="p-4 rounded-2xl bg-[#FAF8FD] border border-[#E8E0F2] space-y-1">
                  <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wide">Billed vs Direct Costs</span>
                  <div className="text-2xl font-black text-[#192A24] font-['Plus_Jakarta_Sans']">
                    {formatCurrency(banquetYearlyMonthlyStats.yearSummary.totalRevenue)}
                  </div>
                  <p className="text-[11px] text-[#5A6F66]">
                    Total Direct Costs: {formatCurrency(banquetYearlyMonthlyStats.yearSummary.totalDirectCosts)}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#FAF8FD] border border-[#E8E0F2] space-y-1">
                  <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wide">Actual Food Cost %</span>
                  <div className={`text-2xl font-black font-['Plus_Jakarta_Sans'] ${
                    banquetYearlyMonthlyStats.yearSummary.foodCostPercent <= 28 ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {formatPercent(banquetYearlyMonthlyStats.yearSummary.foodCostPercent)}
                  </div>
                  <p className="text-[11px] text-[#5A6F66]">
                    Target benchmark &le; 28.0% • Total: {formatCurrency(banquetYearlyMonthlyStats.yearSummary.foodCostActual)}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#FAF8FD] border border-[#E8E0F2] space-y-1">
                  <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wide">Food Cost Variance (AED)</span>
                  <div className={`text-2xl font-black font-['Plus_Jakarta_Sans'] ${
                    banquetYearlyMonthlyStats.yearSummary.foodCostVariance <= 0 ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {banquetYearlyMonthlyStats.yearSummary.foodCostVariance > 0 ? '+' : ''}
                    {formatCurrency(banquetYearlyMonthlyStats.yearSummary.foodCostVariance)}
                  </div>
                  <p className="text-[11px] text-[#5A6F66]">
                    Actual vs theoretical chef recipes target
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#FAF8FD] border border-[#E8E0F2] space-y-1">
                  <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wide">GL Journal Postings</span>
                  <div className="text-2xl font-black text-purple-900 font-['Plus_Jakarta_Sans']">
                    {banquetYearlyMonthlyStats.yearSummary.glPostedCount} <span className="text-xs font-semibold text-[#5A6F66]">Posted</span>
                  </div>
                  <p className="text-[11px] text-[#5A6F66]">
                    {banquetYearlyMonthlyStats.yearSummary.pendingCostingCount} currently in Accounts FIFO queue
                  </p>
                </div>
              </>
            )}

            {effectivePerspective === 'marketing' && (
              <>
                <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200 space-y-1">
                  <span className="text-[11px] font-bold text-teal-900 uppercase tracking-wide">Meta Ad Return (ROAS)</span>
                  <div className="text-2xl font-black text-teal-900 font-['Plus_Jakarta_Sans']">
                    {banquetYearlyMonthlyStats.yearSummary.roas.toFixed(2)}x
                  </div>
                  <p className="text-[11px] text-[#5A6F66]">
                    {formatCurrency(banquetYearlyMonthlyStats.yearSummary.totalRevenue)} revenue from {formatCurrency(banquetYearlyMonthlyStats.yearSummary.adSpend)} spend
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200 space-y-1">
                  <span className="text-[11px] font-bold text-teal-900 uppercase tracking-wide">Acquisition Cost (CAC)</span>
                  <div className="text-2xl font-black text-teal-900 font-['Plus_Jakarta_Sans']">
                    {formatCurrency(banquetYearlyMonthlyStats.yearSummary.cac)}
                  </div>
                  <p className="text-[11px] text-[#5A6F66]">
                    Average cost per booked banquet party
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200 space-y-1">
                  <span className="text-[11px] font-bold text-teal-900 uppercase tracking-wide">Inquiries & Leads</span>
                  <div className="text-2xl font-black text-[#192A24] font-['Plus_Jakarta_Sans']">
                    {banquetYearlyMonthlyStats.yearSummary.leads} <span className="text-xs font-semibold text-[#5A6F66]">Leads</span>
                  </div>
                  <p className="text-[11px] text-[#5A6F66]">
                    {banquetYearlyMonthlyStats.yearSummary.leads > 0 
                      ? ((banquetYearlyMonthlyStats.yearSummary.totalParties / banquetYearlyMonthlyStats.yearSummary.leads) * 100).toFixed(1)
                      : '0'}% lead-to-booking conversion
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200 space-y-1">
                  <span className="text-[11px] font-bold text-teal-900 uppercase tracking-wide">Top Buffet Package</span>
                  <div className="text-lg font-black text-teal-950 truncate mt-1">
                    {Object.entries(banquetYearlyMonthlyStats.yearSummary.packageCounts).sort((a, b) => b[1].count - a[1].count)[0]?.[0] || 'Royal Imperial (100 AED)'}
                  </div>
                  <p className="text-[11px] text-[#5A6F66]">
                    Most requested menu tier by banquet hosts
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Month-by-Month Detailed Table (When Monthly View selected) */}
          {analysisPeriod === 'monthly' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#192A24]">
                  {selectedAnalysisYear} Month-by-Month Banquet Performance Ledger
                </h3>
                <span className="text-xs text-[#5A6F66]">
                  Showing all 12 calendar months • Crystal Plaza Hotel
                </span>
              </div>

              <div className="overflow-x-auto border border-[#E2ECE7] rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAF9] text-[#486356] border-b border-[#E2ECE7] uppercase tracking-wider text-[10px] font-extrabold">
                    <tr>
                      <th className="py-3 px-3.5">Month</th>
                      <th className="py-3 px-3.5 text-center">Parties (Done / Booked)</th>
                      <th className="py-3 px-3.5 text-right">Guests</th>
                      <th className="py-3 px-3.5 text-right">Revenue (AED)</th>
                      <th className="py-3 px-3.5 text-right">Food Cost</th>
                      <th className="py-3 px-3.5 text-center">Food Cost %</th>
                      <th className="py-3 px-3.5 text-right">Gross Profit</th>
                      <th className="py-3 px-3.5 text-center">Margin %</th>
                      {effectivePerspective === 'accounts' && (
                        <th className="py-3 px-3.5 text-center">GL Status</th>
                      )}
                      {effectivePerspective === 'marketing' && (
                        <th className="py-3 px-3.5 text-right">Meta ROAS</th>
                      )}
                      <th className="py-3 px-3.5 text-center">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2ECE7]">
                    {banquetYearlyMonthlyStats.monthsData.map((m) => {
                      const isCurrent = m.monthKey === currentMonthStr;
                      const hasData = m.hasActivity;

                      return (
                        <tr 
                          key={m.monthKey}
                          className={`hover:bg-[#F9FBFA] transition-colors ${
                            isCurrent ? 'bg-[#EBF5F0]/50 font-medium' : !hasData ? 'opacity-60' : ''
                          }`}
                        >
                          <td className="py-3 px-3.5 font-bold text-[#192A24]">
                            <div className="flex items-center space-x-1.5">
                              <span>{m.monthName}</span>
                              {isCurrent && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-[#236B50] text-white rounded">
                                  Current
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3.5 text-center">
                            {hasData ? (
                              <span className="font-extrabold text-[#192A24]">
                                {m.totalParties} <span className="text-[11px] text-[#5A6F66] font-normal">({m.finishedParties} done, {m.bookedParties} sched)</span>
                              </span>
                            ) : (
                              <span className="text-[#8FA59B]">—</span>
                            )}
                          </td>

                          <td className="py-3 px-3.5 text-right text-[#3D5A4E]">
                            {hasData ? m.guests.toLocaleString() : '—'}
                          </td>

                          <td className="py-3 px-3.5 text-right font-bold text-[#192A24]">
                            {hasData ? formatCurrency(m.totalRevenue) : '—'}
                          </td>

                          <td className="py-3 px-3.5 text-right text-[#3D5A4E]">
                            {hasData ? formatCurrency(m.foodCostActual) : '—'}
                          </td>

                          <td className="py-3 px-3.5 text-center">
                            {hasData ? (
                              <span className={`font-bold ${
                                m.foodCostPercent <= 28 ? 'text-emerald-700' : 'text-amber-700'
                              }`}>
                                {formatPercent(m.foodCostPercent)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>

                          <td className="py-3 px-3.5 text-right font-bold text-[#236B50]">
                            {hasData ? formatCurrency(m.grossProfit) : '—'}
                          </td>

                          <td className="py-3 px-3.5 text-center font-bold text-[#3D5A4E]">
                            {hasData ? formatPercent(m.grossMarginPercent) : '—'}
                          </td>

                          {effectivePerspective === 'accounts' && (
                            <td className="py-3 px-3.5 text-center">
                              {hasData ? (
                                <span className="text-[11px] font-semibold text-purple-900">
                                  {m.glPostedCount} posted {m.pendingCostingCount > 0 ? `(${m.pendingCostingCount} pend)` : '✓'}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                          )}

                          {effectivePerspective === 'marketing' && (
                            <td className="py-3 px-3.5 text-right">
                              {hasData && m.roas > 0 ? (
                                <span className="font-bold text-teal-800">{m.roas.toFixed(2)}x</span>
                              ) : (
                                '—'
                              )}
                            </td>
                          )}

                          <td className="py-3 px-3.5 text-center">
                            {hasData ? (
                              <button
                                type="button"
                                onClick={() => setSelectedMonthFilter(m.monthKey)}
                                className="px-2.5 py-1 text-[11px] rounded-lg bg-[#F2F7F5] hover:bg-[#E2ECE7] text-[#236B50] font-bold cursor-pointer transition-colors"
                              >
                                View Events
                              </button>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Year Overview Mode: Annual Package Breakdown & Insights */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
              <div className="p-5 rounded-2xl bg-[#F8FAF9] border border-[#E2ECE7] space-y-4">
                <div className="flex items-center justify-between border-b border-[#E2ECE7] pb-2.5">
                  <h3 className="font-extrabold text-[#192A24] text-sm">
                    {selectedAnalysisYear} Buffet Package Popularity & Revenue Share
                  </h3>
                  <span className="text-xs text-[#5A6F66]">Full Year Total</span>
                </div>

                <div className="space-y-3">
                  {Object.entries(banquetYearlyMonthlyStats.yearSummary.packageCounts).map(([pkgName, data]) => {
                    const percent = banquetYearlyMonthlyStats.yearSummary.totalRevenue > 0
                      ? (data.revenue / banquetYearlyMonthlyStats.yearSummary.totalRevenue) * 100
                      : 0;

                    return (
                      <div key={pkgName} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#192A24]">{pkgName}</span>
                          <span className="text-[#5A6F66]">
                            <strong className="text-[#192A24]">{data.count}</strong> parties ({formatCurrency(data.revenue)})
                          </span>
                        </div>
                        <div className="w-full bg-[#E2ECE7] h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-[#236B50] h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(8, percent))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#F8FAF9] border border-[#E2ECE7] space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-[#E2ECE7] pb-2.5">
                    <h3 className="font-extrabold text-[#192A24] text-sm">
                      {selectedAnalysisYear} Executive Leadership Summary
                    </h3>
                    <span className="text-xs text-[#236B50] font-bold">Crystal Plaza Operations</span>
                  </div>

                  <ul className="mt-3 space-y-2.5 text-xs text-[#3D5A4E]">
                    <li className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-[#236B50] shrink-0 mt-0.5" />
                      <span>
                        <strong>Annual banquet revenue:</strong> {formatCurrency(banquetYearlyMonthlyStats.yearSummary.totalRevenue)} generated across {banquetYearlyMonthlyStats.yearSummary.totalParties} events.
                      </span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-[#236B50] shrink-0 mt-0.5" />
                      <span>
                        <strong>Food Cost Control:</strong> Maintained average food cost of {formatPercent(banquetYearlyMonthlyStats.yearSummary.foodCostPercent)} (Target &le; 28%).
                      </span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-[#236B50] shrink-0 mt-0.5" />
                      <span>
                        <strong>Gross Profit:</strong> Delivered {formatCurrency(banquetYearlyMonthlyStats.yearSummary.grossProfit)} ({formatPercent(banquetYearlyMonthlyStats.yearSummary.grossMarginPercent)} gross margin).
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="pt-3 border-t border-[#E2ECE7] flex items-center justify-between">
                  <span className="text-xs text-[#5A6F66]">Need deep drill-down reporting?</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('reports')}
                    className="px-4 py-2 rounded-xl bg-[#236B50] hover:bg-[#1C5740] text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    Open Banquet Analysis & Reports Tab &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          THE TWO DISTINCT PARTY TABS: BOOKED PARTIES VS FINISHED PARTIES
          Exact user request: "The parties finished parties and booked parties in two different tabs.
          I need that in two different tabs: the parties that are going to be held and the parties that already finished. I need two tabs."
          ===================================================================== */}
      <section className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E2ECE7]">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#192A24]">
              Banquet Events Directory
            </h2>
            <p className="text-xs text-[#5A6F66] mt-0.5">
              Structured and sequenced display of parties categorized into two dedicated tabs.
            </p>
          </div>

          {/* TWO PRIMARY TABS */}
          <div className="flex items-center gap-1.5 p-1 bg-[#F2F7F5] rounded-2xl border border-[#D5E5DE] self-start md:self-auto">
            <button
              onClick={() => setPartyStatusTab('booked')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center space-x-2 ${
                partyStatusTab === 'booked'
                  ? 'bg-[#236B50] text-white shadow-xs'
                  : 'text-[#486356] hover:bg-white/80'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Booked Parties (To Be Held)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                partyStatusTab === 'booked' ? 'bg-white text-[#236B50]' : 'bg-[#D5E5DE] text-[#192A24]'
              }`}>
                {allBookedParties.length}
              </span>
            </button>

            <button
              onClick={() => setPartyStatusTab('finished')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center space-x-2 ${
                partyStatusTab === 'finished'
                  ? 'bg-[#236B50] text-white shadow-xs'
                  : 'text-[#486356] hover:bg-white/80'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Finished Parties (Already Concluded)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                partyStatusTab === 'finished' ? 'bg-white text-[#236B50]' : 'bg-[#D5E5DE] text-[#192A24]'
              }`}>
                {allFinishedParties.length}
              </span>
            </button>
          </div>
        </div>

        {/* Selected Month Filter Notification Banner */}
        {selectedMonthFilter !== 'all' && (
          <div className="p-3 bg-[#EBF5F0] rounded-2xl border border-[#B8DFC9] flex items-center justify-between text-xs text-[#1D6047]">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-[#236B50]" />
              <span>
                Filtering by: <strong>{monthlySummaries.find(m => m.monthKey === selectedMonthFilter)?.monthLabel || selectedMonthFilter}</strong> ({displayedParties.length} parties in this tab)
              </span>
            </div>
            <button
              onClick={() => setSelectedMonthFilter('all')}
              className="text-xs font-extrabold text-[#236B50] underline hover:text-[#184837] cursor-pointer"
            >
              Reset to All Months
            </button>
          </div>
        )}

        {/* List of Parties for the Active Tab */}
        {displayedParties.length === 0 ? (
          <div className="text-center py-12 bg-[#FAFDFB] rounded-2xl border border-dashed border-[#CADBD2] text-[#5A6F66] text-xs">
            No banquet parties found in this category for the selected filter.
          </div>
        ) : (
          <div className="space-y-3">
            {displayedParties.map((party, idx) => {
              const fin = calculateEventFinancials(party);
              const isFinished = partyStatusTab === 'finished';
              const isCostedByArun = party.costingStatus === 'costed_by_arun' || party.postingReportGenerated;

              return (
                <div
                  key={party.id}
                  className="p-4 sm:p-5 rounded-2xl border border-[#E2ECE7] bg-[#FAFDFB] hover:bg-white hover:border-[#CADBD2] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono text-[#5A6F66] font-semibold">
                        {party.bookingNumber}
                      </span>
                      <span>·</span>
                      <span className="font-extrabold text-[#192A24]">
                        {party.eventDate}
                      </span>
                      <span>·</span>
                      <span className="text-[#3D5A4E] capitalize">
                        {party.timeSlot} Session
                      </span>
                      <span>·</span>
                      <span className="font-semibold text-[#236B50]">
                        {party.hallName}
                      </span>
                    </div>

                    <h4 className="text-base font-extrabold text-[#192A24] flex items-center space-x-2">
                      <span>{party.clientName}</span>
                      {party.eventType && (
                        <span className="text-xs font-normal text-[#5A6F66]">({party.eventType})</span>
                      )}
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5A6F66]">
                      <span className="text-[#192A24] font-bold">
                        {party.guestCount} Guests
                      </span>
                      <span>·</span>
                      <span>{party.buffetTier ? `${party.buffetTier.replace('_', ' ').toUpperCase()} Menu` : 'Custom Package'}</span>
                      {currentUser.permissions.canViewRevenue && (
                        <>
                          <span>·</span>
                          <span>Billed: <strong className="text-[#192A24]">{formatCurrency(fin.subtotalRevenue)}</strong></span>
                        </>
                      )}
                      {isFinished && isCostedByArun && currentUser.permissions.canViewRevenue && currentUser.permissions.canViewCosting && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-700 font-bold">GL Posted ({formatPercent(fin.overallProfitMarginPercent)} Margin)</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions for this party */}
                  <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
                    {/* FP Sheet / BEO Sheet Action */}
                    {(() => {
                      const partySummary = getBookingPaymentSummary(party);
                      const partyBal = partySummary.balanceToPay;
                      const isPartySettled = partySummary.isBalanceSettled;

                      return (
                        <button
                          onClick={() => onNavigate('a4_sheet', { bookingId: party.id })}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1 ${
                            isPartySettled
                              ? 'bg-white hover:bg-[#EBF3EF] border-[#C5E5D5] text-[#236B50]'
                              : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
                          }`}
                          title={isPartySettled ? "View Official BEO & Costing Sheet (100% Cleared)" : `BEO locked pending balance settlement (${formatCurrency(partyBal)} due). View Pre-Party FP Sheet.`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>
                            {currentUser.role === 'executive_chef'
                              ? (!party.partyEnded ? 'Kitchen FP Sheet' : 'Kitchen BEO Sheet')
                              : (isPartySettled ? 'BEO Sheet (Paid)' : 'FP Sheet')}
                          </span>
                        </button>
                      );
                    })()}

                    {/* Settle Balance directly from Directory when unsettled (Francis only) */}
                    {(currentUser.role === 'fnb_supervisor' || currentUser.role === 'banquet_manager') && (() => {
                      const partySummary = getBookingPaymentSummary(party);
                      if (partySummary.isBalanceSettled || party.status === 'cancelled') return null;
                      return (
                        <button
                          onClick={() => {
                            if (onSettleCashBalance) {
                              onSettleCashBalance(party);
                            } else {
                              setQuickCashModalBooking(party);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-colors cursor-pointer flex items-center space-x-1 shadow-xs"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          <span>Settle ({formatCurrency(partySummary.balanceToPay)})</span>
                        </button>
                      );
                    })()}

                    {/* If Finished and Costed by Arun, allow viewing Posting Report */}
                    {isFinished && isCostedByArun && currentUser.permissions.canViewCosting && (
                      <button
                        onClick={() => setSelectedPostingReportBooking(party)}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs transition-colors cursor-pointer flex items-center space-x-1 shadow-xs"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>GL Posting Report</span>
                      </button>
                    )}

                    {/* If Finished and Chef has not entered ingredients, chef triggers */}
                    {isFinished && !party.chefApproved && party.hasFoodFromHotel && currentUser.role === 'executive_chef' && (
                      <button
                        onClick={() => onOpenChefUsageModal(party)}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer flex items-center space-x-1 shadow-xs"
                      >
                        <ChefHat className="w-3.5 h-3.5" />
                        <span>Log Ingredients & Stamp</span>
                      </button>
                    )}

                    {/* Invoice View (for Accounts & F&B Supervisor, never Chef or Marketing clutter) */}
                    {currentUser.permissions.canGenerateInvoices && currentUser.role !== 'marketing_executive' && (
                      <button
                        onClick={() => onNavigate('invoices', { bookingId: party.id })}
                        className="px-3 py-1.5 rounded-xl bg-[#F2F7F5] hover:bg-[#E5EFEA] text-[#192A24] font-bold text-xs transition-colors cursor-pointer"
                      >
                        <span>Invoice</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* =====================================================================
          DEPARTMENT MARGIN MATRIX (COMPACT & PROFESSIONAL - PROFIT PERMISSION ONLY)
          ===================================================================== */}
      {currentUser.permissions.canViewProfits && (
        <section className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2ECE7]">
            <div>
              <h3 className="text-sm font-extrabold text-[#192A24] flex items-center space-x-2">
                <PieIcon className="w-4 h-4 text-[#236B50]" />
                <span>Department Margin Matrix (Crystal Plaza Hotel)</span>
              </h3>
              <p className="text-xs text-[#5A6F66]">
                Standard margin contribution benchmark across revenue streams
              </p>
            </div>
            <span className="text-xs text-[#5A6F66] font-semibold">Standard Rates</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-[#F6FAF8] border border-[#E2ECE7] flex items-center justify-between">
              <span className="text-[#3D5A4E] font-medium flex items-center space-x-2">
                <Building className="w-4 h-4 text-[#236B50]" />
                <span>Banquet Hall Rentals</span>
              </span>
              <strong className="text-[#236B50] font-extrabold text-sm">~82.4% Margin</strong>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F6FAF8] border border-[#E2ECE7] flex items-center justify-between">
              <span className="text-[#3D5A4E] font-medium flex items-center space-x-2">
                <ChefHat className="w-4 h-4 text-amber-700" />
                <span>Buffet Food & Catering</span>
              </span>
              <strong className="text-[#236B50] font-extrabold text-sm">~68.8% Margin</strong>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F6FAF8] border border-[#E2ECE7] flex items-center justify-between">
              <span className="text-[#3D5A4E] font-medium flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-blue-700" />
                <span>Decor & Staging AV</span>
              </span>
              <strong className="text-[#236B50] font-extrabold text-sm">~69.2% Margin</strong>
            </div>
          </div>
        </section>
      )}

      {/* Modal for viewing Posting Report */}
      {selectedPostingReportBooking && (
        <PostingReportModal
          onClose={() => setSelectedPostingReportBooking(null)}
          booking={selectedPostingReportBooking}
          currentUser={currentUser}
        />
      )}

      {/* Quick Cash Balance Settlement Modal for Francis */}
      {quickCashModalBooking && (
        <QuickCashSettlementModal
          isOpen={!!quickCashModalBooking}
          booking={quickCashModalBooking}
          currentUser={currentUser}
          onClose={() => setQuickCashModalBooking(null)}
          onSettled={(updatedBooking) => {
            setQuickCashModalBooking(null);
            if (onSettleCashBalance) {
              onSettleCashBalance(updatedBooking);
            }
          }}
        />
      )}
    </div>
  );
};
