import React, { useState, useEffect } from 'react';
import { 
  UtensilsCrossed, 
  ChefHat, 
  Plus, 
  Search, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Sliders, 
  Layers, 
  Info, 
  X, 
  Calculator,
  ArrowRight,
  Sparkles,
  FileSpreadsheet,
  Calendar,
  Building,
  FileText,
  DollarSign,
  PackageCheck,
  PackageMinus,
  Check,
  Send,
  Boxes,
  RefreshCw,
  Percent,
  Flame,
  Clock,
  Lock
} from 'lucide-react';
import { 
  RecipeMenuItem, 
  RawIngredient, 
  BookingEvent, 
  UserProfile, 
  ChefUsageItem,
  ChefPartyIngredientEntry,
  CostingMethod,
  CostingWorkflowStatus,
  RoomServiceDish
} from '../types';
import { computeRecipeDirectCost, formatCurrency, formatPercent } from '../utils/costCalculations';
import { ChefAccountsCostingWorkflow } from './ChefAccountsCostingWorkflow';
import { PostingReportModal } from './PostingReportModal';
import { AppStorage } from '../services/storage';

interface FoodCostingCalculatorProps {
  initialSubTab?: 'costing_required' | 'party_calculator' | 'room_service_calculator' | 'recipes_catalogue' | 'posting_reports';
  recipes: RecipeMenuItem[];
  ingredients: RawIngredient[];
  bookings: BookingEvent[];
  currentUser: UserProfile;
  allUsers?: UserProfile[];
  onSaveRecipe: (recipe: RecipeMenuItem) => void;
  onSaveChefUsage: (bookingId: string, logs: ChefUsageItem[], actualFoodCost: number, notes: string) => void;
  onSavePartyCosting?: (
    bookingId: string, 
    entries: ChefPartyIngredientEntry[], 
    method: CostingMethod, 
    status: CostingWorkflowStatus, 
    actualCost: number, 
    chefNotes: string, 
    arunNotes: string
  ) => void;
  onOpenA4Sheet?: (booking: BookingEvent, initialPage?: 1 | 2 | 3) => void;
}

export const FoodCostingCalculator: React.FC<FoodCostingCalculatorProps> = ({
  initialSubTab,
  recipes,
  ingredients,
  bookings,
  currentUser,
  allUsers = [],
  onSaveRecipe,
  onSaveChefUsage,
  onSavePartyCosting,
  onOpenA4Sheet,
}) => {
  const isAccounts = currentUser.role === 'accounts_executive';
  const isChef = currentUser.role === 'executive_chef';

  // Parties waiting for Accounts (forwarded by chef)
  const accountsCostingRequiredParties = bookings.filter(b => 
    b.hasFoodFromHotel && 
    (b.costingStatus === 'forwarded_to_accounts' || (b.chefApproved && !b.arunCostedAt && b.costingStatus !== 'costed_by_arun'))
  );

  // Parties waiting for Chef (party ended confirmed by Francis)
  const chefCostingRequiredParties = bookings.filter(b => 
    b.hasFoodFromHotel && 
    b.partyEnded && 
    (!b.chefApproved || b.costingStatus === 'party_ended_pending_chef') &&
    b.costingStatus !== 'forwarded_to_accounts' &&
    b.costingStatus !== 'costed_by_arun'
  );

  const pendingBadgeCount = isChef 
    ? chefCostingRequiredParties.length 
    : (isAccounts ? accountsCostingRequiredParties.length : chefCostingRequiredParties.length + accountsCostingRequiredParties.length);

  // Primary sub-tabs: 1) Costing Required, 2) Party / Buffet Calculator, 3) Room Service Calculator, 4) Master Recipe Catalogue, 5) GL Posting Reports & Audits
  const [activeSubTab, setActiveSubTab] = useState<'costing_required' | 'party_calculator' | 'room_service_calculator' | 'recipes_catalogue' | 'posting_reports'>(
    initialSubTab || ((isAccounts || isChef) ? 'costing_required' : 'party_calculator')
  );

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const [costingModalBooking, setCostingModalBooking] = useState<BookingEvent | null>(null);
  const [selectedPostingReportBooking, setSelectedPostingReportBooking] = useState<BookingEvent | null>(null);
  const costedPostingParties = bookings.filter(b => b.costingStatus === 'costed_by_arun' || b.postingReportGenerated);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'warning' | 'info'; text: string } | null>(null);

  // ==========================================
  // STATE FOR 1) PARTY & BUFFET FOOD COSTING
  // ==========================================
  const foodBookings = bookings.filter(b => b.hasFoodFromHotel);
  const [selectedBookingId, setSelectedBookingId] = useState<string>(
    foodBookings[0]?.id || bookings[0]?.id || ''
  );
  const targetBooking = bookings.find(b => b.id === selectedBookingId) || foodBookings[0] || bookings[0];

  // Standalone / Quick Party Buffet Calculator State
  const [partyGuests, setPartyGuests] = useState<number>(30); // 30 guests default
  const [partyChargedPerGuest, setPartyChargedPerGuest] = useState<number>(60.00); // 60 AED package
  const [partyChefEntries, setPartyChefEntries] = useState<Array<{ id: string; ingredient: string; amountUsed: string; costAED: number; matchedIngId?: string }>>([
    { id: 'p1', ingredient: 'Fresh Farm Chicken (Carton of 26 Pieces)', amountUsed: '1 carton', costAED: 130.00, matchedIngId: 'ing_1' },
    { id: 'p2', ingredient: 'Royal Heritage Basmati Rice', amountUsed: '6 kg', costAED: 31.20, matchedIngId: 'ing_3' },
    { id: 'p3', ingredient: 'Pure Sunflower Cooking Oil', amountUsed: '1 tin (15L)', costAED: 90.00, matchedIngId: 'ing_4' },
    { id: 'p4', ingredient: 'Red Cooking Onions', amountUsed: '5 kg', costAED: 17.50, matchedIngId: 'ing_7' },
    { id: 'p5', ingredient: 'Arabic Spices & Biryani Masala Blend', amountUsed: '0.8 kg', costAED: 19.20, matchedIngId: 'ing_5' },
    { id: 'p6', ingredient: 'Fresh Arabic Khubz & Bread Buns', amountUsed: '40 pieces', costAED: 16.00, matchedIngId: 'ing_14' },
  ]);
  const [newPartyIng, setNewPartyIng] = useState('');
  const [newPartyAmount, setNewPartyAmount] = useState('');

  // ==========================================
  // STATE FOR 2) ROOM SERVICE FOOD COSTING (Item by Item)
  // ==========================================
  const [roomServiceDishes, setRoomServiceDishes] = useState<RoomServiceDish[]>([]);
  const [selectedDishId, setSelectedDishId] = useState<string>('rs_biryani');
  const [rsPortionsToCook, setRsPortionsToCook] = useState<number>(1);
  const [newDishModalOpen, setNewDishModalOpen] = useState<boolean>(false);

  // New Dish Modal state
  const [newDishName, setNewDishName] = useState('');
  const [newDishCategory, setNewDishCategory] = useState<RoomServiceDish['category']>('Biryani & Rice');
  const [newDishSellingPrice, setNewDishSellingPrice] = useState<number>(48.00);
  const [newDishLabor, setNewDishLabor] = useState<number>(3.50);
  const [newDishUtility, setNewDishUtility] = useState<number>(0.80);
  const [newDishIngredients, setNewDishIngredients] = useState<Array<{
    ingredientId: string;
    subUnitsUsed: number;
    unit: string;
  }>>([
    { ingredientId: 'ing_1', subUnitsUsed: 2, unit: 'pieces' },
    { ingredientId: 'ing_3', subUnitsUsed: 0.25, unit: 'kg' },
    { ingredientId: 'ing_10', subUnitsUsed: 0.04, unit: 'kg' }
  ]);

  // Master Recipe Simulator State
  const [simulatorRecipeId, setSimulatorRecipeId] = useState<string>(recipes[0]?.id || '');
  const [simulatorPortions, setSimulatorPortions] = useState<number>(30);
  const [selectedRecipeForDetails, setSelectedRecipeForDetails] = useState<RecipeMenuItem | null>(null);

  // Initial load of room service dishes
  useEffect(() => {
    setRoomServiceDishes(AppStorage.getRoomServiceDishes());
  }, []);

  const ingredientsMap = new Map<string, RawIngredient>(ingredients.map(i => [i.id, i]));

  const isChefRole = currentUser.role === 'executive_chef';

  // Add party ingredient row (Restricted strictly to Executive Chef Karim)
  const handleAddPartyRow = () => {
    if (!isChefRole) {
      setToastMessage({
        type: 'warning',
        text: '🔒 Access Restricted: Only Executive Chef Karim Zayani can put and log party ingredients. Arun Kumar and other staff cannot alter ingredients.',
      });
      return;
    }
    if (!newPartyIng.trim() || !newPartyAmount.trim()) return;

    // Try auto-matching with ingredients
    const matched = ingredients.find(i => 
      i.name.toLowerCase().includes(newPartyIng.toLowerCase()) || 
      newPartyIng.toLowerCase().includes(i.name.toLowerCase())
    );

    let estimatedCost = 50.00;
    if (matched) {
      if (newPartyAmount.toLowerCase().includes('carton') || newPartyAmount.toLowerCase().includes('pack')) {
        const factor = parseFloat(newPartyAmount) || 1;
        estimatedCost = (matched.packageCostAED || matched.costPerUnit) * factor;
      } else {
        const factor = parseFloat(newPartyAmount) || 1;
        estimatedCost = (matched.subUnitCostAED || (matched.costPerUnit / (matched.subUnitsPerPackage || 1))) * factor;
      }
    }

    setPartyChefEntries(prev => [
      ...prev,
      {
        id: `p_${Date.now()}`,
        ingredient: newPartyIng.trim(),
        amountUsed: newPartyAmount.trim(),
        costAED: parseFloat(estimatedCost.toFixed(2)),
        matchedIngId: matched?.id
      }
    ]);
    setNewPartyIng('');
    setNewPartyAmount('');
  };

  const handleRemovePartyRow = (id: string) => {
    if (!isChefRole) {
      setToastMessage({
        type: 'warning',
        text: '🔒 Access Restricted: Only Executive Chef Karim Zayani can remove party ingredients.',
      });
      return;
    }
    setPartyChefEntries(prev => prev.filter(e => e.id !== id));
  };

  // Deduct party batch from Kitchen Inventory
  const handleDeductPartyBatchFromInventory = () => {
    let deductedCount = 0;
    partyChefEntries.forEach(entry => {
      if (entry.matchedIngId) {
        const ing = ingredientsMap.get(entry.matchedIngId);
        if (ing) {
          const isCarton = entry.amountUsed.toLowerCase().includes('carton') || entry.amountUsed.toLowerCase().includes('sack') || entry.amountUsed.toLowerCase().includes('tin');
          const perPack = ing.subUnitsPerPackage || 1;
          const subUnitsToDeduct = isCarton 
            ? Math.round((parseFloat(entry.amountUsed) || 1) * perPack)
            : Math.round(parseFloat(entry.amountUsed) || 1);

          AppStorage.deductKitchenStock(
            ing.id,
            subUnitsToDeduct,
            `Party Buffet for ${partyGuests} Guests (Crystal Plaza)`,
            `${currentUser.name} (${currentUser.role === 'executive_chef' ? 'Chef Karim' : 'Kitchen'})`
          );
          deductedCount++;
        }
      }
    });

    setToastMessage({
      type: 'success',
      text: `✓ Deducted ${deductedCount} bulk party items from live Kitchen Inventory for ${partyGuests} guests!`
    });
  };

  // Room Service calculations
  const activeDish = roomServiceDishes.find(d => d.id === selectedDishId) || roomServiceDishes[0];

  // Cook / Prepare Room Service Dish & Deduct from Inventory
  const handleCookRoomServiceDish = (dish: RoomServiceDish, portions: number) => {
    let detailsSummary: string[] = [];

    dish.ingredients.forEach(ingRow => {
      const ing = ingredientsMap.get(ingRow.ingredientId);
      if (ing) {
        const unitsUsed = (ingRow.subUnitsUsed || ingRow.quantity) * portions;
        const res = AppStorage.deductKitchenStock(
          ing.id,
          unitsUsed,
          `Room Service: ${portions}x ${dish.name}`,
          `${currentUser.name} (${currentUser.role === 'executive_chef' ? 'Chef Karim' : 'Chef'})`
        );
        if (res.success) {
          detailsSummary.push(`${unitsUsed} ${ing.subUnitName || 'units'} of ${ing.name}`);
        }
      }
    });

    setToastMessage({
      type: 'success',
      text: `✓ Chef Karim Prepared: ${portions}x ${dish.name}! Deducted: ${detailsSummary.join(', ')} from Kitchen Inventory.`
    });
  };

  // Party Calculator Financials
  const totalPartyIngredientsCost = partyChefEntries.reduce((s, e) => s + e.costAED, 0);
  const partyLaborAndUtilities = partyGuests * 4.50; // 4.50 AED/guest for live kitchen crew & buffet warmers
  const totalPartyDirectFoodCost = totalPartyIngredientsCost + partyLaborAndUtilities;
  const partyFoodCostPerGuest = partyGuests > 0 ? totalPartyDirectFoodCost / partyGuests : 0;
  const partyTotalBilledRevenue = partyGuests * partyChargedPerGuest;
  const partyGrossProfit = partyTotalBilledRevenue - totalPartyDirectFoodCost;
  const partyFoodCostPercent = partyTotalBilledRevenue > 0 ? (totalPartyDirectFoodCost / partyTotalBilledRevenue) * 100 : 0;
  const partyMarginPercent = partyTotalBilledRevenue > 0 ? (partyGrossProfit / partyTotalBilledRevenue) * 100 : 0;

  // Filter recipes for catalogue
  const filteredRecipes = recipes.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === 'all' || r.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notice */}
      {toastMessage && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold animate-in fade-in duration-200 ${
          toastMessage.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
          toastMessage.type === 'warning' ? 'bg-amber-50 border-amber-300 text-amber-900' :
          'bg-blue-50 border-blue-300 text-blue-900'
        }`}>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="p-1 rounded-full hover:bg-black/5 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#192A24] font-['Plus_Jakarta_Sans'] flex items-center space-x-2.5">
            <UtensilsCrossed className="w-6 h-6 text-[#236B50]" />
            <span>
              {currentUser.role === 'executive_chef' 
                ? 'Executive Chef Food Costing & Recipe Engine' 
                : (currentUser.role === 'accounts_executive' ? 'Purchasing Costing & Food Audit (Arun)' : 'Food Costing & Recipe Calculator')}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5A6F66] mt-0.5">
            Dedicated separate calculators for <strong>Banquet Parties / Buffets</strong> and <strong>Room Service (Item-by-Item)</strong>.
          </p>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-[#D5E5DE] shadow-xs self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('costing_required')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeSubTab === 'costing_required'
                ? isChef ? 'bg-amber-500 text-amber-950 shadow-xs' : 'bg-purple-700 text-white shadow-xs'
                : 'text-[#3D5A4E] hover:bg-[#F6FAF8]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Costing Required</span>
            {pendingBadgeCount > 0 && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeSubTab === 'costing_required'
                  ? isChef ? 'bg-amber-950 text-amber-200' : 'bg-white text-purple-900'
                  : isChef ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-purple-100 text-purple-900 border border-purple-300'
              } animate-pulse`}>
                {pendingBadgeCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('party_calculator')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeSubTab === 'party_calculator'
                ? 'bg-[#236B50] text-white shadow-xs'
                : 'text-[#3D5A4E] hover:bg-[#F6FAF8]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Party & Buffet Calculator</span>
          </button>

          <button
            onClick={() => setActiveSubTab('room_service_calculator')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeSubTab === 'room_service_calculator'
                ? 'bg-[#236B50] text-white shadow-xs'
                : 'text-[#3D5A4E] hover:bg-[#F6FAF8]'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5" />
            <span>Room Service (Item-by-Item)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('recipes_catalogue')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeSubTab === 'recipes_catalogue'
                ? 'bg-[#236B50] text-white shadow-xs'
                : 'text-[#3D5A4E] hover:bg-[#F6FAF8]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Master Catalogue & Batch Scaling</span>
          </button>

          <button
            onClick={() => setActiveSubTab('posting_reports')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeSubTab === 'posting_reports'
                ? 'bg-[#236B50] text-white shadow-xs'
                : 'text-[#3D5A4E] hover:bg-[#F6FAF8]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>GL Posting Reports ({costedPostingParties.length})</span>
          </button>
        </div>
      </div>

      {/* =========================================================
          TAB 0: COSTING REQUIRED TAB (FOR ACCOUNTS AND CHEF)
          User specification:
          - "i need costing require tab for Accounts that there should be all parties forwarded from the chef waiting for the costing"
          - "from the chef side also i need new tab Costing require that completely comes on this tab after francis confirms the party ended"
          ========================================================= */}
      {activeSubTab === 'costing_required' && (
        <div className="space-y-6">
          {/* Header Banner based on Role */}
          {isChef ? (
            <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 rounded-3xl p-5 border-2 border-amber-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-black uppercase tracking-wider bg-amber-500 text-amber-950 px-2.5 py-0.5 rounded-full">
                    Chef Costing Required
                  </span>
                  <span className="text-sm font-extrabold text-amber-950">
                    Concluded Parties Forwarded from Francis D'Souza
                  </span>
                </div>
                <p className="text-xs text-amber-900 max-w-2xl">
                  These parties have concluded and Francis has confirmed their end. Executive Chef Karim must log the actual bulk quantities used (cartons, kg, liters) and stamp to forward to Accounts.
                </p>
              </div>
              <div className="text-xs font-black px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                {chefCostingRequiredParties.length} Concluded Parties Waiting
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-purple-900 via-indigo-950 to-[#2A164D] text-white rounded-3xl p-5 sm:p-6 shadow-md border-2 border-purple-400/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-amber-950 px-2.5 py-0.5 rounded-full">
                    Accounts Costing Required
                  </span>
                  <span className="text-sm font-extrabold text-white">
                    Chef-Stamped Vouchers Forwarded from Chef Karim
                  </span>
                </div>
                <p className="text-xs text-purple-200 max-w-2xl">
                  Chef Karim has entered the actual ingredient quantities and issued official vouchers. As Accounts Executive (Arun Kumar), enter purchasing prices for all line items to finalize food cost % and post journal entries to the GL.
                </p>
              </div>
              <div className="text-xs font-black px-3 py-1.5 rounded-xl bg-purple-400/30 text-purple-200 border border-purple-300/30 shrink-0">
                {accountsCostingRequiredParties.length} Vouchers Awaiting Costing
              </div>
            </div>
          )}

          {/* Cards Grid: CHEF PERSPECTIVE */}
          {(isChef || currentUser.role === 'general_manager') && (
            <div className="space-y-3">
              {currentUser.role === 'general_manager' && (
                <div className="flex items-center space-x-2 pt-2">
                  <ChefHat className="w-4 h-4 text-amber-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-900">
                    Phase 1: Concluded Parties Awaiting Chef Karim Ingredient Usage ({chefCostingRequiredParties.length})
                  </h3>
                </div>
              )}

              {chefCostingRequiredParties.length === 0 ? (
                <div className="bg-white rounded-3xl border border-[#D5E5DE] p-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-[#236B50] flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-extrabold text-[#192A24]">
                    All Concluded Parties Have Been Logged & Forwarded!
                  </h4>
                  <p className="text-xs text-[#5A6F66] max-w-md mx-auto">
                    There are currently no parties waiting for kitchen ingredient quantities. When Francis confirms a party has ended, it will instantly appear right here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {chefCostingRequiredParties.map(party => (
                    <div 
                      key={party.id} 
                      className="bg-white rounded-3xl border-2 border-amber-300/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                            Party Ended ✓
                          </span>
                          <span className="font-mono text-xs font-bold text-[#5A6F66]">
                            {party.bookingNumber}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-base font-extrabold text-[#192A24] leading-tight">
                            {party.clientName}
                          </h4>
                          <p className="text-xs text-[#5A6F66] mt-0.5">
                            {party.eventType} • <strong className="text-[#192A24]">{party.guestCount} Guests</strong>
                          </p>
                        </div>

                        <div className="bg-amber-50 rounded-2xl p-3 border border-amber-200 text-xs text-amber-950 space-y-1">
                          <div className="flex items-center justify-between font-bold">
                            <span>Event Date:</span>
                            <span className="font-mono">{party.eventDate} ({party.timeSlot})</span>
                          </div>
                          <div className="flex items-center justify-between font-bold">
                            <span>Venue / Hall:</span>
                            <span>{party.hallName}</span>
                          </div>
                          <div className="pt-1 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-amber-900">
                            <span>Confirmed Ended by:</span>
                            <span className="font-bold">{party.partyEndedConfirmedBy || "Francis D'Souza"}</span>
                          </div>
                        </div>

                        {party.selectedFoodItems && party.selectedFoodItems.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase text-[#5A6F66]">
                              Guest Menu: {party.selectedMenuName || 'Selected Dishes'}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {party.selectedFoodItems.slice(0, 4).map((f, i) => (
                                <span key={i} className="text-[10px] bg-[#E8F5EE] text-[#236B50] px-2 py-0.5 rounded-md font-semibold">
                                  {f}
                                </span>
                              ))}
                              {party.selectedFoodItems.length > 4 && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-bold">
                                  +{party.selectedFoodItems.length - 4} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 pt-2 border-t border-[#E2ECE7]">
                        <button
                          type="button"
                          onClick={() => setCostingModalBooking(party)}
                          className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-amber-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <UtensilsCrossed className="w-4 h-4" />
                          <span>Log Ingredient Quantities & Stamp</span>
                        </button>
                        {onOpenA4Sheet && (
                          <button
                            type="button"
                            onClick={() => onOpenA4Sheet(party, 3)}
                            className="w-full py-1.5 text-[11px] font-bold text-[#236B50] hover:underline flex items-center justify-center space-x-1 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View Function Prospectus Sheet</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cards Grid: ACCOUNTS PERSPECTIVE */}
          {(isAccounts || currentUser.role === 'general_manager') && (
            <div className="space-y-3 pt-4">
              {currentUser.role === 'general_manager' && (
                <div className="flex items-center space-x-2 pt-2">
                  <Calculator className="w-4 h-4 text-purple-700" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-purple-950">
                    Phase 2: Chef Vouchers Awaiting Accounts Purchasing Costing ({accountsCostingRequiredParties.length})
                  </h3>
                </div>
              )}

              {accountsCostingRequiredParties.length === 0 ? (
                <div className="bg-white rounded-3xl border border-[#D5E5DE] p-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-extrabold text-[#192A24]">
                    All Forwarded Vouchers Have Been Costed & Posted!
                  </h4>
                  <p className="text-xs text-[#5A6F66] max-w-md mx-auto">
                    No parties are currently waiting for purchasing price costing. Once Chef Karim finishes entering ingredient quantities, the parties will appear right here in Arun's queue.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {accountsCostingRequiredParties.map((party, idx) => {
                    const enteredCount = party.chefPartyEntries?.length || 0;
                    return (
                      <div 
                        key={party.id} 
                        className="bg-white rounded-3xl border-2 border-purple-300 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                              FIFO Queue #{idx + 1} • Chef Stamped
                            </span>
                            <span className="font-mono text-xs font-bold text-[#5A6F66]">
                              {party.bookingNumber}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-base font-extrabold text-[#192A24] leading-tight">
                              {party.clientName}
                            </h4>
                            <p className="text-xs text-[#5A6F66] mt-0.5">
                              {party.eventType} • <strong className="text-[#192A24]">{party.guestCount} Guests</strong> • {party.hallName}
                            </p>
                          </div>

                          <div className="bg-purple-50 rounded-2xl p-3 border border-purple-200 text-xs text-purple-950 space-y-1">
                            <div className="flex items-center justify-between font-bold">
                              <span>Event Date:</span>
                              <span className="font-mono">{party.eventDate}</span>
                            </div>
                            <div className="flex items-center justify-between font-bold">
                              <span>Chef Stamp Ref:</span>
                              <span className="font-mono text-purple-900">{party.chefStampSerial || 'CPH-STAMP-OK'}</span>
                            </div>
                            <div className="pt-1 border-t border-purple-200/60 flex items-center justify-between text-[11px] text-purple-900">
                              <span>Forwarded By:</span>
                              <span className="font-bold">{party.chefApprovedBy || 'Chef Karim Zayani'}</span>
                            </div>
                          </div>

                          <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              {enteredCount > 0 
                                ? `${enteredCount} items entered by Chef. Incomplete prices will be highlighted in red.` 
                                : 'Awaiting purchasing unit prices entry.'}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-[#E2ECE7]">
                          <button
                            type="button"
                            onClick={() => setCostingModalBooking(party)}
                            className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 active:scale-98 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                          >
                            <Calculator className="w-4 h-4" />
                            <span>Enter Purchase Prices & Finalize Costing</span>
                          </button>
                          {onOpenA4Sheet && (
                            <button
                              type="button"
                              onClick={() => onOpenA4Sheet(party, 3)}
                              className="w-full py-1.5 text-[11px] font-bold text-[#236B50] hover:underline flex items-center justify-center space-x-1 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>View Function Prospectus Sheet</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          CALCULATOR 1: PARTY & BUFFET FOOD COSTING CALCULATOR
          ========================================================= */}
      {activeSubTab === 'party_calculator' && (
        <div className="space-y-6">
          {/* Top Banner: User Specification Context */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white rounded-3xl p-5 border border-emerald-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2.5 py-0.5 rounded-full">
                  Party Buffet Costing Method
                </span>
                <span className="text-sm font-extrabold text-emerald-950">Bulk General Day Usage for Entire Event</span>
              </div>
              <p className="text-xs text-emerald-800 max-w-2xl">
                Chef Karim enters the total supplies opened for the party (e.g. 1 carton of chicken, 6 kg basmati rice, 1 tin cooking oil) rather than calculating single dishes. Arun Kumar reviews and verifies the purchasing prices.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={handleDeductPartyBatchFromInventory}
                className="px-4 py-2 bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <PackageMinus className="w-4 h-4" />
                <span>Deduct Party Usage from Kitchen Stock</span>
              </button>
            </div>
          </div>

          {/* Party Configuration Bar */}
          <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#192A24] mb-1">Banquet Event / Guest Count</label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="10"
                  step="5"
                  value={partyGuests}
                  onChange={(e) => setPartyGuests(parseInt(e.target.value) || 30)}
                  className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs font-black text-[#192A24] focus:outline-none focus:border-[#236B50]"
                />
                <span className="text-xs text-[#5A6F66] font-bold shrink-0">Guests</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#192A24] mb-1">Package Price Charged per Guest</label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="30"
                  step="5"
                  value={partyChargedPerGuest}
                  onChange={(e) => setPartyChargedPerGuest(parseFloat(e.target.value) || 60)}
                  className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs font-black text-emerald-800 focus:outline-none focus:border-[#236B50]"
                />
                <span className="text-xs text-[#5A6F66] font-bold shrink-0">AED / Guest</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#192A24] mb-1">Total Package Revenue</label>
              <div className="w-full bg-[#EBF3EF] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs font-black text-[#192A24]">
                {formatCurrency(partyTotalBilledRevenue)} (30 Guests Minimum Policy)
              </div>
            </div>
          </div>

          {/* Party Financial Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-sm">
              <div className="text-[10px] font-bold text-[#5A6F66] uppercase tracking-wider">Total Raw Ingredients Cost</div>
              <div className="text-xl font-black text-[#192A24] mt-1.5">{formatCurrency(totalPartyIngredientsCost)}</div>
              <div className="text-[11px] text-[#5A6F66] mt-0.5">{partyChefEntries.length} Items Logged by Chef</div>
            </div>

            <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-sm">
              <div className="text-[10px] font-bold text-[#5A6F66] uppercase tracking-wider">Direct Cost Per Guest</div>
              <div className="text-xl font-black text-[#236B50] mt-1.5">{formatCurrency(partyFoodCostPerGuest)}</div>
              <div className="text-[11px] text-[#5A6F66] mt-0.5">Charged: {formatCurrency(partyChargedPerGuest)}</div>
            </div>

            <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-sm">
              <div className="text-[10px] font-bold text-[#5A6F66] uppercase tracking-wider">Food Gross Profit</div>
              <div className="text-xl font-black text-emerald-700 mt-1.5">+{formatCurrency(partyGrossProfit)}</div>
              <div className="text-[11px] text-emerald-800 font-bold mt-0.5">{partyMarginPercent.toFixed(1)}% Gross Margin</div>
            </div>

            <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-sm">
              <div className="text-[10px] font-bold text-[#5A6F66] uppercase tracking-wider">Food Cost Percentage</div>
              <div className={`text-xl font-black mt-1.5 ${partyFoodCostPercent <= 45 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {partyFoodCostPercent.toFixed(1)}%
              </div>
              <div className="text-[11px] text-[#5A6F66] mt-0.5">Hotel Target: 35% - 45%</div>
            </div>
          </div>

          {/* Party Ingredients Input Table (Chef's 2 Free Fields) */}
          <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2ECE7]">
              <div>
                <h3 className="font-extrabold text-base text-[#192A24] flex items-center space-x-2">
                  <ChefHat className="w-5 h-5 text-[#236B50]" />
                  <span>Chef Karim's Party Ingredient Usage Input</span>
                </h3>
                <p className="text-xs text-[#5A6F66]">
                  Type the ingredient and amount used freely (e.g. 1 carton of chicken, 6 kg basmati rice).
                </p>
              </div>

              <span className="text-xs font-bold text-[#236B50]">
                Arun's Purchasing Price Master Catalog Connected ✓
              </span>
            </div>

            {/* Quick Add Row - Restricted to Executive Chef Karim */}
            {!isChefRole ? (
              <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center space-x-3 text-amber-950 font-bold text-xs shadow-xs">
                <div className="w-8 h-8 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4 text-amber-900" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-amber-900 font-extrabold uppercase text-[10px] tracking-wider flex items-center space-x-1.5">
                    <span>🔒 Chef Privilege Enforced (View Only Mode)</span>
                  </div>
                  <p className="text-amber-900 text-xs font-semibold">
                    Only <strong>Executive Chef Karim Zayani</strong> can put, add, or alter ingredients. You are viewing in read-only audit mode as <strong>{currentUser.name} ({currentUser.role.replace('_', ' ')})</strong>. Arun Kumar and other staff cannot alter Chef entries.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#F8FAF9] rounded-2xl border border-[#D5E5DE] grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-bold text-[#192A24] mb-1">
                    Field 1: Ingredient Name (Free Text)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fresh Farm Chicken, Basmati Rice, Cooking Oil..."
                    value={newPartyIng}
                    onChange={(e) => setNewPartyIng(e.target.value)}
                    className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs font-bold text-[#192A24] focus:outline-none focus:border-[#236B50]"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-[#192A24] mb-1">
                    Field 2: Amount Used (Free Text: carton, kg, tins, pieces)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1 carton, 6 kg, 2 tins, 25 pieces..."
                    value={newPartyAmount}
                    onChange={(e) => setNewPartyAmount(e.target.value)}
                    className="w-full bg-white border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs font-bold text-[#192A24] focus:outline-none focus:border-[#236B50]"
                  />
                </div>

                <div className="sm:col-span-3">
                  <button
                    type="button"
                    onClick={handleAddPartyRow}
                    className="w-full py-2 bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add to Party Costing</span>
                  </button>
                </div>
              </div>
            )}

            {/* Current Party Ingredients Table */}
            <div className="overflow-x-auto rounded-2xl border border-[#D5E5DE]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAF9] text-[#5A6F66] font-bold text-[10px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Logged Ingredient</th>
                    <th className="py-2.5 px-3">Chef Amount Used</th>
                    <th className="py-2.5 px-3">Inventory Link & Packaging</th>
                    <th className="py-2.5 px-3">Purchasing Cost (Arun)</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2ECE7]">
                  {partyChefEntries.map(entry => (
                    <tr key={entry.id} className="hover:bg-[#F6FAF8] transition-colors">
                      <td className="py-2.5 px-3 font-bold text-[#192A24]">
                        {entry.ingredient}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-extrabold text-emerald-800">
                        {entry.amountUsed}
                      </td>
                      <td className="py-2.5 px-3 text-[#5A6F66]">
                        {entry.matchedIngId ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                            ✓ Linked to Kitchen Stock
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Freeform Entry</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#192A24]">
                        {entry.costAED.toFixed(2)} AED
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {isChefRole ? (
                          <button
                            type="button"
                            onClick={() => handleRemovePartyRow(entry.id)}
                            className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[11px]" title="Only Executive Chef can alter ingredients">🔒 Locked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#E2ECE7]">
              <div className="text-xs text-[#5A6F66]">
                Kitchen Labor & Utility Overhead for {partyGuests} guests: <strong>{formatCurrency(partyLaborAndUtilities)}</strong> (included in total cost)
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleDeductPartyBatchFromInventory}
                  className="px-4 py-2 bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <PackageMinus className="w-4 h-4" />
                  <span>Deduct Ingredients from Kitchen Inventory</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          CALCULATOR 2: ROOM SERVICE FOOD COSTING (Item by Item)
          ========================================================= */}
      {activeSubTab === 'room_service_calculator' && (
        <div className="space-y-6">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-white rounded-3xl p-5 border border-amber-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-black uppercase tracking-wider bg-amber-700 text-white px-2.5 py-0.5 rounded-full">
                  Room Service Costing Method
                </span>
                <span className="text-sm font-extrabold text-amber-950">Item-by-Item Single Dish Calculation</span>
              </div>
              <p className="text-xs text-amber-900 max-w-2xl">
                Calculates precise ingredient quantities for individual dishes (e.g. <strong>Chicken Biryani: 2 chicken pieces/bones</strong> from the carton of 26, <strong>Chicken Noodles: 1 chicken piece</strong>, Club Sandwich, etc.).
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {isChefRole ? (
                <button
                  type="button"
                  onClick={() => setNewDishModalOpen(true)}
                  className="px-4 py-2 bg-[#236B50] hover:bg-[#1C5740] text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Create Room Service Dish</span>
                </button>
              ) : (
                <div className="px-3.5 py-2 bg-amber-50 text-amber-900 rounded-xl text-xs font-extrabold border border-amber-200 flex items-center space-x-1.5 shadow-2xs">
                  <Lock className="w-3.5 h-3.5 text-amber-800" />
                  <span>Chef Exclusive Dish Creation</span>
                </div>
              )}
            </div>
          </div>

          {/* Dish Selector Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2">
            {roomServiceDishes.map(dish => (
              <button
                key={dish.id}
                onClick={() => setSelectedDishId(dish.id)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-2 ${
                  selectedDishId === dish.id
                    ? 'bg-[#236B50] text-white shadow-sm'
                    : 'bg-white hover:bg-[#F6FAF8] text-[#3D5A4E] border border-[#D5E5DE]'
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>{dish.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/10 font-mono">
                  {formatCurrency(dish.sellingPriceAED)}
                </span>
              </button>
            ))}
          </div>

          {/* Active Dish Detail Card */}
          {activeDish && (
            <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E2ECE7]">
                <div className="flex items-center space-x-3.5">
                  {activeDish.imageUrl && (
                    <img
                      src={activeDish.imageUrl}
                      alt={activeDish.name}
                      className="w-16 h-16 rounded-2xl object-cover border border-[#D5E5DE] shadow-xs"
                    />
                  )}
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="font-extrabold text-lg text-[#192A24]">{activeDish.name}</h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                        {activeDish.category}
                      </span>
                    </div>
                    <p className="text-xs text-[#5A6F66] mt-0.5 max-w-xl">{activeDish.description}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end md:self-center">
                  <div className="flex items-center space-x-2 bg-[#F8FAF9] p-2 rounded-2xl border border-[#D5E5DE]">
                    <span className="text-xs font-bold text-[#192A24]">Order Portions:</span>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={rsPortionsToCook}
                      onChange={(e) => setRsPortionsToCook(parseInt(e.target.value) || 1)}
                      className="w-16 bg-white border border-[#D5E5DE] rounded-xl px-2.5 py-1 text-xs font-black text-center text-[#192A24]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCookRoomServiceDish(activeDish, rsPortionsToCook)}
                    className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer flex items-center space-x-1.5"
                  >
                    <Flame className="w-4 h-4" />
                    <span>Cook {rsPortionsToCook}x & Deduct from Stock</span>
                  </button>
                </div>
              </div>

              {/* Financial Metrics for this Single Dish */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-[#F8FAF9] rounded-2xl border border-[#E2ECE7]">
                  <div className="text-[10px] font-bold text-[#5A6F66] uppercase">Direct Food Cost</div>
                  <div className="text-xl font-black text-[#192A24] mt-1 font-mono">
                    {formatCurrency(activeDish.ingredients.reduce((s, i) => s + i.costAED, 0))}
                  </div>
                  <div className="text-[10px] text-[#5A6F66] mt-0.5">Ingredients subtotal</div>
                </div>

                <div className="p-4 bg-[#F8FAF9] rounded-2xl border border-[#E2ECE7]">
                  <div className="text-[10px] font-bold text-[#5A6F66] uppercase">Total Portion Cost</div>
                  <div className="text-xl font-black text-[#236B50] mt-1 font-mono">
                    {formatCurrency(activeDish.totalDishCostAED)}
                  </div>
                  <div className="text-[10px] text-[#5A6F66] mt-0.5">Includes labor & utilities</div>
                </div>

                <div className="p-4 bg-[#F8FAF9] rounded-2xl border border-[#E2ECE7]">
                  <div className="text-[10px] font-bold text-[#5A6F66] uppercase">Selling Price</div>
                  <div className="text-xl font-black text-emerald-800 mt-1 font-mono">
                    {formatCurrency(activeDish.sellingPriceAED)}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-bold mt-0.5">Room Service Guest Menu</div>
                </div>

                <div className="p-4 bg-[#EBF5F0] rounded-2xl border border-[#B8DFC9]">
                  <div className="text-[10px] font-bold text-[#236B50] uppercase">Food Cost % & Profit</div>
                  <div className="text-xl font-black text-[#236B50] mt-1 font-mono">
                    {activeDish.actualFoodCostPercent.toFixed(1)}% ({formatCurrency(activeDish.grossMarginAED)} Profit)
                  </div>
                  <div className="text-[10px] text-[#236B50] font-bold mt-0.5">
                    {activeDish.marginPercent.toFixed(1)}% Gross Margin
                  </div>
                </div>
              </div>

              {/* Ingredient by Ingredient Breakdown Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#192A24] uppercase tracking-wider flex items-center space-x-1.5">
                    <Boxes className="w-4 h-4 text-[#236B50]" />
                    <span>Ingredient Breakdown for 1 Portion (Connected to Live Kitchen Cartons)</span>
                  </h4>
                  <span className="text-[11px] text-[#5A6F66]">
                    Arun's Unit Purchasing Price Applied
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-[#D5E5DE]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAF9] text-[#5A6F66] font-bold text-[10px] uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Ingredient</th>
                        <th className="py-2.5 px-3">Portion Quantity</th>
                        <th className="py-2.5 px-3">Packaging Carton Equivalent</th>
                        <th className="py-2.5 px-3">Unit Purchase Price</th>
                        <th className="py-2.5 px-3">Calculated Cost</th>
                        <th className="py-2.5 px-3">Kitchen Stock Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2ECE7]">
                      {activeDish.ingredients.map((ingRow, idx) => {
                        const raw = ingredientsMap.get(ingRow.ingredientId);
                        const perPack = raw?.subUnitsPerPackage || 1;
                        const subUnitsUsed = ingRow.subUnitsUsed || ingRow.quantity;
                        const packFraction = (subUnitsUsed / perPack).toFixed(3);

                        return (
                          <tr key={idx} className="hover:bg-[#F6FAF8] transition-colors">
                            <td className="py-2.5 px-3 font-bold text-[#192A24]">
                              {ingRow.ingredientName}
                              <span className="text-[10px] text-[#5A6F66] block">
                                {raw?.name || 'Stock item'}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 font-mono font-extrabold text-emerald-900">
                              {subUnitsUsed} {ingRow.unit}
                            </td>

                            <td className="py-2.5 px-3 text-[#5A6F66] font-mono text-[11px]">
                              {packFraction} {raw?.packagingUnit || 'Carton'} (1 {raw?.packagingUnit || 'Carton'} = {perPack} {ingRow.unit})
                            </td>

                            <td className="py-2.5 px-3 font-mono">
                              {raw?.subUnitCostAED ? `${raw.subUnitCostAED.toFixed(2)} AED / ${ingRow.unit}` : 'Standard wholesale'}
                            </td>

                            <td className="py-2.5 px-3 font-mono font-bold text-[#192A24]">
                              {ingRow.costAED.toFixed(2)} AED
                            </td>

                            <td className="py-2.5 px-3">
                              {raw ? (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  (raw.stockSubUnits || 0) <= (raw.reorderSubUnits || 0)
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                }`}>
                                  {raw.stockSubUnits} {raw.subUnitName} in stock
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">Available</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          TAB 3: MASTER RECIPE CATALOGUE & BATCH SCALING
          ========================================================= */}
      {activeSubTab === 'recipes_catalogue' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-[#5A6F66] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search recipe or dish name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-2xl pl-10 pr-3 py-2 text-xs text-[#192A24] placeholder-[#7D948A] focus:outline-none focus:border-[#236B50]"
              />
            </div>

            <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-end">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-[#F6FAF8] border border-[#D5E5DE] rounded-2xl px-3.5 py-2 text-xs text-[#192A24] font-medium focus:outline-none focus:border-[#236B50]"
              >
                <option value="all">All Food Courses</option>
                <option value="Soups & Starters">Soups & Starters</option>
                <option value="Salads & Cold Mezze">Salads & Cold Mezze</option>
                <option value="Main Courses">Main Courses</option>
                <option value="Rice, Breads & Accompaniments">Rice, Breads & Accompaniments</option>
                <option value="Desserts & Sweets">Desserts & Sweets</option>
                <option value="Welcome Drinks">Welcome Drinks</option>
              </select>
            </div>
          </div>

          {/* Recipe Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRecipes.map((recipe) => {
              const metrics = computeRecipeDirectCost(recipe, ingredientsMap);
              const isProfitHealthy = metrics.foodCostPercent <= 35;

              return (
                <div
                  key={recipe.id}
                  className="bg-white border border-[#E2ECE7] hover:border-[#236B50]/40 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#EBF3EF] text-[#236B50]">
                        {recipe.category}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isProfitHealthy ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {formatPercent(metrics.foodCostPercent)} Food Cost
                      </span>
                    </div>

                    <h3 className="font-extrabold text-[#192A24] text-base mb-1">
                      {recipe.name}
                    </h3>
                    <p className="text-xs text-[#5A6F66] line-clamp-2 mb-4 leading-relaxed">
                      {recipe.description}
                    </p>

                    <div className="grid grid-cols-3 gap-2 p-3 bg-[#F8FAF9] rounded-2xl border border-[#E2ECE7] text-center mb-4">
                      <div>
                        <div className="text-[10px] text-[#5A6F66]">Raw Food</div>
                        <div className="text-xs font-black text-[#192A24] mt-0.5 font-mono">
                          {formatCurrency(metrics.ingredientCostTotal)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#5A6F66]">Total Cost</div>
                        <div className="text-xs font-black text-[#236B50] mt-0.5 font-mono">
                          {formatCurrency(metrics.totalCostPerPortion)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#5A6F66]">Gross Profit</div>
                        <div className="text-xs font-black text-[#236B50] mt-0.5 font-mono">
                          +{formatCurrency(metrics.grossProfitPerPortion)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#E2ECE7] flex items-center justify-between">
                    <div className="text-xs">
                      <span className="text-[#5A6F66]">Portion Price: </span>
                      <span className="font-extrabold text-[#192A24]">{formatCurrency(recipe.suggestedSellingPrice)}</span>
                    </div>
                    <button
                      onClick={() => setSelectedRecipeForDetails(recipe)}
                      className="px-3 py-1.5 rounded-full bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#236B50] text-xs font-bold transition-colors cursor-pointer"
                    >
                      View Recipe
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New Room Service Dish Modal */}
      {newDishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-[#D5E5DE] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2ECE7]">
              <div>
                <h3 className="font-extrabold text-base text-[#192A24]">Create New Room Service Dish</h3>
                <p className="text-xs text-[#5A6F66]">Add dish ingredients and calculate selling price and margins.</p>
              </div>
              <button
                onClick={() => setNewDishModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#192A24] mb-1">Dish Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Butter Chicken with Naan"
                  value={newDishName}
                  onChange={(e) => setNewDishName(e.target.value)}
                  className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs font-bold text-[#192A24] focus:outline-none focus:border-[#236B50]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#192A24] mb-1">Category</label>
                  <select
                    value={newDishCategory}
                    onChange={(e) => setNewDishCategory(e.target.value as RoomServiceDish['category'])}
                    className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                  >
                    <option value="Room Service Mains">Room Service Mains</option>
                    <option value="Appetizers & Snacks">Appetizers & Snacks</option>
                    <option value="Biryani & Rice">Biryani & Rice</option>
                    <option value="Sandwiches & Burgers">Sandwiches & Burgers</option>
                    <option value="Desserts & Beverages">Desserts & Beverages</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#192A24] mb-1">Selling Price (AED)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={newDishSellingPrice}
                    onChange={(e) => setNewDishSellingPrice(parseFloat(e.target.value) || 45)}
                    className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs font-bold text-emerald-800 focus:outline-none focus:border-[#236B50]"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="font-bold text-[#192A24] block mb-2">Ingredients Configuration</span>
                <div className="space-y-2">
                  {newDishIngredients.map((row, idx) => {
                    const raw = ingredientsMap.get(row.ingredientId);
                    return (
                      <div key={idx} className="flex items-center space-x-2">
                        <select
                          value={row.ingredientId}
                          onChange={(e) => {
                            const newId = e.target.value;
                            const ing = ingredientsMap.get(newId);
                            setNewDishIngredients(prev => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], ingredientId: newId, unit: ing?.subUnitName || 'kg' };
                              return copy;
                            });
                          }}
                          className="flex-1 bg-white border border-[#D5E5DE] rounded-xl px-2.5 py-1.5 text-xs text-[#192A24]"
                        >
                          {ingredients.map(ing => (
                            <option key={ing.id} value={ing.id}>{ing.name}</option>
                          ))}
                        </select>

                        <input
                          type="number"
                          step="0.1"
                          min="0.01"
                          value={row.subUnitsUsed}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setNewDishIngredients(prev => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], subUnitsUsed: val };
                              return copy;
                            });
                          }}
                          className="w-20 bg-white border border-[#D5E5DE] rounded-xl px-2 py-1.5 text-xs font-mono text-center text-[#192A24]"
                        />
                        <span className="text-[11px] text-[#5A6F66] w-14 truncate">{raw?.subUnitName || 'units'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2ECE7]">
                <button
                  type="button"
                  onClick={() => setNewDishModalOpen(false)}
                  className="px-4 py-2 bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#236B50] rounded-xl font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isChefRole) {
                      setToastMessage({
                        type: 'warning',
                        text: '🔒 Access Denied: Only Executive Chef Karim Zayani can enter dish recipes and ingredients.'
                      });
                      return;
                    }
                    if (!newDishName.trim()) return;
                    const calculatedIngredients = newDishIngredients.map(r => {
                      const ing = ingredientsMap.get(r.ingredientId);
                      const unitCost = ing?.subUnitCostAED || 5.00;
                      return {
                        ingredientId: r.ingredientId,
                        ingredientName: ing?.name || 'Ingredient',
                        quantity: r.subUnitsUsed,
                        unit: r.unit,
                        subUnitsUsed: r.subUnitsUsed,
                        costAED: parseFloat((r.subUnitsUsed * unitCost).toFixed(2))
                      };
                    });

                    const rawFoodCost = calculatedIngredients.reduce((s, i) => s + i.costAED, 0);
                    const totalCost = parseFloat((rawFoodCost + newDishLabor + newDishUtility).toFixed(2));
                    const foodCostPct = newDishSellingPrice > 0 ? parseFloat(((totalCost / newDishSellingPrice) * 100).toFixed(1)) : 25;
                    const grossMargin = parseFloat((newDishSellingPrice - totalCost).toFixed(2));
                    const marginPct = newDishSellingPrice > 0 ? parseFloat(((grossMargin / newDishSellingPrice) * 100).toFixed(1)) : 75;

                    const createdDish: RoomServiceDish = {
                      id: `rs_${Date.now()}`,
                      name: newDishName.trim(),
                      category: newDishCategory,
                      portionYield: 1,
                      ingredients: calculatedIngredients,
                      prepLaborCostAED: newDishLabor,
                      utilityOverheadAED: newDishUtility,
                      totalDishCostAED: totalCost,
                      sellingPriceAED: newDishSellingPrice,
                      targetFoodCostPercent: 28.0,
                      actualFoodCostPercent: foodCostPct,
                      grossMarginAED: grossMargin,
                      marginPercent: marginPct,
                      description: `Freshly prepared ${newDishName.trim()} with chef ingredients from Crystal Plaza kitchen.`,
                      dietary: ['Halal'],
                      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'
                    };

                    AppStorage.saveRoomServiceDish(createdDish);
                    setRoomServiceDishes(AppStorage.getRoomServiceDishes());
                    setSelectedDishId(createdDish.id);
                    setNewDishModalOpen(false);
                    setToastMessage({
                      type: 'success',
                      text: `✓ Saved new Room Service dish: ${createdDish.name} (Selling Price: ${formatCurrency(createdDish.sellingPriceAED)})!`
                    });
                  }}
                  className="px-5 py-2 bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white rounded-xl font-extrabold shadow-sm transition-all cursor-pointer"
                >
                  Save Dish to Menu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Detail Drawer */}
      {selectedRecipeForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-[#D5E5DE] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2ECE7]">
              <div>
                <h3 className="font-extrabold text-base text-[#192A24]">{selectedRecipeForDetails.name}</h3>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#EBF3EF] text-[#236B50]">
                  {selectedRecipeForDetails.category}
                </span>
              </div>
              <button
                onClick={() => setSelectedRecipeForDetails(null)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[#5A6F66]">{selectedRecipeForDetails.description}</p>
              
              <div className="overflow-x-auto rounded-2xl border border-[#D5E5DE]">
                <table className="w-full text-left">
                  <thead className="bg-[#F8FAF9] text-[#5A6F66] font-bold text-[10px] uppercase">
                    <tr>
                      <th className="py-2 px-3">Ingredient</th>
                      <th className="py-2 px-3">Portion Qty</th>
                      <th className="py-2 px-3">Cost AED</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2ECE7]">
                    {selectedRecipeForDetails.ingredients.map((ing, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 font-semibold text-[#192A24]">{ing.ingredientName}</td>
                        <td className="py-2 px-3 font-mono">{ing.quantityPerPortion} {ing.unit}</td>
                        <td className="py-2 px-3 font-mono font-bold text-[#192A24]">{ing.calculatedCost.toFixed(2)} AED</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-[#EBF5F0] rounded-2xl border border-[#B8DFC9] flex justify-between font-bold text-xs text-[#236B50]">
                <span>Total Dish Cost: {formatCurrency(selectedRecipeForDetails.totalCostPerPortion)}</span>
                <span>Selling Price: {formatCurrency(selectedRecipeForDetails.suggestedSellingPrice)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          CALCULATOR 4: GENERAL LEDGER POSTING REPORTS DIRECTORY
          ========================================================= */}
      {activeSubTab === 'posting_reports' && (
        <div className="space-y-6">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-white rounded-3xl p-5 border border-purple-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-black uppercase tracking-wider bg-purple-700 text-white px-2.5 py-0.5 rounded-full">
                  Accounting & GL Audit Journal
                </span>
                <span className="text-sm font-extrabold text-purple-950">
                  Official Food Costing Posting Reports & Dual Attestation Stamps
                </span>
              </div>
              <p className="text-xs text-purple-900 max-w-2xl">
                Certified records containing <strong>Executive Chef Karim's Official Stamped Ingredient Usages</strong> and <strong>Arun Kumar's Purchasing General Ledger Journal Entries</strong>. All figures are permanently audited and available to print or export.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <span className="px-3.5 py-1.5 rounded-full bg-purple-100 text-purple-900 text-xs font-black border border-purple-300">
                {costedPostingParties.length} Posted Reports Certified
              </span>
            </div>
          </div>

          {/* Posting Reports Grid / List */}
          {costedPostingParties.length === 0 ? (
            <div className="bg-white border border-[#E2ECE7] rounded-3xl p-12 text-center text-[#5A6F66] space-y-3">
              <FileText className="w-10 h-10 text-purple-400 mx-auto" />
              <h3 className="text-base font-extrabold text-[#192A24]">No Costing Reports Posted Yet</h3>
              <p className="text-xs max-w-md mx-auto">
                Once Chef Karim logs and stamps ingredients for concluded parties and Arun Kumar enters purchasing rates, the official Posting Reports will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {costedPostingParties.map(party => {
                const entries = party.chefPartyEntries || [];
                const rawIngredientsCost = entries.reduce((s, e) => s + (e.calculatedCostAED || 0), 0);
                const guests = party.guestCount || 30;
                const laborAndUtilitiesCost = party.hasFoodFromHotel ? guests * 4.20 : 0;
                const totalDirectFoodCost = party.foodCostActualTotal || (rawIngredientsCost + laborAndUtilitiesCost);
                const billedFoodRevenue = party.hasFoodFromHotel ? (party.foodPricePerGuestCharged || 60) * guests : 0;
                const grossProfit = billedFoodRevenue - totalDirectFoodCost;
                const foodCostPercent = billedFoodRevenue > 0 ? (totalDirectFoodCost / billedFoodRevenue) * 100 : 0;

                const postingReportNum = party.postingReportNumber || `CPH-GL-POST-${party.bookingNumber.replace(/[^0-9]/g, '') || '2026-001'}`;
                const chefStampNum = party.chefStampSerial || `CPH-CHEF-STAMP-${party.bookingNumber.replace(/[^0-9]/g, '') || '2026-001'}`;
                const postingDate = party.glPostingDate || party.arunCostedAt || new Date().toISOString();
                const chefLogDate = party.chefApprovedAt || party.chefForwardedAt || party.eventDate;

                return (
                  <div 
                    key={party.id}
                    className="bg-white rounded-3xl p-6 border border-purple-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300">
                          {postingReportNum}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1">
                          <Check className="w-3 h-3 text-emerald-700" />
                          <span>GL Posted & Stamped</span>
                        </span>
                      </div>

                      <h3 className="text-base font-extrabold text-[#192A24]">
                        {party.clientName}
                      </h3>
                      <div className="text-xs text-[#5A6F66]">
                        {party.eventType} • <strong className="text-[#192A24]">{party.guestCount} Guests</strong> ({party.hallName})
                      </div>

                      {/* Dual Attestation Badges */}
                      <div className="grid grid-cols-2 gap-2 p-3 bg-purple-50/50 rounded-2xl border border-purple-100 text-[11px]">
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">1. Chef Stamp:</span>
                          <strong className="text-amber-900 font-mono text-[10px] block truncate">{chefStampNum}</strong>
                          <span className="text-[10px] text-slate-500">Logged: {new Date(chefLogDate).toLocaleDateString('en-GB')}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">2. Accounts Post:</span>
                          <strong className="text-purple-900 font-mono text-[10px] block truncate">{party.arunCostedBy || 'Arun Kumar'}</strong>
                          <span className="text-[10px] text-slate-500">Posted: {new Date(postingDate).toLocaleDateString('en-GB')}</span>
                        </div>
                      </div>

                      {/* Financial Metrics */}
                      <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-[9px] uppercase text-slate-500 block font-bold">Billed Revenue</span>
                          <strong className="text-xs text-slate-900 font-mono">{formatCurrency(billedFoodRevenue)}</strong>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-[9px] uppercase text-slate-500 block font-bold">Actual Cost</span>
                          <strong className="text-xs text-rose-700 font-mono">{formatCurrency(totalDirectFoodCost)}</strong>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-[9px] uppercase text-slate-500 block font-bold">Food Cost %</span>
                          <strong className={`text-xs font-mono font-bold ${foodCostPercent <= 40 ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {foodCostPercent.toFixed(1)}%
                          </strong>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedPostingReportBooking(party)}
                      className="w-full py-2.5 bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white text-xs font-black rounded-2xl shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      <span>📄 View / Print Official Posting Report</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Official General Ledger Posting Report Modal */}
      {selectedPostingReportBooking && (
        <PostingReportModal
          booking={selectedPostingReportBooking}
          currentUser={currentUser}
          onClose={() => setSelectedPostingReportBooking(null)}
        />
      )}

      {/* Standalone Chef & Accounts Costing Workflow Modal */}
      {costingModalBooking && (
        <ChefAccountsCostingWorkflow
          booking={costingModalBooking}
          currentUser={currentUser}
          allUsers={allUsers}
          recipes={recipes}
          ingredients={ingredients}
          onClose={() => setCostingModalBooking(null)}
          onSaveCosting={(bookingId, entries, method, status, actualCost, cNotes, aNotes) => {
            if (onSavePartyCosting) {
              onSavePartyCosting(bookingId, entries, method, status, actualCost, cNotes, aNotes);
            }
            setCostingModalBooking(null);
            setToastMessage({
              type: 'success',
              text: status === 'forwarded_to_accounts'
                ? '✓ Chef ingredient quantities logged and forwarded to Accounts!'
                : '✓ Accounts costing finalized & locked. GL journal entry created!',
            });
          }}
          onOpenA4Sheet={onOpenA4Sheet}
        />
      )}
    </div>
  );
};
