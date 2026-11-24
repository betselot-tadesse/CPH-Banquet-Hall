import {
  BookingEvent,
  BanquetHall,
  Invoice,
  MetaAdMonthlyReport,
  RawIngredient,
  RecipeMenuItem,
  UserProfile,
} from '../types';
import {
  calculateEventFinancials,
  getBookingPaymentSummary,
  getLiveTodayInfo,
} from './costCalculations';

export type AiFocusArea =
  | 'executive_overview'
  | 'profitability_costing'
  | 'operations_cashflow'
  | 'marketing_roas';

export interface AiKeyFinding {
  title: string;
  metric: string;
  sentiment: 'positive' | 'warning' | 'risk';
  detail: string;
}

export interface AiRecommendation {
  priority: 'high' | 'medium' | 'low';
  department: string;
  action: string;
  expectedImpact: string;
}

export interface AiRiskAlert {
  severity: 'high' | 'medium';
  title: string;
  detail: string;
}

export interface AiStructuredAnalysis {
  headline: string;
  executiveSummary: string;
  healthStatus: 'strong' | 'attention_needed' | 'critical';
  keyFindings: AiKeyFinding[];
  recommendations: AiRecommendation[];
  riskAlerts: AiRiskAlert[];
  suggestedQuestions: string[];
}

export interface AiAskMetric {
  label: string;
  value: string;
}

export interface AiAskResult {
  answer: string;
  supportingMetrics: AiAskMetric[];
  followUpPrompts: string[];
}

export interface SnapshotInput {
  bookings: BookingEvent[];
  invoices: Invoice[];
  ingredients: RawIngredient[];
  recipes: RecipeMenuItem[];
  halls: BanquetHall[];
  marketingReports: MetaAdMonthlyReport[];
  currentUser: UserProfile;
}

export function buildAiAnalysisSnapshot({
  bookings,
  invoices,
  ingredients,
  recipes,
  halls,
  marketingReports,
  currentUser,
}: SnapshotInput) {
  const { todayStr, currentMonthStr } = getLiveTodayInfo();
  const canViewProfits = currentUser.permissions.canViewProfits !== false;
  const canViewCosting = currentUser.permissions.canViewCosting !== false;
  const canViewRevenue = currentUser.permissions.canViewRevenue !== false;

  const activeBookings = bookings.filter((b) => b.status !== 'cancelled');
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled');

  // Hall utilization across First Floor Big Hall and Suite room Hall
  const hallStats = halls.map((hall) => {
    const hallBookings = activeBookings.filter(
      (b) =>
        b.hallId === hall.id ||
        b.hallName.toLowerCase() === hall.name.toLowerCase()
    );
    const totalGuests = hallBookings.reduce((s, b) => s + (b.guestCount || 0), 0);
    let hallRevenue = 0;
    let hallProfit = 0;
    hallBookings.forEach((b) => {
      const fin = calculateEventFinancials(b);
      hallRevenue += fin.subtotalRevenue;
      hallProfit += fin.netGrossProfit;
    });

    const entry: Record<string, any> = {
      hallName: hall.name,
      capacityMax: hall.capacityMax,
      activeBookingsCount: hallBookings.length,
      totalGuests,
      avgGuestsPerParty:
        hallBookings.length > 0
          ? Math.round(totalGuests / hallBookings.length)
          : 0,
    };
    if (canViewRevenue) {
      entry.subtotalRevenueAED = parseFloat(hallRevenue.toFixed(2));
    }
    if (canViewProfits) {
      entry.grossProfitAED = parseFloat(hallProfit.toFixed(2));
      entry.marginPercent =
        hallRevenue > 0
          ? parseFloat(((hallProfit / hallRevenue) * 100).toFixed(1))
          : 0;
    }
    return entry;
  });

  // Workflow bottlenecks
  const chefPendingParties = activeBookings.filter(
    (b) =>
      b.hasFoodFromHotel &&
      b.partyEnded &&
      (!b.chefApproved || b.costingStatus === 'party_ended_pending_chef') &&
      b.costingStatus !== 'forwarded_to_accounts' &&
      b.costingStatus !== 'costed_by_arun'
  );

  const accountsPendingParties = activeBookings.filter(
    (b) =>
      b.hasFoodFromHotel &&
      (b.costingStatus === 'forwarded_to_accounts' ||
        (b.chefApproved &&
          !b.arunCostedAt &&
          b.costingStatus !== 'costed_by_arun'))
  );

  const tentativeHolds = activeBookings.filter((b) => b.isTentative);

  // Food cost variance & costing stats
  const foodVarianceParties: Record<string, any>[] = [];
  let totalFoodCostAED = 0;
  let totalDirectCostsAED = 0;
  let totalSubtotalRevenueAED = 0;
  let totalGrandBilledAED = 0;
  let totalCollectedAED = 0;
  let totalOutstandingAED = 0;
  const unsettledEndedParties: Record<string, any>[] = [];

  // Monthly rollup from bookings
  const monthMap = new Map<
    string,
    {
      monthKey: string;
      parties: number;
      guests: number;
      revenueAED: number;
      directCostsAED: number;
      foodCostAED: number;
      grossProfitAED: number;
    }
  >();

  // Menu / package rollup
  const menuMap = new Map<
    string,
    {
      menuLabel: string;
      parties: number;
      guests: number;
      revenueAED: number;
      foodCostAED: number;
      grossProfitAED: number;
    }
  >();

  activeBookings.forEach((b) => {
    const fin = calculateEventFinancials(b);
    const pay = getBookingPaymentSummary(b);

    totalFoodCostAED += fin.foodCost;
    totalDirectCostsAED += fin.totalDirectCosts;
    totalSubtotalRevenueAED += fin.subtotalRevenue;
    totalGrandBilledAED += pay.totalBill;
    totalCollectedAED += pay.totalPaid;
    totalOutstandingAED += pay.balanceToPay;

    const isEnded =
      b.partyEnded || b.status === 'completed' || b.eventDate <= todayStr;
    if (canViewRevenue && isEnded && pay.balanceToPay > 1 && !pay.isBalanceSettled) {
      unsettledEndedParties.push({
        bookingNumber: b.bookingNumber,
        clientName: b.clientName,
        eventDate: b.eventDate,
        hallName: b.hallName,
        totalBillAED: pay.totalBill,
        balanceDueAED: pay.balanceToPay,
      });
    }

    if (canViewCosting && b.hasFoodFromHotel) {
      const targetFoodCost =
        (b.foodCostPerGuestTheoretical || 22) * (b.guestCount || 0);
      const actualFoodCost =
        b.foodCostActualTotal !== undefined && b.foodCostActualTotal > 0
          ? b.foodCostActualTotal
          : 0;
      if (targetFoodCost > 0 && actualFoodCost > 0) {
        const variancePct =
          ((actualFoodCost - targetFoodCost) / targetFoodCost) * 100;
        if (variancePct > 10) {
          foodVarianceParties.push({
            bookingNumber: b.bookingNumber,
            clientName: b.clientName,
            eventDate: b.eventDate,
            guests: b.guestCount,
            theoreticalFoodCostAED: parseFloat(targetFoodCost.toFixed(2)),
            actualFoodCostAED: parseFloat(actualFoodCost.toFixed(2)),
            variancePercent: parseFloat(variancePct.toFixed(1)),
            chefNotes: b.chefNotes || undefined,
          });
        }
      }
    }

    const mKey = b.eventDate?.slice(0, 7) || currentMonthStr;
    if (!monthMap.has(mKey)) {
      monthMap.set(mKey, {
        monthKey: mKey,
        parties: 0,
        guests: 0,
        revenueAED: 0,
        directCostsAED: 0,
        foodCostAED: 0,
        grossProfitAED: 0,
      });
    }
    const mEntry = monthMap.get(mKey)!;
    mEntry.parties += 1;
    mEntry.guests += b.guestCount || 0;
    mEntry.revenueAED += fin.subtotalRevenue;
    mEntry.directCostsAED += fin.totalDirectCosts;
    mEntry.foodCostAED += fin.foodCost;
    mEntry.grossProfitAED += fin.netGrossProfit;

    const menuLabel = b.hasFoodFromHotel
      ? b.selectedMenuName || `${b.foodPricePerGuestCharged || 60} AED Buffet`
      : 'Hall Only (No Food)';
    if (!menuMap.has(menuLabel)) {
      menuMap.set(menuLabel, {
        menuLabel,
        parties: 0,
        guests: 0,
        revenueAED: 0,
        foodCostAED: 0,
        grossProfitAED: 0,
      });
    }
    const menuEntry = menuMap.get(menuLabel)!;
    menuEntry.parties += 1;
    menuEntry.guests += b.guestCount || 0;
    menuEntry.revenueAED += fin.subtotalRevenue;
    menuEntry.foodCostAED += fin.foodCost;
    menuEntry.grossProfitAED += fin.netGrossProfit;
  });

  // Build monthly summary respecting visibility
  const monthlyPerformance = Array.from(monthMap.values())
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((m) => {
      const row: Record<string, any> = {
        monthKey: m.monthKey,
        parties: m.parties,
        guests: m.guests,
      };
      if (canViewRevenue) row.revenueAED = parseFloat(m.revenueAED.toFixed(2));
      if (canViewCosting) {
        row.directCostsAED = parseFloat(m.directCostsAED.toFixed(2));
        row.foodCostAED = parseFloat(m.foodCostAED.toFixed(2));
      }
      if (canViewProfits) {
        row.grossProfitAED = parseFloat(m.grossProfitAED.toFixed(2));
        row.marginPercent =
          m.revenueAED > 0
            ? parseFloat(((m.grossProfitAED / m.revenueAED) * 100).toFixed(1))
            : 0;
      }
      return row;
    });

  // Build menu performance respecting visibility
  const menuBreakdown = Array.from(menuMap.values())
    .sort((a, b) => b.parties - a.parties)
    .slice(0, 10)
    .map((m) => {
      const row: Record<string, any> = {
        menuLabel: m.menuLabel,
        parties: m.parties,
        guests: m.guests,
      };
      if (canViewRevenue) row.revenueAED = parseFloat(m.revenueAED.toFixed(2));
      if (canViewCosting) {
        row.foodCostAED = parseFloat(m.foodCostAED.toFixed(2));
        if (canViewRevenue && m.revenueAED > 0) {
          row.foodCostPercent = parseFloat(
            ((m.foodCostAED / m.revenueAED) * 100).toFixed(1)
          );
        }
      }
      if (canViewProfits) {
        row.grossProfitAED = parseFloat(m.grossProfitAED.toFixed(2));
        row.marginPercent =
          m.revenueAED > 0
            ? parseFloat(((m.grossProfitAED / m.revenueAED) * 100).toFixed(1))
            : 0;
      }
      return row;
    });

  // Lead source counts
  const leadSourceCounts: Record<string, number> = {};
  activeBookings.forEach((b) => {
    const src = b.leadSource || 'Direct / Unspecified';
    leadSourceCounts[src] = (leadSourceCounts[src] || 0) + 1;
  });

  // Summary KPIs
  const summaryKPIs: Record<string, any> = {
    activeBookingsCount: activeBookings.length,
    cancelledBookingsCount: cancelledBookings.length,
    totalGuestsServedOrBooked: activeBookings.reduce(
      (s, b) => s + (b.guestCount || 0),
      0
    ),
    tentativeHoldsCount: tentativeHolds.length,
    chefPendingCostingCount: chefPendingParties.length,
    accountsPendingCostingCount: accountsPendingParties.length,
    leadSourceCounts,
  };

  if (canViewRevenue) {
    summaryKPIs.totalSubtotalRevenueAED = parseFloat(
      totalSubtotalRevenueAED.toFixed(2)
    );
    summaryKPIs.totalGrandBilledAED = parseFloat(totalGrandBilledAED.toFixed(2));
    summaryKPIs.totalCollectedAED = parseFloat(totalCollectedAED.toFixed(2));
    summaryKPIs.totalOutstandingBalanceAED = parseFloat(
      totalOutstandingAED.toFixed(2)
    );
    summaryKPIs.unsettledEndedPartiesCount = unsettledEndedParties.length;
    summaryKPIs.avgBookingSubtotalAED =
      activeBookings.length > 0
        ? parseFloat((totalSubtotalRevenueAED / activeBookings.length).toFixed(2))
        : 0;
  }

  if (canViewCosting) {
    summaryKPIs.totalDirectCostsAED = parseFloat(totalDirectCostsAED.toFixed(2));
    summaryKPIs.totalFoodCostAED = parseFloat(totalFoodCostAED.toFixed(2));
    summaryKPIs.foodCostVarianceAlertsCount = foodVarianceParties.length;
    if (canViewRevenue && totalSubtotalRevenueAED > 0) {
      summaryKPIs.overallFoodCostPercent = parseFloat(
        ((totalFoodCostAED / totalSubtotalRevenueAED) * 100).toFixed(1)
      );
    }
  }

  if (canViewProfits) {
    const netProfit = totalSubtotalRevenueAED - totalDirectCostsAED;
    summaryKPIs.totalNetGrossProfitAED = parseFloat(netProfit.toFixed(2));
    summaryKPIs.overallProfitMarginPercent =
      totalSubtotalRevenueAED > 0
        ? parseFloat(((netProfit / totalSubtotalRevenueAED) * 100).toFixed(1))
        : 0;
  }

  // Marketing reports (recent 12 months sorted)
  const includeMarketing = currentUser.role !== 'executive_chef';
  const marketingMonthly = includeMarketing
    ? [...marketingReports]
        .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
        .slice(0, 12)
        .map((r) => {
          const confirmedInMonth = activeBookings.filter((b) =>
            b.eventDate.startsWith(r.monthKey)
          ).length;
          const partiesCount =
            confirmedInMonth > 0
              ? confirmedInMonth
              : r.historicalPartiesCount || 0;
          const row: Record<string, any> = {
            monthKey: r.monthKey,
            monthLabel: r.monthLabel,
            adSpendAED: r.adSpendAED,
            leadsGenerated: r.leadsGenerated,
            cprAED: r.cprAED,
            impressions: r.impressions,
            clicks: r.clicks,
            ctrPercent: r.ctrPercent,
            confirmedParties: partiesCount,
            leadToBookingConversionPercent:
              r.leadsGenerated > 0
                ? parseFloat(((partiesCount / r.leadsGenerated) * 100).toFixed(1))
                : 0,
            topPerformingCampaign: r.topPerformingCampaign || undefined,
          };
          if (canViewRevenue) {
            const monthRev =
              confirmedInMonth > 0
                ? activeBookings
                    .filter((b) => b.eventDate.startsWith(r.monthKey))
                    .reduce(
                      (s, b) => s + calculateEventFinancials(b).subtotalRevenue,
                      0
                    )
                : r.historicalBanquetRevenue || 0;
            row.banquetRevenueAED = parseFloat(monthRev.toFixed(2));
            row.roasMultiplier =
              r.adSpendAED > 0
                ? parseFloat((monthRev / r.adSpendAED).toFixed(2))
                : 0;
          }
          return row;
        })
    : undefined;

  // Kitchen & Inventory slice (for Chef / Costing-enabled roles)
  const lowStockIngredients = canViewCosting
    ? ingredients
        .filter((i) => i.stockQuantity <= i.reorderLevel)
        .slice(0, 10)
        .map((i) => ({
          name: i.name,
          category: i.category,
          stockQuantity: i.stockQuantity,
          reorderLevel: i.reorderLevel,
          unit: i.unit,
          costPerUnitAED: i.costPerUnit,
          wastagePercent: i.wastageFactorPercent,
        }))
    : undefined;

  const recipeCostSummary = canViewCosting
    ? [...recipes]
        .sort((a, b) => b.totalCostPerPortion - a.totalCostPerPortion)
        .slice(0, 12)
        .map((r) => {
          const item: Record<string, any> = {
            name: r.name,
            category: r.category,
            totalCostPerPortionAED: r.totalCostPerPortion,
            targetFoodCostPercent: r.targetFoodCostPercent,
          };
          if (canViewRevenue) {
            item.suggestedSellingPriceAED = r.suggestedSellingPrice;
            item.actualFoodCostPercent =
              r.suggestedSellingPrice > 0
                ? parseFloat(
                    ((r.totalCostPerPortion / r.suggestedSellingPrice) * 100).toFixed(
                      1
                    )
                  )
                : 0;
          }
          return item;
        })
    : undefined;

  // Recent & upcoming bookings snapshot (compact, max 25)
  const partiesSnapshot = [...activeBookings]
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate))
    .slice(0, 25)
    .map((b) => {
      const fin = calculateEventFinancials(b);
      const pay = getBookingPaymentSummary(b);
      const item: Record<string, any> = {
        bookingNumber: b.bookingNumber,
        clientName: b.clientName,
        eventDate: b.eventDate,
        hallName: b.hallName,
        eventType: b.eventType,
        guestCount: b.guestCount,
        status: b.status,
        partyEnded: Boolean(b.partyEnded),
        costingStatus: b.costingStatus || 'not_started',
        menu: b.hasFoodFromHotel
          ? b.selectedMenuName || `${b.foodPricePerGuestCharged} AED Buffet`
          : 'Hall Only',
        leadSource: b.leadSource || 'Direct',
        isTentative: Boolean(b.isTentative),
      };
      if (canViewRevenue) {
        item.subtotalRevenueAED = parseFloat(fin.subtotalRevenue.toFixed(2));
        item.balanceDueAED = pay.balanceToPay;
        item.isBalanceSettled = pay.isBalanceSettled;
      }
      if (canViewCosting) {
        item.foodCostAED = parseFloat(fin.foodCost.toFixed(2));
        item.foodCostActualLogged = fin.isFoodActual;
      }
      if (canViewProfits) {
        item.netGrossProfitAED = parseFloat(fin.netGrossProfit.toFixed(2));
        item.profitMarginPercent = parseFloat(
          fin.overallProfitMarginPercent.toFixed(1)
        );
      }
      return item;
    });

  // Invoice aging counts (revenue-permitted only)
  const invoiceSummary = canViewRevenue
    ? {
        totalInvoices: invoices.length,
        paidCount: invoices.filter((i) => i.status === 'Paid').length,
        partiallyPaidCount: invoices.filter((i) => i.status === 'Partially Paid')
          .length,
        overdueCount: invoices.filter((i) => i.status === 'Overdue').length,
        issuedCount: invoices.filter((i) => i.status === 'Issued').length,
      }
    : undefined;

  return {
    hotel: 'Crystal Plaza Hotel (Sharjah, UAE)',
    today: todayStr,
    currentMonth: currentMonthStr,
    callerRole: currentUser.role,
    callerTitle: currentUser.title,
    summaryKPIs,
    hallStats,
    monthlyPerformance,
    menuBreakdown,
    foodVarianceParties: canViewCosting ? foodVarianceParties.slice(0, 8) : undefined,
    unsettledEndedParties: canViewRevenue ? unsettledEndedParties.slice(0, 8) : undefined,
    marketingMonthly,
    lowStockIngredients,
    recipeCostSummary,
    invoiceSummary,
    partiesSnapshot,
  };
}
