import { BookingEvent, RecipeMenuItem, RawIngredient } from '../types';

export function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
  return `${formatted} AED`;
}

export function formatPercent(val: number): string {
  return `${(val || 0).toFixed(1)}%`;
}

export function getLiveTodayInfo(): {
  todayStr: string;
  currentMonthStr: string;
  currentMonthLabel: string;
  todayDisplayStr: string;
  currentYearStr: string;
  currentMonthShort: string;
  daysInCurrentMonth: number;
  weekStartStr: string;
  weekEndStr: string;
} {
  const now = new Date();
  const y = now.getFullYear();
  const monthIdx = now.getMonth();
  const m = String(monthIdx + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const currentMonthStr = `${y}-${m}`;
  const currentYearStr = String(y);
  const currentMonthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const currentMonthShort = now.toLocaleDateString('en-US', { month: 'short' });
  const todayDisplayStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const daysInCurrentMonth = new Date(y, monthIdx + 1, 0).getDate();

  const fmtLocal = (dt: Date) => {
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  return {
    todayStr,
    currentMonthStr,
    currentMonthLabel,
    todayDisplayStr,
    currentYearStr,
    currentMonthShort,
    daysInCurrentMonth,
    weekStartStr: fmtLocal(startOfWeek),
    weekEndStr: fmtLocal(endOfWeek),
  };
}

export interface EventFinancialSummary {
  hallRevenue: number;
  hallCost: number;
  hallGrossProfit: number;
  hallMarginPercent: number;

  foodRevenue: number;
  foodCost: number;
  foodGrossProfit: number;
  foodMarginPercent: number;
  foodCostPercent: number;
  isFoodActual: boolean;

  beverageRevenue: number;
  beverageCost: number;
  beverageGrossProfit: number;

  decorAndAVRevenue: number;
  decorAndAVCost: number;
  decorAndAVGrossProfit: number;

  staffingCost: number;
  extrasRevenue: number;
  discount: number;

  subtotalRevenue: number;
  totalDirectCosts: number;
  netGrossProfit: number;
  overallProfitMarginPercent: number;

  serviceCharge: number;
  serviceChargePercent: number;
  municipalityFee: number;
  municipalityFeePercent: number;
  taxAmount: number;
  taxPercent: number;
  grandTotalChargedToClient: number;
  depositPaid: number;
  balanceDue: number;

  // Manual rule validations specified by hotel
  isMinGuestCompliant: boolean; // Must be at least 30 guests
  isDiscountFloorCompliant: boolean; // Lowest discount floor is 1,500 AED for 30 people
  effectiveRatePerGuest: number;

  profitHealth: 'exceptional' | 'healthy' | 'moderate' | 'critical';
}

export function calculateEventFinancials(event: BookingEvent): EventFinancialSummary {
  const hallRev = event.hallRentalCharged || 0;
  const hallCost = event.hallDirectCost || 0;
  const hallGrossProfit = hallRev - hallCost;
  const hallMarginPercent = hallRev > 0 ? (hallGrossProfit / hallRev) * 100 : 0;

  const guests = event.guestCount || 0;
  
  // Food revenue: 0 if no food from hotel; otherwise if fixed package price provided use that, else guestCount * pricePerGuest
  const rawFoodRev = !event.hasFoodFromHotel
    ? 0
    : event.packageFixedPriceCharged && event.packageFixedPriceCharged > 0
    ? event.packageFixedPriceCharged
    : (event.foodPricePerGuestCharged || 0) * guests;

  const isFoodActual = Boolean(event.hasFoodFromHotel && event.chefUsageLogged && event.foodCostActualTotal !== undefined);
  const foodCost = !event.hasFoodFromHotel
    ? 0
    : isFoodActual 
    ? (event.foodCostActualTotal || 0)
    : (event.foodCostPerGuestTheoretical || 0) * guests;
    
  const foodGrossProfit = rawFoodRev - foodCost;
  const foodMarginPercent = rawFoodRev > 0 ? (foodGrossProfit / rawFoodRev) * 100 : 0;
  const foodCostPercent = rawFoodRev > 0 ? (foodCost / rawFoodRev) * 100 : 0;

  const bevRev = event.beveragePriceCharged || 0;
  const bevCost = event.beverageCostTotal || 0;
  const bevGrossProfit = bevRev - bevCost;

  const decorRev = event.decorAndAVCharged || 0;
  const decorCost = event.decorAndAVCost || 0;
  const decorGrossProfit = decorRev - decorCost;

  const staffCost = event.staffingCost || 0;
  const extrasRev = event.extraCharges || 0;
  const discount = event.discountAmount || 0;

  const subtotalRevenue = Math.max(0, (hallRev + rawFoodRev + bevRev + decorRev + extrasRev) - discount);
  const totalDirectCosts = hallCost + foodCost + bevCost + decorCost + staffCost;
  const netGrossProfit = subtotalRevenue - totalDirectCosts;
  const overallProfitMarginPercent = subtotalRevenue > 0 ? (netGrossProfit / subtotalRevenue) * 100 : 0;

  // Only apply explicit service/municipality/VAT percentages when explicitly billed (> 0)
  const serviceChargePercent = event.serviceChargePercent ?? 0;
  const municipalityFeePercent = event.municipalityFeePercent ?? 0;
  const taxPercent = event.taxPercent ?? 0;

  const serviceCharge = (subtotalRevenue * serviceChargePercent) / 100;
  const municipalityFee = (subtotalRevenue * municipalityFeePercent) / 100;
  const taxableBase = subtotalRevenue + serviceCharge + municipalityFee;
  const taxAmount = (taxableBase * taxPercent) / 100;
  const grandTotalChargedToClient = subtotalRevenue + serviceCharge + municipalityFee + taxAmount;

  const paymentsTotal = (event.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const depositPaid = (event.payments && event.payments.length > 0)
    ? paymentsTotal
    : (event.depositPaid || 0);
  const balanceDue = Math.max(0, grandTotalChargedToClient - depositPaid);

  // Business Rules Checks
  const isMinGuestCompliant = guests >= 30;
  // Floor discount rule: minimum charge for 30 guests is 1,500 AED (effective 50 AED/person floor)
  const minimumAllowedFloor = Math.max(1500, guests * 50);
  const isDiscountFloorCompliant = subtotalRevenue >= minimumAllowedFloor;
  const effectiveRatePerGuest = guests > 0 ? subtotalRevenue / guests : 0;

  let profitHealth: EventFinancialSummary['profitHealth'] = 'healthy';
  if (overallProfitMarginPercent >= 55) {
    profitHealth = 'exceptional';
  } else if (overallProfitMarginPercent >= 40) {
    profitHealth = 'healthy';
  } else if (overallProfitMarginPercent >= 25) {
    profitHealth = 'moderate';
  } else {
    profitHealth = 'critical';
  }

  return {
    hallRevenue: hallRev,
    hallCost,
    hallGrossProfit,
    hallMarginPercent,
    foodRevenue: rawFoodRev,
    foodCost,
    foodGrossProfit,
    foodMarginPercent,
    foodCostPercent,
    isFoodActual,
    beverageRevenue: bevRev,
    beverageCost: bevCost,
    beverageGrossProfit: bevGrossProfit,
    decorAndAVRevenue: decorRev,
    decorAndAVCost: decorCost,
    decorAndAVGrossProfit: decorGrossProfit,
    staffingCost: staffCost,
    extrasRevenue: extrasRev,
    discount,
    subtotalRevenue,
    totalDirectCosts,
    netGrossProfit,
    overallProfitMarginPercent,
    serviceCharge,
    serviceChargePercent,
    municipalityFee,
    municipalityFeePercent,
    taxAmount,
    taxPercent,
    grandTotalChargedToClient,
    depositPaid,
    balanceDue,
    isMinGuestCompliant,
    isDiscountFloorCompliant,
    effectiveRatePerGuest,
    profitHealth,
  };
}

export interface BookingPaymentSummary {
  totalBill: number;
  totalPaid: number;
  balanceToPay: number;
  isBalanceSettled: boolean;
  advancePaymentMode: string;
}

export function getBookingPaymentSummary(event: BookingEvent): BookingPaymentSummary {
  const fin = calculateEventFinancials(event);
  const totalBill = parseFloat(fin.grandTotalChargedToClient.toFixed(2));
  const paymentsTotal = (event.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const rawPaid = (event.payments && event.payments.length > 0)
    ? paymentsTotal
    : (event.depositPaid || 0);
  const totalPaid = parseFloat(rawPaid.toFixed(2));
  const balanceToPay = Math.max(0, parseFloat((totalBill - totalPaid).toFixed(2)));
  const isBalanceSettled = Boolean(event.finalPaymentConfirmed) || (totalBill > 0 && balanceToPay <= 0.01);
  const advancePaymentMode = event.advancePaymentMode || event.payments?.[0]?.paymentMode || '';

  return {
    totalBill,
    totalPaid,
    balanceToPay,
    isBalanceSettled,
    advancePaymentMode,
  };
}

export interface FunctionProspectusFinancials {
  fpTotalBill: number;
  fpAdvancePaid: number;
  fpBalanceToPay: number;
  fpAdvanceMode: string;
}

export function getFunctionProspectusFinancials(event: BookingEvent): FunctionProspectusFinancials {
  const fullSummary = getBookingPaymentSummary(event);
  const fpTotalBill = event.fpPrePartyTotalBill !== undefined
    ? parseFloat(event.fpPrePartyTotalBill.toFixed(2))
    : fullSummary.totalBill;

  const prePartyAdvanceRecords = (event.payments || []).filter(p => p.paymentType !== 'balance');
  const prePartyAdvanceSum = parseFloat(
    prePartyAdvanceRecords.reduce((sum, p) => sum + (Number(p.amount) || 0), 0).toFixed(2)
  );

  const fpAdvancePaid = event.fpPrePartyAdvancePaid !== undefined
    ? parseFloat(event.fpPrePartyAdvancePaid.toFixed(2))
    : prePartyAdvanceRecords.length > 0
    ? prePartyAdvanceSum
    : (event.finalPaymentConfirmed || event.partyEnded ? 0 : (event.depositPaid || 0));

  const fpBalanceToPay = Math.max(0, parseFloat((fpTotalBill - fpAdvancePaid).toFixed(2)));
  const fpAdvanceMode = event.fpPrePartyAdvanceMode || prePartyAdvanceRecords[0]?.paymentMode || event.advancePaymentMode || '';

  return {
    fpTotalBill,
    fpAdvancePaid,
    fpBalanceToPay,
    fpAdvanceMode,
  };
}

export function computeRecipeDirectCost(recipe: RecipeMenuItem, ingredientsMap: Map<string, RawIngredient>): {
  ingredientCostTotal: number;
  totalCostPerPortion: number;
  foodCostPercent: number;
  grossProfitPerPortion: number;
  marginPercent: number;
} {
  let rawIngredientSum = 0;

  recipe.ingredients.forEach(item => {
    const raw = ingredientsMap.get(item.ingredientId);
    const unitCost = raw ? raw.costPerUnit : item.unitCost;
    const wastage = raw ? (raw.wastageFactorPercent / 100) : 0;
    const effectiveCostPerUnit = unitCost / Math.max(0.1, (1 - wastage));
    rawIngredientSum += item.quantityPerPortion * effectiveCostPerUnit;
  });

  const totalCostPerPortion = rawIngredientSum + (recipe.prepLaborCostPerPortion || 0) + (recipe.utilityOverheadPerPortion || 0);
  const sellPrice = recipe.suggestedSellingPrice || 1;
  const foodCostPercent = (totalCostPerPortion / sellPrice) * 100;
  const grossProfitPerPortion = sellPrice - totalCostPerPortion;
  const marginPercent = (grossProfitPerPortion / sellPrice) * 100;

  return {
    ingredientCostTotal: rawIngredientSum,
    totalCostPerPortion,
    foodCostPercent,
    grossProfitPerPortion,
    marginPercent,
  };
}
