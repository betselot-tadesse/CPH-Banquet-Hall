import { BanquetHall, RawIngredient, RecipeMenuItem, BanquetPackage, BookingEvent, Invoice, UserProfile, BackupRecord, AuditLog, KitchenStockMovement, RoomServiceDish, MetaAdMonthlyReport, MetaCampaignItem, HotelRoomGuest, WhatsAppRetargetingOffer, WhatsAppMessageTemplate, BanquetLead, BanquetFollowUpTemplate } from '../types';
import { MULTI_YEAR_MARKETING_REPORTS } from './multiYearMarketingData';

export const INITIAL_USERS: UserProfile[] = [
  {
    id: 'user_marketing',
    name: 'Betselot',
    role: 'marketing_executive',
    title: 'Marketing Executive & Growth Lead',
    email: 'betselot.marketing@crystalplazahotel.com',
    avatar: '',
    pin: '5678',
    permissions: {
      canViewProfits: true,
      canViewRevenue: true,
      canViewCosting: true,
      canModifyRecords: true,
      canEditPricing: true,
      canManageBookings: true,
      canManageRecipes: false, // Strictly Executive Chef privilege - only Executive Chef can enter ingredients & recipes
      canLogChefUsage: false, // Strictly Executive Chef privilege - Betselot cannot put or alter chef ingredients
      canManageInventory: true,
      canGenerateInvoices: true,
      canAccessBackups: true,
      canManageUsers: true,
      canManageMarketing: true,
    },
  },
  {
    id: 'user_gm',
    name: 'Abhishek Kumar',
    role: 'general_manager',
    title: 'General Manager & Managing Director',
    email: 'abhishek.kumar@crystalplazahotel.com',
    avatar: '',
    pin: '1234',
    permissions: {
      canViewProfits: true,
      canViewCosting: true,
      canViewRevenue: true,
      canModifyRecords: false, // General Manager has View Only: cannot create, edit, delete
      canEditPricing: false,
      canManageBookings: false,
      canManageRecipes: false,
      canLogChefUsage: false,
      canManageInventory: false,
      canGenerateInvoices: false,
      canAccessBackups: true,
      canManageUsers: true,
      canApproveUnlocks: true,  // GM can approve unlock requests
    },
  },
  {
    id: 'user_fnb',
    name: 'F&B Supervisor',
    role: 'fnb_supervisor',
    title: 'F&B Supervisor & Banquet Lead',
    email: 'fnb.supervisor@crystalplazahotel.com',
    avatar: '',
    pin: '3456',
    permissions: {
      canViewProfits: false,   // Supervisor cannot see costing and financials!
      canViewCosting: false,   // Strictly hidden/restricted
      canViewRevenue: true,    // Supervisor sees client bill, advance, balance
      canModifyRecords: true,
      canEditPricing: true,
      canManageBookings: true,  // Book, schedule, cancel banquets
      canManageRecipes: false,
      canLogChefUsage: false,
      canManageInventory: false,
      canGenerateInvoices: true,
      canAccessBackups: false,
      canManageUsers: false,
      canApproveUnlocks: false,
    },
  },
  {
    id: 'user_chef',
    name: 'Executive Chef',
    role: 'executive_chef',
    title: 'Executive Head Chef',
    email: 'executive.chef@crystalplazahotel.com',
    avatar: '',
    pin: '2345',
    permissions: {
      canViewProfits: false,   // Chef cannot see revenue, income, net profit!
      canViewCosting: true,    // Chef views scheduled banquets, enters quantities, views recipe/ingredient costing
      canViewRevenue: false,   // Strictly restricted from seeing revenue, client bill, net profit
      canModifyRecords: true,  // Chef can enter quantities used and finish
      canEditPricing: false,
      canManageBookings: false,
      canManageRecipes: true,
      canLogChefUsage: true,
      canManageInventory: false,
      canGenerateInvoices: false,
      canAccessBackups: false,
      canManageUsers: false,
      canApproveUnlocks: false,
    },
  },
  {
    id: 'user_accounts',
    name: 'Accounts',
    role: 'accounts_executive',
    title: 'Accounts & Purchasing Costing Executive',
    email: 'accounts@crystalplazahotel.com',
    avatar: '',
    pin: '4567',
    permissions: {
      canViewProfits: true,      // Accounts views banquets & financials
      canViewCosting: true,      // Costing-only edit access (purchasing unit prices & FIFO GL posting)
      canViewRevenue: true,
      canModifyRecords: false,   // Accounts cannot update, edit, or add anything beside costing
      canEditPricing: true,      // Scoped strictly to purchasing unit prices inside Costing
      canManageBookings: false,
      canManageRecipes: false,
      canLogChefUsage: false,
      canManageInventory: false,
      canGenerateInvoices: false,
      canAccessBackups: false,
      canManageUsers: false,
      canApproveUnlocks: false,
    },
  },
];

export const INITIAL_HALLS: BanquetHall[] = [
  {
    id: 'hall_first_floor_big',
    name: 'First Floor Big Hall',
    branch: 'CPH1',
    capacityMin: 30,
    capacityMax: 350,
    squareFeet: 5800,
    baseRentalPerSlot: 1500,
    cleaningFee: 150,
    standardAVCost: 250,
    standardStaffingCost: 300,
    utilityPerEvent: 120,
    image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&auto=format&fit=crop&q=80',
    description: 'First Floor Big Hall at Crystal Plaza Hotel with 3 partitions: Left Side, Center, and Right Side. Free with food bookings.',
    amenities: ['Partitionable 3-Sides (Left, Center, Right)', 'Stage & Projector', 'Buffet Island Warmers', 'Separate VIP Room'],
  },
  {
    id: 'hall_suite_room',
    name: 'Suite room Hall',
    branch: 'CPH1',
    capacityMin: 20,
    capacityMax: 120,
    squareFeet: 2200,
    baseRentalPerSlot: 1500,
    cleaningFee: 100,
    standardAVCost: 180,
    standardStaffingCost: 200,
    utilityPerEvent: 90,
    image: 'https://images.unsplash.com/photo-1545232979-fbf68fe9b10d?w=800&auto=format&fit=crop&q=80',
    description: 'Suite room Hall at Crystal Plaza Hotel, ideal for intimate family celebrations, executive gatherings, and private banquets.',
    amenities: ['Buffet Serving Line', 'Sound System', 'Dedicated Guest Restrooms', 'Flexible Seating'],
  },
];

export const INITIAL_INGREDIENTS: RawIngredient[] = [
  { 
    id: 'ing_1', 
    name: 'Fresh Farm Chicken (Carton of 26 Bones/Pieces)', 
    category: 'Meat & Poultry', 
    unit: 'carton', 
    costPerUnit: 130.00, 
    stockQuantity: 5.0, 
    reorderLevel: 2.0, 
    supplier: 'Emirates Poultry Farms LLC', 
    wastageFactorPercent: 4,
    packagingUnit: 'Carton',
    subUnitName: 'chicken pieces/bones',
    subUnitsPerPackage: 26,
    stockSubUnits: 128, // 4 Cartons + 24 pieces left (e.g. 2 pieces used for biryani as per user's prompt!)
    packageCostAED: 130.00,
    subUnitCostAED: 5.00, // 130 / 26 = 5.00 AED per chicken piece
    reorderSubUnits: 52, // 2 Cartons threshold
    storageLocation: 'Walk-in Deep Freezer #1 (Bay A-2)',
    lastPurchaseDate: '2026-10-14',
    batchNumber: 'EPF-2026-B941'
  },
  { 
    id: 'ing_2', 
    name: 'Prime Australian Mutton / Lamb Shoulder (Carton of 20kg)', 
    category: 'Meat & Poultry', 
    unit: 'carton', 
    costPerUnit: 680.00, 
    stockQuantity: 3.0, 
    reorderLevel: 1.0, 
    supplier: 'Gulf Meat Importers Co.', 
    wastageFactorPercent: 12,
    packagingUnit: 'Carton',
    subUnitName: 'kg mutton portions',
    subUnitsPerPackage: 20,
    stockSubUnits: 54, // 2 cartons + 14 kg
    packageCostAED: 680.00,
    subUnitCostAED: 34.00,
    reorderSubUnits: 20,
    storageLocation: 'Walk-in Meat Freezer #2 (Bay M-4)',
    lastPurchaseDate: '2026-10-12',
    batchNumber: 'GMI-M9930'
  },
  { 
    id: 'ing_3', 
    name: 'Royal Heritage Long-Grain Basmati Rice (Sack of 25kg)', 
    category: 'Dry Goods & Spices', 
    unit: 'sack', 
    costPerUnit: 130.00, 
    stockQuantity: 10.0, 
    reorderLevel: 3.0, 
    supplier: 'Kashmir Grain Merchants', 
    wastageFactorPercent: 1,
    packagingUnit: 'Sack',
    subUnitName: 'kg basmati rice',
    subUnitsPerPackage: 25,
    stockSubUnits: 235, // 9 sacks + 10 kg
    packageCostAED: 130.00,
    subUnitCostAED: 5.20,
    reorderSubUnits: 75,
    storageLocation: 'Dry Grain Store Room #3',
    lastPurchaseDate: '2026-10-10',
    batchNumber: 'KGM-R4412'
  },
  { 
    id: 'ing_4', 
    name: 'Pure Golden Sunflower Cooking Oil (Tin of 15 Liters)', 
    category: 'Dry Goods & Spices', 
    unit: 'tin', 
    costPerUnit: 90.00, 
    stockQuantity: 6.0, 
    reorderLevel: 2.0, 
    supplier: 'Afia Edible Oils UAE', 
    wastageFactorPercent: 0,
    packagingUnit: 'Tin',
    subUnitName: 'liters cooking oil',
    subUnitsPerPackage: 15,
    stockSubUnits: 78, // 5 tins + 3 Liters
    packageCostAED: 90.00,
    subUnitCostAED: 6.00,
    reorderSubUnits: 30,
    storageLocation: 'Dry Store Room #2 (Shelf O-1)',
    lastPurchaseDate: '2026-10-11',
    batchNumber: 'AF-O-5521'
  },
  { 
    id: 'ing_5', 
    name: 'Arabic Spices & Biryani Masala Blend (Pack of 5kg)', 
    category: 'Dry Goods & Spices', 
    unit: 'pack', 
    costPerUnit: 120.00, 
    stockQuantity: 7.0, 
    reorderLevel: 2.0, 
    supplier: 'Spice Souk Traders LLC', 
    wastageFactorPercent: 0,
    packagingUnit: 'Pack',
    subUnitName: 'kg masala blend',
    subUnitsPerPackage: 5,
    stockSubUnits: 32, // 6 packs + 2 kg
    packageCostAED: 120.00,
    subUnitCostAED: 24.00,
    reorderSubUnits: 10,
    storageLocation: 'Spice Vault Room (Hermetic Bin 4)',
    lastPurchaseDate: '2026-10-08',
    batchNumber: 'SST-SP-109'
  },
  { 
    id: 'ing_6', 
    name: 'Farm Fresh Golden Grade-A Eggs (Tray of 30 Eggs)', 
    category: 'Dairy', 
    unit: 'tray', 
    costPerUnit: 21.00, 
    stockQuantity: 8.0, 
    reorderLevel: 3.0, 
    supplier: 'Al Ain Poultry & Eggs', 
    wastageFactorPercent: 3,
    packagingUnit: 'Tray',
    subUnitName: 'eggs',
    subUnitsPerPackage: 30,
    stockSubUnits: 226, // 7 trays + 16 eggs
    packageCostAED: 21.00,
    subUnitCostAED: 0.70,
    reorderSubUnits: 90,
    storageLocation: 'Dairy Chiller #1',
    lastPurchaseDate: '2026-10-15',
    batchNumber: 'AAP-EGG-774'
  },
  { 
    id: 'ing_7', 
    name: 'Red Cooking Onions (Mesh Bag of 10kg)', 
    category: 'Produce', 
    unit: 'bag', 
    costPerUnit: 35.00, 
    stockQuantity: 12.0, 
    reorderLevel: 3.0, 
    supplier: 'Barakat Produce LLC', 
    wastageFactorPercent: 8,
    packagingUnit: 'Bag',
    subUnitName: 'kg onions',
    subUnitsPerPackage: 10,
    stockSubUnits: 108, // 10 bags + 8 kg
    packageCostAED: 35.00,
    subUnitCostAED: 3.50,
    reorderSubUnits: 30,
    storageLocation: 'Cool Root Cellar (Bin ON-3)',
    lastPurchaseDate: '2026-10-14',
    batchNumber: 'BKT-ON-883'
  },
  { 
    id: 'ing_8', 
    name: 'Fresh Hammour & White Fish Fillet (Box of 10kg)', 
    category: 'Seafood', 
    unit: 'box', 
    costPerUnit: 280.00, 
    stockQuantity: 5.5, 
    reorderLevel: 2.0, 
    supplier: 'Deira Fish Market Direct', 
    wastageFactorPercent: 10,
    packagingUnit: 'Box',
    subUnitName: 'kg fish fillets',
    subUnitsPerPackage: 10,
    stockSubUnits: 48, // 4 boxes + 8 kg
    packageCostAED: 280.00,
    subUnitCostAED: 28.00,
    reorderSubUnits: 20,
    storageLocation: 'Seafood Deep Freeze #3',
    lastPurchaseDate: '2026-10-13',
    batchNumber: 'DFM-FF-302'
  },
  { 
    id: 'ing_9', 
    name: 'Penne Rigate & Hakka Egg Noodles (Box of 10kg)', 
    category: 'Dry Goods & Spices', 
    unit: 'box', 
    costPerUnit: 65.00, 
    stockQuantity: 9.0, 
    reorderLevel: 3.0, 
    supplier: 'Al Maya Distribution', 
    wastageFactorPercent: 1,
    packagingUnit: 'Box',
    subUnitName: 'kg noodles/pasta',
    subUnitsPerPackage: 10,
    stockSubUnits: 85,
    packageCostAED: 65.00,
    subUnitCostAED: 6.50,
    reorderSubUnits: 30,
    storageLocation: 'Dry Store Room #2',
    lastPurchaseDate: '2026-10-09',
    batchNumber: 'AMD-PST-611'
  },
  { 
    id: 'ing_10', 
    name: 'Pure Desi Ghee & Fresh Dairy Butter (Tin of 10kg)', 
    category: 'Dairy', 
    unit: 'tin', 
    costPerUnit: 220.00, 
    stockQuantity: 7.0, 
    reorderLevel: 2.0, 
    supplier: 'Lurpak & Almarai Dairy', 
    wastageFactorPercent: 2,
    packagingUnit: 'Tin',
    subUnitName: 'kg ghee/butter',
    subUnitsPerPackage: 10,
    stockSubUnits: 66,
    packageCostAED: 220.00,
    subUnitCostAED: 22.00,
    reorderSubUnits: 20,
    storageLocation: 'Chiller Dairy Vault',
    lastPurchaseDate: '2026-10-12',
    batchNumber: 'ALM-GH-902'
  },
  { 
    id: 'ing_11', 
    name: 'Fresh Full Cream Milk & Yoghurt (Crate of 12 Liters)', 
    category: 'Dairy', 
    unit: 'crate', 
    costPerUnit: 50.40, 
    stockQuantity: 10.0, 
    reorderLevel: 3.0, 
    supplier: 'Al Rawabi Dairy Co.', 
    wastageFactorPercent: 2,
    packagingUnit: 'Crate',
    subUnitName: 'liters milk/laban',
    subUnitsPerPackage: 12,
    stockSubUnits: 114,
    packageCostAED: 50.40,
    subUnitCostAED: 4.20,
    reorderSubUnits: 36,
    storageLocation: 'Dairy Chiller #1',
    lastPurchaseDate: '2026-10-15',
    batchNumber: 'RAW-MK-332'
  },
  { 
    id: 'ing_12', 
    name: 'Heavy Cooking & Whipping Cream (Pack of 6x1L)', 
    category: 'Dairy', 
    unit: 'pack', 
    costPerUnit: 57.00, 
    stockQuantity: 1.5, // LOW STOCK ALERT ITEM!
    reorderLevel: 3.0, 
    supplier: 'Almarai Pro Foodservice', 
    wastageFactorPercent: 2,
    packagingUnit: 'Pack',
    subUnitName: 'liters whipping cream',
    subUnitsPerPackage: 6,
    stockSubUnits: 8, // ONLY 8 LITERS LEFT - BELOW THRESHOLD OF 18!
    packageCostAED: 57.00,
    subUnitCostAED: 9.50,
    reorderSubUnits: 18,
    storageLocation: 'Chiller Dairy Vault',
    lastPurchaseDate: '2026-10-07',
    batchNumber: 'ALM-CRM-401'
  },
  { 
    id: 'ing_13', 
    name: 'Fresh Garlic Cloves & Ginger (Bag of 5kg)', 
    category: 'Produce', 
    unit: 'bag', 
    costPerUnit: 30.00, 
    stockQuantity: 1.2, // LOW STOCK ALERT ITEM!
    reorderLevel: 2.0, 
    supplier: 'Sun Fresh Greens LLC', 
    wastageFactorPercent: 5,
    packagingUnit: 'Bag',
    subUnitName: 'kg garlic/ginger',
    subUnitsPerPackage: 5,
    stockSubUnits: 6, // ONLY 6 KG LEFT - BELOW THRESHOLD OF 10!
    packageCostAED: 30.00,
    subUnitCostAED: 6.00,
    reorderSubUnits: 10,
    storageLocation: 'Produce Chiller #2',
    lastPurchaseDate: '2026-10-06',
    batchNumber: 'SFG-GG-219'
  },
  { 
    id: 'ing_14', 
    name: 'Fresh Arabic Khubz & Burger Buns (Bag of 100 pcs)', 
    category: 'Bakery', 
    unit: 'bag', 
    costPerUnit: 40.00, 
    stockQuantity: 4.5, 
    reorderLevel: 2.0, 
    supplier: 'Golden Spike Bakeries', 
    wastageFactorPercent: 3,
    packagingUnit: 'Bag',
    subUnitName: 'breads/buns',
    subUnitsPerPackage: 100,
    stockSubUnits: 430,
    packageCostAED: 40.00,
    subUnitCostAED: 0.40,
    reorderSubUnits: 200,
    storageLocation: 'Bakery Bread Room',
    lastPurchaseDate: '2026-10-15',
    batchNumber: 'GSB-BN-880'
  },
  { 
    id: 'ing_15', 
    name: 'Mineral Water & Soft Drink Assortment (Case of 24 Cans)', 
    category: 'Beverages', 
    unit: 'case', 
    costPerUnit: 21.60, 
    stockQuantity: 30.0, 
    reorderLevel: 8.0, 
    supplier: 'Al Ain Mineral Water', 
    wastageFactorPercent: 0,
    packagingUnit: 'Case',
    subUnitName: 'cans/bottles',
    subUnitsPerPackage: 24,
    stockSubUnits: 690,
    packageCostAED: 21.60,
    subUnitCostAED: 0.90,
    reorderSubUnits: 192,
    storageLocation: 'Beverage Storeroom B-1',
    lastPurchaseDate: '2026-10-11',
    batchNumber: 'AAW-BEV-992'
  },
];

export const INITIAL_RECIPES: RecipeMenuItem[] = [
  {
    id: 'rec_shorbat',
    name: 'Shorbat Adas (Traditional Spiced Lentil Soup)',
    category: 'Soups & Starters',
    portionYield: 1,
    prepLaborCostPerPortion: 0.60,
    utilityOverheadPerPortion: 0.30,
    ingredients: [
      { ingredientId: 'ing_16', ingredientName: 'Red Split Lentils', unit: 'kg', quantityPerPortion: 0.06, unitCost: 5.50, calculatedCost: 0.33 },
      { ingredientId: 'ing_9', ingredientName: 'Fresh Onions & Vegetables', unit: 'kg', quantityPerPortion: 0.04, unitCost: 3.50, calculatedCost: 0.14 },
      { ingredientId: 'ing_5', ingredientName: 'Cumin & Arabic Spices', unit: 'kg', quantityPerPortion: 0.005, unitCost: 24.00, calculatedCost: 0.12 },
      { ingredientId: 'ing_14', ingredientName: 'Crispy Fried Bread Croutons', unit: 'piece', quantityPerPortion: 0.5, unitCost: 0.40, calculatedCost: 0.20 },
    ],
    totalCostPerPortion: 1.69,
    suggestedSellingPrice: 8.00,
    targetFoodCostPercent: 21.1,
    description: 'Velvety golden red lentil soup simmered with cumin, garlic and served with toasted Arabic bread.',
    dietary: ['Vegetarian', 'Vegan', 'Halal'],
  },
  {
    id: 'rec_hummus_fattoush',
    name: 'Authentic Mezze Duo (Creamy Hummus & Fattoush Salad)',
    category: 'Salads & Cold Mezze',
    portionYield: 1,
    prepLaborCostPerPortion: 0.90,
    utilityOverheadPerPortion: 0.20,
    ingredients: [
      { ingredientId: 'ing_7', ingredientName: 'Cooked Chickpeas', unit: 'kg', quantityPerPortion: 0.08, unitCost: 4.80, calculatedCost: 0.38 },
      { ingredientId: 'ing_8', ingredientName: 'Sesame Tahina Paste', unit: 'kg', quantityPerPortion: 0.025, unitCost: 16.00, calculatedCost: 0.40 },
      { ingredientId: 'ing_9', ingredientName: 'Tomatoes, Cucumbers, Radish, Mint', unit: 'kg', quantityPerPortion: 0.10, unitCost: 3.50, calculatedCost: 0.35 },
      { ingredientId: 'ing_14', ingredientName: 'Fresh Arabic Khubz Breads', unit: 'piece', quantityPerPortion: 1.0, unitCost: 0.40, calculatedCost: 0.40 },
    ],
    totalCostPerPortion: 2.83,
    suggestedSellingPrice: 10.00,
    targetFoodCostPercent: 28.3,
    description: 'Silky whipped chickpeas with tahini and extra virgin olive oil, paired with crisp Fattoush tossed in sumac & pomegranate molasses.',
    dietary: ['Vegetarian', 'Vegan', 'Halal'],
  },
  {
    id: 'rec_tawook',
    name: 'Charcoal Grilled Chicken Shish Tawook with Toum Garlic',
    category: 'Main Courses',
    portionYield: 1,
    prepLaborCostPerPortion: 1.80,
    utilityOverheadPerPortion: 0.50,
    ingredients: [
      { ingredientId: 'ing_1', ingredientName: 'Fresh Boneless Chicken', unit: 'kg', quantityPerPortion: 0.24, unitCost: 18.50, calculatedCost: 4.44 },
      { ingredientId: 'ing_13', ingredientName: 'Garlic Toum & Yoghurt Marinade', unit: 'kg', quantityPerPortion: 0.05, unitCost: 6.00, calculatedCost: 0.30 },
      { ingredientId: 'ing_5', ingredientName: 'Cardamom & Paprika Spices', unit: 'kg', quantityPerPortion: 0.01, unitCost: 24.00, calculatedCost: 0.24 },
    ],
    totalCostPerPortion: 7.28,
    suggestedSellingPrice: 22.00,
    targetFoodCostPercent: 33.1,
    description: 'Juicy skewers of chicken breast marinated in lemon, garlic, yoghurt and grilled over hot coals.',
    dietary: ['Halal', 'Gluten-Free'],
  },
  {
    id: 'rec_biryani',
    name: 'Royal Mutton & Dum Biryani with Spiced Yoghurt Raita',
    category: 'Main Courses',
    portionYield: 1,
    prepLaborCostPerPortion: 1.50,
    utilityOverheadPerPortion: 0.50,
    ingredients: [
      { ingredientId: 'ing_2', ingredientName: 'Tender Australian Mutton', unit: 'kg', quantityPerPortion: 0.16, unitCost: 34.00, calculatedCost: 5.44 },
      { ingredientId: 'ing_3', ingredientName: 'Long-Grain Basmati Rice', unit: 'kg', quantityPerPortion: 0.10, unitCost: 5.20, calculatedCost: 0.52 },
      { ingredientId: 'ing_10', ingredientName: 'Cooking Ghee & Butter', unit: 'kg', quantityPerPortion: 0.02, unitCost: 22.00, calculatedCost: 0.44 },
      { ingredientId: 'ing_11', ingredientName: 'Spiced Yoghurt Raita', unit: 'L', quantityPerPortion: 0.06, unitCost: 4.20, calculatedCost: 0.25 },
    ],
    totalCostPerPortion: 8.65,
    suggestedSellingPrice: 24.00,
    targetFoodCostPercent: 36.0,
    description: 'Aromatic layered Basmati rice sealed on slow dum with tender spiced mutton, fried onions, and cool cucumber raita.',
    dietary: ['Halal', 'Gluten-Free'],
  },
  {
    id: 'rec_pasta',
    name: 'Creamy Penne Alfredo Pasta with Sweet Corn & Herbs',
    category: 'Rice, Breads & Accompaniments',
    portionYield: 1,
    prepLaborCostPerPortion: 0.80,
    utilityOverheadPerPortion: 0.30,
    ingredients: [
      { ingredientId: 'ing_6', ingredientName: 'Penne Rigate Pasta', unit: 'kg', quantityPerPortion: 0.08, unitCost: 6.50, calculatedCost: 0.52 },
      { ingredientId: 'ing_12', ingredientName: 'Cooking Cream & Parmesan', unit: 'L', quantityPerPortion: 0.05, unitCost: 9.50, calculatedCost: 0.48 },
      { ingredientId: 'ing_10', ingredientName: 'Butter', unit: 'kg', quantityPerPortion: 0.015, unitCost: 22.00, calculatedCost: 0.33 },
    ],
    totalCostPerPortion: 2.43,
    suggestedSellingPrice: 8.00,
    targetFoodCostPercent: 30.4,
    description: 'Italian penne pasta tossed in rich garlic cream sauce, sweet corn kernels and dried Italian oregano.',
    dietary: ['Vegetarian', 'Halal'],
  },
  {
    id: 'rec_ummali',
    name: 'Warm Egyptian Umm Ali with Pistachios & Raisins',
    category: 'Desserts & Sweets',
    portionYield: 1,
    prepLaborCostPerPortion: 0.70,
    utilityOverheadPerPortion: 0.25,
    ingredients: [
      { ingredientId: 'ing_15', ingredientName: 'Flaked Pastry & Crushed Nuts', unit: 'kg', quantityPerPortion: 0.05, unitCost: 14.00, calculatedCost: 0.70 },
      { ingredientId: 'ing_11', ingredientName: 'Fresh Full Cream Milk', unit: 'L', quantityPerPortion: 0.12, unitCost: 4.20, calculatedCost: 0.50 },
      { ingredientId: 'ing_12', ingredientName: 'Whipped Cream Topping', unit: 'L', quantityPerPortion: 0.03, unitCost: 9.50, calculatedCost: 0.27 },
    ],
    totalCostPerPortion: 2.42,
    suggestedSellingPrice: 9.00,
    targetFoodCostPercent: 26.9,
    description: 'Classic warm puff pastry bread pudding baked with sweetened hot milk, toasted pistachios, and coconut flakes.',
    dietary: ['Vegetarian', 'Halal'],
  },
  {
    id: 'rec_drinks',
    name: 'Chilled Refreshment Station (Water & Soft Drinks Assortment)',
    category: 'Welcome Drinks',
    portionYield: 1,
    prepLaborCostPerPortion: 0.20,
    utilityOverheadPerPortion: 0.10,
    ingredients: [
      { ingredientId: 'ing_17', ingredientName: 'Assorted Canned Beverages & Mineral Water', unit: 'piece', quantityPerPortion: 2.0, unitCost: 0.90, calculatedCost: 1.80 },
    ],
    totalCostPerPortion: 2.10,
    suggestedSellingPrice: 5.00,
    targetFoodCostPercent: 42.0,
    description: 'Free flow iced bottled mineral water and assorted soft beverages served throughout the banquet celebration.',
    dietary: ['Halal', 'Vegetarian', 'Vegan'],
  },
  {
    id: 'rec_fish',
    name: 'Pan-Seared Hammour Fish Fillet in Lemon Herb Butter',
    category: 'Main Courses',
    portionYield: 1,
    prepLaborCostPerPortion: 1.60,
    utilityOverheadPerPortion: 0.40,
    ingredients: [
      { ingredientId: 'ing_4', ingredientName: 'Fresh Hammour Fish Fillet', unit: 'kg', quantityPerPortion: 0.18, unitCost: 28.00, calculatedCost: 5.04 },
      { ingredientId: 'ing_10', ingredientName: 'Butter & Lemon', unit: 'kg', quantityPerPortion: 0.03, unitCost: 22.00, calculatedCost: 0.66 },
    ],
    totalCostPerPortion: 7.70,
    suggestedSellingPrice: 25.00,
    targetFoodCostPercent: 30.8,
    description: 'Crisp seared local Hammour fish with silky lemon garlic butter and capers.',
    dietary: ['Halal', 'Gluten-Free'],
  },
];

export const INITIAL_PACKAGES: BanquetPackage[] = [
  {
    id: 'pkg_60',
    name: 'Standard Celebration Buffet (60 AED / Person)',
    description: 'Popular celebration buffet for parties of 30+ guests. Includes Shorbat Adas, Hummus & Fattoush, Chicken Shish Tawook, Mutton Biryani, Creamy Penne Alfredo, Umm Ali dessert, and Water/Soft drinks.',
    tier: '60_aed',
    pricePerGuest: 60.00,
    costPerGuest: 27.40,
    itemIds: ['rec_shorbat', 'rec_hummus_fattoush', 'rec_tawook', 'rec_biryani', 'rec_pasta', 'rec_ummali', 'rec_drinks'],
    minimumGuests: 30,
    courseCount: 7,
  },
  {
    id: 'pkg_80',
    name: 'Executive Deluxe Buffet (80 AED / Person)',
    description: 'Elevated celebration buffet including everything in the 60 AED menu plus Pan-Seared Hammour Fish Fillet in Lemon Butter and expanded dessert options.',
    tier: '80_aed',
    pricePerGuest: 80.00,
    costPerGuest: 35.10,
    itemIds: ['rec_shorbat', 'rec_hummus_fattoush', 'rec_tawook', 'rec_biryani', 'rec_fish', 'rec_pasta', 'rec_ummali', 'rec_drinks'],
    minimumGuests: 30,
    courseCount: 8,
  },
  {
    id: 'pkg_100',
    name: 'Royal Imperial Feast Buffet (100 AED / Person)',
    description: 'Flagship banquet buffet with slow-cooked Lamb Ouzi, Hammour fish, Charcoal Shish Tawook, Mutton Biryani, and deluxe Arabic sweets.',
    tier: '100_aed',
    pricePerGuest: 100.00,
    costPerGuest: 42.23,
    itemIds: ['rec_shorbat', 'rec_hummus_fattoush', 'rec_tawook', 'rec_fish', 'rec_pasta', 'rec_ummali', 'rec_drinks'],
    minimumGuests: 30,
    courseCount: 7,
  },
];

export const INITIAL_BOOKINGS: BookingEvent[] = [];

export const INITIAL_INVOICES: Invoice[] = [];

export const INITIAL_BACKUPS: BackupRecord[] = [
  {
    id: 'bak_001',
    timestamp: '2026-10-14T05:00:00Z',
    sizeBytes: 345000,
    sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    encryptionAlgorithm: 'AES-256-GCM',
    recordsCount: {
      bookings: 10,
      recipes: 8,
      ingredients: 17,
      invoices: 3,
    },
    status: 'Synced to Cloud Vault',
    initiatedBy: 'System Auto-Backup (Crystal Plaza Hotel Daily 05:00)',
  },
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud_1',
    timestamp: '2026-10-14 06:15:22',
    userId: 'user_fnb',
    userName: 'F&B Supervisor',
    action: 'F&B Booking Registered for Mr. Betsy',
    details: 'Get-Together party for 30 guests booked with 60 AED Buffet Menu at First Floor Big Hall. Free banquet hall offer applied.',
    category: 'Booking',
  },
  {
    id: 'aud_2',
    timestamp: '2026-10-14 05:00:00',
    userId: 'system',
    userName: 'Automated Cloud Security Daemon',
    action: 'Encrypted Cloud Backup Snapshot',
    details: 'Crystal Plaza Hotel banquet and food costing records encrypted via AES-256 with SHA-256 verification.',
    category: 'Security',
  },
];

export const INITIAL_STOCK_MOVEMENTS: KitchenStockMovement[] = [
  {
    id: 'mov_1',
    ingredientId: 'ing_1',
    ingredientName: 'Fresh Farm Chicken (Carton of 26 Bones/Pieces)',
    type: 'room_service_prep',
    quantityChanged: -2,
    packagesEquivalent: '-2 pieces (-0.08 carton)',
    remainingSubUnits: 128,
    reasonOrReference: 'Room Service: 1 Portion Chicken Biryani prepared',
    timestamp: '2026-10-15 14:30',
    performedBy: 'Executive Chef',
  },
  {
    id: 'mov_2',
    ingredientId: 'ing_1',
    ingredientName: 'Fresh Farm Chicken (Carton of 26 Bones/Pieces)',
    type: 'purchase_receipt',
    quantityChanged: 130,
    packagesEquivalent: '+5 cartons (+130 pieces)',
    remainingSubUnits: 130,
    reasonOrReference: 'Emirates Poultry Farms Delivery (Inv #EPF-2026-B941)',
    timestamp: '2026-10-14 09:15',
    performedBy: 'Accounts',
  },
  {
    id: 'mov_3',
    ingredientId: 'ing_3',
    ingredientName: 'Royal Heritage Long-Grain Basmati Rice (Sack of 25kg)',
    type: 'party_buffet_deduction',
    quantityChanged: -15,
    packagesEquivalent: '-15 kg (-0.60 sack)',
    remainingSubUnits: 235,
    reasonOrReference: 'Banquet Buffet Party for 30 Guests (Booking #BKT-CPH-2026-088)',
    timestamp: '2026-10-15 11:20',
    performedBy: 'Executive Chef',
  },
  {
    id: 'mov_4',
    ingredientId: 'ing_12',
    ingredientName: 'Heavy Cooking & Whipping Cream (Pack of 6x1L)',
    type: 'party_buffet_deduction',
    quantityChanged: -4,
    packagesEquivalent: '-4 liters (-0.67 pack)',
    remainingSubUnits: 8,
    reasonOrReference: 'Umm Ali & Soup Batch Prep for Banquet',
    timestamp: '2026-10-15 17:00',
    performedBy: 'Executive Chef',
  },
];

export const INITIAL_ROOM_SERVICE_DISHES: RoomServiceDish[] = [
  {
    id: 'rs_biryani',
    name: 'Hyderabadi Dum Chicken Biryani',
    category: 'Biryani & Rice',
    portionYield: 1,
    ingredients: [
      { ingredientId: 'ing_1', ingredientName: 'Chicken Pieces/Bones', quantity: 2, unit: 'pieces', subUnitsUsed: 2, costAED: 10.00 },
      { ingredientId: 'ing_3', ingredientName: 'Basmati Rice', quantity: 0.25, unit: 'kg', costAED: 1.30 },
      { ingredientId: 'ing_10', ingredientName: 'Desi Ghee & Butter', quantity: 0.04, unit: 'kg', costAED: 0.88 },
      { ingredientId: 'ing_5', ingredientName: 'Biryani Spices & Saffron', quantity: 0.02, unit: 'kg', costAED: 0.48 },
      { ingredientId: 'ing_7', ingredientName: 'Crispy Fried Onions', quantity: 0.10, unit: 'kg', costAED: 0.35 },
      { ingredientId: 'ing_11', ingredientName: 'Yoghurt for Raita', quantity: 0.10, unit: 'L', costAED: 0.42 },
    ],
    prepLaborCostAED: 3.50,
    utilityOverheadAED: 0.80,
    totalDishCostAED: 17.43,
    sellingPriceAED: 52.00,
    targetFoodCostPercent: 28.0,
    actualFoodCostPercent: 25.8,
    grossMarginAED: 34.57,
    marginPercent: 66.5,
    description: 'Fragrant basmati rice layered with 2 succulent chicken pieces cooked on slow dum with royal spices and saffron. Served with mint raita.',
    dietary: ['Halal'],
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'rs_noodles',
    name: 'Wok-Tossed Chicken Hakka Noodles',
    category: 'Room Service Mains',
    portionYield: 1,
    ingredients: [
      { ingredientId: 'ing_1', ingredientName: 'Shredded Chicken (from Carton)', quantity: 1, unit: 'pieces', subUnitsUsed: 1, costAED: 5.00 },
      { ingredientId: 'ing_9', ingredientName: 'Egg Hakka Noodles', quantity: 0.20, unit: 'kg', costAED: 1.30 },
      { ingredientId: 'ing_7', ingredientName: 'Wok Vegetables & Bell Peppers', quantity: 0.12, unit: 'kg', costAED: 0.50 },
      { ingredientId: 'ing_4', ingredientName: 'Sesame & Garlic Oil', quantity: 0.03, unit: 'L', costAED: 0.18 },
      { ingredientId: 'ing_13', ingredientName: 'Fresh Garlic & Ginger Paste', quantity: 0.02, unit: 'kg', costAED: 0.12 },
    ],
    prepLaborCostAED: 2.50,
    utilityOverheadAED: 0.60,
    totalDishCostAED: 9.70,
    sellingPriceAED: 44.00,
    targetFoodCostPercent: 25.0,
    actualFoodCostPercent: 16.1,
    grossMarginAED: 34.30,
    marginPercent: 78.0,
    description: 'Wok-charred noodles tossed with julienned chicken, crisp spring vegetables, and garlic-soy glaze.',
    dietary: ['Halal'],
    imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'rs_club_sandwich',
    name: 'Crystal Plaza Triple-Decker Club Sandwich',
    category: 'Sandwiches & Burgers',
    portionYield: 1,
    ingredients: [
      { ingredientId: 'ing_1', ingredientName: 'Grilled Chicken Breast (from Carton)', quantity: 1, unit: 'pieces', subUnitsUsed: 1, costAED: 5.00 },
      { ingredientId: 'ing_6', ingredientName: 'Fried Farm Egg', quantity: 1, unit: 'eggs', subUnitsUsed: 1, costAED: 0.70 },
      { ingredientId: 'ing_14', ingredientName: 'Toasted Bread Slices', quantity: 3, unit: 'breads/buns', subUnitsUsed: 3, costAED: 1.20 },
      { ingredientId: 'ing_7', ingredientName: 'Lettuce, Tomato & Pickles', quantity: 0.08, unit: 'kg', costAED: 0.35 },
      { ingredientId: 'ing_10', ingredientName: 'Herb Butter & Mayo Spread', quantity: 0.03, unit: 'kg', costAED: 0.66 },
    ],
    prepLaborCostAED: 2.00,
    utilityOverheadAED: 0.40,
    totalDishCostAED: 10.31,
    sellingPriceAED: 46.00,
    targetFoodCostPercent: 26.0,
    actualFoodCostPercent: 17.2,
    grossMarginAED: 35.69,
    marginPercent: 77.6,
    description: 'Triple-decker toasted bread layered with sliced grilled chicken, fried egg, cheddar, crisp lettuce, tomatoes and french fries.',
    dietary: ['Halal'],
    imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'rs_mutton_rogan',
    name: 'Kashmiri Mutton Rogan Josh with Naan',
    category: 'Room Service Mains',
    portionYield: 1,
    ingredients: [
      { ingredientId: 'ing_2', ingredientName: 'Tender Australian Mutton Chunks', quantity: 0.25, unit: 'kg mutton portions', subUnitsUsed: 0.25, costAED: 8.50 },
      { ingredientId: 'ing_11', ingredientName: 'Yoghurt Gravy Base', quantity: 0.12, unit: 'L', costAED: 0.50 },
      { ingredientId: 'ing_5', ingredientName: 'Rogan Josh Spices & Ratanjot', quantity: 0.025, unit: 'kg', costAED: 0.60 },
      { ingredientId: 'ing_10', ingredientName: 'Desi Ghee', quantity: 0.03, unit: 'kg', costAED: 0.66 },
      { ingredientId: 'ing_14', ingredientName: 'Fresh Butter Naan (2 pcs)', quantity: 2, unit: 'breads/buns', subUnitsUsed: 2, costAED: 0.80 },
    ],
    prepLaborCostAED: 3.50,
    utilityOverheadAED: 0.80,
    totalDishCostAED: 14.86,
    sellingPriceAED: 58.00,
    targetFoodCostPercent: 30.0,
    actualFoodCostPercent: 19.1,
    grossMarginAED: 43.14,
    marginPercent: 74.4,
    description: 'Slow-braised mutton shoulder chunks in an aromatic Kashmiri spiced gravy infused with mace, cardamom, and fennel.',
    dietary: ['Halal'],
    imageUrl: 'https://images.unsplash.com/photo-1545247181-516773cae754?w=600&auto=format&fit=crop&q=80',
  },
];

export const INITIAL_MARKETING_REPORTS: MetaAdMonthlyReport[] = MULTI_YEAR_MARKETING_REPORTS;

// ===========================================================================
// INITIAL HOTEL ROOM GUESTS FOR WHATSAPP RETARGETING
// Extracted from Crystal Plaza Hotel PMS Room Folios & Stays Database
// ===========================================================================
export const INITIAL_HOTEL_ROOM_GUESTS: HotelRoomGuest[] = [
  {
    id: 'gst_cph_101',
    name: 'Sheikh Mansoor Al-Ketbi',
    phone: '+971 50 123 9876',
    cleanPhone: '971501239876',
    roomNumber: '801',
    roomType: 'Royal Penthouse Suite',
    checkInDate: '2026-10-02',
    checkOutDate: '2026-10-06',
    nights: 4,
    totalSpendAED: 7800,
    guestCategory: 'VIP',
    cityOrCountry: 'Abu Dhabi, UAE',
    status: 'pending',
    notes: 'Inquired about hosting a 90-guest private family anniversary banquet in December.',
  },
  {
    id: 'gst_cph_102',
    name: 'Eng. Tariq Al-Hashimi',
    phone: '+966 50 456 7891',
    cleanPhone: '966504567891',
    roomNumber: '512',
    roomType: 'Executive King Room',
    checkInDate: '2026-10-08',
    checkOutDate: '2026-10-12',
    nights: 4,
    totalSpendAED: 3450,
    guestCategory: 'Corporate Business',
    cityOrCountry: 'Riyadh, KSA',
    status: 'pending',
    notes: 'Managing partner for regional engineering firm. Needs meeting space with AV projector.',
  },
  {
    id: 'gst_cph_103',
    name: 'Dr. Sarah Jenkins',
    phone: '+44 7911 123456',
    cleanPhone: '447911123456',
    roomNumber: '304',
    roomType: 'Deluxe Double Room',
    checkInDate: '2026-10-05',
    checkOutDate: '2026-10-11',
    nights: 6,
    totalSpendAED: 4900,
    guestCategory: 'Family Leisure',
    cityOrCountry: 'London, UK',
    status: 'pending',
    notes: 'Praised hotel breakfast buffet. Interested in catering for family reunion.',
  },
  {
    id: 'gst_cph_104',
    name: 'Mohammed Al-Kuwari',
    phone: '+974 55 123456',
    cleanPhone: '97455123456',
    roomNumber: '620',
    roomType: 'Executive Suite',
    checkInDate: '2026-09-28',
    checkOutDate: '2026-10-03',
    nights: 5,
    totalSpendAED: 5200,
    guestCategory: 'Frequent Stay',
    cityOrCountry: 'Doha, Qatar',
    status: 'sent',
    lastSentAt: '2026-10-18T14:30:00Z',
    notes: 'Regular guest every quarter. Sent Free Banquet Hall Offer.',
  },
  {
    id: 'gst_cph_105',
    name: 'Rajesh & Priya Patel',
    phone: '+971 55 678 1234',
    cleanPhone: '971556781234',
    roomNumber: '415',
    roomType: 'Deluxe King Room',
    checkInDate: '2026-10-12',
    checkOutDate: '2026-10-15',
    nights: 3,
    totalSpendAED: 2600,
    guestCategory: 'Weekend Staycation',
    cityOrCountry: 'Dubai, UAE',
    status: 'responded',
    lastSentAt: '2026-10-17T11:15:00Z',
    notes: 'Responded asking for 60 AED buffet menu details for 40-person birthday party.',
  },
  {
    id: 'gst_cph_106',
    name: 'Ahmed bin Saeed',
    phone: '+968 9123 4567',
    cleanPhone: '96891234567',
    roomNumber: '702',
    roomType: 'Executive King Room',
    checkInDate: '2026-10-09',
    checkOutDate: '2026-10-13',
    nights: 4,
    totalSpendAED: 3800,
    guestCategory: 'VIP',
    cityOrCountry: 'Muscat, Oman',
    status: 'pending',
    notes: 'Frequent visitor for Sharjah trade fairs. High spending guest.',
  },
  {
    id: 'gst_cph_107',
    name: 'Khalid Al-Otaibi',
    phone: '+966 55 123 9870',
    cleanPhone: '966551239870',
    roomNumber: '508',
    roomType: 'Deluxe Suite',
    checkInDate: '2026-10-01',
    checkOutDate: '2026-10-05',
    nights: 4,
    totalSpendAED: 3950,
    guestCategory: 'Corporate Business',
    cityOrCountry: 'Dammam, KSA',
    status: 'pending',
    notes: 'Corporate procurement director. Potential for company annual conference.',
  },
  {
    id: 'gst_cph_108',
    name: 'David & Emma Wilson',
    phone: '+61 412 345 678',
    cleanPhone: '61412345678',
    roomNumber: '215',
    roomType: 'Standard Twin Room',
    checkInDate: '2026-10-06',
    checkOutDate: '2026-10-10',
    nights: 4,
    totalSpendAED: 2200,
    guestCategory: 'Honeymoon & Couples',
    cityOrCountry: 'Sydney, Australia',
    status: 'sent',
    lastSentAt: '2026-10-19T09:40:00Z',
    notes: 'Sent VIP Dining and Weekend Brunch Privilege voucher.',
  },
  {
    id: 'gst_cph_109',
    name: 'Fatima Al-Zahra',
    phone: '+971 52 998 8776',
    cleanPhone: '971529988776',
    roomNumber: '402',
    roomType: 'Deluxe Double Room',
    checkInDate: '2026-10-14',
    checkOutDate: '2026-10-17',
    nights: 3,
    totalSpendAED: 2450,
    guestCategory: 'Family Leisure',
    cityOrCountry: 'Sharjah, UAE',
    status: 'pending',
    notes: 'Local Sharjah resident who booked weekend stay. Prime candidate for local banquet hall retargeting.',
  },
  {
    id: 'gst_cph_110',
    name: 'Vikram Sharma',
    phone: '+91 98201 23456',
    cleanPhone: '919820123456',
    roomNumber: '318',
    roomType: 'Executive King Room',
    checkInDate: '2026-10-03',
    checkOutDate: '2026-10-07',
    nights: 4,
    totalSpendAED: 3100,
    guestCategory: 'Corporate Business',
    cityOrCountry: 'Mumbai, India',
    status: 'pending',
    notes: 'Exhibitor at Expo Centre Sharjah. Wants corporate dinner catering for team.',
  },
  {
    id: 'gst_cph_111',
    name: 'Sultan Al-Nuaimi',
    phone: '+971 50 882 1100',
    cleanPhone: '971508821100',
    roomNumber: '610',
    roomType: 'Executive Suite',
    checkInDate: '2026-09-25',
    checkOutDate: '2026-09-30',
    nights: 5,
    totalSpendAED: 6100,
    guestCategory: 'Frequent Stay',
    cityOrCountry: 'Ajman, UAE',
    status: 'converted',
    lastSentAt: '2026-10-15T16:00:00Z',
    notes: 'Converted! Booked Alumni Reunion banquet on Oct 22 for 75 guests.',
  },
  {
    id: 'gst_cph_112',
    name: 'Pierre & Chloe Dubois',
    phone: '+33 6 12 34 56 78',
    cleanPhone: '33612345678',
    roomNumber: '309',
    roomType: 'Deluxe King Room',
    checkInDate: '2026-10-10',
    checkOutDate: '2026-10-14',
    nights: 4,
    totalSpendAED: 3300,
    guestCategory: 'Weekend Staycation',
    cityOrCountry: 'Paris, France',
    status: 'pending',
    notes: 'Celebrated anniversary during stay. Offered staycation and romantic banquet dinner promo.',
  },
];

// ===========================================================================
// CURATED WHATSAPP RETARGETING OFFERS & PROMOTIONS
// With Photo, Headline, Description, Perks, and Promo Codes
// ===========================================================================
export const INITIAL_WHATSAPP_OFFERS: WhatsAppRetargetingOffer[] = [
  {
    id: 'off_free_hall',
    title: 'Free Banquet Hall Celebration Offer',
    badge: 'Banquet Exclusive',
    photoUrl: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1000&auto=format&fit=crop&q=80',
    headline: 'Host Your Next Celebration at Crystal Plaza – 100% Free Hall Hire!',
    description: 'As our valued past hotel guest, book your family gathering, birthday party, wedding reception, or corporate dinner with us and receive our First Floor Big Hall or Suite room Hall hire completely FREE when booking our 60, 80, or 100 AED per guest luxury buffet menus.',
    perks: [
      '100% Free Banquet Hall Rental (Save up to 1,500 AED)',
      'Lavish multi-course buffet with live carving & dessert stations',
      'Complimentary audio-visual system, projector & celebratory cake table',
      'Dedicated F&B event supervisor and five-star hospitality staff'
    ],
    promoCode: 'CPH-FREEHALL-GUEST',
    discountValue: 'Free Hall (Save 1,500 AED)',
    validUntil: '31 Dec 2026',
    targetCategory: 'All Guests (Families, Weddings, Birthdays)',
  },
  {
    id: 'off_vip_dining',
    title: 'VIP Dining & Royal Buffet Privilege',
    badge: 'F&B Privilege',
    photoUrl: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=1000&auto=format&fit=crop&q=80',
    headline: 'Exclusive 25% Off Dining & Weekend Brunch at Al-Diwan Restaurant',
    description: 'Craving our executive chef’s authentic charcoal shish tawook, slow-dum mutton biryani, and warm Umm Ali? Return to Crystal Plaza for a premier dining experience and receive 25% off your entire dining bill for parties of up to 10 guests.',
    perks: [
      '25% off entire F&B bill across lunch, dinner & weekend buffet',
      'Complimentary welcome mocktails and Arabic sweets platter',
      'Priority VIP table reservation near fountain view',
      'Free valet parking service'
    ],
    promoCode: 'VIP-DINING-25',
    discountValue: '25% Off Total Bill',
    validUntil: '15 Nov 2026',
    targetCategory: 'VIP & Frequent Stay Guests',
  },
  {
    id: 'off_staycation_upgrade',
    title: 'Welcome Back Staycation & Suite Upgrade',
    badge: 'Staycation Special',
    photoUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1000&auto=format&fit=crop&q=80',
    headline: 'Welcome Back Staycation – Free Suite Upgrade & 4 PM Late Checkout',
    description: 'We loved hosting you at Crystal Plaza Hotel! Book your next leisure escape or romantic weekend retreat and enjoy an instant 20% discount on direct bookings, plus a guaranteed complimentary room upgrade to an Executive Suite.',
    perks: [
      'Complimentary room upgrade to Executive King Suite (subject to availability)',
      'Leisurely 4:00 PM late check-out guaranteed',
      'Full gourmet international breakfast buffet for 2 included daily',
      '20% off all room service and banquet bookings'
    ],
    promoCode: 'CPH-RETURN-SUITE',
    discountValue: '20% Off + Suite Upgrade',
    validUntil: '30 Nov 2026',
    targetCategory: 'Leisure & Staycation Guests',
  },
  {
    id: 'off_corp_conference',
    title: 'Corporate Conference & Year-End Gala',
    badge: 'Corporate Special',
    photoUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1000&auto=format&fit=crop&q=80',
    headline: 'Executive Meeting & Year-End Corporate Dinner Packages',
    description: 'Planning an executive board meeting, regional conference, or company appreciation gala? Host your delegates in our First Floor Big Hall or Suite room Hall with custom delegate day rates from only 75 AED per person.',
    perks: [
      'High-definition projector, wireless mics & surround sound included',
      'Dedicated corporate event concierge throughout the session',
      '2 complimentary gourmet coffee, tea & artisan pastry breaks',
      '15% corporate rebate on year-end banquet dinners'
    ],
    promoCode: 'CORP-GALA-2026',
    discountValue: '15% Corporate Rebate',
    validUntil: '31 Dec 2026',
    targetCategory: 'Corporate Business Travelers',
  },
];

// ===========================================================================
// PRE-DEFINED WHATSAPP MESSAGE TEMPLATES
// Cleanly formatted with dynamic placeholders to prevent broken characters & asterisks
// ===========================================================================
export const INITIAL_WHATSAPP_TEMPLATES: WhatsAppMessageTemplate[] = [
  {
    id: 'tpl_banquet_celebration',
    name: 'Banquet Celebration (Free Hall Offer)',
    category: 'banquet',
    description: 'Perfect for retargeting families and past guests to book upcoming birthdays, weddings, and anniversaries with 100% free hall rental.',
    isDefault: true,
    content: `Assalamu Alaikum {guest_name},

We hope you had a pleasant and restful stay with us in Room {room_number} at Crystal Plaza Hotel & Casmia!

{offer_headline}

{offer_description}

Exclusive Privileges for Returning Guests:
{offer_perks}

Exclusive Promo Code: {promo_code}
Offer Valid Until: {valid_until}
View Official Flyer: {photo_url}

For VIP table reservations, ballroom walkthroughs, or custom menu planning with our Executive Chef, simply reply directly to this chat or call our F&B concierge at {hotel_phone}. We look forward to welcoming you back!`,
  },
  {
    id: 'tpl_vip_dining',
    name: 'VIP Dining & Royal Buffet (25% Off)',
    category: 'dining',
    description: 'Promote 25% off weekend brunches, lunch buffets, and dinners at Al-Diwan restaurant.',
    content: `Dear {guest_name},

Thank you for being our guest at Crystal Plaza Hotel & Casmia!

{offer_headline}

{offer_description}

Your VIP Privileges:
{offer_perks}

VIP Dining Code: {promo_code}
Valid Until: {valid_until}
Menu & Venue Photos: {photo_url}

To reserve a table for your family or friends, reply directly to this message or contact our restaurant desk at {hotel_phone}.`,
  },
  {
    id: 'tpl_staycation_upgrade',
    name: 'Welcome Back Staycation & Free Suite',
    category: 'staycation',
    description: 'Retarget weekend staycationers with guaranteed 20% discount, suite upgrade, and 4 PM late check-out.',
    content: `Good day {guest_name},

We loved hosting you in Room {room_number} ({room_type}) at Crystal Plaza Hotel!

{offer_headline}

{offer_description}

Your Staycation Privileges:
{offer_perks}

Direct Booking Code: {promo_code}
Offer Valid Until: {valid_until}
View Suite Photos: {photo_url}

To lock in your returning guest discount, reply here or call our reservations team at {hotel_phone}.`,
  },
  {
    id: 'tpl_corporate_gala',
    name: 'Corporate Meeting & Year-End Gala',
    category: 'corporate',
    description: 'Target corporate business travelers for annual conferences, board meetings, and company dinners.',
    content: `Dear {guest_name},

Warm greetings from Crystal Plaza Hotel & Casmia management.

{offer_headline}

{offer_description}

Corporate Package Highlights:
{offer_perks}

Corporate Reference Code: {promo_code}
Valid Until: {valid_until}
Conference Brochure: {photo_url}

To discuss delegate packages or arrange a private hall inspection, reply to this chat or contact our event team at {hotel_phone}.`,
  },
  {
    id: 'tpl_short_direct',
    name: 'Short & Direct Promo (High Response)',
    category: 'short',
    description: 'Quick 3-paragraph direct message for fast reading and instant replies.',
    content: `Hello {guest_name},

Special greeting from Crystal Plaza Hotel! As a thank-you for your stay in Room {room_number}, we have an exclusive privilege for you:

{offer_title} - {discount_value}
{offer_description}

Use Promo Code: {promo_code} (Valid until {valid_until})
Offer Details & Flyer: {photo_url}

Reply directly to this chat or call {hotel_phone} to claim your offer!`,
  },
  {
    id: 'tpl_clean_plain',
    name: 'Ultra-Clean Plain Text (Zero Asterisks)',
    category: 'clean',
    description: 'Pure, clean text with no markdown asterisks or complex symbols to ensure 100% compatibility across all devices.',
    content: `Assalamu Alaikum {guest_name},

We hope you had a pleasant stay with us in Room {room_number} at Crystal Plaza Hotel.

[Special Offer] {offer_title}
{offer_description}

Included Privileges:
{offer_perks}

- Promo Code: {promo_code}
- Discount: {discount_value}
- Valid Until: {valid_until}
- Offer Flyer: {photo_url}

To book or inquire, reply to this WhatsApp message or call {hotel_phone}.`,
  },
];

export const INITIAL_BANQUET_LEADS: BanquetLead[] = [
  {
    id: 'lead_1',
    clientName: 'Sultan Al-Maktoum Family',
    phone: '+971 50 123 4567',
    cleanPhone: '971501234567',
    email: 'sultan.maktoum@gmail.com',
    source: 'meta_instagram_ad',
    stage: 'new_lead',
    targetEventDate: '2026-11-20',
    estimatedGuests: 120,
    budgetAED: 15000,
    hallPreference: 'First Floor Big Hall',
    buffetPreference: 'Royal Wedding Feast (100 AED/pax)',
    adCampaignName: 'Royal Wedding & Mega Reception (100 AED Buffet)',
    notes: 'Clicked Instagram Ad for Royal Wedding Feast. Inquired about stage lighting and bridal suite inclusion.',
    followUpStatus: 'requires_urgent_call',
    createdAt: '2026-10-14T09:30:00Z',
  },
  {
    id: 'lead_2',
    clientName: 'Dr. Tariq Al-Nuaimi',
    phone: '+971 52 987 6543',
    cleanPhone: '971529876543',
    email: 'tariq.nuaimi@sharjahclinic.ae',
    source: 'whatsapp_direct',
    stage: 'menu_sent',
    targetEventDate: '2026-11-15',
    estimatedGuests: 75,
    budgetAED: 8500,
    hallPreference: 'Suite room Hall',
    buffetPreference: 'Platinum Gala Dinner (85 AED/pax)',
    adCampaignName: 'Sharjah Family & Engagement Packages',
    notes: 'Direct WhatsApp inquiry for engagement ceremony. Sent 2-page BEO sample and dessert chafer options.',
    followUpStatus: 'pending',
    createdAt: '2026-10-13T14:15:00Z',
  },
  {
    id: 'lead_3',
    clientName: 'Gulf FinTech Solutions (Sara Mansoori)',
    phone: '+971 55 432 1098',
    cleanPhone: '971554321098',
    email: 'events@gulffintech.ae',
    source: 'meta_facebook_lead',
    stage: 'tasting_hall_tour',
    targetEventDate: '2026-12-05',
    estimatedGuests: 110,
    budgetAED: 14500,
    hallPreference: 'First Floor Big Hall',
    buffetPreference: 'Executive Corporate Lunch Buffet',
    adCampaignName: 'Corporate Banquet & Year-End Galas',
    notes: 'Scheduled for in-person hall walkthrough and Executive Chef food tasting on Thursday 3:00 PM.',
    followUpStatus: 'followed_up',
    createdAt: '2026-10-12T11:00:00Z',
  },
  {
    id: 'lead_4',
    clientName: 'Fatima & Omar Al-Zahra',
    phone: '+971 54 876 5432',
    cleanPhone: '971548765432',
    email: 'fatima.zahra@yahoo.com',
    source: 'meta_instagram_ad',
    stage: 'tentative_hold',
    targetEventDate: '2026-11-28',
    estimatedGuests: 90,
    budgetAED: 12000,
    hallPreference: 'First Floor Big Hall',
    buffetPreference: 'Royal Wedding Feast (100 AED/pax)',
    adCampaignName: 'Royal Wedding & Mega Reception (100 AED Buffet)',
    notes: '48-hour provisional hold placed by F&B Supervisor. Guest requested complimentary bridal walkthrough runway.',
    followUpStatus: 'pending',
    createdAt: '2026-10-11T16:45:00Z',
  },
  {
    id: 'lead_5',
    clientName: 'Rahul & Meera Varma',
    phone: '+971 56 234 5678',
    cleanPhone: '971562345678',
    email: 'rahul.varma@dubaiholding.com',
    source: 'meta_facebook_lead',
    stage: 'new_lead',
    targetEventDate: '2026-11-18',
    estimatedGuests: 50,
    budgetAED: 5500,
    hallPreference: 'Suite room Hall',
    buffetPreference: 'Silver Celebration Buffet (70 AED/pax)',
    adCampaignName: 'Birthday & Anniversary Celebrations',
    notes: '1st birthday celebration for baby boy. Looking for balloon arch decor and vegetarian live counter.',
    followUpStatus: 'requires_urgent_call',
    createdAt: '2026-10-14T08:15:00Z',
  },
  {
    id: 'lead_6',
    clientName: 'Emirates Healthcare Staff Association',
    phone: '+971 50 889 9776',
    cleanPhone: '971508899776',
    email: 'association@ehs.gov.ae',
    source: 'hotel_guest_referral',
    stage: 'converted_won',
    targetEventDate: '2026-10-25',
    estimatedGuests: 100,
    budgetAED: 13500,
    hallPreference: 'First Floor Big Hall',
    buffetPreference: 'Executive Corporate Lunch Buffet',
    adCampaignName: 'Corporate Banquet & Year-End Galas',
    notes: 'Successfully converted! 4,000 AED advance received by F&B Supervisor. Booked as CPH-2026-003.',
    convertedBookingId: 'booking_2',
    createdAt: '2026-10-08T10:00:00Z',
  },
];

export const BANQUET_FOLLOW_UP_TEMPLATES: BanquetFollowUpTemplate[] = [
  {
    id: 'tpl_instant_menu',
    title: 'Instant Ad Response & Menu Quotation',
    badge: 'Send within 2h',
    stage: 'new_lead',
    actionHook: 'Send Buffet Menus & Photos',
    messageText: `Assalamu Alaikum {client_name}! 🌹

Thank you for your inquiry with Crystal Plaza Hotel Banquets regarding your event on {date}.

For your group of ~{guests} guests, we have reserved provisional availability in {hall_name}.

🍽️ *Our Signature Banquet Privileges:*
• Lavish 100 AED Royal Feast / 85 AED Gala Buffet
• Grand Stage, Red Carpet Walkway & Crystal Chafers
• Complimentary Hall Rental for groups of 80+ guests
• Dedicated Banquet Captain & Dedicated Waitstaff

Would you like me to send you our full PDF Function Prospectus and photos of the hall setup?

Warm regards,
F&B Supervisor • Banquet Sales Team
Crystal Plaza Hotel, Sharjah (+971 6 572 2555)`,
  },
  {
    id: 'tpl_chef_tasting',
    title: 'Complimentary Chef Food Tasting Invitation',
    badge: 'High Conversion',
    stage: 'menu_sent',
    actionHook: 'Invite for Food Tasting',
    messageText: `Hello {client_name}! ✨

Greetings from Crystal Plaza Hotel Banquets. We hope you liked the banquet menu we shared!

To help you and your family decide with 100% confidence, our Executive Chef would love to host you for a *Complimentary Food Tasting* this week at Crystal Plaza.

You will taste our signature Shish Tawook, Mutton Rogan Josh, and freshly prepared banquet desserts.

Which day works best for you: Wednesday or Thursday evening?

Best regards,
F&B Supervisor • Crystal Plaza Banquets`,
  },
  {
    id: 'tpl_closing_perk',
    title: 'Closing Incentive: Complimentary Stage Lighting & Cake',
    badge: 'Closes Deal',
    stage: 'tasting_hall_tour',
    actionHook: 'Offer Free 1,500 AED Perks',
    messageText: `Special Privilege for {client_name}! 🎉

Following up on your hall walkthrough at Crystal Plaza. Our General Manager has approved a special bonus for your event on {date}:

If you confirm your banquet booking by this Thursday with an advance deposit, you will receive:
✨ *Complimentary RGB Stage Uplighting & AV (Valued at AED 800)*
🎂 *Complimentary 2-Tier Celebration Cake (Valued at AED 450)*
☕ *Unlimited Arabic Coffee (Gahwa), Tea & Fresh Juices*

Shall I prepare the official provisional agreement for your review?

F&B Supervisor • Crystal Plaza Banquets`,
  },
  {
    id: 'tpl_hold_urgency',
    title: '48-Hour Provisional Hold Expiry Alert',
    badge: 'Urgent',
    stage: 'tentative_hold',
    actionHook: 'Lock Event Date Now',
    messageText: `Important Update for {client_name}: ⏳

We have received a second inquiry from another client for {hall_name} on {date}.

Because you inquired first, our system has placed a provisional 48-hour hold under your name, expiring tomorrow at 6:00 PM.

Due to our strict "One Party Per Hall & Date" rule, we cannot hold the hall without an advance once this timer expires. Would you like to secure your date today with a nominal advance deposit?

F&B Supervisor • Crystal Plaza Banquets (+971 6 572 2555)`,
  },
];


