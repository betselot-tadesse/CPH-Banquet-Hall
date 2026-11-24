export type UserRole = 'general_manager' | 'banquet_manager' | 'fnb_supervisor' | 'executive_chef' | 'accounts_executive' | 'marketing_executive';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  title: string;
  email: string;
  avatar: string;
  pin: string;
  permissions: {
    canViewProfits: boolean;
    canEditPricing: boolean;
    canManageBookings: boolean;
    canManageRecipes: boolean;
    canLogChefUsage: boolean;
    canManageInventory: boolean;
    canGenerateInvoices: boolean;
    canAccessBackups: boolean;
    canManageUsers: boolean;
    canManageMarketing?: boolean;
    canViewCosting?: boolean;     // False for Supervisor (Francis/Vendor)
    canViewRevenue?: boolean;     // False for Executive Chef (Karim)
    canModifyRecords?: boolean;   // False for General Manager (read-only view)
    canApproveUnlocks?: boolean;  // True for General Manager
  };
}

export type HotelBranch = 'CPH1' | 'CPH2';

export type HallOfferType = 
  | 'free_with_food'      // Hall is FREE when booking food/buffet from hotel
  | 'hall_only_full'     // Hall only (no food) - starts from 1,500 AED
  | 'one_side_hall';     // One side of the hall (Left side partition) - starts from 1,000 AED

export type HallSection = 'Full Banquet Hall' | 'Left Side (One-Side Partition)' | 'Center Section' | 'Right Side';

export interface BanquetHall {
  id: string;
  name: string;
  branch: HotelBranch;
  capacityMin: number;
  capacityMax: number;
  squareFeet: number;
  baseRentalPerSlot: number; // AED
  cleaningFee: number;
  standardAVCost: number;
  standardStaffingCost: number;
  utilityPerEvent: number;
  image: string;
  description: string;
  amenities: string[];
}

export type BookingStatus = 'confirmed' | 'in_preparation' | 'active' | 'completed' | 'cancelled';
export type TimeSlot = 'morning' | 'evening' | 'full_day';
export type BuffetTier = '60_aed' | '80_aed' | '100_aed' | 'custom_buffet';

export interface RawIngredient {
  id: string;
  name: string;
  category: 'Meat & Poultry' | 'Seafood' | 'Dairy' | 'Produce' | 'Dry Goods & Spices' | 'Beverages' | 'Bakery' | 'Oils & Condiments';
  unit: string;
  costPerUnit: number; // AED per unit
  stockQuantity: number;
  reorderLevel: number;
  supplier: string;
  wastageFactorPercent: number; // trim/prep loss e.g. 10%

  // Advanced Packaging & Sub-unit/Piece Breakdown (e.g. 1 carton = 26 chicken pieces/bones)
  packagingUnit?: string;          // e.g. "Carton", "Sack", "Tin", "Tray", "Box", "Bag"
  subUnitName?: string;            // e.g. "chicken pieces/bones", "kg", "liters", "eggs", "portions"
  subUnitsPerPackage?: number;     // e.g. 26 pieces per carton, 25 kg per sack, 15 L per tin
  stockSubUnits?: number;          // total sub-units in stock (e.g. 128 chicken pieces)
  packageCostAED?: number;         // e.g. 130 AED per carton
  subUnitCostAED?: number;         // e.g. 5.00 AED per chicken piece (130 / 26)
  reorderSubUnits?: number;        // alert threshold in pieces/sub-units (e.g. 52 pieces = 2 cartons)
  storageLocation?: string;        // e.g. "Walk-in Freezer #1", "Dry Store Room 2", "Chiller A"
  lastPurchaseDate?: string;
  batchNumber?: string;
}

export interface KitchenStockMovement {
  id: string;
  ingredientId: string;
  ingredientName: string;
  type: 'purchase_receipt' | 'party_buffet_deduction' | 'room_service_prep' | 'chef_manual_issue' | 'spoilage_wastage';
  quantityChanged: number;         // in sub-units or base units (positive for add, negative for deduction)
  packagesEquivalent?: string;     // e.g. "-2 pieces (-0.08 carton)" or "+5 cartons (+130 pieces)"
  remainingSubUnits: number;
  reasonOrReference: string;       // e.g. "Party Buffet for 30 Guests (Booking #CPH-2026-104)", "Room Service: 2 Portions Chicken Biryani"
  timestamp: string;
  performedBy: string;
}

export interface RoomServiceDish {
  id: string;
  name: string;
  category: 'Room Service Mains' | 'Appetizers & Snacks' | 'Biryani & Rice' | 'Sandwiches & Burgers' | 'Desserts & Beverages';
  portionYield: number;
  ingredients: {
    ingredientId: string;
    ingredientName: string;
    quantity: number;
    unit: string;
    subUnitsUsed?: number;       // e.g. 2 chicken bones/pieces
    costAED: number;
  }[];
  prepLaborCostAED: number;
  utilityOverheadAED: number;
  totalDishCostAED: number;
  sellingPriceAED: number;
  targetFoodCostPercent: number; // e.g. 28%
  actualFoodCostPercent: number; // e.g. 26.5%
  grossMarginAED: number;
  marginPercent: number;
  description?: string;
  dietary?: string[];
  imageUrl?: string;
}

export interface RecipeIngredientItem {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  quantityPerPortion: number;
  unitCost: number;
  calculatedCost: number;
}

export interface RecipeMenuItem {
  id: string;
  name: string;
  category: 'Welcome Drinks' | 'Soups & Starters' | 'Salads & Cold Mezze' | 'Main Courses' | 'Rice, Breads & Accompaniments' | 'Desserts & Sweets';
  portionYield: number;
  ingredients: RecipeIngredientItem[];
  prepLaborCostPerPortion: number; // AED
  utilityOverheadPerPortion: number; // AED
  totalCostPerPortion: number; // AED
  suggestedSellingPrice: number; // AED
  targetFoodCostPercent: number;
  description: string;
  dietary: ('Vegetarian' | 'Vegan' | 'Gluten-Free' | 'Halal' | 'Nut-Free')[];
}

export interface BanquetPackage {
  id: string;
  name: string;
  description: string;
  pricePerGuest: number; // e.g. 60, 80, 100 AED
  costPerGuest: number;  // sum of item cooking costs in AED
  itemIds: string[];     // RecipeMenuItem IDs
  minimumGuests: number; // 30 minimum
  tier: BuffetTier;
  courseCount: number;
}

export interface BanquetMenuLineChoice {
  lineLabel: string; // e.g. "Line 1", "Line 2"
  options: string[]; // e.g. ["Biryani (Veg)", "Biryani (Non Veg)"]
}

export interface BanquetMenuCategorySection {
  categoryName: string; // e.g. "Salads", "Soups", "Starter", "Main Course", "Dessert"
  instruction: string;  // e.g. "Choose Any 2", "Choose 1 per Line", "Choose Any 3", "Choose Any 1"
  selectionType: 'choose_count' | 'one_per_line' | 'any';
  countAllowed?: number; // e.g. 2, 3, 1
  lines?: BanquetMenuLineChoice[];
  options?: string[];   // For simple list categories: ["Spring Roll", "Chicken Saute", ...]
}

export interface BanquetRegisteredMenu {
  id: string;               // 'menu_a', 'menu_b', ... 'menu_l'
  code: string;             // 'Menu A', 'Menu B', ... 'Menu L'
  title: string;            // 'Menu A (Arabic) — AED 60 per Person'
  cuisine: string;          // 'Arabic', 'Asian Mix', 'Asian Vegetarian', 'Continental', 'Filipino'
  pricePerPerson: number;   // 60, 80, 100
  categories: BanquetMenuCategorySection[];
  defaultSelected: string[]; // Standard pre-selected items so Francis starts with a complete balanced menu
  allOptions: string[];     // flat list of all food options available in this menu
}

export type CostingMethod = 'party_batch' | 'item_by_item';

export type CostingWorkflowStatus = 
  | 'not_started' 
  | 'party_ended_pending_chef'
  | 'chef_draft' 
  | 'forwarded_to_accounts' 
  | 'costed_by_arun' 
  | 'approved';

export interface ChefPartyIngredientEntry {
  id: string;
  ingredient: string;            // Chef enters freely: e.g. "Chicken", "Basmati Rice", "Cooking Oil"
  amountUsed: string;            // Chef enters freely: e.g. "1 carton", "2 kg", "15 liters", "3 trays"
  foodItemName?: string;         // If 'item_by_item': e.g. "Chicken Biryani", "Chicken Noodles"
  
  // Costing populated by Arun (Accounts) or auto-matched via Arun's Excel/OCR:
  purchasingPriceAED?: number;   // Unit purchasing price in AED (e.g. 135 AED/carton, 8.5 AED/kg)
  purchasingUnit?: string;       // Purchasing unit (e.g. "carton", "kg", "liter")
  calculatedCostAED?: number;    // Calculated total cost in AED
  priceSource?: 'excel_sheet' | 'ocr_scan' | 'master_catalog' | 'manual_arun';
  matchedItemDescription?: string;
  notes?: string;
}

export interface ChefUsageItem {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  theoreticalQuantity: number;
  actualUsedQuantity: number;
  unitCost: number; // AED
  varianceCost: number; // AED
  varianceReason?: string;
}

export interface BookingEvent {
  id: string;
  bookingNumber: string;
  branch: HotelBranch;
  clientName: string;
  clientPhone: string;
  clientEmail?: string; // Optional client email as requested!
  clientCompany?: string;
  
  hallId: string;
  hallName: string;
  hallSection: HallSection;
  hallOffer: HallOfferType;
  
  bookingDate: string; // The date booking was registered (e.g. 2026-10-14)
  eventDate: string;   // The party / celebration date
  timeSlot: TimeSlot;
  eventType: string; // e.g. 'Get-Together Party', 'Birthday Celebration', 'Anniversary', 'Wedding'
  guestCount: number; // Min 30 for celebrations
  status: BookingStatus;
  
  // Buffet Package & Registered Menu details (Menu A, Menu B, ... Menu L)
  hasFoodFromHotel: boolean; // true if taking food from hotel (hall becomes free offer!)
  packageId?: string;
  selectedMenuId?: string;       // e.g. 'menu_a'
  selectedMenuName?: string;     // e.g. 'Menu A: Arabic Menu — AED 60 per Person'
  selectedFoodItems?: string[];  // Food items chosen by guest and forwarded to Chef & Accounts
  buffetTier?: BuffetTier;
  customRecipeItemIds: string[];
  
  // Pricing & Rule Enforcements (AED)
  agreementType: 'per_person' | 'fixed_package' | 'hall_only';
  foodPricePerGuestCharged: number; // 60, 80, 100 AED
  packageFixedPriceCharged?: number;
  discountAmount: number; // AED
  
  hallRentalCharged: number; // 0 AED if food is from hotel! Or 1,500 AED min for full hall, 1,000 AED for one-side
  hallDirectCost: number;    // Cleaning & utilities spent by hotel
  
  foodCostPerGuestTheoretical: number; // AED
  foodCostActualTotal?: number; // AED once chef logs cooking
  
  beveragePriceCharged: number; // AED
  beverageCostTotal: number; // AED
  
  decorAndAVCharged: number; // AED
  decorAndAVCost: number; // AED
  
  staffingCost: number; // AED
  extraCharges: number; // AED
  
  taxPercent: number; // 5% UAE VAT
  municipalityFeePercent?: number; // 10% Municipality Fee
  serviceChargePercent: number; // 10% Service Charge
  depositPaid: number; // AED
  
  // Chef Usage Log & Specific Notes for Chef
  chefNotes?: string; // Notes for the chef (e.g. extra spice level, buffet replenishment, timing)
  chefUsageLogged: boolean;
  chefUsageLogs?: ChefUsageItem[];
  
  costingMethod?: CostingMethod;
  costingStatus?: CostingWorkflowStatus;
  chefPartyEntries?: ChefPartyIngredientEntry[];
  chefForwardedAt?: string;
  arunApproved?: boolean;
  arunApprovedAt?: string;
  arunAccountsNotes?: string;
  
  // Party Execution & Sequential Hand-off Workflow (Francis -> Chef Karim -> Arun Kumar)
  partyEnded?: boolean;                 // Confirmed by Francis (F&B Supervisor) when party has concluded
  partyEndedAt?: string;               // Timestamp when Francis marked party ended
  partyEndedConfirmedBy?: string;      // Francis D'Souza
  chefApproved?: boolean;              // Chef Karim confirmed and approved ingredients used
  chefApprovedAt?: string;             // Timestamp when Chef approved amounts
  chefApprovedBy?: string;             // Chef Karim Zayani
  chefStampSerial?: string;            // Official Stamp Paper Serial # (e.g. CPH-STAMP-2026-001)
  arunCostedAt?: string;               // Timestamp when Arun Kumar completed purchasing costing
  arunCostedBy?: string;               // Arun Kumar
  postingReportGenerated?: boolean;    // Whether final GL Posting Report has been generated
  postingReportNumber?: string;        // Official Posting Report ID (e.g. CPH-GL-POST-2026-001)
  glPostingDate?: string;              // Date posted to General Ledger

  // Lead & Payment Tracking for Francis (F&B Supervisor)
  leadSource?: string; // e.g. 'Instagram Ad', 'Google Ads Campaign', 'Walk-in', 'Direct Call Lead'
  isAdvanceVoucherIssued?: boolean;
  finalSettledAt?: string; // Date/time when full payment was confirmed on party day
  finalPaymentConfirmed?: boolean;

  // Cancellation Tracking
  cancellationReason?: string; // Reason given by Francis/client upon cancelling party
  cancelledAt?: string;
  cancelledBy?: string;

  specialRequests?: string;
  fnbRepresentative?: string;

  // Function Prospectus Operational & Hall Setup Details (from official Crystal Plaza Prospectus)
  eventTimeSpan?: string;            // e.g. "6pm to 12am"
  foodPickupTime?: string;           // e.g. "8.00 pm"
  soundSystem?: string | boolean;    // e.g. "yes"
  projector?: string | boolean;      // e.g. "yes"
  projectorNotes?: string;           // e.g. "NEED TO BRING YOUR OWN LAPTOP"
  decorations?: string | boolean;    // e.g. "No"
  tableClothColor?: string;          // e.g. "Pink"
  venueFloor?: string;               // e.g. "1ST FLOOR BQT HALL"
  seatingStyle?: string;             // e.g. "ROUND TABLE"
  stagePosition?: string;            // e.g. "left side"
  buffetPosition?: string;           // e.g. "right side"
  adultsCount?: number;              // e.g. 50
  kidsCount?: number;                // e.g. 0
  advancePaymentMode?: string;       // e.g. "cash"
  paymentTermsNotice?: string;       // e.g. "BEFORE THE EVENT STARTS FULL PAYMENT TO BE DONE IN CASH"
  
  // Prospectus Structured Menu Breakdown (by course categories)
  prospectusMenu?: {
    salads?: string[];               // e.g. ["sweet corn salad", "mixed salad"]
    starters?: string[];             // e.g. ["fish finger", "veg manchurian"]
    vegMainCourse?: string[];        // e.g. ["vegetable pulao", "paneer butter masala", "vegetable hakka noodle"]
    nonVegMainCourse?: string[];     // e.g. ["chicken kadhai", "mutton curry (fresh mutton with bone)", "dal fry"]
    desserts?: string[];             // e.g. ["assorted dry cake", "chocolate mousse"]
    complementary?: string[];        // e.g. ["pickle, papad, raita", "soft drinks, water, juice"]
  };

  // High & Medium Priority Enhancements
  payments?: PaymentRecord[];                    // Track each payment separately
  cancellationPolicy?: CancellationPolicyDetails;// Reason, refund action, refund amount
  tentativeHold?: TentativeHoldDetails;          // 24 to 48 hours hold before advance
  guestCountRevision?: GuestCountRevision;       // Estimated vs Confirmed vs Actual
  lockDetails?: BookingLockDetails;              // Locked after Chef Finish or Accounts Costing
  checklist?: EventChecklistItem[];              // Task list: Decoration, Staff, AV, Cleanup
  totalBillPayable?: number;                     // Total bill calculated
  balanceToPay?: number;                         // Total bill - all recorded payments
  isTentative?: boolean;                         // True if on tentative hold
  fpPrePartyTotalBill?: number;                  // Pre-party agreed total bill locked for FP Sheet
  fpPrePartyAdvancePaid?: number;                // Pre-party advance deposit locked for FP Sheet
  fpPrePartyAdvanceMode?: string;                // Pre-party advance payment mode locked for FP Sheet

  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  bookingId: string;
  date: string;
  amount: number;
  paymentType: 'advance' | 'balance' | 'additional';
  paymentMode: 'Cash' | 'Card' | 'Bank Transfer' | 'Cheque' | 'Online';
  receiptNumber: string;
  receivedBy: string;
  notes?: string;
  createdAt: string;
}

export interface CancellationPolicyDetails {
  reason: string;
  advanceAction: 'refunded' | 'partly_refunded' | 'forfeited';
  refundAmount: number;
  refundMode?: 'Cash' | 'Card' | 'Bank Transfer';
  cancelledAt: string;
  cancelledBy: string;
  notes?: string;
}

export interface TentativeHoldDetails {
  isHold: boolean;
  holdDurationHours: number; // 24 or 48 hours
  holdExpiresAt: string; // ISO string
  holdPlacedAt: string;
  holdPlacedBy: string;
  notes?: string;
}

export interface GuestCountRevision {
  estimatedCount: number; // at booking
  confirmedCount?: number; // confirmed a few days prior
  confirmedAt?: string;
  actualCount?: number; // actual on event day
  actualCountLoggedAt?: string;
}

export interface BookingLockDetails {
  isLocked: boolean;
  lockedAt?: string;
  lockedBy?: string;
  lockStage?: 'chef_finished' | 'accounts_costed' | 'gm_locked';
  unlockRequested?: boolean;
  unlockRequestReason?: string;
  unlockRequestedBy?: string;
  unlockRequestedAt?: string;
  unlockApprovedBy?: string;
  unlockApprovedAt?: string;
}

export interface NotificationItem {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  type: 'new_booking' | 'cancellation' | 'chef_finished' | 'accounts_costed' | 'payment_received' | 'hold_expiring' | 'unlock_requested' | 'party_ended_confirm_prompt' | 'chef_action_required' | 'mandatory_settle_balance';
  targetRoles: UserRole[] | 'all';
  bookingId?: string;
  isRead?: boolean;
  actionRequired?: 'confirm_party_ended' | 'cost_party_chef' | 'cost_party_accounts' | 'settle_balance';
}

export interface EventChecklistItem {
  id: string;
  category: 'Decoration' | 'Staff' | 'AV' | 'Cleanup' | 'Kitchen Setup';
  task: string;
  isCompleted: boolean;
  completedAt?: string;
  completedBy?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  bookingId: string;
  issueDate: string;
  dueDate: string;
  status: 'Draft' | 'Issued' | 'Paid' | 'Partially Paid' | 'Overdue';
  
  branch: HotelBranch;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  clientAddress?: string;
  
  hallName: string;
  eventDate: string;
  guestCount: number;
  buffetTier: string;
  
  hallRental: number;
  foodAndBeverageTotal: number;
  decorAndAVTotal: number;
  staffAndServiceTotal: number;
  subtotal: number;
  discount: number;
  serviceCharge: number;
  municipalityFee?: number;
  taxAmount: number;
  grandTotal: number;
  depositPaid: number;
  balanceDue: number;
  
  internalTotalCost: number;
  internalGrossProfit: number;
  internalProfitMarginPercent: number;
  internalFoodCostPercent: number;
}

export interface BackupRecord {
  id: string;
  timestamp: string;
  sizeBytes: number;
  sha256Hash: string;
  encryptionAlgorithm: 'AES-256-GCM';
  recordsCount: {
    bookings: number;
    recipes: number;
    ingredients: number;
    invoices: number;
  };
  status: 'Verified & Encrypted' | 'Synced to Cloud Vault';
  initiatedBy: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  category: 'Booking' | 'Costing' | 'Inventory' | 'Invoice' | 'Security';
}

export interface MetaCampaignItem {
  id: string;
  campaignName: string;
  objective: 'Lead Generation' | 'Messages (WhatsApp)' | 'Conversions' | 'Brand Awareness';
  spendAED: number;
  impressions: number;
  clicks: number;
  results: number; // Inquiries or Leads
  cprAED: number; // Cost Per Result
  ctrPercent: number;
  status: 'Active' | 'Completed' | 'Paused';
}

export interface MetaAdMonthlyReport {
  id: string;
  monthKey: string; // '2026-08', '2026-09', '2026-10', '2026-11'
  monthLabel: string; // 'August 2026', 'September 2026', etc.
  adSpendAED: number; // Total spent on Meta Ads (Facebook & Instagram)
  impressions: number;
  clicks: number;
  leadsGenerated: number; // Inquiries generated from Facebook lead forms, Instagram DM & WhatsApp
  cprAED: number; // Cost per result (adSpendAED / leadsGenerated)
  ctrPercent: number; // Click-through rate
  topPerformingCampaign?: string;
  notes?: string;
  platformBreakdown?: {
    facebookSpendAED: number;
    instagramSpendAED: number;
    whatsappSpendAED: number;
    googleSpendAED?: number;
  };
  conversionRatePercent?: number;
  roasMultiplier?: number;
  historicalBanquetRevenue?: number;
  historicalDirectCosts?: number;
  historicalPartiesCount?: number;
  historicalGuestsCount?: number;
  hallBreakdown?: {
    hallName: string;
    partiesCount: number;
    revenueAED: number;
  }[];
  campaigns?: MetaCampaignItem[];
  insertedAt: string;
  insertedBy: string;
}

export type GuestSegmentCategory = 
  | 'VIP' 
  | 'Frequent Stay' 
  | 'Corporate Business' 
  | 'Family Leisure' 
  | 'Honeymoon & Couples' 
  | 'Weekend Staycation';

export type RetargetingStatus = 
  | 'pending' 
  | 'sent' 
  | 'responded' 
  | 'converted' 
  | 'unsubscribed';

export interface HotelRoomGuest {
  id: string;
  name: string;
  phone: string;
  cleanPhone: string; // Cleaned international format for wa.me, e.g. 971501234567
  roomNumber: string; // e.g. "402", "Deluxe Suite 712"
  roomType?: string; // "Executive King Room", "Deluxe Suite", "Standard Twin", "Royal Penthouse"
  checkInDate: string; // "2026-10-10"
  checkOutDate: string; // "2026-10-14"
  nights: number;
  totalSpendAED: number;
  guestCategory: GuestSegmentCategory;
  cityOrCountry?: string; // e.g. "Dubai, UAE", "Riyadh, KSA", "Doha, Qatar", "London, UK"
  status: RetargetingStatus;
  lastSentAt?: string;
  notes?: string;
}

export interface WhatsAppRetargetingOffer {
  id: string;
  title: string;
  badge: string;
  photoUrl: string;
  headline: string;
  description: string;
  perks: string[];
  promoCode: string;
  discountValue: string;
  validUntil: string;
  targetCategory: string;
}

export interface WhatsAppMessageTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  category: 'banquet' | 'dining' | 'staycation' | 'corporate' | 'short' | 'clean' | 'custom';
  isDefault?: boolean;
}

export type InquiryStage = 
  | 'new_lead' 
  | 'menu_sent' 
  | 'tasting_hall_tour' 
  | 'tentative_hold' 
  | 'converted_won' 
  | 'lost';

export type LeadSource = 
  | 'meta_instagram_ad' 
  | 'meta_facebook_lead' 
  | 'whatsapp_direct' 
  | 'google_maps' 
  | 'walk_in' 
  | 'hotel_guest_referral';

export interface BanquetLead {
  id: string;
  clientName: string;
  phone: string;
  cleanPhone: string;
  email?: string;
  source: LeadSource;
  stage: InquiryStage;
  eventType?: string;
  targetEventDate?: string;
  estimatedGuests: number;
  budgetAED?: number;
  hallPreference?: string;
  buffetPreference?: string;
  adCampaignName?: string;
  notes?: string;
  followUpStatus?: 'pending' | 'followed_up' | 'requires_urgent_call';
  lastFollowUpAt?: string;
  convertedBookingId?: string;
  createdAt: string;
}

export interface BanquetFollowUpTemplate {
  id: string;
  title: string;
  badge: string;
  stage: InquiryStage | 'all';
  messageText: string;
  actionHook: string;
}

