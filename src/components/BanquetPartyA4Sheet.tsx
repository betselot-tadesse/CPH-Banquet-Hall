import React, { useState, useRef } from 'react';
import { 
  Printer, 
  X, 
  Building, 
  Calendar, 
  Users, 
  UtensilsCrossed, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  ChefHat, 
  FileText,
  Lock,
  Layers,
  Sparkles,
  Download,
  DollarSign,
  ShieldCheck,
  CreditCard,
  Receipt
} from 'lucide-react';
import { BookingEvent, BanquetPackage, RecipeMenuItem, UserProfile, RawIngredient } from '../types';
import { calculateEventFinancials, getBookingPaymentSummary, getFunctionProspectusFinancials, computeRecipeDirectCost, formatCurrency, formatPercent } from '../utils/costCalculations';
import { getBanquetMenuById } from '../data/banquetMenus';
import { downloadElementAsPdf } from '../utils/pdfDownloader';
import { AppStorage } from '../services/storage';

interface BanquetPartyA4SheetProps {
  booking: BookingEvent;
  packages: BanquetPackage[];
  recipes: RecipeMenuItem[];
  ingredients: RawIngredient[];
  currentUser: UserProfile;
  onClose: () => void;
  onOpenChefUsageModal?: (booking: BookingEvent) => void;
  onUpdateBooking?: (booking: BookingEvent) => void;
  initialPage?: 1 | 2 | 3;
}

export const BanquetPartyA4Sheet: React.FC<BanquetPartyA4SheetProps> = ({
  booking,
  packages,
  recipes,
  ingredients,
  currentUser,
  onClose,
  onOpenChefUsageModal,
  onUpdateBooking,
  initialPage,
}) => {
  const fin = calculateEventFinancials(booking);
  const paySummary = getBookingPaymentSummary(booking);
  const fpFin = getFunctionProspectusFinancials(booking);

  // Exact Balance Settlement Computation (100% unified with BookingsManager & Storage)
  const totalPaid = paySummary.totalPaid;
  const grandTotal = paySummary.totalBill;
  const balanceToPay = paySummary.balanceToPay;

  // USER RULE: "BEO should be done after all balance setted"
  const isBalanceSettled = paySummary.isBalanceSettled;
  const isArunCostingDone = booking.costingStatus === 'costed_by_arun' || Boolean(booking.arunCostedAt) || Boolean(booking.postingReportGenerated);
  const canViewCostingOrProfit = Boolean(currentUser.permissions.canViewProfits || currentUser.permissions.canViewCosting);
  const isBeoReady = isBalanceSettled && (canViewCostingOrProfit ? isArunCostingDone : true);

  // Before balance is settled, default strictly to Page 3 (Function Prospectus).
  // When initialPage === 3 (e.g. clicking FP Sheet button), always open Page 3 directly.
  // Roles without costing/profit privileges (Francis) see Page 1 BEO once settled, never Page 2 Profit Audit.
  const [activePreviewPage, setActivePreviewPage] = useState<1 | 2 | 3 | 'final_2page'>(() => {
    if (!isBalanceSettled || initialPage === 3) return 3; // Function Prospectus (pre-party sheet)
    if (!canViewCostingOrProfit) return 1; // Francis gets Page 1 BEO only
    if (!isArunCostingDone) return initialPage === 1 ? 1 : 3;
    return initialPage || 'final_2page';
  });

  const [lockedTabNotice, setLockedTabNotice] = useState<string | null>(null);
  const [showQuickSettle, setShowQuickSettle] = useState(false);
  const [settleAmount, setSettleAmount] = useState<number>(balanceToPay > 0 ? balanceToPay : 0);
  const [settlePaymentMode, setSettlePaymentMode] = useState<'Cash' | 'Card' | 'Bank Transfer' | 'Cheque' | 'Online'>('Cash');
  const [settleNotes, setSettleNotes] = useState<string>("Full balance settled with F&B Supervisor Francis on party arrival.");
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);

  const ingredientsMap = new Map<string, RawIngredient>(ingredients.map(i => [i.id, i]));

  // Selected package (only if explicitly linked)
  const selectedPkg = packages.find(p => p.id === booking.packageId);

  // List of dishes in this buffet (only explicitly logged custom recipe items when hotel food is booked)
  const buffetDishes: RecipeMenuItem[] = booking.hasFoodFromHotel && booking.customRecipeItemIds && booking.customRecipeItemIds.length > 0
    ? booking.customRecipeItemIds
        .map(id => recipes.find(r => r.id === id))
        .filter((r): r is RecipeMenuItem => r !== undefined)
    : [];

  const guests = booking.guestCount || 0;

  // Individual dish calculations for this party
  const dishCostBreakdowns = buffetDishes.map(dish => {
    const metrics = computeRecipeDirectCost(dish, ingredientsMap);
    const totalDishCostForParty = metrics.totalCostPerPortion * guests;
    const totalDishSellingForParty = (dish.suggestedSellingPrice || 0) * guests;
    return {
      dish,
      metrics,
      totalDishCostForParty,
      totalDishSellingForParty,
      profitForParty: totalDishSellingForParty - totalDishCostForParty,
    };
  });

  const printableContainerRef = useRef<HTMLDivElement>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const totalFoodCost = booking.chefUsageLogged && booking.foodCostActualTotal !== undefined
    ? booking.foodCostActualTotal
    : dishCostBreakdowns.reduce((sum, d) => sum + d.totalDishCostForParty, 0);

  const handlePrint = () => {
    if (!isBalanceSettled && activePreviewPage !== 3) {
      setLockedTabNotice(`⚠️ Cannot print BEO: Outstanding balance of ${formatCurrency(balanceToPay)} must be settled by Francis first!`);
      setActivePreviewPage(3);
      return;
    }
    window.print();
  };

  const handleDownloadPdf = () => {
    // Dynamically set clean document title so browser's native 'Save as PDF' uses this filename
    if (!isBalanceSettled && activePreviewPage !== 3) {
      setLockedTabNotice(`⚠️ BEO is locked: Outstanding balance of ${formatCurrency(balanceToPay)} must be settled by Francis first. Printing Function Prospectus instead.`);
      setActivePreviewPage(3);
      return;
    }

    const originalTitle = document.title;
    const isFp = activePreviewPage === 3;
    const isTwoPage = activePreviewPage === 'final_2page';
    const cleanClient = (booking.clientName || 'Banquet').replace(/[^a-zA-Z0-9_-]/g, '_');
    const docName = isFp 
      ? `${booking.bookingNumber}-${cleanClient}-Function_Prospectus` 
      : isTwoPage
      ? `${booking.bookingNumber}-${cleanClient}-Final_2Page_BEO_Costing`
      : `${booking.bookingNumber}-${cleanClient}-BEO_Page${activePreviewPage}`;

    document.title = docName;
    window.print();

    setTimeout(() => {
      document.title = originalTitle;
    }, 2000);
  };

  const handleQuickSettleBalance = () => {
    if (!onUpdateBooking) return;
    const paymentAmount = settleAmount > 0 ? settleAmount : balanceToPay;
    if (paymentAmount <= 0) return;

    setIsSubmittingSettlement(true);
    try {
      const newTotalPaid = totalPaid + paymentAmount;
      const isFullySettled = newTotalPaid >= grandTotal - 0.01;

      // 1. Record payment in AppStorage
      const paymentRecord = AppStorage.addPayment(
        booking.id,
        {
          date: new Date().toISOString().substring(0, 10),
          amount: parseFloat(paymentAmount.toFixed(2)),
          paymentType: 'balance',
          paymentMode: settlePaymentMode,
          receivedBy: currentUser.name || "Francis D'Souza",
          notes: settleNotes,
        },
        currentUser
      );

      // 2. Update booking state while keeping pre-party FP Sheet figures intact
      const remainingBalance = Math.max(0, parseFloat((grandTotal - newTotalPaid).toFixed(2)));
      const updatedBooking: BookingEvent = {
        ...booking,
        fpPrePartyTotalBill: booking.fpPrePartyTotalBill ?? fpFin.fpTotalBill,
        fpPrePartyAdvancePaid: booking.fpPrePartyAdvancePaid ?? fpFin.fpAdvancePaid,
        fpPrePartyAdvanceMode: booking.fpPrePartyAdvanceMode ?? (fpFin.fpAdvanceMode || undefined),
        depositPaid: parseFloat(newTotalPaid.toFixed(2)),
        totalBillPayable: grandTotal,
        payments: [...(booking.payments || []), paymentRecord],
        finalPaymentConfirmed: isFullySettled,
        finalSettledAt: new Date().toISOString(),
        balanceToPay: remainingBalance,
      };

      onUpdateBooking(updatedBooking);
      setShowQuickSettle(false);
      setLockedTabNotice(null);

      // Dismiss any active mandatory settlement notifications
      const notifs = AppStorage.getNotifications().filter(
        n => !(n.bookingId === booking.id && (n.type === 'mandatory_settle_balance' || n.actionRequired === 'settle_balance'))
      );
      AppStorage.setNotifications(notifs);

      // Automatically switch to BEO page if settled!
      if (isFullySettled) {
        if (canViewCostingOrProfit && isArunCostingDone) {
          setActivePreviewPage('final_2page');
        } else {
          setActivePreviewPage(1);
        }
      }
    } catch (err) {
      console.error('Failed to settle payment:', err);
    } finally {
      setIsSubmittingSettlement(false);
    }
  };

  const handleEndPartyNow = () => {
    if (!onUpdateBooking) return;
    if (!isBalanceSettled) {
      setLockedTabNotice(`⚠️ Cannot mark party ended: Outstanding balance of ${formatCurrency(balanceToPay)} must be 100% settled by Francis first!`);
      return;
    }
    const updated: BookingEvent = {
      ...booking,
      fpPrePartyTotalBill: booking.fpPrePartyTotalBill ?? fpFin.fpTotalBill,
      fpPrePartyAdvancePaid: booking.fpPrePartyAdvancePaid ?? fpFin.fpAdvancePaid,
      fpPrePartyAdvanceMode: booking.fpPrePartyAdvanceMode ?? (fpFin.fpAdvanceMode || undefined),
      status: 'completed',
      partyEnded: true,
      partyEndedAt: new Date().toISOString(),
      partyEndedConfirmedBy: currentUser.name,
      costingStatus: booking.hasFoodFromHotel ? 'party_ended_pending_chef' : (booking.costingStatus === 'not_started' ? 'party_ended_pending_chef' : booking.costingStatus),
    };
    onUpdateBooking(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static print:z-auto">
      <div className="bg-[#F8FAF9] border border-[#D5E5DE] rounded-3xl w-full max-w-5xl max-h-[96vh] overflow-y-auto shadow-2xl print:border-none print:shadow-none print:max-h-none print:w-full print:bg-white print:text-black">
        
        {/* Top Control Header (Hidden when printing) */}
        <div className="sticky top-0 z-20 px-6 py-4 bg-white/95 backdrop-blur-md border-b border-[#E2ECE7] flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
              !isBalanceSettled
                ? 'bg-rose-100 text-rose-900 border-rose-300'
                : !isArunCostingDone 
                ? 'bg-amber-100 text-amber-900 border-amber-300' 
                : 'bg-[#E8F5EE] text-[#236B50] border-[#C5E5D5]'
            }`}>
              {!isBalanceSettled ? (
                <Lock className="w-5 h-5 text-rose-700" />
              ) : !isArunCostingDone ? (
                <Sparkles className="w-5 h-5 text-amber-700" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-extrabold text-[#192A24] text-base sm:text-lg font-['Plus_Jakarta_Sans']">
                  {!isBalanceSettled 
                    ? 'Function Prospectus (BEO Locked — Settle Balance First)' 
                    : !isArunCostingDone 
                    ? 'BEO Summary (Pre-Costing — Balance Settled)' 
                    : 'Banquet Event Order & Final Costing (100% Cleared)'}
                </h2>
                {!isBalanceSettled ? (
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 flex items-center space-x-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>BEO Locked ({formatCurrency(balanceToPay)} Due)</span>
                  </span>
                ) : !isArunCostingDone ? (
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center space-x-1">
                    <CheckCircle2 className="w-2.5 h-2.5 text-amber-700" />
                    <span>Balance Settled • Awaiting Arun</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center space-x-1">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700" />
                    <span>BEO Ready & Downloadable</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[#5A6F66]">
                {booking.bookingNumber} • {booking.clientName} ({guests} Guests{(booking.venueFloor || booking.hallName) ? `, ${booking.venueFloor || booking.hallName}` : ''})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Page preview switcher */}
            <div className="bg-[#EBF3EF] p-1 rounded-2xl border border-[#D5E5DE] flex text-xs font-semibold">
              <button
                onClick={() => {
                  setActivePreviewPage(3);
                  setLockedTabNotice(null);
                }}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer ${
                  activePreviewPage === 3
                    ? 'bg-[#EAB308] text-slate-950 font-black shadow-xs'
                    : 'text-[#3D5A4E] hover:text-[#192A24]'
                }`}
                title="Function Prospectus (FP Sheet): Operational sheet used before balance settlement"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-800" />
                <span>Function Prospectus (Client)</span>
              </button>

              {canViewCostingOrProfit && (
                <button
                  onClick={() => {
                    if (!isBalanceSettled) {
                      setLockedTabNotice(`🔒 BEO Locked: Banquet Event Order can only be done AFTER all balance is 100% settled. Remaining balance of ${formatCurrency(balanceToPay)} must be collected by Francis.`);
                      return;
                    }
                    if (!isArunCostingDone) {
                      setLockedTabNotice('Final Document (2-Page PDF) is ready AFTER Arun Kumar completes costing.');
                      return;
                    }
                    setActivePreviewPage('final_2page');
                    setLockedTabNotice(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer ${
                    !isBalanceSettled || !isArunCostingDone
                      ? 'opacity-60 text-slate-400 hover:text-slate-600'
                      : activePreviewPage === 'final_2page'
                      ? 'bg-[#236B50] text-white font-bold shadow-xs'
                      : 'text-[#3D5A4E] hover:text-[#192A24]'
                  }`}
                  title={!isBalanceSettled ? "BEO is locked until balance is 100% settled" : "One PDF, two pages: Page 1: BEO Summary, Page 2: Internal Costing"}
                >
                  {(!isBalanceSettled || !isArunCostingDone) && <Lock className="w-3 h-3 text-slate-400" />}
                  <FileText className="w-3.5 h-3.5" />
                  <span>Final 2-Page PDF (BEO + Costing)</span>
                </button>
              )}

              <button
                onClick={() => {
                  if (!isBalanceSettled) {
                    setLockedTabNotice(`🔒 BEO Locked: Banquet Event Order (Page 1) can only be done AFTER all balance is 100% settled. Remaining balance of ${formatCurrency(balanceToPay)} must be collected by Francis.`);
                    return;
                  }
                  setActivePreviewPage(1);
                  setLockedTabNotice(null);
                }}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer ${
                  !isBalanceSettled
                    ? 'opacity-60 text-slate-400 hover:text-slate-600'
                    : activePreviewPage === 1
                    ? 'bg-[#236B50] text-white font-bold shadow-xs'
                    : 'text-[#3D5A4E] hover:text-[#192A24]'
                }`}
                title={!isBalanceSettled ? "BEO Page 1 locked until balance is 100% settled" : "Page 1: BEO Summary & Financial Clearance Seal"}
              >
                {!isBalanceSettled && <Lock className="w-3 h-3 text-slate-400" />}
                <span>Page 1 BEO</span>
              </button>

              {canViewCostingOrProfit && (
                <button
                  onClick={() => {
                    if (!isBalanceSettled) {
                      setLockedTabNotice(`🔒 BEO Costing Locked: All balance must be 100% settled first.`);
                      return;
                    }
                    if (!isArunCostingDone) {
                      setLockedTabNotice('Internal Costing is ready AFTER Arun Kumar completes costing.');
                      return;
                    }
                    setActivePreviewPage(2);
                    setLockedTabNotice(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer ${
                    !isBalanceSettled || !isArunCostingDone
                      ? 'opacity-60 text-slate-400 hover:text-slate-600'
                      : activePreviewPage === 2
                      ? 'bg-[#236B50] text-white font-bold shadow-xs'
                      : 'text-[#3D5A4E] hover:text-[#192A24]'
                  }`}
                  title="Page 2: Internal Costing Only"
                >
                  {(!isBalanceSettled || !isArunCostingDone) && <Lock className="w-3 h-3 text-slate-400" />}
                  <span>Page 2 Only</span>
                </button>
              )}
            </div>

            {/* Download as PDF Button */}
            <button
              onClick={handleDownloadPdf}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-full font-black text-xs shadow-md transition-all cursor-pointer active:scale-98 ${
                activePreviewPage === 3
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                  : 'bg-[#236B50] hover:bg-[#1C5740] text-white shadow-[#236B50]/20'
              }`}
              title="Download as PDF: Opens browser print dialog specifically formatted for clean, professional A4 document output (Select 'Save as PDF')"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Download as PDF</span>
            </button>

            {/* Direct Print button */}
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title="Prints directly using browser print dialog (A4 format)"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Print</span>
            </button>

            <button
              onClick={onClose}
              className="text-[#5A6F66] hover:text-[#192A24] p-1.5 rounded-full hover:bg-[#EBF3EF] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* RULE BANNER: BEO must be done AFTER all balance settled */}
        {!isBalanceSettled ? (
          <div className="bg-amber-100 border-b border-amber-300 px-6 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-amber-950 print:hidden">
            <div className="flex items-start space-x-2.5">
              <div className="p-1.5 rounded-lg bg-amber-200 text-amber-900 font-bold shrink-0 mt-0.5 flex items-center space-x-1">
                <Lock className="w-3.5 h-3.5 text-amber-800" />
                <span>BEO Policy</span>
              </div>
              <div>
                <span className="font-extrabold text-sm block text-amber-950">
                  🔒 BEO Locked Pending 100% Balance Settlement
                </span>
                <span className="text-amber-900 text-xs">
                  Per hotel rule, <strong>BEO should be done AFTER all balance is settled</strong>. 
                  Outstanding balance: <strong className="text-rose-700 font-black font-mono text-sm underline">{formatCurrency(balanceToPay)}</strong>. 
                  Until Francis settles the balance, the authorized operational copy is strictly the <strong>Function Prospectus (FP Sheet)</strong>.
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSettleAmount(balanceToPay);
                  setShowQuickSettle(!showQuickSettle);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-sm flex items-center space-x-1.5 cursor-pointer active:scale-98 transition-all"
              >
                <DollarSign className="w-4 h-4" />
                <span>{showQuickSettle ? 'Close Settlement Desk' : `💵 Settle ${formatCurrency(balanceToPay)} to Unlock BEO`}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-emerald-950 print:hidden">
            <div className="flex items-center space-x-2">
              <span className="p-1 rounded-lg bg-emerald-200 text-emerald-900 font-bold shrink-0 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-800" />
                <span>✓ Balance 100% Settled</span>
              </span>
              <span>
                <strong>All balance is 100% settled ({formatCurrency(totalPaid)} received in full).</strong>
                {isArunCostingDone 
                  ? ' BEO is officially verified, costed by Arun Kumar, and authorized for final download.' 
                  : ' BEO Page 1 summary is unlocked with Financial Clearance Seal. Final 2-Page document completes upon Arun Kumar\'s costing.'}
              </span>
            </div>
            <div className="text-[11px] font-mono text-emerald-800 font-black bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
              0.00 AED Remaining Due ✓
            </div>
          </div>
        )}

        {/* Quick Settlement Desk Drawer (for Francis / Cashier directly inside A4 Modal) */}
        {showQuickSettle && !isBalanceSettled && (
          <div className="bg-[#FFFDF5] border-b-2 border-amber-400 p-5 print:hidden">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl p-4 border border-amber-200 shadow-md">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 font-['Plus_Jakarta_Sans']">
                      Francis D'Souza Cash Desk — Instant Balance Settlement
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Collecting full remaining balance clears the party and immediately unlocks the official BEO sheet.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowQuickSettle(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Amount to Collect (AED)
                  </label>
                  <input
                    type="number"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#236B50]"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Outstanding balance: {formatCurrency(balanceToPay)}
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={settlePaymentMode}
                    onChange={(e) => setSettlePaymentMode(e.target.value as 'Cash' | 'Card' | 'Bank Transfer' | 'Cheque' | 'Online')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#236B50]"
                  >
                    <option value="Cash">Cash on Arrival (Desk)</option>
                    <option value="Card">Credit Card / POS Machine</option>
                    <option value="Bank Transfer">Bank Transfer / Cheque</option>
                    <option value="Online">Online Gateway</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Received By
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.name || "Francis D'Souza (F&B Supervisor)"}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-600"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Settlement Memo / Notes
                </label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#236B50]"
                  placeholder="e.g. 100% balance collected by Francis at front reception prior to guest banquet access"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-[11px] text-emerald-800 font-semibold flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Unlocks BEO Sheet & stamps official clearance seal</span>
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickSettle(false)}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickSettleBalance}
                    disabled={isSubmittingSettlement || settleAmount <= 0}
                    className="px-5 py-2 rounded-xl bg-[#236B50] hover:bg-[#1C5740] text-white text-xs font-black shadow-md flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm 100% Settlement & Unlock BEO</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Warning Toast if user tried to click locked page */}
        {lockedTabNotice && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 flex items-center justify-between text-xs text-rose-900 font-semibold print:hidden">
            <div className="flex items-center space-x-1.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{lockedTabNotice}</span>
            </div>
            <button
              onClick={() => setLockedTabNotice(null)}
              className="text-rose-500 hover:text-rose-800 text-xs font-bold cursor-pointer ml-3 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* =========================================================================
            A4 PRINTABLE CONTAINER (2 SEPARATE PAGES)
            ========================================================================= */}
        <div ref={printableContainerRef} className="p-4 sm:p-8 bg-[#EAEFEA] print:bg-white print:p-0">
          
          {/* =====================================================================
              PAGE 1: CLIENT INFORMATION, EVENT DATES, BILLING & FOOD ITEMS
              ===================================================================== */}
          <div className={`a4-document-page bg-white text-slate-900 rounded-2xl shadow-xl p-8 sm:p-10 mb-8 border border-slate-200 max-w-[210mm] mx-auto print:border-none print:shadow-none print:m-0 print:p-0 print:w-full ${
            !isBalanceSettled
              ? 'hidden print:hidden'
              : activePreviewPage === 1 || activePreviewPage === 'final_2page'
              ? 'block print:block'
              : 'hidden print:hidden'
          }`}>
            {/* Page indicator header (hidden in print) */}
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 print:hidden">
              <span>Page 1 of 2 — Client & Food Items Sheet</span>
              <span>Crystal Plaza & Casmia (CPH) Hotel Banquets</span>
            </div>

            {/* Hotel Brand & Document Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="flex items-center space-x-2 text-[#236B50] text-xs font-black tracking-widest uppercase">
                  <Building className="w-4 h-4" />
                  <span>Crystal Plaza & Casmia (CPH) Hotel Banquets</span>
                </div>
                <h1 className="text-2xl font-black text-slate-950 font-['Plus_Jakarta_Sans'] tracking-tight mt-0.5">
                  BANQUET EVENT ORDER & FOOD SPECIFICATION
                </h1>
                <p className="text-xs text-slate-600 font-medium">
                  Branch: <strong className="text-slate-900">{booking.branch}</strong> • F&B Banquet Department
                </p>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Party Booking No.</div>
                <div className="text-base font-black font-mono text-slate-900">{booking.bookingNumber}</div>
                <div className="text-[11px] text-slate-600 font-medium">
                  Status: <strong className="text-[#236B50] uppercase">{booking.status.replace('_', ' ')}</strong>
                </div>
              </div>
            </div>

            {/* Client & Date Details (Booking Date + Party Holiday/Event Date) */}
            <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 mb-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Client / Host</span>
                  <div className="font-extrabold text-slate-900 text-sm">{booking.clientName}</div>
                  <div className="text-slate-700 font-medium">{booking.clientPhone}</div>
                  {booking.clientEmail && (
                    <div className="text-slate-500 text-[11px] truncate">{booking.clientEmail}</div>
                  )}
                </div>

                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Dates Registration</span>
                  <div className="text-slate-700">
                    Booking Reg: <strong className="text-slate-900 font-mono">{booking.bookingDate || (booking.createdAt ? booking.createdAt.substring(0, 10) : '—')}</strong>
                  </div>
                  <div className="text-[#236B50] font-bold">
                    Party Date: <strong className="text-slate-950 font-mono">{booking.eventDate || '—'}</strong>
                  </div>
                  <div className="text-slate-500 text-[10px] capitalize">Session: {booking.eventTimeSpan || booking.timeSlot || '—'}</div>
                </div>

                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Hall Allocation & Offer</span>
                  <div className="font-bold text-slate-900">{booking.venueFloor || booking.hallName || '—'}</div>
                  <div className="text-slate-800 font-semibold text-[11px]">{booking.hallSection || '—'}</div>
                  <div className="text-[#236B50] font-extrabold text-[10px] mt-0.5">
                    {booking.hallOffer === 'free_with_food'
                      ? '✓ FREE BANQUET HALL (With Food Offer)'
                      : booking.hallOffer === 'one_side_hall'
                      ? '✓ One-Side Partition Offer'
                      : '✓ Hall Rental Only'}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Guest Count & Buffet</span>
                  <div className="font-black text-slate-900 text-base flex items-center space-x-1">
                    <span>{guests} People</span>
                    {guests >= 30 && (
                      <span className="text-[10px] text-[#236B50] font-bold">(Min 30 ✓)</span>
                    )}
                  </div>
                  <div className="text-slate-700 font-semibold text-[11px]">
                    {booking.hasFoodFromHotel ? (booking.selectedMenuName || selectedPkg?.name || 'Banquet Buffet') : 'Hall Rental Only'}
                  </div>
                  <div className="text-slate-500 text-[10px] font-mono">
                    {booking.hasFoodFromHotel ? `${booking.foodPricePerGuestCharged} AED / Person` : 'No Hotel Food'}
                  </div>
                </div>
              </div>
            </div>

            {/* List of Food Items Included in that Menu */}
            <div className="mb-4">
              <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-300">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-[#236B50]" />
                  <span>Itemized Buffet Menu Dishes for this Party ({guests} Guests)</span>
                </h3>
                <span className="text-[10px] text-slate-700 font-bold">
                  {booking.hasFoodFromHotel
                    ? (booking.selectedMenuName || `${selectedPkg?.name || 'Banquet Buffet'} • ${booking.foodPricePerGuestCharged} AED / Guest`)
                    : 'Hall Rental Only'}
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[10px] uppercase">
                    <tr>
                      <th className="py-1.5 px-3 w-8">#</th>
                      <th className="py-1.5 px-3">Selected Dish Name</th>
                      <th className="py-1.5 px-3">Course / Specification</th>
                      <th className="py-1.5 px-3 text-center">Status / Dietary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {booking.selectedFoodItems && booking.selectedFoodItems.length > 0 ? (
                      booking.selectedFoodItems.map((dishName, idx) => {
                        const matchedRecipe = recipes.find(r => r.name.toLowerCase().includes(dishName.toLowerCase()) || dishName.toLowerCase().includes(r.name.toLowerCase()));
                        const isNonVeg = /chicken|mutton|beef|fish|lamb|pancit/i.test(dishName);
                        const isDessert = /mousse|caramel|tart|jamun|cake|basbousa|basboosa|kheer/i.test(dishName);
                        const isSalad = /salad|hummus|tabouleh|chaat/i.test(dishName);
                        const isSoup = /soup|lentil|sour|manchow|cream of mushroom/i.test(dishName);
                        const courseType = isDessert ? 'Dessert' : isSalad ? 'Salad / Mezze' : isSoup ? 'Soup' : isNonVeg ? 'Non-Veg Main / Starter' : 'Veg Main / Accompaniment';

                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              <div>{dishName}</div>
                              {matchedRecipe?.description && (
                                <span className="text-[10px] text-slate-500 font-normal">{matchedRecipe.description}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-700 text-[11px]">
                              <span className="text-[10px] text-[#236B50] font-semibold bg-[#E8F5EE] px-2 py-0.5 rounded-md border border-[#C5E5D5]">
                                {courseType}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                                100% Halal
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : buffetDishes.length > 0 ? (
                      buffetDishes.map((dish, idx) => (
                        <tr key={dish.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">
                            <div>{dish.name}</div>
                            <span className="text-[10px] text-[#236B50] font-semibold">{dish.category}</span>
                          </td>
                          <td className="py-2 px-3 text-slate-600 text-[11px]">
                            {dish.description}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                              100% Halal
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-3 px-3 text-center text-slate-500 italic text-xs">
                          {booking.hasFoodFromHotel
                            ? 'No buffet dishes logged for this booking.'
                            : 'Hall Rental Only — No hotel buffet food selected.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Client Bill, Payments & Chef Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-xs">
              {/* Billing breakdown */}
              <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50 space-y-1">
                <div className="font-black text-slate-900 uppercase text-[10px] tracking-wider mb-1">
                  Client Billing & Payment Summary
                </div>
                {booking.hasFoodFromHotel && (
                  <div className="flex justify-between text-slate-700">
                    <span>Buffet Food Package ({guests}p × {booking.foodPricePerGuestCharged} AED):</span>
                    <span className="font-mono font-bold text-slate-900">{formatCurrency(fin.foodRevenue)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-700">
                  <span>Banquet Hall Charge:</span>
                  <span className="font-mono font-bold text-[#236B50]">
                    {booking.hallOffer === 'free_with_food' ? '0.00 AED (Free Offer ✓)' : formatCurrency(booking.hallRentalCharged)}
                  </span>
                </div>
                {fin.decorAndAVRevenue > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Decor & AV Staging:</span>
                    <span className="font-mono font-medium">{formatCurrency(fin.decorAndAVRevenue)}</span>
                  </div>
                )}
                {fin.beverageRevenue > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Beverage Charges:</span>
                    <span className="font-mono font-medium">{formatCurrency(fin.beverageRevenue)}</span>
                  </div>
                )}
                {fin.extrasRevenue > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Extra Charges / Add-ons:</span>
                    <span className="font-mono font-medium">{formatCurrency(fin.extrasRevenue)}</span>
                  </div>
                )}
                {fin.discount > 0 && (
                  <div className="flex justify-between text-rose-700 font-semibold">
                    <span>Agreed Discount:</span>
                    <span className="font-mono">-{formatCurrency(fin.discount)}</span>
                  </div>
                )}
                {fin.serviceCharge > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Service Charge ({fin.serviceChargePercent}%):</span>
                    <span className="font-mono">{formatCurrency(fin.serviceCharge)}</span>
                  </div>
                )}
                {fin.municipalityFee > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Municipality Fee ({fin.municipalityFeePercent}%):</span>
                    <span className="font-mono">{formatCurrency(fin.municipalityFee)}</span>
                  </div>
                )}
                {fin.taxAmount > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>UAE VAT ({fin.taxPercent}%):</span>
                    <span className="font-mono">{formatCurrency(fin.taxAmount)}</span>
                  </div>
                )}
                <div className="pt-1 border-t border-slate-300 flex justify-between font-black text-slate-950 text-sm">
                  <span>Total Bill:</span>
                  <span className="font-mono">{formatCurrency(grandTotal)}</span>
                </div>
                <div className="flex justify-between text-[#236B50] font-extrabold pt-0.5">
                  <span>Advance / Total Paid to Date:</span>
                  <span className="font-mono">-{formatCurrency(totalPaid)}</span>
                </div>
                {isBalanceSettled ? (
                  <div className="p-2 rounded-lg bg-emerald-100 border border-emerald-400 flex justify-between text-emerald-950 font-black">
                    <span className="flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />
                      <span>Balance to Pay:</span>
                    </span>
                    <span className="font-mono text-emerald-900">0.00 AED (100% SETTLED ✓)</span>
                  </div>
                ) : (
                  <div className="p-1.5 rounded bg-amber-50 border border-amber-300 flex justify-between text-amber-950 font-black">
                    <span>Balance to Pay:</span>
                    <span className="font-mono">{formatCurrency(balanceToPay)}</span>
                  </div>
                )}
              </div>

              {/* Notes for the chef */}
              <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/60 space-y-2">
                <div className="flex items-center space-x-1.5 text-amber-900 font-black uppercase text-[10px] tracking-wider">
                  <ChefHat className="w-4 h-4 text-amber-800" />
                  <span>Important Notes for the Chef & Kitchen</span>
                </div>
                <p className="text-slate-800 text-xs leading-relaxed bg-white p-2.5 rounded-lg border border-amber-200 font-medium">
                  {booking.chefNotes || booking.specialRequests || '— No special kitchen notes logged.'}
                </p>
                <div className="text-[10px] text-slate-500 italic">
                  Kitchen notice: Raw ingredient quantities and variances must be recorded on Sheet Page 2 upon service conclusion.
                </div>
              </div>
            </div>

            {/* Official BEO Financial Clearance Seal on Page 1 (Only rendered when 100% settled) */}
            {isBalanceSettled && (
              <div className="mb-4 p-3.5 rounded-xl border-2 border-emerald-600 bg-emerald-50/90 text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full border-2 border-emerald-700 bg-white flex flex-col items-center justify-center font-black text-emerald-800 shadow-xs shrink-0">
                    <span className="text-xs leading-none">100%</span>
                    <span className="text-[7px] uppercase tracking-tighter text-emerald-600 font-extrabold">PAID</span>
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                      <span>CRYSTAL PLAZA BANQUETS — FINANCIAL CLEARANCE SEAL</span>
                    </div>
                    <div className="text-[11px] text-emerald-800 font-medium">
                      Certified: All event balance settled in full prior to BEO release • 0.00 AED Remaining Due
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      Settlement Verified By: <strong className="text-slate-900">{booking.partyEndedConfirmedBy || booking.fnbRepresentative || "Francis D'Souza"}</strong> • Receipt Cleared • Authorized for Event Execution
                    </div>
                  </div>
                </div>
                <div className="text-right text-[10px] font-mono shrink-0 pl-2">
                  <div className="text-emerald-900 font-black text-xs">
                    {formatCurrency(totalPaid)}
                  </div>
                  <div className="text-emerald-700 font-bold uppercase text-[9px]">Verified Settled</div>
                </div>
              </div>
            )}

            {/* Page 1 Signatures */}
            <div className="pt-4 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-[10px] text-slate-600">
              <div>
                <div className="h-8 border-b border-slate-400 w-48 mb-1"></div>
                <div className="font-bold text-slate-900">F&B Banquet Representative</div>
                <div>{booking.fnbRepresentative || "Francis D'Souza"} ({booking.branch})</div>
              </div>

              <div className="text-right">
                <div className="h-8 border-b border-slate-400 w-48 ml-auto mb-1"></div>
                <div className="font-bold text-slate-900">Client Host Acceptance Signature</div>
                <div>{booking.clientName}</div>
              </div>
            </div>
          </div>


          {/* =====================================================================
              PAGE BREAK INDICATOR (For print and clean visual separation)
              ===================================================================== */}
          <div className={`html2pdf__page-break page-break my-6 border-t-2 border-dashed border-[#A3C9B9] text-center relative ${
            !canViewCostingOrProfit || !isBalanceSettled || !isArunCostingDone || activePreviewPage === 3 || activePreviewPage === 1 || activePreviewPage === 2
              ? 'hidden print:hidden' 
              : 'block print:block print:border-none print:m-0 print:p-0'
          }`} style={{ pageBreakBefore: 'always' }}>
            <span className="bg-[#EAEFEA] text-[#236B50] font-bold text-xs px-4 py-1 rounded-full border border-[#C5E5D5] print:hidden relative -top-3 shadow-xs">
              ⬇ PAGE 2: INTERNAL HOTEL COSTING & PROFIT MARGIN AUDIT ⬇
            </span>
          </div>


          {/* =====================================================================
              PAGE 2: INTERNAL COSTING, CHEF INGREDIENTS USED & PROFIT IN PERCENTAGE
              ===================================================================== */}
          <div className={`a4-document-page bg-white text-slate-900 rounded-2xl shadow-xl p-8 sm:p-10 border border-slate-200 max-w-[210mm] mx-auto print:border-none print:shadow-none print:m-0 print:p-0 print:w-full ${
            !canViewCostingOrProfit || !isBalanceSettled || !isArunCostingDone
              ? 'hidden print:hidden'
              : activePreviewPage === 2 || activePreviewPage === 'final_2page'
              ? 'block print:block'
              : 'hidden print:hidden'
          }`}>
            {/* Page indicator header (hidden in print) */}
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 print:hidden">
              <span>Page 2 of 2 — Confidential Internal Costing & Profit Margin Audit</span>
              <span>Crystal Plaza & Casmia (CPH) Hotel Banquets</span>
            </div>

            {/* Page 2 Confidential Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="flex items-center space-x-2 text-rose-800 text-xs font-black tracking-widest uppercase">
                  <Lock className="w-4 h-4" />
                  <span>STRICTLY CONFIDENTIAL — MANAGEMENT & CHEF AUDIT</span>
                </div>
                <h2 className="text-2xl font-black text-slate-950 font-['Plus_Jakarta_Sans'] tracking-tight mt-0.5">
                  BANQUET COSTING & PROFIT ANALYSIS TABLE
                </h2>
                <p className="text-xs text-slate-600 font-medium">
                  Party Reference: <strong className="text-slate-900">{booking.bookingNumber}</strong> • Client: {booking.clientName} ({guests} Guests)
                </p>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Overall Net Margin</div>
                <div className="text-xl font-black font-mono text-[#236B50]">
                  {formatPercent(fin.overallProfitMarginPercent)}
                </div>
                <div className="text-[11px] font-bold text-slate-700">
                  Profit: {formatCurrency(fin.netGrossProfit)}
                </div>
              </div>
            </div>

            {/* Section A: Items Used by Chef for this Specific Party & Priced by Arun (Accounts) */}
            <div className="mb-5">
              <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-300">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                  <ChefHat className="w-3.5 h-3.5 text-[#236B50]" />
                  <span>
                    {booking.costingMethod === 'item_by_item'
                      ? `Dish-by-Dish Food Costing for ${booking.clientName}'s Party (${guests} Guests)`
                      : `Party Buffet Ingredients Logged by Chef Karim & Costed by Accounts (Arun Kumar)`}
                  </span>
                </h3>
                <span className="text-[10px] text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {booking.costingStatus === 'costed_by_arun'
                    ? '✓ Verified by Arun (Accounts)'
                    : booking.costingStatus === 'forwarded_to_accounts'
                    ? 'Forwarded to Accounts (Arun)'
                    : booking.chefUsageLogged
                    ? '✓ Chef Usage Logged'
                    : 'Theoretical Recipe Costing'}
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[10px] uppercase">
                    <tr>
                      <th className="py-1.5 px-3">Item / Ingredient Logged</th>
                      <th className="py-1.5 px-3 text-center text-[#236B50] font-black">Amount Chef Used</th>
                      <th className="py-1.5 px-3 text-right">Arun Purchasing Price</th>
                      <th className="py-1.5 px-3 text-right">Total Cost (AED)</th>
                      <th className="py-1.5 px-3 text-center">Cost Source</th>
                      <th className="py-1.5 px-3">Chef / Audit Observations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                    {booking.chefPartyEntries && booking.chefPartyEntries.length > 0 ? (
                      booking.chefPartyEntries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-sans font-bold text-slate-900">
                            {entry.ingredient}
                            {entry.foodItemName && (
                              <div className="text-[10px] font-normal text-slate-500">Dish: {entry.foodItemName}</div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center font-black text-[#236B50]">
                            {entry.amountUsed}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-700">
                            {entry.purchasingPriceAED !== undefined
                              ? `${formatCurrency(entry.purchasingPriceAED)}/${entry.purchasingUnit || 'unit'}`
                              : 'Pending Arun'}
                          </td>
                          <td className="py-2 px-3 text-right font-black text-slate-900">
                            {entry.calculatedCostAED !== undefined
                              ? formatCurrency(entry.calculatedCostAED)
                              : '-'}
                          </td>
                          <td className="py-2 px-3 text-center font-sans text-[10px]">
                            {entry.priceSource === 'excel_sheet' ? (
                              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">Excel Matched</span>
                            ) : entry.priceSource === 'ocr_scan' ? (
                              <span className="bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-bold">OCR Scanned</span>
                            ) : entry.priceSource === 'master_catalog' ? (
                              <span className="bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-bold">Hotel Catalog</span>
                            ) : (
                              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Accounts Entry</span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-600 text-[10px]">
                            {entry.notes || 'Kitchen buffet batch usage'}
                          </td>
                        </tr>
                      ))
                    ) : booking.chefUsageLogs && booking.chefUsageLogs.length > 0 ? (
                      booking.chefUsageLogs.map((log) => (
                        <tr key={log.ingredientId} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-sans font-bold text-slate-900">{log.ingredientName}</td>
                          <td className="py-2 px-3 text-center font-black text-[#236B50]">{log.actualUsedQuantity} {log.unit}</td>
                          <td className="py-2 px-3 text-right text-slate-700">{formatCurrency(log.unitCost)}/{log.unit}</td>
                          <td className="py-2 px-3 text-right font-black text-slate-900">{formatCurrency(log.actualUsedQuantity * log.unitCost)}</td>
                          <td className="py-2 px-3 text-center font-sans text-[10px]"><span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Recipe Standard</span></td>
                          <td className="py-2 px-3 font-sans text-slate-600 text-[10px]">{log.varianceReason || 'Standard portion'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-3 px-3 text-center text-slate-500 font-sans italic text-xs">
                          Chef actual kitchen logs not yet recorded. Displaying standard recipe ingredient allocations.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-300 text-xs">
                    <tr>
                      <td colSpan={3} className="py-2 px-3 text-slate-800 uppercase font-bold text-[11px]">
                        Total Direct Cooked Food Cost (Raw Ingredients + Kitchen Labor):
                      </td>
                      <td colSpan={3} className="py-2 px-3 text-right font-mono font-black text-[#236B50] text-sm">
                        {formatCurrency(totalFoodCost)} ({guests > 0 ? formatCurrency(totalFoodCost / guests) : '0.00 AED'} / person)
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Section B: The Requested Tabular Comparison Matrix */}
            <div className="mb-5">
              <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-300">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-[#236B50]" />
                  <span>Tabular Financial Matrix: How Much Charged vs Spent vs Profit with %</span>
                </h3>
              </div>

              <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Party Cost & Service Element</th>
                      <th className="py-2.5 px-3 text-right">Client Charged (Got)</th>
                      <th className="py-2.5 px-3 text-right">Hotel Cost Spent</th>
                      <th className="py-2.5 px-3 text-right text-emerald-400">Profit Earned (AED)</th>
                      <th className="py-2.5 px-3 text-right text-amber-300">Profit Margin (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {/* Food Items */}
                    <tr className="bg-emerald-50/40 font-semibold">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">1. Buffet Food Catering ({guests} Guests)</div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          {booking.hasFoodFromHotel ? `${booking.selectedMenuName || selectedPkg?.name || 'Banquet Buffet'} (${booking.foodPricePerGuestCharged} AED / Person)` : 'No Hotel Food'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(fin.foodRevenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                        {formatCurrency(fin.foodCost)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-[#236B50]">
                        +{formatCurrency(fin.foodGrossProfit)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-[#236B50]">
                        {formatPercent(fin.foodMarginPercent)}
                      </td>
                    </tr>

                    {/* Banquet Hall */}
                    <tr>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">2. Banquet Hall Venue & Facility</div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          {booking.hallOffer === 'free_with_food'
                            ? 'Special Offer: Free Banquet Hall with Food'
                            : booking.hallOffer === 'one_side_hall'
                            ? 'One-Side Partition Offer (1,000 AED)'
                            : 'Full Hall Rental Only (1,500 AED)'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                        {booking.hallRentalCharged > 0 ? formatCurrency(booking.hallRentalCharged) : '0.00 AED (Free Offer)'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                        {formatCurrency(fin.hallCost)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {formatCurrency(fin.hallGrossProfit)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {booking.hallRentalCharged > 0 ? formatPercent(fin.hallMarginPercent) : 'Direct OH'}
                      </td>
                    </tr>

                    {/* Beverage Station */}
                    <tr>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">3. Beverage & Water Station</div>
                        <div className="text-[10px] text-slate-500 font-normal">Chilled mineral water & soft drinks inventory</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900">Included in Buffet</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">{formatCurrency(fin.beverageCost)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">-{formatCurrency(fin.beverageCost)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">-</td>
                    </tr>

                    {/* Decor & AV */}
                    <tr>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">4. Staging, Party Sound & Decor</div>
                        <div className="text-[10px] text-slate-500 font-normal">Sound equipment, microphones, cake table</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900">{formatCurrency(fin.decorAndAVRevenue)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">{formatCurrency(fin.decorAndAVCost)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#236B50]">+{formatCurrency(fin.decorAndAVGrossProfit)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#236B50]">
                        {formatPercent(fin.decorAndAVRevenue > 0 ? (fin.decorAndAVGrossProfit / fin.decorAndAVRevenue) * 100 : 0)}
                      </td>
                    </tr>

                    {/* Floor Staffing */}
                    <tr>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">5. Banquet Floor Staffing Overhead</div>
                        <div className="text-[10px] text-slate-500 font-normal">Dedicated captain, buffet runner & server</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">Service Included</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">{formatCurrency(fin.staffingCost)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">-{formatCurrency(fin.staffingCost)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">Direct Staff</td>
                    </tr>

                    {/* Discount if applicable */}
                    {fin.discount > 0 && (
                      <tr className="bg-rose-50 font-bold">
                        <td className="py-2 px-3 text-rose-900">
                          Special Discount Applied (Floor 1,500 AED Respected)
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-rose-900">-{formatCurrency(fin.discount)}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-400">0.00 AED</td>
                        <td className="py-2 px-3 text-right font-mono text-rose-900">-{formatCurrency(fin.discount)}</td>
                        <td className="py-2 px-3 text-right font-mono text-rose-900">-</td>
                      </tr>
                    )}
                  </tbody>

                  {/* Totals Row */}
                  <tfoot className="bg-slate-100 border-t-2 border-slate-900 text-xs font-black">
                    <tr>
                      <td className="py-3 px-3 uppercase text-slate-950 text-sm">
                        GRAND TOTALS FOR THIS BANQUET PARTY:
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-950 text-base">
                        {formatCurrency(fin.subtotalRevenue)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-950 text-base">
                        {formatCurrency(fin.totalDirectCosts)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[#236B50] text-lg">
                        +{formatCurrency(fin.netGrossProfit)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[#236B50] text-base">
                        {formatPercent(fin.overallProfitMarginPercent)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Audit Approvals & Sign-off Block */}
            <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-[10px] text-slate-600">
              <div>
                <div className="h-8 border-b border-slate-400 w-48 mb-1"></div>
                <div className="font-bold text-slate-900">Executive Chef Audit Sign-Off</div>
                <div>Chef Karim Zayani (CPH Culinary Central)</div>
              </div>

              <div className="text-right">
                <div className="h-8 border-b border-slate-400 w-48 ml-auto mb-1"></div>
                <div className="font-bold text-slate-900">Financial Controller & Costing Approval</div>
                <div>Arun Kumar (Accounts & Purchasing Costing Executive)</div>
              </div>
            </div>

          </div>


          {/* =====================================================================
              PAGE 3: OFFICIAL BANQUET FUNCTION PROSPECTUS (FP SHEET)
              1-to-1 Match with Crystal Plaza Hotel Function Prospectus
              ===================================================================== */}
          <div className={`a4-document-page bg-white text-slate-900 rounded-2xl shadow-xl p-6 sm:p-8 border border-slate-300 max-w-[210mm] mx-auto print:border-none print:shadow-none print:m-0 print:p-0 print:w-full font-sans ${
            !isBalanceSettled || activePreviewPage === 3 
              ? 'block print:block' 
              : 'hidden print:hidden'
          }`}>
            {/* Page indicator header (hidden in print) */}
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 print:hidden">
              <span className="flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>Official Function Prospectus (Pre-Party Front-of-House Copy)</span>
              </span>
              <span>Crystal Plaza Hotel Banquets</span>
            </div>

            {/* Bright Yellow Header Bar */}
            <div className="bg-[#FFF44F] border-2 border-black py-2.5 px-4 text-center">
              <h1 className="text-xl sm:text-2xl font-black tracking-widest text-black uppercase font-['Plus_Jakarta_Sans']">
                FUNCTION PROSPECTUS
              </h1>
            </div>

            {/* Header Metadata Grid */}
            <div className="border-x-2 border-b-2 border-black text-xs font-bold divide-y divide-black">
              {/* Row 1: Date of Event & Booking Info */}
              <div className="grid grid-cols-12 divide-x divide-black">
                <div className="col-span-3 p-2 bg-slate-100 text-slate-800 uppercase tracking-wide">
                  DATE OF EVENT
                </div>
                <div className="col-span-4 p-2 font-mono text-sm font-black">
                  {booking.eventDate ? booking.eventDate.split('-').reverse().join('/') : '—'}
                </div>
                <div className="col-span-2 p-2 bg-slate-100 text-slate-800 uppercase text-[11px]">
                  Booking Date
                </div>
                <div className="col-span-3 p-2 text-right">
                  <div className="text-xs font-black text-[#236B50]">
                    {booking.fnbRepresentative || '—'}
                  </div>
                  <div className="font-mono text-[11px] text-slate-600">
                    {booking.bookingDate
                      ? booking.bookingDate.split('-').reverse().join('/')
                      : (booking.createdAt ? booking.createdAt.substring(0, 10).split('-').reverse().join('/') : '—')}
                  </div>
                </div>
              </div>

              {/* Row 2: Function Type */}
              <div className="grid grid-cols-12 divide-x divide-black">
                <div className="col-span-3 p-2 bg-slate-100 text-slate-800 uppercase tracking-wide">
                  FUNCTION TYPE
                </div>
                <div className="col-span-9 p-2 text-sm font-black capitalize">
                  {booking.eventType || '—'}
                </div>
              </div>

              {/* Row 3: Guest Name */}
              <div className="grid grid-cols-12 divide-x divide-black">
                <div className="col-span-3 p-2 bg-slate-100 text-slate-800 uppercase tracking-wide">
                  GUEST NAME
                </div>
                <div className="col-span-9 p-2 text-sm font-black">
                  {booking.clientName || '—'}
                </div>
              </div>

              {/* Row 4: Guest Contact */}
              <div className="grid grid-cols-12 divide-x divide-black">
                <div className="col-span-3 p-2 bg-slate-100 text-slate-800 uppercase tracking-wide">
                  GUEST CONTACT
                </div>
                <div className="col-span-9 p-2 text-sm font-mono font-black text-slate-900">
                  {booking.clientPhone || '—'}
                </div>
              </div>

              {/* Row 5: Operational Timing */}
              <div className="p-2 bg-slate-50 text-right font-black text-xs sm:text-sm tracking-wide">
                <span>TIME : </span>
                <span className="font-mono text-[#236B50] font-black">
                  {booking.eventTimeSpan || '—'}
                </span>
              </div>
            </div>

            {/* Prospectus Main Body: 2-Column Grid (Left: Menu, Right: Logistics) */}
            <div className="border-x-2 border-b-2 border-black grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x-2 divide-black text-xs">
              
              {/* LEFT COLUMN: ITEM-BY-ITEM MENU CATEGORIES (Strictly Francis's logged items — ZERO samples) */}
              <div className="p-4 space-y-3.5">
                {booking.hasFoodFromHotel && booking.selectedMenuName && (
                  <div className="bg-[#E8F5EE] border border-[#C5E5D5] p-2 rounded-lg text-center mb-2">
                    <span className="text-[10px] uppercase font-bold text-[#5A6F66] block">Agreed Banquet Menu</span>
                    <strong className="text-xs text-[#236B50] font-black">{booking.selectedMenuName}</strong>
                    {booking.foodPricePerGuestCharged > 0 && (
                      <span className="text-[10px] text-[#236B50] font-bold block">
                        ({booking.foodPricePerGuestCharged} AED / Person • {guests} Guests)
                      </span>
                    )}
                  </div>
                )}

                {(() => {
                  const hasProspectus = Boolean(booking.prospectusMenu);
                  const complementary = booking.prospectusMenu?.complementary || [];

                  if (!booking.hasFoodFromHotel) {
                    return (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 text-center">
                          <div className="font-black text-slate-900 uppercase tracking-wider text-xs mb-1">
                            Hall Rental Only
                          </div>
                          <div className="text-slate-600 text-[11px]">
                            No hotel buffet food items booked.
                          </div>
                        </div>

                        <div>
                          <div className="font-black text-black uppercase tracking-wider text-xs border-b border-black pb-0.5 mb-1.5">
                            COMPLEMENTARY
                          </div>
                          <div className="text-slate-800 font-semibold pl-1 space-y-0.5">
                            {complementary.length > 0 ? (
                              complementary.map((c, i) => <div key={i}>• {c}</div>)
                            ) : (
                              <div className="text-slate-400 italic font-normal">— None</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const items = booking.selectedFoodItems || [];
                  const menuObj = booking.selectedMenuId ? getBanquetMenuById(booking.selectedMenuId) : undefined;
                  const saladOpts = new Set(
                    menuObj ? menuObj.categories.filter(c => /salad/i.test(c.categoryName)).flatMap(c => c.options || []) : []
                  );
                  const starterSoupOpts = new Set(
                    menuObj
                      ? menuObj.categories.filter(c => /soup|starter/i.test(c.categoryName)).flatMap(c => [
                          ...(c.options || []),
                          ...(c.lines ? c.lines.flatMap(l => l.options) : []),
                        ])
                      : []
                  );
                  const dessertOpts = new Set(
                    menuObj ? menuObj.categories.filter(c => /dessert/i.test(c.categoryName)).flatMap(c => c.options || []) : []
                  );

                  const deriveCategorized = () => {
                    const sal: string[] = [];
                    const str: string[] = [];
                    const veg: string[] = [];
                    const nonVeg: string[] = [];
                    const des: string[] = [];
                    const nonVegRe = /chicken|lamb|mutton|beef|fish|prawn|shrimp|adobo|calderetta|non veg|biryani \(non veg\)|meat/i;
                    items.forEach(item => {
                      if (saladOpts.has(item) || /salad|hummus|tabouleh|chaat|fattoush/i.test(item)) {
                        sal.push(item);
                      } else if (starterSoupOpts.has(item) || /roll|saute|cutlet|kebab|tikka(?! masala)|skewers|sticks|finger|manchurian|soup|lentil|sour|manchow|cream of mushroom|broth/i.test(item)) {
                        str.push(item);
                      } else if (dessertOpts.has(item) || /mousse|caramel|tart|jamun|cake|basbousa|basboosa|kheer|halwa|rasmalai|pudding|umm ali/i.test(item)) {
                        des.push(item);
                      } else if (nonVegRe.test(item)) {
                        nonVeg.push(item);
                      } else {
                        veg.push(item);
                      }
                    });
                    return { sal, str, veg, nonVeg, des };
                  };

                  const derived = deriveCategorized();
                  const prospectusTotalCount =
                    (booking.prospectusMenu?.salads?.length || 0) +
                    (booking.prospectusMenu?.starters?.length || 0) +
                    (booking.prospectusMenu?.vegMainCourse?.length || 0) +
                    (booking.prospectusMenu?.nonVegMainCourse?.length || 0) +
                    (booking.prospectusMenu?.desserts?.length || 0);

                  const useSavedProspectus = hasProspectus && (prospectusTotalCount > 0 || items.length === 0);
                  const salads = useSavedProspectus ? (booking.prospectusMenu?.salads || []) : derived.sal;
                  const starters = useSavedProspectus ? (booking.prospectusMenu?.starters || []) : derived.str;
                  const vegMain = useSavedProspectus ? (booking.prospectusMenu?.vegMainCourse || []) : derived.veg;
                  const nonVegMain = useSavedProspectus ? (booking.prospectusMenu?.nonVegMainCourse || []) : derived.nonVeg;
                  const desserts = useSavedProspectus ? (booking.prospectusMenu?.desserts || []) : derived.des;

                  return (
                    <>
                      {/* 1. Salad */}
                      <div>
                        <div className="font-black text-black uppercase tracking-wider text-xs border-b border-black pb-0.5 mb-1.5 flex justify-between">
                          <span>SALAD</span>
                          {salads.length > 0 && <span className="text-[10px] text-slate-500 font-mono font-normal">({salads.length} items)</span>}
                        </div>
                        <ul className="space-y-0.5 text-slate-900 font-semibold pl-1">
                          {salads.length > 0 ? (
                            salads.map((s, i) => (
                              <li key={i} className="capitalize">• {s}</li>
                            ))
                          ) : (
                            <li className="text-slate-400 italic font-normal">— None selected</li>
                          )}
                        </ul>
                      </div>

                      {/* 2. Starter / Soups */}
                      <div>
                        <div className="font-black text-black uppercase tracking-wider text-xs border-b border-black pb-0.5 mb-1.5 flex justify-between">
                          <span>STARTER / SOUPS</span>
                          {starters.length > 0 && <span className="text-[10px] text-slate-500 font-mono font-normal">({starters.length} items)</span>}
                        </div>
                        <ul className="space-y-0.5 text-slate-900 font-semibold pl-1">
                          {starters.length > 0 ? (
                            starters.map((s, i) => (
                              <li key={i} className="capitalize">• {s}</li>
                            ))
                          ) : (
                            <li className="text-slate-400 italic font-normal">— None selected</li>
                          )}
                        </ul>
                      </div>

                      {/* 3. Veg Main Course & Sides */}
                      <div>
                        <div className="font-black text-black uppercase tracking-wider text-xs border-b border-black pb-0.5 mb-1.5 flex justify-between">
                          <span>VEG MAIN COURSE & SIDES</span>
                          {vegMain.length > 0 && <span className="text-[10px] text-slate-500 font-mono font-normal">({vegMain.length} items)</span>}
                        </div>
                        <ul className="space-y-0.5 text-slate-900 font-semibold pl-1">
                          {vegMain.length > 0 ? (
                            vegMain.map((s, i) => (
                              <li key={i} className="capitalize">• {s}</li>
                            ))
                          ) : (
                            <li className="text-slate-400 italic font-normal">— None selected</li>
                          )}
                        </ul>
                      </div>

                      {/* 4. Non-Veg Main Course */}
                      <div>
                        <div className="font-black text-black uppercase tracking-wider text-xs border-b border-black pb-0.5 mb-1.5 flex justify-between">
                          <span>NON VEG MAIN COURSE</span>
                          {nonVegMain.length > 0 && <span className="text-[10px] text-slate-500 font-mono font-normal">({nonVegMain.length} items)</span>}
                        </div>
                        <ul className="space-y-0.5 text-slate-900 font-semibold pl-1">
                          {nonVegMain.length > 0 ? (
                            nonVegMain.map((s, i) => (
                              <li key={i} className="capitalize font-bold text-slate-950">• {s}</li>
                            ))
                          ) : (
                            <li className="text-slate-400 italic font-normal">— None selected</li>
                          )}
                        </ul>
                      </div>

                      {/* 5. Desserts */}
                      <div>
                        <div className="font-black text-black uppercase tracking-wider text-xs border-b border-black pb-0.5 mb-1.5 flex justify-between">
                          <span>DESSERTS</span>
                          {desserts.length > 0 && <span className="text-[10px] text-slate-500 font-mono font-normal">({desserts.length} items)</span>}
                        </div>
                        <ul className="space-y-0.5 text-slate-900 font-semibold pl-1">
                          {desserts.length > 0 ? (
                            desserts.map((s, i) => (
                              <li key={i} className="capitalize">• {s}</li>
                            ))
                          ) : (
                            <li className="text-slate-400 italic font-normal">— None selected</li>
                          )}
                        </ul>
                      </div>

                      {/* 6. Complementary */}
                      <div>
                        <div className="font-black text-black uppercase tracking-wider text-xs border-b border-black pb-0.5 mb-1.5">
                          COMPLEMENTARY
                        </div>
                        <div className="text-slate-800 font-semibold pl-1 space-y-0.5">
                          {complementary.length > 0 ? (
                            complementary.map((c, i) => (
                              <div key={i}>• {c}</div>
                            ))
                          ) : (
                            <div className="text-slate-400 italic font-normal">— None</div>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* RIGHT COLUMN: OPERATIONAL SETUP & LOGISTICS (Strictly Francis's logged values) */}
              <div className="p-4 space-y-4">
                {/* Food Pickup Time */}
                <div className="flex justify-between items-center py-1.5 border-b border-slate-300">
                  <span className="font-black uppercase tracking-wider text-black">FOOD PICKUP</span>
                  <span className="font-mono font-black text-sm text-[#236B50]">
                    {booking.foodPickupTime || '—'}
                  </span>
                </div>

                {/* Sound System */}
                <div className="flex justify-between items-center py-1.5 border-b border-slate-300">
                  <span className="font-black uppercase tracking-wider text-black">SOUND SYSTEM</span>
                  <span className="font-bold uppercase text-slate-900">
                    {booking.soundSystem !== undefined && booking.soundSystem !== '' ? String(booking.soundSystem) : '—'}
                  </span>
                </div>

                {/* Projector & Laptop Requirement */}
                <div className="py-1.5 border-b border-slate-300">
                  <div className="flex justify-between items-center">
                    <span className="font-black uppercase tracking-wider text-black">PROJECTOR</span>
                    <span className="font-bold uppercase text-slate-900">
                      {booking.projector !== undefined && booking.projector !== '' ? String(booking.projector) : '—'}
                    </span>
                  </div>
                  {booking.projectorNotes && (
                    <div className="mt-1 text-[11px] font-black text-rose-700 uppercase tracking-tight">
                      {booking.projectorNotes}
                    </div>
                  )}
                </div>

                {/* Decorations */}
                <div className="flex justify-between items-center py-1.5 border-b border-slate-300">
                  <span className="font-black uppercase tracking-wider text-black">DECORATIONS</span>
                  <span className="font-bold text-slate-900">
                    {booking.decorations !== undefined && booking.decorations !== '' ? String(booking.decorations) : '—'}
                    {(booking.decorations === 'Yes' || booking.decorations === true) && (booking.decorAndAVCharged || 0) > 0 && (
                      <span className="text-emerald-800 ml-1.5 font-mono text-[11px]">
                        (+{formatCurrency(booking.decorAndAVCharged)})
                      </span>
                    )}
                  </span>
                </div>

                {/* Table Cloth */}
                <div className="flex justify-between items-center py-1.5 border-b border-slate-300">
                  <span className="font-black uppercase tracking-wider text-black">TABLE CLOTH</span>
                  <span className="font-bold uppercase text-slate-900 capitalize">
                    {booking.tableClothColor || '—'}
                  </span>
                </div>

                {/* Venue Floor */}
                <div className="flex justify-between items-center py-1.5 border-b border-slate-300">
                  <span className="font-black uppercase tracking-wider text-black">VENUE</span>
                  <span className="font-black text-slate-950 uppercase">
                    {booking.venueFloor || booking.hallName || '—'}
                  </span>
                </div>

                {/* Seating Style */}
                <div className="flex justify-between items-center py-1.5 border-b border-slate-300">
                  <span className="font-black uppercase tracking-wider text-black">SEATING</span>
                  <span className="font-black text-slate-950 uppercase">
                    {booking.seatingStyle || '—'}
                  </span>
                </div>

                {/* Stage Placement */}
                <div className="flex justify-between items-center py-1.5 border-b border-slate-300">
                  <span className="font-black uppercase tracking-wider text-black">STAGE</span>
                  <span className="font-bold uppercase text-slate-900">
                    {booking.stagePosition || '—'}
                  </span>
                </div>

                {/* Buffet Placement */}
                <div className="flex justify-between items-center py-1.5 border-b border-slate-300">
                  <span className="font-black uppercase tracking-wider text-black">BUFFET</span>
                  <span className="font-bold uppercase text-slate-900">
                    {booking.buffetPosition || '—'}
                  </span>
                </div>
              </div>

            </div>

            {/* Bottom Financials & Payment Terms Block (Strictly Pre-Party FP Sheet — Never Altered After Party) */}
            <div className="border-x-2 border-b-2 border-black grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x-2 divide-black text-xs font-bold">
              {/* Left Column: Pre-Party Price Per Head, Total Bill, Advance & Balance to Pay */}
              <div className="md:col-span-5 p-3 space-y-1.5 bg-slate-50 font-mono">
                <div className="flex justify-between text-slate-800">
                  <span className="font-sans font-black uppercase text-black">PRICE/HEAD</span>
                  <span className="font-bold text-sm">
                    {booking.hasFoodFromHotel ? `${booking.foodPricePerGuestCharged || 0} AED` : 'Hall Only'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-800">
                  <span className="font-sans font-black uppercase text-black">ADULTS</span>
                  <span className="font-bold">
                    {booking.adultsCount !== undefined ? booking.adultsCount : (booking.guestCount ?? '—')}
                  </span>
                </div>
                <div className="flex justify-between text-slate-800">
                  <span className="font-sans font-black uppercase text-black">KIDS</span>
                  <span className="font-bold">{booking.kidsCount !== undefined ? booking.kidsCount : '—'}</span>
                </div>
                {fin.hallRevenue > 0 && (
                  <div className="flex justify-between text-slate-700 text-[11px]">
                    <span className="font-sans font-bold uppercase">HALL RENTAL</span>
                    <span>+{formatCurrency(fin.hallRevenue)}</span>
                  </div>
                )}
                {fin.decorAndAVRevenue > 0 && (
                  <div className="flex justify-between text-slate-700 text-[11px]">
                    <span className="font-sans font-bold uppercase">DECOR / AV</span>
                    <span>+{formatCurrency(fin.decorAndAVRevenue)}</span>
                  </div>
                )}
                {fin.beverageRevenue > 0 && (
                  <div className="flex justify-between text-slate-700 text-[11px]">
                    <span className="font-sans font-bold uppercase">BEVERAGES</span>
                    <span>+{formatCurrency(fin.beverageRevenue)}</span>
                  </div>
                )}
                {fin.extrasRevenue > 0 && Math.abs(fpFin.fpTotalBill - grandTotal) <= 0.01 && (
                  <div className="flex justify-between text-slate-700 text-[11px]">
                    <span className="font-sans font-bold uppercase">EXTRA CHARGES</span>
                    <span>+{formatCurrency(fin.extrasRevenue)}</span>
                  </div>
                )}
                {fin.discount > 0 && Math.abs(fpFin.fpTotalBill - grandTotal) <= 0.01 && (
                  <div className="flex justify-between text-rose-700 text-[11px]">
                    <span className="font-sans font-bold uppercase">DISCOUNT</span>
                    <span>-{formatCurrency(fin.discount)}</span>
                  </div>
                )}
                {(fin.serviceCharge + fin.municipalityFee + fin.taxAmount) > 0 && (
                  <div className="flex justify-between text-slate-700 text-[11px]">
                    <span className="font-sans font-bold uppercase">TAXES & SERVICE</span>
                    <span>+{formatCurrency(fin.serviceCharge + fin.municipalityFee + fin.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-slate-300 text-black font-black text-sm">
                  <span className="font-sans uppercase">TOTAL BILL</span>
                  <span>{formatCurrency(fpFin.fpTotalBill)}</span>
                </div>
                <div className="flex justify-between text-[#236B50] font-black">
                  <span className="font-sans uppercase">ADVANCE</span>
                  <span>
                    {formatCurrency(fpFin.fpAdvancePaid)}
                    {fpFin.fpAdvanceMode ? ` (${fpFin.fpAdvanceMode})` : ''}
                  </span>
                </div>
                <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-300 text-rose-800">
                  <span className="font-sans uppercase">BALANCE TO PAY</span>
                  <span>{formatCurrency(fpFin.fpBalanceToPay)}</span>
                </div>
              </div>

              {/* Right Column: Pre-Party Payment Terms Notice & Signatures */}
              <div className="md:col-span-7 p-4 flex flex-col justify-between space-y-4">
                <div className="border-2 p-3 rounded-lg text-center bg-rose-50 border-rose-600">
                  <div className="text-xs sm:text-sm font-black uppercase tracking-tight leading-snug text-rose-950">
                    {booking.paymentTermsNotice || '—'}
                  </div>
                </div>

                {/* 3-Party Signatures: Guest, Supervisor, Manager */}
                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-black text-center text-[10px] text-slate-700">
                  <div>
                    <div className="h-7 border-b border-dashed border-slate-500 mb-1"></div>
                    <div className="font-black uppercase text-black">Guest</div>
                    <div className="text-[9px] text-slate-500 truncate">{booking.clientName || '—'}</div>
                  </div>

                  <div>
                    <div className="h-7 border-b border-dashed border-slate-500 mb-1"></div>
                    <div className="font-black uppercase text-black">Supervisor</div>
                    <div className="text-[9px] text-[#236B50] font-bold">
                      {booking.fnbRepresentative || '—'}
                    </div>
                  </div>

                  <div>
                    <div className="h-7 border-b border-dashed border-slate-500 mb-1"></div>
                    <div className="font-black uppercase text-black">Manager</div>
                    <div className="text-[9px] text-slate-600 font-semibold">General Manager</div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
