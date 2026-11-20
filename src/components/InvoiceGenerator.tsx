import React, { useState } from 'react';
import { 
  FileText, 
  Printer, 
  CheckCircle2, 
  TrendingUp, 
  Building, 
  Calendar, 
  Users, 
  CreditCard, 
  ShieldCheck, 
  Lock, 
  Sparkles,
  QrCode
} from 'lucide-react';
import { Invoice, BookingEvent, UserProfile, BanquetPackage, RecipeMenuItem } from '../types';
import { calculateEventFinancials, formatCurrency, formatPercent, getBookingPaymentSummary } from '../utils/costCalculations';

interface InvoiceGeneratorProps {
  invoices: Invoice[];
  bookings: BookingEvent[];
  packages: BanquetPackage[];
  recipes: RecipeMenuItem[];
  currentUser: UserProfile;
  initialSelectedBookingId?: string;
  onSaveInvoice: (invoice: Invoice) => void;
  onUpdatePaymentStatus: (invoiceId: string, status: Invoice['status'], depositPaid: number) => void;
}

export const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = ({
  invoices,
  bookings,
  packages,
  recipes,
  currentUser,
  initialSelectedBookingId,
  onSaveInvoice,
  onUpdatePaymentStatus,
}) => {
  const [selectedBookingId, setSelectedBookingId] = useState<string>(
    initialSelectedBookingId || bookings[0]?.id || ''
  );
  const [viewMode, setViewMode] = useState<'client_invoice' | 'internal_audit'>('client_invoice');
  const [paymentAmountInput, setPaymentAmountInput] = useState<number>(0);

  const selectedBooking = bookings.find(b => b.id === selectedBookingId) || bookings[0];
  const existingInvoice = invoices.find(i => i.bookingId === selectedBooking?.id);

  // Financials for this booking (single source of truth synced with Ledger & BEO/FP)
  const fin = selectedBooking ? calculateEventFinancials(selectedBooking) : null;
  const paymentSummary = selectedBooking ? getBookingPaymentSummary(selectedBooking) : null;

  // Selected package info
  const selectedPkg = packages.find(p => p.id === selectedBooking?.packageId);
  const resolvedBuffetLabel =
    selectedBooking?.selectedMenuName ||
    selectedPkg?.name ||
    (selectedBooking?.hasFoodFromHotel ? 'Banquet Buffet Menu' : 'Hall Rental Only');

  const handlePrint = () => {
    window.print();
  };

  const buildInvoiceObject = (overridePaid?: number): Invoice | null => {
    if (!selectedBooking || !fin || !paymentSummary) return null;
    const totalBilled = paymentSummary.totalBill;
    const paidAmount = overridePaid !== undefined ? overridePaid : paymentSummary.totalPaid;
    const balanceRemaining = Math.max(0, totalBilled - paidAmount);

    return {
      id: existingInvoice ? existingInvoice.id : `inv_${Date.now()}`,
      invoiceNumber: existingInvoice ? existingInvoice.invoiceNumber : `CPH-INV-${selectedBooking.bookingNumber.slice(-5)}`,
      bookingId: selectedBooking.id,
      issueDate: new Date().toISOString().substring(0, 10),
      dueDate: selectedBooking.eventDate,
      status: balanceRemaining <= 0.01 ? 'Paid' : paidAmount > 0 ? 'Partially Paid' : 'Issued',
      branch: selectedBooking.branch,
      clientName: selectedBooking.clientName,
      clientEmail: selectedBooking.clientEmail,
      clientPhone: selectedBooking.clientPhone,
      clientAddress: selectedBooking.clientCompany || selectedBooking.branch,
      hallName: selectedBooking.hallName,
      eventDate: selectedBooking.eventDate,
      guestCount: selectedBooking.guestCount,
      buffetTier: resolvedBuffetLabel,
      hallRental: fin.hallRevenue,
      foodAndBeverageTotal: fin.foodRevenue + fin.beverageRevenue,
      decorAndAVTotal: fin.decorAndAVRevenue,
      staffAndServiceTotal: fin.extrasRevenue,
      subtotal: fin.subtotalRevenue,
      discount: fin.discount,
      serviceCharge: fin.serviceCharge,
      municipalityFee: fin.municipalityFee,
      taxAmount: fin.taxAmount,
      grandTotal: totalBilled,
      depositPaid: paidAmount,
      balanceDue: balanceRemaining,
      internalTotalCost: fin.totalDirectCosts,
      internalGrossProfit: fin.netGrossProfit,
      internalProfitMarginPercent: fin.overallProfitMarginPercent,
      internalFoodCostPercent: fin.foodCostPercent,
    };
  };

  const handleCreateOrUpdateInvoice = () => {
    const newInvoice = buildInvoiceObject();
    if (!newInvoice) return;
    onSaveInvoice(newInvoice);
  };

  const handleRecordPayment = () => {
    if (!selectedBooking || !paymentSummary || paymentAmountInput <= 0) return;
    if (!existingInvoice) {
      const newPaid = paymentSummary.totalPaid + paymentAmountInput;
      const inv = buildInvoiceObject(newPaid);
      if (inv) {
        onSaveInvoice(inv);
        onUpdatePaymentStatus(inv.id, inv.status, newPaid);
      }
    } else {
      const newPaid = paymentSummary.totalPaid + paymentAmountInput;
      const newStatus = newPaid >= paymentSummary.totalBill - 0.01 ? 'Paid' : 'Partially Paid';
      onUpdatePaymentStatus(existingInvoice.id, newStatus, newPaid);
    }
    setPaymentAmountInput(0);
  };

  if (!selectedBooking || !fin || !paymentSummary) {
    return (
      <div className="bg-white border border-[#E2ECE7] rounded-3xl p-8 text-center text-[#5A6F66]">
        No booking selected. Please select a booking from the list.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Controls & Selector */}
      <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#192A24] font-['Plus_Jakarta_Sans'] flex items-center space-x-2">
            <FileText className="w-5 h-5 text-[#236B50]" />
            <span>Automated Banquet Invoicing & Audit Studio</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5A6F66] mt-0.5">
            Generate professional client-facing tax invoices and confidential internal profit audits.
          </p>
        </div>

        {/* Booking Dropdown & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedBookingId}
            onChange={(e) => setSelectedBookingId(e.target.value)}
            className="bg-[#F6FAF8] border border-[#D5E5DE] rounded-2xl px-3.5 py-2 text-xs text-[#192A24] font-bold focus:outline-none focus:border-[#236B50] max-w-xs"
          >
            {bookings.map(b => (
              <option key={b.id} value={b.id}>
                {b.bookingNumber} - {b.clientName} ({b.eventDate}, {b.branch})
              </option>
            ))}
          </select>

          {/* Toggle View Mode */}
          <div className="bg-[#EBF3EF] p-1 rounded-2xl border border-[#D5E5DE] flex text-xs font-semibold">
            <button
              onClick={() => setViewMode('client_invoice')}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                viewMode === 'client_invoice'
                  ? 'bg-[#236B50] text-white font-bold shadow-xs'
                  : 'text-[#3D5A4E] hover:text-[#192A24]'
              }`}
            >
              Client Tax Invoice
            </button>
            {currentUser.permissions.canViewCosting && (
              <button
                onClick={() => setViewMode('internal_audit')}
                className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer ${
                  viewMode === 'internal_audit'
                    ? 'bg-[#236B50] text-white font-bold shadow-xs'
                    : 'text-[#3D5A4E] hover:text-[#192A24]'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Internal Profit Audit</span>
              </button>
            )}
          </div>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#236B50] text-xs font-bold transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: CLIENT-FACING TAX INVOICE */}
      {viewMode === 'client_invoice' && (
        <div className="bg-white text-[#192A24] rounded-3xl shadow-lg overflow-hidden border border-[#D5E5DE] max-w-4xl mx-auto print:border-none print:shadow-none print:m-0 print:p-0">
          
          {/* Invoice Header */}
          <div className="bg-[#236B50] text-white p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center space-x-2 text-emerald-200 text-xs font-bold tracking-widest uppercase">
                <Sparkles className="w-4 h-4" />
                <span>Crystal Plaza & Casmia (CPH) Hotel Banquets</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-['Plus_Jakarta_Sans'] text-white mt-1">
                Official Tax & Banquet Invoice
              </h2>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                {selectedBooking.branch} • Tel: +971 6 572 2222 • TRN: 100482910300003 (5% UAE VAT)
              </p>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-xs uppercase text-emerald-200 tracking-wider">Invoice Number</div>
              <div className="text-lg sm:text-xl font-bold font-mono text-white">
                {existingInvoice?.invoiceNumber || `CPH-INV-${selectedBooking.bookingNumber.substring(8)}`}
              </div>
              <div className="mt-1">
                <span className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-extrabold tracking-wide uppercase ${
                  paymentSummary.isBalanceSettled
                    ? 'bg-white text-[#236B50]'
                    : 'bg-amber-100 text-amber-900'
                }`}>
                  {paymentSummary.isBalanceSettled ? 'PAID IN FULL' : paymentSummary.totalPaid > 0 ? 'PARTIALLY PAID' : 'UNPAID'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Bill To & Event Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-[#E2ECE7] text-xs">
              <div className="space-y-1">
                <span className="text-[#5A6F66] font-bold uppercase tracking-wider text-[10px]">Billed To:</span>
                <div className="text-base font-extrabold text-[#192A24]">{selectedBooking.clientName}</div>
                {selectedBooking.clientCompany && (
                  <div className="font-semibold text-[#5A6F66]">{selectedBooking.clientCompany}</div>
                )}
                {selectedBooking.clientEmail && (
                  <div className="text-[#5A6F66]">{selectedBooking.clientEmail}</div>
                )}
                <div className="text-[#5A6F66] font-medium">{selectedBooking.clientPhone}</div>
              </div>

              <div className="space-y-1 sm:text-right">
                <span className="text-[#5A6F66] font-bold uppercase tracking-wider text-[10px]">Banquet Reservation:</span>
                <div className="text-base font-extrabold text-[#236B50]">{selectedBooking.hallName}</div>
                <div className="text-[#5A6F66] font-medium">
                  Date: <span className="font-bold text-[#192A24]">{selectedBooking.eventDate}</span> ({selectedBooking.timeSlot} session)
                </div>
                <div className="text-[#5A6F66]">
                  Guest Count: <span className="font-bold text-[#192A24]">{selectedBooking.guestCount} Attending</span>
                </div>
                <div className="text-[#5A6F66]">Event Nature: {selectedBooking.eventType}</div>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="border border-[#E2ECE7] rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAF9] text-[#5A6F66] border-b border-[#E2ECE7] font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Item Description & Menu Package</th>
                    <th className="py-3 px-4 text-center">Quantity</th>
                    <th className="py-3 px-4 text-right">Unit Rate (AED)</th>
                    <th className="py-3 px-4 text-right">Total (AED)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2ECE7]">
                  {/* Banquet Hall Rental */}
                  <tr>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#192A24]">{selectedBooking.hallName} Banquet Rental</div>
                      <div className="text-[11px] text-[#5A6F66]">
                        {selectedBooking.hallOffer === 'free_with_food'
                          ? 'Special Promotion: Banquet Hall rental is 100% FREE when booking buffet food from hotel'
                          : selectedBooking.hallOffer === 'one_side_hall'
                          ? 'One Side Partition Offer (Left Side of Hall)'
                          : 'Standard Full Hall rental without food package'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-[#5A6F66]">1 Event</td>
                    <td className="py-3 px-4 text-right font-mono text-[#5A6F66]">
                      {fin.hallRevenue.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#192A24] font-mono">
                      {fin.hallRevenue === 0 ? 'FREE (0.00)' : formatCurrency(fin.hallRevenue)}
                    </td>
                  </tr>

                  {/* Food / Buffet Tier */}
                  {selectedBooking.hasFoodFromHotel && (
                    <tr>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#192A24]">
                          {resolvedBuffetLabel}
                        </div>
                        <div className="text-[11px] text-[#5A6F66]">
                          Banquet buffet service prepared by hotel culinary team
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center text-[#5A6F66]">
                        {selectedBooking.guestCount} Guests
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#5A6F66]">
                        {selectedBooking.foodPricePerGuestCharged.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#192A24] font-mono">
                        {formatCurrency(fin.foodRevenue)}
                      </td>
                    </tr>
                  )}

                  {/* Decor & AV */}
                  {selectedBooking.decorAndAVCharged > 0 && (
                    <tr>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#192A24]">Event Staging, Sound & Ambience Lighting</div>
                        <div className="text-[11px] text-[#5A6F66]">Full banquet lighting, audio system, and staging</div>
                      </td>
                      <td className="py-3 px-4 text-center text-[#5A6F66]">1 Package</td>
                      <td className="py-3 px-4 text-right font-mono text-[#5A6F66]">
                        {selectedBooking.decorAndAVCharged.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#192A24] font-mono">
                        {formatCurrency(selectedBooking.decorAndAVCharged)}
                      </td>
                    </tr>
                  )}

                  {/* Package Discount */}
                  {fin.discount > 0 && (
                    <tr className="text-[#236B50]">
                      <td className="py-2.5 px-4 font-bold">Special Management Agreed Discount</td>
                      <td className="py-2.5 px-4 text-center">-</td>
                      <td className="py-2.5 px-4 text-right">-</td>
                      <td className="py-2.5 px-4 text-right font-bold font-mono">
                        -{formatCurrency(fin.discount)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
              <div className="text-xs text-[#5A6F66] space-y-2 max-w-sm">
                <div className="font-bold text-[#192A24]">Payment & Bank Instructions:</div>
                <p>Transfer to: Crystal Plaza Hotel F&B Account • Emirates NBD IBAN: AE090330000012345678901</p>
                <div className="flex items-center space-x-2 pt-2">
                  <QrCode className="w-10 h-10 text-[#236B50]" />
                  <span className="text-[10px]">Scan with UAE Central Bank Instant Payment (Aani)</span>
                </div>
              </div>

              <div className="w-full sm:w-80 space-y-2 text-xs">
                <div className="flex justify-between text-[#5A6F66]">
                  <span>Subtotal:</span>
                  <span className="font-bold text-[#192A24] font-mono">{formatCurrency(fin.subtotalRevenue)}</span>
                </div>
                <div className="flex justify-between text-[#5A6F66]">
                  <span>Service Charge (10%):</span>
                  <span className="font-mono text-[#192A24]">{formatCurrency(fin.serviceCharge)}</span>
                </div>
                <div className="flex justify-between text-[#5A6F66]">
                  <span>Municipality Fee (10%):</span>
                  <span className="font-mono text-[#192A24]">{formatCurrency(fin.municipalityFee)}</span>
                </div>
                <div className="flex justify-between text-[#5A6F66]">
                  <span>UAE VAT (5%):</span>
                  <span className="font-mono text-[#192A24]">{formatCurrency(fin.taxAmount)}</span>
                </div>
                <div className="pt-2 border-t border-[#E2ECE7] flex justify-between text-base font-extrabold text-[#192A24]">
                  <span>Total Billed:</span>
                  <span className="text-[#236B50]">{formatCurrency(paymentSummary.totalBill)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#236B50] font-bold">
                  <span>Deposit / Amount Paid:</span>
                  <span>{formatCurrency(paymentSummary.totalPaid)}</span>
                </div>
                <div className={`flex justify-between text-sm font-extrabold p-2 rounded-xl border ${
                  paymentSummary.isBalanceSettled
                    ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                    : 'text-amber-800 bg-amber-50 border-amber-200'
                }`}>
                  <span>Balance Due:</span>
                  <span>{formatCurrency(paymentSummary.balanceToPay)}</span>
                </div>
              </div>
            </div>

            {/* Record Payment Tool (Staff only) */}
            <div className="mt-6 pt-4 border-t border-[#E2ECE7] flex flex-wrap items-center justify-between gap-3 bg-[#F8FAF9] p-4 rounded-2xl print:hidden">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-[#236B50]" />
                <span className="text-xs font-bold text-[#192A24]">Record Client Payment / Deposit (AED):</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  step="50"
                  placeholder="Deposit AED"
                  value={paymentAmountInput || ''}
                  onChange={(e) => setPaymentAmountInput(parseFloat(e.target.value) || 0)}
                  className="w-32 bg-white border border-[#D5E5DE] rounded-xl px-3 py-1.5 text-xs text-[#192A24] font-bold focus:outline-none focus:border-[#236B50]"
                />
                <button
                  onClick={handleRecordPayment}
                  disabled={paymentAmountInput <= 0}
                  className="px-4 py-1.5 rounded-full bg-[#236B50] hover:bg-[#1C5740] disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Apply Deposit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: INTERNAL CONFIDENTIAL PROFIT MARGIN AUDIT SLIP */}
      {viewMode === 'internal_audit' && (
        <div className="bg-white text-[#192A24] rounded-3xl shadow-lg overflow-hidden border border-[#D5E5DE] max-w-4xl mx-auto p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E2ECE7]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-[#E8F5EE] text-[#236B50] flex items-center justify-center border border-[#C5E5D5]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  Strictly Confidential • Management Financial Audit
                </span>
                <h2 className="text-xl font-extrabold text-[#192A24] mt-1">
                  Event Profit Margin & Costing Audit Slip
                </h2>
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="text-[#5A6F66]">BEO Ref:</div>
              <div className="font-mono font-bold text-[#192A24]">{selectedBooking.bookingNumber}</div>
            </div>
          </div>

          {/* Key Audit Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-[#F8FAF9] rounded-2xl border border-[#E2ECE7]">
              <div className="text-[11px] text-[#5A6F66]">Client Billed Subtotal</div>
              <div className="text-xl font-extrabold text-[#192A24] mt-0.5">{formatCurrency(fin.subtotalRevenue)}</div>
            </div>
            <div className="p-4 bg-[#F8FAF9] rounded-2xl border border-[#E2ECE7]">
              <div className="text-[11px] text-[#5A6F66]">Total Hotel Direct Costs</div>
              <div className="text-xl font-extrabold text-[#192A24] mt-0.5">{formatCurrency(fin.totalDirectCosts)}</div>
            </div>
            <div className="p-4 bg-[#E8F5EE] rounded-2xl border border-[#C5E5D5]">
              <div className="text-[11px] text-[#1D6047]">Net Gross Profit</div>
              <div className="text-xl font-extrabold text-[#236B50] mt-0.5">+{formatCurrency(fin.netGrossProfit)}</div>
            </div>
            <div className="p-4 bg-[#E8F5EE] rounded-2xl border border-[#C5E5D5]">
              <div className="text-[11px] text-[#1D6047]">Event Gross Profit Margin</div>
              <div className="text-xl font-extrabold text-[#236B50] mt-0.5">{formatPercent(fin.overallProfitMarginPercent)}</div>
            </div>
          </div>

          {/* Departmental Cost vs Revenue Table */}
          <div className="border border-[#E2ECE7] rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAF9] text-[#5A6F66] border-b border-[#E2ECE7] font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Department / Service Line</th>
                  <th className="py-3 px-4 text-right">Revenue Charged</th>
                  <th className="py-3 px-4 text-right">Hotel Direct Cost</th>
                  <th className="py-3 px-4 text-right">Net Profit</th>
                  <th className="py-3 px-4 text-right">Department Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2ECE7]">
                <tr>
                  <td className="py-3 px-4 font-bold text-[#192A24]">
                    Banquet Hall Venue ({selectedBooking.hallName})
                  </td>
                  <td className="py-3 px-4 text-right font-mono">{formatCurrency(fin.hallRevenue)}</td>
                  <td className="py-3 px-4 text-right font-mono text-[#5A6F66]">{formatCurrency(fin.hallCost)}</td>
                  <td className="py-3 px-4 text-right font-bold text-[#236B50] font-mono">
                    +{formatCurrency(fin.hallRevenue - fin.hallCost)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-[#236B50]">
                    {fin.hallRevenue > 0 ? formatPercent(((fin.hallRevenue - fin.hallCost) / fin.hallRevenue) * 100) : '0%'}
                  </td>
                </tr>

                {selectedBooking.hasFoodFromHotel && (
                  <tr>
                    <td className="py-3 px-4 font-bold text-[#192A24]">
                      Buffet Food & Culinary (Chef Usage {selectedBooking.chefUsageLogged ? 'Logged' : 'Theoretical'})
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{formatCurrency(fin.foodRevenue)}</td>
                    <td className="py-3 px-4 text-right font-mono text-[#5A6F66]">{formatCurrency(fin.foodCost)}</td>
                    <td className="py-3 px-4 text-right font-bold text-[#236B50] font-mono">
                      +{formatCurrency(fin.foodRevenue - fin.foodCost)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#236B50]">
                      {fin.foodRevenue > 0 ? formatPercent(((fin.foodRevenue - fin.foodCost) / fin.foodRevenue) * 100) : '0%'}
                    </td>
                  </tr>
                )}

                {selectedBooking.decorAndAVCharged > 0 && (
                  <tr>
                    <td className="py-3 px-4 font-bold text-[#192A24]">Staging, AV & Decor</td>
                    <td className="py-3 px-4 text-right font-mono">{formatCurrency(selectedBooking.decorAndAVCharged)}</td>
                    <td className="py-3 px-4 text-right font-mono text-[#5A6F66]">{formatCurrency(fin.decorAndAVCost)}</td>
                    <td className="py-3 px-4 text-right font-bold text-[#236B50] font-mono">
                      +{formatCurrency(selectedBooking.decorAndAVCharged - fin.decorAndAVCost)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#236B50]">
                      {formatPercent(((selectedBooking.decorAndAVCharged - fin.decorAndAVCost) / selectedBooking.decorAndAVCharged) * 100)}
                    </td>
                  </tr>
                )}

                <tr>
                  <td className="py-3 px-4 font-bold text-[#192A24]">Event Captain & Banquet Service Staffing</td>
                  <td className="py-3 px-4 text-right font-mono">0.00 AED</td>
                  <td className="py-3 px-4 text-right font-mono text-[#5A6F66]">{formatCurrency(fin.staffingCost)}</td>
                  <td className="py-3 px-4 text-right font-mono text-rose-600">-{formatCurrency(fin.staffingCost)}</td>
                  <td className="py-3 px-4 text-right font-mono text-[#5A6F66]">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
