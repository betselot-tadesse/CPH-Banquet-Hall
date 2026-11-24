import React, { useState, useEffect } from 'react';
import { 
  CalendarDays, 
  Plus, 
  Search, 
  Building, 
  Users, 
  TrendingUp, 
  ChefHat, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  X,
  Printer,
  Edit,
  Trash2,
  Sparkles,
  Tag,
  ShieldAlert,
  Info,
  CreditCard,
  Bell,
  Receipt,
  DollarSign,
  Clock,
  ArrowRight,
  Calculator,
  Lock,
  UtensilsCrossed,
  Check,
  RotateCcw,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Ban
} from 'lucide-react';
import { 
  BookingEvent, 
  BanquetHall, 
  BanquetPackage, 
  RecipeMenuItem, 
  UserProfile, 
  TimeSlot, 
  HotelBranch, 
  HallOfferType, 
  HallSection,
  PaymentRecord
} from '../types';
import { BANQUET_MENUS, getBanquetMenuById, getDefaultMenu } from '../data/banquetMenus';
import { calculateEventFinancials, getBookingPaymentSummary, getFunctionProspectusFinancials, formatCurrency, formatPercent } from '../utils/costCalculations';
import { AdvanceBookingConfirmationModal } from './AdvanceBookingConfirmationModal';
import { PartyDatePaymentSettlementModal } from './PartyDatePaymentSettlementModal';
import { PostingReportModal } from './PostingReportModal';

interface BookingsManagerProps {
  initialSubTab?: 'scheduled' | 'availability' | 'costed' | 'cancelled';
  bookings: BookingEvent[];
  halls: BanquetHall[];
  packages: BanquetPackage[];
  recipes: RecipeMenuItem[];
  currentUser: UserProfile;
  onSaveBooking: (booking: BookingEvent) => void;
  onUpdateBooking: (booking: BookingEvent) => void;
  onDeleteBooking: (bookingId: string) => void;
  onOpenChefUsageModal: (booking: BookingEvent) => void;
  onNavigateToInvoice: (bookingId: string) => void;
  onOpenA4Sheet: (booking: BookingEvent, initialPage?: 1 | 2 | 3) => void;
  bookingModalOpen: boolean;
  setBookingModalOpen: (open: boolean) => void;
  createBookingTrigger?: boolean;
  onConsumeCreateTrigger?: () => void;
}

export const BookingsManager: React.FC<BookingsManagerProps> = ({
  bookings,
  initialSubTab,
  halls,
  packages,
  recipes,
  currentUser,
  onSaveBooking,
  onUpdateBooking,
  onDeleteBooking,
  onOpenChefUsageModal,
  onNavigateToInvoice,
  onOpenA4Sheet,
  bookingModalOpen,
  setBookingModalOpen,
  createBookingTrigger,
  onConsumeCreateTrigger,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hallFilter, setHallFilter] = useState<'All' | 'First Floor Big Hall' | 'Suite Room Hall'>('All');
  const [hallFilterError, setHallFilterError] = useState<string | null>(null);
  const [formValidationErrors, setFormValidationErrors] = useState<string[]>([]);

  const handleHallFilterChange = (nextValue: string) => {
    const validFilters = ['All', 'First Floor Big Hall', 'Suite Room Hall'] as const;
    if ((validFilters as readonly string[]).includes(nextValue)) {
      setHallFilter(nextValue as 'All' | 'First Floor Big Hall' | 'Suite Room Hall');
      setHallFilterError(null);
    } else {
      setHallFilter('All');
      setHallFilterError(`Invalid hall filter "${nextValue}". Reset to All halls.`);
    }
  };

  const matchesHallFilter = (b: BookingEvent): boolean => {
    if (hallFilter === 'All') return true;
    const normalizedName = (b.hallName || '').trim().toLowerCase();
    const normalizedFloor = (b.venueFloor || '').trim().toLowerCase();
    if (hallFilter === 'First Floor Big Hall') {
      return (
        b.hallId === 'hall_first_floor_big' ||
        normalizedName === 'first floor big hall' ||
        normalizedFloor === 'first floor big hall'
      );
    }
    return (
      b.hallId === 'hall_suite_room' ||
      normalizedName === 'suite room hall' ||
      normalizedFloor === 'suite room hall'
    );
  };

  // Primary Tabs: Scheduled Banquets, Date Availability & Booking Schedule, Completed & Costed, Cancelled Parties Log
  const [mainTab, setMainTab] = useState<'scheduled' | 'availability' | 'costed' | 'cancelled'>(initialSubTab || 'scheduled');

  useEffect(() => {
    if (initialSubTab) {
      setMainTab(initialSubTab);
    }
  }, [initialSubTab]);
  
  // Popular Global Sorting: Default: "Event Date: Ending / Happening Soonest First" ("the parties who ends first should come first")
  const [sortBy, setSortBy] = useState<string>('event_date_soonest');
  
  // Touch/Click to view full party details modal from Date Availability
  const [selectedPartyForDetails, setSelectedPartyForDetails] = useState<BookingEvent | null>(null);

  // Cancellation Reason & Policy Modal state
  const [cancelModalBooking, setCancelModalBooking] = useState<BookingEvent | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Client Requested Date Rescheduling');
  const [cancelNotes, setCancelNotes] = useState<string>('');
  const [cancelAdvanceAction, setCancelAdvanceAction] = useState<'refunded' | 'partly_refunded' | 'forfeited'>('forfeited');
  const [cancelRefundAmount, setCancelRefundAmount] = useState<number>(0);
  const [cancelRefundMode, setCancelRefundMode] = useState<'Cash' | 'Card' | 'Bank Transfer'>('Cash');

  // Payment Tracking Modal state
  const [paymentModalBooking, setPaymentModalBooking] = useState<BookingEvent | null>(null);
  const [newPaymentAmount, setNewPaymentAmount] = useState<string>('');
  const [newPaymentMode, setNewPaymentMode] = useState<'Cash' | 'Card' | 'Bank Transfer' | 'Cheque' | 'Online'>('Cash');
  const [newPaymentType, setNewPaymentType] = useState<'advance' | 'balance' | 'additional'>('advance');
  const [newPaymentNotes, setNewPaymentNotes] = useState<string>('');

  // Lock & Unlock Request state
  const [unlockModalBooking, setUnlockModalBooking] = useState<BookingEvent | null>(null);
  const [unlockReason, setUnlockReason] = useState<string>('');

  // Tentative Hold Form Option
  const [formIsTentative, setFormIsTentative] = useState<boolean>(false);
  const [formHoldHours, setFormHoldHours] = useState<number>(48);

  // Date Availability Calendar month navigation
  const [availabilityMonth, setAvailabilityMonth] = useState<string>(() => new Date().toISOString().substring(0, 7)); // YYYY-MM
  
  // Edit & Delete state
  const [editingBooking, setEditingBooking] = useState<BookingEvent | null>(null);
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(null);

  // Advance Voucher & Party Date Settlement Modals for Francis
  const [selectedAdvanceVoucherBooking, setSelectedAdvanceVoucherBooking] = useState<BookingEvent | null>(null);
  const [settleModalBooking, setSettleModalBooking] = useState<BookingEvent | null>(null);
  const [selectedPostingReportBooking, setSelectedPostingReportBooking] = useState<BookingEvent | null>(null);

  // Form State
  const [formBranch, setFormBranch] = useState<HotelBranch>('CPH1');
  const [formClientName, setFormClientName] = useState('');
  const [formClientPhone, setFormClientPhone] = useState('');
  const [formClientEmail, setFormClientEmail] = useState(''); // Optional!
  const [formClientCompany, setFormClientCompany] = useState('');
  const [formLeadSource, setFormLeadSource] = useState<string>('Instagram Ad Campaign');
  
  const [formHallId, setFormHallId] = useState(halls[0]?.id || '');
  const [formHallOffer, setFormHallOffer] = useState<HallOfferType>('free_with_food');
  const [formHallSection, setFormHallSection] = useState<HallSection>('Full Banquet Hall');
  
  // Operational Setup & Function Prospectus Fields (Entered strictly by Francis — no sample defaults)
  const [formEventTimeSpan, setFormEventTimeSpan] = useState('');
  const [formFoodPickupTime, setFormFoodPickupTime] = useState('');
  const [formVenueFloor, setFormVenueFloor] = useState('');
  const [formSoundSystem, setFormSoundSystem] = useState<'Yes' | 'No' | ''>('');
  const [formProjector, setFormProjector] = useState<'Yes' | 'No' | ''>('');
  const [formProjectorNotes, setFormProjectorNotes] = useState('');
  const [formDecorations, setFormDecorations] = useState<'Yes' | 'No' | ''>('');
  const [formDecorationsPrice, setFormDecorationsPrice] = useState<number>(0);
  const [formTableClothColor, setFormTableClothColor] = useState('');
  const [formSeatingStyle, setFormSeatingStyle] = useState('');
  const [formStagePosition, setFormStagePosition] = useState<'Left side' | 'Right side' | 'Center' | ''>('');
  const [formBuffetPosition, setFormBuffetPosition] = useState<'Right side' | 'Left side' | 'Center' | ''>('');
  const [formAdultsCount, setFormAdultsCount] = useState<string>('');
  const [formKidsCount, setFormKidsCount] = useState<string>('');
  const [formAdvancePaymentMode, setFormAdvancePaymentMode] = useState<'Cash' | 'Card' | 'Bank Transfer' | 'Cheque' | 'Online'>('Cash');
  const [formPaymentTermsNotice, setFormPaymentTermsNotice] = useState('');
  const [formComplementaryItems, setFormComplementaryItems] = useState('');

  const [formBookingDate, setFormBookingDate] = useState(() => new Date().toISOString().substring(0, 10)); // Date registered
  const [formEventDate, setFormEventDate] = useState('');     // Party celebration date
  const [formTimeSlot, setFormTimeSlot] = useState<TimeSlot>('evening');
  const [formEventType, setFormEventType] = useState('');
  const [formGuestCount, setFormGuestCount] = useState<number>(30);
  
  const [formPackageId, setFormPackageId] = useState<string>(packages[0]?.id || '');
  const [formMenuId, setFormMenuId] = useState<string>(BANQUET_MENUS[0].id);
  const [formSelectedFoodItems, setFormSelectedFoodItems] = useState<string[]>([]);
  const [customDishInput, setCustomDishInput] = useState<string>('');
  const [formFoodPriceCharged, setFormFoodPriceCharged] = useState<number>(BANQUET_MENUS[0].pricePerPerson);
  const [formDiscount, setFormDiscount] = useState<number>(0);
  const [formDeposit, setFormDeposit] = useState<number>(0);
  const [formDecorAVCharged, setFormDecorAVCharged] = useState<number>(0);
  const [formChefNotes, setFormChefNotes] = useState('');
  const [formSpecialRequests, setFormSpecialRequests] = useState('');

  // Settle balance on party arrival - Francis must settle before party ends
  const handleSettlePayment = (
    bookingId: string, 
    newTotalAmount: number, 
    newDepositPaid: number, 
    paymentMethod: string, 
    notes: string,
    markPartyEnded?: boolean
  ) => {
    const target = bookings.find(b => b.id === bookingId);
    if (!target) return;

    const currentSummary = getBookingPaymentSummary(target);
    const totalDelta = parseFloat((newTotalAmount - currentSummary.totalBill).toFixed(2));
    const updatedExtraCharges = totalDelta > 0
      ? parseFloat(((target.extraCharges || 0) + totalDelta).toFixed(2))
      : (target.extraCharges || 0);
    const updatedDiscount = totalDelta < 0
      ? parseFloat(((target.discountAmount || 0) + Math.abs(totalDelta)).toFixed(2))
      : (target.discountAmount || 0);

    const paymentDelta = parseFloat((newDepositPaid - currentSummary.totalPaid).toFixed(2));
    const normalizedMode: PaymentRecord['paymentMode'] = paymentMethod.toLowerCase().includes('card')
      ? 'Card'
      : paymentMethod.toLowerCase().includes('bank')
      ? 'Bank Transfer'
      : paymentMethod.toLowerCase().includes('online')
      ? 'Online'
      : 'Cash';

    const existingPayments = target.payments ? [...target.payments] : (
      currentSummary.totalPaid > 0 ? [{
        id: `pay_init_${target.id}`,
        bookingId: target.id,
        date: target.bookingDate || new Date().toISOString().substring(0, 10),
        amount: currentSummary.totalPaid,
        paymentType: 'advance' as const,
        paymentMode: (target.advancePaymentMode as PaymentRecord['paymentMode']) || 'Cash',
        receiptNumber: `CPH-RCP-${target.bookingNumber.replace(/[^0-9]/g, '')}-01`,
        receivedBy: target.fnbRepresentative || currentUser.name,
        notes: 'Initial advance recorded',
        createdAt: target.createdAt || new Date().toISOString(),
      }] : []
    );

    if (paymentDelta > 0.01) {
      existingPayments.push({
        id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        bookingId: target.id,
        date: new Date().toISOString().substring(0, 10),
        amount: paymentDelta,
        paymentType: 'balance',
        paymentMode: normalizedMode,
        receiptNumber: `CPH-RCP-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
        receivedBy: currentUser.name,
        notes: notes || 'Balance settlement',
        createdAt: new Date().toISOString(),
      });
    }

    const finalPaid = existingPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const isFull = newTotalAmount > 0 ? finalPaid >= newTotalAmount - 0.01 : true;
    const shouldEndParty = Boolean(markPartyEnded && isFull);
    const preFp = getFunctionProspectusFinancials(target);

    const updated: BookingEvent = {
      ...target,
      fpPrePartyTotalBill: target.fpPrePartyTotalBill ?? preFp.fpTotalBill,
      fpPrePartyAdvancePaid: target.fpPrePartyAdvancePaid ?? preFp.fpAdvancePaid,
      fpPrePartyAdvanceMode: target.fpPrePartyAdvanceMode ?? (preFp.fpAdvanceMode || undefined),
      extraCharges: updatedExtraCharges,
      discountAmount: updatedDiscount,
      payments: existingPayments,
      depositPaid: parseFloat(finalPaid.toFixed(2)),
      totalBillPayable: parseFloat(newTotalAmount.toFixed(2)),
      balanceToPay: Math.max(0, parseFloat((newTotalAmount - finalPaid).toFixed(2))),
      finalPaymentConfirmed: isFull,
      finalSettledAt: isFull ? new Date().toISOString() : target.finalSettledAt,
      status: shouldEndParty ? 'completed' : target.status,
      partyEnded: shouldEndParty ? true : target.partyEnded,
      partyEndedAt: shouldEndParty ? new Date().toISOString() : target.partyEndedAt,
      partyEndedConfirmedBy: shouldEndParty ? currentUser.name : target.partyEndedConfirmedBy,
      costingStatus: (shouldEndParty && target.hasFoodFromHotel) 
        ? 'party_ended_pending_chef' 
        : target.costingStatus,
      specialRequests: notes 
        ? `${target.specialRequests ? target.specialRequests + ' | ' : ''}[Settled by ${currentUser.name}: ${paymentMethod} (${newDepositPaid.toFixed(2)} AED) - ${notes}]` 
        : target.specialRequests,
    };
    onUpdateBooking(updated);
  };

  // Handle Hall Offer change
  const handleOfferChange = (offer: HallOfferType) => {
    setFormHallOffer(offer);
    if (offer === 'free_with_food') {
      setFormHallSection('Full Banquet Hall');
      setFormFoodPriceCharged(60);
    } else if (offer === 'one_side_hall') {
      setFormHallSection('Left Side (One-Side Partition)');
      setFormFoodPriceCharged(0);
    } else {
      setFormHallSection('Full Banquet Hall');
      setFormFoodPriceCharged(0);
    }
  };

  // Open Edit Form
  const openEditModal = (b: BookingEvent) => {
    setFormValidationErrors([]);
    setEditingBooking(b);
    setFormBranch(b.branch);
    setFormClientName(b.clientName);
    setFormClientPhone(b.clientPhone);
    setFormClientEmail(b.clientEmail || '');
    setFormClientCompany(b.clientCompany || '');
    setFormLeadSource(b.leadSource || 'Instagram Ad Campaign');
    const matchedHall =
      halls.find(h => h.id === b.hallId) ||
      halls.find(h => h.name.toLowerCase() === (b.hallName || '').toLowerCase()) ||
      ((b.hallName || b.venueFloor || '').toLowerCase().includes('suite')
        ? halls.find(h => h.id === 'hall_suite_room')
        : halls[0]);
    setFormHallId(matchedHall?.id || halls[0]?.id || '');
    setFormHallOffer(b.hallOffer || 'free_with_food');
    setFormHallSection(b.hallSection || 'Full Banquet Hall');

    // Load exact Operational Setup & Function Prospectus fields logged on booking
    setFormEventTimeSpan(b.eventTimeSpan || '');
    setFormFoodPickupTime(b.foodPickupTime || '');
    setFormVenueFloor(b.venueFloor || b.hallName || matchedHall?.name || '');
    setFormSoundSystem(
      b.soundSystem === true || String(b.soundSystem).toLowerCase() === 'yes'
        ? 'Yes'
        : b.soundSystem === false || String(b.soundSystem).toLowerCase() === 'no'
        ? 'No'
        : ''
    );
    setFormProjector(
      b.projector === true || String(b.projector).toLowerCase() === 'yes'
        ? 'Yes'
        : b.projector === false || String(b.projector).toLowerCase() === 'no'
        ? 'No'
        : ''
    );
    setFormProjectorNotes(b.projectorNotes || '');
    const isDecorYes = b.decorations === 'Yes' || b.decorations === true || (b.decorAndAVCharged && b.decorAndAVCharged > 0);
    const isDecorNo = b.decorations === 'No' || b.decorations === false;
    setFormDecorations(isDecorYes ? 'Yes' : isDecorNo ? 'No' : '');
    setFormDecorationsPrice(b.decorAndAVCharged || 0);
    setFormTableClothColor(b.tableClothColor || '');
    setFormSeatingStyle(b.seatingStyle || '');
    setFormStagePosition(
      b.stagePosition === 'Right side' ? 'Right side' : 
      b.stagePosition === 'Center' ? 'Center' : 
      b.stagePosition === 'Left side' ? 'Left side' : ''
    );
    setFormBuffetPosition(
      b.buffetPosition === 'Left side' ? 'Left side' : 
      b.buffetPosition === 'Center' ? 'Center' : 
      b.buffetPosition === 'Right side' ? 'Right side' : ''
    );
    setFormAdultsCount(b.adultsCount !== undefined ? String(b.adultsCount) : '');
    setFormKidsCount(b.kidsCount !== undefined ? String(b.kidsCount) : '');
    setFormAdvancePaymentMode((b.advancePaymentMode as any) || (b.payments?.[0]?.paymentMode as any) || 'Cash');
    setFormPaymentTermsNotice(b.paymentTermsNotice || '');
    setFormComplementaryItems((b.prospectusMenu?.complementary || []).join(', '));

    setFormBookingDate(b.bookingDate || (b.createdAt ? b.createdAt.substring(0, 10) : new Date().toISOString().substring(0, 10)));
    setFormEventDate(b.eventDate || '');
    setFormTimeSlot(b.timeSlot);
    setFormEventType(b.eventType || '');
    setFormGuestCount(b.guestCount);
    setFormPackageId(b.packageId || packages[0]?.id || '');

    // Registered Menu A-L setup (keep ONLY food items actually stored on booking)
    const matchedMenu = b.selectedMenuId 
      ? getBanquetMenuById(b.selectedMenuId) 
      : BANQUET_MENUS.find(m => b.selectedMenuName?.includes(m.code)) || BANQUET_MENUS[0];
    
    setFormMenuId(matchedMenu ? matchedMenu.id : BANQUET_MENUS[0].id);
    setFormSelectedFoodItems(b.selectedFoodItems ? [...b.selectedFoodItems] : []);
    setCustomDishInput('');

    const summary = getBookingPaymentSummary(b);
    setFormFoodPriceCharged(b.foodPricePerGuestCharged || 0);
    setFormDiscount(b.discountAmount || 0);
    setFormDeposit(summary.totalPaid);
    setFormDecorAVCharged(b.decorAndAVCharged || 0);
    setFormChefNotes(b.chefNotes || '');
    setFormSpecialRequests(b.specialRequests || '');
    setBookingModalOpen(true);
  };

  // Open Create Form (Clean blank state — zero sample data)
  const openCreateModal = () => {
    setFormValidationErrors([]);
    setEditingBooking(null);
    setFormBranch('CPH1');
    setFormClientName('');
    setFormClientPhone('');
    setFormClientEmail('');
    setFormClientCompany('');
    setFormLeadSource('Instagram Ad Campaign');
    setFormHallId(halls[0]?.id || '');
    setFormHallOffer('free_with_food');
    setFormHallSection('Full Banquet Hall');

    // Clean Function Prospectus fields (Entered strictly by Francis)
    setFormEventTimeSpan('');
    setFormFoodPickupTime('');
    setFormVenueFloor(halls[0]?.name || 'First Floor Big Hall');
    setFormSoundSystem('');
    setFormProjector('');
    setFormProjectorNotes('');
    setFormDecorations('');
    setFormDecorationsPrice(0);
    setFormTableClothColor('');
    setFormSeatingStyle('');
    setFormStagePosition('');
    setFormBuffetPosition('');
    setFormAdultsCount('');
    setFormKidsCount('');
    setFormAdvancePaymentMode('Cash');
    setFormPaymentTermsNotice('');
    setFormComplementaryItems('');

    setFormBookingDate(new Date().toISOString().substring(0, 10));
    setFormEventDate('');
    setFormTimeSlot('evening');
    setFormEventType('');
    setFormGuestCount(30);
    setFormPackageId(packages[0]?.id || '');

    // Default to Menu A pricing, with empty dish selection until Francis selects guest choices
    const defMenu = BANQUET_MENUS[0];
    setFormMenuId(defMenu.id);
    setFormSelectedFoodItems([]);
    setCustomDishInput('');
    setFormFoodPriceCharged(defMenu.pricePerPerson);

    setFormDiscount(0);
    setFormDeposit(0);
    setFormDecorAVCharged(0);
    setFormChefNotes('');
    setFormSpecialRequests('');
    setBookingModalOpen(true);
  };

  useEffect(() => {
    if (createBookingTrigger) {
      openCreateModal();
      onConsumeCreateTrigger?.();
    }
  }, [createBookingTrigger]);

  // Menu Selection & Food Item Handlers for Francis
  const handleMenuSelect = (menuId: string) => {
    setFormMenuId(menuId);
    const menu = getBanquetMenuById(menuId);
    if (menu) {
      setFormFoodPriceCharged(menu.pricePerPerson);
      // Keep only items that exist in the newly selected menu or were custom-added; never inject defaults unasked
      setFormSelectedFoodItems(prev => prev.filter(item => menu.allOptions.includes(item)));
    }
  };

  const handleToggleFoodItem = (dishName: string) => {
    setFormSelectedFoodItems(prev => {
      if (prev.includes(dishName)) {
        return prev.filter(item => item !== dishName);
      } else {
        return [...prev, dishName];
      }
    });
  };

  const handleSelectLineOption = (lineOptions: string[], dishName: string) => {
    setFormSelectedFoodItems(prev => {
      // Remove any previously selected option from this specific line, then add this dish
      const filtered = prev.filter(item => !lineOptions.includes(item));
      return [...filtered, dishName];
    });
  };

  const handleAddCustomDish = () => {
    const trimmed = customDishInput.trim();
    if (trimmed && !formSelectedFoodItems.includes(trimmed)) {
      setFormSelectedFoodItems(prev => [...prev, trimmed]);
      setCustomDishInput('');
    }
  };

  const handleResetMenuToDefault = () => {
    const menu = getBanquetMenuById(formMenuId) || BANQUET_MENUS[0];
    setFormSelectedFoodItems([...menu.defaultSelected]);
  };

  const handleClearAllDishes = () => {
    setFormSelectedFoodItems([]);
  };

  // Real-time calculations for modal
  const selectedHall = halls.find(h => h.id === formHallId) || halls[0];
  const selectedPkg = packages.find(p => p.id === formPackageId) || packages[0];
  
  // Calculate hall charge based on offer
  let calculatedHallCharged = 0;
  if (formHallOffer === 'free_with_food') {
    calculatedHallCharged = 0; // FREE OFFER!
  } else if (formHallOffer === 'one_side_hall') {
    calculatedHallCharged = 1000; // 1,000 AED One-Side offer
  } else {
    calculatedHallCharged = 1500; // 1,500 AED Full Hall without food
  }

  const isFoodIncluded = formHallOffer === 'free_with_food';
  const foodRev = isFoodIncluded ? formFoodPriceCharged * formGuestCount : 0;
  const foodCost = isFoodIncluded ? (selectedPkg?.costPerGuest || 0) * formGuestCount : 0;
  const hallDirectCost = selectedHall?.cleaningFee || 0;
  const staffCost = isFoodIncluded ? 180 : 100;
  const effectiveDecorCharged = formDecorations === 'Yes' ? formDecorationsPrice : 0;
  const decorCost = effectiveDecorCharged * 0.25;
  const existingBev = editingBooking?.beveragePriceCharged || 0;
  const existingExtras = editingBooking?.extraCharges || 0;

  const subtotalRev = Math.max(0, calculatedHallCharged + foodRev + existingBev + effectiveDecorCharged + existingExtras - formDiscount);
  const totalDirectCosts = hallDirectCost + foodCost + staffCost + decorCost;
  const grossProfit = subtotalRev - totalDirectCosts;
  const marginPercent = subtotalRev > 0 ? (grossProfit / subtotalRev) * 100 : 0;

  // Rule validations
  const isMinGuestsValid = formGuestCount >= 30;
  const isMaxHallCapacityValid = !selectedHall || formGuestCount <= selectedHall.capacityMax;
  const parsedAdultsPreview = formAdultsCount.trim() !== '' ? parseInt(formAdultsCount, 10) : 0;
  const parsedKidsPreview = formKidsCount.trim() !== '' ? parseInt(formKidsCount, 10) : 0;
  const isGuestSplitValid =
    (formAdultsCount.trim() === '' || parsedAdultsPreview >= 0) &&
    (formKidsCount.trim() === '' || parsedKidsPreview >= 0) &&
    parsedAdultsPreview + parsedKidsPreview <= formGuestCount;
  const minimumAllowedFloor = Math.max(1500, formGuestCount * 50);
  const isFloorDiscountValid = !isFoodIncluded || subtotalRev >= minimumAllowedFloor;

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];

    // 1. Role Permission Check: GM and Chef cannot create or edit
    if (currentUser.role === 'general_manager') {
      errors.push('Permission Denied: General Manager has View-Only access and cannot create or edit banquet bookings.');
    }
    if (currentUser.role === 'executive_chef') {
      errors.push('Permission Denied: Executive Chef cannot create or edit banquet bookings.');
    }

    // 2. Check if editing a locked record
    if (editingBooking && editingBooking.lockDetails?.isLocked && !editingBooking.lockDetails?.unlockApprovedAt) {
      errors.push(`Record Locked: This banquet record was locked after ${editingBooking.lockDetails.lockStage === 'chef_finished' ? 'Chef finalized quantities' : 'Accounts finalized costing'}. Any later change requires General Manager approval.`);
    }

    // 3. Hall Selection Validation (must be one of the 2 configured halls)
    const activeHall = halls.find(h => h.id === formHallId);
    if (!activeHall) {
      errors.push('Please select a valid Banquet Hall (First Floor Big Hall or Suite room Hall).');
    }

    // 4. Client Contact & Schedule Validations
    if (formClientName.trim().length < 2) {
      errors.push('Client Full Name must be at least 2 characters.');
    }
    const phoneDigits = formClientPhone.replace(/[^0-9]/g, '');
    if (phoneDigits.length < 7) {
      errors.push('Please enter a valid Client Phone number (at least 7 digits).');
    }
    if (formClientEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formClientEmail.trim())) {
      errors.push('Please enter a valid Client Email address or leave the optional email blank.');
    }
    if (!formBookingDate || !/^\d{4}-\d{2}-\d{2}$/.test(formBookingDate)) {
      errors.push('Please select a valid Booking Registration Date.');
    }
    if (!formEventDate || !/^\d{4}-\d{2}-\d{2}$/.test(formEventDate)) {
      errors.push('Please select a valid Party / Celebration Date.');
    }
    if (!formEventType.trim()) {
      errors.push('Please enter the Function Type (e.g., Birthday Party, Wedding Reception).');
    }

    // 5. Guest Count & Hall Capacity Validations
    if (!Number.isFinite(formGuestCount) || formGuestCount < 1) {
      errors.push('Total Guest Count must be at least 1.');
    } else if (activeHall && formGuestCount > activeHall.capacityMax) {
      errors.push(
        `Capacity Exceeded: "${activeHall.name}" accommodates up to ${activeHall.capacityMax} guests (entered ${formGuestCount}). Please switch to "First Floor Big Hall" or reduce guest count.`
      );
    }
    if (!isGuestSplitValid) {
      errors.push('Adults + Kids breakdown cannot contain negative values or exceed Total Guest Count.');
    }

    // 6. Financial & Advance Deposit Validations
    if (isFoodIncluded && (!Number.isFinite(formFoodPriceCharged) || formFoodPriceCharged <= 0)) {
      errors.push('Please enter a valid positive Food Price Per Guest for "Free Hall with Food" bookings.');
    }
    if (formDiscount < 0) {
      errors.push('Discount amount cannot be negative.');
    }
    const grossBeforeDiscount = calculatedHallCharged + foodRev + existingBev + effectiveDecorCharged + existingExtras;
    if (formDiscount > grossBeforeDiscount) {
      errors.push(`Discount (${formatCurrency(formDiscount)}) cannot exceed gross charges (${formatCurrency(grossBeforeDiscount)}).`);
    }
    if (formDeposit < 0) {
      errors.push('Advance Paid cannot be negative.');
    } else if (subtotalRev > 0 && formDeposit > subtotalRev + 0.01) {
      errors.push(`Advance Paid (${formatCurrency(formDeposit)}) cannot exceed Total Bill (${formatCurrency(subtotalRev)}).`);
    }

    // 7. Booking Rule: One party per date. If a date is booked, reject new bookings with a clear message.
    const dateConflict = formEventDate
      ? bookings.find(b =>
          b.status !== 'cancelled' &&
          b.eventDate === formEventDate &&
          (!editingBooking || b.id !== editingBooking.id)
        )
      : undefined;
    if (dateConflict) {
      errors.push(`Date Conflict: ${formEventDate} is already booked for "${dateConflict.clientName}" (${dateConflict.bookingNumber} • ${dateConflict.hallName}). Only one party per date is permitted.`);
    }

    if (errors.length > 0) {
      setFormValidationErrors(errors);
      return;
    }
    setFormValidationErrors([]);

    const selectedMenuObj = getBanquetMenuById(formMenuId) || BANQUET_MENUS[0];

    // Organize ONLY the dishes explicitly chosen by Francis into Function Prospectus sections (zero fake fallback items)
    const salads: string[] = [];
    const starters: string[] = [];
    const vegMainCourse: string[] = [];
    const nonVegMainCourse: string[] = [];
    const desserts: string[] = [];

    const nonVegRegex = /chicken|lamb|mutton|beef|fish|prawn|shrimp|adobo|calderetta|non veg|biryani \(non veg\)|meat/i;
    const saladOptions = new Set(
      selectedMenuObj.categories.filter(c => /salad/i.test(c.categoryName)).flatMap(c => c.options || [])
    );
    const starterSoupOptions = new Set(
      selectedMenuObj.categories.filter(c => /soup|starter/i.test(c.categoryName)).flatMap(c => [
        ...(c.options || []),
        ...(c.lines ? c.lines.flatMap(l => l.options) : []),
      ])
    );
    const dessertOptions = new Set(
      selectedMenuObj.categories.filter(c => /dessert/i.test(c.categoryName)).flatMap(c => c.options || [])
    );

    formSelectedFoodItems.forEach(item => {
      if (saladOptions.has(item) || /salad|hummus|tabouleh|chaat|fattoush/i.test(item)) {
        salads.push(item);
      } else if (starterSoupOptions.has(item) || /roll|saute|cutlet|kebab|tikka(?! masala)|skewers|sticks|finger|manchurian|soup|lentil|sour|manchow|cream of mushroom|broth/i.test(item)) {
        starters.push(item);
      } else if (dessertOptions.has(item) || /mousse|caramel|tart|jamun|cake|basbousa|basboosa|kheer|halwa|rasmalai|pudding|umm ali/i.test(item)) {
        desserts.push(item);
      } else if (nonVegRegex.test(item)) {
        nonVegMainCourse.push(item);
      } else {
        vegMainCourse.push(item);
      }
    });

    const parsedComplementary = formComplementaryItems
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const generatedProspectusMenu = {
      salads,
      starters,
      vegMainCourse,
      nonVegMainCourse,
      desserts,
      complementary: parsedComplementary,
    };

    const totalBillPayable = parseFloat(subtotalRev.toFixed(2));
    const depositEntered = parseFloat((formDeposit || 0).toFixed(2));
    const balanceToPay = Math.max(0, parseFloat((totalBillPayable - depositEntered).toFixed(2)));
    const isFullySettled = totalBillPayable > 0 && balanceToPay <= 0.01;
    const parsedAdults = formAdultsCount.trim() !== '' ? parseInt(formAdultsCount, 10) : undefined;
    const parsedKids = formKidsCount.trim() !== '' ? parseInt(formKidsCount, 10) : undefined;
    const resolvedVenueName = formVenueFloor.trim() || selectedHall?.name || '';

    if (editingBooking) {
      // Keep payments array 100% synchronized with Francis's edited deposit amount
      const existingPayments = editingBooking.payments || [];
      const existingPaymentsSum = parseFloat(existingPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0).toFixed(2));
      let syncedPayments: PaymentRecord[] = existingPayments;

      if (Math.abs(depositEntered - existingPaymentsSum) > 0.01) {
        if (depositEntered <= 0) {
          syncedPayments = [];
        } else if (existingPayments.length <= 1) {
          syncedPayments = [{
            id: existingPayments[0]?.id || `pay_${Date.now()}`,
            bookingId: editingBooking.id,
            date: existingPayments[0]?.date || formBookingDate || new Date().toISOString().substring(0, 10),
            amount: depositEntered,
            paymentType: existingPayments[0]?.paymentType || 'advance',
            paymentMode: formAdvancePaymentMode,
            receiptNumber: existingPayments[0]?.receiptNumber || `CPH-RCP-${editingBooking.bookingNumber.replace(/[^0-9]/g, '') || Date.now().toString().slice(-5)}`,
            receivedBy: existingPayments[0]?.receivedBy || currentUser.name,
            notes: existingPayments[0]?.notes || 'Advance deposit updated by Supervisor',
            createdAt: existingPayments[0]?.createdAt || new Date().toISOString(),
          }];
        } else if (depositEntered > existingPaymentsSum) {
          syncedPayments = [
            ...existingPayments,
            {
              id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              bookingId: editingBooking.id,
              date: new Date().toISOString().substring(0, 10),
              amount: parseFloat((depositEntered - existingPaymentsSum).toFixed(2)),
              paymentType: isFullySettled ? 'balance' : 'additional',
              paymentMode: formAdvancePaymentMode,
              receiptNumber: `CPH-RCP-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
              receivedBy: currentUser.name,
              notes: 'Additional payment logged during booking edit',
              createdAt: new Date().toISOString(),
            },
          ];
        } else {
          syncedPayments = [{
            id: `pay_${Date.now()}`,
            bookingId: editingBooking.id,
            date: formBookingDate || new Date().toISOString().substring(0, 10),
            amount: depositEntered,
            paymentType: 'advance',
            paymentMode: formAdvancePaymentMode,
            receiptNumber: `CPH-RCP-${editingBooking.bookingNumber.replace(/[^0-9]/g, '') || Date.now().toString().slice(-5)}`,
            receivedBy: currentUser.name,
            notes: 'Payment adjusted by Supervisor',
            createdAt: new Date().toISOString(),
          }];
        }
      }

      const isPrePartyEdit = !editingBooking.partyEnded && !editingBooking.finalSettledAt && !(editingBooking.payments || []).some(p => p.paymentType === 'balance');
      const existingPreFp = getFunctionProspectusFinancials(editingBooking);

      const updated: BookingEvent = {
        ...editingBooking,
        branch: formBranch,
        clientName: formClientName,
        clientPhone: formClientPhone,
        clientEmail: formClientEmail.trim() ? formClientEmail : undefined,
        clientCompany: formClientCompany.trim() ? formClientCompany : undefined,
        hallId: formHallId,
        hallName: resolvedVenueName,
        hallOffer: formHallOffer,
        hallSection: formHallSection,
        bookingDate: formBookingDate,
        eventDate: formEventDate,
        timeSlot: formTimeSlot,
        eventType: formEventType.trim(),
        guestCount: formGuestCount,
        hasFoodFromHotel: isFoodIncluded,
        packageId: isFoodIncluded ? formPackageId : undefined,
        buffetTier: isFoodIncluded ? (selectedMenuObj.code as any) : undefined,
        selectedMenuId: isFoodIncluded ? formMenuId : undefined,
        selectedMenuName: isFoodIncluded ? selectedMenuObj.title : undefined,
        selectedFoodItems: isFoodIncluded ? formSelectedFoodItems : [],
        prospectusMenu: isFoodIncluded ? generatedProspectusMenu : undefined,
        foodPricePerGuestCharged: isFoodIncluded ? formFoodPriceCharged : 0,
        hallRentalCharged: calculatedHallCharged,
        discountAmount: formDiscount,
        depositPaid: depositEntered,
        payments: syncedPayments,
        totalBillPayable,
        balanceToPay,
        finalPaymentConfirmed: isFullySettled,
        fpPrePartyTotalBill: isPrePartyEdit ? totalBillPayable : (editingBooking.fpPrePartyTotalBill ?? existingPreFp.fpTotalBill),
        fpPrePartyAdvancePaid: isPrePartyEdit ? depositEntered : (editingBooking.fpPrePartyAdvancePaid ?? existingPreFp.fpAdvancePaid),
        fpPrePartyAdvanceMode: isPrePartyEdit ? (depositEntered > 0 ? formAdvancePaymentMode : undefined) : (editingBooking.fpPrePartyAdvanceMode ?? (existingPreFp.fpAdvanceMode || undefined)),
        decorAndAVCharged: effectiveDecorCharged,
        decorAndAVCost: decorCost,
        leadSource: formLeadSource,
        taxPercent: 0,
        municipalityFeePercent: 0,
        serviceChargePercent: 0,
        chefNotes: formChefNotes.trim() ? formChefNotes.trim() : undefined,
        specialRequests: formSpecialRequests.trim() ? formSpecialRequests.trim() : undefined,
        // Francis Operational & Function Prospectus Setup (exact logged values only)
        eventTimeSpan: formEventTimeSpan.trim() || undefined,
        foodPickupTime: formFoodPickupTime.trim() || undefined,
        venueFloor: formVenueFloor.trim() || undefined,
        soundSystem: formSoundSystem || undefined,
        projector: formProjector || undefined,
        projectorNotes: formProjector === 'Yes' && formProjectorNotes.trim() ? formProjectorNotes.trim() : undefined,
        decorations: formDecorations || undefined,
        tableClothColor: formTableClothColor.trim() || undefined,
        seatingStyle: formSeatingStyle.trim() || undefined,
        stagePosition: formStagePosition || undefined,
        buffetPosition: formBuffetPosition || undefined,
        adultsCount: parsedAdults,
        kidsCount: parsedKids,
        advancePaymentMode: depositEntered > 0 ? formAdvancePaymentMode : undefined,
        paymentTermsNotice: formPaymentTermsNotice.trim() || undefined,
      };
      onUpdateBooking(updated);
    } else {
      const newBookingId = `book_${Date.now()}`;
      const newBookingNum = `CPH-BEO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const initialPayments: PaymentRecord[] = depositEntered > 0
        ? [{
            id: `pay_${Date.now()}`,
            bookingId: newBookingId,
            date: formBookingDate || new Date().toISOString().substring(0, 10),
            amount: depositEntered,
            paymentType: 'advance',
            paymentMode: formAdvancePaymentMode,
            receiptNumber: `CPH-RCP-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
            receivedBy: currentUser.name,
            notes: 'Advance deposit logged at booking registration',
            createdAt: new Date().toISOString(),
          }]
        : [];

      const newEvent: BookingEvent = {
        id: newBookingId,
        bookingNumber: newBookingNum,
        branch: formBranch,
        clientName: formClientName,
        clientPhone: formClientPhone,
        clientEmail: formClientEmail.trim() ? formClientEmail : undefined,
        clientCompany: formClientCompany.trim() ? formClientCompany : undefined,
        leadSource: formLeadSource,
        hallId: formHallId,
        hallName: resolvedVenueName,
        hallOffer: formHallOffer,
        hallSection: formHallSection,
        bookingDate: formBookingDate,
        eventDate: formEventDate,
        timeSlot: formTimeSlot,
        eventType: formEventType.trim(),
        guestCount: formGuestCount,
        status: 'confirmed',
        hasFoodFromHotel: isFoodIncluded,
        packageId: isFoodIncluded ? formPackageId : undefined,
        buffetTier: isFoodIncluded ? (selectedMenuObj.code as any) : undefined,
        selectedMenuId: isFoodIncluded ? formMenuId : undefined,
        selectedMenuName: isFoodIncluded ? selectedMenuObj.title : undefined,
        selectedFoodItems: isFoodIncluded ? formSelectedFoodItems : [],
        prospectusMenu: isFoodIncluded ? generatedProspectusMenu : undefined,
        customRecipeItemIds: [],
        agreementType: isFoodIncluded ? 'per_person' : 'hall_only',
        foodPricePerGuestCharged: isFoodIncluded ? formFoodPriceCharged : 0,
        discountAmount: formDiscount,
        hallRentalCharged: calculatedHallCharged,
        hallDirectCost: hallDirectCost,
        foodCostPerGuestTheoretical: isFoodIncluded ? (selectedPkg?.costPerGuest || 0) : 0,
        beveragePriceCharged: 0,
        beverageCostTotal: 0,
        decorAndAVCharged: effectiveDecorCharged,
        decorAndAVCost: decorCost,
        staffingCost: staffCost,
        extraCharges: 0,
        taxPercent: 0,
        municipalityFeePercent: 0,
        serviceChargePercent: 0,
        depositPaid: depositEntered,
        payments: initialPayments,
        totalBillPayable,
        balanceToPay,
        finalPaymentConfirmed: isFullySettled,
        fpPrePartyTotalBill: totalBillPayable,
        fpPrePartyAdvancePaid: depositEntered,
        fpPrePartyAdvanceMode: depositEntered > 0 ? formAdvancePaymentMode : undefined,
        chefNotes: formChefNotes.trim() ? formChefNotes.trim() : undefined,
        chefUsageLogged: false,
        specialRequests: formSpecialRequests.trim() ? formSpecialRequests.trim() : undefined,
        fnbRepresentative: currentUser.name,
        createdAt: new Date().toISOString(),
        // Francis Operational & Function Prospectus Setup (exact logged values only)
        eventTimeSpan: formEventTimeSpan.trim() || undefined,
        foodPickupTime: formFoodPickupTime.trim() || undefined,
        venueFloor: formVenueFloor.trim() || undefined,
        soundSystem: formSoundSystem || undefined,
        projector: formProjector || undefined,
        projectorNotes: formProjector === 'Yes' && formProjectorNotes.trim() ? formProjectorNotes.trim() : undefined,
        decorations: formDecorations || undefined,
        tableClothColor: formTableClothColor.trim() || undefined,
        seatingStyle: formSeatingStyle.trim() || undefined,
        stagePosition: formStagePosition || undefined,
        buffetPosition: formBuffetPosition || undefined,
        adultsCount: parsedAdults,
        kidsCount: parsedKids,
        advancePaymentMode: depositEntered > 0 ? formAdvancePaymentMode : undefined,
        paymentTermsNotice: formPaymentTermsNotice.trim() || undefined,
      };
      onSaveBooking(newEvent);
    }

    setBookingModalOpen(false);
  };

  const confirmDelete = (id: string) => {
    onDeleteBooking(id);
    setDeletingBookingId(null);
  };

  // Cancellation confirmation handler (records cancellation reason, logs into cancelled parties, frees date)
  const handleConfirmCancellation = () => {
    if (!cancelModalBooking) return;
    if (cancelReason === 'Other Reason' && !cancelNotes.trim()) {
      alert('A mandatory cancellation explanation note is required when selecting Other Reason.');
      return;
    }
    const finalReason = cancelReason === 'Other Reason' 
      ? cancelNotes.trim() 
      : (cancelNotes.trim() ? `${cancelReason} - ${cancelNotes.trim()}` : cancelReason);
    if (!finalReason.trim()) {
      alert('A mandatory cancellation reason must be recorded.');
      return;
    }

    const updated: BookingEvent = {
      ...cancelModalBooking,
      status: 'cancelled',
      cancellationReason: finalReason,
      cancellationPolicy: {
        reason: finalReason,
        advanceAction: cancelAdvanceAction,
        refundAmount: Number(cancelRefundAmount) || 0,
        refundMode: cancelRefundMode,
        cancelledAt: new Date().toISOString(),
        cancelledBy: currentUser.name || "Francis D'Souza",
        notes: cancelNotes.trim() || undefined,
      },
      cancelledAt: new Date().toISOString(),
      cancelledBy: currentUser.name || "Francis D'Souza",
      isTentative: false,
    };
    onUpdateBooking(updated);
    setCancelModalBooking(null);
    setCancelReason('Client Requested Date Rescheduling');
    setCancelNotes('');
    setCancelRefundAmount(0);
    setCancelAdvanceAction('forfeited');
    if (selectedPartyForDetails?.id === cancelModalBooking.id) {
      setSelectedPartyForDetails(null);
    }
  };

  const handleAddPaymentRecord = () => {
    if (!paymentModalBooking) return;
    const amountNum = parseFloat(newPaymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid payment amount in AED.');
      return;
    }

    const receiptNumber = `CPH-RCP-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    const newRecord: PaymentRecord = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      bookingId: paymentModalBooking.id,
      date: new Date().toISOString().substring(0, 10),
      amount: amountNum,
      paymentType: newPaymentType,
      paymentMode: newPaymentMode,
      receiptNumber,
      receivedBy: currentUser.name,
      notes: newPaymentNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const currentPayments = paymentModalBooking.payments || [];
    const updatedPayments = [...currentPayments, newRecord];
    const totalDeposit = parseFloat(updatedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0).toFixed(2));
    const totalBill = getBookingPaymentSummary(paymentModalBooking).totalBill;
    const remainingBalance = Math.max(0, parseFloat((totalBill - totalDeposit).toFixed(2)));
    const preFp = getFunctionProspectusFinancials(paymentModalBooking);
    const shouldFreezeFp = newRecord.paymentType === 'balance' || Boolean(paymentModalBooking.partyEnded);

    const updated: BookingEvent = {
      ...paymentModalBooking,
      payments: updatedPayments,
      depositPaid: totalDeposit,
      totalBillPayable: totalBill,
      balanceToPay: remainingBalance,
      finalPaymentConfirmed: totalBill > 0 && remainingBalance <= 0.01,
      fpPrePartyTotalBill: paymentModalBooking.fpPrePartyTotalBill ?? preFp.fpTotalBill,
      fpPrePartyAdvancePaid: shouldFreezeFp
        ? (paymentModalBooking.fpPrePartyAdvancePaid ?? preFp.fpAdvancePaid)
        : totalDeposit,
      fpPrePartyAdvanceMode: shouldFreezeFp
        ? (paymentModalBooking.fpPrePartyAdvanceMode ?? (preFp.fpAdvanceMode || undefined))
        : (paymentModalBooking.fpPrePartyAdvanceMode ?? newPaymentMode),
      isTentative: false, // Receiving advance payment confirms the tentative hold!
    };

    onUpdateBooking(updated);
    setPaymentModalBooking(updated);
    setNewPaymentAmount('');
    setNewPaymentNotes('');
    alert(`✓ Payment of ${amountNum.toFixed(2)} AED recorded successfully. Official Receipt #${receiptNumber} generated.`);
  };

  const handleRequestUnlockSubmit = () => {
    if (!unlockModalBooking) return;
    if (!unlockReason.trim()) {
      alert('Please enter a reason explaining why this locked record needs to be modified.');
      return;
    }

    const updated: BookingEvent = {
      ...unlockModalBooking,
      lockDetails: {
        ...(unlockModalBooking.lockDetails || { isLocked: true }),
        unlockRequested: true,
        unlockRequestReason: unlockReason.trim(),
        unlockRequestedBy: currentUser.name,
        unlockRequestedAt: new Date().toISOString(),
      }
    };
    onUpdateBooking(updated);
    setUnlockModalBooking(null);
    setUnlockReason('');
    alert('✓ Unlock request submitted. The General Manager has been notified to review and approve.');
  };

  const handleApproveUnlock = (booking: BookingEvent) => {
    if (currentUser.role !== 'general_manager') {
      alert('Only the General Manager can approve unlock requests.');
      return;
    }
    const updated: BookingEvent = {
      ...booking,
      lockDetails: {
        isLocked: false,
        unlockApprovedBy: currentUser.name,
        unlockApprovedAt: new Date().toISOString(),
      }
    };
    onUpdateBooking(updated);
    alert(`✓ Record unlocked by General Manager (${currentUser.name}). Editing is now enabled.`);
  };

  const handleReactivateBooking = (booking: BookingEvent) => {
    const updated: BookingEvent = {
      ...booking,
      status: 'confirmed',
      cancellationReason: undefined,
      cancelledAt: undefined,
      cancelledBy: undefined,
    };
    onUpdateBooking(updated);
  };

  // Workflow notifications
  const francisAddedParties = bookings.filter(b => 
    b.hasFoodFromHotel && 
    !b.partyEnded && 
    b.costingStatus !== 'costed_by_arun' &&
    b.status !== 'cancelled'
  );

  // Tab Dataset Counts (restricted by active Hall filter)
  const scheduledPartiesCount = bookings.filter(b => b.status !== 'cancelled' && !b.partyEnded && b.status !== 'completed' && matchesHallFilter(b)).length;
  const costedPartiesCount = bookings.filter(b => (b.costingStatus === 'costed_by_arun' || b.postingReportGenerated || (b.status === 'completed' && b.partyEnded)) && matchesHallFilter(b)).length;
  const cancelledPartiesCount = bookings.filter(b => b.status === 'cancelled' && matchesHallFilter(b)).length;

  // Active dataset according to mainTab
  let tabBookings = bookings;
  if (mainTab === 'scheduled') {
    tabBookings = bookings.filter(b => b.status !== 'cancelled' && !b.partyEnded && b.status !== 'completed');
  } else if (mainTab === 'costed') {
    tabBookings = bookings.filter(b => b.costingStatus === 'costed_by_arun' || b.postingReportGenerated || (b.status === 'completed' && b.partyEnded));
  } else if (mainTab === 'cancelled') {
    tabBookings = bookings.filter(b => b.status === 'cancelled');
  } else if (mainTab === 'availability') {
    tabBookings = bookings.filter(b => b.status !== 'cancelled');
  }

  // Apply search, hall, branch, and status filters
  const filteredBookingsRaw = tabBookings.filter(b => {
    const matchesSearch = 
      b.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.bookingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.hallName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.eventType.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesHall = matchesHallFilter(b);
    const matchesBranch = branchFilter === 'all' || b.branch === branchFilter;
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;

    return matchesSearch && matchesHall && matchesBranch && matchesStatus;
  });

  // Popular Global Sorting: Default is "Event Date: Ending Soonest First" ("the parties who ends first should come first")
  const filteredBookings = [...filteredBookingsRaw].sort((a, b) => {
    if (sortBy === 'event_date_soonest') {
      return a.eventDate.localeCompare(b.eventDate); // Earliest celebration date first ("parties who ends first should come first")
    }
    if (sortBy === 'event_date_latest') {
      return b.eventDate.localeCompare(a.eventDate); // Furthest celebration date first
    }
    if (sortBy === 'booking_date_newest') {
      const timeA = new Date(a.createdAt || a.bookingDate || a.eventDate).getTime();
      const timeB = new Date(b.createdAt || b.bookingDate || b.eventDate).getTime();
      return timeB - timeA; // Most recently booked first
    }
    if (sortBy === 'guest_count_desc') {
      return b.guestCount - a.guestCount;
    }
    if (sortBy === 'outstanding_desc') {
      const sumA = getBookingPaymentSummary(a);
      const sumB = getBookingPaymentSummary(b);
      return sumB.balanceToPay - sumA.balanceToPay; // Largest outstanding balance first
    }
    if (sortBy === 'revenue_desc') {
      const sumA = getBookingPaymentSummary(a);
      const sumB = getBookingPaymentSummary(b);
      return sumB.totalBill - sumA.totalBill;
    }
    if (sortBy === 'status') {
      return a.status.localeCompare(b.status);
    }
    // Default: Earliest/Ending Soonest party celebration date first
    return a.eventDate.localeCompare(b.eventDate);
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Francis's Party Arrival & Payment Alert Banner */}
      {(() => {
        const pendingArrivals = bookings.filter(b => {
          if (b.status === 'cancelled') return false;
          const summary = getBookingPaymentSummary(b);
          return summary.balanceToPay > 0.01 && !summary.isBalanceSettled;
        });

        if (pendingArrivals.length === 0) return null;

        return (
          <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white rounded-3xl p-5 sm:p-6 shadow-lg shadow-amber-900/15 border border-amber-400">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-2xl bg-white/20 text-white flex items-center justify-center shrink-0 backdrop-blur-xs">
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white text-amber-900">
                      Alert for Francis (F&B Supervisor)
                    </span>
                    <span className="text-xs font-semibold text-amber-100">
                      Party Arrival & Balance Due Tracking
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight mt-0.5">
                    {pendingArrivals.length} Confirmed Banquet {pendingArrivals.length === 1 ? 'Party Has' : 'Parties Have'} Outstanding Payment!
                  </h3>
                  <p className="text-xs text-amber-100 max-w-2xl mt-0.5">
                    When guests arrive on their party date, please collect the remaining outstanding balance, update any last-minute price changes (e.g. extra guests/decor), and confirm full payment.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                {pendingArrivals.slice(0, 2).map(ev => {
                  const due = getBookingPaymentSummary(ev).balanceToPay;
                  return (
                    <button
                      key={ev.id}
                      onClick={() => setSettleModalBooking(ev)}
                      className="px-3.5 py-2 rounded-full bg-white text-amber-950 hover:bg-amber-50 active:scale-98 text-xs font-black shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                      <span>Settle {ev.clientName}</span>
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-200 text-amber-900 text-[10px]">
                        {due.toFixed(0)} AED Due
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* TOP ALERT FOR CHEF: When Francis confirmed party has ended */}
      {currentUser.role === 'executive_chef' && bookings.some(b => (b.costingStatus === 'party_ended_pending_chef' || (b.partyEnded && !b.chefApproved)) && b.hasFoodFromHotel) && (
        <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 text-white rounded-3xl p-5 shadow-lg border-2 border-amber-300 animate-in slide-in-from-top-3 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/20 text-white flex items-center justify-center shrink-0 backdrop-blur-xs border border-white/30">
                <ChefHat className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-white text-orange-950 shadow-xs">
                    🚨 ACTION REQUIRED • PARTY ENDED
                  </span>
                  <span className="text-xs font-semibold text-amber-100">
                    Confirmed by Francis D&apos;Souza (F&amp;B Supervisor)
                  </span>
                </div>
                <h3 className="text-base font-black tracking-tight mt-0.5">
                  Parties Ready for Kitchen Ingredient Usage Entry
                </h3>
                <p className="text-xs text-amber-100 max-w-2xl mt-0.5 leading-relaxed">
                  Francis has confirmed that the banquet party has ended. Please click <strong>"Enter Ingredients Used"</strong> on the completed party below, choose items from stock (chicken, rice, onions, spices), and input the amounts you used.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
              {bookings.filter(b => (b.costingStatus === 'party_ended_pending_chef' || (b.partyEnded && !b.chefApproved)) && b.hasFoodFromHotel).slice(0, 1).map(p => (
                <button
                  key={p.id}
                  onClick={() => onOpenChefUsageModal(p)}
                  className="px-4 py-2 rounded-2xl bg-white hover:bg-amber-50 text-orange-950 text-xs font-black shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <ChefHat className="w-4 h-4 text-orange-600" />
                  <span>Enter Used: {p.clientName}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FRANCIS PARTY INFO ADDED NOTIFICATION (Directly displays to Chef and Arun on top) */}
      {francisAddedParties.length > 0 && (currentUser.role === 'executive_chef' || currentUser.role === 'accounts_executive' || currentUser.role === 'general_manager') && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50 to-white border border-emerald-300 text-emerald-950 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs animate-in slide-in-from-top-3 duration-200">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#236B50] text-white flex items-center justify-center shrink-0 shadow-xs">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900 shadow-2xs">
                  Francis Party Info Broadcast
                </span>
                <span className="text-xs font-bold text-emerald-800">
                  F&amp;B Supervisor Registered Party Specifications
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-extrabold text-[#192A24] mt-0.5">
                New Party: &quot;{francisAddedParties[0].clientName}&quot; ({francisAddedParties[0].guestCount} Guests • Event Date: {francisAddedParties[0].eventDate})
              </h4>
              <p className="text-xs text-emerald-800 max-w-2xl mt-0.5">
                {currentUser.role === 'executive_chef'
                  ? 'Francis has registered party food requirements. Review the banquet specifications and prepare kitchen ingredients.'
                  : (currentUser.role === 'accounts_executive'
                    ? 'Francis has registered this party information. Accounts has full read access to all parties, guest counts, and agreements.'
                    : "Francis D'Souza has added banquet party specifications. Visible to both Executive Chef Karim and Accounts Executive Arun Kumar.")}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onOpenA4Sheet(francisAddedParties[0])}
              className="px-4 py-2.5 rounded-2xl bg-[#236B50] hover:bg-[#1C5740] text-white text-xs font-black shadow-md transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer active:scale-95"
            >
              <FileText className="w-4 h-4" />
              <span>Read Party Details</span>
            </button>
          </div>
        </div>
      )}



      {/* Executive Chef Portal Guidance Banner */}
      {currentUser.role === 'executive_chef' && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-emerald-700 text-white rounded-3xl p-5 shadow-md border border-amber-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-white/20 text-white flex items-center justify-center shrink-0 backdrop-blur-xs">
                <ChefHat className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white text-amber-950">
                    Executive Chef Portal (Chef Karim)
                  </span>
                  <span className="text-xs font-semibold text-amber-100">
                    Party Bookings Read & Kitchen Usage
                  </span>
                </div>
                <h3 className="text-base font-extrabold tracking-tight mt-0.5">
                  Banquet Parties Schedule & Kitchen Costing Workflow
                </h3>
                <p className="text-xs text-amber-100 max-w-2xl mt-0.5 leading-relaxed">
                  You have access to read upcoming & past parties, guest counts, and buffet menus. Click <strong>"Enter Kitchen Ingredients Used"</strong> on any booking to select ingredients from stock, enter amounts used, and send the voucher to Accounts (Arun Kumar).
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
              <span className="px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-bold border border-white/30">
                🔒 Pricing Restricted to Accounts
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top Header / Filter Controls */}
      <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#192A24] font-['Plus_Jakarta_Sans']">
              {currentUser.role === 'executive_chef' ? 'Banquet Parties & Kitchen Menus' : 'Banquet Hall Bookings & Food Agreements'}
            </h1>
            <p className="text-xs sm:text-sm text-[#5A6F66] mt-0.5">
              {currentUser.role === 'executive_chef' 
                ? 'Review upcoming and past parties, guest headcounts, buffet packages, and submit kitchen ingredient vouchers.'
                : 'Track Crystal Plaza & Casmia banquet bookings, special offers, chef food costing, and print 2-Page A4 sheets.'}
            </p>
          </div>

          {currentUser.permissions.canManageBookings && (
            <button
              onClick={openCreateModal}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-full bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white font-bold text-xs shadow-md shadow-[#236B50]/20 transition-all self-start md:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Register Banquet Party</span>
            </button>
          )}
        </div>

        {/* Primary Tabs Navigation */}
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2ECE7] pb-3">
            <div className="inline-flex p-1 bg-[#F2F7F5] rounded-2xl border border-[#D5E5DE] max-w-full overflow-x-auto">
              <button
                type="button"
                onClick={() => setMainTab('scheduled')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center space-x-2 shrink-0 ${
                  mainTab === 'scheduled'
                    ? 'bg-[#236B50] text-white shadow-xs'
                    : 'text-[#486356] hover:bg-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Scheduled Banquets</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  mainTab === 'scheduled' ? 'bg-white text-[#236B50]' : 'bg-[#D5E5DE] text-[#192A24]'
                }`}>
                  {scheduledPartiesCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMainTab('availability')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center space-x-2 shrink-0 ${
                  mainTab === 'availability'
                    ? 'bg-[#236B50] text-white shadow-xs'
                    : 'text-[#486356] hover:bg-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Banquet Calendar</span>
              </button>

              <button
                type="button"
                onClick={() => setMainTab('costed')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center space-x-2 shrink-0 ${
                  mainTab === 'costed'
                    ? 'bg-purple-800 text-white shadow-xs'
                    : 'text-purple-950 hover:bg-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Completed & Costed</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  mainTab === 'costed' ? 'bg-white text-purple-950' : 'bg-purple-200 text-purple-950'
                }`}>
                  {costedPartiesCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMainTab('cancelled')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center space-x-2 shrink-0 ${
                  mainTab === 'cancelled'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'text-rose-800 hover:bg-white'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Cancelled Events</span>
                {cancelledPartiesCount > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    mainTab === 'cancelled' ? 'bg-white text-rose-800' : 'bg-rose-200 text-rose-950'
                  }`}>
                    {cancelledPartiesCount}
                  </span>
                )}
              </button>
            </div>

            <div className="text-xs text-[#5A6F66]">
              {mainTab === 'availability' ? (
                <span>Interactive Booking Calendar & Party Date Verification</span>
              ) : (
                <span>Showing <strong className="text-[#192A24]">{filteredBookings.length}</strong> banquet {filteredBookings.length === 1 ? 'event' : 'events'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Global Popular Filter & Sort Toolbar */}
        {mainTab !== 'availability' && (
          <div className="mt-4 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-[#5A6F66] absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search by client, BEO number, hall..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#192A24] placeholder-[#7D948A] focus:outline-none focus:border-[#236B50] focus:ring-1 focus:ring-[#236B50]"
                />
              </div>

              <div>
                <select
                  aria-label="Filter bookings by hall"
                  value={hallFilter}
                  onChange={(e) => handleHallFilterChange(e.target.value)}
                  className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-2xl px-3.5 py-2.5 text-xs text-[#192A24] font-bold focus:outline-none focus:border-[#236B50] focus:ring-1 focus:ring-[#236B50] cursor-pointer"
                >
                  <option value="All">Hall: All</option>
                  <option value="First Floor Big Hall">First Floor Big Hall</option>
                  <option value="Suite Room Hall">Suite Room Hall</option>
                </select>
              </div>

              <div>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-2xl px-3.5 py-2.5 text-xs text-[#192A24] font-medium focus:outline-none focus:border-[#236B50]"
                >
                  <option value="all">All Branches</option>
                  <option value="CPH1">CPH1</option>
                  <option value="CPH2">CPH2</option>
                </select>
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-2xl px-3.5 py-2.5 text-xs text-[#192A24] font-medium focus:outline-none focus:border-[#236B50]"
                >
                  <option value="all">All Statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="in_preparation">In Preparation</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-2xl px-3.5 py-2.5 text-xs text-[#192A24] font-bold focus:outline-none focus:border-[#236B50]"
                >
                  <option value="event_date_soonest">Sort: Event Date (Ending Soonest First)</option>
                  <option value="event_date_latest">Sort: Event Date (Furthest First)</option>
                  <option value="booking_date_newest">Sort: Booking Date (Newest First)</option>
                  <option value="guest_count_desc">Sort: Guests (Highest to Lowest)</option>
                  <option value="outstanding_desc">Sort: Highest Balance Due First</option>
                  <option value="revenue_desc">Sort: Highest Total Revenue</option>
                  <option value="status">Sort: By Status</option>
                </select>
              </div>
            </div>

            {hallFilterError && (
              <div className="px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-2">
                <span>{hallFilterError}</span>
                <button
                  type="button"
                  onClick={() => setHallFilterError(null)}
                  className="text-rose-700 hover:text-rose-950 font-bold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          DATE AVAILABILITY & BOOKING SCHEDULE TAB (FRANCIS DASHBOARD)
          "in that tab he should see all scheduled banquets Name and date only
          if he wants to see details touch it and redirect him to details about that party"
          ========================================================================= */}
      {mainTab === 'availability' && (() => {
        const [yearStr, monthStr] = availabilityMonth.split('-');
        const year = parseInt(yearStr, 10);
        const monthIndex = parseInt(monthStr, 10) - 1;
        
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();
        
        const activeMonthBookings = bookings.filter(b => 
          b.status !== 'cancelled' && 
          b.eventDate.startsWith(availabilityMonth) &&
          matchesHallFilter(b)
        );

        const allScheduledBanquets = bookings.filter(b => b.status !== 'cancelled' && !b.partyEnded && b.status !== 'completed' && matchesHallFilter(b))
          .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

        const monthName = new Date(year, monthIndex, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

        const handlePrevMonth = () => {
          const d = new Date(year, monthIndex - 1, 1);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          setAvailabilityMonth(`${y}-${m}`);
        };

        const handleNextMonth = () => {
          const d = new Date(year, monthIndex + 1, 1);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          setAvailabilityMonth(`${y}-${m}`);
        };

        const bookedDaysMap = new Map<number, BookingEvent[]>();
        activeMonthBookings.forEach(b => {
          const dayNum = parseInt(b.eventDate.split('-')[2], 10);
          if (!bookedDaysMap.has(dayNum)) {
            bookedDaysMap.set(dayNum, []);
          }
          bookedDaysMap.get(dayNum)!.push(b);
        });

        const bookedDatesCount = bookedDaysMap.size;
        const availableDatesCount = Math.max(0, daysInMonth - bookedDatesCount);

        return (
          <div className="space-y-6">
            {/* Header with Navigation & Quick Stats */}
            <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#E8F5EE] text-[#236B50] border border-[#C5E5D5]">
                      Banquet Booking Calendar
                    </span>
                    <span className="text-xs font-bold text-[#5A6F66]">
                      Date Availability Checker
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-[#192A24] font-['Plus_Jakarta_Sans'] mt-1">
                    Banquet Calendar: Scheduled Banquets & Availability
                  </h2>
                  <p className="text-xs text-[#5A6F66] mt-0.5">
                    Green dates are open for new bookings. Click any scheduled banquet to view details, or cancel if requested by the client.
                  </p>
                </div>

                {/* Month & Hall Navigator */}
                <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                  <select
                    aria-label="Filter calendar by hall"
                    value={hallFilter}
                    onChange={(e) => handleHallFilterChange(e.target.value)}
                    className="bg-[#F6FAF8] border border-[#D5E5DE] rounded-2xl px-3.5 py-2.5 text-xs text-[#192A24] font-bold focus:outline-none focus:border-[#236B50] cursor-pointer"
                  >
                    <option value="All">Hall: All</option>
                    <option value="First Floor Big Hall">First Floor Big Hall</option>
                    <option value="Suite Room Hall">Suite Room Hall</option>
                  </select>

                  <div className="flex items-center space-x-2 bg-[#F6FAF8] border border-[#D5E5DE] p-1.5 rounded-2xl">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-2 rounded-xl hover:bg-white text-[#236B50] transition-colors cursor-pointer"
                      title="Previous Month"
                    >
                      <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                    </button>
                    <span className="text-xs font-black text-[#192A24] px-3 font-['Plus_Jakarta_Sans'] min-w-[130px] text-center">
                      {monthName}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-2 rounded-xl hover:bg-white text-[#236B50] transition-colors cursor-pointer"
                      title="Next Month"
                    >
                      <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Availability Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200">
                  <div className="text-[11px] font-bold text-emerald-800">Available Free Dates</div>
                  <div className="text-xl font-extrabold text-emerald-950 mt-0.5 font-mono">{availableDatesCount} Days Open</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200">
                  <div className="text-[11px] font-bold text-amber-800">Scheduled Parties</div>
                  <div className="text-xl font-extrabold text-amber-950 mt-0.5 font-mono">{activeMonthBookings.length} Banquets</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-purple-50/80 border border-purple-200">
                  <div className="text-[11px] font-bold text-purple-800">Dates Booked</div>
                  <div className="text-xl font-extrabold text-purple-950 mt-0.5 font-mono">{bookedDatesCount} Days</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200">
                  <div className="text-[11px] font-bold text-rose-800">Cancelled / Freed Up</div>
                  <div className="text-xl font-extrabold text-rose-950 mt-0.5 font-mono">
                    {bookings.filter(b => b.status === 'cancelled' && b.eventDate.startsWith(availabilityMonth) && matchesHallFilter(b)).length} Logged
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Calendar Grid for the Month */}
            <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E2ECE7]">
                <h3 className="text-sm font-extrabold text-[#192A24] flex items-center space-x-2">
                  <CalendarDays className="w-4 h-4 text-[#236B50]" />
                  <span>Calendar Grid: {monthName}</span>
                </h3>
                <div className="flex items-center space-x-3 text-xs">
                  <span className="flex items-center space-x-1.5 text-emerald-800 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    <span>Free Date</span>
                  </span>
                  <span className="flex items-center space-x-1.5 text-amber-800 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    <span>Booked Party</span>
                  </span>
                </div>
              </div>

              {/* Day-of-week header */}
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-[#5A6F66]">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[90px] rounded-2xl bg-slate-50/50 border border-dashed border-slate-200/60 p-2 opacity-30" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateStr = `${availabilityMonth}-${String(dayNum).padStart(2, '0')}`;
                  const partiesOnDay = bookedDaysMap.get(dayNum) || [];
                  const isBooked = partiesOnDay.length > 0;

                  return (
                    <div
                      key={dayNum}
                      className={`min-h-[100px] rounded-2xl p-2.5 transition-all flex flex-col justify-between border ${
                        isBooked
                          ? 'bg-amber-50/60 border-amber-300 hover:bg-amber-100/60 shadow-xs'
                          : 'bg-[#F9FCFA] border-emerald-200/80 hover:bg-emerald-50/70 hover:border-emerald-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black rounded-full w-6 h-6 flex items-center justify-center font-mono ${
                          isBooked ? 'bg-amber-500 text-white' : 'text-[#192A24]'
                        }`}>
                          {dayNum}
                        </span>
                        <span className={`text-[10px] font-black uppercase px-1.5 py-0.2 rounded ${
                          isBooked ? 'bg-amber-200 text-amber-950 font-bold' : 'text-emerald-700 font-bold'
                        }`}>
                          {isBooked ? 'Booked' : 'Free'}
                        </span>
                      </div>

                      <div className="my-1 flex-1 flex flex-col justify-center">
                        {isBooked ? (
                          partiesOnDay.map(party => (
                            <button
                              key={party.id}
                              type="button"
                              onClick={() => setSelectedPartyForDetails(party)}
                              className="text-left w-full p-1.5 rounded-xl bg-white border border-amber-300 shadow-2xs hover:bg-amber-50 transition-all cursor-pointer group text-xs my-0.5"
                              title="Touch to view details or cancel"
                            >
                              {/* STRICT REQUIREMENT: Name and date only */}
                              <div className="font-extrabold text-[#192A24] truncate group-hover:text-[#236B50]">
                                {party.clientName}
                              </div>
                              <div className="text-[10px] font-mono text-amber-900 font-semibold truncate">
                                {party.eventDate}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="text-center py-1">
                            <span className="text-[11px] text-emerald-700 font-semibold block">Available</span>
                          </div>
                        )}
                      </div>

                      <div>
                        {isBooked ? (
                          <span className="text-[9px] text-[#5A6F66] font-bold block text-center">
                            Touch for details
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              openCreateModal();
                              setFormEventDate(dateStr);
                            }}
                            className="w-full py-1 text-[10px] font-bold text-[#236B50] hover:bg-[#236B50] hover:text-white rounded-lg transition-colors cursor-pointer border border-[#236B50]/30"
                          >
                            + Book
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* =====================================================================
                SCHEDULED BANQUETS LIST (STRICTLY NAME & DATE ONLY PER REQUIREMENT)
                "in that tab he should see all scheduled banquets Name and date only
                if he wants to see details touch it and redirect him to details about that party"
                ===================================================================== */}
            <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E2ECE7]">
                <div>
                  <h3 className="text-base font-extrabold text-[#192A24] flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>All Scheduled Banquets (Client Name & Event Date Only)</span>
                  </h3>
                  <p className="text-xs text-[#5A6F66] mt-0.5">
                    Touch any scheduled party below to view full banquet specifications, or click cancel to record cancellation reason.
                  </p>
                </div>
                <span className="text-xs font-bold text-[#236B50] bg-[#E8F5EE] px-3 py-1 rounded-full border border-[#C5E5D5] self-start sm:self-auto font-mono">
                  {allScheduledBanquets.length} Active Banquets
                </span>
              </div>

              {allScheduledBanquets.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#5A6F66]">
                  No upcoming banquets scheduled. All dates are currently open for booking!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allScheduledBanquets.map((party) => (
                    <div
                      key={party.id}
                      onClick={() => setSelectedPartyForDetails(party)}
                      className="p-4 rounded-2xl border border-[#D5E5DE] bg-[#FAFDFB] hover:bg-white hover:border-[#236B50] hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      {/* Strictly: Name and Date only */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-mono text-[#5A6F66] flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-[#236B50]" />
                          <span className="font-bold text-[#192A24]">{party.eventDate}</span>
                        </div>
                        <h4 className="text-sm font-extrabold text-[#192A24] group-hover:text-[#236B50] transition-colors">
                          {party.clientName}
                        </h4>
                        <div className="text-[10px] text-emerald-800 font-bold flex items-center space-x-1">
                          <span>👆 Touch for party details</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end space-y-2 shrink-0">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                          Scheduled
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCancelModalBooking(party);
                          }}
                          className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                          title="Cancel this banquet with a reason"
                        >
                          Cancel Party
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          CANCELLED EVENTS HISTORY LOG TAB (MANDATORY REASONS & REPORTING)
          ========================================================================= */}
      {mainTab === 'cancelled' && (() => {
        // Calculate cancellation reporting statistics (respecting hallFilter)
        const cancelledEvents = bookings.filter(b => b.status === 'cancelled' && matchesHallFilter(b));
        const reasonCounts: Record<string, number> = {};
        let totalCancelledGuests = 0;
        let totalCancelledRevenue = 0;

        cancelledEvents.forEach(b => {
          const fin = calculateEventFinancials(b);
          totalCancelledGuests += b.guestCount || 0;
          totalCancelledRevenue += fin.subtotalRevenue || 0;
          const r = b.cancellationReason || 'Unspecified';
          const primaryKey = r.split(' - ')[0].trim();
          reasonCounts[primaryKey] = (reasonCounts[primaryKey] || 0) + 1;
        });

        return (
        <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-sm space-y-5">
          {/* Reporting KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">Total Terminated</span>
              <span className="text-2xl font-black text-rose-950 font-mono mt-0.5 block">{cancelledEvents.length} Events</span>
              <span className="text-[10px] text-rose-700">Archived with mandatory reason</span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Capacity Released</span>
              <span className="text-2xl font-black text-amber-950 font-mono mt-0.5 block">{totalCancelledGuests} Guests</span>
              <span className="text-[10px] text-amber-700">Hall dates returned to available</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Cancelled Revenue Value</span>
              <span className="text-xl font-black text-slate-900 font-mono mt-0.5 block">{totalCancelledRevenue.toLocaleString()} AED</span>
              <span className="text-[10px] text-slate-500">Gross contract volume</span>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">Primary Reason</span>
              <span className="text-sm font-black text-blue-950 truncate mt-1 block">
                {Object.keys(reasonCounts).length > 0
                  ? Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0][0]
                  : 'None logged'}
              </span>
              <span className="text-[10px] text-blue-700">Audit tracking compliant</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E2ECE7]">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-200">
                  Audit Log
                </span>
                <span className="text-xs font-bold text-slate-500">
                  Archived & Cancelled Banquet Events
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-[#192A24] mt-1 flex items-center space-x-2">
                <Ban className="w-5 h-5 text-rose-600" />
                <span>Cancelled Events History Log</span>
              </h3>
              <p className="text-xs text-[#5A6F66] mt-0.5">
                Every cancelled party is documented with full reason for cancellation, timestamp, and user audit record.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 font-mono">
              {filteredBookings.length} Cancelled Parties
            </span>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#5A6F66]">
              No cancelled parties found in the audit log.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((party) => (
                <div
                  key={party.id}
                  className="p-5 rounded-2xl border border-rose-200 bg-rose-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-rose-900 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200">
                        {party.bookingNumber}
                      </span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {party.branch}
                      </span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white text-slate-800 border border-slate-200">
                        {party.hallName}
                      </span>
                      <span className="text-xs text-slate-600 font-semibold">
                        Original Event Date: <strong className="text-slate-900">{party.eventDate}</strong>
                      </span>
                    </div>

                    <h4 className="text-base font-extrabold text-slate-900">
                      {party.clientName} {party.clientCompany && `(${party.clientCompany})`}
                    </h4>

                    {/* Cancellation Reason Badge */}
                    <div className="p-3 rounded-xl bg-white border border-rose-200 text-xs space-y-1">
                      <div className="flex items-center space-x-1.5 text-rose-800 font-black">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Reason for Cancellation:</span>
                      </div>
                      <p className="text-slate-800 font-semibold pl-5">
                        {party.cancellationReason || 'Client requested cancellation (no reason stated)'}
                      </p>
                      <div className="text-[11px] text-slate-500 pl-5 pt-0.5 flex flex-wrap gap-x-3">
                        {party.cancelledAt && (
                          <span>Cancelled on: <strong>{new Date(party.cancelledAt).toLocaleString()}</strong></span>
                        )}
                        {party.cancelledBy && (
                          <span>Logged by: <strong>{party.cancelledBy}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 self-start md:self-auto">
                    <button
                      type="button"
                      onClick={() => setSelectedPartyForDetails(party)}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                    >
                      View Specs
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReactivateBooking(party)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                      title="Restore and re-activate this banquet booking"
                    >
                      Re-activate Party
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        );
      })()}

      {/* =========================================================================
          SCHEDULED & COSTED PARTIES LIST CARDS
          ========================================================================= */}
      {(mainTab === 'scheduled' || mainTab === 'costed') && (
        <div className="space-y-4">
          {filteredBookings.length === 0 ? (
            <div className="bg-white border border-[#E2ECE7] rounded-3xl p-12 text-center text-[#5A6F66] space-y-3">
              <div>
                No banquet bookings found{hallFilter !== 'All' ? ` for ${hallFilter}` : ''} matching your filters.
              </div>
              {hallFilter !== 'All' && (
                <button
                  type="button"
                  onClick={() => handleHallFilterChange('All')}
                  className="px-4 py-2 rounded-xl bg-[#E8F5EE] hover:bg-[#D5EFE3] text-[#236B50] text-xs font-bold cursor-pointer transition-colors"
                >
                  Show All Halls
                </button>
              )}
            </div>
          ) : (
          filteredBookings.map((event) => {
            const fin = calculateEventFinancials(event);
            const paymentSummary = getBookingPaymentSummary(event);
            const partyEndedLabel =
              event.partyEndedConfirmedBy && !event.partyEndedConfirmedBy.includes('Francis')
                ? event.partyEndedConfirmedBy
                : 'F&B Supervisor';

            return (
              <div
                key={event.id}
                className="bg-white border border-[#E2ECE7] rounded-3xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all space-y-4"
              >
                {/* 1. Card Top Header: Reference Badges, Client Info & Payment Status */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 pb-3.5 border-b border-[#EBF2EE]">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-[#236B50] bg-[#E8F5EE] px-2.5 py-0.5 rounded-lg border border-[#C5E5D5] whitespace-nowrap">
                        {event.bookingNumber}
                      </span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-[#EBF3EF] text-[#284B3D] border border-[#D5E5DE] whitespace-nowrap">
                        {event.branch}
                      </span>
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-lg border whitespace-nowrap ${
                        event.status === 'confirmed'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : event.status === 'active'
                          ? 'bg-[#236B50] text-white border-[#236B50]'
                          : 'bg-slate-100 text-slate-800 border-slate-200'
                      }`}>
                        {event.status.replace('_', ' ').toUpperCase()}
                      </span>
                      {event.hallOffer === 'free_with_food' && (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-emerald-50 text-[#17523C] border border-emerald-200 whitespace-nowrap">
                          Hall FREE with Food
                        </span>
                      )}
                      {event.hallOffer === 'one_side_hall' && (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 whitespace-nowrap">
                          One-Side Offer (1,000 AED)
                        </span>
                      )}
                      {event.leadSource && (
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 whitespace-nowrap">
                          Ad: {event.leadSource}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <h3 className="text-lg font-extrabold text-[#192A24] leading-tight">
                        {event.clientName}
                        {event.clientCompany && (
                          <span className="text-xs text-[#5A6F66] font-normal ml-1.5">
                            ({event.clientCompany})
                          </span>
                        )}
                      </h3>
                      <div className="text-xs text-[#5A6F66] flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums">
                        <span>
                          Phone: <strong className="text-[#192A24]">{event.clientPhone}</strong>
                        </span>
                        {event.clientEmail && (
                          <span>
                            Email: <strong className="text-[#192A24]">{event.clientEmail}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Crisp Non-Clipping Payment Status Box */}
                  <div className="shrink-0">
                    {paymentSummary.isBalanceSettled ? (
                      <div className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                        <div className="text-xs leading-tight tabular-nums">
                          <div className="font-extrabold">Full Payment Settled</div>
                          <div className="text-[11px] font-mono text-emerald-700">
                            {paymentSummary.totalPaid.toFixed(2)} / {paymentSummary.totalBill.toFixed(2)} AED
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
                        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                        <div className="text-xs leading-tight tabular-nums">
                          <div className="font-extrabold">
                            Outstanding: {paymentSummary.balanceToPay.toFixed(2)} AED
                          </div>
                          <div className="text-[11px] font-mono text-amber-800">
                            Bill {paymentSummary.totalBill.toFixed(2)} · Paid {paymentSummary.totalPaid.toFixed(2)} AED
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Card Body Grid: Event & Setup Details (8 cols) + Kitchen/Financial Snapshot (4 cols) */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
                  {/* Left Main Details */}
                  <div className="xl:col-span-8 min-w-0 space-y-3">
                    {/* Structured Key Event Facts */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#F8FAF9] border border-[#E2ECE7] rounded-2xl p-3 text-xs">
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-[#5A6F66]">Hall</div>
                        <div className="font-bold text-[#192A24] flex items-center space-x-1 mt-0.5">
                          <Building className="w-3.5 h-3.5 text-[#236B50] shrink-0" />
                          <span className="truncate">{event.hallName}</span>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-[#5A6F66]">Guests &amp; Occasion</div>
                        <div className="font-bold text-[#192A24] flex items-center space-x-1 mt-0.5 tabular-nums">
                          <Users className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                          <span className="truncate">{event.guestCount} Guests · {event.eventType}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-[#5A6F66]">Party Date</div>
                        <div className="font-extrabold text-[#236B50] font-mono tabular-nums mt-0.5">
                          {event.eventDate}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-[#5A6F66]">Booked On</div>
                        <div className="font-semibold text-[#192A24] font-mono tabular-nums mt-0.5">
                          {event.bookingDate}
                        </div>
                      </div>
                    </div>

                    {/* Operational Setup Specs */}
                    <div className="bg-[#F4F8F6] px-3.5 py-2.5 rounded-2xl border border-[#D5E5DE]">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#236B50] mb-1.5">
                        Operational Specs
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-3 gap-y-1.5 text-[11px] text-[#3D5A4E]">
                        <div>
                          <span className="text-[#5A6F66]">Pickup:</span>{' '}
                          <strong className="text-[#192A24]">{event.foodPickupTime || '—'}</strong>
                        </div>
                        <div className="truncate">
                          <span className="text-[#5A6F66]">Venue:</span>{' '}
                          <strong className="text-[#192A24]">{event.venueFloor || event.hallName || '—'}</strong>
                        </div>
                        <div>
                          <span className="text-[#5A6F66]">Projector:</span>{' '}
                          <strong className="text-[#192A24]">
                            {event.projector !== undefined && event.projector !== '' ? String(event.projector) : '—'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#5A6F66]">Decor:</span>{' '}
                          <strong className="text-[#192A24]">
                            {event.decorations !== undefined && event.decorations !== '' ? String(event.decorations) : '—'}
                            {(event.decorations === 'Yes' || event.decorations === true) && event.decorAndAVCharged
                              ? ` (+${event.decorAndAVCharged} AED)`
                              : ''}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#5A6F66]">Stage:</span>{' '}
                          <strong className="text-[#192A24]">{event.stagePosition || '—'}</strong>
                        </div>
                        <div>
                          <span className="text-[#5A6F66]">Buffet:</span>{' '}
                          <strong className="text-[#192A24]">{event.buffetPosition || '—'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Guest Selected Menu & Dishes Forwarded to Chef & Accounts */}
                    {(event.selectedMenuName || (event.selectedFoodItems && event.selectedFoodItems.length > 0)) && (
                      <div className="bg-[#FAFDFB] p-3 rounded-2xl border border-[#D5E5DE] space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <UtensilsCrossed className="w-3.5 h-3.5 text-[#236B50] shrink-0" />
                            <span className="text-xs font-extrabold text-[#192A24]">
                              {event.selectedMenuName || 'Registered Banquet Menu'}
                            </span>
                            <span className="text-[10px] font-bold text-[#236B50] bg-[#E8F5EE] px-2 py-0.5 rounded-md border border-[#C5E5D5] tabular-nums">
                              {event.foodPricePerGuestCharged} AED / Person
                            </span>
                          </div>
                          <span className="text-[10px] text-[#236B50] font-extrabold bg-white px-2 py-0.5 rounded-md border border-[#D5E5DE] tabular-nums">
                            {event.selectedFoodItems?.length || 0} Dishes Selected
                          </span>
                        </div>
                        {event.selectedFoodItems && event.selectedFoodItems.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {event.selectedFoodItems.map((dish, i) => (
                              <span
                                key={i}
                                className="text-[11px] bg-white border border-[#D5E5DE] text-slate-800 font-medium px-2 py-0.5 rounded-md"
                              >
                                {dish}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Chef notes badge if entered */}
                    {event.chefNotes && (
                      <div className="text-xs bg-[#F4F8F6] p-3 rounded-2xl border border-[#D5E5DE] text-[#284B3D] flex items-start space-x-2">
                        <ChefHat className="w-4 h-4 text-[#236B50] shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-[#192A24]">Chef Notes: </strong>
                          <span>{event.chefNotes}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Summary Box: Kitchen Service Spec or Financial Snapshot */}
                  <div className="xl:col-span-4 min-w-0">
                    {currentUser.role === 'executive_chef' || !currentUser.permissions.canViewProfits ? (
                      <div className="bg-[#F8FAF9] p-4 rounded-2xl border border-[#E2ECE7] space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wide text-[#236B50] bg-[#E8F5EE] px-2.5 py-0.5 rounded-md border border-[#C5E5D5]">
                            Kitchen Service Spec
                          </span>
                          <span className="text-xs font-extrabold text-[#192A24] tabular-nums">
                            {event.guestCount} Guests
                          </span>
                        </div>

                        <div className="text-xs">
                          <span className="text-[#5A6F66] text-[11px] block">Buffet / Food Menu</span>
                          <strong className="text-[#192A24] block mt-0.5">
                            {event.hasFoodFromHotel
                              ? (event.buffetTier ? `${event.buffetTier.replace('_', ' ').toUpperCase()} Buffet Package` : 'Hotel Food Included')
                              : 'Hall Only (External Food)'}
                          </strong>
                        </div>

                        <div className="text-xs pt-2 border-t border-[#E2ECE7]">
                          <span className="text-[#5A6F66] text-[11px] block mb-1">Costing Voucher</span>
                          <span className={`inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                            event.costingStatus === 'costed_by_arun'
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                              : event.costingStatus === 'forwarded_to_accounts'
                              ? 'bg-blue-50 text-blue-900 border-blue-200'
                              : 'bg-amber-50 text-amber-900 border-amber-200'
                          }`}>
                            <span>
                              {event.costingStatus === 'costed_by_arun'
                                ? '✓ Final Costed by Accounts'
                                : event.costingStatus === 'forwarded_to_accounts'
                                ? '⏳ Forwarded to Accounts'
                                : '⚠ Pending Chef Kitchen Items'}
                            </span>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#F8FAF9] p-4 rounded-2xl border border-[#E2ECE7]">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#5A6F66] mb-2.5">
                          Financial Snapshot
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs tabular-nums">
                          <div>
                            <div className="text-[#5A6F66] text-[11px]">Client Charged</div>
                            <div className="font-extrabold text-[#192A24] text-sm mt-0.5">
                              {formatCurrency(fin.subtotalRevenue)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[#5A6F66] text-[11px]">Hotel Cost Spent</div>
                            <div className="font-bold text-[#5A6F66] text-sm font-mono mt-0.5">
                              {formatCurrency(fin.totalDirectCosts)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[#5A6F66] text-[11px]">Gross Profit</div>
                            <div className="font-extrabold text-[#236B50] text-sm font-mono mt-0.5">
                              +{formatCurrency(fin.netGrossProfit)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[#5A6F66] text-[11px]">Margin %</div>
                            <div className="font-extrabold text-[#236B50] text-sm font-mono mt-0.5">
                              {formatPercent(fin.overallProfitMarginPercent)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Dedicated Card Footer Action Bar (Role Aware) */}
                <div className="pt-3.5 border-t border-[#EBF2EE] flex flex-wrap items-center justify-between gap-2.5">
                  {currentUser.role === 'accounts_executive' ? (
                    <div className="flex flex-wrap items-center gap-2 w-full">
                      {(event.costingStatus === 'forwarded_to_accounts' || (event.chefApproved && !event.arunCostedAt && event.costingStatus !== 'costed_by_arun')) && event.hasFoodFromHotel && (
                        <button
                          type="button"
                          onClick={() => onOpenChefUsageModal(event)}
                          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-purple-800 hover:bg-purple-900 active:scale-98 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer whitespace-nowrap"
                          title="Perform FIFO Purchasing Costing for this party"
                        >
                          <Calculator className="w-4 h-4 text-amber-300" />
                          <span>Fill Prices &amp; Cost Voucher (FIFO)</span>
                        </button>
                      )}

                      {(event.costingStatus === 'costed_by_arun' || event.postingReportGenerated) && (
                        <button
                          type="button"
                          onClick={() => setSelectedPostingReportBooking(event)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                          title="View / Print Official General Ledger Posting Report"
                        >
                          <FileText className="w-3.5 h-3.5 text-purple-700" />
                          <span>View GL Posting Report</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onOpenA4Sheet(event)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#236B50] text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                        title={!event.partyEnded ? 'View Function Prospectus (Pre-Party FP Sheet PDF)' : 'Read Party BEO Sheet & Internal Costing'}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{!event.partyEnded ? 'FP Sheet (PDF)' : 'Read Party BEO Sheet'}</span>
                      </button>
                    </div>
                  ) : currentUser.role === 'executive_chef' ? (
                    <div className="flex flex-wrap items-center gap-2 w-full">
                      {event.hasFoodFromHotel ? (
                        <button
                          type="button"
                          onClick={() => onOpenChefUsageModal(event)}
                          className={`inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold shadow-xs transition-all cursor-pointer active:scale-98 whitespace-nowrap ${
                            (event.partyEnded && !event.chefApproved) || event.costingStatus === 'party_ended_pending_chef'
                              ? 'bg-orange-600 hover:bg-orange-700 text-white'
                              : 'bg-[#236B50] hover:bg-[#1C5740] text-white'
                          }`}
                          title="Enter kitchen ingredients and amounts used from stocks for this party"
                        >
                          <ChefHat className="w-4 h-4" />
                          <span>
                            {event.costingStatus === 'costed_by_arun'
                              ? '✓ Finished by Accounts'
                              : event.costingStatus === 'forwarded_to_accounts'
                              ? '⏳ Stamped in Accounts FIFO Queue'
                              : ((event.partyEnded && !event.chefApproved) || event.costingStatus === 'party_ended_pending_chef'
                                ? 'Party Ended — Enter Ingredients'
                                : 'Enter Kitchen Ingredients & Stamp')}
                          </span>
                        </button>
                      ) : (
                        <span className="text-xs text-[#5A6F66] italic py-1.5 px-2.5 bg-slate-50 rounded-xl border border-slate-200">
                          No Hotel Food
                        </span>
                      )}

                      {(event.costingStatus === 'costed_by_arun' || event.postingReportGenerated) && (
                        <button
                          type="button"
                          onClick={() => setSelectedPostingReportBooking(event)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                          title="View Finished General Ledger Posting Report"
                        >
                          <FileText className="w-3.5 h-3.5 text-purple-700" />
                          <span>Posting Report</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onOpenA4Sheet(event, !event.partyEnded ? 3 : undefined)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#236B50] text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                        title={!event.partyEnded ? 'View Official Kitchen Function Prospectus (FP Sheet)' : 'View Official 2-Page Kitchen Banquet Order'}
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>{!event.partyEnded ? 'Kitchen FP Sheet' : '2-Page Kitchen Sheet'}</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Primary Document & Settlement Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        {!paymentSummary.isBalanceSettled ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onOpenA4Sheet(event, 3)}
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 text-xs font-extrabold transition-all shadow-xs cursor-pointer whitespace-nowrap"
                              title="Download or Print the Official Function Prospectus (Pre-Party FP Sheet PDF)"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                              <span>FP Sheet (Pre-Party)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSettleModalBooking(event)}
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer whitespace-nowrap"
                              title={`BEO is locked until ${formatCurrency(paymentSummary.balanceToPay)} remaining balance is settled`}
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Settle Balance ({formatCurrency(paymentSummary.balanceToPay)}) &amp; Unlock BEO</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onOpenA4Sheet(event)}
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
                              title="100% Balance Settled. Download or Print Official BEO Summary & Costing Sheet (PDF)"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>{currentUser.permissions.canViewCosting ? '✓ BEO & Costing Sheet (Paid)' : '✓ Official BEO Sheet (Paid)'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenA4Sheet(event, 3)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                              title="Download Function Prospectus (Pre-Party FP Sheet)"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                              <span>FP Sheet</span>
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedAdvanceVoucherBooking(event)}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                          title="Generate separate Advance Booking Confirmation & Payment Voucher PDF"
                        >
                          <Receipt className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Advance Voucher</span>
                        </button>

                        {(currentUser.permissions.canViewProfits || currentUser.permissions.canViewCosting) &&
                          (event.costingStatus === 'costed_by_arun' || event.postingReportGenerated) && (
                          <button
                            type="button"
                            onClick={() => setSelectedPostingReportBooking(event)}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                            title="View Official GL Posting Report"
                          >
                            <FileText className="w-3.5 h-3.5 text-purple-700" />
                            <span>Posting Report</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setPaymentModalBooking(event)}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold transition-all cursor-pointer whitespace-nowrap tabular-nums"
                          title="Record and view individual advance and balance payments with receipts"
                        >
                          <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Payments ({formatCurrency(event.depositPaid || 0)})</span>
                        </button>

                        {event.hasFoodFromHotel && (
                          <button
                            type="button"
                            onClick={() => onOpenChefUsageModal(event)}
                            className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                              event.costingStatus === 'costed_by_arun'
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                : event.costingStatus === 'forwarded_to_accounts'
                                ? 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                            }`}
                            title="Chef Kitchen Items Log & Accounts Costing (Excel & OCR)"
                          >
                            <ChefHat className="w-3.5 h-3.5" />
                            <span>
                              {event.costingStatus === 'costed_by_arun'
                                ? 'Costed (Accounts ✓)'
                                : event.costingStatus === 'forwarded_to_accounts'
                                ? 'In Accounts'
                                : 'Food Costing'}
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Secondary Status, Lock & Edit/Cancel Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        {event.lockDetails?.isLocked && (
                          <div className="flex items-center space-x-1.5">
                            <span
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-[11px] font-bold border border-slate-200 inline-flex items-center space-x-1 whitespace-nowrap"
                              title="Locked after finish. Revisions require GM approval."
                            >
                              <Lock className="w-3 h-3 text-slate-600" />
                              <span>Locked</span>
                            </span>
                            {currentUser.role === 'general_manager' && event.lockDetails.unlockRequested && (
                              <button
                                type="button"
                                onClick={() => handleApproveUnlock(event)}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold shadow-xs cursor-pointer whitespace-nowrap"
                                title={`Approve unlock request: "${event.lockDetails.unlockRequestReason}"`}
                              >
                                Approve Unlock
                              </button>
                            )}
                            {currentUser.role !== 'general_manager' && !event.lockDetails.unlockRequested && (
                              <button
                                type="button"
                                onClick={() => setUnlockModalBooking(event)}
                                className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-bold cursor-pointer whitespace-nowrap"
                                title="Request General Manager approval to unlock and edit"
                              >
                                Request Unlock
                              </button>
                            )}
                            {event.lockDetails.unlockRequested && currentUser.role !== 'general_manager' && (
                              <span className="px-2.5 py-1.5 rounded-xl bg-amber-100 text-amber-900 text-[11px] font-bold whitespace-nowrap">
                                ⏳ Unlock Pending GM
                              </span>
                            )}
                          </div>
                        )}

                        {!event.partyEnded ? (
                          paymentSummary.isBalanceSettled ? (
                            <button
                              type="button"
                              onClick={() => {
                                const fp = getFunctionProspectusFinancials(event);
                                const updated: BookingEvent = {
                                  ...event,
                                  fpPrePartyTotalBill: event.fpPrePartyTotalBill ?? fp.fpTotalBill,
                                  fpPrePartyAdvancePaid: event.fpPrePartyAdvancePaid ?? fp.fpAdvancePaid,
                                  fpPrePartyAdvanceMode: event.fpPrePartyAdvanceMode ?? (fp.fpAdvanceMode || undefined),
                                  status: 'completed',
                                  partyEnded: true,
                                  partyEndedAt: new Date().toISOString(),
                                  partyEndedConfirmedBy: currentUser.name,
                                  costingStatus: event.hasFoodFromHotel
                                    ? 'party_ended_pending_chef'
                                    : (event.costingStatus === 'not_started' ? 'party_ended_pending_chef' : event.costingStatus),
                                };
                                onUpdateBooking(updated);
                              }}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-98 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer whitespace-nowrap"
                              title="F&B Supervisor confirms party has concluded in full — immediately notifies Executive Chef on their dashboard to log ingredients used"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-orange-200" />
                              <span>Confirm Party Ended</span>
                            </button>
                          ) : null
                        ) : (
                          <span
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold whitespace-nowrap"
                            title={`Party confirmed ended by ${partyEndedLabel}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Party Ended ({partyEndedLabel})</span>
                          </span>
                        )}

                        {currentUser.role === 'general_manager' && (
                          <span className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-bold border border-slate-200 whitespace-nowrap">
                            View Only
                          </span>
                        )}

                        {currentUser.permissions.canManageBookings && !event.lockDetails?.isLocked && (
                          <button
                            type="button"
                            onClick={() => openEditModal(event)}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#236B50] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                            title="Edit booking dates, guests, offer, or chef notes"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}

                        {event.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => setCancelModalBooking(event)}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                            title="Cancel banquet booking (opens mandatory reason prompt and frees the date)"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Cancel</span>
                          </button>
                        )}

                        {currentUser.permissions.canManageBookings && (
                          <button
                            type="button"
                            onClick={() => setDeletingBookingId(event.id)}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                            title="Delete this booking"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      )}

      {/* =========================================================================
          PARTY DETAILS MODAL (OPENED WHEN TOUCHING A PARTY IN AVAILABILITY / LIST)
          ========================================================================= */}
      {selectedPartyForDetails && (() => {
        const party = selectedPartyForDetails;
        const summary = getBookingPaymentSummary(party);
        const outstanding = summary.balanceToPay;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl border border-[#D5E5DE] space-y-5 p-6">
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-[#E2ECE7]">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-[#236B50] bg-[#E8F5EE] px-2.5 py-0.5 rounded-full border border-[#C5E5D5]">
                      {party.bookingNumber}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
                      {party.branch}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                      {party.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-[#192A24] font-['Plus_Jakarta_Sans'] mt-1">
                    {party.clientName}
                  </h3>
                  {party.clientCompany && (
                    <p className="text-xs text-[#5A6F66]">{party.clientCompany}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPartyForDetails(null)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Event Date & Venue Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-[#F6FAF8] border border-[#D5E5DE]">
                  <span className="text-[10px] font-bold text-[#5A6F66] uppercase block">Event Date</span>
                  <span className="text-sm font-extrabold text-[#236B50] font-mono mt-0.5 block">{party.eventDate}</span>
                </div>
                <div className="p-3 rounded-2xl bg-[#F6FAF8] border border-[#D5E5DE]">
                  <span className="text-[10px] font-bold text-[#5A6F66] uppercase block">Time Slot</span>
                  <span className="text-xs font-extrabold text-[#192A24] capitalize mt-0.5 block">{party.eventTimeSpan || party.timeSlot}</span>
                </div>
                <div className="p-3 rounded-2xl bg-[#F6FAF8] border border-[#D5E5DE]">
                  <span className="text-[10px] font-bold text-[#5A6F66] uppercase block">Guests</span>
                  <span className="text-sm font-extrabold text-blue-900 mt-0.5 block">{party.guestCount} Headcount</span>
                </div>
                <div className="p-3 rounded-2xl bg-[#F6FAF8] border border-[#D5E5DE]">
                  <span className="text-[10px] font-bold text-[#5A6F66] uppercase block">Banquet Hall</span>
                  <span className="text-xs font-extrabold text-[#192A24] truncate mt-0.5 block">{party.venueFloor || party.hallName || '—'}</span>
                </div>
              </div>

              {/* Client Contacts */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Client Contact Details</span>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-800">
                  <span>Phone: <strong className="text-slate-950 font-bold">{party.clientPhone}</strong></span>
                  {party.clientEmail && (
                    <span>Email: <strong className="text-slate-950 font-bold">{party.clientEmail}</strong></span>
                  )}
                  {party.leadSource && (
                    <span>Source: <strong className="text-slate-950 font-bold">{party.leadSource}</strong></span>
                  )}
                </div>
              </div>

              {/* Menu & Food Items Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#192A24] flex items-center space-x-1.5">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-[#236B50]" />
                    <span>Food Menu: {party.selectedMenuName || (party.hasFoodFromHotel ? 'Custom Selection' : 'Hall Only')}</span>
                  </span>
                  <span className="text-xs font-bold text-[#236B50] font-mono">
                    {party.hasFoodFromHotel ? `${party.foodPricePerGuestCharged} AED / Person` : 'No Hotel Food'}
                  </span>
                </div>

                {party.selectedFoodItems && party.selectedFoodItems.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-[#FAFDFB] border border-[#D5E5DE] max-h-36 overflow-y-auto">
                    {party.selectedFoodItems.map((dish, i) => (
                      <span
                        key={i}
                        className="text-[11px] bg-white border border-[#D5E5DE] text-slate-800 font-semibold px-2.5 py-1 rounded-xl shadow-2xs"
                      >
                        • {dish}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    No food dishes logged on this booking.
                  </div>
                )}
              </div>

              {/* Operational Setup Specs */}
              <div className="p-3.5 rounded-2xl bg-[#F6FAF8] border border-[#D5E5DE] text-xs space-y-1.5">
                <span className="text-[11px] font-bold text-[#236B50] uppercase tracking-wider block">Operational Banquet Specifications</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-800">
                  <div>Pickup: <strong>{party.foodPickupTime || '—'}</strong></div>
                  <div>Floor: <strong>{party.venueFloor || party.hallName || '—'}</strong></div>
                  <div>Sound: <strong>{party.soundSystem !== undefined && party.soundSystem !== '' ? String(party.soundSystem) : '—'}</strong></div>
                  <div>Projector: <strong>{party.projector !== undefined && party.projector !== '' ? String(party.projector) : '—'}</strong></div>
                  <div>Decor: <strong>{party.decorations !== undefined && party.decorations !== '' ? String(party.decorations) : '—'}</strong></div>
                  <div>Table Cloth: <strong>{party.tableClothColor || '—'}</strong></div>
                  <div>Seating: <strong>{party.seatingStyle || '—'}</strong></div>
                  <div>Stage: <strong>{party.stagePosition || '—'}</strong></div>
                  <div>Buffet: <strong>{party.buffetPosition || '—'}</strong></div>
                </div>
              </div>

              {/* Financial Snapshot */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Bill</span>
                  <span className="text-lg font-extrabold">{summary.totalBill.toFixed(2)} AED</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Advance Paid</span>
                  <span className="text-lg font-extrabold text-emerald-400">{summary.totalPaid.toFixed(2)} AED</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Balance to Pay</span>
                  <span className={`text-lg font-extrabold ${outstanding > 0.01 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {outstanding.toFixed(2)} AED {outstanding <= 0.01 && '✓ Settled'}
                  </span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#E2ECE7]">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenA4Sheet(party);
                      setSelectedPartyForDetails(null);
                    }}
                    className="px-4 py-2 rounded-full bg-[#236B50] hover:bg-[#1C5740] text-white text-xs font-black shadow-md transition-all cursor-pointer flex items-center space-x-1.5"
                  >
                    <FileText className="w-4 h-4" />
                    <span>View FP / BEO Sheet (PDF)</span>
                  </button>

                  {outstanding > 0 && !party.finalPaymentConfirmed && (
                    <button
                      type="button"
                      onClick={() => {
                        setSettleModalBooking(party);
                        setSelectedPartyForDetails(null);
                      }}
                      className="px-3.5 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-xs transition-all cursor-pointer"
                    >
                      Settle Balance ({outstanding.toFixed(0)} AED)
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {party.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() => {
                        setCancelModalBooking(party);
                      }}
                      className="px-3 py-2 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer border border-rose-200"
                    >
                      Cancel Party
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedPartyForDetails(null)}
                    className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          CANCELLATION REASON MODAL
          "and if the party canceled it should give a reason for cancelation and logged into canceled party"
          ========================================================================= */}
      {cancelModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-rose-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 font-['Plus_Jakarta_Sans']">
                    Cancel Banquet Party Booking
                  </h3>
                  <p className="text-xs text-rose-700 font-medium">
                    Party: <strong>{cancelModalBooking.clientName}</strong> ({cancelModalBooking.eventDate})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
              <strong>Calendar Availability Note:</strong>
              <p>
                Cancelling this party will record your reason into the <strong>Cancelled Parties Log</strong>, and immediately free up the date (<strong>{cancelModalBooking.eventDate}</strong>) on the calendar for new bookings.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  Reason for Cancellation <span className="text-rose-600">*</span>
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-rose-500"
                >
                  <option value="Client Requested Date Rescheduling">Client Requested Date Rescheduling</option>
                  <option value="Client Budget / Price Reconsideration">Client Budget / Price Reconsideration</option>
                  <option value="Client Personal or Family Emergency">Client Personal or Family Emergency</option>
                  <option value="Client Selected Alternate Venue">Client Selected Alternate Venue</option>
                  <option value="Guest Headcount Below Hall Minimum">Guest Headcount Below Hall Minimum</option>
                  <option value="Client Unreachable / No-Show">Client Unreachable / No-Show</option>
                  <option value="Other Reason">Other Reason (Specify Below)</option>
                </select>
              </div>

              {/* Cancellation Policy: Advance Handling */}
              <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-rose-950 uppercase tracking-wide">Advance Payment Policy</span>
                  <span className="text-xs font-mono font-bold text-rose-800">
                    Advance Paid: {formatCurrency(cancelModalBooking.depositPaid || 0)}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <label className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold cursor-pointer text-center transition-all ${
                    cancelAdvanceAction === 'forfeited' 
                      ? 'bg-rose-600 text-white border-rose-700 shadow-xs' 
                      : 'bg-white text-slate-800 border-rose-200 hover:bg-rose-100/50'
                  }`}>
                    <input
                      type="radio"
                      name="advanceAction"
                      value="forfeited"
                      checked={cancelAdvanceAction === 'forfeited'}
                      onChange={() => {
                        setCancelAdvanceAction('forfeited');
                        setCancelRefundAmount(0);
                      }}
                      className="sr-only"
                    />
                    <span>Forfeited</span>
                    <span className="text-[10px] opacity-80 font-normal">No Refund</span>
                  </label>

                  <label className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold cursor-pointer text-center transition-all ${
                    cancelAdvanceAction === 'partly_refunded' 
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs' 
                      : 'bg-white text-slate-800 border-amber-200 hover:bg-amber-50'
                  }`}>
                    <input
                      type="radio"
                      name="advanceAction"
                      value="partly_refunded"
                      checked={cancelAdvanceAction === 'partly_refunded'}
                      onChange={() => {
                        setCancelAdvanceAction('partly_refunded');
                        setCancelRefundAmount(Math.round((cancelModalBooking.depositPaid || 0) * 0.5));
                      }}
                      className="sr-only"
                    />
                    <span>Partial</span>
                    <span className="text-[10px] opacity-80 font-normal">Part Refund</span>
                  </label>

                  <label className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold cursor-pointer text-center transition-all ${
                    cancelAdvanceAction === 'refunded' 
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs' 
                      : 'bg-white text-slate-800 border-emerald-200 hover:bg-emerald-50'
                  }`}>
                    <input
                      type="radio"
                      name="advanceAction"
                      value="refunded"
                      checked={cancelAdvanceAction === 'refunded'}
                      onChange={() => {
                        setCancelAdvanceAction('refunded');
                        setCancelRefundAmount(cancelModalBooking.depositPaid || 0);
                      }}
                      className="sr-only"
                    />
                    <span>Full Refund</span>
                    <span className="text-[10px] opacity-80 font-normal">100% Return</span>
                  </label>
                </div>

                {cancelAdvanceAction !== 'forfeited' && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Refund Amount (AED)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={cancelModalBooking.depositPaid || 10000}
                        value={cancelRefundAmount}
                        onChange={(e) => setCancelRefundAmount(parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-rose-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Refund Payment Mode
                      </label>
                      <select
                        value={cancelRefundMode}
                        onChange={(e) => setCancelRefundMode(e.target.value as any)}
                        className="w-full bg-white border border-rose-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-500"
                      >
                        <option value="Cash">Cash Return</option>
                        <option value="Card">Card Refund</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  Additional Notes / Client Feedback (Optional)
                </label>
                <textarea
                  rows={2}
                  value={cancelNotes}
                  onChange={(e) => setCancelNotes(e.target.value)}
                  placeholder="Provide any specific context, requested reschedule date, or client comments..."
                  className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-2xl p-3 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-bold transition-colors cursor-pointer"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleConfirmCancellation}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-bold transition-all shadow-md cursor-pointer flex items-center space-x-1.5"
              >
                <Ban className="w-4 h-4" />
                <span>Confirm Cancellation & Free Date</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PAYMENT TRACKING MODAL (High Priority: Individual Advance & Balance Records)
          ========================================================================= */}
      {paymentModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 shadow-2xl border border-emerald-200 space-y-5">
            <div className="flex items-start justify-between pb-3 border-b border-emerald-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 font-['Plus_Jakarta_Sans']">
                    Payment Tracking & Receipts
                  </h3>
                  <p className="text-xs text-emerald-800 font-medium">
                    Party: <strong>{paymentModalBooking.clientName}</strong> ({paymentModalBooking.bookingNumber}) • Event Date: {paymentModalBooking.eventDate}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalBooking(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Summary Cards */}
            {(() => {
              const pSummary = getBookingPaymentSummary(paymentModalBooking);
              return (
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Total Bill</span>
                    <div className="text-lg font-black font-mono text-slate-950 mt-0.5">
                      {formatCurrency(pSummary.totalBill)}
                    </div>
                  </div>
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                    <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Total Paid</span>
                    <div className="text-lg font-black font-mono text-emerald-900 mt-0.5">
                      {formatCurrency(pSummary.totalPaid)}
                    </div>
                  </div>
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-center">
                    <span className="text-[10px] font-black uppercase text-rose-800 tracking-wider">Balance to Pay</span>
                    <div className="text-lg font-black font-mono text-rose-900 mt-0.5">
                      {formatCurrency(pSummary.balanceToPay)}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Record New Payment Form */}
            {currentUser.role !== 'general_manager' ? (
              <div className="bg-[#F4F9F6] border border-[#CDE5DA] p-4 rounded-2xl space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#192A24] flex items-center space-x-1.5">
                  <PlusCircle className="w-4 h-4 text-[#236B50]" />
                  <span>Record New Payment Entry</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Amount (AED) *
                    </label>
                    <input
                      type="number"
                      step="50"
                      min="1"
                      placeholder="e.g. 1500"
                      value={newPaymentAmount}
                      onChange={(e) => setNewPaymentAmount(e.target.value)}
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:outline-none focus:border-[#236B50]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Payment Type *
                    </label>
                    <select
                      value={newPaymentType}
                      onChange={(e) => setNewPaymentType(e.target.value as any)}
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:border-[#236B50]"
                    >
                      <option value="advance">Advance Deposit</option>
                      <option value="balance">Balance Settlement</option>
                      <option value="additional">Additional / Add-on</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Payment Mode *
                    </label>
                    <select
                      value={newPaymentMode}
                      onChange={(e) => setNewPaymentMode(e.target.value as any)}
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:border-[#236B50]"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Card">Credit / Debit Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Online">Online Link / POS</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Optional notes, transaction reference number, or payer info..."
                    value={newPaymentNotes}
                    onChange={(e) => setNewPaymentNotes(e.target.value)}
                    className="flex-1 bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#236B50]"
                  />
                  <button
                    type="button"
                    onClick={handleAddPaymentRecord}
                    className="px-4 py-2 bg-[#236B50] hover:bg-[#1C5740] text-white text-xs font-black rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
                  >
                    + Record Payment
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-slate-100 text-xs text-slate-600 font-semibold text-center">
                👁️ View Only Mode (General Manager) — Payment recording is handled by Supervisor Francis and Accounts.
              </div>
            )}

            {/* List of Payments Recorded */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center justify-between">
                <span>Payment History & Receipts</span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {(paymentModalBooking.payments || []).length} payment(s) logged
                </span>
              </h4>

              {(!paymentModalBooking.payments || paymentModalBooking.payments.length === 0) ? (
                <div className="text-center py-6 border border-dashed border-slate-300 rounded-2xl text-slate-500 text-xs">
                  No payment records logged yet. Enter an advance deposit above.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs">
                  {paymentModalBooking.payments.map((p, idx) => (
                    <div key={p.id || idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-black text-slate-900 text-sm">
                            {formatCurrency(p.amount)}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
                            {p.paymentType}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {p.paymentMode}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Date: <span className="font-mono font-bold text-slate-700">{p.date}</span> • Received by: <span className="font-semibold text-slate-800">{p.receivedBy}</span>
                          {p.notes && <span className="ml-1 text-slate-600 italic">({p.notes})</span>}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="font-mono text-[11px] font-black text-[#236B50] bg-[#EBF3EF] px-2.5 py-1 rounded-lg border border-[#D5E5DE]">
                          Receipt #{p.receiptNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            window.print();
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          title="Print Receipt"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPaymentModalBooking(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-full text-xs font-bold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          RECORD UNLOCK REQUEST MODAL (High Priority: Booking Lock After Finish)
          ========================================================================= */}
      {unlockModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-amber-200 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-amber-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 font-['Plus_Jakarta_Sans']">
                    Request Record Unlock
                  </h3>
                  <p className="text-xs text-amber-800 font-medium">
                    Party: <strong>{unlockModalBooking.bookingNumber}</strong> ({unlockModalBooking.clientName})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUnlockModalBooking(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This banquet record was locked after {unlockModalBooking.lockDetails?.lockStage === 'chef_finished' ? 'Chef Karim finished kitchen ingredient entries' : 'Accounts finalized purchase costing'}. In order to modify this record, a justification reason must be submitted for General Manager review.
            </p>

            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1">
                Reason / Justification for Revision *
              </label>
              <textarea
                rows={3}
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="Explain the required modification (e.g. guest headcount changed, client requested extra dish, price adjustment)..."
                className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-2xl p-3 text-xs text-slate-900 focus:outline-none focus:border-amber-600 font-medium"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setUnlockModalBooking(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestUnlockSubmit}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-full text-xs font-bold transition-all shadow-md cursor-pointer flex items-center space-x-1.5"
              >
                <span>Submit Request to GM</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-[#D5E5DE]">
            <h3 className="text-base font-extrabold text-[#192A24]">Delete Banquet Booking?</h3>
            <p className="text-xs text-[#5A6F66] mt-2 leading-relaxed">
              Are you sure you want to delete this booking? All associated menu costing and invoicing records will be permanently removed.
            </p>
            <div className="flex justify-end space-x-2 pt-4 mt-3 border-t border-[#E2ECE7]">
              <button
                onClick={() => setDeletingBookingId(null)}
                className="px-4 py-2 bg-[#EBF3EF] text-[#284B3D] rounded-full text-xs font-bold hover:bg-[#DEEBE5] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(deletingBookingId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-full text-xs font-bold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Booking Modal */}
      {bookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[94vh] overflow-y-auto shadow-2xl border border-[#D5E5DE]">
            <div className="sticky top-0 z-10 px-6 py-4 bg-[#F6FAF8] border-b border-[#E2ECE7] flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-[#192A24] text-lg">
                  {editingBooking ? 'Edit Banquet Booking & Costing' : 'Register Banquet Party & Costing Agreement'}
                </h3>
                <p className="text-xs text-[#5A6F66]">
                  Select branch (CPH1 / CPH2), hall offer (Free with Food, 1,500 Full, 1,000 One-Side), and chef notes
                </p>
              </div>
              <button
                onClick={() => setBookingModalOpen(false)}
                className="text-[#5A6F66] hover:text-[#192A24] p-1.5 rounded-full hover:bg-[#EBF3EF] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-6">
              
              {/* Branch Selection & Hall Venue */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#F6FAF8] rounded-2xl border border-[#E2ECE7]">
                <div>
                  <label className="block text-xs font-bold text-[#192A24] mb-1.5">Hotel Branch *</label>
                  <select
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value as HotelBranch)}
                    className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] font-semibold focus:outline-none focus:border-[#236B50]"
                  >
                    <option value="CPH1">CPH1</option>
                    <option value="CPH2">CPH2</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#192A24] mb-1.5">Banquet Hall *</label>
                  <select
                    value={formHallId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setFormHallId(nextId);
                      const chosen = halls.find(h => h.id === nextId);
                      if (chosen) {
                        setFormVenueFloor(chosen.name);
                      }
                    }}
                    className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] font-semibold focus:outline-none focus:border-[#236B50]"
                  >
                    {halls.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.name} (Up to {h.capacityMax} Guests)
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-[#5A6F66] mt-1 block">2 active halls: First Floor Big Hall &amp; Suite room Hall</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#192A24] mb-1.5">Venue / Hall Floor</label>
                  <input
                    type="text"
                    list="cph-venue-suggestions"
                    value={formVenueFloor}
                    onChange={(e) => setFormVenueFloor(e.target.value)}
                    placeholder="e.g. First Floor Big Hall"
                    className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] font-semibold focus:outline-none focus:border-[#236B50]"
                  />
                  <datalist id="cph-venue-suggestions">
                    {halls.map(h => (
                      <option key={h.id} value={h.name} />
                    ))}
                  </datalist>
                  <span className="text-[10px] text-[#5A6F66] mt-1 block">Printed directly as VENUE on the Function Prospectus</span>
                </div>
              </div>

              {/* Hall Offer Selection (3 Specific Offers from user brief) */}
              <div>
                <label className="block text-xs font-bold text-[#192A24] mb-2 flex items-center space-x-1.5">
                  <Tag className="w-4 h-4 text-[#236B50]" />
                  <span>Banquet Hall Booking Offer Type *</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Offer 1: Free with Food */}
                  <div
                    onClick={() => handleOfferChange('free_with_food')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      formHallOffer === 'free_with_food'
                        ? 'bg-[#EBF5F0] border-[#236B50] ring-2 ring-[#236B50] shadow-sm'
                        : 'bg-white border-[#E2ECE7] hover:bg-[#F6FAF8]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-[#192A24]">Offer 1: Free Hall with Food</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#236B50] text-white">0 AED Hall</span>
                    </div>
                    <p className="text-[11px] text-[#5A6F66] leading-relaxed">
                      Banquet hall rental is FREE when food/buffet is booked from the hotel.
                    </p>
                  </div>

                  {/* Offer 2: Full Hall without food */}
                  <div
                    onClick={() => handleOfferChange('hall_only_full')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      formHallOffer === 'hall_only_full'
                        ? 'bg-[#EBF5F0] border-[#236B50] ring-2 ring-[#236B50] shadow-sm'
                        : 'bg-white border-[#E2ECE7] hover:bg-[#F6FAF8]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-[#192A24]">Offer 2: Full Hall Only</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">Starts 1,500 AED</span>
                    </div>
                    <p className="text-[11px] text-[#5A6F66] leading-relaxed">
                      Without hotel food: starts from at least 1,500 AED for full banquet hall.
                    </p>
                  </div>

                  {/* Offer 3: One Side Partition */}
                  <div
                    onClick={() => handleOfferChange('one_side_hall')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      formHallOffer === 'one_side_hall'
                        ? 'bg-[#EBF5F0] border-[#236B50] ring-2 ring-[#236B50] shadow-sm'
                        : 'bg-white border-[#E2ECE7] hover:bg-[#F6FAF8]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-[#192A24]">Offer 3: One-Side Hall</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900">Starts 1,000 AED</span>
                    </div>
                    <p className="text-[11px] text-[#5A6F66] leading-relaxed">
                      Left side of the hall partition provided for 1,000 AED.
                    </p>
                  </div>
                </div>
              </div>

              {/* Client Information */}
              <div>
                <h4 className="text-xs font-bold text-[#192A24] uppercase tracking-wider mb-3">Client Contact Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#192A24] mb-1">Client Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mr. Betsy"
                      value={formClientName}
                      onChange={(e) => setFormClientName(e.target.value)}
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#192A24] mb-1">Client Phone *</label>
                    <input
                      type="text"
                      required
                      placeholder="+971 50 123 4567"
                      value={formClientPhone}
                      onChange={(e) => setFormClientPhone(e.target.value)}
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#192A24] mb-1">
                      Email <span className="text-[#5A6F66] font-normal">(Optional)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="client@example.com (optional)"
                      value={formClientEmail}
                      onChange={(e) => setFormClientEmail(e.target.value)}
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#192A24] mb-1">Company / Organization</label>
                    <input
                      type="text"
                      placeholder="Optional company"
                      value={formClientCompany}
                      onChange={(e) => setFormClientCompany(e.target.value)}
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#192A24] mb-1">Lead / Ad Source Channel *</label>
                    <select
                      value={formLeadSource}
                      onChange={(e) => setFormLeadSource(e.target.value)}
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] font-semibold focus:outline-none focus:border-[#236B50]"
                    >
                      <option value="Instagram Ad Campaign">Instagram Ad Campaign</option>
                      <option value="Facebook Sponsored Ad">Facebook Sponsored Ad</option>
                      <option value="Google Search Ads">Google Search Ads</option>
                      <option value="TikTok Video Lead">TikTok Video Lead</option>
                      <option value="Walk-in Guest Inquiry">Walk-in Guest Inquiry</option>
                      <option value="Direct Call to Francis">Direct Call to Francis (F&B)</option>
                      <option value="WhatsApp Business Chat">WhatsApp Business Chat</option>
                      <option value="Returning Client Referral">Returning Client Referral</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Dates, Function Type & Event Specs */}
              <div>
                <h4 className="text-xs font-bold text-[#192A24] uppercase tracking-wider mb-3">Event Schedule & Guest Count</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#192A24] mb-1">Booking Registration Date *</label>
                    <input
                      type="date"
                      required
                      value={formBookingDate}
                      onChange={(e) => setFormBookingDate(e.target.value)}
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#192A24] mb-1">Party / Celebration Date *</label>
                    <input
                      type="date"
                      required
                      value={formEventDate}
                      onChange={(e) => setFormEventDate(e.target.value)}
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#192A24] mb-1">Function Type *</label>
                    <input
                      type="text"
                      required
                      list="cph-event-types"
                      placeholder="e.g. Birthday Party, Wedding, Get-Together"
                      value={formEventType}
                      onChange={(e) => setFormEventType(e.target.value)}
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                    />
                    <datalist id="cph-event-types">
                      <option value="Birthday Party" />
                      <option value="Get-Together Party" />
                      <option value="Wedding Reception" />
                      <option value="Engagement Ceremony" />
                      <option value="Anniversary Celebration" />
                      <option value="Corporate Conference / Gala" />
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#192A24] mb-1">Time Slot *</label>
                    <select
                      value={formTimeSlot}
                      onChange={(e) => setFormTimeSlot(e.target.value as TimeSlot)}
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                    >
                      <option value="morning">Morning (10:00 AM - 3:00 PM)</option>
                      <option value="evening">Evening (6:00 PM - 12:00 AM)</option>
                      <option value="full_day">Full Day (9:00 AM - Midnight)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#192A24] mb-1">Exact Event Timing (Prospectus)</label>
                    <input
                      type="text"
                      placeholder="e.g. 6:00 PM - 12:00 AM"
                      value={formEventTimeSpan}
                      onChange={(e) => setFormEventTimeSpan(e.target.value)}
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#192A24] mb-1">
                      Total Guest Count * <span className="text-[#236B50] font-bold">(Min 30 • Max {selectedHall?.capacityMax || 350})</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={selectedHall?.capacityMax || 350}
                      value={formGuestCount}
                      onChange={(e) => setFormGuestCount(parseInt(e.target.value, 10) || 0)}
                      className={`w-full bg-white border rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none ${
                        !isMaxHallCapacityValid
                          ? 'border-rose-400 focus:border-rose-600'
                          : 'border-[#D5E5DE] focus:border-[#236B50]'
                      }`}
                    />
                    {!isMinGuestsValid && (
                      <span className="text-[10px] text-amber-700 font-bold mt-1 block">
                        Note: Policy is minimum 30 guests for party celebrations.
                      </span>
                    )}
                    {!isMaxHallCapacityValid && selectedHall && (
                      <span className="text-[10px] text-rose-700 font-bold mt-1 block">
                        Exceeds {selectedHall.name} capacity (max {selectedHall.capacityMax} guests).
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#192A24] mb-1">Adults Count (Optional)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="Leave blank to use Total Guest Count"
                      value={formAdultsCount}
                      onChange={(e) => setFormAdultsCount(e.target.value)}
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#192A24] mb-1">Kids Count (Optional)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="e.g. 0"
                      value={formKidsCount}
                      onChange={(e) => setFormKidsCount(e.target.value)}
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                    />
                    {!isGuestSplitValid && (
                      <span className="text-[10px] text-rose-700 font-bold mt-1 block">
                        Adults + Kids exceeds Total Guest Count ({formGuestCount}).
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Operational Setup & Function Prospectus (Entered by Francis) */}
              <div className="p-4 bg-[#F8FAF9] rounded-2xl border-2 border-[#C5E5D5] space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#D5E5DE]">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-lg bg-[#236B50] text-white flex items-center justify-center font-black text-xs">
                      FP
                    </div>
                    <h4 className="text-xs font-black text-[#192A24] uppercase tracking-wider">
                      Operational Setup & Function Prospectus Details (Entered by Francis)
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-[#236B50] bg-[#E8F5EE] px-2 py-0.5 rounded-full border border-[#C5E5D5]">
                    Printed Verbatim on Function Prospectus
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {/* 1. Food Pickup Time Field */}
                  <div>
                    <label className="block text-xs font-bold text-[#192A24] mb-1">
                      Food Pickup Time
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formFoodPickupTime}
                        onChange={(e) => setFormFoodPickupTime(e.target.value)}
                        placeholder="e.g. 8:00 PM"
                        className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs font-bold text-[#192A24] focus:outline-none focus:border-[#236B50]"
                      />
                      <Clock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* 2. Sound System */}
                  <div>
                    <label className="block text-xs font-bold text-[#192A24] mb-1">
                      Sound System
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['Yes', 'No'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setFormSoundSystem(prev => prev === opt ? '' : opt)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            formSoundSystem === opt
                              ? 'bg-[#236B50] text-white border-[#236B50] shadow-xs'
                              : 'bg-white text-slate-700 border-[#D5E5DE] hover:bg-slate-50'
                          }`}
                        >
                          {opt === 'Yes' ? '✓ Yes' : '✕ No'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Projector Check Button: Yes, No */}
                  <div>
                    <label className="block text-xs font-bold text-[#192A24] mb-1">
                      Projector Requirement
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['Yes', 'No'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setFormProjector(prev => prev === opt ? '' : opt)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            formProjector === opt
                              ? 'bg-[#236B50] text-white border-[#236B50] shadow-xs'
                              : 'bg-white text-slate-700 border-[#D5E5DE] hover:bg-slate-50'
                          }`}
                        >
                          {opt === 'Yes' ? '✓ Yes' : '✕ No'}
                        </button>
                      ))}
                    </div>
                    {formProjector === 'Yes' && (
                      <input
                        type="text"
                        value={formProjectorNotes}
                        onChange={(e) => setFormProjectorNotes(e.target.value)}
                        placeholder="Optional projector note (e.g. Bring own laptop)"
                        className="mt-1.5 w-full bg-white border border-[#D5E5DE] rounded-lg px-2.5 py-1.5 text-[11px] text-[#192A24] focus:outline-none focus:border-[#236B50]"
                      />
                    )}
                  </div>

                  {/* 4. Decorations: Yes, No (if yes checked additional price field should be entered) */}
                  <div>
                    <label className="block text-xs font-bold text-[#192A24] mb-1">
                      Decorations
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['Yes', 'No'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setFormDecorations(prev => {
                              const next = prev === opt ? '' : opt;
                              if (next !== 'Yes') setFormDecorationsPrice(0);
                              return next;
                            });
                          }}
                          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            formDecorations === opt
                              ? 'bg-[#236B50] text-white border-[#236B50] shadow-xs'
                              : 'bg-white text-slate-700 border-[#D5E5DE] hover:bg-slate-50'
                          }`}
                        >
                          {opt === 'Yes' ? '✓ Yes' : '✕ No'}
                        </button>
                      ))}
                    </div>

                    {formDecorations === 'Yes' && (
                      <div className="mt-2 p-2.5 bg-emerald-50 rounded-xl border border-emerald-300 animate-in fade-in duration-150">
                        <label className="block text-[11px] font-extrabold text-emerald-950 mb-1">
                          Additional Decoration Price (AED)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={formDecorationsPrice}
                            onChange={(e) => setFormDecorationsPrice(parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full bg-white border border-emerald-400 rounded-lg px-3 py-1.5 text-xs font-black text-emerald-900 focus:outline-none focus:border-[#236B50]"
                          />
                          <span className="absolute right-2.5 top-1.5 text-[11px] font-bold text-emerald-700">AED</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 5. Table Cloth Color */}
                  <div>
                    <label className="block text-xs font-bold text-[#192A24] mb-1">
                      Table Cloth Color
                    </label>
                    <input
                      type="text"
                      value={formTableClothColor}
                      onChange={(e) => setFormTableClothColor(e.target.value)}
                      placeholder="e.g. Pink, White, Gold"
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs font-bold text-[#192A24] focus:outline-none focus:border-[#236B50]"
                    />
                  </div>

                  {/* 6. Seating Style */}
                  <div>
                    <label className="block text-xs font-bold text-[#192A24] mb-1">
                      Seating Style
                    </label>
                    <input
                      type="text"
                      list="cph-seating-styles"
                      value={formSeatingStyle}
                      onChange={(e) => setFormSeatingStyle(e.target.value)}
                      placeholder="e.g. Round Table, Theater, U-Shape"
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs font-bold text-[#192A24] focus:outline-none focus:border-[#236B50]"
                    />
                    <datalist id="cph-seating-styles">
                      <option value="Round Table" />
                      <option value="Banquet Setup" />
                      <option value="Theater Style" />
                      <option value="U-Shape" />
                    </datalist>
                  </div>

                  {/* 7. Stage Check Button: Left side, Right side, Center */}
                  <div>
                    <label className="block text-xs font-bold text-[#192A24] mb-1">
                      Stage Position
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['Left side', 'Right side', 'Center'] as const).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => setFormStagePosition(prev => prev === pos ? '' : pos)}
                          className={`py-2 px-1 text-center rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
                            formStagePosition === pos
                              ? 'bg-[#236B50] text-white border-[#236B50] shadow-xs'
                              : 'bg-white text-slate-700 border-[#D5E5DE] hover:bg-slate-50'
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 8. Buffet Check Button: Right side, Left side, Center */}
                  <div>
                    <label className="block text-xs font-bold text-[#192A24] mb-1">
                      Buffet Position
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['Right side', 'Left side', 'Center'] as const).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => setFormBuffetPosition(prev => prev === pos ? '' : pos)}
                          className={`py-2 px-1 text-center rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
                            formBuffetPosition === pos
                              ? 'bg-[#236B50] text-white border-[#236B50] shadow-xs'
                              : 'bg-white text-slate-700 border-[#D5E5DE] hover:bg-slate-50'
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 9. Complementary Items */}
                  <div>
                    <label className="block text-xs font-bold text-[#192A24] mb-1">
                      Complementary Items (Comma-separated)
                    </label>
                    <input
                      type="text"
                      value={formComplementaryItems}
                      onChange={(e) => setFormComplementaryItems(e.target.value)}
                      placeholder="e.g. Water, Soft drinks (leave blank if none)"
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                    />
                  </div>
                </div>
              </div>

              {/* Buffet Package details (If food is taken from hotel) */}
              {isFoodIncluded && (() => {
                const currentMenu = getBanquetMenuById(formMenuId) || BANQUET_MENUS[0];
                return (
                  <div className="p-4 bg-[#F6FAF8] rounded-2xl border-2 border-[#D5E5DE] space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#E2ECE7]">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-xl bg-[#E8F5EE] border border-[#C5E5D5] flex items-center justify-center text-[#236B50]">
                          <UtensilsCrossed className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-[#192A24] uppercase tracking-wider">
                            Registered Banquet Menu & Guest Dish Selection
                          </h4>
                          <p className="text-[11px] text-[#5A6F66]">
                            Select Menu A–L, then pick or remove dishes chosen by guests (forwarded to Chef Karim & Accounts).
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-[#236B50] bg-[#E8F5EE] px-2.5 py-1 rounded-full border border-[#C5E5D5]">
                        Hall Rental: FREE with Food
                      </span>
                    </div>

                    {/* Step 1: Menu Dropdown (Menu A through Menu L) and Pricing */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-1">
                        <label className="block text-xs font-black text-[#192A24] mb-1">
                          1. Banquet Menu (Menu A – L) *
                        </label>
                        <select
                          value={formMenuId}
                          onChange={(e) => handleMenuSelect(e.target.value)}
                          className="w-full bg-white border-2 border-[#236B50] rounded-xl px-3 py-2 text-xs text-[#192A24] font-bold focus:outline-none focus:ring-2 focus:ring-[#236B50]/20 shadow-xs cursor-pointer"
                        >
                          {BANQUET_MENUS.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.title}
                            </option>
                          ))}
                        </select>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Cuisine: <strong className="text-[#236B50]">{currentMenu.cuisine}</strong> • Standard Rate: {currentMenu.pricePerPerson} AED/person
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#192A24] mb-1">
                          Price Charged / Guest (AED) *
                        </label>
                        <input
                          type="number"
                          value={formFoodPriceCharged}
                          onChange={(e) => setFormFoodPriceCharged(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] font-bold focus:outline-none focus:border-[#236B50]"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Total Food Rev: {formatCurrency(formFoodPriceCharged * formGuestCount)}
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#192A24] mb-1">
                          Package Discount (AED)
                        </label>
                        <input
                          type="number"
                          value={formDiscount}
                          onChange={(e) => setFormDiscount(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Floor Limit: 1,500 AED min
                        </span>
                      </div>
                    </div>

                    {/* Step 2: Interactive Food Selection & Customization for Francis */}
                    <div className="bg-white rounded-2xl p-4 border border-[#D5E5DE] space-y-4 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#E2ECE7]">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-black uppercase text-[#192A24]">
                              2. Guest Dish Selection for {currentMenu.code}
                            </span>
                            <span className="text-[10px] bg-[#E8F5EE] text-[#236B50] font-black px-2.5 py-0.5 rounded-full border border-[#C5E5D5]">
                              {formSelectedFoodItems.length} Dishes Selected
                            </span>
                          </div>
                          <p className="text-[11px] text-[#5A6F66] mt-0.5">
                            Click any item below to select or remove it as requested by the guest.
                          </p>
                        </div>

                        <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
                          <button
                            type="button"
                            onClick={handleResetMenuToDefault}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-[#D5E5DE] bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center space-x-1 cursor-pointer transition-all"
                            title="Reset dishes to standard defaults for this menu"
                          >
                            <RotateCcw className="w-3 h-3 text-slate-500" />
                            <span>Reset Defaults</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleClearAllDishes}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center space-x-1 cursor-pointer transition-all"
                            title="Clear all selections to choose from scratch"
                          >
                            <X className="w-3 h-3 text-rose-500" />
                            <span>Clear All</span>
                          </button>
                        </div>
                      </div>

                      {/* Render Menu Categories */}
                      <div className="space-y-4">
                        {currentMenu.categories.map((category, catIdx) => {
                          const isLineChoice = category.selectionType === 'one_per_line' && category.lines && category.lines.length > 0;
                          
                          // Count how many items in this category are currently selected
                          const allCatOptions = isLineChoice
                            ? category.lines!.flatMap(l => l.options)
                            : (category.options || []);
                          const selectedCountInCat = formSelectedFoodItems.filter(f => allCatOptions.includes(f)).length;

                          return (
                            <div key={catIdx} className="bg-[#FAFDFB] p-3 rounded-xl border border-[#E2ECE7] space-y-2.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <h5 className="text-xs font-black text-[#192A24] uppercase tracking-wide">
                                    {category.categoryName}
                                  </h5>
                                  <span className="text-[10px] font-extrabold text-[#236B50] bg-[#E8F5EE] px-2 py-0.5 rounded-md border border-[#C5E5D5]">
                                    {category.instruction}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono font-bold text-slate-500">
                                  {selectedCountInCat} chosen {category.countAllowed ? `/ ${category.countAllowed}` : ''}
                                </span>
                              </div>

                              {/* If One per Line (e.g. Main Course lines) */}
                              {isLineChoice ? (
                                <div className="space-y-2">
                                  {category.lines!.map((line, lineIdx) => (
                                    <div key={lineIdx} className="p-2 bg-white rounded-lg border border-[#E8EFEA] space-y-1">
                                      <span className="text-[10px] font-bold text-[#5A6F66] uppercase block">
                                        {line.lineLabel}:
                                      </span>
                                      <div className="flex flex-wrap gap-1.5">
                                        {line.options.map((option, optIdx) => {
                                          const isSelected = formSelectedFoodItems.includes(option);
                                          return (
                                            <button
                                              key={optIdx}
                                              type="button"
                                              onClick={() => {
                                                if (isSelected) {
                                                  handleToggleFoodItem(option);
                                                } else {
                                                  handleSelectLineOption(line.options, option);
                                                }
                                              }}
                                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center space-x-1 cursor-pointer ${
                                                isSelected
                                                  ? 'bg-[#236B50] text-white border-[#236B50] shadow-xs'
                                                  : 'bg-white text-slate-700 border-[#D5E5DE] hover:border-[#236B50] hover:bg-[#F6FAF8]'
                                              }`}
                                            >
                                              {isSelected ? (
                                                <Check className="w-3 h-3 text-white" />
                                              ) : (
                                                <Plus className="w-3 h-3 text-slate-400" />
                                              )}
                                              <span>{option}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                /* Standard Category with Options List (Salads, Soups, Starters, Desserts) */
                                <div className="flex flex-wrap gap-1.5">
                                  {(category.options || []).map((option, optIdx) => {
                                    const isSelected = formSelectedFoodItems.includes(option);
                                    return (
                                      <button
                                        key={optIdx}
                                        type="button"
                                        onClick={() => handleToggleFoodItem(option)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center space-x-1 cursor-pointer ${
                                          isSelected
                                            ? 'bg-[#236B50] text-white border-[#236B50] shadow-xs'
                                            : 'bg-white text-slate-700 border-[#D5E5DE] hover:border-[#236B50] hover:bg-[#F6FAF8]'
                                        }`}
                                      >
                                        {isSelected ? (
                                          <Check className="w-3.5 h-3.5 text-white" />
                                        ) : (
                                          <Plus className="w-3.5 h-3.5 text-slate-400" />
                                        )}
                                        <span>{option}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Add Custom Dish Row */}
                      <div className="pt-2 border-t border-[#E2ECE7]">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          + Add Custom Food Item Requested by Guest
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={customDishInput}
                            onChange={(e) => setCustomDishInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomDish();
                              }
                            }}
                            placeholder="Type custom food item (e.g. Extra Rasmalai, Dum Gosht)..."
                            className="flex-1 bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomDish}
                            className="px-3.5 py-2 rounded-xl bg-[#236B50] text-white text-xs font-bold flex items-center space-x-1.5 hover:bg-[#1C5740] cursor-pointer shadow-xs active:scale-95 transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Dish</span>
                          </button>
                        </div>
                      </div>

                      {/* Summary of Forwarded Food Items */}
                      <div className="p-3 bg-[#FAFDFB] rounded-xl border border-[#D5E5DE] space-y-2">
                        <div className="flex items-center justify-between text-xs font-black text-[#192A24]">
                          <span className="flex items-center space-x-1.5 text-[#236B50]">
                            <UtensilsCrossed className="w-3.5 h-3.5" />
                            <span>Selected Food Items Forwarded to Chef Karim & Accounts ({formSelectedFoodItems.length}):</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-normal">Click × to remove</span>
                        </div>
                        {formSelectedFoodItems.length === 0 ? (
                          <p className="text-xs text-amber-700 italic">
                            No dishes selected yet. Please click items from the categories above or click "Reset Defaults".
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {formSelectedFoodItems.map((dish, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white border border-[#D5E5DE] text-xs font-semibold text-slate-900 shadow-2xs"
                              >
                                <span>{dish}</span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleFoodItem(dish)}
                                  className="text-slate-400 hover:text-rose-600 ml-1 cursor-pointer transition-colors"
                                  title={`Remove ${dish}`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {!isFloorDiscountValid && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center space-x-1.5 font-medium">
                        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>
                          Policy Floor: Lowest discount allowed is 1,500 AED total package price for 30 people (Subtotal is currently {formatCurrency(subtotalRev)}).
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Notes for the Chef (Crucial User Requirement) */}
              <div>
                <label className="block text-xs font-bold text-[#192A24] mb-1 flex items-center space-x-1.5">
                  <ChefHat className="w-4 h-4 text-[#236B50]" />
                  <span>Notes for the Chef (Food preparation, spice levels, replenishment timing)</span>
                </label>
                <textarea
                  rows={2}
                  value={formChefNotes}
                  onChange={(e) => setFormChefNotes(e.target.value)}
                  placeholder="e.g. Mild spice for biryani, extra live replenishment for appetizers at 8:30 PM, vegetarian items kept on separate counter."
                  className="w-full bg-white border border-[#D5E5DE] rounded-xl p-3 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                />
              </div>

              {/* Advance Payment & Outstanding Balance Settle Terms (Francis F&B Workflow) */}
              <div className="p-4 bg-[#F8FAF9] rounded-2xl border border-[#D5E5DE] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#192A24] uppercase tracking-wider flex items-center space-x-1.5">
                    <CreditCard className="w-4 h-4 text-[#236B50]" />
                    <span>Advance Payment & Guest Balance Settle Terms</span>
                  </h4>
                  <span className="text-[11px] font-bold text-[#236B50]">Handled by: {currentUser.name}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#192A24] mb-1">Total Bill (Agreed Price)</label>
                    <div className="w-full bg-[#EBF3EF] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs font-extrabold text-[#192A24] font-mono">
                      {formatCurrency(subtotalRev)}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#192A24] mb-1">Advance Paid Now (AED) *</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formDeposit}
                      onChange={(e) => setFormDeposit(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-emerald-800 font-bold font-mono focus:outline-none focus:border-[#236B50]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#192A24] mb-1">Advance Mode</label>
                    <select
                      value={formAdvancePaymentMode}
                      onChange={(e) => setFormAdvancePaymentMode(e.target.value as any)}
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] font-bold focus:outline-none focus:border-[#236B50]"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Online">Online</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#192A24] mb-1">Balance to Pay</label>
                    <div className={`w-full border rounded-xl px-3 py-2 text-xs font-black text-center font-mono ${
                      formDeposit >= subtotalRev && subtotalRev > 0
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                        : 'bg-amber-100 border-amber-300 text-amber-900'
                    }`}>
                      {formDeposit >= subtotalRev && subtotalRev > 0
                        ? '0.00 AED • SETTLED' 
                        : `${Math.max(0, subtotalRev - formDeposit).toFixed(2)} AED`}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#192A24] mb-1">Payment Terms Notice on Prospectus (Optional)</label>
                  <input
                    type="text"
                    value={formPaymentTermsNotice}
                    onChange={(e) => setFormPaymentTermsNotice(e.target.value)}
                    placeholder="e.g. Full payment to be done in cash before event starts"
                    className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                  />
                </div>
              </div>

              {/* Real-Time Client Billing & Margin Preview (Profits hidden for roles without canViewProfits) */}
              <div className="p-4 bg-[#EBF5F0] rounded-2xl border border-[#B8DFC9] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="text-xs font-extrabold text-[#236B50] uppercase tracking-wider">
                    {currentUser.permissions.canViewProfits
                      ? 'Real-Time Financial Preview for this Booking'
                      : 'Real-Time Client Billing Preview'}
                  </div>
                  <div className="text-xs text-[#3D5A4E]">
                    Charged to Client: <strong className="text-[#192A24]">{formatCurrency(subtotalRev)}</strong>
                    {currentUser.permissions.canViewProfits && (
                      <>
                        {' '}• Hotel Direct Cost: <strong className="text-[#192A24]">{formatCurrency(totalDirectCosts)}</strong>
                      </>
                    )}
                  </div>
                </div>

                {currentUser.permissions.canViewProfits ? (
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-[11px] text-[#5A6F66]">Gross Profit</div>
                      <div className="text-base font-extrabold text-[#236B50]">
                        +{formatCurrency(grossProfit)}
                      </div>
                    </div>
                    <div className="px-3.5 py-1.5 rounded-full bg-[#236B50] text-white text-xs font-extrabold shadow-xs">
                      {formatPercent(marginPercent)} Margin
                    </div>
                  </div>
                ) : (
                  <div className="px-3.5 py-1.5 rounded-full bg-[#236B50] text-white text-xs font-extrabold shadow-xs">
                    {formDeposit >= subtotalRev
                      ? '100% Advance Settled'
                      : `Balance Due: ${formatCurrency(Math.max(0, subtotalRev - formDeposit))}`}
                  </div>
                )}
              </div>

              {/* Inline Form Validation Errors Banner */}
              {formValidationErrors.length > 0 && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 space-y-1.5 text-xs">
                  <div className="font-extrabold flex items-center space-x-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
                    <span>Please fix the following before saving ({formValidationErrors.length}):</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px] font-medium">
                    {formValidationErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-[#E2ECE7]">
                <button
                  type="button"
                  onClick={() => {
                    setFormValidationErrors([]);
                    setBookingModalOpen(false);
                  }}
                  className="px-5 py-2.5 bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#284B3D] text-xs font-bold rounded-full transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white text-xs font-extrabold rounded-full shadow-md transition-all cursor-pointer"
                >
                  {editingBooking ? 'Save Changes' : 'Confirm & Register Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Advance Booking & Payment Confirmation Voucher Modal */}
      {selectedAdvanceVoucherBooking && (
        <AdvanceBookingConfirmationModal
          booking={selectedAdvanceVoucherBooking}
          hall={halls.find(h => h.id === selectedAdvanceVoucherBooking.hallId)}
          pkg={packages.find(p => p.id === selectedAdvanceVoucherBooking.packageId)}
          onClose={() => setSelectedAdvanceVoucherBooking(null)}
        />
      )}

      {/* Party Date Arrival & Balance Settlement Modal for Francis */}
      {settleModalBooking && (
        <PartyDatePaymentSettlementModal
          booking={settleModalBooking}
          currentUser={currentUser}
          onClose={() => setSettleModalBooking(null)}
          onSettlePayment={handleSettlePayment}
        />
      )}

      {/* Official General Ledger Posting Report Modal */}
      {selectedPostingReportBooking && (
        <PostingReportModal
          booking={selectedPostingReportBooking}
          currentUser={currentUser}
          onClose={() => setSelectedPostingReportBooking(null)}
        />
      )}
    </div>
  );
};
