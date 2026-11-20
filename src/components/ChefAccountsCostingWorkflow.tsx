import React, { useState, useEffect } from 'react';
import { 
  ChefHat, 
  Calculator, 
  Upload, 
  FileSpreadsheet, 
  ScanLine, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  Trash2, 
  Plus, 
  DollarSign, 
  AlertCircle, 
  FileText, 
  X, 
  RefreshCw, 
  Search,
  Building,
  Check,
  Percent,
  Clock,
  Eye,
  Send,
  Receipt,
  Boxes,
  Lock,
  ShieldAlert,
  UtensilsCrossed
} from 'lucide-react';
import { 
  BookingEvent, 
  UserProfile, 
  ChefPartyIngredientEntry, 
  CostingMethod, 
  CostingWorkflowStatus,
  RawIngredient,
  RecipeMenuItem 
} from '../types';
import { 
  parseExcelFile, 
  parsePastedPriceText, 
  parseOcrImage, 
  parseQuantityAndUnit,
  matchIngredientToPrice, 
  CPH_PURCHASING_MASTER_CATALOG, 
  PurchasingPriceRecord 
} from '../utils/excelOcrParser';
import { formatCurrency, formatPercent } from '../utils/costCalculations';
import { PostingReportModal } from './PostingReportModal';

interface ChefAccountsCostingWorkflowProps {
  booking: BookingEvent;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  recipes: RecipeMenuItem[];
  ingredients: RawIngredient[];
  onClose: () => void;
  onSaveCosting: (
    bookingId: string, 
    entries: ChefPartyIngredientEntry[], 
    method: CostingMethod, 
    status: CostingWorkflowStatus, 
    actualCost: number, 
    chefNotes: string, 
    arunNotes: string
  ) => void;
  onOpenA4Sheet?: (booking: BookingEvent) => void;
}

export const ChefAccountsCostingWorkflow: React.FC<ChefAccountsCostingWorkflowProps> = ({
  booking,
  currentUser,
  allUsers,
  recipes,
  ingredients,
  onClose,
  onSaveCosting,
  onOpenA4Sheet,
}) => {
  // Active perspective: 'chef' or 'accounts'
  const isAccountsRole = currentUser.role === 'accounts_executive';
  const isChefRole = currentUser.role === 'executive_chef';
  const [activeRoleView, setActiveRoleView] = useState<'chef' | 'accounts'>(
    isChefRole ? 'chef' : 'accounts'
  );

  // Method: 'party_batch' (general for party buffet) vs 'item_by_item' (room service / dish by dish)
  const [costingMethod, setCostingMethod] = useState<CostingMethod>(
    booking.costingMethod || 'party_batch'
  );

  // Entries logged by chef / priced by Arun
  const [entries, setEntries] = useState<ChefPartyIngredientEntry[]>([]);
  const [chefNotes, setChefNotes] = useState<string>(booking.chefNotes || '');
  const [arunNotes, setArunNotes] = useState<string>(booking.arunAccountsNotes || '');
  const [showChefVoucherModal, setShowChefVoucherModal] = useState<boolean>(false);
  const [showPostingReportModal, setShowPostingReportModal] = useState<boolean>(false);
  const [selectedStockId, setSelectedStockId] = useState<string>('');

  // Arun's Excel / OCR assistant state
  const [assistantTab, setAssistantTab] = useState<'excel' | 'paste' | 'ocr' | 'master'>('excel');
  const [pastedText, setPastedText] = useState<string>('');
  const [importedCatalog, setImportedCatalog] = useState<PurchasingPriceRecord[]>(CPH_PURCHASING_MASTER_CATALOG);
  const [lastImportInfo, setLastImportInfo] = useState<string>('Loaded Crystal Plaza Master Hotel Price Catalog (26 items)');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [ocrSamplePreview, setOcrSamplePreview] = useState<string>('');
  const [missingPriceItemIds, setMissingPriceItemIds] = useState<Set<string>>(new Set());

  // Toast / feedback message
  const [bannerAlert, setBannerAlert] = useState<{ type: 'success' | 'info' | 'warning'; message: string } | null>(null);

  // Initialize entries from booking or generate sensible starter rows
  useEffect(() => {
    if (booking.chefPartyEntries && booking.chefPartyEntries.length > 0) {
      setEntries(booking.chefPartyEntries);
    } else {
      // Create starter default for 30-person celebration buffet
      const guests = booking.guestCount || 30;
      const starterItems: ChefPartyIngredientEntry[] = [
        {
          id: `item_1_${Date.now()}`,
          ingredient: 'Whole Fresh Chicken Grade A',
          amountUsed: '1 carton',
          foodItemName: costingMethod === 'item_by_item' ? 'Shish Tawook & Chicken Biryani' : undefined,
          notes: 'Standard 10-bird carton for party buffet chafers',
        },
        {
          id: `item_2_${Date.now()}`,
          ingredient: 'Australian Mutton Bone-in',
          amountUsed: `${Math.round(guests * 0.16)} kg`,
          foodItemName: costingMethod === 'item_by_item' ? 'Mutton Dum Biryani' : undefined,
          notes: 'Trimmed and cooked for hot buffet line',
        },
        {
          id: `item_3_${Date.now()}`,
          ingredient: 'Basmati Rice Premium (India Gate)',
          amountUsed: `${Math.round(guests * 0.20)} kg`,
          foodItemName: costingMethod === 'item_by_item' ? 'Biryani & Steamed Rice' : undefined,
          notes: 'Steamed with saffron and whole spices',
        },
        {
          id: `item_4_${Date.now()}`,
          ingredient: 'Pure Vegetable Cooking Oil & Ghee',
          amountUsed: '3 liters',
          foodItemName: costingMethod === 'item_by_item' ? 'Kitchen Prep' : undefined,
          notes: 'General buffet sautéing',
        },
        {
          id: `item_5_${Date.now()}`,
          ingredient: 'Fresh Red Onions & Garlic Produce',
          amountUsed: '5 kg',
          foodItemName: costingMethod === 'item_by_item' ? 'Salad & Gravy' : undefined,
          notes: 'Curry bases and garnishes',
        },
      ];
      setEntries(starterItems);
    }
  }, [booking.id]);

  // -------------------------------------------------------------
  // Chef Handlers (Two Fields: Ingredient & Amount Used)
  // STRICT PRIVILEGE: ONLY Executive Chef Karim can put / alter ingredients!
  // Arun Kumar (Accounts) and all other staff are restricted.
  // -------------------------------------------------------------
  const handleAddRow = () => {
    if (!isChefRole) {
      setBannerAlert({
        type: 'warning',
        message: '🔒 Chef Privilege Restricted: Only Executive Chef Karim Zayani can put or add party ingredients. Arun Kumar (Accounts) and other staff cannot alter Chef entries.',
      });
      return;
    }
    const newRow: ChefPartyIngredientEntry = {
      id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ingredient: '',
      amountUsed: '',
      foodItemName: costingMethod === 'item_by_item' ? 'Room Service / Dish' : undefined,
    };
    setEntries(prev => [...prev, newRow]);
  };

  const handleUpdateChefEntry = (index: number, field: 'ingredient' | 'amountUsed' | 'foodItemName' | 'notes', value: string) => {
    if (!isChefRole) {
      setBannerAlert({
        type: 'warning',
        message: '🔒 Chef Privilege Restricted: Only Executive Chef Karim Zayani can edit party ingredients. Arun Kumar and other staff cannot alter Chef entries.',
      });
      return;
    }
    setEntries(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveRow = (index: number) => {
    if (!isChefRole) {
      setBannerAlert({
        type: 'warning',
        message: '🔒 Chef Privilege Restricted: Only Executive Chef Karim Zayani can remove party ingredients.',
      });
      return;
    }
    setEntries(prev => prev.filter((_, i) => i !== index));
  };

  const handleApplyPresetTemplate = () => {
    if (!isChefRole) {
      setBannerAlert({
        type: 'warning',
        message: '🔒 Chef Privilege Restricted: Only Executive Chef Karim Zayani can apply party ingredient presets.',
      });
      return;
    }
    const guests = booking.guestCount || 30;
    const presets: ChefPartyIngredientEntry[] = [
      { id: `p1_${Date.now()}`, ingredient: 'Fresh Whole Chicken Grade A', amountUsed: '1 carton', notes: '10 birds carton' },
      { id: `p2_${Date.now()}`, ingredient: 'Australian Mutton Bone-in', amountUsed: '5 kg', notes: 'Dum biryani portion' },
      { id: `p3_${Date.now()}`, ingredient: 'Basmati Rice Premium (India Gate)', amountUsed: '6 kg', notes: 'Pilaf & biryani' },
      { id: `p4_${Date.now()}`, ingredient: 'Pure Vegetable Cooking Oil', amountUsed: '3 liters', notes: 'Deep frying & tadka' },
      { id: `p5_${Date.now()}`, ingredient: 'Pure Cow Desi Ghee', amountUsed: '1 kg', notes: 'Dum seal flavoring' },
      { id: `p6_${Date.now()}`, ingredient: 'Fresh Red Onions & Tomatoes', amountUsed: '6 kg', notes: 'Salad & gravies' },
      { id: `p7_${Date.now()}`, ingredient: 'Garlic & Ginger Paste', amountUsed: '1 kg', notes: 'Meat marinade' },
      { id: `p8_${Date.now()}`, ingredient: 'Umm Ali Pastry, Nuts & Milk Set', amountUsed: '1 batch set', notes: 'Chafer dessert' },
    ];
    setEntries(presets);
    setBannerAlert({
      type: 'info',
      message: `Loaded standard ${guests}-guest party pantry batch template. Chef can now adjust quantities!`,
    });
  };

  const handleSelectFromStock = (ingredientId: string) => {
    if (!isChefRole) {
      setBannerAlert({
        type: 'warning',
        message: '🔒 Chef Privilege Restricted: Only Executive Chef Karim Zayani can fetch stock ingredients for party costing.',
      });
      return;
    }
    if (!ingredientId) return;
    const ing = ingredients.find(i => i.id === ingredientId);
    if (!ing) return;
    const newEntry: ChefPartyIngredientEntry = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ingredient: ing.name,
      amountUsed: '',
      foodItemName: costingMethod === 'item_by_item' ? 'Buffet Service' : undefined,
      notes: `In Stock: ${ing.stockQuantity} ${ing.unit} (${ing.storageLocation || 'Kitchen Store'})`,
    };
    setEntries(prev => [...prev, newEntry]);
    setSelectedStockId('');
    setBannerAlert({
      type: 'info',
      message: `✓ Fetched "${ing.name}" from stocks (${ing.stockQuantity} ${ing.unit} available). Now enter the amount used below!`,
    });
  };

  const handleQuickAddStock = (itemName: string, defaultAmount: string = '') => {
    if (!isChefRole) {
      setBannerAlert({
        type: 'warning',
        message: '🔒 Chef Privilege Restricted: Only Executive Chef Karim Zayani can put ingredients.',
      });
      return;
    }
    const matched = ingredients.find(i => i.name.toLowerCase().includes(itemName.toLowerCase()));
    const finalName = matched ? matched.name : itemName;
    const newEntry: ChefPartyIngredientEntry = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ingredient: finalName,
      amountUsed: defaultAmount,
      foodItemName: costingMethod === 'item_by_item' ? 'Buffet Service' : undefined,
      notes: matched ? `Stock: ${matched.stockQuantity} ${matched.unit} (${matched.storageLocation || 'Store'})` : undefined,
    };
    setEntries(prev => [...prev, newEntry]);
    setBannerAlert({
      type: 'info',
      message: `✓ Added "${finalName}" to party ingredients list. Enter the exact amount used.`,
    });
  };

  const handleChefForwardToAccounts = () => {
    if (!isChefRole) {
      setBannerAlert({
        type: 'warning',
        message: '🔒 Chef Privilege Restricted: Only Executive Chef Karim Zayani can transmit official kitchen vouchers to Accounts.',
      });
      return;
    }
    if (entries.length === 0 || entries.every(e => !e.ingredient.trim())) {
      setBannerAlert({
        type: 'warning',
        message: 'Please add at least one ingredient and amount before forwarding to Accounts.',
      });
      return;
    }

    const currentTotalCost = entries.reduce((s, e) => s + (e.calculatedCostAED || 0), 0);
    const labor = (booking.guestCount || 30) * 4.20;
    const finalCost = currentTotalCost > 0 ? currentTotalCost + labor : (booking.foodCostActualTotal || 0);

    onSaveCosting(
      booking.id,
      entries,
      costingMethod,
      'forwarded_to_accounts',
      finalCost,
      chefNotes,
      arunNotes
    );

    setShowChefVoucherModal(true);
    setBannerAlert({
      type: 'success',
      message: '✓ Kitchen Ingredients Voucher confirmed and transmitted to Arun Kumar (Accounts Executive)!',
    });
  };

  // -------------------------------------------------------------
  // Arun Accounts Handlers (Excel File, Paste, OCR, Auto-Match)
  // -------------------------------------------------------------
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingFile(true);
      const parsed = await parseExcelFile(file);
      if (parsed.length > 0) {
        setImportedCatalog(parsed);
        setLastImportInfo(`✓ Successfully parsed Excel file "${file.name}" (${parsed.length} purchasing price lines extracted)`);
        setBannerAlert({
          type: 'success',
          message: `Imported ${parsed.length} price records from Excel! Click "Auto-Match Chef Ingredients" below to apply.`,
        });
      } else {
        setBannerAlert({
          type: 'warning',
          message: `No price columns found in "${file.name}". Please ensure columns include Item Name and Price/AED.`,
        });
      }
    } catch (err) {
      console.error(err);
      setBannerAlert({
        type: 'warning',
        message: 'Could not parse Excel spreadsheet. Please verify file format.',
      });
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handlePasteParse = () => {
    if (!pastedText.trim()) return;
    const parsed = parsePastedPriceText(pastedText);
    if (parsed.length > 0) {
      setImportedCatalog(parsed);
      setLastImportInfo(`✓ Parsed ${parsed.length} rows from clipboard text`);
      setBannerAlert({
        type: 'success',
        message: `Parsed ${parsed.length} purchasing prices from pasted text! Click "Auto-Match Chef Ingredients" to link prices.`,
      });
    } else {
      setBannerAlert({
        type: 'warning',
        message: 'Could not extract valid item/price columns from pasted rows. Format example: ItemName [Tab] Price',
      });
    }
  };

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingFile(true);
      const { text, records } = await parseOcrImage(file);
      setOcrSamplePreview(text);
      if (records.length > 0) {
        setImportedCatalog(records);
        setLastImportInfo(`✓ OCR Scanner successfully processed image "${file.name}" (${records.length} items extracted)`);
        setBannerAlert({
          type: 'success',
          message: `OCR Scanner extracted ${records.length} prices from invoice image! Click "Auto-Match Chef Ingredients" to apply.`,
        });
      }
    } catch (err) {
      console.error(err);
      setBannerAlert({
        type: 'warning',
        message: 'OCR scanning failed. Please try a clearer image or use Excel upload.',
      });
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleLoadMasterCatalog = () => {
    setImportedCatalog(CPH_PURCHASING_MASTER_CATALOG);
    setLastImportInfo(`✓ Loaded Crystal Plaza Hotel Purchasing Master Price Catalog (${CPH_PURCHASING_MASTER_CATALOG.length} verified supplier rates)`);
    setBannerAlert({
      type: 'info',
      message: 'Loaded Crystal Plaza Hotel Master Price Catalog. Ready for auto-matching.',
    });
  };

  // The Magic Auto-Match: links Chef's entered items to Arun's Excel/OCR prices
  const handleAutoMatchPrices = () => {
    let matchedCount = 0;
    const updated = entries.map(entry => {
      if (!entry.ingredient.trim()) return entry;

      const match = matchIngredientToPrice(entry.ingredient, entry.amountUsed, importedCatalog);
      if (match.unitPrice > 0) {
        matchedCount++;
        return {
          ...entry,
          purchasingPriceAED: match.unitPrice,
          purchasingUnit: match.unit,
          calculatedCostAED: match.totalCost,
          priceSource: match.source,
          matchedItemDescription: match.matchedRecord?.item,
        };
      }
      return entry;
    });

    setEntries(updated);
    setBannerAlert({
      type: 'success',
      message: `✨ Auto-matched ${matchedCount} of ${entries.length} items from Arun's purchasing price records!`,
    });
  };

  const handleUpdateArunPrice = (index: number, newUnitPrice: number) => {
    setEntries(prev => {
      const copy = [...prev];
      const entry = { ...copy[index] };
      entry.purchasingPriceAED = newUnitPrice;
      const { quantity } = parseQuantityAndUnit(entry.amountUsed);
      entry.calculatedCostAED = parseFloat((quantity * newUnitPrice).toFixed(2));
      entry.priceSource = 'manual_arun';
      copy[index] = entry;
      return copy;
    });

    if (newUnitPrice > 0 && entries[index]?.id) {
      setMissingPriceItemIds(prev => {
        const next = new Set(prev);
        next.delete(entries[index].id);
        return next;
      });
    }
  };

  // Arun Approves & Commits Costing
  const handleArunApproveCosting = () => {
    // RULE ENFORCEMENT: Accounts enters the purchase price for every line item. If any are missing, block costing and highlight incomplete fields!
    const missing = entries.filter(e => 
      e.purchasingPriceAED === undefined || 
      e.purchasingPriceAED === null || 
      Number(e.purchasingPriceAED) <= 0 || 
      isNaN(Number(e.purchasingPriceAED))
    );

    if (missing.length > 0) {
      const missingIds = new Set(missing.map(m => m.id));
      setMissingPriceItemIds(missingIds);
      setBannerAlert({
        type: 'warning',
        message: `⛔ COSTING BLOCKED: Missing purchase price for ${missing.length} ingredient line item(s). Accounts must enter purchase prices for all items before committing! Incomplete fields are highlighted below in red.`,
      });
      return;
    }

    setMissingPriceItemIds(new Set());

    const rawTotal = entries.reduce((s, e) => s + (e.calculatedCostAED || 0), 0);
    const guests = booking.guestCount || 30;
    const laborAndOverhead = guests * 4.20; // 4.20 AED/guest kitchen utility and prep overhead
    const finalActualCost = rawTotal + laborAndOverhead;

    onSaveCosting(
      booking.id,
      entries,
      costingMethod,
      'costed_by_arun',
      finalActualCost,
      chefNotes,
      arunNotes
    );

    setShowPostingReportModal(true);

    setBannerAlert({
      type: 'success',
      message: `✓ Banquet Food Costing approved by Arun Kumar & posted to General Ledger! Official GL Posting Report generated.`,
    });
  };

  // Auto-fill kitchen ingredient rows with forwarded guest dishes
  const handleFillRowsFromForwardedDishes = () => {
    if (!booking.selectedFoodItems || booking.selectedFoodItems.length === 0) return;
    const newRows: ChefPartyIngredientEntry[] = booking.selectedFoodItems.map((dish, idx) => ({
      id: `cpe_dish_${Date.now()}_${idx}`,
      foodItemName: dish,
      ingredient: '',
      amountUsed: '',
      notes: `Kitchen ingredients for ${dish}`,
    }));
    setCostingMethod('item_by_item');
    setEntries(newRows);
    setBannerAlert({
      type: 'info',
      message: `✨ Populated ${newRows.length} kitchen costing rows matching guest-selected dishes!`,
    });
  };

  // Calculations
  const guests = booking.guestCount || 30;
  const foodPricePerGuest = booking.foodPricePerGuestCharged || 60;
  const billedFoodRevenue = booking.hasFoodFromHotel ? (foodPricePerGuest * guests) : 0;
  const totalIngredientCost = entries.reduce((s, e) => s + (e.calculatedCostAED || 0), 0);
  const laborAndOverhead = booking.hasFoodFromHotel ? (guests * 4.20) : 0;
  const totalDirectFoodCost = totalIngredientCost + laborAndOverhead;
  const grossProfit = billedFoodRevenue - totalDirectFoodCost;
  const profitMarginPercent = billedFoodRevenue > 0 ? (grossProfit / billedFoodRevenue) * 100 : 0;
  const foodCostPercent = billedFoodRevenue > 0 ? (totalDirectFoodCost / billedFoodRevenue) * 100 : 0;

  const currentStatus = booking.costingStatus || 'not_started';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[94vh] overflow-y-auto shadow-2xl border border-[#D5E5DE] p-5 sm:p-7 flex flex-col space-y-5">
        
        {/* =========================================================
            HEADER & PARTY BANNER
            ========================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2ECE7] gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-[#E8F5EE] text-[#236B50] flex items-center justify-center border border-[#C5E5D5] shadow-xs shrink-0">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-extrabold text-[#192A24] text-lg sm:text-xl font-['Plus_Jakarta_Sans']">
                  Banquet Food Costing & Accounts Audit
                </h2>
                <span className="bg-[#EBF3EF] text-[#236B50] text-[10px] font-black px-2.5 py-0.5 rounded-full border border-[#D5E5DE]">
                  Crystal Plaza Hotel
                </span>
              </div>
              <p className="text-xs text-[#5A6F66] mt-0.5">
                Party Ref: <strong className="text-[#192A24]">{booking.bookingNumber}</strong> • Client: {booking.clientName} ({guests} Guests • {booking.buffetTier === '60_aed' ? '60 AED Buffet' : booking.buffetTier === '80_aed' ? '80 AED Buffet' : '100 AED Buffet'})
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* View A4 Sheet shortcut button */}
            {onOpenA4Sheet && (
              <button
                type="button"
                onClick={() => onOpenA4Sheet(booking)}
                className="px-3.5 py-2 rounded-xl bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#236B50] font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer"
                title="View Official 2-Page Banquet Sheet"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden md:inline">View 2-Page Sheet</span>
              </button>
            )}

            {/* View GL Posting Report button if completed */}
            {(booking.costingStatus === 'costed_by_arun' || booking.postingReportGenerated) && (
              <button
                type="button"
                onClick={() => setShowPostingReportModal(true)}
                className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 font-black text-xs flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
                title="View Official General Ledger Posting Report with Dual Stamps"
              >
                <FileText className="w-4 h-4 text-purple-700" />
                <span>📄 GL Posting Report</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="text-[#5A6F66] hover:text-[#192A24] p-2 rounded-full hover:bg-[#EBF3EF] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* =========================================================
            ROLE PERSPECTIVE TOGGLE & WORKFLOW STEPS
            ========================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center bg-[#F4F8F6] p-3.5 rounded-2xl border border-[#E2ECE7]">
          {/* Active Role Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-[#5A6F66]">Active Role Perspective:</span>
            <div className="inline-flex rounded-xl p-1 bg-white border border-[#D5E5DE] shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveRoleView('chef')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeRoleView === 'chef'
                    ? 'bg-[#236B50] text-white shadow-xs'
                    : 'text-[#486356] hover:text-[#192A24]'
                }`}
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Chef Karim (Kitchen Ingredients)</span>
                {!isChefRole && (
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-200 text-amber-950">
                    Read-Only
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (currentUser.role === 'executive_chef') {
                    setBannerAlert({
                      type: 'warning',
                      message: '🔒 Access Restricted: Only Arun Kumar (Accounts Executive) has the privilege to alter prices and finalize costing.',
                    });
                    return;
                  }
                  setActiveRoleView('accounts');
                }}
                disabled={currentUser.role === 'executive_chef'}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center space-x-1.5 transition-all ${
                  currentUser.role === 'executive_chef'
                    ? 'opacity-50 cursor-not-allowed text-slate-400 bg-slate-50'
                    : activeRoleView === 'accounts'
                    ? 'bg-[#236B50] text-white shadow-xs cursor-pointer'
                    : 'text-[#486356] hover:text-[#192A24] cursor-pointer'
                }`}
                title={currentUser.role === 'executive_chef' ? 'Restricted: Only Arun Kumar (Accounts) can enter prices' : 'View Accounts Pricing'}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Arun Kumar (Accounts & Purchasing)</span>
                {currentUser.role === 'executive_chef' && <span className="text-[10px]">🔒</span>}
              </button>
            </div>
          </div>

          {/* Workflow Status Tracker */}
          <div className="flex items-center justify-end space-x-2 text-xs font-semibold">
            <div className={`flex items-center space-x-1 px-2.5 py-1 rounded-full border ${
              currentStatus === 'chef_draft' || currentStatus === 'not_started'
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              <span>1. Chef Logging</span>
            </div>
            <ArrowRight className="w-3 h-3 text-[#A3C9B9]" />
            <div className={`flex items-center space-x-1 px-2.5 py-1 rounded-full border ${
              currentStatus === 'forwarded_to_accounts'
                ? 'bg-blue-100 text-blue-900 border-blue-300 animate-pulse'
                : currentStatus === 'costed_by_arun' || currentStatus === 'approved'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              <span>2. Accounts (Arun)</span>
            </div>
            <ArrowRight className="w-3 h-3 text-[#A3C9B9]" />
            <div className={`flex items-center space-x-1 px-2.5 py-1 rounded-full border ${
              currentStatus === 'costed_by_arun' || currentStatus === 'approved'
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              <Check className="w-3 h-3" />
              <span>3. Final Costed</span>
            </div>
          </div>
        </div>

        {/* Alert Banner if present */}
        {bannerAlert && (
          <div className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between border ${
            bannerAlert.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : bannerAlert.type === 'warning'
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-sky-50 text-sky-900 border-sky-200'
          }`}>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{bannerAlert.message}</span>
            </div>
            <button onClick={() => setBannerAlert(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Forwarded Guest-Selected Menu & Dishes (from Francis D'Souza) */}
        {(booking.selectedMenuName || (booking.selectedFoodItems && booking.selectedFoodItems.length > 0)) && (
          <div className="p-4 bg-gradient-to-r from-[#F4F9F6] to-white rounded-2xl border-2 border-[#C5E5D5] space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#DDECE4]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#236B50] text-white flex items-center justify-center shrink-0">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#E8F5EE] text-[#236B50] border border-[#C5E5D5]">
                      Forwarded by Francis (F&B)
                    </span>
                    <span className="text-xs font-black text-[#192A24]">
                      {booking.selectedMenuName || 'Registered Banquet Menu'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5A6F66] mt-0.5">
                    Official contracted food dishes selected by guest. Chef Karim cooks these items; Accounts costs ingredients.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
                <span className="text-xs font-bold text-[#236B50] bg-white px-2.5 py-1 rounded-xl border border-[#D5E5DE]">
                  {booking.selectedFoodItems?.length || 0} Dishes Chosen
                </span>
                {isChefRole && (
                  <button
                    type="button"
                    onClick={handleFillRowsFromForwardedDishes}
                    className="px-3 py-1.5 rounded-xl bg-[#236B50] hover:bg-[#1C5740] text-white text-xs font-black flex items-center space-x-1 cursor-pointer shadow-xs active:scale-95 transition-all"
                    title="Populate kitchen logging rows with each forwarded dish name"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Auto-Fill Dishes for Costing</span>
                  </button>
                )}
              </div>
            </div>

            {/* List of Dishes */}
            {booking.selectedFoodItems && booking.selectedFoodItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {booking.selectedFoodItems.map((dish, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white border border-[#D5E5DE] text-xs font-bold text-slate-800 shadow-2xs"
                  >
                    <span className="text-[#236B50] font-black mr-0.5">#{idx + 1}</span>
                    <span>{dish}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            SECTION 1: CHEF PERSPECTIVE (Chef Karim)
            ========================================================= */}
        {activeRoleView === 'chef' && (
          <div className="space-y-4">
            {/* Security Lock Banner if Non-Chef is viewing */}
            {!isChefRole && (
              <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center space-x-3 text-amber-950 font-bold text-xs shadow-xs animate-in fade-in duration-200">
                <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-amber-900 font-extrabold uppercase text-[10px] tracking-wider flex items-center space-x-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-800" />
                    <span>Executive Chef Privilege Enforced (Read-Only Audit Mode)</span>
                  </div>
                  <p className="text-amber-900 text-xs">
                    Only <strong>Executive Chef Karim Zayani</strong> has the privilege to put, add, or alter ingredients. You are logged in as <strong>{currentUser.name} ({currentUser.role.replace('_', ' ')})</strong>. Arun Kumar (Accounts) and other staff cannot alter Chef entries.
                  </p>
                </div>
              </div>
            )}

            {/* Two Costing Methods Option Cards */}
            <div className="p-4 bg-[#F8FAF9] rounded-2xl border border-[#D5E5DE] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-[#192A24] uppercase tracking-wider flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#236B50]" />
                    <span>Select Costing Method (Chef Options)</span>
                  </h4>
                  <p className="text-[11px] text-[#5A6F66]">
                    Choose how kitchen usage is recorded for this event.
                  </p>
                </div>
                <span className="text-[10px] text-[#236B50] font-bold bg-[#E8F5EE] px-2.5 py-1 rounded-full border border-[#C5E5D5]">
                  Chef Karim Zayani
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Method Option A */}
                <button
                  type="button"
                  disabled={!isChefRole}
                  onClick={() => setCostingMethod('party_batch')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    !isChefRole ? 'cursor-default' : 'cursor-pointer'
                  } ${
                    costingMethod === 'party_batch'
                      ? 'border-[#236B50] bg-white ring-2 ring-[#236B50]/20 shadow-xs'
                      : 'border-[#D5E5DE] bg-white/70 hover:bg-white text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#192A24]">
                      Option 1: General for that Specific Party
                    </span>
                    {costingMethod === 'party_batch' && (
                      <span className="bg-[#236B50] text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                        Recommended for Banquet
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#5A6F66] mt-1 leading-relaxed">
                    Most used for celebration buffets (e.g. 30 guests). Chef logs total ingredients used across the whole party (e.g. 1 carton chicken, 15 kg rice) without separating per food dish.
                  </p>
                </button>

                {/* Method Option B */}
                <button
                  type="button"
                  disabled={!isChefRole}
                  onClick={() => setCostingMethod('item_by_item')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    !isChefRole ? 'cursor-default' : 'cursor-pointer'
                  } ${
                    costingMethod === 'item_by_item'
                      ? 'border-[#236B50] bg-white ring-2 ring-[#236B50]/20 shadow-xs'
                      : 'border-[#D5E5DE] bg-white/70 hover:bg-white text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#192A24]">
                      Option 2: By Each Food Item (One by One)
                    </span>
                    {costingMethod === 'item_by_item' && (
                      <span className="bg-[#236B50] text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#5A6F66] mt-1 leading-relaxed">
                    Specifically used for room services or targeted recipe costing. Chef enters ingredients for each dish separately (e.g. Chicken Biryani, Chicken Noodles).
                  </p>
                </button>
              </div>
            </div>

            {/* Quick Stock Fetcher Bar (Fetched directly from Kitchen Inventory) */}
            <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-[#F4F8F6] to-white rounded-2xl border border-emerald-200 shadow-2xs space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-lg bg-[#236B50] text-white flex items-center justify-center shrink-0">
                    <Boxes className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-[#192A24]">
                      Fetch from Kitchen Stocks (Live Available Items)
                    </h5>
                    <p className="text-[10px] text-[#5A6F66]">
                      Choose an ingredient from current stocks to auto-populate, then simply type the amount you used.
                    </p>
                  </div>
                </div>

                {/* Stock Selector Dropdown */}
                <div className="w-full sm:w-72">
                  <select
                    disabled={!isChefRole}
                    value={selectedStockId}
                    onChange={(e) => handleSelectFromStock(e.target.value)}
                    title={!isChefRole ? 'Locked: Only Executive Chef Karim can fetch stock ingredients' : undefined}
                    className={`w-full rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none shadow-2xs ${
                      !isChefRole
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-white border-[#236B50]/40 text-[#192A24] focus:border-[#236B50] cursor-pointer'
                    }`}
                  >
                    <option value="">{!isChefRole ? '🔒 Chef Only — Stocks Locked' : '+ Click to Select from Stock List...'}</option>
                    {ingredients.map(ing => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} — In Stock: {ing.stockQuantity} {ing.unit} ({ing.storageLocation || 'Store'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick-Click Stock Pills for Fast Party Logging */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-emerald-100">
                <span className="text-[10px] font-black uppercase text-[#236B50] shrink-0 mr-1 flex items-center space-x-1">
                  <span>Fast Add:</span>
                  {!isChefRole && <span className="text-slate-400 font-normal">(Chef only)</span>}
                </span>
                <button
                  type="button"
                  disabled={!isChefRole}
                  onClick={() => handleQuickAddStock('Fresh Farm Chicken (Carton of 26 Bones/Pieces)', '1 carton')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all shadow-2xs ${
                    !isChefRole
                      ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                      : 'bg-white hover:bg-emerald-100 text-[#192A24] border-[#C5E5D5] cursor-pointer'
                  }`}
                >
                  🍗 Chicken (Carton of 26)
                </button>
                <button
                  type="button"
                  disabled={!isChefRole}
                  onClick={() => handleQuickAddStock('Royal Heritage Basmati Rice', '6 kg')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all shadow-2xs ${
                    !isChefRole
                      ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                      : 'bg-white hover:bg-emerald-100 text-[#192A24] border-[#C5E5D5] cursor-pointer'
                  }`}
                >
                  🍚 Basmati Rice
                </button>
                <button
                  type="button"
                  disabled={!isChefRole}
                  onClick={() => handleQuickAddStock('Red Cooking Onions', '5 kg')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all shadow-2xs ${
                    !isChefRole
                      ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                      : 'bg-white hover:bg-emerald-100 text-[#192A24] border-[#C5E5D5] cursor-pointer'
                  }`}
                >
                  🧅 Red Onions
                </button>
                <button
                  type="button"
                  disabled={!isChefRole}
                  onClick={() => handleQuickAddStock('Fresh Red Tomatoes', '4 kg')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all shadow-2xs ${
                    !isChefRole
                      ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                      : 'bg-white hover:bg-emerald-100 text-[#192A24] border-[#C5E5D5] cursor-pointer'
                  }`}
                >
                  🍅 Fresh Tomatoes
                </button>
                <button
                  type="button"
                  disabled={!isChefRole}
                  onClick={() => handleQuickAddStock('Pure Sunflower Cooking Oil', '1 tin (15L)')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all shadow-2xs ${
                    !isChefRole
                      ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                      : 'bg-white hover:bg-emerald-100 text-[#192A24] border-[#C5E5D5] cursor-pointer'
                  }`}
                >
                  🛢️ Cooking Oil
                </button>
                <button
                  type="button"
                  disabled={!isChefRole}
                  onClick={() => handleQuickAddStock('Arabic Spices & Biryani Masala Blend', '0.8 kg')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all shadow-2xs ${
                    !isChefRole
                      ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                      : 'bg-white hover:bg-emerald-100 text-[#192A24] border-[#C5E5D5] cursor-pointer'
                  }`}
                >
                  🧂 Biryani Masala
                </button>
                <button
                  type="button"
                  disabled={!isChefRole}
                  onClick={() => handleQuickAddStock('Sea Salt & Coarse Table Salt', '1 kg')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all shadow-2xs ${
                    !isChefRole
                      ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                      : 'bg-white hover:bg-emerald-100 text-[#192A24] border-[#C5E5D5] cursor-pointer'
                  }`}
                >
                  🧂 Table Salt
                </button>
                <button
                  type="button"
                  disabled={!isChefRole}
                  onClick={() => handleQuickAddStock('Fresh Arabic Khubz & Bread Buns', '40 pcs')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all shadow-2xs ${
                    !isChefRole
                      ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                      : 'bg-white hover:bg-emerald-100 text-[#192A24] border-[#C5E5D5] cursor-pointer'
                  }`}
                >
                  🥖 Arabic Khubz
                </button>
                <button
                  type="button"
                  disabled={!isChefRole}
                  onClick={() => handleQuickAddStock('Australian Mutton Bone-in', '5 kg')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all shadow-2xs ${
                    !isChefRole
                      ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                      : 'bg-white hover:bg-emerald-100 text-[#192A24] border-[#C5E5D5] cursor-pointer'
                  }`}
                >
                  🥩 Australian Mutton
                </button>
              </div>
            </div>

            {/* Chef Logging Table: The 2 Fields (Ingredient + Amount Used) */}
            <div className="border border-[#D5E5DE] rounded-2xl overflow-hidden shadow-2xs">
              <div className="p-3 bg-[#F4F8F6] border-b border-[#E2ECE7] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black text-[#192A24]">
                    Chef Kitchen Ingredient Entry ({entries.length} items logged)
                  </h4>
                  <p className="text-[11px] text-[#5A6F66]">
                    Select or type the <strong>Ingredient</strong> and type the <strong>Amount that you used</strong> (e.g. 1 carton, 2 kg, 26 bones, 15 L). Pricing is handled strictly by Accounts.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {!isChefRole ? (
                    <span className="text-[10px] font-black uppercase text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-xl flex items-center space-x-1 shadow-2xs">
                      <Lock className="w-3 h-3 text-amber-800" />
                      <span>Only Chef Can Add Ingredients</span>
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleApplyPresetTemplate}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border shadow-2xs bg-white hover:bg-[#EBF3EF] text-[#236B50] border-[#C5E5D5] cursor-pointer"
                      >
                        + Pre-fill 30-Guest Pantry Batch
                      </button>
                      <button
                        type="button"
                        onClick={handleAddRow}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center space-x-1 transition-all shadow-xs bg-[#236B50] hover:bg-[#1C5740] text-white cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Item</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAF9] text-[#5A6F66] border-b border-[#E2ECE7] sticky top-0 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 w-8">#</th>
                      {costingMethod === 'item_by_item' && (
                        <th className="py-2.5 px-3 w-44">Target Food Item / Dish</th>
                      )}
                      <th className="py-2.5 px-3">Field 1: Ingredient Used (Fetched from Stocks)</th>
                      <th className="py-2.5 px-3 w-48">Field 2: Amount that Chef Used</th>
                      <th className="py-2.5 px-3">Chef Kitchen Notes / Purpose</th>
                      <th className="py-2.5 px-3 w-10 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2ECE7]">
                    {entries.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-[#F9FCFA] transition-colors">
                        <td className="py-2.5 px-3 text-[#5A6F66] font-mono text-[11px]">
                          {idx + 1}
                        </td>

                        {/* Optional Food Item column if Method 2 chosen */}
                        {costingMethod === 'item_by_item' && (
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              disabled={!isChefRole}
                              list="forwarded-dishes-datalist"
                              value={row.foodItemName || ''}
                              onChange={(e) => handleUpdateChefEntry(idx, 'foodItemName', e.target.value)}
                              placeholder="e.g. Chicken Biryani / Room Service"
                              className={`w-full rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none ${
                                !isChefRole
                                  ? 'bg-slate-50 text-slate-500 border border-slate-200 cursor-not-allowed'
                                  : 'bg-white border border-[#D5E5DE] text-[#192A24] focus:border-[#236B50]'
                              }`}
                            />
                            <datalist id="forwarded-dishes-datalist">
                              {booking.selectedFoodItems?.map((dish, dIdx) => (
                                <option key={dIdx} value={dish} />
                              ))}
                            </datalist>
                          </td>
                        )}

                        {/* Field 1: Ingredient (With datalist auto-complete from kitchen stocks!) */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            disabled={!isChefRole}
                            list="all-kitchen-stocks-datalist"
                            value={row.ingredient}
                            onChange={(e) => handleUpdateChefEntry(idx, 'ingredient', e.target.value)}
                            placeholder="Select or type ingredient..."
                            title={!isChefRole ? 'Locked: Only Executive Chef Karim can put ingredients' : undefined}
                            className={`w-full rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none ${
                              !isChefRole
                                ? 'bg-slate-50 text-slate-500 border border-slate-200 cursor-not-allowed'
                                : 'bg-white border border-[#D5E5DE] text-[#192A24] focus:border-[#236B50]'
                            }`}
                          />
                        </td>

                        {/* Field 2: Amount Used (Free text typing as requested!) */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            disabled={!isChefRole}
                            value={row.amountUsed}
                            onChange={(e) => handleUpdateChefEntry(idx, 'amountUsed', e.target.value)}
                            placeholder="e.g. 1 carton, 2 kg, 26 bones"
                            title={!isChefRole ? 'Locked: Only Executive Chef Karim can put ingredients' : undefined}
                            className={`w-full rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none ${
                              !isChefRole
                                ? 'bg-slate-50 text-slate-500 border border-slate-200 cursor-not-allowed'
                                : 'bg-emerald-50/20 border border-[#236B50]/30 text-[#192A24] focus:border-[#236B50]'
                            }`}
                          />
                        </td>

                        {/* Chef Notes / Reason */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            disabled={!isChefRole}
                            value={row.notes || ''}
                            onChange={(e) => handleUpdateChefEntry(idx, 'notes', e.target.value)}
                            placeholder="e.g. Used across skewers & chafer"
                            className={`w-full rounded-lg px-2 py-1 text-xs focus:outline-none ${
                              !isChefRole
                                ? 'bg-slate-50 text-slate-500 border border-slate-200 cursor-not-allowed'
                                : 'bg-white border border-[#D5E5DE] text-[#5A6F66] focus:border-[#236B50]'
                            }`}
                          />
                        </td>

                        {/* Delete action */}
                        <td className="py-2 px-3 text-center">
                          {isChefRole ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(idx)}
                              className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Remove row"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-slate-300 text-[10px]" title="Non-chefs cannot delete chef entries">🔒</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Datalist of all kitchen stocks for instant autocomplete in Field 1 */}
              <datalist id="all-kitchen-stocks-datalist">
                {ingredients.map(ing => (
                  <option key={ing.id} value={ing.name}>
                    In Stock: {ing.stockQuantity} {ing.unit} ({ing.storageLocation || 'Store'})
                  </option>
                ))}
              </datalist>
            </div>

            {/* Chef Kitchen Notes & Confirm & Send Voucher Button */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[#192A24] mb-1">
                  Executive Chef Kitchen & Buffet Service Notes
                </label>
                <textarea
                  rows={2}
                  disabled={!isChefRole}
                  value={chefNotes}
                  onChange={(e) => setChefNotes(e.target.value)}
                  placeholder="Enter kitchen observations, buffer replenishment notes, or special spice level applied..."
                  className={`w-full rounded-xl p-2.5 text-xs focus:outline-none ${
                    !isChefRole
                      ? 'bg-slate-50 text-slate-500 border border-slate-200 cursor-not-allowed'
                      : 'bg-white border border-[#D5E5DE] text-[#192A24] focus:border-[#236B50]'
                  }`}
                />
              </div>

              <div className="p-4 bg-[#E8F5EE] border border-[#C5E5D5] rounded-2xl flex flex-col justify-center space-y-2">
                <div className="text-[11px] text-[#284B3D] font-medium leading-relaxed">
                  👨‍🍳 <strong>Chef Workflow Rule:</strong> Only Executive Chef Karim can put ingredients. Arun Kumar audits pricing and generates GL reports.
                </div>
                {isChefRole ? (
                  <button
                    type="button"
                    onClick={handleChefForwardToAccounts}
                    className="w-full py-2.5 bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirm Finished & Review Chef Stamp Paper 📜</span>
                  </button>
                ) : (
                  <div className="w-full py-2.5 bg-slate-100 text-slate-500 border border-slate-200 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 text-center">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Transmitted by Chef to Accounts (Locked)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SECTION 2: ACCOUNTS PERSPECTIVE (Arun Kumar)
            ========================================================= */}
        {activeRoleView === 'accounts' && (
          <div className="space-y-4">
            {/* Arun Welcome & Excel/OCR Assistant Card */}
            <div className="p-4 bg-gradient-to-r from-[#F0F7F4] via-[#F8FAF9] to-white rounded-2xl border border-[#C5E5D5] shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#D5E5DE] gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="bg-[#236B50] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                      Arun's Costing Desk
                    </span>
                    <h3 className="text-sm font-extrabold text-[#192A24]">
                      Accounts Purchasing Costing Assistant (Excel & OCR)
                    </h3>
                  </div>
                  <p className="text-xs text-[#5A6F66] mt-0.5">
                    Read the items & amounts logged by Chef Karim. Fetch purchasing records from Excel or OCR to auto-populate prices!
                  </p>
                </div>

                {/* The Magic Auto-Match Button */}
                <button
                  type="button"
                  onClick={handleAutoMatchPrices}
                  className="px-4 py-2 bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer shrink-0"
                >
                  <Sparkles className="w-4 h-4 text-emerald-300" />
                  <span>Auto-Match & Skip Manual Pricing</span>
                </button>
              </div>

              {/* Arun's 4 Input Tabs */}
              <div className="pt-3">
                <div className="flex items-center space-x-2 text-xs font-bold border-b border-[#E2ECE7] pb-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setAssistantTab('excel')}
                    className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                      assistantTab === 'excel'
                        ? 'bg-[#236B50] text-white'
                        : 'text-[#5A6F66] hover:text-[#192A24]'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>1. Upload Excel Sheet (.xlsx / .csv)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssistantTab('paste')}
                    className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                      assistantTab === 'paste'
                        ? 'bg-[#236B50] text-white'
                        : 'text-[#5A6F66] hover:text-[#192A24]'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>2. Paste Excel Rows</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssistantTab('ocr')}
                    className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                      assistantTab === 'ocr'
                        ? 'bg-[#236B50] text-white'
                        : 'text-[#5A6F66] hover:text-[#192A24]'
                    }`}
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    <span>3. OCR Invoice / Bill Scanner</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAssistantTab('master');
                      handleLoadMasterCatalog();
                    }}
                    className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                      assistantTab === 'master'
                        ? 'bg-[#236B50] text-white'
                        : 'text-[#5A6F66] hover:text-[#192A24]'
                    }`}
                  >
                    <Building className="w-3.5 h-3.5" />
                    <span>4. Hotel Master Price List</span>
                  </button>
                </div>

                {/* Tab 1: Excel File Upload */}
                {assistantTab === 'excel' && (
                  <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 bg-white rounded-xl border border-dashed border-[#A3C9B9] gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#236B50] flex items-center justify-center border border-emerald-200 shrink-0">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#192A24]">
                          Choose Arun's Excel Purchasing Price Sheet (.xlsx, .xls, .csv)
                        </div>
                        <div className="text-[11px] text-[#5A6F66]">
                          Columns parsed: Item Name, Packaging Unit, Purchasing Rate AED
                        </div>
                      </div>
                    </div>
                    <label className="px-4 py-2 bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#236B50] text-xs font-extrabold rounded-xl border border-[#C5E5D5] cursor-pointer transition-colors shrink-0">
                      <span>{isProcessingFile ? 'Reading...' : 'Browse Excel File'}</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleExcelUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {/* Tab 2: Paste Rows */}
                {assistantTab === 'paste' && (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Paste copied table rows from Microsoft Excel or Google Sheets here (e.g. Fresh Chicken [Tab] 135 AED [Tab] carton)..."
                      className="w-full bg-white border border-[#D5E5DE] rounded-xl p-2.5 text-xs font-mono text-[#192A24] focus:outline-none focus:border-[#236B50]"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handlePasteParse}
                        className="px-4 py-1.5 bg-[#236B50] text-white text-xs font-bold rounded-xl hover:bg-[#1C5740] cursor-pointer"
                      >
                        Parse Clipboard Rows
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab 3: OCR Scanner */}
                {assistantTab === 'ocr' && (
                  <div className="p-3.5 bg-white rounded-xl border border-dashed border-[#A3C9B9] space-y-3">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-200 shrink-0">
                          <ScanLine className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#192A24]">
                            Upload Supplier Invoice Photo or Scanned Price Sheet
                          </div>
                          <div className="text-[11px] text-[#5A6F66]">
                            System OCR reader extracts text, units, and AED amounts directly from image!
                          </div>
                        </div>
                      </div>
                      <label className="px-4 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-extrabold rounded-xl border border-sky-200 cursor-pointer transition-colors shrink-0">
                        <span>{isProcessingFile ? 'Scanning OCR...' : 'Upload Receipt / Bill Photo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleOcrUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {ocrSamplePreview && (
                      <div className="p-2.5 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded-lg max-h-24 overflow-y-auto whitespace-pre-wrap">
                        {ocrSamplePreview}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 4: Master Hotel Price List */}
                {assistantTab === 'master' && (
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#D5E5DE]">
                    <div className="text-xs text-[#192A24]">
                      <strong>Crystal Plaza Hotel Standard Purchasing Catalog</strong> contains 26 live market rates (Al Rawdah poultry, Al Maya rice & oils, Aweer produce).
                    </div>
                    <button
                      type="button"
                      onClick={handleLoadMasterCatalog}
                      className="px-3.5 py-1.5 bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#236B50] font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Reload Catalog
                    </button>
                  </div>
                )}

                <div className="mt-2 text-[11px] text-[#236B50] font-bold flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#236B50]" />
                  <span>{lastImportInfo}</span>
                </div>
              </div>
            </div>

            {/* Arun Accounts Pricing Table */}
            <div className="border border-[#D5E5DE] rounded-2xl overflow-hidden shadow-2xs">
              <div className="p-3 bg-[#F4F8F6] border-b border-[#E2ECE7] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-[#192A24]">
                    Chef Items Received & Accounts Purchasing Rates
                  </h4>
                  <p className="text-[11px] text-[#5A6F66]">
                    Arun verifies the amounts identified by Chef Karim and inputs the purchasing unit price & calculated total.
                  </p>
                </div>
                <div className="text-xs font-bold text-[#236B50]">
                  Costing Status: {currentStatus === 'costed_by_arun' ? '✓ Approved' : 'Pending Arun Costing'}
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAF9] text-[#5A6F66] border-b border-[#E2ECE7] sticky top-0 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Chef Logged Item</th>
                      <th className="py-2.5 px-3">Chef Amount Used (Locked / Non-Editable)</th>
                      <th className="py-2.5 px-3 w-36">Purchasing Unit Price</th>
                      <th className="py-2.5 px-3 w-32 text-right">Total Cost AED</th>
                      <th className="py-2.5 px-3">Price Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2ECE7]">
                    {entries.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-[#F9FCFA] transition-colors">
                        <td className="py-2.5 px-3 font-bold text-[#192A24]">
                          {row.ingredient || '<Unnamed Ingredient>'}
                          {row.foodItemName && (
                            <div className="text-[10px] text-[#5A6F66] font-normal">
                              Dish: {row.foodItemName}
                            </div>
                          )}
                          {row.notes && (
                            <div className="text-[10px] text-slate-400 italic">
                              Chef Note: {row.notes}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="flex items-center space-x-2 font-mono font-black text-[#236B50]">
                            <span>{row.amountUsed || '1 unit'}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200" title="Locked: Accounts cannot edit chef quantity">
                              🔒 Non-editable
                            </span>
                          </div>
                        </td>

                        {/* Purchasing Unit Price entered by Arun */}
                        <td className="py-2 px-3">
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center space-x-1">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                disabled={!isAccountsRole && currentUser.role !== 'general_manager'}
                                value={row.purchasingPriceAED ?? ''}
                                onChange={(e) => handleUpdateArunPrice(idx, parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                title={!isAccountsRole && currentUser.role !== 'general_manager' ? 'Locked: Only Arun Kumar (Accounts) has the privilege to alter prices' : 'Enter purchasing price per unit'}
                                className={`w-24 border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none transition-all ${
                                  missingPriceItemIds.has(row.id)
                                    ? 'border-2 border-rose-500 bg-rose-50 ring-2 ring-rose-300 text-rose-950 font-black animate-pulse'
                                    : !isAccountsRole && currentUser.role !== 'general_manager'
                                    ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                                    : 'bg-white text-[#192A24] border-[#D5E5DE] focus:border-[#236B50]'
                                }`}
                              />
                              <span className="text-[10px] text-[#5A6F66]">AED/{row.purchasingUnit || 'unit'}</span>
                            </div>
                            {missingPriceItemIds.has(row.id) && (
                              <span className="text-[10px] text-rose-600 font-extrabold flex items-center space-x-0.5">
                                <AlertCircle className="w-3 h-3" />
                                <span>Price Required</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Total Cost AED: Strictly auto-computed (Chef's amount × Arun's purchasing unit price) */}
                        <td className="py-2 px-3 text-right">
                          <div className="flex flex-col items-end">
                            <div className="font-mono font-black text-xs text-[#236B50]">
                              AED {((row.calculatedCostAED ?? (parseQuantityAndUnit(row.amountUsed).quantity * (row.purchasingPriceAED || 0))) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <span className="text-[9px] text-[#5A6F66] font-medium" title="Strictly computed: Chef amount × Arun unit price. Neither role can tamper with total.">
                              auto-computed ({row.amountUsed || '1'} × {(row.purchasingPriceAED || 0).toFixed(2)})
                            </span>
                          </div>
                        </td>

                        {/* Price Source Badge */}
                        <td className="py-2.5 px-3">
                          {row.priceSource === 'excel_sheet' ? (
                            <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                              <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                              <span>Excel Matched</span>
                            </span>
                          ) : row.priceSource === 'ocr_scan' ? (
                            <span className="inline-flex items-center space-x-1 bg-sky-50 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-sky-200">
                              <ScanLine className="w-3 h-3 text-sky-600" />
                              <span>OCR Matched</span>
                            </span>
                          ) : row.priceSource === 'master_catalog' ? (
                            <span className="inline-flex items-center space-x-1 bg-teal-50 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-200">
                              <Building className="w-3 h-3 text-teal-600" />
                              <span>Catalog Price</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              <span>Manual Entry</span>
                            </span>
                          )}
                          {row.matchedItemDescription && (
                            <div className="text-[9px] text-[#5A6F66] truncate max-w-44">
                              {row.matchedItemDescription}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Real-time Profitability & Cost Metrics Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-[#F4F8F6] rounded-2xl border border-[#E2ECE7]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6F66]">
                  Client Billed Revenue:
                </span>
                <div className="text-sm font-extrabold text-[#192A24] mt-0.5">
                  {formatCurrency(billedFoodRevenue)}
                </div>
                <div className="text-[10px] text-[#5A6F66]">{guests} guests × {foodPricePerGuest} AED</div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6F66]">
                  Purchased Raw Food:
                </span>
                <div className="text-sm font-extrabold text-amber-800 mt-0.5 font-mono">
                  {formatCurrency(totalIngredientCost)}
                </div>
                <div className="text-[10px] text-[#5A6F66]">{entries.length} items from chef</div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6F66]">
                  Total Food Cost (Direct):
                </span>
                <div className="text-sm font-extrabold text-[#236B50] mt-0.5 font-mono">
                  {formatCurrency(totalDirectFoodCost)}
                </div>
                <div className="text-[10px] text-[#5A6F66]">Incl. kitchen prep labor</div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6F66]">
                  Hotel Food Gross Profit:
                </span>
                <div className="text-sm font-black text-[#236B50] mt-0.5 font-mono">
                  {formatCurrency(grossProfit)}
                </div>
                <div className="text-[10px] text-[#5A6F66]">Revenue - direct cost</div>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6F66]">
                  Profit Margin %:
                </span>
                <div className="text-base font-black text-[#236B50] mt-0.5 font-mono">
                  {formatPercent(profitMarginPercent)}
                </div>
                <div className="text-[10px] text-[#5A6F66]">Food Cost: {formatPercent(foodCostPercent)}</div>
              </div>
            </div>

            {/* Arun Accounts Audit Notes & Approve Button */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[#192A24] mb-1">
                  Arun Kumar Accounts Costing & Purchasing Notes
                </label>
                <textarea
                  rows={2}
                  value={arunNotes}
                  onChange={(e) => setArunNotes(e.target.value)}
                  placeholder="e.g. Purchasing rates verified against supplier batch #OCT-2026. Poultry carton and rice sacks invoice matched."
                  className="w-full bg-white border border-[#D5E5DE] rounded-xl p-2.5 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                />
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col justify-center space-y-2">
                <div className="text-[11px] text-emerald-950 font-medium leading-relaxed">
                  💼 <strong>Arun Accounts Action:</strong> Approving commits these direct food costs to the banquet invoice & Page 2 of the A4 Banquet Sheet.
                </div>
                <button
                  type="button"
                  onClick={handleArunApproveCosting}
                  disabled={!isAccountsRole && currentUser.role !== 'general_manager'}
                  className={`w-full py-2.5 text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 ${
                    !isAccountsRole && currentUser.role !== 'general_manager'
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white cursor-pointer'
                  }`}
                  title={!isAccountsRole && currentUser.role !== 'general_manager' ? 'Locked: Only Arun Kumar has privilege to finalize costing' : 'Finish costing and post to general ledger'}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>✅ Finished Costing — Commit & Post to General Ledger</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            MODAL FOOTER ACTIONS
            ========================================================= */}
        <div className="pt-3 border-t border-[#E2ECE7] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-[#5A6F66]">
            Banquet Party: <strong className="text-[#192A24]">{booking.clientName}</strong> ({booking.eventDate}) • Crystal Plaza Hotel
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#284B3D] text-xs font-bold rounded-full transition-colors cursor-pointer"
            >
              Close
            </button>

            {onOpenA4Sheet && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenA4Sheet(booking);
                }}
                className="px-6 py-2 bg-[#236B50] hover:bg-[#1C5740] text-white text-xs font-extrabold rounded-full shadow-md transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open 2-Page Banquet Sheet</span>
              </button>
            )}
          </div>
        </div>

        {/* =========================================================
            OFFICIAL CHEF KITCHEN USAGE STAMP PAPER & VOUCHER MODAL
            ========================================================= */}
        {showChefVoucherModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#FAF9F5] rounded-3xl w-full max-w-3xl max-h-[95vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border-4 border-double border-amber-600/40 space-y-5">
              
              {/* Stamp Paper Top Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-amber-200">
                <div className="flex items-center space-x-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-md shrink-0">
                    <ChefHat className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-700 text-white px-2.5 py-0.5 rounded-full shadow-2xs">
                      Official Executive Stamp Paper
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                      Banquet Kitchen Stock Usage Certificate & Stamp Paper
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowChefVoucherModal(false)}
                  className="p-1.5 rounded-full hover:bg-black/5 text-slate-500 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Printable Stamp Paper Body */}
              <div className="p-6 bg-white rounded-3xl border-2 border-amber-300 shadow-sm space-y-4 font-sans text-xs relative overflow-hidden">
                
                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none">
                  <span className="text-8xl font-black uppercase rotate-[-25deg] text-slate-900">
                    CERTIFIED USAGE
                  </span>
                </div>

                {/* Letterhead */}
                <div className="flex flex-col sm:flex-row justify-between items-start pb-4 border-b-2 border-slate-900 gap-2">
                  <div>
                    <div className="flex items-center space-x-1.5 text-amber-800 text-[11px] font-black uppercase tracking-wider">
                      <Building className="w-4 h-4" />
                      <span>Crystal Plaza Hotel & Banquets • Sharjah, UAE</span>
                    </div>
                    <h4 className="font-black text-slate-900 text-base tracking-tight mt-0.5">
                      EXECUTIVE CHEF KITCHEN INGREDIENTS CONSUMPTION STAMP PAPER
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Culinary Production Division • Official Consumption Audit Record
                    </p>
                  </div>
                  <div className="sm:text-right bg-amber-50/80 p-2.5 rounded-2xl border border-amber-200">
                    <span className="font-mono font-bold text-amber-950 text-xs block">
                      Stamp Serial #{booking.chefStampSerial || `CPH-CHEF-STAMP-${booking.bookingNumber.replace(/[^0-9]/g, '') || '2026-001'}`}
                    </span>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      Chef Stamped: <strong>{new Date().toLocaleString('en-GB')}</strong>
                    </p>
                    <p className="text-[10px] text-amber-800 font-bold">
                      Queue Routing: First-In, First-Out (FIFO)
                    </p>
                  </div>
                </div>

                {/* Party & Booking Specs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px] bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Client / Host:</span>
                    <strong className="text-slate-900 font-black">{booking.clientName}</strong>
                    <span className="text-[10px] text-slate-500 block">{booking.eventType}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Party Date & Hall:</span>
                    <strong className="text-slate-900 font-bold">{booking.eventDate}</strong>
                    <span className="text-[10px] text-slate-500 block">{booking.hallName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Headcount Served:</span>
                    <strong className="text-[#236B50] font-black text-xs">{booking.guestCount} Guests</strong>
                    <span className="text-[10px] text-slate-500 block">Buffet Catering</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Logged By:</span>
                    <strong className="text-slate-900 font-bold">{currentUser.name}</strong>
                    <span className="text-[10px] text-amber-800 font-bold block">Executive Chef</span>
                  </div>
                </div>

                {/* Itemized Table of Ingredients and Quantities */}
                <div>
                  <div className="text-[11px] font-black uppercase text-slate-800 mb-1.5 flex items-center justify-between">
                    <span>Verified Kitchen Inventory Items Consumed ({entries.length} line items):</span>
                    <span className="text-[10px] font-normal text-slate-500">Quantities locked for Accounts pricing</span>
                  </div>
                  <table className="w-full text-left text-xs bg-white rounded-2xl overflow-hidden border border-slate-200">
                    <thead className="bg-amber-100/60 text-amber-950 text-[10px] font-bold uppercase">
                      <tr>
                        <th className="py-2 px-3 w-8">#</th>
                        <th className="py-2 px-3">Ingredient from Kitchen Inventory</th>
                        <th className="py-2 px-3 w-44">Exact Quantity Used</th>
                        <th className="py-2 px-3">Service Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {entries.map((entry, i) => (
                        <tr key={entry.id || i} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{i + 1}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">
                            {entry.ingredient}
                            {entry.foodItemName && (
                              <span className="block text-[10px] text-slate-500 font-normal">Dish: {entry.foodItemName}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono font-black text-[#236B50]">
                            {entry.amountUsed}
                          </td>
                          <td className="py-2 px-3 text-[11px] text-slate-600">{entry.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {chefNotes && (
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-950">
                    <strong className="text-amber-900">Executive Chef Production Notes:</strong> {chefNotes}
                  </div>
                )}

                {/* Formal Chef Declaration & Seal Box */}
                <div className="p-4 bg-gradient-to-r from-amber-50/70 via-white to-amber-50/70 rounded-2xl border-2 border-dashed border-amber-400 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="max-w-md">
                    <span className="text-[10px] font-black uppercase text-amber-900 bg-amber-200 px-2 py-0.5 rounded">
                      Official Culinary Attestation
                    </span>
                    <p className="text-[11px] text-slate-700 mt-1.5 leading-relaxed">
                      "I, Executive Chef Karim Al-Mansoor, hereby certify and confirm under official hotel kitchen seal that the above ingredients and quantities were strictly used for the preparation and execution of this banquet event. This voucher is completed and transmitted to Accounts (Arun Kumar) for FIFO costing prioritization."
                    </p>
                    <div className="text-[10px] font-bold text-slate-900 mt-2">
                      Chef Karim Al-Mansoor • Executive Head Chef
                    </div>
                  </div>

                  {/* Red/Gold Circular Official Digital Stamp Graphic */}
                  <div className="w-24 h-24 rounded-full border-4 border-double border-red-700 flex flex-col items-center justify-center p-1 text-center rotate-[-6deg] bg-red-50/80 shadow-md select-none shrink-0 border-red-700">
                    <div className="text-[7px] font-black uppercase text-red-900 tracking-tighter">CRYSTAL PLAZA HOTEL</div>
                    <div className="text-[8px] font-black uppercase text-red-900 my-0.5">★ CHEF STAMP ★</div>
                    <div className="text-[7px] font-black text-red-800">APPROVED &amp; VERIFIED</div>
                    <div className="text-[6px] font-mono text-red-950 font-bold">{new Date().toISOString().substring(0, 10)}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                  <span>Routing: Sent to Accounts Executive Desk (Arun Kumar)</span>
                  <span className="font-bold text-amber-900">Priority: First In, First Out (FIFO)</span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-2xl border border-slate-300 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  <span>Print Chef Stamp Paper</span>
                </button>

                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const currentTotalCost = entries.reduce((s, e) => s + (e.calculatedCostAED || 0), 0);
                      const labor = (booking.guestCount || 30) * 4.20;
                      const finalCost = currentTotalCost > 0 ? currentTotalCost + labor : (booking.foodCostActualTotal || 0);

                      onSaveCosting(
                        booking.id,
                        entries,
                        costingMethod,
                        'forwarded_to_accounts',
                        finalCost,
                        chefNotes,
                        arunNotes
                      );
                      setShowChefVoucherModal(false);
                      if (isChefRole) {
                        onClose();
                      } else {
                        setActiveRoleView('accounts');
                      }
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 bg-[#236B50] hover:bg-[#1C5740] text-white text-xs font-black rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 active:scale-95"
                  >
                    <span>📜 Confirm Stamped & Transmit to Accounts (FIFO Queue)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* =========================================================
            OFFICIAL GENERAL LEDGER POSTING REPORT MODAL
            ========================================================= */}
        {showPostingReportModal && (
          <PostingReportModal
            booking={booking}
            currentUser={currentUser}
            onClose={() => setShowPostingReportModal(false)}
          />
        )}

      </div>
    </div>
  );
};
