import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  CreditCard, 
  Calendar, 
  Users, 
  Building2, 
  Sparkles,
  ArrowRight,
  Receipt,
  FileCheck
} from 'lucide-react';
import { BookingEvent, UserProfile } from '../types';
import { formatCurrency, getBookingPaymentSummary } from '../utils/costCalculations';

interface PartyDatePaymentSettlementModalProps {
  booking: BookingEvent;
  currentUser: UserProfile;
  onClose: () => void;
  onSettlePayment: (
    bookingId: string, 
    newTotalAmount: number, 
    newDepositPaid: number, 
    paymentMethod: string, 
    notes: string,
    markPartyEnded?: boolean
  ) => void;
}

export const PartyDatePaymentSettlementModal: React.FC<PartyDatePaymentSettlementModalProps> = ({
  booking,
  currentUser,
  onClose,
  onSettlePayment,
}) => {
  // Unified financials
  const paySummary = getBookingPaymentSummary(booking);
  const currentTotal = paySummary.totalBill;

  const [agreedAmount, setAgreedAmount] = useState<number>(currentTotal);
  const [depositSoFar] = useState<number>(paySummary.totalPaid);
  const [newPaymentAmount, setNewPaymentAmount] = useState<number>(paySummary.balanceToPay);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash on Arrival');
  const [guestCountAdjusted, setGuestCountAdjusted] = useState<number>(booking.guestCount);
  const [settlementNotes, setSettlementNotes] = useState<string>('Full balance settled with F&B Supervisor Francis on party arrival.');
  const [confirmPartyEnded, setConfirmPartyEnded] = useState<boolean>(!booking.partyEnded);

  const outstandingRemaining = Math.max(0, parseFloat((agreedAmount - (depositSoFar + newPaymentAmount)).toFixed(2)));
  const isSettlingInFull = outstandingRemaining <= 0.01;

  const handleConfirm = () => {
    const finalTotalPaid = depositSoFar + newPaymentAmount;
    onSettlePayment(
      booking.id,
      agreedAmount,
      finalTotalPaid,
      paymentMethod,
      settlementNotes,
      confirmPartyEnded && isSettlingInFull
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-[#D5E5DE] my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 bg-[#F6FAF8] border-b border-[#E2ECE7] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-[#192A24] text-base">
                  Party Date Arrival & Balance Settlement
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  Party Today!
                </span>
              </div>
              <p className="text-xs text-[#52685F]">
                F&B Supervisor Francis • Update Final Price & Confirm Guest Payment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          
          {/* Party Overview Card */}
          <div className="bg-[#F8FAF9] rounded-2xl p-4 border border-[#E2ECE7] space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#236B50]">Client Name</span>
                <div className="text-base font-black text-[#192A24]">{booking.clientName}</div>
                <div className="text-xs text-slate-500">{booking.clientPhone} • {booking.bookingNumber}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#236B50]">Party Date</span>
                <div className="text-sm font-black text-[#192A24]">{booking.eventDate}</div>
                <div className="text-xs text-slate-500 capitalize">{booking.timeSlot} • {booking.hallName}</div>
              </div>
            </div>

            {/* Advance Status Bar */}
            <div className="pt-2 border-t border-slate-200 grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Agreed Total</div>
                <div className="text-xs font-black text-slate-900">{agreedAmount.toFixed(2)} AED</div>
              </div>
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-[10px] text-emerald-700 font-bold uppercase">Advance Paid</div>
                <div className="text-xs font-black text-emerald-800">{depositSoFar.toFixed(2)} AED</div>
              </div>
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-[10px] text-amber-700 font-bold uppercase">Due Today</div>
                <div className="text-xs font-black text-amber-900">
                  {Math.max(0, agreedAmount - depositSoFar).toFixed(2)} AED
                </div>
              </div>
            </div>
          </div>

          {/* Form Fields: Update Final Price & Record Payment */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Final Agreed Event Price (AED)
                <span className="text-[11px] font-normal text-slate-500 ml-1.5">
                  (Francis can adjust price if guest count changed or extra services added)
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={agreedAmount}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setAgreedAmount(val);
                    setNewPaymentAmount(Math.max(0, val - depositSoFar));
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#236B50] font-bold text-slate-900"
                />
                <span className="absolute right-4 top-2.5 text-xs font-bold text-slate-400">AED</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Amount Being Collected Now (AED)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={newPaymentAmount}
                  onChange={(e) => setNewPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#236B50] font-bold text-emerald-700"
                />
                <button
                  type="button"
                  onClick={() => setNewPaymentAmount(Math.max(0, agreedAmount - depositSoFar))}
                  className="absolute right-2 top-1.5 px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Pay Remaining Full
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Payment Collection Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#236B50] text-xs font-semibold text-slate-800"
                >
                  <option value="Cash on Arrival">Cash on Arrival (Front Desk)</option>
                  <option value="Credit / Debit Card (POS)">Credit / Debit Card (POS Machine)</option>
                  <option value="Bank Transfer">Bank Transfer / Fast Wire</option>
                  <option value="Payment Gateway Link">Online Payment Gateway</option>
                  <option value="Hotel Corporate Account">Hotel Corporate Account</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Final Balance Remaining After Payment
                </label>
                <div className={`p-2.5 rounded-xl border text-center font-bold text-xs ${
                  isSettlingInFull 
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-900' 
                    : 'bg-amber-100 border-amber-300 text-amber-900'
                }`}>
                  {isSettlingInFull ? '0.00 AED • FULLY SETTLED' : `${outstandingRemaining.toFixed(2)} AED OUTSTANDING`}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Settlement Notes / Remarks
              </label>
              <input
                type="text"
                value={settlementNotes}
                onChange={(e) => setSettlementNotes(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#236B50] text-xs text-slate-800"
                placeholder="e.g. Full settlement received by Francis D'Souza at guest arrival"
              />
            </div>

            {/* Francis Party Ended Option (Enforces Full Settlement First) */}
            <div className="pt-2 border-t border-slate-200">
              <label className={`flex items-start space-x-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                confirmPartyEnded ? 'bg-[#E8F5EE] border-[#236B50]' : 'bg-slate-50 border-slate-200'
              }`}>
                <input
                  type="checkbox"
                  checked={confirmPartyEnded}
                  disabled={!isSettlingInFull}
                  onChange={(e) => setConfirmPartyEnded(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-[#236B50] rounded focus:ring-[#236B50]"
                />
                <div className="text-xs">
                  <span className="font-extrabold text-[#192A24] block">
                    🏁 Mark Party as Ended / Concluded (Notifies Chef Karim immediately)
                  </span>
                  <span className="text-[11px] text-[#5A6F66]">
                    {isSettlingInFull 
                      ? 'Balance will be 100% settled. This will unlock the BEO sheet and move the party to Chef Karim\'s kitchen logging queue.' 
                      : '⚠️ Requires 100% settled balance. Francis must collect the full remaining balance before confirming the party has ended.'}
                  </span>
                </div>
              </label>
            </div>

          </div>

          {/* Quick Notice */}
          <div className="bg-emerald-50 rounded-2xl p-3.5 border border-emerald-200 flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900">
              <span className="font-bold">Automatic Synchronization:</span> Confirming this payment will immediately update the booking deposit, issue the final receipt in Invoices, and log Francis D'Souza's action in the security audit.
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#F6FAF8] border-t border-[#E2ECE7] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleConfirm}
            className="px-6 py-2.5 rounded-full bg-[#236B50] hover:bg-[#1C5740] text-white text-xs font-bold shadow-md shadow-[#236B50]/20 transition-all flex items-center space-x-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm Full Payment Handled</span>
          </button>
        </div>

      </div>
    </div>
  );
};
