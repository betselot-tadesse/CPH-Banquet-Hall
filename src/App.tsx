import React, { useState } from 'react';
import { 
  UserProfile, 
  BanquetHall, 
  RawIngredient, 
  RecipeMenuItem, 
  BanquetPackage, 
  BookingEvent, 
  Invoice, 
  BackupRecord, 
  AuditLog, 
  ChefUsageItem,
  ChefPartyIngredientEntry,
  CostingMethod,
  CostingWorkflowStatus,
  HotelBranch,
  MetaAdMonthlyReport,
  NotificationItem,
  EventChecklistItem
} from './types';
import { AppStorage } from './services/storage';
import { getBookingPaymentSummary, getFunctionProspectusFinancials, getLiveTodayInfo } from './utils/costCalculations';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { BookingsManager } from './components/BookingsManager';
import { FoodCostingCalculator } from './components/FoodCostingCalculator';
import { InvoiceGenerator } from './components/InvoiceGenerator';
import { ReportsAnalytics } from './components/ReportsAnalytics';
import { BackupSecurity } from './components/BackupSecurity';
import { ChefUsageModal } from './components/ChefUsageModal';
import { BanquetPartyA4Sheet } from './components/BanquetPartyA4Sheet';
import { MarketingManager } from './components/MarketingManager';
import { QuickCashSettlementModal } from './components/QuickCashSettlementModal';
import { AiAnalysisPanel } from './components/AiAnalysisPanel';
import { 
  Building2, 
  Calendar, 
  Plus, 
  Menu as MenuIcon, 
  Sparkles, 
  ShieldCheck, 
  UtensilsCrossed,
  Bell,
  CheckCheck,
  Lock,
  Ban,
  Clock,
  CreditCard,
  Banknote,
  X 
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [currentUser, setCurrentUser] = useState<UserProfile>(AppStorage.getActiveUser());
  const [allUsers, setAllUsers] = useState<UserProfile[]>(AppStorage.getUsers());
  const [halls, setHalls] = useState<BanquetHall[]>(AppStorage.getHalls());
  const [ingredients, setIngredients] = useState<RawIngredient[]>(AppStorage.getIngredients());
  const [recipes, setRecipes] = useState<RecipeMenuItem[]>(AppStorage.getRecipes());
  const [packages, setPackages] = useState<BanquetPackage[]>(AppStorage.getPackages());
  const [bookings, setBookings] = useState<BookingEvent[]>(AppStorage.getBookings());
  const [invoices, setInvoices] = useState<Invoice[]>(AppStorage.getInvoices());
  const [backups, setBackups] = useState<BackupRecord[]>(AppStorage.getBackups());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(AppStorage.getAuditLogs());
  const [marketingReports, setMarketingReports] = useState<MetaAdMonthlyReport[]>(AppStorage.getMarketingReports());
  const [notifications, setNotifications] = useState<NotificationItem[]>(AppStorage.getNotifications());
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);

  // Global branch filter
  const [selectedBranch, setSelectedBranch] = useState<HotelBranch | 'All'>('CPH1');

  // Mobile drawer state
  const [mobileOpen, setMobileOpen] = useState(false);

  // Global modals and routing targets
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [createBookingTrigger, setCreateBookingTrigger] = useState(false);
  const [chefUsageModalBooking, setChefUsageModalBooking] = useState<BookingEvent | null>(null);

  const handleOpenNewBookingModal = () => {
    setCreateBookingTrigger(true);
    setActiveTab('bookings');
    setBookingModalOpen(true);
  };
  const [a4ModalBooking, setA4ModalBooking] = useState<BookingEvent | null>(null);
  const [a4InitialPage, setA4InitialPage] = useState<1 | 2 | 3 | undefined>(undefined);
  const [invoiceTargetBookingId, setInvoiceTargetBookingId] = useState<string | undefined>(undefined);
  const [quickCashSettleBooking, setQuickCashSettleBooking] = useState<BookingEvent | null>(null);

  const openA4Modal = (b: BookingEvent, page?: 1 | 2 | 3) => {
    setA4InitialPage(page);
    setA4ModalBooking(b);
  };

  const refreshAllState = () => {
    setCurrentUser(AppStorage.getActiveUser());
    setAllUsers(AppStorage.getUsers());
    setHalls(AppStorage.getHalls());
    setIngredients(AppStorage.getIngredients());
    setRecipes(AppStorage.getRecipes());
    setPackages(AppStorage.getPackages());
    setBookings(AppStorage.getBookings());
    setInvoices(AppStorage.getInvoices());
    setBackups(AppStorage.getBackups());
    setAuditLogs(AppStorage.getAuditLogs());
    setMarketingReports(AppStorage.getMarketingReports());
    setNotifications(AppStorage.getNotifications());
  };

  const handleMarkAllRead = () => {
    AppStorage.markNotificationsAsRead();
    setNotifications(AppStorage.getNotifications());
  };

  const { todayStr, todayDisplayStr } = getLiveTodayInfo();

  const relevantNotifications = notifications.filter(n => {
    if (currentUser.role === 'general_manager') {
      // GM gets high-level exceptions only (no routine booking/settlement spam)
      return Array.isArray(n.targetRoles) && n.targetRoles.includes('general_manager') &&
        !['new_booking', 'party_ended_confirm_prompt', 'mandatory_settle_balance'].includes(n.type || '');
    }
    return n.targetRoles === 'all' || (Array.isArray(n.targetRoles) && n.targetRoles.includes(currentUser.role));
  });
  const unreadCount = relevantNotifications.filter(n => !n.isRead).length;

  const handleSwitchUser = (user: UserProfile) => {
    setCurrentUser(user);
    AppStorage.setActiveUser(user);

    // Enforce clean role workspace boundaries matching Navbar
    if (user.role === 'general_manager') {
      if (!['dashboard', 'reports', 'ai_analysis'].includes(activeTab)) {
        setActiveTab('dashboard');
      }
    } else if (user.role === 'executive_chef') {
      if (!['dashboard', 'ai_analysis', 'costing_required', 'bookings', 'costing', 'backups'].includes(activeTab)) {
        setActiveTab('dashboard');
      }
    } else if (user.role === 'accounts_executive') {
      if (!['dashboard', 'ai_analysis', 'costing_required', 'bookings', 'costing', 'invoices', 'reports', 'backups'].includes(activeTab)) {
        setActiveTab('dashboard');
      }
    } else if (user.role === 'fnb_supervisor' || user.role === 'banquet_manager') {
      const allowed = user.role === 'fnb_supervisor'
        ? ['dashboard', 'ai_analysis', 'banquet_calendar', 'bookings', 'invoices', 'marketing_kpi']
        : ['dashboard', 'ai_analysis', 'banquet_calendar', 'bookings', 'invoices', 'marketing_kpi', 'guest_retargeting'];
      if (!allowed.includes(activeTab)) {
        setActiveTab('dashboard');
      }
    } else if (user.role === 'marketing_executive') {
      if (!['dashboard', 'ai_analysis', 'marketing', 'marketing_kpi', 'guest_retargeting', 'bookings', 'reports', 'backups'].includes(activeTab)) {
        setActiveTab('dashboard');
      }
    }

    AppStorage.addAuditLog(
      'User Switched Role Profile',
      `Switched active session to ${user.name} (${user.role.toUpperCase()})`,
      'Security',
      user
    );
    setAuditLogs(AppStorage.getAuditLogs());
  };

  const handleSaveBooking = (newBooking: BookingEvent) => {
    const updated = [newBooking, ...bookings];
    setBookings(updated);
    AppStorage.setBookings(updated);
    AppStorage.addAuditLog(
      'Created Banquet Booking',
      `Booked ${newBooking.hallName} (${newBooking.branch}) for ${newBooking.clientName} (${newBooking.guestCount} guests, Event Date: ${newBooking.eventDate})`,
      'Booking',
      currentUser
    );
    AppStorage.addNotification({
      title: 'New Banquet Scheduled',
      message: `Supervisor booked ${newBooking.clientName} on ${newBooking.eventDate} (${newBooking.guestCount} guests, ${newBooking.hallName}). Instantly available on Chef and Accounts dashboards.`,
      type: 'new_booking',
      targetRoles: 'all',
      bookingId: newBooking.id,
    });
    setAuditLogs(AppStorage.getAuditLogs());
    setNotifications(AppStorage.getNotifications());
  };

  const handleUpdateBooking = (updatedBooking: BookingEvent) => {
    const updated = bookings.map(b => b.id === updatedBooking.id ? updatedBooking : b);
    setBookings(updated);
    AppStorage.setBookings(updated);
    if (updatedBooking.status === 'cancelled' && updatedBooking.cancellationReason) {
      AppStorage.addNotification({
        title: 'Banquet Cancelled & Date Freed',
        message: `Banquet on ${updatedBooking.eventDate} for ${updatedBooking.clientName} cancelled by ${currentUser.name}. Reason: "${updatedBooking.cancellationReason}". Date is now available.`,
        type: 'cancellation',
        targetRoles: 'all',
        bookingId: updatedBooking.id,
      });
    }
    AppStorage.addAuditLog(
      'Updated Banquet Booking',
      `Updated ${updatedBooking.bookingNumber} for ${updatedBooking.clientName} (Party date: ${updatedBooking.eventDate})`,
      'Booking',
      currentUser
    );
    setAuditLogs(AppStorage.getAuditLogs());
    setNotifications(AppStorage.getNotifications());
  };

  const handleDeleteBooking = (bookingId: string) => {
    const target = bookings.find(b => b.id === bookingId);
    const updated = bookings.filter(b => b.id !== bookingId);
    setBookings(updated);
    AppStorage.setBookings(updated);
    AppStorage.addAuditLog(
      'Deleted Banquet Booking',
      `Deleted ${target?.bookingNumber || bookingId} for ${target?.clientName}`,
      'Booking',
      currentUser
    );
    setAuditLogs(AppStorage.getAuditLogs());
  };

  const handleToggleChecklistItem = (
    bookingId: string,
    item: EventChecklistItem,
    nextCompleted: boolean,
    mergedChecklist: EventChecklistItem[]
  ) => {
    const target = bookings.find(b => b.id === bookingId);
    const updated = bookings.map(b =>
      b.id === bookingId ? { ...b, checklist: mergedChecklist } : b
    );
    setBookings(updated);
    AppStorage.setBookings(updated);
    AppStorage.addAuditLog(
      nextCompleted ? 'Daily Checklist Item Completed' : 'Daily Checklist Item Reopened',
      `${currentUser.name} ${nextCompleted ? 'checked off' : 'unchecked'} "${item.task}" (${item.category}) for ${target?.clientName || bookingId} (${target?.bookingNumber || 'N/A'}, ${target?.hallName || 'Hall'}, Event Date: ${target?.eventDate || 'Today'}).`,
      'Booking',
      currentUser
    );
    setAuditLogs(AppStorage.getAuditLogs());
  };

  const handleAddChecklistItem = (
    bookingId: string,
    newItem: EventChecklistItem,
    mergedChecklist: EventChecklistItem[]
  ) => {
    const target = bookings.find(b => b.id === bookingId);
    const updated = bookings.map(b =>
      b.id === bookingId ? { ...b, checklist: mergedChecklist } : b
    );
    setBookings(updated);
    AppStorage.setBookings(updated);
    AppStorage.addAuditLog(
      'Daily Checklist Task Added',
      `${currentUser.name} added custom daily checklist task "${newItem.task}" for ${target?.clientName || bookingId} (${target?.bookingNumber || 'N/A'}).`,
      'Booking',
      currentUser
    );
    setAuditLogs(AppStorage.getAuditLogs());
  };

  const handleConfirmPartyEnded = (bookingId: string) => {
    const target = bookings.find(b => b.id === bookingId);
    if (!target) return;

    const updated = bookings.map(b => {
      if (b.id === bookingId) {
        const fp = getFunctionProspectusFinancials(b);
        return {
          ...b,
          fpPrePartyTotalBill: b.fpPrePartyTotalBill ?? fp.fpTotalBill,
          fpPrePartyAdvancePaid: b.fpPrePartyAdvancePaid ?? fp.fpAdvancePaid,
          fpPrePartyAdvanceMode: b.fpPrePartyAdvanceMode ?? (fp.fpAdvanceMode || undefined),
          partyEnded: true,
          partyEndedAt: new Date().toISOString(),
          partyEndedConfirmedBy: currentUser.name,
          status: 'completed' as const,
          costingStatus: 'party_ended_pending_chef' as const,
        };
      }
      return b;
    });

    setBookings(updated);
    AppStorage.setBookings(updated);

    AppStorage.addAuditLog(
      'Party Ended Confirmed by Supervisor',
      `Francis D'Souza confirmed party ended for ${target.clientName} (${target.bookingNumber}, ${target.eventDate}). Forwarded directly to Chef Karim's Costing Required queue.`,
      'Booking',
      currentUser
    );

    AppStorage.addNotification({
      title: 'Party Concluded - Chef Kitchen Stamping Required',
      message: `Party for ${target.clientName} (${target.bookingNumber}) on ${target.eventDate} concluded. Executive Chef Karim must log kitchen quantities and issue Chef Stamp Paper.`,
      type: 'chef_action_required',
      targetRoles: ['executive_chef', 'general_manager'],
      bookingId: target.id,
      actionRequired: 'cost_party_chef',
    });

    // RULE: "make sure to send notification for francis after the party ends he have to settle balance that is must"
    const paySummary = getBookingPaymentSummary(target);
    const balance = paySummary.balanceToPay;

    if (balance > 0.01 || !paySummary.isBalanceSettled) {
      AppStorage.addNotification({
        title: `⚠️ Mandatory: Settle Balance for ${target.clientName}`,
        message: `Party for ${target.clientName} (${target.bookingNumber}) has ended. Outstanding balance of AED ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} must be collected and settled immediately by Francis. This is mandatory.`,
        type: 'mandatory_settle_balance',
        targetRoles: ['fnb_supervisor', 'banquet_manager', 'general_manager'],
        bookingId: target.id,
        actionRequired: 'settle_balance',
      });
    }

    setAuditLogs(AppStorage.getAuditLogs());
    setNotifications(AppStorage.getNotifications());
  };

  const handleCashBalanceSettled = (updatedBooking: BookingEvent) => {
    setBookings(prev => prev.map(b => b.id === updatedBooking.id ? updatedBooking : b));
    setNotifications(AppStorage.getNotifications());
    setAuditLogs(AppStorage.getAuditLogs());
    setQuickCashSettleBooking(null);
  };

  const handleSaveRecipe = (newRecipe: RecipeMenuItem) => {
    if (currentUser.role !== 'executive_chef') {
      alert('Permission Denied: Only Executive Chef Karim Zayani has the privilege to create or edit recipes and ingredients.');
      return;
    }
    const updated = [newRecipe, ...recipes];
    setRecipes(updated);
    AppStorage.setRecipes(updated);
    AppStorage.addAuditLog(
      'Created Signature Dish Recipe',
      `Added ${newRecipe.name} with standard cost ${newRecipe.totalCostPerPortion} AED/portion (${newRecipe.targetFoodCostPercent}% food cost)`,
      'Costing',
      currentUser
    );
    setAuditLogs(AppStorage.getAuditLogs());
  };

  const handleUpdateIngredient = (updatedIngredient: RawIngredient) => {
    if (currentUser.role !== 'executive_chef') {
      alert('Permission Denied: Only Executive Chef Karim Zayani has the privilege to adjust ingredient inventory.');
      return;
    }
    const updated = ingredients.map(i => i.id === updatedIngredient.id ? updatedIngredient : i);
    setIngredients(updated);
    AppStorage.setIngredients(updated);
    AppStorage.addAuditLog(
      'Inventory Stock Adjusted',
      `Adjusted ${updatedIngredient.name} stock level to ${updatedIngredient.stockQuantity} ${updatedIngredient.unit}`,
      'Inventory',
      currentUser
    );
    setAuditLogs(AppStorage.getAuditLogs());
  };

  const handleAddIngredient = (newIngredient: RawIngredient) => {
    if (currentUser.role !== 'executive_chef') {
      alert('Permission Denied: Only Executive Chef Karim Zayani has the privilege to enter raw ingredients.');
      return;
    }
    const updated = [...ingredients, newIngredient];
    setIngredients(updated);
    AppStorage.setIngredients(updated);
    AppStorage.addAuditLog(
      'New Raw Ingredient Added',
      `Added ${newIngredient.name} (${newIngredient.category}) at ${newIngredient.costPerUnit} AED/${newIngredient.unit}`,
      'Inventory',
      currentUser
    );
    setAuditLogs(AppStorage.getAuditLogs());
  };

  const handleSaveChefUsage = (bookingId: string, logs: ChefUsageItem[], actualCost: number, notes: string) => {
    if (currentUser.role !== 'executive_chef') {
      alert('Permission Denied: Only Executive Chef Karim Zayani can enter ingredient usage.');
      return;
    }
    const updatedBookings = bookings.map(b => {
      if (b.id === bookingId) {
        return {
          ...b,
          chefUsageLogged: true,
          chefUsageLogs: logs,
          foodCostActualTotal: actualCost,
          chefNotes: notes,
        };
      }
      return b;
    });

    setBookings(updatedBookings);
    AppStorage.setBookings(updatedBookings);

    // Deduct actual ingredient quantities from raw inventory
    const inventoryMap = new Map(ingredients.map(i => [i.id, { ...i }]));
    logs.forEach(log => {
      const inv = inventoryMap.get(log.ingredientId);
      if (inv) {
        inv.stockQuantity = Math.max(0, parseFloat((inv.stockQuantity - log.actualUsedQuantity).toFixed(2)));
      }
    });
    const updatedIngredients = Array.from(inventoryMap.values());
    setIngredients(updatedIngredients);
    AppStorage.setIngredients(updatedIngredients);

    const target = bookings.find(b => b.id === bookingId);
    AppStorage.addAuditLog(
      'Chef Actual Food Usage Logged',
      `Logged kitchen usage for ${target?.bookingNumber || bookingId}. Cooked food cost: ${actualCost.toFixed(2)} AED. Inventory updated.`,
      'Costing',
      currentUser
    );
    setAuditLogs(AppStorage.getAuditLogs());
  };

  const handleSavePartyCosting = (
    bookingId: string,
    entries: ChefPartyIngredientEntry[],
    method: CostingMethod,
    status: CostingWorkflowStatus,
    actualCost: number,
    chefNotes: string,
    arunNotes: string
  ) => {
    // RULE: Only Executive Chef can enter ingredients or forward party kitchen quantities
    if (status === 'forwarded_to_accounts' && currentUser.role !== 'executive_chef') {
      alert('Permission Denied: Only Executive Chef Karim Zayani has the privilege to enter ingredients and quantities.');
      return;
    }

    const currentBooking = bookings.find(b => b.id === bookingId);

    // If Accounts is saving costing, strictly preserve the Chef's entered ingredients and quantities!
    let finalEntries = entries;
    if (currentUser.role === 'accounts_executive' && currentBooking?.chefPartyEntries && currentBooking.chefPartyEntries.length > 0) {
      finalEntries = currentBooking.chefPartyEntries.map(ce => {
        const matching = entries.find(e => e.id === ce.id) || ce;
        return {
          ...ce, // Chef's ingredient and amountUsed are immutable by Accounts
          purchasingPriceAED: matching.purchasingPriceAED,
          purchasingUnit: matching.purchasingUnit,
          calculatedCostAED: matching.calculatedCostAED,
          priceSource: matching.priceSource,
        };
      });
    }

    const updatedBookings = bookings.map(b => {
      if (b.id === bookingId) {
        return {
          ...b,
          costingMethod: method,
          costingStatus: status,
          chefPartyEntries: finalEntries,
          chefUsageLogged: status === 'costed_by_arun' || status === 'approved',
          foodCostActualTotal: actualCost,
          chefNotes: chefNotes,
          arunAccountsNotes: arunNotes,
          chefForwardedAt: status === 'forwarded_to_accounts' || status === 'costed_by_arun'
            ? b.chefForwardedAt || new Date().toISOString()
            : b.chefForwardedAt,
          chefApproved: (status === 'forwarded_to_accounts' || status === 'costed_by_arun') ? true : b.chefApproved,
          chefApprovedAt: (status === 'forwarded_to_accounts' || status === 'costed_by_arun') ? (b.chefApprovedAt || new Date().toISOString()) : b.chefApprovedAt,
          chefApprovedBy: (status === 'forwarded_to_accounts' || status === 'costed_by_arun') ? (b.chefApprovedBy || currentUser.name) : b.chefApprovedBy,
          chefStampSerial: (status === 'forwarded_to_accounts' || status === 'costed_by_arun') ? (b.chefStampSerial || `CPH-CHEF-STAMP-${b.bookingNumber.replace(/[^0-9]/g, '') || Date.now()}`) : b.chefStampSerial,
          arunCostedAt: status === 'costed_by_arun' || status === 'approved'
            ? new Date().toISOString()
            : b.arunCostedAt,
          arunCostedBy: status === 'costed_by_arun' || status === 'approved'
            ? currentUser.name
            : b.arunCostedBy,
          arunApprovedAt: status === 'costed_by_arun' || status === 'approved'
            ? new Date().toISOString()
            : b.arunApprovedAt,
          postingReportGenerated: (status === 'costed_by_arun' || status === 'approved') ? true : b.postingReportGenerated,
          postingReportNumber: (status === 'costed_by_arun' || status === 'approved') 
            ? (b.postingReportNumber || `CPH-GL-POST-${b.bookingNumber.replace(/[^0-9]/g, '') || Date.now()}`) 
            : b.postingReportNumber,
          glPostingDate: (status === 'costed_by_arun' || status === 'approved') 
            ? (b.glPostingDate || new Date().toISOString()) 
            : b.glPostingDate,
        };
      }
      return b;
    });

    setBookings(updatedBookings);
    AppStorage.setBookings(updatedBookings);

    // Sync invoice if exists
    const targetBooking = updatedBookings.find(b => b.id === bookingId);
    if (targetBooking && invoices.some(i => i.bookingId === bookingId)) {
      const updatedInvoices = invoices.map(inv => {
        if (inv.bookingId === bookingId) {
          const totalCost = actualCost + targetBooking.hallDirectCost + targetBooking.decorAndAVCost + targetBooking.staffingCost;
          const grossProfit = inv.grandTotal - totalCost;
          const margin = inv.grandTotal > 0 ? (grossProfit / inv.grandTotal) * 100 : 0;
          return {
            ...inv,
            internalTotalCost: totalCost,
            internalGrossProfit: grossProfit,
            internalProfitMarginPercent: margin,
            internalFoodCostPercent: inv.grandTotal > 0 ? (actualCost / inv.grandTotal) * 100 : 0,
          };
        }
        return inv;
      });
      setInvoices(updatedInvoices);
      AppStorage.setInvoices(updatedInvoices);
    }

    const actionTitle = status === 'forwarded_to_accounts'
      ? 'Chef Forwarded Party Costing to Accounts'
      : 'Arun Kumar Approved Banquet Costing';
    const actionDesc = status === 'forwarded_to_accounts'
      ? `Chef Karim logged ${entries.length} items (${method === 'party_batch' ? 'General Party Batch' : 'Dish by Dish'}) and forwarded to Arun in Accounts.`
      : `Arun Kumar approved ${entries.length} items with direct purchasing food cost ${actualCost.toFixed(2)} AED for ${targetBooking?.bookingNumber || bookingId}.`;

    AppStorage.addAuditLog(actionTitle, actionDesc, 'Costing', currentUser);
    
    if (status === 'forwarded_to_accounts') {
      AppStorage.addNotification({
        title: 'Chef Quantities Forwarded to Accounts',
        message: `Executive Chef Karim finished ingredient entry for ${targetBooking?.clientName || 'Banquet'} (${targetBooking?.bookingNumber || bookingId}). Forwarded to Accounts for purchasing price costing.`,
        type: 'chef_finished',
        targetRoles: 'all',
        bookingId,
      });
    } else if (status === 'costed_by_arun') {
      AppStorage.addNotification({
        title: 'Accounts Costing Approved & Locked',
        message: `Accounts Executive Arun Kumar finalized purchase costing (${actualCost.toFixed(2)} AED) for ${targetBooking?.clientName || 'Banquet'} (${targetBooking?.bookingNumber || bookingId}). Record locked.`,
        type: 'accounts_costed',
        targetRoles: 'all',
        bookingId,
      });
    }

    setAuditLogs(AppStorage.getAuditLogs());
    setNotifications(AppStorage.getNotifications());
  };

  const handleSaveInvoice = (invoice: Invoice) => {
    const existingIdx = invoices.findIndex(i => i.id === invoice.id || i.bookingId === invoice.bookingId);
    let updatedInvoices: Invoice[];
    if (existingIdx >= 0) {
      updatedInvoices = [...invoices];
      updatedInvoices[existingIdx] = invoice;
    } else {
      updatedInvoices = [invoice, ...invoices];
    }
    setInvoices(updatedInvoices);
    AppStorage.setInvoices(updatedInvoices);

    AppStorage.addAuditLog(
      'Banquet Invoice Issued',
      `Invoice ${invoice.invoiceNumber} for ${invoice.clientName} (${invoice.grandTotal.toFixed(2)} AED) with ${invoice.internalProfitMarginPercent.toFixed(1)}% margin`,
      'Invoice',
      currentUser
    );
    setAuditLogs(AppStorage.getAuditLogs());
  };

  const handleUpdatePaymentStatus = (invoiceId: string, status: Invoice['status'], depositPaid: number) => {
    const updatedInvoices = invoices.map(i => {
      if (i.id === invoiceId) {
        const balanceDue = Math.max(0, i.grandTotal - depositPaid);
        return {
          ...i,
          status,
          depositPaid,
          balanceDue,
        };
      }
      return i;
    });
    setInvoices(updatedInvoices);
    AppStorage.setInvoices(updatedInvoices);

    const inv = invoices.find(i => i.id === invoiceId);
    if (inv) {
      const updatedBookings = bookings.map(b => {
        if (b.id === inv.bookingId) {
          const totalBill = b.totalBillPayable ?? getBookingPaymentSummary(b).totalBill;
          const remaining = Math.max(0, parseFloat((totalBill - depositPaid).toFixed(2)));
          return {
            ...b,
            depositPaid,
            balanceToPay: remaining,
            finalPaymentConfirmed: totalBill > 0 ? remaining <= 0.01 : Boolean(b.finalPaymentConfirmed),
          };
        }
        return b;
      });
      setBookings(updatedBookings);
      AppStorage.setBookings(updatedBookings);
    }

    AppStorage.addAuditLog(
      'Client Payment Recorded',
      `Invoice ${inv?.invoiceNumber} payment received. Total deposit paid: ${depositPaid.toFixed(2)} AED`,
      'Invoice',
      currentUser
    );
    setAuditLogs(AppStorage.getAuditLogs());
  };

  const handleNavigateToInvoice = (bookingId: string) => {
    setInvoiceTargetBookingId(bookingId);
    setActiveTab('invoices');
  };

  const handleSaveMarketingReport = (report: MetaAdMonthlyReport) => {
    AppStorage.saveMarketingReport(report);
    const updated = AppStorage.getMarketingReports();
    setMarketingReports(updated);
    AppStorage.addAuditLog(
      'Saved Meta Ads Monthly Report',
      `Saved Meta Ads metrics for ${report.monthLabel}: Spend AED ${report.adSpendAED.toLocaleString()}, Leads: ${report.leadsGenerated}, CPR: AED ${report.cprAED}`,
      'Costing',
      currentUser
    );
    setAuditLogs(AppStorage.getAuditLogs());
  };

  const handleSaveMarketingReportsBatch = (reportsToSave: MetaAdMonthlyReport[], metaSummary: string) => {
    reportsToSave.forEach(rep => {
      AppStorage.saveMarketingReport(rep);
    });
    const updated = AppStorage.getMarketingReports();
    setMarketingReports(updated);
    AppStorage.addAuditLog(
      'OCR Meta Ads Report Imported',
      metaSummary,
      'Costing',
      currentUser
    );
    setAuditLogs(AppStorage.getAuditLogs());
  };

  const handleRestoreMarketingReports = (snapshot: MetaAdMonthlyReport[]) => {
    AppStorage.setMarketingReports(snapshot);
    setMarketingReports(AppStorage.getMarketingReports());
    AppStorage.addAuditLog(
      'Reverted OCR Meta Ads Import',
      `Restored previous Meta Ads dataset (${snapshot.length} monthly records).`,
      'Costing',
      currentUser
    );
    setAuditLogs(AppStorage.getAuditLogs());
  };

  // Branch filter helper
  const branchBookings = selectedBranch === 'All' 
    ? bookings 
    : bookings.filter(b => b.branch === selectedBranch);

  return (
    <div className="min-h-screen bg-[#CFE5DC] text-[#192A24] font-['Plus_Jakarta_Sans'] p-2 sm:p-4 md:p-6 lg:p-7 flex items-stretch justify-center antialiased">
      {/* Outer Curved Container Inspired by the Uploaded Dashboard UI */}
      <div className="w-full max-w-[1680px] bg-white rounded-3xl sm:rounded-[36px] shadow-[0_25px_60px_-15px_rgba(20,50,38,0.18)] border border-[#C2D8CE] flex flex-col lg:flex-row overflow-hidden min-h-[92vh]">
        
        {/* Deep Pine Green Sidebar on the Left */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          allUsers={allUsers}
          onSwitchUser={handleSwitchUser}
          lastBackupTime={backups[0]?.timestamp}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          bookings={bookings}
        />

        {/* Main Application Canvas on the Right */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#F4F7F5] overflow-y-auto">
          
          {/* Top Bar: Branch Selector, Live Header & Quick Booking */}
          <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-[#E2ECE7] px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              {/* Mobile hamburger menu toggle */}
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-[#EBF3EF] text-[#236B50] hover:bg-[#DEEBE5] transition-colors"
                aria-label="Open navigation menu"
              >
                <MenuIcon className="w-5 h-5" />
              </button>

              {/* Hotel Venue Badge */}
              <div className="flex items-center space-x-2 bg-[#EBF3EF] px-3.5 py-1.5 rounded-2xl border border-[#D5E5DE]">
                <Building2 className="w-4 h-4 text-[#236B50]" />
                <span className="text-xs font-extrabold text-[#192A24]">Crystal Plaza Hotel</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#236B50] text-white">Sharjah, UAE</span>
              </div>

              {/* Active Role Indicator Badge */}
              <div className={`hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold ${
                currentUser.role === 'general_manager'
                  ? 'bg-emerald-50 text-[#236B50] border-emerald-200'
                  : currentUser.role === 'fnb_supervisor' || currentUser.role === 'banquet_manager'
                  ? 'bg-blue-50 text-blue-900 border-blue-200'
                  : currentUser.role === 'executive_chef'
                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                  : 'bg-purple-50 text-purple-900 border-purple-200'
              }`}>
                <span>
                  {currentUser.role === 'general_manager' && '👁️ GM (Executive Reports · Read Only)'}
                  {(currentUser.role === 'fnb_supervisor' || currentUser.role === 'banquet_manager') && '📅 Supervisor (Francis · Bookings & Ops)'}
                  {currentUser.role === 'executive_chef' && '👨‍🍳 Chef (Karim · Kitchen & Costing)'}
                  {currentUser.role === 'accounts_executive' && '💼 Accounts (Arun · Prices & Financials)'}
                  {currentUser.role === 'marketing_executive' && '📈 Marketing (Betselot · Leads & ROAS)'}
                </span>
              </div>
            </div>

            {/* Quick Actions & Status */}
            <div className="flex items-center space-x-3">
              <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#EBF3EF] border border-[#D5E5DE] text-[11px] font-semibold text-[#3D5A4E]">
                <Calendar className="w-3.5 h-3.5 text-[#236B50]" />
                <span>Today: {todayDisplayStr}</span>
              </div>

              {/* Real-time Notification Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2 rounded-full bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#236B50] transition-colors cursor-pointer"
                  title="Workflow Notifications"
                  aria-label="Workflow Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse shadow-xs">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown Popover */}
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-[#D5E5DE] p-4 z-50 space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-[#E2ECE7]">
                      <div className="flex items-center space-x-2">
                        <Bell className="w-4 h-4 text-[#236B50]" />
                        <h4 className="text-xs font-black uppercase text-[#192A24]">Role Workflow Alerts</h4>
                        {unreadCount > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                            {unreadCount} unread
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="text-[11px] font-bold text-[#236B50] hover:underline cursor-pointer"
                          >
                            Mark all read
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setNotificationsOpen(false)}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto space-y-2 divide-y divide-[#F2F7F5]">
                      {relevantNotifications.length === 0 ? (
                        <div className="text-center py-6 text-xs text-[#5A6F66]">
                          No recent workflow notifications.
                        </div>
                      ) : (
                        relevantNotifications.map((notif) => {
                          const targetBooking = notif.bookingId ? bookings.find(b => b.id === notif.bookingId) : null;
                          return (
                            <div 
                              key={notif.id} 
                              className={`pt-2.5 first:pt-0 space-y-1 p-2 rounded-2xl transition-colors ${
                                !notif.isRead ? 'bg-[#EBF5F0]/70' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-extrabold text-[#192A24] leading-tight">
                                  {notif.title}
                                </span>
                                <span className="text-[10px] text-[#5A6F66] shrink-0 font-medium">
                                  {notif.timestamp.substring(11, 16)}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#3D5A4E] leading-relaxed">
                                {notif.message}
                              </p>
                              {targetBooking && (
                                <div className="pt-1 flex items-center justify-between">
                                  <span className="text-[10px] font-mono font-semibold text-[#5A6F66]">
                                    {targetBooking.bookingNumber} • {targetBooking.eventDate}
                                  </span>
                                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                                    {/* Action button for Francis: Party Ended Confirmation Prompt */}
                                    {(currentUser.role === 'fnb_supervisor' || currentUser.role === 'banquet_manager') &&
                                     (notif.actionRequired === 'confirm_party_ended' || notif.type === 'party_ended_confirm_prompt' || (!targetBooking.partyEnded && targetBooking.eventDate <= todayStr)) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleConfirmPartyEnded(targetBooking.id);
                                          setNotificationsOpen(false);
                                        }}
                                        className="text-[10px] font-black text-white bg-amber-600 hover:bg-amber-700 px-2.5 py-0.5 rounded-md cursor-pointer transition-colors shadow-xs flex items-center space-x-1"
                                      >
                                        <span>✓ Confirm Party Ended</span>
                                      </button>
                                    )}

                                    {/* Action button for Chef: Kitchen quantities entry */}
                                    {currentUser.role === 'executive_chef' &&
                                     (notif.actionRequired === 'cost_party_chef' || notif.type === 'chef_action_required' || (targetBooking.partyEnded && !targetBooking.chefApproved)) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setChefUsageModalBooking(targetBooking);
                                          setNotificationsOpen(false);
                                        }}
                                        className="text-[10px] font-black text-amber-950 bg-amber-400 hover:bg-amber-500 px-2.5 py-0.5 rounded-md cursor-pointer transition-colors shadow-xs"
                                      >
                                        🍳 Enter Kitchen Usage
                                      </button>
                                    )}

                                    {/* Action button for Accounts: Costing entry */}
                                    {currentUser.role === 'accounts_executive' && 
                                     (targetBooking.costingStatus === 'forwarded_to_accounts' || (!targetBooking.arunCostedAt && targetBooking.chefApproved)) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setChefUsageModalBooking(targetBooking);
                                          setNotificationsOpen(false);
                                        }}
                                        className="text-[10px] font-extrabold text-purple-800 bg-purple-100 hover:bg-purple-200 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                                      >
                                        Cost Party Now
                                      </button>
                                    )}

                                    {/* Action button for Francis: Mandatory Balance Settlement (Direct Cash reception, no invoice needed) */}
                                    {(currentUser.role === 'fnb_supervisor' || currentUser.role === 'banquet_manager') &&
                                     (notif.actionRequired === 'settle_balance' || notif.type === 'mandatory_settle_balance') && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setQuickCashSettleBooking(targetBooking);
                                          setNotificationsOpen(false);
                                        }}
                                        className="text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-0.5 rounded-md cursor-pointer transition-colors shadow-xs flex items-center space-x-1"
                                      >
                                        <Banknote className="w-3 h-3 stroke-[2.2]" />
                                        <span>Settle by Cash (Must)</span>
                                      </button>
                                    )}

                                    {currentUser.role !== 'general_manager' && (() => {
                                      const isSettled = getBookingPaymentSummary(targetBooking).isBalanceSettled;
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            openA4Modal(targetBooking, isSettled ? undefined : 3);
                                            setNotificationsOpen(false);
                                          }}
                                          className="text-[10px] font-bold text-[#236B50] hover:underline cursor-pointer flex items-center space-x-1"
                                        >
                                          <span>{isSettled ? 'Open BEO' : 'Open FP Sheet'}</span>
                                        </button>
                                      );
                                    })()}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {(currentUser.role === 'fnb_supervisor' || currentUser.role === 'banquet_manager') && (
                <button
                  type="button"
                  onClick={handleOpenNewBookingModal}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white font-bold text-xs shadow-md shadow-[#236B50]/20 transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
                  <span>New Booking</span>
                </button>
              )}
            </div>
          </header>

          {/* Main Tab Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            {activeTab === 'dashboard' && (
              <Dashboard
                bookings={bookings}
                invoices={invoices}
                ingredients={ingredients}
                recipes={recipes}
                halls={halls}
                currentUser={currentUser}
                marketingReports={marketingReports}
                onNavigate={(tab, meta) => {
                  if (meta?.bookingId) {
                    if (tab === 'a4_sheet') {
                      const b = bookings.find(item => item.id === meta.bookingId);
                      if (b) openA4Modal(b);
                      return;
                    }
                    setInvoiceTargetBookingId(meta.bookingId);
                  }
                  setActiveTab(tab);
                }}
                onOpenBookingModal={handleOpenNewBookingModal}
                onOpenChefUsageModal={(b) => setChefUsageModalBooking(b)}
                onConfirmPartyEnded={handleConfirmPartyEnded}
                onSettleCashBalance={(b) => setQuickCashSettleBooking(b)}
                onToggleChecklistItem={handleToggleChecklistItem}
                onAddChecklistItem={handleAddChecklistItem}
              />
            )}

            {(activeTab === 'bookings' || activeTab === 'banquet_calendar') && (
              <BookingsManager
                bookings={bookings}
                halls={halls}
                packages={packages}
                recipes={recipes}
                currentUser={currentUser}
                initialSubTab={activeTab === 'banquet_calendar' ? 'availability' : undefined}
                onSaveBooking={handleSaveBooking}
                onUpdateBooking={handleUpdateBooking}
                onDeleteBooking={handleDeleteBooking}
                onOpenChefUsageModal={(b) => setChefUsageModalBooking(b)}
                onNavigateToInvoice={handleNavigateToInvoice}
                onOpenA4Sheet={(b, page) => openA4Modal(b, page)}
                bookingModalOpen={bookingModalOpen}
                setBookingModalOpen={setBookingModalOpen}
                createBookingTrigger={createBookingTrigger}
                onConsumeCreateTrigger={() => setCreateBookingTrigger(false)}
              />
            )}

            {activeTab === 'marketing' && (
              <MarketingManager
                key="marketing_kpi_roas"
                marketingReports={marketingReports}
                bookings={bookings}
                currentUser={currentUser}
                onSaveReport={handleSaveMarketingReport}
                onSaveReportsBatch={handleSaveMarketingReportsBatch}
                onRestoreReports={handleRestoreMarketingReports}
                onBookingCreated={() => {
                  setBookings(AppStorage.getBookings());
                  setNotifications(AppStorage.getNotifications());
                  setAuditLogs(AppStorage.getAuditLogs());
                }}
                defaultSubTab="kpi_roas"
              />
            )}

            {activeTab === 'marketing_kpi' && (
              <MarketingManager
                key="marketing_lead_pipeline"
                marketingReports={marketingReports}
                bookings={bookings}
                currentUser={currentUser}
                onSaveReport={handleSaveMarketingReport}
                onSaveReportsBatch={handleSaveMarketingReportsBatch}
                onRestoreReports={handleRestoreMarketingReports}
                onBookingCreated={() => {
                  setBookings(AppStorage.getBookings());
                  setNotifications(AppStorage.getNotifications());
                  setAuditLogs(AppStorage.getAuditLogs());
                }}
                defaultSubTab="lead_pipeline"
              />
            )}

            {activeTab === 'guest_retargeting' && (
              <MarketingManager
                key="marketing_guest_retargeting"
                marketingReports={marketingReports}
                bookings={bookings}
                currentUser={currentUser}
                onSaveReport={handleSaveMarketingReport}
                onSaveReportsBatch={handleSaveMarketingReportsBatch}
                onRestoreReports={handleRestoreMarketingReports}
                onBookingCreated={() => {
                  setBookings(AppStorage.getBookings());
                  setNotifications(AppStorage.getNotifications());
                  setAuditLogs(AppStorage.getAuditLogs());
                }}
                defaultSubTab="guest_retargeting"
              />
            )}

            {(activeTab === 'costing' || activeTab === 'costing_required') && (
              <FoodCostingCalculator
                recipes={recipes}
                ingredients={ingredients}
                bookings={bookings}
                currentUser={currentUser}
                allUsers={allUsers}
                initialSubTab={activeTab === 'costing_required' ? 'costing_required' : undefined}
                onSaveRecipe={handleSaveRecipe}
                onSaveChefUsage={handleSaveChefUsage}
                onSavePartyCosting={handleSavePartyCosting}
                onOpenA4Sheet={(b, page) => openA4Modal(b, page)}
              />
            )}


            {activeTab === 'invoices' && (
              <InvoiceGenerator
                invoices={invoices}
                bookings={bookings}
                packages={packages}
                recipes={recipes}
                currentUser={currentUser}
                initialSelectedBookingId={invoiceTargetBookingId}
                onSaveInvoice={handleSaveInvoice}
                onUpdatePaymentStatus={handleUpdatePaymentStatus}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsAnalytics
                bookings={bookings}
                invoices={invoices}
                halls={halls}
                currentUser={currentUser}
                marketingReports={marketingReports}
                onSaveMarketingReport={handleSaveMarketingReport}
                onSaveMarketingReportsBatch={handleSaveMarketingReportsBatch}
                onRestoreMarketingReports={handleRestoreMarketingReports}
              />
            )}

            {activeTab === 'ai_analysis' && (
              <AiAnalysisPanel
                bookings={bookings}
                invoices={invoices}
                ingredients={ingredients}
                recipes={recipes}
                halls={halls}
                marketingReports={marketingReports}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'backups' && (
              <BackupSecurity
                backups={backups}
                auditLogs={auditLogs}
                allUsers={allUsers}
                currentUser={currentUser}
                bookings={bookings}
                onRefreshState={refreshAllState}
              />
            )}
          </main>
        </div>
      </div>

      {/* Official 2-Page A4 BEO Sheet Modal */}
      {a4ModalBooking && (
        <BanquetPartyA4Sheet
          booking={a4ModalBooking}
          packages={packages}
          recipes={recipes}
          ingredients={ingredients}
          currentUser={currentUser}
          initialPage={a4InitialPage}
          onClose={() => {
            setA4ModalBooking(null);
            setA4InitialPage(undefined);
          }}
          onOpenChefUsageModal={(b) => setChefUsageModalBooking(b)}
          onUpdateBooking={(b) => {
            handleUpdateBooking(b);
            setA4ModalBooking(b);
          }}
        />
      )}

      {/* Standalone Chef & Accounts Costing Modal */}
      {chefUsageModalBooking && (
        <ChefUsageModal
          booking={chefUsageModalBooking}
          recipes={recipes}
          ingredients={ingredients}
          currentUser={currentUser}
          allUsers={allUsers}
          onClose={() => setChefUsageModalBooking(null)}
          onSave={handleSaveChefUsage}
          onSaveCosting={handleSavePartyCosting}
          onOpenA4Sheet={(b) => openA4Modal(b)}
        />
      )}

      {/* Quick Cash Balance Settlement Modal for Francis */}
      {quickCashSettleBooking && (
        <QuickCashSettlementModal
          isOpen={!!quickCashSettleBooking}
          booking={quickCashSettleBooking}
          currentUser={currentUser}
          onClose={() => setQuickCashSettleBooking(null)}
          onSettled={handleCashBalanceSettled}
        />
      )}
    </div>
  );
}
