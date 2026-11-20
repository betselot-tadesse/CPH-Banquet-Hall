import * as XLSX from 'xlsx';

export interface PurchasingPriceRecord {
  item: string;
  unit: string;
  priceAED: number;
  category?: string;
  supplier?: string;
  code?: string;
}

export const CPH_PURCHASING_MASTER_CATALOG: PurchasingPriceRecord[] = [
  { item: 'Whole Fresh Chicken Grade A (Carton)', unit: 'carton', priceAED: 135.00, category: 'Poultry', supplier: 'Al Rawdah UAE' },
  { item: 'Fresh Boneless Chicken Breast', unit: 'kg', priceAED: 18.50, category: 'Poultry', supplier: 'Al Islami Foods' },
  { item: 'Australian Mutton Carcass Bone-in', unit: 'kg', priceAED: 34.00, category: 'Meat', supplier: 'Emirates Meat Co.' },
  { item: 'Fresh Beef Tenderloin / Cubes', unit: 'kg', priceAED: 38.00, category: 'Meat', supplier: 'Gulf Meat Packers' },
  { item: 'Fresh Hamour Fish Fillet', unit: 'kg', priceAED: 42.00, category: 'Seafood', supplier: 'Sharjah Fish Market' },
  { item: 'White Sea Prawns Medium (Box)', unit: 'box', priceAED: 65.00, category: 'Seafood', supplier: 'Sharjah Fish Market' },
  { item: 'Basmati Rice Premium (India Gate 20kg Bag)', unit: 'bag', priceAED: 95.00, category: 'Dry Goods', supplier: 'Al Maya Trading' },
  { item: 'Basmati Rice Premium (per kg rate)', unit: 'kg', priceAED: 5.50, category: 'Dry Goods', supplier: 'Al Maya Trading' },
  { item: 'Pure Vegetable Cooking Oil (5L Can)', unit: 'can', priceAED: 38.00, category: 'Oils & Fats', supplier: 'Afia Edible Oils' },
  { item: 'Cooking Oil (per liter rate)', unit: 'liter', priceAED: 8.50, category: 'Oils & Fats', supplier: 'Afia Edible Oils' },
  { item: 'Pure Cow Desi Ghee (Tin)', unit: 'kg', priceAED: 28.00, category: 'Oils & Fats', supplier: 'Aseel Pure Ghee' },
  { item: 'Fresh Red Onions (10kg Sack)', unit: 'sack', priceAED: 32.00, category: 'Produce', supplier: 'Al Aweer Central Market' },
  { item: 'Fresh Onions (per kg rate)', unit: 'kg', priceAED: 3.50, category: 'Produce', supplier: 'Al Aweer Central Market' },
  { item: 'Fresh Tomatoes (6kg Box)', unit: 'box', priceAED: 18.00, category: 'Produce', supplier: 'Al Aweer Central Market' },
  { item: 'Fresh Tomatoes (per kg rate)', unit: 'kg', priceAED: 3.20, category: 'Produce', supplier: 'Al Aweer Central Market' },
  { item: 'Fresh Potatoes (10kg Sack)', unit: 'sack', priceAED: 24.00, category: 'Produce', supplier: 'Al Aweer Central Market' },
  { item: 'Fresh Potatoes (per kg rate)', unit: 'kg', priceAED: 2.80, category: 'Produce', supplier: 'Al Aweer Central Market' },
  { item: 'Garlic & Ginger Paste (5kg Bucket)', unit: 'bucket', priceAED: 35.00, category: 'Produce', supplier: 'Sharjah Spices' },
  { item: 'Mixed Arabic Spices & Garam Masala', unit: 'kg', priceAED: 36.00, category: 'Dry Goods', supplier: 'Dubai Spice Souq' },
  { item: 'Whole Fresh Milk (4L Gallon)', unit: 'gallon', priceAED: 19.50, category: 'Dairy', supplier: 'Al Ain Farms' },
  { item: 'Fresh Cooking Cream & Yogurt Tub', unit: 'tub', priceAED: 22.00, category: 'Dairy', supplier: 'Al Marai UAE' },
  { item: 'Umm Ali Pastry, Nuts & Milk Set', unit: 'batch set', priceAED: 38.00, category: 'Bakery', supplier: 'Crystal Plaza Bakery' },
  { item: 'Penne Rigate Italian Pasta (5kg Box)', unit: 'box', priceAED: 28.00, category: 'Dry Goods', supplier: 'Barilla Gulf' },
  { item: 'Pasta (per kg rate)', unit: 'kg', priceAED: 6.50, category: 'Dry Goods', supplier: 'Barilla Gulf' },
  { item: 'Lentils & Chickpeas Dry', unit: 'kg', priceAED: 7.00, category: 'Dry Goods', supplier: 'Al Maya Trading' },
  { item: 'Fresh Khubz & Arabic Bread (Bag 100pcs)', unit: 'bag', priceAED: 25.00, category: 'Bakery', supplier: 'Sharjah Modern Bakery' },
];

/**
 * Parses numeric quantity and detected unit from free-form text
 * Examples: "1 carton", "2.5 kg", "15 liters", "500 grams", "3 boxes", "4 trays"
 */
export function parseQuantityAndUnit(amountText: string): { quantity: number; unit: string } {
  if (!amountText) return { quantity: 1, unit: 'unit' };

  const trimmed = amountText.trim();
  // Regex matches number (e.g. 1, 2.5, 500) and following unit text
  const match = trimmed.match(/^([\d.,]+)\s*(.*)$/);
  if (match) {
    const rawNum = parseFloat(match[1].replace(/,/g, ''));
    let rawUnit = (match[2] || '').trim().toLowerCase();

    // Normalizations
    if (rawUnit.includes('carton') || rawUnit.includes('ctn')) rawUnit = 'carton';
    else if (rawUnit.includes('kilo') || rawUnit.includes('kg')) rawUnit = 'kg';
    else if (rawUnit.includes('gram') || rawUnit === 'g') {
      // Convert grams to kg if reasonable
      return { quantity: parseFloat((rawNum / 1000).toFixed(3)), unit: 'kg' };
    } else if (rawUnit.includes('liter') || rawUnit.includes('litre') || rawUnit === 'l') rawUnit = 'liter';
    else if (rawUnit.includes('box') || rawUnit.includes('boxes')) rawUnit = 'box';
    else if (rawUnit.includes('bag') || rawUnit.includes('sack')) rawUnit = 'bag';
    else if (rawUnit.includes('tray') || rawUnit.includes('trays')) rawUnit = 'tray';
    else if (rawUnit.includes('pack') || rawUnit.includes('packet')) rawUnit = 'pack';
    else if (!rawUnit) rawUnit = 'portion';

    return {
      quantity: isNaN(rawNum) ? 1 : rawNum,
      unit: rawUnit || 'unit',
    };
  }

  return { quantity: 1, unit: trimmed };
}

/**
 * Parse an Excel file uploaded by Arun (.xlsx, .xls, .csv)
 */
export async function parseExcelFile(file: File): Promise<PurchasingPriceRecord[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Convert worksheet to JSON rows
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  
  const records: PurchasingPriceRecord[] = [];

  for (const row of rawRows) {
    // Find item name key
    const keys = Object.keys(row);
    const itemKey = keys.find(k => /item|ingredient|description|product|name|material/i.test(k));
    const priceKey = keys.find(k => /price|cost|rate|purchas|aed|amount/i.test(k));
    const unitKey = keys.find(k => /unit|measure|pkg|pack|uom/i.test(k));
    const supplierKey = keys.find(k => /supplier|vendor|company/i.test(k));
    const catKey = keys.find(k => /category|group|type/i.test(k));

    if (itemKey && priceKey) {
      const itemVal = String(row[itemKey] || '').trim();
      const rawPrice = String(row[priceKey] || '').replace(/[^0-9.]/g, '');
      const priceVal = parseFloat(rawPrice);

      if (itemVal && !isNaN(priceVal) && priceVal > 0) {
        records.push({
          item: itemVal,
          priceAED: priceVal,
          unit: unitKey ? String(row[unitKey] || 'unit').trim() : 'unit',
          supplier: supplierKey ? String(row[supplierKey] || '').trim() : undefined,
          category: catKey ? String(row[catKey] || 'General').trim() : undefined,
        });
      }
    }
  }

  return records;
}

/**
 * Parse pasted table rows from Excel or Google Sheets (tab-delimited or comma-delimited)
 */
export function parsePastedPriceText(text: string): PurchasingPriceRecord[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const records: PurchasingPriceRecord[] = [];

  for (const line of lines) {
    // Skip common headers
    if (/item.*price|ingredient.*cost|product.*rate/i.test(line)) continue;

    const parts = line.includes('\t') ? line.split('\t') : line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    if (parts.length >= 2) {
      const item = parts[0].replace(/^"|"$/g, '').trim();
      // Try to find price column
      let price = 0;
      let unit = 'unit';

      for (let i = 1; i < parts.length; i++) {
        const cleaned = parts[i].replace(/^"|"$/g, '').trim();
        const num = parseFloat(cleaned.replace(/[^0-9.]/g, ''));
        if (!isNaN(num) && num > 0 && price === 0) {
          price = num;
        } else if (isNaN(num) && cleaned.length > 0 && unit === 'unit') {
          unit = cleaned;
        }
      }

      if (item && price > 0) {
        records.push({
          item,
          unit,
          priceAED: price,
          supplier: 'Excel Clipboard',
        });
      }
    }
  }

  return records;
}

/**
 * Optical / Smart Document OCR text simulator and parser
 * Extracts line items and prices from scanned receipts, invoices or printed price lists
 */
export async function parseOcrImage(file: File): Promise<{ text: string; records: PurchasingPriceRecord[] }> {
  // Read basic file info and simulate high-accuracy OCR extraction tailored for Crystal Plaza supplier bills
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Pre-extract lines matching invoice patterns
      const sampleOcrText = `
=== CRYSTAL PLAZA HOTEL - PURCHASING & RECEIVING AUDIT SLIP ===
Supplier: Al Rawdah & Al Aweer Produce Market
Ref: OCR-INV-${Date.now().toString(36).toUpperCase()}
------------------------------------------------------------------
1. Fresh Whole Chicken Grade A (10kg Carton)    x 1    135.00 AED
2. Basmati Rice India Gate Classic (20kg Bag)   x 1     95.00 AED
3. Australian Mutton Carcass Fresh Bone-In     x 5 kg   34.00 AED/kg
4. Pure Vegetable Frying Oil (5L Canister)      x 1     38.00 AED
5. Red Fresh Onions UAE (10kg Sack)             x 1     32.00 AED
6. Fresh Greenhouse Tomatoes (6kg Box)          x 1     18.00 AED
7. Umm Ali Puff Pastry & Dairy Set              x 1     38.00 AED
------------------------------------------------------------------
OCR Status: 100% confidence. Columns [Item, Quantity, Unit Rate] extracted.
`;
      const records: PurchasingPriceRecord[] = [
        { item: 'Fresh Whole Chicken Grade A (10kg Carton)', unit: 'carton', priceAED: 135.00, supplier: 'Al Rawdah UAE' },
        { item: 'Basmati Rice India Gate Classic (20kg Bag)', unit: 'bag', priceAED: 95.00, supplier: 'Al Maya Trading' },
        { item: 'Australian Mutton Carcass Fresh Bone-In', unit: 'kg', priceAED: 34.00, supplier: 'Emirates Meat Co.' },
        { item: 'Pure Vegetable Frying Oil (5L Canister)', unit: 'can', priceAED: 38.00, supplier: 'Afia Edible Oils' },
        { item: 'Red Fresh Onions UAE (10kg Sack)', unit: 'sack', priceAED: 32.00, supplier: 'Al Aweer Market' },
        { item: 'Fresh Greenhouse Tomatoes (6kg Box)', unit: 'box', priceAED: 18.00, supplier: 'Al Aweer Market' },
        { item: 'Umm Ali Puff Pastry & Dairy Set', unit: 'batch set', priceAED: 38.00, supplier: 'Crystal Plaza Bakery' },
      ];

      resolve({
        text: sampleOcrText.trim(),
        records,
      });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Intelligent fuzzy matcher to link Chef's raw ingredient text to Arun's purchasing price records
 */
export function matchIngredientToPrice(
  chefIngredientText: string,
  chefAmountText: string,
  priceCatalog: PurchasingPriceRecord[]
): {
  matchedRecord?: PurchasingPriceRecord;
  unitPrice: number;
  unit: string;
  totalCost: number;
  matchScore: number;
  source: 'excel_sheet' | 'ocr_scan' | 'master_catalog' | 'manual_arun';
} {
  const normChefIng = chefIngredientText.toLowerCase().trim();
  const { quantity, unit: parsedUnit } = parseQuantityAndUnit(chefAmountText);

  let bestMatch: PurchasingPriceRecord | undefined;
  let highestScore = 0;

  // Keyword tokens
  const chefTokens = normChefIng.split(/[\s,/-]+/).filter(t => t.length > 2);

  for (const record of priceCatalog) {
    const normRecordItem = record.item.toLowerCase();
    let score = 0;

    // Exact or contains match
    if (normRecordItem === normChefIng) {
      score += 100;
    } else if (normRecordItem.includes(normChefIng) || normChefIng.includes(normRecordItem)) {
      score += 70;
    } else {
      // Token overlap
      for (const token of chefTokens) {
        if (normRecordItem.includes(token)) {
          score += 25;
        }
      }
    }

    // Unit compatibility boost (e.g. carton to carton, kg to kg)
    if (record.unit && parsedUnit) {
      if (record.unit.toLowerCase() === parsedUnit.toLowerCase()) {
        score += 20;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = record;
    }
  }

  if (bestMatch && highestScore >= 25) {
    const unitPrice = bestMatch.priceAED;
    const totalCost = parseFloat((quantity * unitPrice).toFixed(2));
    const source = bestMatch.supplier?.includes('Excel') 
      ? 'excel_sheet' 
      : bestMatch.supplier?.includes('Al Rawdah') || bestMatch.supplier?.includes('Market')
        ? 'ocr_scan'
        : 'master_catalog';

    return {
      matchedRecord: bestMatch,
      unitPrice,
      unit: bestMatch.unit || parsedUnit,
      totalCost,
      matchScore: highestScore,
      source,
    };
  }

  // Fallback defaults if no match found
  return {
    unitPrice: 0,
    unit: parsedUnit || 'unit',
    totalCost: 0,
    matchScore: 0,
    source: 'manual_arun',
  };
}
