import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  Coins, 
  Banknote, 
  CreditCard, 
  Building2, 
  Receipt, 
  Calendar, 
  Users, 
  ShieldCheck,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { BookingEvent, UserProfile, PaymentRecord } from '../types';
import { getBookingPaymentSummary, getFunctionProspectusFinancials, formatCurrency } from '../utils/costCalculations';
import { AppStorage } from '../services/storage';

interface QuickCashSettlementModalProps {
  booking: BookingEvent | null;
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSettled: (updatedBooking: BookingEvent, payment: PaymentRecord) => void;
}

export const QuickCashSettlementModal: React.FC<QuickCashSettlementModalProps> = ({
  booking,
  currentUser,
  isOpen,
  onClose,
  onSettled,
}) => {
  if (!isOpen || !booking) return null;

  const paySummary = getBookingPaymentSummary(booking);
  const totalPaid = paySummary.totalPaid;
  const grandTotal = paySummary.totalBill;
  const balanceDue = paySummary.balanceToPay;

  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Card' | 'Bank Transfer'>('Cash');
  const [amountCollected, setAmountCollected] = useState<number>(balanceDue);
  const [memo, setMemo] = useState<string>(
    `Cash balance settled upon party conclusion with F&B Supervisor Francis D'Souza.`
  );
  const [markFullySettled, setMarkFullySettled] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isFullSettlement = amountCollected >= balanceDue - 0.01;
  const remainingAfterPayment = Math.max(0, balanceDue - amountCollected);

  const handleConfirmSettlement = () => {
    if (amountCollected <= 0) {
      alert('Please enter a valid settlement amount greater than 0 AED.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Capture pre-settlement FP values so Function Prospectus remains unchanged
      const preFp = getFunctionProspectusFinancials(booking);

      // 1. Record payment in storage
      const payment = AppStorage.addPayment(
        booking.id,
        {
          date: new Date().toISOString().substring(0, 10),
          amount: parseFloat(amountCollected.toFixed(2)),
          paymentType: 'balance',
          paymentMode,
          receivedBy: currentUser.name || "Francis D'Souza",
          notes: memo,
        },
        currentUser
      );

      // 2. Refresh booking and mark finalPaymentConfirmed if settled
      const currentBookings = AppStorage.getBookings();
      const targetIndex = currentBookings.findIndex(b => b.id === booking.id);
      
      let finalBooking = booking;
      if (targetIndex !== -1) {
        const target = currentBookings[targetIndex];
        const refreshed = getBookingPaymentSummary(target);
        const finalSettled = markFullySettled || refreshed.balanceToPay <= 0.01;

        const updated: BookingEvent = {
          ...target,
          fpPrePartyTotalBill: target.fpPrePartyTotalBill ?? preFp.fpTotalBill,
          fpPrePartyAdvancePaid: target.fpPrePartyAdvancePaid ?? preFp.fpAdvancePaid,
          fpPrePartyAdvanceMode: target.fpPrePartyAdvanceMode ?? (preFp.fpAdvanceMode || undefined),
          depositPaid: refreshed.totalPaid,
          totalBillPayable: refreshed.totalBill,
          finalPaymentConfirmed: finalSettled,
          balanceToPay: refreshed.balanceToPay,
        };

        currentBookings[targetIndex] = updated;
        AppStorage.setBookings(currentBookings);
        finalBooking = updated;

        // 3. Dismiss any active mandatory settlement notifications for this booking
        const notifications = AppStorage.getNotifications();
        const updatedNotifs = notifications.filter(
          n => !(n.bookingId === booking.id && (n.type === 'mandatory_settle_balance' || n.actionRequired === 'settle_balance'))
        );
        AppStorage.setNotifications(updatedNotifs);

        // 4. Audit Log
        AppStorage.addAuditLog(
          'Balance Settled by Cash',
          `${currentUser.name} successfully collected ${amountCollected.toFixed(2)} AED (${paymentMode}) for ${booking.bookingNumber} (${booking.clientName}). Balance fully settled without requiring invoice creation. Receipt #${payment.receiptNumber}.`,
          'Invoice',
          currentUser
        );
      }

      onSettled(finalBooking, payment);
      onClose();
    } catch (err: any) {
      alert(`Error settling payment: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div 
        className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border-2 border-emerald-500/30 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-[#1C5740] text-white flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs text-white flex items-center justify-center shadow-inner">
              <Banknote className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-black text-lg text-white">
                  Quick Cash Balance Settlement
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-400 text-emerald-950 uppercase">
                  1-Click Settle
                </span>
              </div>
              <p className="text-xs text-emerald-100 font-medium">
                Direct Cash Reception for Concluded Parties • No Invoice Required
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          
          {/* Booking Summary Card */}
          <div className="bg-[#F6FAF8] rounded-2xl p-4 border border-[#D5E5DE] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#236B50]">
                    Guest / Party
                  </span>
                  <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900">
                    {booking.bookingNumber}
                  </span>
                </div>
                <div className="text-base font-black text-[#192A24] mt-0.5">
                  {booking.clientName}
                </div>
                <div className="text-xs text-[#5A6F66]">
                  {booking.clientPhone} • {booking.hallName}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#236B50]">
                  Concluded Date
                </span>
                <div className="text-sm font-black text-[#192A24] mt-0.5">
                  {booking.eventDate}
                </div>
                <div className="text-xs text-[#5A6F66] capitalize">
                  {booking.guestCount} Guests • {booking.timeSlot || 'Evening'}
                </div>
              </div>
            </div>

            {/* Financial Ledger Mini-Bar */}
            <div className="pt-3 border-t border-[#D5E5DE] grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Total Bill</div>
                <div className="text-xs font-black text-slate-900 mt-0.5">
                  AED {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-[10px] text-emerald-700 font-bold uppercase">Advance Paid</div>
                <div className="text-xs font-black text-emerald-800 mt-0.5">
                  AED {totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300">
                <div className="text-[10px] text-rose-700 font-black uppercase">Outstanding Due</div>
                <div className="text-xs font-black text-rose-800 mt-0.5">
                  AED {balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-[#192A24]">
              Payment Collection Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMode('Cash')}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center space-y-1.5 cursor-pointer transition-all ${
                  paymentMode === 'Cash'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-black ring-2 ring-emerald-500/30'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  paymentMode === 'Cash' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  <Banknote className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="text-xs">Cash (Direct)</span>
                <span className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider">Most Common</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode('Card')}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center space-y-1.5 cursor-pointer transition-all ${
                  paymentMode === 'Card'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-black ring-2 ring-emerald-500/30'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  paymentMode === 'Card' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  <CreditCard className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="text-xs">Card / POS</span>
                <span className="text-[9px] text-slate-400 font-medium">Terminal Slip</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode('Bank Transfer')}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center space-y-1.5 cursor-pointer transition-all ${
                  paymentMode === 'Bank Transfer'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-black ring-2 ring-emerald-500/30'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  paymentMode === 'Bank Transfer' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  <Building2 className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="text-xs">Bank Transfer</span>
                <span className="text-[9px] text-slate-400 font-medium">Wire / Online</span>
              </button>
            </div>
          </div>

          {/* Amount Received Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-[#192A24]">
                Cash Amount Received from Client (AED)
              </label>
              <button
                type="button"
                onClick={() => setAmountCollected(balanceDue)}
                className="text-[11px] font-black text-[#236B50] hover:underline cursor-pointer"
              >
                Set Exact Balance (AED {balanceDue.toLocaleString()})
              </button>
            </div>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                value={amountCollected || ''}
                onChange={(e) => setAmountCollected(parseFloat(e.target.value) || 0)}
                className="w-full pl-4 pr-16 py-3 rounded-2xl border-2 border-emerald-600 bg-emerald-50/30 text-xl font-mono font-black text-[#192A24] focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
                placeholder="0.00"
              />
              <span className="absolute right-4 top-3.5 text-xs font-black text-[#236B50]">
                AED
              </span>
            </div>

            {/* Remaining status */}
            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <span className="text-[#5A6F66]">
                Balance after this receipt:
              </span>
              <span className={`font-black ${
                isFullSettlement ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                {isFullSettlement 
                  ? 'AED 0.00 (100% Fully Settled)' 
                  : `AED ${remainingAfterPayment.toFixed(2)} Remaining`}
              </span>
            </div>
          </div>

          {/* Received By and Memo */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-[#192A24]">
              Cash Memo & Supervisor Signature
            </label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="e.g. Cash balance collected upon party conclusion by Francis"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#236B50]"
            />
            <div className="flex items-center space-x-1.5 text-[11px] text-[#5A6F66] pt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#236B50]" />
              <span>Receiving Officer: <strong>{currentUser.name}</strong> ({currentUser.role.replace('_', ' ')})</span>
            </div>
          </div>

          {/* Auto-confirmation Checkbox */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={markFullySettled}
                onChange={(e) => setMarkFullySettled(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
              />
              <div className="text-xs">
                <span className="font-black text-emerald-950 block">
                  Mark Party as Fully Settled & Dismiss Mandatory Alert
                </span>
                <span className="text-[11px] text-emerald-800">
                  Instant closure: No need to open invoice or generate invoice PDFs. Updates ledger, issues receipt #, and logs Francis in audit trail.
                </span>
              </div>
            </label>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#F6FAF8] border-t border-[#D5E5DE] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmSettlement}
            disabled={isSubmitting || amountCollected <= 0}
            className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            <span>
              {isSubmitting 
                ? 'Processing Settlement...' 
                : `Confirm Cash Receipt of AED ${amountCollected.toLocaleString()} & Settle`}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
