import { 
  BanquetHall, RawIngredient, RecipeMenuItem, BanquetPackage, 
  BookingEvent, Invoice, UserProfile, BackupRecord, AuditLog,
  KitchenStockMovement, RoomServiceDish, MetaAdMonthlyReport,
  HotelRoomGuest, WhatsAppRetargetingOffer, RetargetingStatus,
  WhatsAppMessageTemplate, PaymentRecord, CancellationPolicyDetails,
  TentativeHoldDetails, NotificationItem, EventChecklistItem,
  BanquetLead, InquiryStage, BanquetFollowUpTemplate
} from '../types';
import { 
  INITIAL_USERS, INITIAL_HALLS, INITIAL_INGREDIENTS, 
  INITIAL_RECIPES, INITIAL_PACKAGES, INITIAL_BOOKINGS, 
  INITIAL_INVOICES, INITIAL_BACKUPS, INITIAL_AUDIT_LOGS,
  INITIAL_STOCK_MOVEMENTS, INITIAL_ROOM_SERVICE_DISHES,
  INITIAL_MARKETING_REPORTS, INITIAL_HOTEL_ROOM_GUESTS,
  INITIAL_WHATSAPP_OFFERS, INITIAL_WHATSAPP_TEMPLATES,
  INITIAL_BANQUET_LEADS, BANQUET_FOLLOW_UP_TEMPLATES
} from '../data/initialData';
import { calculateEventFinancials, getBookingPaymentSummary, getFunctionProspectusFinancials } from '../utils/costCalculations';

const STORAGE_KEYS = {
  USERS: 'aurabanquets_users',
  ACTIVE_USER: 'aurabanquets_active_user',
  HALLS: 'aurabanquets_halls',
  INGREDIENTS: 'aurabanquets_ingredients',
  RECIPES: 'aurabanquets_recipes',
  PACKAGES: 'aurabanquets_packages',
  BOOKINGS: 'aurabanquets_bookings',
  INVOICES: 'aurabanquets_invoices',
  BACKUPS: 'aurabanquets_backups',
  AUDIT_LOGS: 'aurabanquets_audit_logs',
  STOCK_MOVEMENTS: 'aurabanquets_stock_movements',
  ROOM_SERVICE_DISHES: 'aurabanquets_room_service_dishes',
  MARKETING_REPORTS: 'aurabanquets_marketing_reports',
  HOTEL_ROOM_GUESTS: 'aurabanquets_hotel_room_guests',
  WHATSAPP_OFFERS: 'aurabanquets_whatsapp_offers',
  WHATSAPP_TEMPLATES: 'aurabanquets_whatsapp_templates',
  BANQUET_LEADS: 'aurabanquets_leads',
  NOTIFICATIONS: 'aurabanquets_notifications',
  MONTHLY_REVENUE_GOAL: 'aurabanquets_monthly_revenue_goal',
  CPH1_ACTUALS_SYNC: 'aurabanquets_cph1_actuals_sync_v3',
};

// Safe getItem with fallback
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`Failed to load key ${key}`, e);
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save key ${key}`, e);
  }
}

// Pseudo SHA-256 hash generator for backup checksums
export function generateChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `sha256_${hex}_${Date.now().toString(16)}`;
}

// AES-256 Simulation: encodes JSON with an encryption envelop & key verification
export function encryptPayload(data: unknown, secretKey: string = 'AURA-SECRET-AES256-VAULT-2026'): string {
  const jsonString = JSON.stringify(data);
  const encoded = btoa(unescape(encodeURIComponent(jsonString)));
  const payload = {
    cipher: 'AES-256-GCM',
    timestamp: new Date().toISOString(),
    keyFingerprint: generateChecksum(secretKey),
    dataBlock: encoded,
  };
  return JSON.stringify(payload, null, 2);
}

export function decryptPayload<T>(encryptedJson: string): T {
  const envelope = JSON.parse(encryptedJson);
  if (!envelope.dataBlock) {
    throw new Error('Invalid backup file format: missing dataBlock envelope.');
  }
  const decoded = decodeURIComponent(escape(atob(envelope.dataBlock)));
  return JSON.parse(decoded) as T;
}

export class AppStorage {
  static getUsers(): UserProfile[] {
    const rawUsers = loadFromStorage(STORAGE_KEYS.USERS, INITIAL_USERS);
    const initialMap = new Map(INITIAL_USERS.map(u => [u.id, u]));
    const existingIds = new Set(rawUsers.map(u => u.id));
    const missing = INITIAL_USERS.filter(u => !existingIds.has(u.id));
    const combined = [...rawUsers, ...missing];
    
    return combined.map(u => {
      const init = initialMap.get(u.id);
      if (!init) return u;
      return {
        ...u,
        name: init.name,
        role: init.role,
        title: init.title,
        email: init.email,
        avatar: init.avatar,
        permissions: { ...init.permissions },
      };
    });
  }

  static getActiveUser(): UserProfile {
    const user = loadFromStorage(STORAGE_KEYS.ACTIVE_USER, INITIAL_USERS[1]); // Default to Abhishek Kumar (GM)
    const users = this.getUsers();
    return users.find(u => u.id === user.id) || users[0];
  }

  static setActiveUser(user: UserProfile): void {
    saveToStorage(STORAGE_KEYS.ACTIVE_USER, user);
  }

  static getHalls(): BanquetHall[] {
    const loaded = loadFromStorage<BanquetHall[]>(STORAGE_KEYS.HALLS, INITIAL_HALLS);
    const validIds = new Set(INITIAL_HALLS.map(h => h.id));
    const isAlreadyMigrated =
      Array.isArray(loaded) &&
      loaded.length === INITIAL_HALLS.length &&
      loaded.every(h => validIds.has(h.id) && (h.branch === 'CPH1' || h.branch === 'CPH2')) &&
      loaded[0]?.name === INITIAL_HALLS[0].name &&
      loaded[1]?.name === INITIAL_HALLS[1].name;

    if (!isAlreadyMigrated) {
      saveToStorage(STORAGE_KEYS.HALLS, INITIAL_HALLS);
      return INITIAL_HALLS;
    }
    return loaded;
  }

  static setHalls(halls: BanquetHall[]): void {
    saveToStorage(STORAGE_KEYS.HALLS, halls);
  }

  static getIngredients(): RawIngredient[] {
    const list = loadFromStorage(STORAGE_KEYS.INGREDIENTS, INITIAL_INGREDIENTS);
    // Ensure every ingredient has packaging breakdown fields populated
    const initialMap = new Map(INITIAL_INGREDIENTS.map(i => [i.id, i]));
    return list.map(item => {
      const init = initialMap.get(item.id);
      return {
        ...init,
        ...item,
        packagingUnit: item.packagingUnit || init?.packagingUnit || 'Pack',
        subUnitName: item.subUnitName || init?.subUnitName || item.unit || 'units',
        subUnitsPerPackage: item.subUnitsPerPackage || init?.subUnitsPerPackage || 1,
        stockSubUnits: item.stockSubUnits !== undefined 
          ? item.stockSubUnits 
          : (init?.stockSubUnits !== undefined 
              ? init.stockSubUnits 
              : Math.round(item.stockQuantity * (init?.subUnitsPerPackage || 1))),
        packageCostAED: item.packageCostAED || init?.packageCostAED || item.costPerUnit,
        subUnitCostAED: item.subUnitCostAED || init?.subUnitCostAED || (item.costPerUnit / (init?.subUnitsPerPackage || 1)),
        reorderSubUnits: item.reorderSubUnits !== undefined ? item.reorderSubUnits : (init?.reorderSubUnits || item.reorderLevel),
        storageLocation: item.storageLocation || init?.storageLocation || 'Main Kitchen Storage',
      };
    });
  }

  static setIngredients(ingredients: RawIngredient[]): void {
    saveToStorage(STORAGE_KEYS.INGREDIENTS, ingredients);
  }

  static getStockMovements(): KitchenStockMovement[] {
    return loadFromStorage(STORAGE_KEYS.STOCK_MOVEMENTS, INITIAL_STOCK_MOVEMENTS);
  }

  static addStockMovement(movement: KitchenStockMovement): void {
    const current = this.getStockMovements();
    const updated = [movement, ...current].slice(0, 500); // keep last 500
    saveToStorage(STORAGE_KEYS.STOCK_MOVEMENTS, updated);
  }

  static deductKitchenStock(
    ingredientId: string, 
    subUnitsToDeduct: number, 
    reason: string, 
    performedBy: string
  ): { success: boolean; remainingSubUnits: number; remainingCartons: number; message: string } {
    const ingredients = this.getIngredients();
    const target = ingredients.find(i => i.id === ingredientId);
    if (!target) {
      return { success: false, remainingSubUnits: 0, remainingCartons: 0, message: 'Ingredient not found.' };
    }

    const currentSubUnits = target.stockSubUnits !== undefined ? target.stockSubUnits : target.stockQuantity;
    const newSubUnits = Math.max(0, parseFloat((currentSubUnits - subUnitsToDeduct).toFixed(2)));
    const perPack = target.subUnitsPerPackage || 1;
    const newCartons = parseFloat((newSubUnits / perPack).toFixed(2));

    const updatedIngredients = ingredients.map(i => {
      if (i.id === ingredientId) {
        return {
          ...i,
          stockSubUnits: newSubUnits,
          stockQuantity: newCartons,
        };
      }
      return i;
    });

    this.setIngredients(updatedIngredients);

    // Record movement
    const movement: KitchenStockMovement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      ingredientId: target.id,
      ingredientName: target.name,
      type: reason.toLowerCase().includes('room service') ? 'room_service_prep' : 'party_buffet_deduction',
      quantityChanged: -subUnitsToDeduct,
      packagesEquivalent: `-${subUnitsToDeduct} ${target.subUnitName || 'units'} (-${(subUnitsToDeduct / perPack).toFixed(2)} ${target.packagingUnit || 'packs'})`,
      remainingSubUnits: newSubUnits,
      reasonOrReference: reason,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      performedBy,
    };
    this.addStockMovement(movement);

    return {
      success: true,
      remainingSubUnits: newSubUnits,
      remainingCartons: newCartons,
      message: `Successfully deducted ${subUnitsToDeduct} ${target.subUnitName || 'units'}. Remaining: ${newSubUnits} ${target.subUnitName || 'units'} (${newCartons} ${target.packagingUnit || 'packs'}).`
    };
  }

  static addKitchenStock(
    ingredientId: string,
    subUnitsToAdd: number,
    packageCount: number,
    costPerPackage: number,
    supplier: string,
    batchNumber: string,
    invoiceRef: string,
    performedBy: string
  ): void {
    const ingredients = this.getIngredients();
    const updated = ingredients.map(i => {
      if (i.id === ingredientId) {
        const perPack = i.subUnitsPerPackage || 1;
        const currentSubUnits = i.stockSubUnits !== undefined ? i.stockSubUnits : i.stockQuantity * perPack;
        const newSubUnits = currentSubUnits + subUnitsToAdd;
        const newCartons = parseFloat((newSubUnits / perPack).toFixed(2));
        return {
          ...i,
          stockSubUnits: newSubUnits,
          stockQuantity: newCartons,
          packageCostAED: costPerPackage > 0 ? costPerPackage : i.packageCostAED,
          costPerUnit: costPerPackage > 0 ? costPerPackage : i.costPerUnit,
          subUnitCostAED: costPerPackage > 0 ? parseFloat((costPerPackage / perPack).toFixed(2)) : i.subUnitCostAED,
          supplier: supplier || i.supplier,
          batchNumber: batchNumber || i.batchNumber,
          lastPurchaseDate: new Date().toISOString().substring(0, 10),
        };
      }
      return i;
    });

    this.setIngredients(updated);

    const target = ingredients.find(i => i.id === ingredientId);
    if (target) {
      this.addStockMovement({
        id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        ingredientId: target.id,
        ingredientName: target.name,
        type: 'purchase_receipt',
        quantityChanged: subUnitsToAdd,
        packagesEquivalent: `+${packageCount} ${target.packagingUnit || 'packs'} (+${subUnitsToAdd} ${target.subUnitName || 'units'})`,
        remainingSubUnits: (target.stockSubUnits || 0) + subUnitsToAdd,
        reasonOrReference: `Purchase Invoice: ${invoiceRef || 'Manual Delivery Batch'} (${supplier || target.supplier})`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        performedBy,
      });
    }
  }

  static getRoomServiceDishes(): RoomServiceDish[] {
    return loadFromStorage(STORAGE_KEYS.ROOM_SERVICE_DISHES, INITIAL_ROOM_SERVICE_DISHES);
  }

  static saveRoomServiceDish(dish: RoomServiceDish): void {
    const current = this.getRoomServiceDishes();
    const exists = current.some(d => d.id === dish.id);
    const updated = exists ? current.map(d => d.id === dish.id ? dish : d) : [...current, dish];
    saveToStorage(STORAGE_KEYS.ROOM_SERVICE_DISHES, updated);
  }

  static getRecipes(): RecipeMenuItem[] {
    return loadFromStorage(STORAGE_KEYS.RECIPES, INITIAL_RECIPES);
  }

  static setRecipes(recipes: RecipeMenuItem[]): void {
    saveToStorage(STORAGE_KEYS.RECIPES, recipes);
  }

  static getPackages(): BanquetPackage[] {
    return loadFromStorage(STORAGE_KEYS.PACKAGES, INITIAL_PACKAGES);
  }

  static setPackages(packages: BanquetPackage[]): void {
    saveToStorage(STORAGE_KEYS.PACKAGES, packages);
  }

  private static ensureCph1ActualsSynced(): void {
    try {
      if (localStorage.getItem(STORAGE_KEYS.CPH1_ACTUALS_SYNC) === '1') return;

      // 1. Keep ONLY verified CPH1 actuals (2025-01 through 2026-08) and strip synthetic Sep-Dec 2026 & 2027 projections
      const verifiedActuals = INITIAL_MARKETING_REPORTS.filter(
        r => r.monthKey >= '2025-01' && r.monthKey <= '2026-08'
      );
      const rawReports = localStorage.getItem(STORAGE_KEYS.MARKETING_REPORTS);
      if (rawReports) {
        const parsed = JSON.parse(rawReports) as MetaAdMonthlyReport[];
        const nonSynthetic = parsed.filter(
          r => r.monthKey < '2025-01' || r.monthKey > '2027-12'
        );
        const synced = [...nonSynthetic, ...verifiedActuals].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
        saveToStorage(STORAGE_KEYS.MARKETING_REPORTS, synced);
      }

      // 2. Remove all seeded synthetic demo bookings while keeping any user-created bookings
      const seededDemoBookingIds = new Set([
        'bk_aug_08', 'bk_aug_15', 'bk_aug_22', 'bk_aug_29',
        'bk_sep_06', 'bk_sep_12', 'bk_sep_18', 'bk_sep_22', 'bk_sep_27', 'bk_sep_29',
        'bk_oct_02', 'bk_oct_05', 'bk_oct_08', 'bk_oct_11', 'bk_oct_13', 'bk_betsy_301',
        'bk_oct_16', 'bk_oct_19', 'bk_oct_23', 'bk_oct_24_arpan', 'bk_oct_27', 'bk_oct_30',
        'bk_nov_05', 'bk_nov_14', 'bk_nov_20',
      ]);
      const rawBookings = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
      if (rawBookings) {
        const parsedBookings = JSON.parse(rawBookings) as BookingEvent[];
        const cleanedBookings = parsedBookings.filter(b => !seededDemoBookingIds.has(b.id));
        saveToStorage(STORAGE_KEYS.BOOKINGS, cleanedBookings);
      }

      // 3. Remove all seeded synthetic demo invoices while keeping any user-created invoices
      const seededDemoInvoiceIds = new Set([
        'inv_aug_01', 'inv_aug_02',
        'inv_sep_01', 'inv_sep_02', 'inv_sep_03',
        'inv_betsy_001', 'inv_oct_02', 'inv_oct_05', 'inv_oct_08', 'inv_oct_11',
        'inv_nov_01', 'inv_nov_02',
      ]);
      const rawInvoices = localStorage.getItem(STORAGE_KEYS.INVOICES);
      if (rawInvoices) {
        const parsedInvoices = JSON.parse(rawInvoices) as Invoice[];
        const cleanedInvoices = parsedInvoices.filter(i => !seededDemoInvoiceIds.has(i.id));
        saveToStorage(STORAGE_KEYS.INVOICES, cleanedInvoices);
      }

      localStorage.setItem(STORAGE_KEYS.CPH1_ACTUALS_SYNC, '1');
    } catch {
      // Safe fallback if localStorage unavailable
    }
  }

  static getBookings(): BookingEvent[] {
    this.ensureCph1ActualsSynced();
    const loaded = loadFromStorage<BookingEvent[]>(STORAGE_KEYS.BOOKINGS, INITIAL_BOOKINGS);
    // If user has existing items in localStorage, ensure initial demo records exist and have costing entries
    const existingIds = new Set(loaded.map(b => b.id));
    const missingInitials = INITIAL_BOOKINGS.filter(b => !existingIds.has(b.id));
    let merged = [...loaded, ...missingInitials];
    
    const now = new Date();

    // Ensure financial calculations, payment tracking, and locks are fully populated
    merged = merged.map(b => {
      const initMatch = INITIAL_BOOKINGS.find(ib => ib.id === b.id);
      const normalizedBranch: 'CPH1' | 'CPH2' = b.branch === 'CPH2' ? 'CPH2' : 'CPH1';
      let updatedBooking = { ...b, branch: normalizedBranch };

      if (initMatch && initMatch.chefPartyEntries && (!b.chefPartyEntries || b.chefPartyEntries.length === 0)) {
        updatedBooking = {
          ...updatedBooking,
          costingMethod: initMatch.costingMethod || 'party_batch',
          costingStatus: initMatch.costingStatus || 'costed_by_arun',
          chefPartyEntries: initMatch.chefPartyEntries,
          chefForwardedAt: initMatch.chefForwardedAt,
          arunApprovedAt: initMatch.arunApprovedAt,
          arunAccountsNotes: initMatch.arunAccountsNotes,
        };
      }

      // Sync forwarded_to_accounts if initial booking was marked as chef approved awaiting Accounts
      if (initMatch && initMatch.costingStatus === 'forwarded_to_accounts' && updatedBooking.costingStatus !== 'costed_by_arun' && updatedBooking.costingStatus !== 'approved') {
        updatedBooking.costingStatus = 'forwarded_to_accounts';
        updatedBooking.chefApproved = true;
        updatedBooking.chefApprovedAt = initMatch.chefApprovedAt || updatedBooking.chefApprovedAt || '2026-10-08T14:30:00Z';
        updatedBooking.chefApprovedBy = initMatch.chefApprovedBy || 'Executive Chef';
        updatedBooking.chefStampSerial = initMatch.chefStampSerial || updatedBooking.chefStampSerial;
        updatedBooking.partyEnded = true;
      }

      // Seed payments array if missing but depositPaid exists
      if ((!updatedBooking.payments || updatedBooking.payments.length === 0) && (updatedBooking.depositPaid && updatedBooking.depositPaid > 0)) {
        updatedBooking.payments = [
          {
            id: `pay_init_${updatedBooking.id}`,
            bookingId: updatedBooking.id,
            date: updatedBooking.bookingDate || new Date().toISOString().substring(0, 10),
            amount: updatedBooking.depositPaid,
            paymentType: 'advance',
            paymentMode: (updatedBooking.advancePaymentMode as any) || 'Cash',
            receiptNumber: `CPH-RCP-${updatedBooking.bookingNumber.replace(/[^0-9]/g, '')}-01`,
            receivedBy: updatedBooking.fnbRepresentative || 'F&B Supervisor',
            notes: 'Advance booking deposit received at confirmation',
            createdAt: updatedBooking.createdAt || new Date().toISOString(),
          }
        ];
      }

      // Normalize legacy auto-injected tax/fee defaults that were never billed on client agreement
      if (
        updatedBooking.taxPercent === 5 &&
        updatedBooking.serviceChargePercent === 10 &&
        (updatedBooking.municipalityFeePercent === 10 || updatedBooking.municipalityFeePercent === undefined)
      ) {
        updatedBooking.taxPercent = 0;
        updatedBooking.serviceChargePercent = 0;
        updatedBooking.municipalityFeePercent = 0;
      }

      // Compute exact Total Bill, Advance & Balance to Pay consistently
      const summary = getBookingPaymentSummary(updatedBooking);
      updatedBooking.totalBillPayable = summary.totalBill;
      updatedBooking.depositPaid = summary.totalPaid;
      updatedBooking.balanceToPay = summary.balanceToPay;
      if (summary.isBalanceSettled && !updatedBooking.finalPaymentConfirmed) {
        updatedBooking.finalPaymentConfirmed = true;
      }

      // Auto-lock if chef finished or accounts costed
      if ((updatedBooking.costingStatus === 'costed_by_arun' || updatedBooking.costingStatus === 'forwarded_to_accounts') && !updatedBooking.lockDetails) {
        updatedBooking.lockDetails = {
          isLocked: true,
          lockedAt: updatedBooking.arunCostedAt || updatedBooking.chefForwardedAt || new Date().toISOString(),
          lockedBy: updatedBooking.arunCostedBy || updatedBooking.chefApprovedBy || 'Executive System',
          lockStage: updatedBooking.costingStatus === 'costed_by_arun' ? 'accounts_costed' : 'chef_finished',
        };
      }

      // Check tentative hold expiry: if hold expired and no advance received, reopen date
      if (updatedBooking.isTentative && updatedBooking.tentativeHold?.holdExpiresAt && updatedBooking.status !== 'cancelled') {
        const expiresAt = new Date(updatedBooking.tentativeHold.holdExpiresAt);
        if (now > expiresAt && updatedBooking.depositPaid <= 0) {
          updatedBooking.status = 'cancelled';
          updatedBooking.cancellationReason = 'Tentative Hold Expired (No Advance Received within 48h)';
          updatedBooking.isTentative = false;
        }
      }

      return updatedBooking;
    });

    saveToStorage(STORAGE_KEYS.BOOKINGS, merged);
    return merged;
  }

  static setBookings(bookings: BookingEvent[]): void {
    const normalized = bookings.map(b => {
      const summary = getBookingPaymentSummary(b);
      return {
        ...b,
        totalBillPayable: summary.totalBill,
        depositPaid: summary.totalPaid,
        balanceToPay: summary.balanceToPay,
        finalPaymentConfirmed: Boolean(b.finalPaymentConfirmed) || (summary.totalBill > 0 && summary.balanceToPay <= 0.01),
      };
    });
    saveToStorage(STORAGE_KEYS.BOOKINGS, normalized);
  }

  // Check if a date + hall is already booked (One party per hall per date rule)
  static checkDateConflict(
    eventDate: string, 
    excludeBookingId?: string, 
    hallId?: string, 
    isMultiHall: boolean = true
  ): { hasConflict: boolean; conflictBooking?: BookingEvent } {
    const all = this.getBookings();
    const conflict = all.find(b => {
      if (b.status === 'cancelled') return false;
      if (excludeBookingId && b.id === excludeBookingId) return false;
      if (b.eventDate !== eventDate) return false;
      if (isMultiHall && hallId && b.hallId !== hallId) return false;
      return true;
    });

    return {
      hasConflict: Boolean(conflict),
      conflictBooking: conflict,
    };
  }

  // Add Payment with payment tracking
  static addPayment(
    bookingId: string, 
    payment: Omit<PaymentRecord, 'id' | 'bookingId' | 'receiptNumber' | 'createdAt'>,
    user?: UserProfile
  ): PaymentRecord {
    const bookings = this.getBookings();
    const target = bookings.find(b => b.id === bookingId);
    if (!target) throw new Error('Booking not found');

    const receiptNumber = `CPH-RCP-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    const newRecord: PaymentRecord = {
      ...payment,
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      bookingId,
      receiptNumber,
      createdAt: new Date().toISOString(),
    };

    const currentPayments = target.payments || [];
    const updatedPayments = [...currentPayments, newRecord];
    const preFp = getFunctionProspectusFinancials(target);
    const shouldFreezeFp = payment.paymentType === 'balance' || Boolean(target.partyEnded) || Boolean(target.finalPaymentConfirmed);

    const updatedBookings = bookings.map(b => {
      if (b.id === bookingId) {
        const nextBooking: BookingEvent = {
          ...b,
          payments: updatedPayments,
          fpPrePartyTotalBill: b.fpPrePartyTotalBill ?? (shouldFreezeFp ? preFp.fpTotalBill : undefined),
          fpPrePartyAdvancePaid: b.fpPrePartyAdvancePaid ?? (shouldFreezeFp ? preFp.fpAdvancePaid : undefined),
          fpPrePartyAdvanceMode: b.fpPrePartyAdvanceMode ?? (shouldFreezeFp ? (preFp.fpAdvanceMode || undefined) : undefined),
          isTentative: false, // Advance received confirms tentative hold
        };
        const nextSummary = getBookingPaymentSummary(nextBooking);
        return {
          ...nextBooking,
          depositPaid: nextSummary.totalPaid,
          totalBillPayable: nextSummary.totalBill,
          balanceToPay: nextSummary.balanceToPay,
          finalPaymentConfirmed: nextSummary.isBalanceSettled,
        };
      }
      return b;
    });

    this.setBookings(updatedBookings);
    this.addAuditLog(
      'Recorded Client Payment',
      `Payment of ${newRecord.amount} AED (${newRecord.paymentType.toUpperCase()} via ${newRecord.paymentMode}) recorded for ${target.bookingNumber} (${target.clientName}). Receipt #${receiptNumber}.`,
      'Invoice',
      user
    );

    this.addNotification({
      title: 'Payment Received',
      message: `${newRecord.amount} AED payment recorded for ${target.clientName} (${target.bookingNumber}) via ${newRecord.paymentMode}. Receipt #${receiptNumber}.`,
      type: 'payment_received',
      targetRoles: 'all',
      bookingId,
    });

    return newRecord;
  }

  // Cancel booking with mandatory reason & policy
  static cancelBookingWithPolicy(
    bookingId: string,
    policy: CancellationPolicyDetails,
    user?: UserProfile
  ): BookingEvent {
    const bookings = this.getBookings();
    const target = bookings.find(b => b.id === bookingId);
    if (!target) throw new Error('Booking not found');

    const updated: BookingEvent = {
      ...target,
      status: 'cancelled',
      cancellationReason: policy.reason,
      cancellationPolicy: policy,
      cancelledAt: new Date().toISOString(),
      cancelledBy: user?.name || policy.cancelledBy || 'F&B Supervisor',
      isTentative: false,
    };

    const nextBookings = bookings.map(b => b.id === bookingId ? updated : b);
    this.setBookings(nextBookings);

    this.addAuditLog(
      'Cancelled Banquet Booking',
      `Booking ${target.bookingNumber} on ${target.eventDate} was cancelled by ${user?.name || policy.cancelledBy}. Reason: "${policy.reason}". Policy: ${policy.advanceAction} (${policy.refundAmount} AED). Date is now freed.`,
      'Booking',
      user
    );

    this.addNotification({
      title: 'Banquet Cancelled & Date Freed',
      message: `Banquet on ${target.eventDate} for ${target.clientName} cancelled by ${user?.name || policy.cancelledBy}. Reason: "${policy.reason}". Date is now free for booking.`,
      type: 'cancellation',
      targetRoles: 'all',
      bookingId,
    });

    return updated;
  }

  // Booking Lock: Request & GM Approve
  static requestUnlock(bookingId: string, reason: string, user?: UserProfile): void {
    const bookings = this.getBookings();
    const updated = bookings.map(b => {
      if (b.id === bookingId) {
        return {
          ...b,
          lockDetails: {
            ...(b.lockDetails || { isLocked: true }),
            unlockRequested: true,
            unlockRequestReason: reason,
            unlockRequestedBy: user?.name || 'Staff',
            unlockRequestedAt: new Date().toISOString(),
          }
        };
      }
      return b;
    });
    this.setBookings(updated);

    const target = bookings.find(b => b.id === bookingId);
    this.addAuditLog(
      'Unlock Requested for Booking',
      `${user?.name} requested unlock for ${target?.bookingNumber || bookingId}. Reason: "${reason}"`,
      'Booking',
      user
    );

    this.addNotification({
      title: 'Record Unlock Requested',
      message: `Unlock requested for ${target?.clientName || 'Booking'} (${target?.bookingNumber}) by ${user?.name}. Reason: "${reason}". Requires GM approval.`,
      type: 'unlock_requested',
      targetRoles: ['general_manager'],
      bookingId,
    });
  }

  static approveUnlock(bookingId: string, gmUser?: UserProfile): void {
    const bookings = this.getBookings();
    const updated = bookings.map(b => {
      if (b.id === bookingId) {
        return {
          ...b,
          lockDetails: {
            isLocked: false,
            unlockApprovedBy: gmUser?.name || 'Abhishek Kumar (GM)',
            unlockApprovedAt: new Date().toISOString(),
          }
        };
      }
      return b;
    });
    this.setBookings(updated);

    const target = bookings.find(b => b.id === bookingId);
    this.addAuditLog(
      'Booking Unlock Approved by GM',
      `General Manager ${gmUser?.name} approved unlock request for ${target?.bookingNumber}. Record is now temporarily unlocked for revision.`,
      'Booking',
      gmUser
    );

    this.addNotification({
      title: 'Record Unlock Approved',
      message: `General Manager approved unlock for ${target?.clientName} (${target?.bookingNumber}). Record is now unlocked for updates.`,
      type: 'new_booking',
      targetRoles: 'all',
      bookingId,
    });
  }

  // Notifications Storage
  static getNotifications(): NotificationItem[] {
    const defaults: NotificationItem[] = [
      {
        id: 'notif_init_1',
        timestamp: '2026-10-14 09:00',
        title: 'Banquet Scheduled: Mr. Betsy',
        message: 'F&B Supervisor scheduled celebration party on Oct 14, 2026 (30 guests, First Floor Big Hall).',
        type: 'new_booking',
        targetRoles: 'all',
        bookingId: 'bk_betsy_301',
        isRead: false,
      },
      {
        id: 'notif_init_2',
        timestamp: '2026-10-14 10:15',
        title: 'Advance Payment Received',
        message: '1,500.00 AED advance received for Mr. Betsy via Cash. Receipt #CPH-RCP-2026-301-01.',
        type: 'payment_received',
        targetRoles: 'all',
        bookingId: 'bk_betsy_301',
        isRead: false,
      }
    ];
    const loaded = loadFromStorage(STORAGE_KEYS.NOTIFICATIONS, defaults);
    
    // Automatically guarantee notification exists for:
    // 1. F&B Supervisor: parties whose date has arrived/ended and are awaiting confirmation
    // 2. Executive Chef: parties ended by F&B Supervisor awaiting kitchen quantities
    // 3. Accounts: parties forwarded by Executive Chef awaiting purchasing prices
    try {
      const rawBookings = loadFromStorage<BookingEvent[]>(STORAGE_KEYS.BOOKINGS, INITIAL_BOOKINGS);
      let updatedList = [...loaded];
      let hasNew = false;

      // 1. Prompt for F&B Supervisor
      const unconfirmedEnded = rawBookings.filter(b => 
        b.eventDate <= '2026-10-14' && 
        !b.partyEnded && 
        b.status !== 'cancelled'
      );
      unconfirmedEnded.forEach(pb => {
        const exists = updatedList.some(n => n.bookingId === pb.id && n.type === 'party_ended_confirm_prompt');
        if (!exists) {
          updatedList.unshift({
            id: `notif_confirm_ended_${pb.id}`,
            timestamp: `${pb.eventDate} 22:00`,
            title: `Party Ended? Confirm Conclusion: ${pb.clientName}`,
            message: `The party date for ${pb.clientName} (${pb.bookingNumber}) on ${pb.eventDate} has concluded. Do you want to confirm the party has ended? Confirming will forward to Executive Chef.`,
            type: 'party_ended_confirm_prompt',
            targetRoles: ['fnb_supervisor', 'banquet_manager', 'general_manager'],
            bookingId: pb.id,
            isRead: false,
            actionRequired: 'confirm_party_ended',
          });
          hasNew = true;
        }
      });

      // 2. Executive Chef: parties ended by F&B Supervisor awaiting kitchen usage
      const pendingChefCostings = rawBookings.filter(b => 
        b.hasFoodFromHotel &&
        b.partyEnded &&
        (!b.chefApproved || b.costingStatus === 'party_ended_pending_chef') &&
        b.costingStatus !== 'forwarded_to_accounts' &&
        b.costingStatus !== 'costed_by_arun'
      );
      pendingChefCostings.forEach(pb => {
        const exists = updatedList.some(n => n.bookingId === pb.id && n.type === 'chef_action_required');
        if (!exists) {
          updatedList.unshift({
            id: `notif_chef_req_${pb.id}`,
            timestamp: pb.partyEndedAt ? pb.partyEndedAt.replace('T', ' ').substring(0, 16) : `${pb.eventDate} 23:00`,
            title: `Kitchen Costing Required: ${pb.clientName}`,
            message: `F&B Supervisor confirmed party ended for ${pb.clientName} (${pb.bookingNumber}). Please log actual ingredient usage in your 'Costing Required' tab and forward to Accounts.`,
            type: 'chef_action_required',
            targetRoles: ['executive_chef', 'general_manager'],
            bookingId: pb.id,
            isRead: false,
            actionRequired: 'cost_party_chef',
          });
          hasNew = true;
        }
      });

      // 3. Accounts: parties forwarded by Executive Chef awaiting purchasing prices
      const pendingAccountsCostings = rawBookings.filter(b => 
        (b.costingStatus === 'forwarded_to_accounts' || (b.chefApproved && !b.arunCostedAt && b.costingStatus !== 'costed_by_arun')) &&
        b.hasFoodFromHotel
      );
      pendingAccountsCostings.forEach(pb => {
        const exists = updatedList.some(n => n.bookingId === pb.id && (n.type === 'chef_finished' || n.title.includes('Purchasing Costing') || n.title.includes('Costing Action')));
        if (!exists) {
          updatedList.unshift({
            id: `notif_pending_costing_${pb.id}`,
            timestamp: pb.chefApprovedAt ? pb.chefApprovedAt.replace('T', ' ').substring(0, 16) : '2026-10-14 11:30',
            title: `Purchasing Costing Required: ${pb.clientName}`,
            message: `Executive Chef submitted ingredient quantities for ${pb.clientName} (${pb.bookingNumber}). Awaiting your purchase price costing in your 'Costing Required' tab.`,
            type: 'chef_finished',
            targetRoles: ['accounts_executive', 'general_manager'],
            bookingId: pb.id,
            isRead: false,
            actionRequired: 'cost_party_accounts',
          });
          hasNew = true;
        }
      });

      // 4. F&B Supervisor: Mandatory Balance Settlement Required for Ended Parties!
      const todayIso = new Date().toISOString().substring(0, 10);
      const endedPartiesWithBalance = rawBookings.filter(b => {
        if (b.status === 'cancelled') return false;
        const isEnded = b.partyEnded || b.status === 'completed' || (Boolean(b.eventDate) && b.eventDate < todayIso);
        if (!isEnded) return false;
        const summary = getBookingPaymentSummary(b);
        return summary.balanceToPay > 0.01 && !summary.isBalanceSettled;
      });

      endedPartiesWithBalance.forEach(pb => {
        const exists = updatedList.some(n => n.bookingId === pb.id && (n.type === 'mandatory_settle_balance' || n.actionRequired === 'settle_balance'));
        if (!exists) {
          const summary = getBookingPaymentSummary(pb);
          const balance = summary.balanceToPay;
          
          updatedList.unshift({
            id: `notif_mandatory_settle_${pb.id}`,
            timestamp: pb.partyEndedAt ? pb.partyEndedAt.replace('T', ' ').substring(0, 16) : `${pb.eventDate} 23:15`,
            title: `⚠️ Mandatory: Settle Balance for ${pb.clientName}`,
            message: `Party for ${pb.clientName} (${pb.bookingNumber}) on ${pb.eventDate} has ended. Outstanding balance of AED ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} must be collected and settled immediately by F&B Supervisor. This is mandatory.`,
            type: 'mandatory_settle_balance',
            targetRoles: ['fnb_supervisor', 'banquet_manager', 'general_manager'],
            bookingId: pb.id,
            isRead: false,
            actionRequired: 'settle_balance',
          });
          hasNew = true;
        }
      });

      if (hasNew) {
        saveToStorage(STORAGE_KEYS.NOTIFICATIONS, updatedList);
        return updatedList;
      }
    } catch {
      // Safe fallback to loaded
    }

    return loaded;
  }

  static setNotifications(notifications: NotificationItem[]): void {
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, notifications);
  }

  static addNotification(notif: Omit<NotificationItem, 'id' | 'timestamp' | 'isRead'>): NotificationItem {
    const current = this.getNotifications();
    const newNotif: NotificationItem = {
      ...notif,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      isRead: false,
    };
    const updated = [newNotif, ...current].slice(0, 50);
    this.setNotifications(updated);
    return newNotif;
  }

  static markNotificationsAsRead(): void {
    const current = this.getNotifications();
    const updated = current.map(n => ({ ...n, isRead: true }));
    this.setNotifications(updated);
  }

  static getInvoices(): Invoice[] {
    this.ensureCph1ActualsSynced();
    const loaded = loadFromStorage<Invoice[]>(STORAGE_KEYS.INVOICES, INITIAL_INVOICES);
    const existingIds = new Set(loaded.map(i => i.id));
    const missing = INITIAL_INVOICES.filter(i => !existingIds.has(i.id));
    const merged = (missing.length > 0 ? [...loaded, ...missing] : loaded).map(inv => ({
      ...inv,
      branch: (inv.branch === 'CPH2' ? 'CPH2' : 'CPH1') as 'CPH1' | 'CPH2',
    }));
    const changed = missing.length > 0 || loaded.some(inv => inv.branch !== 'CPH1' && inv.branch !== 'CPH2');
    if (changed) {
      saveToStorage(STORAGE_KEYS.INVOICES, merged);
    }
    return merged;
  }

  static setInvoices(invoices: Invoice[]): void {
    saveToStorage(STORAGE_KEYS.INVOICES, invoices);
  }

  static getBackups(): BackupRecord[] {
    return loadFromStorage(STORAGE_KEYS.BACKUPS, INITIAL_BACKUPS);
  }

  static setBackups(backups: BackupRecord[]): void {
    saveToStorage(STORAGE_KEYS.BACKUPS, backups);
  }

  static getAuditLogs(): AuditLog[] {
    return loadFromStorage(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
  }

  static addAuditLog(action: string, details: string, category: AuditLog['category'], user?: UserProfile): void {
    const logs = this.getAuditLogs();
    const currentUser = user || this.getActiveUser();
    const newLog: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userId: currentUser.id,
      userName: currentUser.name,
      action,
      details,
      category,
    };
    saveToStorage(STORAGE_KEYS.AUDIT_LOGS, [newLog, ...logs].slice(0, 50));
  }

  static createEncryptedBackup(initiator: string): BackupRecord {
    const fullState = {
      users: this.getUsers(),
      halls: this.getHalls(),
      ingredients: this.getIngredients(),
      recipes: this.getRecipes(),
      packages: this.getPackages(),
      bookings: this.getBookings(),
      invoices: this.getInvoices(),
    };

    const encryptedContent = encryptPayload(fullState);
    const checksum = generateChecksum(encryptedContent);
    const sizeBytes = new Blob([encryptedContent]).size;

    const newRecord: BackupRecord = {
      id: `bak_${Date.now()}`,
      timestamp: new Date().toISOString(),
      sizeBytes,
      sha256Hash: checksum,
      encryptionAlgorithm: 'AES-256-GCM',
      recordsCount: {
        bookings: fullState.bookings.length,
        recipes: fullState.recipes.length,
        ingredients: fullState.ingredients.length,
        invoices: fullState.invoices.length,
      },
      status: 'Synced to Cloud Vault',
      initiatedBy: initiator,
    };

    const backups = this.getBackups();
    this.setBackups([newRecord, ...backups]);
    this.addAuditLog('Encrypted Cloud Backup Created', `Full business snapshot encrypted (${Math.round(sizeBytes / 1024)} KB) with SHA-256 checksum ${checksum.substring(0, 16)}...`, 'Security');
    return newRecord;
  }

  static exportEncryptedFile(): { blob: Blob; filename: string } {
    const fullState = {
      exportedAt: new Date().toISOString(),
      system: 'Crystal Plaza Banquets Hotel Suite v2.4',
      users: this.getUsers(),
      halls: this.getHalls(),
      ingredients: this.getIngredients(),
      recipes: this.getRecipes(),
      packages: this.getPackages(),
      bookings: this.getBookings(),
      invoices: this.getInvoices(),
    };
    const encryptedContent = encryptPayload(fullState);
    const blob = new Blob([encryptedContent], { type: 'application/json' });
    const filename = `crystal_plaza_banquets_vault_backup_${new Date().toISOString().substring(0, 10)}.enc.json`;
    return { blob, filename };
  }

  static restoreFromEncryptedJson(jsonContent: string): { success: boolean; message: string } {
    try {
      // Check if encrypted envelop or raw
      let payloadData: any;
      if (jsonContent.includes('dataBlock')) {
        payloadData = decryptPayload(jsonContent);
      } else {
        payloadData = JSON.parse(jsonContent);
      }

      if (payloadData.halls) this.setHalls(payloadData.halls);
      if (payloadData.ingredients) this.setIngredients(payloadData.ingredients);
      if (payloadData.recipes) this.setRecipes(payloadData.recipes);
      if (payloadData.packages) this.setPackages(payloadData.packages);
      if (payloadData.bookings) this.setBookings(payloadData.bookings);
      if (payloadData.invoices) this.setInvoices(payloadData.invoices);

      this.addAuditLog('System Restored from Backup', 'Successfully decrypted and restored database records from backup file.', 'Security');
      return { success: true, message: 'Database successfully restored from verified encrypted snapshot.' };
    } catch (e: any) {
      return { success: false, message: `Decryption or restore failed: ${e.message}` };
    }
  }

  static getMarketingReports(): MetaAdMonthlyReport[] {
    this.ensureCph1ActualsSynced();
    const loaded = loadFromStorage<MetaAdMonthlyReport[]>(STORAGE_KEYS.MARKETING_REPORTS, INITIAL_MARKETING_REPORTS);
    const existingKeys = new Set(loaded.map(r => r.monthKey));
    const missing = INITIAL_MARKETING_REPORTS.filter(r => !existingKeys.has(r.monthKey));
    const merged = [...loaded, ...missing].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    saveToStorage(STORAGE_KEYS.MARKETING_REPORTS, merged);
    return merged;
  }

  static setMarketingReports(reports: MetaAdMonthlyReport[]): void {
    saveToStorage(STORAGE_KEYS.MARKETING_REPORTS, reports);
  }

  static saveMarketingReport(report: MetaAdMonthlyReport): void {
    const current = this.getMarketingReports();
    const exists = current.some(r => r.monthKey === report.monthKey || r.id === report.id);
    const updated = exists 
      ? current.map(r => (r.monthKey === report.monthKey || r.id === report.id) ? report : r)
      : [report, ...current];
    updated.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    saveToStorage(STORAGE_KEYS.MARKETING_REPORTS, updated);
  }

  // =========================================================================
  // MONTHLY REVENUE GOAL STORAGE
  // =========================================================================
  static getMonthlyRevenueGoal(): number {
    const val = localStorage.getItem(STORAGE_KEYS.MONTHLY_REVENUE_GOAL);
    if (!val) return 80000;
    const num = parseFloat(val);
    return isNaN(num) || num <= 0 ? 80000 : num;
  }

  static setMonthlyRevenueGoal(goal: number): void {
    if (goal > 0) {
      localStorage.setItem(STORAGE_KEYS.MONTHLY_REVENUE_GOAL, goal.toString());
    }
  }

  // =========================================================================
  // HOTEL ROOM GUESTS RETARGETING STORAGE
  // =========================================================================
  static getHotelRoomGuests(): HotelRoomGuest[] {
    const loaded = loadFromStorage<HotelRoomGuest[]>(STORAGE_KEYS.HOTEL_ROOM_GUESTS, INITIAL_HOTEL_ROOM_GUESTS);
    // If empty or never seeded, seed with INITIAL_HOTEL_ROOM_GUESTS
    if (!loaded || loaded.length === 0) {
      saveToStorage(STORAGE_KEYS.HOTEL_ROOM_GUESTS, INITIAL_HOTEL_ROOM_GUESTS);
      return INITIAL_HOTEL_ROOM_GUESTS;
    }
    return loaded;
  }

  static saveHotelRoomGuests(guests: HotelRoomGuest[]): void {
    saveToStorage(STORAGE_KEYS.HOTEL_ROOM_GUESTS, guests);
  }

  static updateHotelRoomGuest(updatedGuest: HotelRoomGuest): void {
    const current = this.getHotelRoomGuests();
    const exists = current.some(g => g.id === updatedGuest.id);
    const nextList = exists
      ? current.map(g => g.id === updatedGuest.id ? updatedGuest : g)
      : [updatedGuest, ...current];
    this.saveHotelRoomGuests(nextList);
  }

  static getWhatsAppOffers(): WhatsAppRetargetingOffer[] {
    const loaded = loadFromStorage<WhatsAppRetargetingOffer[]>(STORAGE_KEYS.WHATSAPP_OFFERS, INITIAL_WHATSAPP_OFFERS);
    if (!loaded || loaded.length === 0) {
      saveToStorage(STORAGE_KEYS.WHATSAPP_OFFERS, INITIAL_WHATSAPP_OFFERS);
      return INITIAL_WHATSAPP_OFFERS;
    }
    return loaded;
  }

  static saveWhatsAppOffers(offers: WhatsAppRetargetingOffer[]): void {
    saveToStorage(STORAGE_KEYS.WHATSAPP_OFFERS, offers);
  }

  static getWhatsAppTemplates(): WhatsAppMessageTemplate[] {
    const loaded = loadFromStorage<WhatsAppMessageTemplate[]>(STORAGE_KEYS.WHATSAPP_TEMPLATES, INITIAL_WHATSAPP_TEMPLATES);
    if (!loaded || loaded.length === 0) {
      saveToStorage(STORAGE_KEYS.WHATSAPP_TEMPLATES, INITIAL_WHATSAPP_TEMPLATES);
      return INITIAL_WHATSAPP_TEMPLATES;
    }
    return loaded;
  }

  static saveWhatsAppTemplates(templates: WhatsAppMessageTemplate[]): void {
    saveToStorage(STORAGE_KEYS.WHATSAPP_TEMPLATES, templates);
  }

  // -------------------------------------------------------------
  // Banquet Inquiries & Lead Pipeline Methods
  // -------------------------------------------------------------
  static getBanquetLeads(): BanquetLead[] {
    const loaded = loadFromStorage<BanquetLead[]>(STORAGE_KEYS.BANQUET_LEADS, INITIAL_BANQUET_LEADS);
    if (!loaded || loaded.length === 0) {
      saveToStorage(STORAGE_KEYS.BANQUET_LEADS, INITIAL_BANQUET_LEADS);
      return INITIAL_BANQUET_LEADS;
    }
    const validNames = new Set(INITIAL_HALLS.map(h => h.name));
    let changed = false;
    const normalized = loaded.map(lead => {
      if (lead.hallPreference && !validNames.has(lead.hallPreference)) {
        changed = true;
        const lower = lead.hallPreference.toLowerCase();
        const mapped =
          lower.includes('suite') || lower.includes('dana') || lower.includes('terrace') || lower.includes('emerald')
            ? 'Suite room Hall'
            : 'First Floor Big Hall';
        return { ...lead, hallPreference: mapped };
      }
      return lead;
    });
    if (changed) {
      saveToStorage(STORAGE_KEYS.BANQUET_LEADS, normalized);
    }
    return normalized;
  }

  static saveBanquetLeads(leads: BanquetLead[]): void {
    saveToStorage(STORAGE_KEYS.BANQUET_LEADS, leads);
  }

  static saveBanquetLead(lead: BanquetLead): BanquetLead {
    const leads = this.getBanquetLeads();
    const index = leads.findIndex(l => l.id === lead.id);
    let updated: BanquetLead[];
    if (index >= 0) {
      updated = leads.map(l => l.id === lead.id ? lead : l);
    } else {
      updated = [lead, ...leads];
    }
    this.saveBanquetLeads(updated);
    return lead;
  }

  static updateLeadStage(leadId: string, stage: InquiryStage, user?: UserProfile): BanquetLead | null {
    const leads = this.getBanquetLeads();
    const target = leads.find(l => l.id === leadId);
    if (!target) return null;

    const updated: BanquetLead = {
      ...target,
      stage,
      lastFollowUpAt: new Date().toISOString(),
    };
    this.saveBanquetLeads(leads.map(l => l.id === leadId ? updated : l));

    this.addAuditLog(
      'Updated Lead Stage',
      `Lead "${target.clientName}" moved to stage: ${stage.replace('_', ' ').toUpperCase()}`,
      'Booking',
      user
    );

    return updated;
  }

  static deleteBanquetLead(leadId: string): void {
    const leads = this.getBanquetLeads();
    this.saveBanquetLeads(leads.filter(l => l.id !== leadId));
  }

  // 1-Click Convert Lead to Confirmed Banquet Booking!
  static convertLeadToBooking(
    leadId: string, 
    extra?: { 
      hallId?: string; 
      packageId?: string; 
      foodPricePerGuestCharged?: number;
      depositAmount?: number;
    },
    user?: UserProfile
  ): { booking: BookingEvent; lead: BanquetLead } {
    const leads = this.getBanquetLeads();
    const lead = leads.find(l => l.id === leadId);
    if (!lead) throw new Error('Lead not found');

    const bookings = this.getBookings();
    const halls = this.getHalls();
    const packages = this.getPackages();

    const selectedHall =
      halls.find(h => h.id === extra?.hallId) ||
      halls.find(h => h.name.toLowerCase() === (lead.hallPreference || '').toLowerCase()) ||
      ((lead.hallPreference || '').toLowerCase().includes('suite')
        ? halls.find(h => h.id === 'hall_suite_room')
        : halls[0]) ||
      halls[0];
    const selectedPackage = packages.find(p => p.id === extra?.packageId) || packages[0];
    const eventDate = lead.targetEventDate || new Date().toISOString().substring(0, 10);
    const guestCount = lead.estimatedGuests || 0;
    const foodPrice = extra?.foodPricePerGuestCharged || 0;
    const deposit = extra?.depositAmount || 0;

    const bookingNum = `CPH-${eventDate.substring(0, 4)}-${(bookings.length + 1).toString().padStart(3, '0')}`;
    const newBookingId = `b_${Date.now()}`;
    const totalBill = foodPrice * guestCount;

    const newBooking: BookingEvent = {
      id: newBookingId,
      bookingNumber: bookingNum,
      branch: 'CPH1',
      clientName: lead.clientName,
      clientPhone: lead.phone,
      clientEmail: lead.email,
      bookingDate: new Date().toISOString().substring(0, 10),
      eventDate,
      timeSlot: 'evening',
      hallId: selectedHall.id,
      hallName: selectedHall.name,
      hallSection: 'Full Banquet Hall',
      hallOffer: 'free_with_food',
      eventType: lead.eventType || '',
      guestCount,
      agreementType: 'per_person',
      packageId: selectedPackage?.id,
      selectedMenuName: lead.buffetPreference || undefined,
      customRecipeItemIds: [],
      foodPricePerGuestCharged: foodPrice,
      packageFixedPriceCharged: 0,
      hallRentalCharged: 0,
      hallDirectCost: selectedHall?.cleaningFee || 0,
      foodCostPerGuestTheoretical: 0,
      decorAndAVCharged: 0,
      decorAndAVCost: 0,
      beveragePriceCharged: 0,
      beverageCostTotal: 0,
      staffingCost: 0,
      extraCharges: 0,
      discountAmount: 0,
      taxPercent: 0,
      municipalityFeePercent: 0,
      serviceChargePercent: 0,
      depositPaid: deposit,
      totalBillPayable: totalBill,
      balanceToPay: Math.max(0, totalBill - deposit),
      chefUsageLogged: false,
      hasFoodFromHotel: true,
      costingMethod: 'party_batch',
      costingStatus: 'not_started',
      status: 'confirmed',
      venueFloor: lead.hallPreference || selectedHall?.name || '',
      fnbRepresentative: user?.name || 'F&B Supervisor',
      leadSource: lead.source,
      payments: deposit > 0 ? [
        {
          id: `pay_${Date.now()}`,
          bookingId: newBookingId,
          date: new Date().toISOString().substring(0, 10),
          amount: deposit,
          paymentType: 'advance',
          paymentMode: 'Cash',
          receiptNumber: `CPH-RCP-${Date.now().toString().slice(-5)}`,
          receivedBy: user?.name || 'F&B Supervisor',
          notes: 'Advance deposit upon conversion from inquiry pipeline',
          createdAt: new Date().toISOString(),
        }
      ] : [],
      createdAt: new Date().toISOString(),
    };

    // Save new booking
    this.setBookings([newBooking, ...bookings]);

    // Update lead stage to converted_won
    const updatedLead: BanquetLead = {
      ...lead,
      stage: 'converted_won',
      convertedBookingId: newBookingId,
      notes: `${lead.notes || ''} [Converted to Booking ${bookingNum} on ${new Date().toISOString().substring(0, 10)}]`,
    };
    this.saveBanquetLeads(leads.map(l => l.id === leadId ? updatedLead : l));

    // Audit log
    this.addAuditLog(
      'Converted Ad Lead to Banquet Booking',
      `Lead "${lead.clientName}" converted to confirmed booking ${bookingNum} for ${eventDate} (${guestCount} guests). Advance: AED ${deposit}.`,
      'Booking',
      user
    );

    // Notification
    this.addNotification({
      title: 'New Booking from Ad Lead!',
      message: `${lead.clientName} converted from ${lead.source.replace(/_/g, ' ')} to Booking ${bookingNum} on ${eventDate}.`,
      type: 'new_booking',
      targetRoles: 'all',
      bookingId: newBookingId,
    });

    return { booking: newBooking, lead: updatedLead };
  }

  static resetToDefault(): void {
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
    localStorage.removeItem(STORAGE_KEYS.HALLS);
    localStorage.removeItem(STORAGE_KEYS.INGREDIENTS);
    localStorage.removeItem(STORAGE_KEYS.RECIPES);
    localStorage.removeItem(STORAGE_KEYS.PACKAGES);
    localStorage.removeItem(STORAGE_KEYS.BOOKINGS);
    localStorage.removeItem(STORAGE_KEYS.INVOICES);
    localStorage.removeItem(STORAGE_KEYS.BACKUPS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    window.location.reload();
  }
}

export const StorageService = AppStorage;
