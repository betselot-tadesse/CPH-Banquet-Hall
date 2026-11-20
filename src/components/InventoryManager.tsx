import React, { useState, useEffect } from 'react';
import { 
  Boxes, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  ArrowUpDown, 
  Truck, 
  ShoppingBag, 
  Filter, 
  X,
  FileSpreadsheet,
  ScanLine,
  Upload,
  Sparkles,
  RefreshCw,
  Clock,
  History,
  ChefHat,
  DollarSign,
  PackageCheck,
  PackageMinus,
  Layers,
  ArrowRight,
  ShieldAlert,
  Volume2,
  Calendar,
  Building,
  Check,
  AlertCircle
} from 'lucide-react';
import { RawIngredient, UserProfile, KitchenStockMovement } from '../types';
import { formatCurrency } from '../utils/costCalculations';
import { AppStorage } from '../services/storage';

interface InventoryManagerProps {
  ingredients: RawIngredient[];
  currentUser: UserProfile;
  onUpdateIngredient: (ingredient: RawIngredient) => void;
  onAddIngredient: (ingredient: RawIngredient) => void;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  ingredients,
  currentUser,
  onUpdateIngredient,
  onAddIngredient,
}) => {
  // Active inner sub-tab
  const [activeTab, setActiveTab] = useState<'stock' | 'purchasing_ocr' | 'usage_deduct' | 'movements'>('stock');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [onlyLowStock, setOnlyLowStock] = useState<boolean>(false);
  const [stockMovements, setStockMovements] = useState<KitchenStockMovement[]>([]);

  // Modals & form state
  const [selectedIngredientForStock, setSelectedIngredientForStock] = useState<RawIngredient | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(1);
  const [adjustmentMode, setAdjustmentMode] = useState<'cartons' | 'pieces'>('pieces');
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'deduct'>('deduct');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('Room Service: 2 Portions Chicken Biryani');
  
  const [newIngredientModal, setNewIngredientModal] = useState<boolean>(false);
  const [bannerNotice, setBannerNotice] = useState<{ type: 'success' | 'warning' | 'info'; message: string } | null>(null);
  const [alertAudioSimulated, setAlertAudioSimulated] = useState<boolean>(false);

  // New Ingredient form
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<RawIngredient['category']>('Meat & Poultry');
  const [formPackagingUnit, setFormPackagingUnit] = useState<string>('Carton');
  const [formSubUnitName, setFormSubUnitName] = useState<string>('pieces/bones');
  const [formSubUnitsPerPack, setFormSubUnitsPerPack] = useState<number>(26);
  const [formPackageCost, setFormPackageCost] = useState<number>(130.00);
  const [formStockPackages, setFormStockPackages] = useState<number>(5);
  const [formReorderPackages, setFormReorderPackages] = useState<number>(2);
  const [formSupplier, setFormSupplier] = useState('Emirates Poultry Farms LLC');
  const [formStorageLocation, setFormStorageLocation] = useState('Walk-in Freezer #1 (Bay A-2)');
  const [formWastage, setFormWastage] = useState<number>(4);

  // OCR & Excel Import Assistant state
  const [ocrImportMode, setOcrImportMode] = useState<'paste' | 'upload' | 'samples'>('samples');
  const [pastedInvoiceData, setPastedInvoiceData] = useState<string>('');
  const [isParsingInvoice, setIsParsingInvoice] = useState<boolean>(false);
  const [parsedInvoiceItems, setParsedInvoiceItems] = useState<Array<{
    matchedIngredientId?: string;
    itemName: string;
    packagingUnit: string;
    subUnitsPerPack: number;
    subUnitName: string;
    packagesReceived: number;
    subUnitsReceived: number;
    costPerPackageAED: number;
    supplier: string;
    invoiceNo: string;
    batchNo: string;
  }>>([]);

  // Load stock movements on mount
  useEffect(() => {
    setStockMovements(AppStorage.getStockMovements());
  }, []);

  const refreshMovements = () => {
    setStockMovements(AppStorage.getStockMovements());
  };

  // Helper to calculate pieces and cartons
  const getStockDetails = (item: RawIngredient) => {
    const perPack = item.subUnitsPerPackage || 1;
    const totalSubUnits = item.stockSubUnits !== undefined ? item.stockSubUnits : Math.round(item.stockQuantity * perPack);
    const wholePackages = Math.floor(totalSubUnits / perPack);
    const remainderSubUnits = Math.round(totalSubUnits % perPack);
    const packageFraction = parseFloat((totalSubUnits / perPack).toFixed(2));
    const subUnitCost = item.subUnitCostAED || (item.packageCostAED ? item.packageCostAED / perPack : item.costPerUnit / perPack);
    const reorderSubUnits = item.reorderSubUnits !== undefined ? item.reorderSubUnits : item.reorderLevel * perPack;
    const isLow = totalSubUnits <= reorderSubUnits;
    const isCritical = totalSubUnits <= reorderSubUnits * 0.5;

    return {
      totalSubUnits,
      wholePackages,
      remainderSubUnits,
      packageFraction,
      subUnitCost,
      reorderSubUnits,
      isLow,
      isCritical,
      perPack,
      packagingUnit: item.packagingUnit || 'Pack',
      subUnitName: item.subUnitName || 'units',
    };
  };

  // Low stock list
  const lowStockItems = ingredients.filter(i => {
    const details = getStockDetails(i);
    return details.isLow;
  });

  // Handle manual stock adjustment submission
  const handleStockAdjustmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredientForStock) return;

    const details = getStockDetails(selectedIngredientForStock);
    const subUnitsDelta = adjustmentMode === 'cartons' 
      ? Math.round(adjustmentAmount * details.perPack) 
      : Math.round(adjustmentAmount);

    if (adjustmentType === 'deduct') {
      const res = AppStorage.deductKitchenStock(
        selectedIngredientForStock.id,
        subUnitsDelta,
        adjustmentReason || `Kitchen deduction by ${currentUser.name}`,
        currentUser.name
      );
      if (res.success) {
        setBannerNotice({ type: 'success', message: res.message });
      }
    } else {
      AppStorage.addKitchenStock(
        selectedIngredientForStock.id,
        subUnitsDelta,
        adjustmentMode === 'cartons' ? adjustmentAmount : parseFloat((subUnitsDelta / details.perPack).toFixed(2)),
        selectedIngredientForStock.packageCostAED || selectedIngredientForStock.costPerUnit,
        selectedIngredientForStock.supplier,
        `BATCH-${Date.now().toString().slice(-4)}`,
        'Manual Restock / Purchase',
        currentUser.name
      );
      setBannerNotice({
        type: 'success',
        message: `Restocked +${subUnitsDelta} ${details.subUnitName} into ${selectedIngredientForStock.name}.`
      });
    }

    // Refresh state
    const refreshed = AppStorage.getIngredients();
    const updatedTarget = refreshed.find(i => i.id === selectedIngredientForStock.id);
    if (updatedTarget) onUpdateIngredient(updatedTarget);
    refreshMovements();
    setSelectedIngredientForStock(null);
  };

  // Handle Quick Prep Deduct (e.g. 2 pieces of chicken for Biryani)
  const handleQuickDeduct = (item: RawIngredient, subUnits: number, reason: string) => {
    const details = getStockDetails(item);
    const res = AppStorage.deductKitchenStock(
      item.id,
      subUnits,
      reason,
      currentUser.name
    );

    if (res.success) {
      setBannerNotice({
        type: 'success',
        message: `Chef Prepared: Deducted ${subUnits} ${details.subUnitName} from ${item.name}. Remaining: ${res.remainingSubUnits} ${details.subUnitName} (${res.remainingCartons} ${details.packagingUnit}).`
      });
      const refreshed = AppStorage.getIngredients();
      const updatedTarget = refreshed.find(i => i.id === item.id);
      if (updatedTarget) onUpdateIngredient(updatedTarget);
      refreshMovements();
    }
  };

  // Handle New Ingredient Creation
  const handleCreateIngredientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subUnits = Math.round(formStockPackages * formSubUnitsPerPack);
    const unitCost = formSubUnitsPerPack > 0 ? parseFloat((formPackageCost / formSubUnitsPerPack).toFixed(2)) : formPackageCost;

    const newIng: RawIngredient = {
      id: `ing_${Date.now()}`,
      name: formName || 'New Kitchen Ingredient',
      category: formCategory,
      unit: formPackagingUnit.toLowerCase(),
      costPerUnit: Number(formPackageCost),
      stockQuantity: Number(formStockPackages),
      reorderLevel: Number(formReorderPackages),
      supplier: formSupplier || 'Crystal Plaza Hotel Vendor',
      wastageFactorPercent: Number(formWastage),
      packagingUnit: formPackagingUnit,
      subUnitName: formSubUnitName,
      subUnitsPerPackage: Number(formSubUnitsPerPack),
      stockSubUnits: subUnits,
      packageCostAED: Number(formPackageCost),
      subUnitCostAED: unitCost,
      reorderSubUnits: Number(formReorderPackages) * Number(formSubUnitsPerPack),
      storageLocation: formStorageLocation,
      lastPurchaseDate: new Date().toISOString().substring(0, 10),
      batchNumber: `BATCH-${Math.floor(1000 + Math.random() * 9000)}`,
    };

    onAddIngredient(newIng);
    AppStorage.addStockMovement({
      id: `mov_${Date.now()}`,
      ingredientId: newIng.id,
      ingredientName: newIng.name,
      type: 'purchase_receipt',
      quantityChanged: subUnits,
      packagesEquivalent: `+${formStockPackages} ${formPackagingUnit} (+${subUnits} ${formSubUnitName})`,
      remainingSubUnits: subUnits,
      reasonOrReference: `Initial Kitchen Inventory Registration by ${currentUser.name}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      performedBy: currentUser.name,
    });
    refreshMovements();
    setNewIngredientModal(false);
    setBannerNotice({
      type: 'success',
      message: `Registered new item: "${newIng.name}" with ${newIng.stockSubUnits} ${newIng.subUnitName} (${newIng.stockQuantity} ${newIng.packagingUnit}).`
    });
  };

  // Preset OCR Sample Invoices
  const loadSampleInvoice = (sampleType: 'chicken' | 'produce' | 'grains') => {
    setIsParsingInvoice(true);
    setTimeout(() => {
      if (sampleType === 'chicken') {
        setParsedInvoiceItems([
          {
            matchedIngredientId: 'ing_1',
            itemName: 'Fresh Farm Chicken (Carton of 26 Bones/Pieces)',
            packagingUnit: 'Carton',
            subUnitsPerPack: 26,
            subUnitName: 'chicken pieces/bones',
            packagesReceived: 4,
            subUnitsReceived: 104,
            costPerPackageAED: 130.00,
            supplier: 'Emirates Poultry Farms LLC',
            invoiceNo: 'EPF-INV-99482',
            batchNo: 'EPF-2026-OCT-16'
          },
          {
            matchedIngredientId: 'ing_6',
            itemName: 'Farm Fresh Golden Grade-A Eggs (Tray of 30 Eggs)',
            packagingUnit: 'Tray',
            subUnitsPerPack: 30,
            subUnitName: 'eggs',
            packagesReceived: 6,
            subUnitsReceived: 180,
            costPerPackageAED: 21.00,
            supplier: 'Al Ain Poultry & Eggs',
            invoiceNo: 'EPF-INV-99482',
            batchNo: 'AAP-OCT-B11'
          }
        ]);
      } else if (sampleType === 'produce') {
        setParsedInvoiceItems([
          {
            matchedIngredientId: 'ing_7',
            itemName: 'Red Cooking Onions (Mesh Bag of 10kg)',
            packagingUnit: 'Bag',
            subUnitsPerPack: 10,
            subUnitName: 'kg onions',
            packagesReceived: 8,
            subUnitsReceived: 80,
            costPerPackageAED: 35.00,
            supplier: 'Barakat Produce LLC',
            invoiceNo: 'BKT-DEL-3381',
            batchNo: 'BKT-ON-990'
          },
          {
            matchedIngredientId: 'ing_13',
            itemName: 'Fresh Garlic Cloves & Ginger (Bag of 5kg)',
            packagingUnit: 'Bag',
            subUnitsPerPack: 5,
            subUnitName: 'kg garlic/ginger',
            packagesReceived: 4,
            subUnitsReceived: 20,
            costPerPackageAED: 30.00,
            supplier: 'Barakat Produce LLC',
            invoiceNo: 'BKT-DEL-3381',
            batchNo: 'BKT-GG-442'
          }
        ]);
      } else {
        setParsedInvoiceItems([
          {
            matchedIngredientId: 'ing_3',
            itemName: 'Royal Heritage Long-Grain Basmati Rice (Sack of 25kg)',
            packagingUnit: 'Sack',
            subUnitsPerPack: 25,
            subUnitName: 'kg basmati rice',
            packagesReceived: 6,
            subUnitsReceived: 150,
            costPerPackageAED: 130.00,
            supplier: 'Kashmir Grain Merchants',
            invoiceNo: 'KGM-RC-8812',
            batchNo: 'KGM-2026-R09'
          },
          {
            matchedIngredientId: 'ing_4',
            itemName: 'Pure Golden Sunflower Cooking Oil (Tin of 15 Liters)',
            packagingUnit: 'Tin',
            subUnitsPerPack: 15,
            subUnitName: 'liters cooking oil',
            packagesReceived: 4,
            subUnitsReceived: 60,
            costPerPackageAED: 90.00,
            supplier: 'Afia Edible Oils UAE',
            invoiceNo: 'KGM-RC-8812',
            batchNo: 'AF-OIL-552'
          }
        ]);
      }
      setIsParsingInvoice(false);
    }, 450);
  };

  // Parse pasted tabular text
  const handleParsePastedText = () => {
    if (!pastedInvoiceData.trim()) return;
    setIsParsingInvoice(true);
    const lines = pastedInvoiceData.split('\n').filter(l => l.trim().length > 0);
    const items: typeof parsedInvoiceItems = [];

    lines.forEach((line, idx) => {
      const parts = line.split(/[\t,;]+/).map(p => p.trim());
      if (parts.length >= 2) {
        const namePart = parts[0];
        const qtyPart = parseFloat(parts[1]) || 1;
        const pricePart = parseFloat(parts[2]) || 50;
        const packUnit = parts[3] || 'Carton';
        const perPack = parseFloat(parts[4]) || 20;

        // Try to match with existing ingredient
        const matched = ingredients.find(ing => 
          ing.name.toLowerCase().includes(namePart.toLowerCase()) || 
          namePart.toLowerCase().includes(ing.name.toLowerCase())
        );

        items.push({
          matchedIngredientId: matched?.id,
          itemName: matched?.name || namePart,
          packagingUnit: matched?.packagingUnit || packUnit,
          subUnitsPerPack: matched?.subUnitsPerPackage || perPack,
          subUnitName: matched?.subUnitName || 'pieces',
          packagesReceived: qtyPart,
          subUnitsReceived: Math.round(qtyPart * (matched?.subUnitsPerPackage || perPack)),
          costPerPackageAED: pricePart,
          supplier: matched?.supplier || 'Imported Food Supplier',
          invoiceNo: `EXT-INV-${Date.now().toString().slice(-4)}-${idx + 1}`,
          batchNo: `BATCH-OCT-${idx + 1}`,
        });
      }
    });

    setParsedInvoiceItems(items);
    setIsParsingInvoice(false);
  };

  // Commit OCR / Excel Parsed items to Kitchen Inventory
  const handleCommitParsedInvoice = () => {
    if (parsedInvoiceItems.length === 0) return;

    parsedInvoiceItems.forEach(item => {
      if (item.matchedIngredientId) {
        AppStorage.addKitchenStock(
          item.matchedIngredientId,
          item.subUnitsReceived,
          item.packagesReceived,
          item.costPerPackageAED,
          item.supplier,
          item.batchNo,
          item.invoiceNo,
          `${currentUser.name} (${currentUser.role === 'accounts_executive' ? 'Accounts Arun' : 'Chef Karim'})`
        );
      }
    });

    const refreshed = AppStorage.getIngredients();
    refreshed.forEach(ing => onUpdateIngredient(ing));
    refreshMovements();

    setBannerNotice({
      type: 'success',
      message: `Successfully processed ${parsedInvoiceItems.length} items from purchasing invoice into Kitchen Stock!`
    });
    setParsedInvoiceItems([]);
    setPastedInvoiceData('');
    setActiveTab('stock');
  };

  // Filtered ingredients
  const filtered = ingredients.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.storageLocation && item.storageLocation.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = categoryFilter === 'all' || item.category === categoryFilter;
    const details = getStockDetails(item);
    const matchesLowStock = !onlyLowStock || details.isLow;
    return matchesSearch && matchesCat && matchesLowStock;
  });

  const totalValuation = ingredients.reduce((sum, i) => {
    const details = getStockDetails(i);
    return sum + (details.packageFraction * (i.packageCostAED || i.costPerUnit));
  }, 0);

  const totalCartons = ingredients.reduce((sum, i) => {
    const details = getStockDetails(i);
    return sum + details.wholePackages;
  }, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Banner Notice */}
      {bannerNotice && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold animate-in fade-in duration-200 ${
          bannerNotice.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
          bannerNotice.type === 'warning' ? 'bg-amber-50 border-amber-300 text-amber-900' :
          'bg-blue-50 border-blue-300 text-blue-900'
        }`}>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{bannerNotice.message}</span>
          </div>
          <button 
            onClick={() => setBannerNotice(null)}
            className="p-1 rounded-full hover:bg-black/5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#192A24] font-['Plus_Jakarta_Sans'] flex items-center space-x-2.5">
            <Boxes className="w-6 h-6 text-[#236B50]" />
            <span>
              {currentUser.role === 'executive_chef' 
                ? 'Executive Chef Kitchen Inventory & Stock Controls' 
                : (currentUser.role === 'accounts_executive' ? 'Kitchen Inventory, Purchasing & Cost Audit (Arun)' : 'Kitchen Food Inventory & Packaging Controls')}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5A6F66] mt-0.5">
            Real-time tracking by packaging cartons, piece-level sub-units (e.g. 26 bones/carton), recipe prep deductions, OCR invoices, and low-stock alarms.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          {currentUser.permissions.canManageInventory && (
            <button
              onClick={() => setNewIngredientModal(true)}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-full bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white font-bold text-xs shadow-md shadow-[#236B50]/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Register New Item</span>
            </button>
          )}
        </div>
      </div>

      {/* Low Stock Urgent Alert Banner */}
      {lowStockItems.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white rounded-3xl p-5 shadow-lg shadow-amber-900/10 border border-amber-400">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-xs shrink-0">
                <AlertTriangle className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                    Kitchen Stock Alert
                  </span>
                  <span className="text-sm font-extrabold">{lowStockItems.length} Food Provisions Below Safety Threshold</span>
                </div>
                <p className="text-xs text-amber-100 max-w-2xl">
                  Attention {currentUser.role === 'executive_chef' ? 'Chef Karim' : 'Kitchen Management'}: Critical pantry and chiller items are depleted or near minimum buffer.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 self-end md:self-center">
              <button
                onClick={() => {
                  setAlertAudioSimulated(true);
                  setTimeout(() => setAlertAudioSimulated(false), 2000);
                  setBannerNotice({
                    type: 'warning',
                    message: `Kitchen Alert Chime sounding: ${lowStockItems.map(i => i.name).join(', ')} require replenishment.`
                  });
                }}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  alertAudioSimulated ? 'bg-white text-amber-900 border-white' : 'bg-white/10 hover:bg-white/20 text-white border-white/30'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{alertAudioSimulated ? 'Alarm Triggered 🔔' : 'Test Alert Chime'}</span>
              </button>

              <button
                onClick={() => {
                  setOnlyLowStock(true);
                  setActiveTab('stock');
                }}
                className="px-4 py-2 bg-white text-amber-950 hover:bg-amber-50 rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
              >
                Inspect Low Items ({lowStockItems.length})
              </button>
            </div>
          </div>

          {/* Quick Item Ticker */}
          <div className="mt-3.5 pt-3.5 border-t border-white/20 flex flex-wrap gap-2">
            {lowStockItems.map(item => {
              const details = getStockDetails(item);
              return (
                <div key={item.id} className="bg-white/15 backdrop-blur-xs px-3 py-1 rounded-xl text-[11px] font-semibold flex items-center space-x-2 border border-white/20">
                  <span className="font-bold text-white">{item.name}</span>
                  <span className="text-amber-200 font-mono">
                    {details.totalSubUnits} {details.subUnitName} left (Min: {details.reorderSubUnits})
                  </span>
                  <span className="text-[10px] bg-amber-900/40 px-1.5 py-0.5 rounded text-amber-100 font-bold">
                    {details.packageFraction} {details.packagingUnit}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Inventory Health Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-sm">
          <div className="text-[11px] font-bold text-[#5A6F66] uppercase tracking-wider flex items-center justify-between">
            <span>Total Pantry Valuation</span>
            <DollarSign className="w-4 h-4 text-[#236B50]" />
          </div>
          <div className="text-2xl font-black text-[#192A24] mt-1.5">{formatCurrency(totalValuation)}</div>
          <div className="text-xs text-[#5A6F66] mt-1">{ingredients.length} Total Master Ingredients</div>
        </div>

        <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-sm">
          <div className="text-[11px] font-bold text-[#5A6F66] uppercase tracking-wider flex items-center justify-between">
            <span>Whole Packaging Units</span>
            <Boxes className="w-4 h-4 text-[#236B50]" />
          </div>
          <div className="text-2xl font-black text-[#192A24] mt-1.5">{totalCartons} Cartons & Sacks</div>
          <div className="text-xs text-[#5A6F66] mt-1">In Walk-in freezers & dry stores</div>
        </div>

        <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-sm">
          <div className="text-[11px] font-bold text-[#5A6F66] uppercase tracking-wider flex items-center justify-between">
            <span>Low Stock Alerts</span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <div className={`text-2xl font-black mt-1.5 ${lowStockItems.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {lowStockItems.length} Items Critical
          </div>
          <div className="text-xs text-[#5A6F66] mt-1">Requires PO from Accounts Arun</div>
        </div>

        <div className="bg-white border border-[#E2ECE7] rounded-3xl p-5 shadow-sm">
          <div className="text-[11px] font-bold text-[#5A6F66] uppercase tracking-wider flex items-center justify-between">
            <span>Latest Stock Movements</span>
            <History className="w-4 h-4 text-[#236B50]" />
          </div>
          <div className="text-2xl font-black text-[#236B50] mt-1.5">{stockMovements.length} Logged</div>
          <div className="text-xs text-[#5A6F66] mt-1">Audit movements preserved</div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center space-x-2 border-b border-[#D5E5DE] pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'stock'
              ? 'bg-[#236B50] text-white shadow-sm'
              : 'bg-white hover:bg-[#F6FAF8] text-[#3D5A4E] border border-[#D5E5DE]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Kitchen Stock & Packaging Breakdown</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 font-mono">
            {ingredients.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('purchasing_ocr')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'purchasing_ocr'
              ? 'bg-[#236B50] text-white shadow-sm'
              : 'bg-white hover:bg-[#F6FAF8] text-[#3D5A4E] border border-[#D5E5DE]'
          }`}
        >
          <ScanLine className="w-4 h-4" />
          <span>Register Purchases (Excel & OCR Bill Scan)</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
            Arun & Chef
          </span>
        </button>

        <button
          onClick={() => setActiveTab('usage_deduct')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'usage_deduct'
              ? 'bg-[#236B50] text-white shadow-sm'
              : 'bg-white hover:bg-[#F6FAF8] text-[#3D5A4E] border border-[#D5E5DE]'
          }`}
        >
          <PackageMinus className="w-4 h-4" />
          <span>Log Usage / Dish Prep Deduction</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
            Chef Karim
          </span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'movements'
              ? 'bg-[#236B50] text-white shadow-sm'
              : 'bg-white hover:bg-[#F6FAF8] text-[#3D5A4E] border border-[#D5E5DE]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Stock Movement Ledger</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-800">
            {stockMovements.length}
          </span>
        </button>
      </div>

      {/* TAB 1: KITCHEN STOCK & PACKAGING BREAKDOWN */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-white border border-[#E2ECE7] rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#5A6F66] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search chicken, rice, carton, supplier, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-2xl pl-10 pr-3 py-2 text-xs text-[#192A24] placeholder-[#7D948A] focus:outline-none focus:border-[#236B50]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-[#F6FAF8] border border-[#D5E5DE] rounded-2xl px-3.5 py-2 text-xs text-[#192A24] font-medium focus:outline-none focus:border-[#236B50]"
              >
                <option value="all">All Categories</option>
                <option value="Meat & Poultry">Meat & Poultry</option>
                <option value="Seafood">Seafood</option>
                <option value="Dairy">Dairy</option>
                <option value="Produce">Produce</option>
                <option value="Dry Goods & Spices">Dry Goods & Spices</option>
                <option value="Beverages">Beverages</option>
                <option value="Bakery">Bakery</option>
              </select>

              <label className="flex items-center space-x-2 text-xs text-[#3D5A4E] font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyLowStock}
                  onChange={(e) => setOnlyLowStock(e.target.checked)}
                  className="rounded text-[#236B50] focus:ring-[#236B50]"
                />
                <span>Show Only Low Stock ({lowStockItems.length})</span>
              </label>
            </div>
          </div>

          {/* User's Exact Requirement Spotlight: Chicken Carton Example Card */}
          {(() => {
            const chickenItem = ingredients.find(i => i.id === 'ing_1');
            if (!chickenItem) return null;
            const chkDetails = getStockDetails(chickenItem);

            return (
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white rounded-3xl p-5 border border-emerald-200 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2.5 py-0.5 rounded-full">
                        Live Packaging Breakdown (Chef Prompt Specification)
                      </span>
                      <span className="text-xs font-bold text-emerald-950">{chickenItem.name}</span>
                    </div>
                    <p className="text-xs text-emerald-800">
                      Standard Packaging: <strong>1 Carton = {chkDetails.perPack} Chicken Bones / Pieces</strong>.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleQuickDeduct(chickenItem, 2, 'Room Service: Chicken Biryani (2 chicken pieces/bones used)')}
                      className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer flex items-center space-x-1.5"
                    >
                      <ChefHat className="w-3.5 h-3.5" />
                      <span>Cook Biryani: Deduct 2 Pieces</span>
                    </button>
                    <button
                      onClick={() => handleQuickDeduct(chickenItem, 26, 'Party Banquet: 1 Carton of Chicken used')}
                      className="px-3.5 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                    >
                      <span>Party: Deduct 1 Carton</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-emerald-200/60">
                  <div className="bg-white/80 p-3 rounded-2xl border border-emerald-100">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase">Current Total Pieces</div>
                    <div className="text-lg font-black text-[#192A24]">{chkDetails.totalSubUnits} Pieces / Bones</div>
                    <div className="text-[10px] text-slate-500">at {chkDetails.subUnitCost.toFixed(2)} AED each</div>
                  </div>

                  <div className="bg-white/80 p-3 rounded-2xl border border-emerald-100">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase">Equivalent Packaging</div>
                    <div className="text-lg font-black text-emerald-900">
                      {chkDetails.wholePackages} Cartons + {chkDetails.remainderSubUnits} Pcs
                    </div>
                    <div className="text-[10px] text-emerald-700 font-semibold font-mono">
                      = {chkDetails.packageFraction} Cartons total
                    </div>
                  </div>

                  <div className="bg-white/80 p-3 rounded-2xl border border-emerald-100">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase">Carton Fill Level</div>
                    <div className="mt-1.5">
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-emerald-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${Math.min(100, (chkDetails.remainderSubUnits / chkDetails.perPack) * 100)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                        <span>Open Carton: {chkDetails.remainderSubUnits}/{chkDetails.perPack} pcs</span>
                        <span>{Math.round((chkDetails.remainderSubUnits / chkDetails.perPack) * 100)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/80 p-3 rounded-2xl border border-emerald-100">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase">Storage & Batch</div>
                    <div className="text-xs font-bold text-[#192A24] truncate">{chickenItem.storageLocation || 'Walk-in Freezer'}</div>
                    <div className="text-[10px] text-slate-500 font-mono">Batch: {chickenItem.batchNumber || 'EPF-2026-B941'}</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Full Ingredients Table */}
          <div className="bg-white border border-[#E2ECE7] rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAF9] text-[#5A6F66] border-b border-[#E2ECE7] font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Item & Specifications</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Packaging Unit & Conversion</th>
                    <th className="py-3 px-4">Stock Breakdown</th>
                    <th className="py-3 px-4">Purchase Cost (Arun)</th>
                    <th className="py-3 px-4">Storage Location</th>
                    <th className="py-3 px-4 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2ECE7]">
                  {filtered.map(item => {
                    const details = getStockDetails(item);
                    return (
                      <tr key={item.id} className="hover:bg-[#F6FAF8] transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#192A24] flex items-center space-x-1.5">
                            <span>{item.name}</span>
                            {details.isLow && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                                Low Stock
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[#5A6F66] block">
                            Supplier: {item.supplier} • Batch: {item.batchNumber || 'BATCH-STD'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-[#5A6F66] font-medium">
                          {item.category}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#192A24]">
                            1 {details.packagingUnit} = {details.perPack} {details.subUnitName}
                          </div>
                          <span className="text-[10px] text-[#5A6F66]">
                            Standard wholesale packaging
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-[#192A24] flex items-center space-x-1">
                            <span className="text-emerald-800 font-extrabold">{details.wholePackages} {details.packagingUnit}s</span>
                            {details.remainderSubUnits > 0 && (
                              <span className="text-amber-800 font-extrabold">+ {details.remainderSubUnits} {details.subUnitName}</span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#5A6F66] font-mono mt-0.5">
                            Total: <strong>{details.totalSubUnits} {details.subUnitName}</strong> (Min buffer: {details.reorderSubUnits})
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-[#192A24]">
                            {(item.packageCostAED || item.costPerUnit).toFixed(2)} AED / {details.packagingUnit}
                          </div>
                          <span className="text-[10px] text-emerald-800 font-mono block">
                            {details.subUnitCost.toFixed(2)} AED / {details.subUnitName}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-[#5A6F66]">
                          <span className="font-medium text-[#192A24] block">{item.storageLocation || 'Main Kitchen Storage'}</span>
                          <span className="text-[10px]">Last Restocked: {item.lastPurchaseDate || '2026-10-12'}</span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => {
                                setSelectedIngredientForStock(item);
                                setAdjustmentType('deduct');
                                setAdjustmentMode('pieces');
                                setAdjustmentAmount(2);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#236B50] text-[11px] font-bold transition-colors cursor-pointer"
                              title="Deduct or Add Stock"
                            >
                              Adjust / Deduct
                            </button>
                          </div>
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

      {/* TAB 2: REGISTER PURCHASES (EXCEL & OCR BILL SCAN) */}
      {activeTab === 'purchasing_ocr' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2ECE7]">
              <div>
                <h3 className="font-extrabold text-base text-[#192A24] flex items-center space-x-2">
                  <ScanLine className="w-5 h-5 text-[#236B50]" />
                  <span>Purchasing Registration & Excel / OCR Invoice Fetcher</span>
                </h3>
                <p className="text-xs text-[#5A6F66] mt-0.5">
                  Arun (Accounts) and Chef Karim can automatically import purchasing bills, carton quantities, unit prices, and register them directly to the kitchen inventory.
                </p>
              </div>

              {/* Import Mode Selector */}
              <div className="flex items-center space-x-1.5 bg-[#F8FAF9] p-1.5 rounded-2xl border border-[#D5E5DE]">
                <button
                  type="button"
                  onClick={() => setOcrImportMode('samples')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    ocrImportMode === 'samples' ? 'bg-[#236B50] text-white shadow-xs' : 'text-[#3D5A4E] hover:bg-[#EBF3EF]'
                  }`}
                >
                  Preset Supplier Invoices
                </button>
                <button
                  type="button"
                  onClick={() => setOcrImportMode('paste')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    ocrImportMode === 'paste' ? 'bg-[#236B50] text-white shadow-xs' : 'text-[#3D5A4E] hover:bg-[#EBF3EF]'
                  }`}
                >
                  Paste Excel / CSV Table
                </button>
                <button
                  type="button"
                  onClick={() => setOcrImportMode('upload')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    ocrImportMode === 'upload' ? 'bg-[#236B50] text-white shadow-xs' : 'text-[#3D5A4E] hover:bg-[#EBF3EF]'
                  }`}
                >
                  OCR Bill Scan / File Upload
                </button>
              </div>
            </div>

            {/* Sub-mode 1: Preset Supplier Invoices */}
            {ocrImportMode === 'samples' && (
              <div className="space-y-4">
                <div className="text-xs font-bold text-[#192A24]">
                  Select Verified Crystal Plaza Hotel Supplier Delivery Bill:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => loadSampleInvoice('chicken')}
                    className="p-4 rounded-2xl border border-[#D5E5DE] hover:border-[#236B50] hover:bg-[#F6FAF8] text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#192A24] group-hover:text-[#236B50]">
                        Emirates Poultry Farms LLC
                      </span>
                      <PackageCheck className="w-4 h-4 text-[#236B50]" />
                    </div>
                    <div className="text-[11px] text-[#5A6F66] mt-1">Invoice #EPF-INV-99482</div>
                    <div className="text-xs font-bold text-emerald-800 mt-2">
                      4 Cartons Chicken (104 bones/pieces) + 6 Trays Eggs
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => loadSampleInvoice('produce')}
                    className="p-4 rounded-2xl border border-[#D5E5DE] hover:border-[#236B50] hover:bg-[#F6FAF8] text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#192A24] group-hover:text-[#236B50]">
                        Barakat Fresh Produce Direct
                      </span>
                      <PackageCheck className="w-4 h-4 text-[#236B50]" />
                    </div>
                    <div className="text-[11px] text-[#5A6F66] mt-1">Invoice #BKT-DEL-3381</div>
                    <div className="text-xs font-bold text-emerald-800 mt-2">
                      8 Bags Red Onions (80 kg) + 4 Bags Ginger/Garlic (20 kg)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => loadSampleInvoice('grains')}
                    className="p-4 rounded-2xl border border-[#D5E5DE] hover:border-[#236B50] hover:bg-[#F6FAF8] text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#192A24] group-hover:text-[#236B50]">
                        Kashmir Grain & Afia Oils
                      </span>
                      <PackageCheck className="w-4 h-4 text-[#236B50]" />
                    </div>
                    <div className="text-[11px] text-[#5A6F66] mt-1">Invoice #KGM-RC-8812</div>
                    <div className="text-xs font-bold text-emerald-800 mt-2">
                      6 Sacks Basmati Rice (150 kg) + 4 Tins Sunflower Oil (60 L)
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Sub-mode 2: Paste Excel / CSV Table */}
            {ocrImportMode === 'paste' && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-[#192A24]">
                  Paste Tabular Invoice Text (Item Name, Cartons, Price AED, Unit Name, Pieces/Pack):
                </label>
                <textarea
                  rows={4}
                  value={pastedInvoiceData}
                  onChange={(e) => setPastedInvoiceData(e.target.value)}
                  placeholder={`Fresh Farm Chicken\t5\t130.00\tCarton\t26\nRoyal Basmati Rice\t4\t130.00\tSack\t25\nSunflower Oil\t3\t90.00\tTin\t15`}
                  className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-2xl p-3 text-xs font-mono text-[#192A24] focus:outline-none focus:border-[#236B50]"
                />
                <button
                  type="button"
                  onClick={handleParsePastedText}
                  className="px-4 py-2 bg-[#236B50] hover:bg-[#1C5740] text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
                >
                  Parse Tabular Text
                </button>
              </div>
            )}

            {/* Sub-mode 3: OCR Bill Scan / File Upload */}
            {ocrImportMode === 'upload' && (
              <div className="p-8 border-2 border-dashed border-[#D5E5DE] rounded-3xl text-center space-y-3 bg-[#F8FAF9]">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800">
                  <ScanLine className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-[#192A24]">Scan Delivery Bill OCR or Upload Excel/CSV Sheet</h4>
                  <p className="text-[11px] text-[#5A6F66]">Supports PDF receipts, camera snapshots, .xlsx spreadsheets</p>
                </div>
                <div className="flex justify-center space-x-2">
                  <button
                    type="button"
                    onClick={() => loadSampleInvoice('chicken')}
                    className="px-4 py-2 bg-[#236B50] text-white text-xs font-extrabold rounded-xl hover:bg-[#1C5740] cursor-pointer"
                  >
                    Simulate OCR Scanner Read
                  </button>
                </div>
              </div>
            )}

            {/* Parsed Items Review Table */}
            {parsedInvoiceItems.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-[#E2ECE7]">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-[#192A24] flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>OCR / Excel Parsed Items Review ({parsedInvoiceItems.length} Provisions)</span>
                  </h4>
                  <span className="text-[11px] text-[#5A6F66]">
                    Total Invoice Value: <strong>{formatCurrency(parsedInvoiceItems.reduce((s, i) => s + (i.packagesReceived * i.costPerPackageAED), 0))}</strong>
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-[#D5E5DE]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAF9] text-[#5A6F66] font-bold text-[10px] uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Item Description</th>
                        <th className="py-2.5 px-3">Packaging Unit</th>
                        <th className="py-2.5 px-3">Qty Received</th>
                        <th className="py-2.5 px-3">Total Sub-Units</th>
                        <th className="py-2.5 px-3">Price / Carton</th>
                        <th className="py-2.5 px-3">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2ECE7]">
                      {parsedInvoiceItems.map((item, idx) => (
                        <tr key={idx} className="bg-white">
                          <td className="py-2.5 px-3 font-bold text-[#192A24]">
                            {item.itemName}
                            <span className="text-[10px] text-emerald-800 font-semibold block">
                              Matched: {item.matchedIngredientId ? '✓ Linked to Master Stock' : 'New Provision'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[#5A6F66]">
                            1 {item.packagingUnit} = {item.subUnitsPerPack} {item.subUnitName}
                          </td>
                          <td className="py-2.5 px-3 font-extrabold text-emerald-900">
                            +{item.packagesReceived} {item.packagingUnit}s
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#192A24]">
                            +{item.subUnitsReceived} {item.subUnitName}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {item.costPerPackageAED.toFixed(2)} AED
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#192A24]">
                            {(item.packagesReceived * item.costPerPackageAED).toFixed(2)} AED
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setParsedInvoiceItems([])}
                    className="px-4 py-2 bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#236B50] rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleCommitParsedInvoice}
                    className="px-5 py-2 bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer flex items-center space-x-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve & Add to Kitchen Stock</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LOG USAGE / DISH PREP DEDUCTION */}
      {activeTab === 'usage_deduct' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="font-extrabold text-base text-[#192A24] flex items-center space-x-2">
                <PackageMinus className="w-5 h-5 text-amber-700" />
                <span>Live Kitchen Usage & Recipe Preparation Deductions (Chef Karim)</span>
              </h3>
              <p className="text-xs text-[#5A6F66] mt-0.5">
                Whenever dishes are prepared or cartons opened for the party buffet or room service, deduct the exact pieces or packaging units from live inventory.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Preset 1: Chicken Biryani (2 chicken pieces from Carton of 26) */}
              <div className="p-4 rounded-2xl border border-[#D5E5DE] bg-[#F8FAF9] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#192A24]">Hyderabadi Chicken Biryani</span>
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">Room Service</span>
                </div>
                <p className="text-[11px] text-[#5A6F66]">
                  Uses <strong>2 Chicken Bones/Pieces</strong> (from carton of 26) + 0.25 kg basmati rice.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const chicken = ingredients.find(i => i.id === 'ing_1');
                    const rice = ingredients.find(i => i.id === 'ing_3');
                    if (chicken) handleQuickDeduct(chicken, 2, 'Room Service: 1 Portion Chicken Biryani (2 pieces chicken)');
                    if (rice) handleQuickDeduct(rice, 0.25, 'Room Service: 1 Portion Chicken Biryani (0.25 kg rice)');
                  }}
                  className="w-full py-2 bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                >
                  Cook 1 Portion Biryani (-2 Pieces)
                </button>
              </div>

              {/* Preset 2: Chicken Hakka Noodles (1 chicken piece from Carton) */}
              <div className="p-4 rounded-2xl border border-[#D5E5DE] bg-[#F8FAF9] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#192A24]">Chicken Hakka Noodles</span>
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">Room Service</span>
                </div>
                <p className="text-[11px] text-[#5A6F66]">
                  Uses <strong>1 Chicken Piece/Bone</strong> (shredded) + 0.20 kg egg noodles.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const chicken = ingredients.find(i => i.id === 'ing_1');
                    const noodles = ingredients.find(i => i.id === 'ing_9');
                    if (chicken) handleQuickDeduct(chicken, 1, 'Room Service: 1 Portion Chicken Noodles (1 piece chicken)');
                    if (noodles) handleQuickDeduct(noodles, 0.2, 'Room Service: 1 Portion Chicken Noodles (0.2 kg noodles)');
                  }}
                  className="w-full py-2 bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                >
                  Cook 1 Portion Noodles (-1 Piece)
                </button>
              </div>

              {/* Preset 3: Banquet Buffet for 30 (1 Carton Chicken + 6 kg Rice) */}
              <div className="p-4 rounded-2xl border border-[#D5E5DE] bg-[#F8FAF9] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#192A24]">Banquet Party Buffet (30 Guests)</span>
                  <span className="text-[10px] font-bold bg-purple-100 text-purple-900 px-2 py-0.5 rounded-full">Party Buffet</span>
                </div>
                <p className="text-[11px] text-[#5A6F66]">
                  Uses <strong>1 Whole Carton Chicken (26 pieces)</strong> + 6 kg Basmati Rice + 1 Tin Oil.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const chicken = ingredients.find(i => i.id === 'ing_1');
                    const rice = ingredients.find(i => i.id === 'ing_3');
                    if (chicken) handleQuickDeduct(chicken, 26, 'Banquet Buffet Party: 1 Full Carton of Chicken (26 pieces)');
                    if (rice) handleQuickDeduct(rice, 6, 'Banquet Buffet Party: 6 kg Basmati Rice');
                  }}
                  className="w-full py-2 bg-purple-700 hover:bg-purple-800 active:scale-98 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                >
                  Deduct Buffet Batch (-1 Carton)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STOCK MOVEMENT LEDGER (AUDIT LOG) */}
      {activeTab === 'movements' && (
        <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2ECE7]">
            <div>
              <h3 className="font-extrabold text-base text-[#192A24] flex items-center space-x-2">
                <History className="w-5 h-5 text-[#236B50]" />
                <span>Kitchen Stock Movement Ledger</span>
              </h3>
              <p className="text-xs text-[#5A6F66]">
                Immutable record of all delivery receipts, room service cooking, buffet deductions, and manual adjustments.
              </p>
            </div>
            <button
              onClick={refreshMovements}
              className="p-2 rounded-xl bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#236B50] transition-colors cursor-pointer"
              title="Refresh Ledger"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#D5E5DE]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAF9] text-[#5A6F66] font-bold text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Movement Type</th>
                  <th className="py-2.5 px-3">Ingredient</th>
                  <th className="py-2.5 px-3">Change Quantity</th>
                  <th className="py-2.5 px-3">Balance Remaining</th>
                  <th className="py-2.5 px-3">Reference / Reason</th>
                  <th className="py-2.5 px-3">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2ECE7]">
                {stockMovements.map(mov => {
                  const isDeduct = mov.quantityChanged < 0;
                  return (
                    <tr key={mov.id} className="hover:bg-[#F6FAF8] transition-colors">
                      <td className="py-2.5 px-3 text-[#5A6F66] font-mono text-[11px]">
                        {mov.timestamp}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          mov.type === 'purchase_receipt' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                          mov.type === 'room_service_prep' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                          mov.type === 'party_buffet_deduction' ? 'bg-purple-100 text-purple-900 border border-purple-300' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {mov.type.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[#192A24]">
                        {mov.ingredientName}
                      </td>
                      <td className={`py-2.5 px-3 font-mono font-black ${isDeduct ? 'text-amber-800' : 'text-emerald-800'}`}>
                        {mov.packagesEquivalent || (isDeduct ? `${mov.quantityChanged}` : `+${mov.quantityChanged}`)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#192A24]">
                        {mov.remainingSubUnits} units
                      </td>
                      <td className="py-2.5 px-3 text-[#5A6F66] text-[11px]">
                        {mov.reasonOrReference}
                      </td>
                      <td className="py-2.5 px-3 text-[#192A24] font-medium text-[11px]">
                        {mov.performedBy}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {selectedIngredientForStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-[#D5E5DE] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2ECE7]">
              <div>
                <h3 className="font-extrabold text-base text-[#192A24]">Adjust Stock / Prep Deduction</h3>
                <p className="text-xs text-[#5A6F66]">{selectedIngredientForStock.name}</p>
              </div>
              <button
                onClick={() => setSelectedIngredientForStock(null)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const details = getStockDetails(selectedIngredientForStock);
              return (
                <form onSubmit={handleStockAdjustmentSubmit} className="space-y-4 text-xs">
                  {/* Current Status Box */}
                  <div className="p-3 bg-[#F8FAF9] rounded-2xl border border-[#D5E5DE] space-y-1">
                    <div className="flex justify-between font-bold text-[#192A24]">
                      <span>Current Stock:</span>
                      <span>{details.wholePackages} {details.packagingUnit}s + {details.remainderSubUnits} {details.subUnitName}</span>
                    </div>
                    <div className="flex justify-between text-[#5A6F66]">
                      <span>Conversion:</span>
                      <span>1 {details.packagingUnit} = {details.perPack} {details.subUnitName}</span>
                    </div>
                    <div className="flex justify-between text-emerald-800 font-bold">
                      <span>Total Count:</span>
                      <span>{details.totalSubUnits} {details.subUnitName} (@ {details.subUnitCost.toFixed(2)} AED)</span>
                    </div>
                  </div>

                  {/* Operation Type */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustmentType('deduct')}
                      className={`py-2 rounded-xl font-extrabold transition-all cursor-pointer ${
                        adjustmentType === 'deduct' ? 'bg-amber-700 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      Deduct (Food Usage)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustmentType('add')}
                      className={`py-2 rounded-xl font-extrabold transition-all cursor-pointer ${
                        adjustmentType === 'add' ? 'bg-emerald-700 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      Add (Purchase Restock)
                    </button>
                  </div>

                  {/* Adjustment Unit Mode */}
                  <div>
                    <label className="block font-bold text-[#192A24] mb-1">Quantity Format</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAdjustmentMode('pieces')}
                        className={`py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                          adjustmentMode === 'pieces' ? 'bg-[#236B50] text-white' : 'bg-[#EBF3EF] text-[#236B50]'
                        }`}
                      >
                        In Individual {details.subUnitName}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustmentMode('cartons')}
                        className={`py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                          adjustmentMode === 'cartons' ? 'bg-[#236B50] text-white' : 'bg-[#EBF3EF] text-[#236B50]'
                        }`}
                      >
                        In Whole {details.packagingUnit}s
                      </button>
                    </div>
                  </div>

                  {/* Quantity Input */}
                  <div>
                    <label className="block font-bold text-[#192A24] mb-1">
                      Amount to {adjustmentType === 'deduct' ? 'Deduct' : 'Add'} ({adjustmentMode === 'cartons' ? details.packagingUnit : details.subUnitName})
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step={adjustmentMode === 'cartons' ? '0.1' : '1'}
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs font-bold text-[#192A24] focus:outline-none focus:border-[#236B50]"
                    />
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block font-bold text-[#192A24] mb-1">Reason / Recipe Dish Reference</label>
                    <input
                      type="text"
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      placeholder="e.g. Room Service: 2 Portions Chicken Biryani"
                      className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2ECE7]">
                    <button
                      type="button"
                      onClick={() => setSelectedIngredientForStock(null)}
                      className="px-4 py-2 bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#236B50] rounded-xl font-bold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white rounded-xl font-extrabold shadow-sm transition-all cursor-pointer"
                    >
                      Confirm Adjustment
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* Register New Item Modal */}
      {newIngredientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-[#D5E5DE] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2ECE7]">
              <div>
                <h3 className="font-extrabold text-base text-[#192A24]">Register New Kitchen Provision</h3>
                <p className="text-xs text-[#5A6F66]">Define packaging cartons, sub-units (e.g. bones/pieces), and pricing.</p>
              </div>
              <button
                onClick={() => setNewIngredientModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateIngredientSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#192A24] mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Whole Farm Chicken (Carton of 26 Pieces)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs font-bold text-[#192A24] focus:outline-none focus:border-[#236B50]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#192A24] mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as RawIngredient['category'])}
                    className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                  >
                    <option value="Meat & Poultry">Meat & Poultry</option>
                    <option value="Seafood">Seafood</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Produce">Produce</option>
                    <option value="Dry Goods & Spices">Dry Goods & Spices</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Bakery">Bakery</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#192A24] mb-1">Packaging Unit</label>
                  <input
                    type="text"
                    value={formPackagingUnit}
                    onChange={(e) => setFormPackagingUnit(e.target.value)}
                    placeholder="Carton, Sack, Tin, Tray, Box"
                    className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#192A24] mb-1">Sub-Unit Name</label>
                  <input
                    type="text"
                    value={formSubUnitName}
                    onChange={(e) => setFormSubUnitName(e.target.value)}
                    placeholder="chicken pieces/bones, kg, eggs"
                    className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#192A24] mb-1">Units per Carton/Pack *</label>
                  <input
                    type="number"
                    min="1"
                    value={formSubUnitsPerPack}
                    onChange={(e) => setFormSubUnitsPerPack(parseFloat(e.target.value) || 1)}
                    placeholder="26"
                    className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs font-bold text-[#192A24] focus:outline-none focus:border-[#236B50]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#192A24] mb-1">Carton Cost (AED)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={formPackageCost}
                    onChange={(e) => setFormPackageCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs font-bold text-[#192A24] focus:outline-none focus:border-[#236B50]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#192A24] mb-1">Stock Cartons</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formStockPackages}
                    onChange={(e) => setFormStockPackages(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs font-bold text-[#192A24] focus:outline-none focus:border-[#236B50]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#192A24] mb-1">Min Buffer Cartons</label>
                  <input
                    type="number"
                    min="1"
                    value={formReorderPackages}
                    onChange={(e) => setFormReorderPackages(parseFloat(e.target.value) || 1)}
                    className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs font-bold text-amber-800 focus:outline-none focus:border-[#236B50]"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-[11px] text-emerald-900 flex justify-between font-bold">
                <span>Calculated Unit Cost:</span>
                <span>{(formPackageCost / Math.max(1, formSubUnitsPerPack)).toFixed(2)} AED per {formSubUnitName}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#192A24] mb-1">Supplier</label>
                  <input
                    type="text"
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#192A24] mb-1">Storage Location</label>
                  <input
                    type="text"
                    value={formStorageLocation}
                    onChange={(e) => setFormStorageLocation(e.target.value)}
                    placeholder="Walk-in Freezer #1"
                    className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-xl px-3 py-2 text-xs text-[#192A24] focus:outline-none focus:border-[#236B50]"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2ECE7]">
                <button
                  type="button"
                  onClick={() => setNewIngredientModal(false)}
                  className="px-4 py-2 bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#236B50] rounded-xl font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#236B50] hover:bg-[#1C5740] active:scale-98 text-white rounded-xl font-extrabold shadow-sm transition-all cursor-pointer"
                >
                  Save Provision to Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
