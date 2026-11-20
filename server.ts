import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { 
  BookingEvent, 
  UserProfile, 
  PaymentRecord, 
  CancellationPolicyDetails, 
  TentativeHoldDetails, 
  AuditLog, 
  NotificationItem, 
  ChefPartyIngredientEntry 
} from './src/types';
import { INITIAL_USERS, INITIAL_BOOKINGS, INITIAL_AUDIT_LOGS } from './src/data/initialData';

import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const app = express();
// Port 3000 is required by the AI Studio preview environment
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory server-authoritative state
let serverBookings: BookingEvent[] = [...INITIAL_BOOKINGS];
let serverUsers: UserProfile[] = [...INITIAL_USERS];
let serverAuditLogs: AuditLog[] = [...INITIAL_AUDIT_LOGS];
let serverNotifications: NotificationItem[] = [
  {
    id: 'notif_welcome_1',
    timestamp: '2026-10-14T09:00:00Z',
    title: 'System Initialized',
    message: 'AuraBanquets hotel banquet software initialized with strict role permissions & automated costing workflow.',
    type: 'new_booking',
    targetRoles: 'all',
    isRead: false,
  }
];

// Helper to log server audit entries
function addServerAuditLog(action: string, details: string, category: AuditLog['category'], user?: { id?: string; name?: string }) {
  const newLog: AuditLog = {
    id: `aud_srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    userId: user?.id || 'sys',
    userName: user?.name || 'System / Server',
    action,
    details,
    category,
  };
  serverAuditLogs = [newLog, ...serverAuditLogs].slice(0, 200);
  return newLog;
}

// Helper to dispatch server notifications
function dispatchServerNotification(
  title: string, 
  message: string, 
  type: NotificationItem['type'], 
  targetRoles: NotificationItem['targetRoles'] = 'all', 
  bookingId?: string
) {
  const notif: NotificationItem = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    title,
    message,
    type,
    targetRoles,
    bookingId,
    isRead: false,
  };
  serverNotifications = [notif, ...serverNotifications].slice(0, 100);
  return notif;
}

// Check and expire tentative holds if expiry elapsed and no advance paid
function checkAndExpireHolds() {
  const now = new Date();
  serverBookings = serverBookings.map(b => {
    if (b.status !== 'cancelled' && b.isTentative && b.tentativeHold?.holdExpiresAt) {
      const expiresAt = new Date(b.tentativeHold.holdExpiresAt);
      const paymentsSum = (b.payments || []).reduce((sum, p) => sum + p.amount, 0);
      if (now > expiresAt && paymentsSum <= 0 && (!b.depositPaid || b.depositPaid <= 0)) {
        // Expired hold: release date
        dispatchServerNotification(
          'Tentative Hold Expired',
          `Tentative hold on ${b.eventDate} for ${b.clientName} expired (no advance received). Date is reopened.`,
          'hold_expiring',
          'all',
          b.id
        );
        addServerAuditLog(
          'Tentative Hold Expired',
          `Hold on ${b.eventDate} expired for ${b.clientName} without advance payment. Date released.`,
          'Booking',
          { id: 'sys', name: 'Auto System' }
        );
        return {
          ...b,
          status: 'cancelled',
          cancellationReason: 'Tentative Hold Expired without Advance Payment',
          cancelledAt: now.toISOString(),
          cancelledBy: 'System Auto-Release',
          isTentative: false,
        };
      }
    }
    return b;
  });
}

// Role extraction middleware
interface AuthenticatedRequest extends Request {
  userRole?: string;
  userName?: string;
  userId?: string;
}

const extractUserRole = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const role = (req.headers['x-user-role'] as string) || (req.query.role as string) || 'fnb_supervisor';
  const name = (req.headers['x-user-name'] as string) || (req.query.user_name as string) || 'Supervisor';
  const id = (req.headers['x-user-id'] as string) || (req.query.user_id as string) || 'user_fnb';
  req.userRole = role;
  req.userName = decodeURIComponent(name);
  req.userId = id;
  next();
};

// ============================================================================
// SERVER-SIDE PERMISSION ENFORCEMENT & BUSINESS RULES
// ============================================================================

// 1. GET /api/bookings - Filtered strictly server-side by caller role
app.get('/api/bookings', extractUserRole, (req: AuthenticatedRequest, res: Response) => {
  checkAndExpireHolds();
  const role = req.userRole;

  // Clone bookings to avoid mutating master in memory
  const processed = serverBookings.map(b => {
    const copy = { ...b };
    
    // Calculate total payments & balance
    const paymentsTotal = (copy.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const deposit = paymentsTotal > 0 ? paymentsTotal : (copy.depositPaid || 0);
    const guests = copy.guestCount || 30;
    const foodCharged = copy.hasFoodFromHotel ? (copy.foodPricePerGuestCharged || 60) * guests : 0;
    const hallRental = copy.hallRentalCharged || 0;
    const decorAv = copy.decorAndAVCharged || 0;
    const subtotal = foodCharged + hallRental + decorAv - (copy.discountAmount || 0);
    const vat = subtotal * 0.05;
    const service = subtotal * 0.05;
    const grandTotal = subtotal + vat + service;

    copy.totalBillPayable = parseFloat(grandTotal.toFixed(2));
    copy.depositPaid = parseFloat(deposit.toFixed(2));
    copy.balanceToPay = Math.max(0, parseFloat((copy.totalBillPayable - copy.depositPaid).toFixed(2)));

    // ROLE ENFORCEMENT ON DATA REDACTION:
    // Role: Supervisor (Francis / Vendor) -> CANNOT see costing and internal financials
    if (role === 'fnb_supervisor' || role === 'banquet_manager') {
      delete (copy as any).foodCostPerGuestTheoretical;
      delete (copy as any).foodCostActualTotal;
      delete (copy as any).chefPartyEntries;
      delete (copy as any).chefUsageLogs;
      delete (copy as any).hallDirectCost;
      delete (copy as any).decorAndAVCost;
      delete (copy as any).staffingCost;
      delete (copy as any).beverageCostTotal;
    }

    // Role: Chef (Chef Karim) -> CANNOT see revenue, income, net profit, non-costing financial data
    if (role === 'executive_chef') {
      delete (copy as any).foodPricePerGuestCharged;
      delete (copy as any).packageFixedPriceCharged;
      delete (copy as any).hallRentalCharged;
      delete (copy as any).decorAndAVCharged;
      delete (copy as any).beveragePriceCharged;
      delete (copy as any).extraCharges;
      delete (copy as any).discountAmount;
      delete (copy as any).depositPaid;
      delete (copy as any).totalBillPayable;
      delete (copy as any).balanceToPay;
      delete (copy as any).payments;
    }

    return copy;
  });

  res.json({ bookings: processed, count: processed.length });
});

// 2. POST /api/bookings - Role: Supervisor only. Rule: One party per date.
app.post('/api/bookings', extractUserRole, (req: AuthenticatedRequest, res: Response) => {
  const role = req.userRole;

  // Server-side permission check:
  // GM cannot create, edit, delete (Read-Only)
  if (role === 'general_manager') {
    return res.status(403).json({ 
      error: 'Permission Denied: General Manager has view-only access and cannot create bookings.' 
    });
  }

  // Chef cannot book banquets
  if (role === 'executive_chef') {
    return res.status(403).json({ 
      error: 'Permission Denied: Executive Chef cannot create banquet bookings.' 
    });
  }

  const { eventDate, hallId, clientName, guestCount, isTentative, holdDurationHours } = req.body;

  if (!eventDate || !clientName) {
    return res.status(400).json({ error: 'Missing mandatory eventDate or clientName.' });
  }

  // RULE 1: ONE PARTY PER DATE. IF A DATE IS BOOKED, REJECT NEW BOOKINGS WITH A CLEAR MESSAGE!
  const isMultiHall = req.query.multihall === 'true';
  const conflict = serverBookings.find(b => {
    if (b.status === 'cancelled') return false; // Cancelled bookings free the date
    if (b.eventDate !== eventDate) return false;
    if (isMultiHall && hallId && b.hallId !== hallId) return false;
    return true;
  });

  if (conflict) {
    return res.status(400).json({
      error: `Date ${eventDate} is already booked for "${conflict.clientName}" (${conflict.bookingNumber}). Only one party per date is permitted. Please select another date.`,
      conflictBooking: {
        id: conflict.id,
        bookingNumber: conflict.bookingNumber,
        clientName: conflict.clientName,
        eventDate: conflict.eventDate,
        hallName: conflict.hallName,
      }
    });
  }

  const bookingId = `bk_srv_${Date.now()}`;
  const bookingNumber = `BKT-CPH-${new Date().getFullYear()}-${String(serverBookings.length + 1).padStart(3, '0')}`;

  const newBooking: BookingEvent = {
    ...req.body,
    id: req.body.id || bookingId,
    bookingNumber: req.body.bookingNumber || bookingNumber,
    status: isTentative ? 'confirmed' : 'confirmed',
    isTentative: Boolean(isTentative),
    tentativeHold: isTentative ? {
      isHold: true,
      holdDurationHours: holdDurationHours || 48,
      holdExpiresAt: new Date(Date.now() + (holdDurationHours || 48) * 3600 * 1000).toISOString(),
      holdPlacedAt: new Date().toISOString(),
      holdPlacedBy: req.userName || 'Francis D\'Souza',
      notes: `Hold for ${clientName} awaiting advance deposit`,
    } : undefined,
    payments: req.body.payments || [],
    createdAt: new Date().toISOString(),
  };

  serverBookings = [newBooking, ...serverBookings];

  // Audit log
  addServerAuditLog(
    'Created Banquet Booking',
    `Supervisor ${req.userName} booked ${newBooking.hallName} for ${newBooking.clientName} on ${newBooking.eventDate} (${newBooking.guestCount} guests).`,
    'Booking',
    { id: req.userId, name: req.userName }
  );

  // Workflow & Notifications:
  // "Supervisor books a banquet. The booking shows instantly on the Chef and Accounts dashboards and in the Scheduled Banquets tab for every role. Every role receives a notification for each new booking."
  dispatchServerNotification(
    'New Banquet Scheduled',
    `Supervisor booked ${newBooking.clientName} on ${newBooking.eventDate} (${newBooking.guestCount} guests, ${newBooking.hallName}).`,
    'new_booking',
    'all',
    newBooking.id
  );

  res.status(201).json({ 
    success: true, 
    booking: newBooking, 
    message: `Banquet successfully booked on ${eventDate} for ${clientName}.` 
  });
});

// 3. PATCH /api/bookings/:id/cancel - Rule: Mandatory cancellation reason prompt. Free the date.
app.patch('/api/bookings/:id/cancel', extractUserRole, (req: AuthenticatedRequest, res: Response) => {
  const role = req.userRole;

  if (role === 'general_manager') {
    return res.status(403).json({ 
      error: 'Permission Denied: General Manager has view-only access and cannot cancel bookings.' 
    });
  }

  const { id } = req.params;
  const { reason, advanceAction, refundAmount, notes } = req.body;

  // RULE 2: Cancel button on every booking opens a mandatory reason prompt. Save the reason and free the date.
  if (!reason || !reason.trim()) {
    return res.status(400).json({ 
      error: 'Validation Error: A mandatory cancellation reason must be provided.' 
    });
  }

  const bookingIndex = serverBookings.findIndex(b => b.id === id);
  if (bookingIndex === -1) {
    return res.status(404).json({ error: 'Booking not found.' });
  }

  const booking = serverBookings[bookingIndex];

  const policyDetails: CancellationPolicyDetails = {
    reason: reason.trim(),
    advanceAction: advanceAction || 'forfeited',
    refundAmount: Number(refundAmount) || 0,
    cancelledAt: new Date().toISOString(),
    cancelledBy: req.userName || 'Francis D\'Souza',
    notes: notes?.trim() || undefined,
  };

  const updatedBooking: BookingEvent = {
    ...booking,
    status: 'cancelled',
    cancellationReason: reason.trim(),
    cancellationPolicy: policyDetails,
    cancelledAt: new Date().toISOString(),
    cancelledBy: req.userName || 'Francis D\'Souza',
    isTentative: false,
  };

  serverBookings[bookingIndex] = updatedBooking;

  // Audit log
  addServerAuditLog(
    'Cancelled Banquet Booking',
    `Booking ${booking.bookingNumber} (${booking.clientName}, Date: ${booking.eventDate}) was cancelled by ${req.userName}. Reason: "${reason}". Policy: ${policyDetails.advanceAction} (Refund: ${policyDetails.refundAmount} AED). Date is now freed.`,
    'Booking',
    { id: req.userId, name: req.userName }
  );

  // Instant notification to all roles: date freed!
  dispatchServerNotification(
    'Banquet Cancelled & Date Freed',
    `Banquet on ${booking.eventDate} for ${booking.clientName} (${booking.bookingNumber}) cancelled by ${req.userName}. Reason: ${reason}. Date is now available for new bookings.`,
    'cancellation',
    'all',
    booking.id
  );

  res.json({ 
    success: true, 
    booking: updatedBooking, 
    message: `Booking cancelled successfully. Date ${booking.eventDate} is now freed.` 
  });
});

// 4. PATCH /api/bookings/:id/chef-finish - Workflow: Chef enters quantities & presses Finish. Locked & forwarded to Accounts.
app.patch('/api/bookings/:id/chef-finish', extractUserRole, (req: AuthenticatedRequest, res: Response) => {
  const role = req.userRole;

  // RULE: Only Executive Chef can enter ingredients and quantities!
  if (role !== 'executive_chef') {
    return res.status(403).json({ 
      error: 'Permission Denied: Only Executive Chef Karim Zayani has the privilege to enter ingredients and kitchen quantities.' 
    });
  }

  const { id } = req.params;
  const { entries, chefNotes, costingMethod } = req.body;

  const bookingIndex = serverBookings.findIndex(b => b.id === id);
  if (bookingIndex === -1) {
    return res.status(404).json({ error: 'Booking not found.' });
  }

  const booking = serverBookings[bookingIndex];

  // Check if locked
  if (booking.lockDetails?.isLocked && !booking.lockDetails?.unlockApprovedAt) {
    return res.status(403).json({ 
      error: `Booking is locked (${booking.lockDetails.lockStage}). Any further modifications require General Manager unlock approval.` 
    });
  }

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'Chef must enter at least one ingredient line item before finishing.' });
  }

  const updatedBooking: BookingEvent = {
    ...booking,
    chefPartyEntries: entries,
    chefNotes: chefNotes || booking.chefNotes,
    costingMethod: costingMethod || booking.costingMethod || 'party_batch',
    costingStatus: 'forwarded_to_accounts',
    chefForwardedAt: new Date().toISOString(),
    chefApproved: true,
    chefApprovedAt: new Date().toISOString(),
    chefApprovedBy: req.userName || 'Chef Karim Zayani',
    chefStampSerial: booking.chefStampSerial || `CPH-CHEF-STAMP-${booking.bookingNumber.replace(/[^0-9]/g, '')}`,
    lockDetails: {
      isLocked: true,
      lockedAt: new Date().toISOString(),
      lockedBy: req.userName || 'Chef Karim Zayani',
      lockStage: 'chef_finished',
    }
  };

  serverBookings[bookingIndex] = updatedBooking;

  addServerAuditLog(
    'Chef Finished Ingredient Quantities',
    `Executive Chef ${req.userName} logged ${entries.length} ingredient items and pressed Finish. Forwarded immediately to Accounts (Arun Kumar).`,
    'Costing',
    { id: req.userId, name: req.userName }
  );

  // Workflow & Notifications:
  // "Chef enters quantities and presses Finish. The record is forwarded to Accounts immediately."
  dispatchServerNotification(
    'Chef Quantities Ready for Costing',
    `Chef Karim finished kitchen quantities for ${booking.clientName} (${booking.bookingNumber}). Record is locked & forwarded to Accounts for purchasing price entry.`,
    'chef_finished',
    ['accounts_executive', 'general_manager'],
    booking.id
  );

  res.json({ 
    success: true, 
    booking: updatedBooking, 
    message: 'Kitchen quantities submitted and locked. Record forwarded to Accounts Executive.' 
  });
});

// 5. PATCH /api/bookings/:id/accounts-costing - Workflow: Accounts enters purchase prices. Must block if any missing!
app.patch('/api/bookings/:id/accounts-costing', extractUserRole, (req: AuthenticatedRequest, res: Response) => {
  const role = req.userRole;

  if (role !== 'accounts_executive' && role !== 'admin') {
    return res.status(403).json({ 
      error: 'Permission Denied: Only Accounts Executive (Arun Kumar) can enter purchase prices and finalize costing.' 
    });
  }

  const { id } = req.params;
  const { entries, arunNotes } = req.body;

  const bookingIndex = serverBookings.findIndex(b => b.id === id);
  if (bookingIndex === -1) {
    return res.status(404).json({ error: 'Booking not found.' });
  }

  const booking = serverBookings[bookingIndex];

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'No costing entries provided.' });
  }

  // RULE: "Accounts enters the purchase price for every line item. If any are missing, block costing and highlight the incomplete fields."
  const missingItems = entries.filter((e: ChefPartyIngredientEntry) => 
    e.purchasingPriceAED === undefined || 
    e.purchasingPriceAED === null || 
    Number(e.purchasingPriceAED) <= 0 ||
    isNaN(Number(e.purchasingPriceAED))
  );

  if (missingItems.length > 0) {
    const missingNames = missingItems.map(m => `"${m.ingredient || 'Item'}"`).join(', ');
    return res.status(400).json({
      error: `Costing Blocked: Missing purchase price for ${missingItems.length} item(s): [${missingNames}]. Accounts must enter purchase prices for all line items before finalizing.`,
      missingItemIds: missingItems.map(m => m.id),
      missingCount: missingItems.length,
    });
  }

  // Calculate total actual food cost
  const rawTotal = entries.reduce((s, e) => s + (Number(e.calculatedCostAED) || 0), 0);
  const guests = booking.guestCount || 30;
  const laborAndUtility = booking.hasFoodFromHotel ? guests * 4.20 : 0;
  const finalActualCost = parseFloat((rawTotal + laborAndUtility).toFixed(2));

  // RULE: Accounts CANNOT alter ingredients or quantities entered by the Chef. Accounts only provides purchasing rates!
  const sanitizedEntries: ChefPartyIngredientEntry[] = (booking.chefPartyEntries && booking.chefPartyEntries.length > 0)
    ? booking.chefPartyEntries.map(chefItem => {
        const matchingAccountsEntry = entries.find((e: ChefPartyIngredientEntry) => e.id === chefItem.id) || chefItem;
        return {
          ...chefItem, // Preserves chef's original ingredient, amountUsed, foodItemName, notes
          purchasingPriceAED: Number(matchingAccountsEntry.purchasingPriceAED) || 0,
          purchasingUnit: matchingAccountsEntry.purchasingUnit || chefItem.purchasingUnit,
          calculatedCostAED: Number(matchingAccountsEntry.calculatedCostAED) || 0,
          priceSource: matchingAccountsEntry.priceSource || 'manual_entry',
        };
      })
    : entries;

  const updatedBooking: BookingEvent = {
    ...booking,
    chefPartyEntries: sanitizedEntries,
    foodCostActualTotal: finalActualCost,
    chefUsageLogged: true,
    costingStatus: 'costed_by_arun',
    arunCostedAt: new Date().toISOString(),
    arunCostedBy: req.userName || 'Arun Kumar',
    arunApproved: true,
    arunApprovedAt: new Date().toISOString(),
    arunAccountsNotes: arunNotes || booking.arunAccountsNotes,
    postingReportGenerated: true,
    postingReportNumber: booking.postingReportNumber || `CPH-GL-POST-${booking.bookingNumber.replace(/[^0-9]/g, '')}`,
    glPostingDate: new Date().toISOString(),
    lockDetails: {
      isLocked: true,
      lockedAt: new Date().toISOString(),
      lockedBy: req.userName || 'Arun Kumar',
      lockStage: 'accounts_costed',
    }
  };

  serverBookings[bookingIndex] = updatedBooking;

  addServerAuditLog(
    'Accounts Finalized Costing',
    `Accounts Executive ${req.userName} entered all purchase prices and approved GL costing of ${finalActualCost.toFixed(2)} AED for ${booking.bookingNumber}. Record is finalized and locked.`,
    'Costing',
    { id: req.userId, name: req.userName }
  );

  dispatchServerNotification(
    'Costing Finalized & GL Posted',
    `Accounts (Arun Kumar) finalized purchasing costing for ${booking.clientName} (${booking.bookingNumber}). Total actual food cost: ${finalActualCost.toFixed(2)} AED. Final 2-page BEO & Costing document is ready.`,
    'accounts_costed',
    'all',
    booking.id
  );

  res.json({
    success: true,
    booking: updatedBooking,
    message: 'All purchase prices validated. Costing finalized and locked.'
  });
});

// 6. POST /api/bookings/:id/payments - Payment Tracking
app.post('/api/bookings/:id/payments', extractUserRole, (req: AuthenticatedRequest, res: Response) => {
  const role = req.userRole;

  if (role === 'general_manager') {
    return res.status(403).json({ 
      error: 'Permission Denied: General Manager cannot record financial transactions directly.' 
    });
  }

  const { id } = req.params;
  const { amount, paymentType, paymentMode, notes } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Valid payment amount required.' });
  }

  const bookingIndex = serverBookings.findIndex(b => b.id === id);
  if (bookingIndex === -1) {
    return res.status(404).json({ error: 'Booking not found.' });
  }

  const booking = serverBookings[bookingIndex];
  const receiptNumber = `CPH-RCP-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

  const newPayment: PaymentRecord = {
    id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    bookingId: id,
    date: new Date().toISOString().substring(0, 10),
    amount: parseFloat(Number(amount).toFixed(2)),
    paymentType: paymentType || (booking.payments?.length ? 'balance' : 'advance'),
    paymentMode: paymentMode || 'Cash',
    receiptNumber,
    receivedBy: req.userName || 'Francis D\'Souza',
    notes: notes || undefined,
    createdAt: new Date().toISOString(),
  };

  const updatedPayments = [...(booking.payments || []), newPayment];
  const totalDepositPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);

  const isSettled = newPayment.paymentType === 'balance' || totalDepositPaid >= (booking.totalBillPayable || 0);
  const updatedBooking: BookingEvent = {
    ...booking,
    payments: updatedPayments,
    depositPaid: parseFloat(totalDepositPaid.toFixed(2)),
    balanceToPay: Math.max(0, parseFloat(((booking.totalBillPayable || 0) - totalDepositPaid).toFixed(2))),
    finalPaymentConfirmed: isSettled ? true : booking.finalPaymentConfirmed,
    isTentative: false, // If tentative, recording payment confirms booking!
  };

  serverBookings[bookingIndex] = updatedBooking;

  addServerAuditLog(
    'Payment Recorded',
    `Recorded payment of ${newPayment.amount} AED (${newPayment.paymentType.toUpperCase()} via ${newPayment.paymentMode}) by ${req.userName}. Receipt: #${receiptNumber}. Total paid: ${totalDepositPaid.toFixed(2)} AED.`,
    'Invoice',
    { id: req.userId, name: req.userName }
  );

  dispatchServerNotification(
    'Payment Received',
    `${newPayment.amount} AED payment recorded for ${booking.clientName} (${booking.bookingNumber}) via ${newPayment.paymentMode}. Receipt #${receiptNumber}.`,
    'payment_received',
    'all',
    booking.id
  );

  res.json({
    success: true,
    payment: newPayment,
    booking: updatedBooking,
    message: `Payment of ${newPayment.amount} AED recorded with receipt #${receiptNumber}.`
  });
});

// 6.5 PATCH /api/bookings/:id/confirm-party-ended - Rule: Francis confirms party ended, prompt mandatory balance settlement!
app.patch('/api/bookings/:id/confirm-party-ended', extractUserRole, (req: AuthenticatedRequest, res: Response) => {
  const role = req.userRole;
  if (role === 'general_manager') {
    return res.status(403).json({ error: 'Permission Denied: General Manager has view-only access.' });
  }

  const { id } = req.params;
  const bookingIndex = serverBookings.findIndex(b => b.id === id);
  if (bookingIndex === -1) return res.status(404).json({ error: 'Booking not found.' });

  const booking = serverBookings[bookingIndex];
  booking.partyEnded = true;
  booking.partyEndedAt = new Date().toISOString();
  booking.partyEndedConfirmedBy = req.userName || 'Francis D\'Souza';
  booking.status = 'completed';
  booking.costingStatus = 'party_ended_pending_chef';

  serverBookings[bookingIndex] = booking;

  addServerAuditLog(
    'Party Ended Confirmed by Supervisor',
    `Francis D'Souza confirmed party ended for ${booking.clientName} (${booking.bookingNumber}).`,
    'Booking',
    { id: req.userId, name: req.userName }
  );

  // Notify Chef Karim
  dispatchServerNotification(
    'Party Concluded - Chef Kitchen Stamping Required',
    `Party for ${booking.clientName} (${booking.bookingNumber}) concluded on ${booking.eventDate}. Chef Karim must log kitchen quantities.`,
    'chef_action_required',
    ['executive_chef', 'general_manager'],
    booking.id
  );

  // Mandatory Francis Balance Settlement Notification
  const paymentsTotal = (booking.payments || []).reduce((sum, p) => sum + p.amount, 0);
  const deposit = paymentsTotal > 0 ? paymentsTotal : (booking.depositPaid || 0);
  const balance = Math.max(0, (booking.totalBillPayable || 0) - deposit);

  if (balance > 0 || !booking.finalPaymentConfirmed) {
    dispatchServerNotification(
      `⚠️ Mandatory: Settle Balance for ${booking.clientName}`,
      `Party for ${booking.clientName} (${booking.bookingNumber}) on ${booking.eventDate} has ended. Outstanding balance of AED ${balance.toFixed(2)} must be collected and settled immediately by Francis. This is mandatory.`,
      'mandatory_settle_balance' as any,
      ['fnb_supervisor', 'banquet_manager', 'general_manager'],
      booking.id
    );
  }

  res.json({ success: true, booking, message: 'Party conclusion confirmed and balance settlement notification dispatched.' });
});

// 7. Unlock Request & GM Approval (Booking Lock After Finish)
app.post('/api/bookings/:id/request-unlock', extractUserRole, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'A justification reason for unlocking this record is required.' });
  }

  const bookingIndex = serverBookings.findIndex(b => b.id === id);
  if (bookingIndex === -1) return res.status(404).json({ error: 'Booking not found.' });

  const booking = serverBookings[bookingIndex];
  const lockDetails = {
    ...(booking.lockDetails || { isLocked: true }),
    unlockRequested: true,
    unlockRequestReason: reason.trim(),
    unlockRequestedBy: req.userName,
    unlockRequestedAt: new Date().toISOString(),
  };

  booking.lockDetails = lockDetails;
  serverBookings[bookingIndex] = booking;

  addServerAuditLog(
    'Unlock Requested',
    `${req.userName} requested unlock for ${booking.bookingNumber}. Reason: "${reason.trim()}"`,
    'Booking',
    { id: req.userId, name: req.userName }
  );

  dispatchServerNotification(
    'Record Unlock Requested',
    `Unlock requested for ${booking.clientName} (${booking.bookingNumber}) by ${req.userName}. Reason: "${reason.trim()}". Requires GM approval.`,
    'unlock_requested',
    ['general_manager'],
    booking.id
  );

  res.json({ success: true, message: 'Unlock request submitted for General Manager approval.' });
});

app.post('/api/bookings/:id/approve-unlock', extractUserRole, (req: AuthenticatedRequest, res: Response) => {
  const role = req.userRole;

  if (role !== 'general_manager') {
    return res.status(403).json({ 
      error: 'Permission Denied: Only General Manager (Eleanor Vance) can approve record unlocks.' 
    });
  }

  const { id } = req.params;
  const bookingIndex = serverBookings.findIndex(b => b.id === id);
  if (bookingIndex === -1) return res.status(404).json({ error: 'Booking not found.' });

  const booking = serverBookings[bookingIndex];
  booking.lockDetails = {
    isLocked: false,
    unlockApprovedBy: req.userName || 'Eleanor Vance (GM)',
    unlockApprovedAt: new Date().toISOString(),
  };

  serverBookings[bookingIndex] = booking;

  addServerAuditLog(
    'Unlock Approved by GM',
    `General Manager ${req.userName} approved unlock request for ${booking.bookingNumber}. Record is temporarily open for revision.`,
    'Booking',
    { id: req.userId, name: req.userName }
  );

  dispatchServerNotification(
    'Record Unlock Approved',
    `General Manager approved unlock for ${booking.clientName} (${booking.bookingNumber}). Editing unlocked.`,
    'new_booking',
    'all',
    booking.id
  );

  res.json({ success: true, message: 'Record unlocked successfully by General Manager.' });
});

// 8. Notifications & Audit Logs endpoints
app.get('/api/notifications', (req: Request, res: Response) => {
  res.json({ notifications: serverNotifications });
});

app.post('/api/notifications/read-all', (req: Request, res: Response) => {
  serverNotifications = serverNotifications.map(n => ({ ...n, isRead: true }));
  res.json({ success: true });
});

app.get('/api/audit-logs', (req: Request, res: Response) => {
  res.json({ logs: serverAuditLogs });
});

app.get('/api/users', (req: Request, res: Response) => {
  res.json({ users: serverUsers });
});

// ============================================================================
// 9. META ADS REPORT OCR EXTRACTION (GEMINI 4 HYDROGEN MULTIMODAL)
// ============================================================================
app.post('/api/marketing/ocr-meta-ads', async (req: Request, res: Response) => {
  try {
    const { fileBase64, mimeType, rawText, defaultMonthKey, fileName } = req.body as {
      fileBase64?: string;
      mimeType?: string;
      rawText?: string;
      defaultMonthKey?: string;
      fileName?: string;
    };

    if (!fileBase64 && (!rawText || !rawText.trim())) {
      return res.status(400).json({
        error: 'Please upload a Meta Ads report file (image, PDF, CSV, Excel) or paste report text.',
      });
    }

    const ai = getGeminiClient();

    const supportedBinaryTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/gif',
      'application/pdf',
    ];

    const parts: any[] = [];

    if (fileBase64 && mimeType) {
      const normalizedMime = mimeType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeType.toLowerCase();
      if (!supportedBinaryTypes.includes(normalizedMime)) {
        return res.status(400).json({
          error: `Unsupported binary file type "${mimeType}". Please upload PNG, JPG, WEBP, PDF, CSV, or XLSX.`,
        });
      }
      const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
      parts.push({
        inlineData: {
          mimeType: normalizedMime,
          data: cleanBase64,
        },
      });
    }

    const monthHintText = defaultMonthKey && /^\d{4}-\d{2}$/.test(defaultMonthKey)
      ? `The user indicated a default target month of ${defaultMonthKey} if the report does not display an explicit month/year header.`
      : 'Detect the month and year for each row from the report dates/labels.';

    const textPrompt = [
      `Extract structured Meta Ads & Banquet Sales monthly figures from the attached ${fileName || 'Meta Ads report'}.`,
      monthHintText,
      rawText && rawText.trim() ? `\nReport Text / Spreadsheet Data:\n${rawText.trim().slice(0, 60000)}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    parts.push({ text: textPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        systemInstruction: [
          'You are a strict financial OCR and Meta Ads Manager data extraction assistant for Crystal Plaza Hotel Al Qasimia (CPH1).',
          'Rules for safe financial data entry:',
          '1. NEVER invent, estimate, or hallucinate numbers. Only output numbers explicitly visible in the report.',
          '2. If a value is shown as "-", "—", "N/A", or empty, output 0.',
          '3. Normalize monthKey strictly as "YYYY-MM" (e.g. "September 2026" -> "2026-09", "Aug 2026" -> "2026-08"). If date range "2026-09-01 to 2026-09-30" is shown, map it to "2026-09". If multiple campaigns exist inside the same single month without a monthly total row, aggregate their spend/leads/impressions/clicks for that month and note the top performing campaign.',
          '4. Map columns accurately: Amount Spent / Meta Ad Spend / Cost -> adSpendAED; Results / Leads / Inquiries / On-Facebook Leads / Messaging conversations started -> leadsGenerated; Cost per Result / Cost per Lead / Cost per Inquiry -> reportedCprAED; Link Clicks / Clicks -> clicks; Impressions -> impressions; Banquet Sales / Revenue / Conversion Value -> banquetSalesAED.',
          '5. Preserve exact decimals on currency amounts (do not round away .29 or .80). Remove thousands commas cleanly.',
          '6. Detect currency (AED, USD, EUR, etc.). If non-AED currency is detected, add a warning in `warnings` and set row confidence to "needs_review".',
          '7. For each row, set `confidence` to "high" if crisp and unambiguous, "medium" if summed from sub-rows or partially unclear, or "needs_review" if monthKey is missing/uncertain or numbers look ambiguous.',
          '8. Include a concise `rawSnippet` quoting the exact text/numbers read for that row so a human reviewer can verify it.',
        ].join('\n'),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reportTitle: {
              type: Type.STRING,
              description: 'Title, hotel/account name, or header found on the report.',
            },
            currencyDetected: {
              type: Type.STRING,
              description: 'Currency detected such as AED, USD, or Unknown.',
            },
            sourceSummary: {
              type: Type.STRING,
              description: 'One-sentence summary of what was extracted from the report.',
            },
            warnings: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Any ambiguity, non-AED currency, missing dates, or verification warnings.',
            },
            rows: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  monthKey: {
                    type: Type.STRING,
                    description: 'Normalized YYYY-MM string (e.g. 2026-09). Empty string if undetectable.',
                  },
                  monthLabel: {
                    type: Type.STRING,
                    description: 'Human-readable Month Year (e.g. September 2026).',
                  },
                  adSpendAED: {
                    type: Type.NUMBER,
                    description: 'Total Meta Ad Spend extracted.',
                  },
                  facebookSpendAED: {
                    type: Type.NUMBER,
                    description: 'Facebook platform spend if shown separately, else 0.',
                  },
                  instagramSpendAED: {
                    type: Type.NUMBER,
                    description: 'Instagram platform spend if shown separately, else 0.',
                  },
                  whatsappSpendAED: {
                    type: Type.NUMBER,
                    description: 'WhatsApp platform spend if shown separately, else 0.',
                  },
                  leadsGenerated: {
                    type: Type.INTEGER,
                    description: 'Total leads / inquiries / results count.',
                  },
                  impressions: {
                    type: Type.INTEGER,
                    description: 'Total impressions if shown, else 0.',
                  },
                  clicks: {
                    type: Type.INTEGER,
                    description: 'Total clicks or link clicks if shown, else 0.',
                  },
                  reportedCprAED: {
                    type: Type.NUMBER,
                    description: 'Reported Cost per Lead / Cost per Result from the report, else 0.',
                  },
                  ctrPercent: {
                    type: Type.NUMBER,
                    description: 'Click-through rate percentage if shown, else 0.',
                  },
                  banquetSalesAED: {
                    type: Type.NUMBER,
                    description: 'Banquet sales / revenue column if present in the report, else 0.',
                  },
                  topPerformingCampaign: {
                    type: Type.STRING,
                    description: 'Campaign name or top campaign detected, else empty string.',
                  },
                  confidence: {
                    type: Type.STRING,
                    description: 'Confidence level: high, medium, or needs_review.',
                  },
                  rawSnippet: {
                    type: Type.STRING,
                    description: 'Exact raw text/values read for human verification.',
                  },
                },
                required: [
                  'monthKey',
                  'monthLabel',
                  'adSpendAED',
                  'leadsGenerated',
                  'impressions',
                  'confidence',
                  'rawSnippet',
                ],
              },
            },
          },
          required: ['currencyDetected', 'sourceSummary', 'warnings', 'rows'],
        },
      },
    });

    const jsonText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(jsonText);

    const safeRows = Array.isArray(parsed.rows)
      ? parsed.rows.map((r: any, idx: number) => {
          const adSpend = Number(r.adSpendAED) || 0;
          const leads = Math.max(0, Math.round(Number(r.leadsGenerated) || 0));
          const impressions = Math.max(0, Math.round(Number(r.impressions) || 0));
          const clicks = Math.max(0, Math.round(Number(r.clicks) || 0));
          const reportedCpr = Number(r.reportedCprAED) || 0;
          const calcCpr = leads > 0 ? parseFloat((adSpend / leads).toFixed(2)) : 0;
          const cprMismatch =
            reportedCpr > 0 && calcCpr > 0 && Math.abs(reportedCpr - calcCpr) > 0.15;

          const monthKey = typeof r.monthKey === 'string' && /^\d{4}-\d{2}$/.test(r.monthKey.trim())
            ? r.monthKey.trim()
            : (defaultMonthKey && /^\d{4}-\d{2}$/.test(defaultMonthKey) ? defaultMonthKey : '');

          let monthLabel = typeof r.monthLabel === 'string' ? r.monthLabel.trim() : '';
          if (!monthLabel && monthKey) {
            const [y, m] = monthKey.split('-').map(Number);
            const dt = new Date(y, (m || 1) - 1, 1);
            if (!isNaN(dt.getTime())) {
              monthLabel = dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            }
          }

          return {
            rowId: `ocr_row_${Date.now()}_${idx}`,
            monthKey,
            monthLabel: monthLabel || monthKey || 'Unknown Month',
            adSpendAED: parseFloat(adSpend.toFixed(2)),
            facebookSpendAED: parseFloat((Number(r.facebookSpendAED) || 0).toFixed(2)),
            instagramSpendAED: parseFloat((Number(r.instagramSpendAED) || 0).toFixed(2)),
            whatsappSpendAED: parseFloat((Number(r.whatsappSpendAED) || 0).toFixed(2)),
            leadsGenerated: leads,
            impressions,
            clicks,
            reportedCprAED: parseFloat(reportedCpr.toFixed(2)),
            calculatedCprAED: calcCpr,
            cprMismatch,
            ctrPercent: parseFloat((Number(r.ctrPercent) || (impressions > 0 && clicks > 0 ? (clicks / impressions) * 100 : 0)).toFixed(2)),
            banquetSalesAED: parseFloat((Number(r.banquetSalesAED) || 0).toFixed(2)),
            topPerformingCampaign: typeof r.topPerformingCampaign === 'string' ? r.topPerformingCampaign.trim() : '',
            confidence: !monthKey || cprMismatch ? 'needs_review' : (r.confidence || 'medium'),
            rawSnippet: typeof r.rawSnippet === 'string' ? r.rawSnippet.trim() : '',
          };
        })
      : [];

    return res.json({
      success: true,
      extraction: {
        reportTitle: parsed.reportTitle || fileName || 'Meta Ads Report',
        currencyDetected: parsed.currencyDetected || 'Unknown',
        sourceSummary: parsed.sourceSummary || `Extracted ${safeRows.length} monthly row(s) from report.`,
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
        rows: safeRows,
      },
    });
  } catch (err: any) {
    console.error('OCR Meta Ads Extraction Error:', err);
    const msg = err?.message || 'Failed to extract OCR data from Meta Ads report.';
    const status = msg.includes('GEMINI_API_KEY') ? 500 : (err?.status || 500);

    let friendlyError = msg;
    if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED')) {
      friendlyError = 'Gemini API key is invalid or unauthorized. Please verify your key in Settings > Secrets.';
    } else if (msg.includes('RESOURCE_EXHAUSTED') || status === 429) {
      friendlyError = 'OCR request quota reached. Please wait a moment and try again, or verify your key in Settings > Secrets.';
    }

    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: friendlyError,
    });
  }
});

// ============================================================================
// MOUNT VITE MIDDLEWARE IN DEV OR STATIC FILES IN PROD
// ============================================================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
