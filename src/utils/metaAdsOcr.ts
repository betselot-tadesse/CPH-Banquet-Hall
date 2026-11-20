import * as XLSX from 'xlsx';
import { MetaAdMonthlyReport, UserProfile } from '../types';

export interface OcrExtractedRow {
  rowId: string;
  selected: boolean;
  monthKey: string;
  monthLabel: string;
  adSpendAED: number;
  facebookSpendAED: number;
  instagramSpendAED: number;
  whatsappSpendAED: number;
  leadsGenerated: number;
  impressions: number;
  clicks: number;
  reportedCprAED: number;
  ctrPercent: number;
  banquetSalesAED: number;
  topPerformingCampaign: string;
  confidence: 'high' | 'medium' | 'needs_review';
  rawSnippet: string;
}

export interface OcrExtractionResult {
  reportTitle: string;
  currencyDetected: string;
  sourceSummary: string;
  warnings: string[];
  rows: OcrExtractedRow[];
}

export const getMonthLabelFromKey = (key: string): string => {
  if (!/^\d{4}-\d{2}$/.test(key)) return key || 'Unknown Month';
  const [y, m] = key.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, 1);
  if (isNaN(dt.getTime())) return key;
  return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export async function runMetaAdsOcrRequest(payload: {
  fileBase64?: string;
  mimeType?: string;
  rawText?: string;
  fileName?: string;
  defaultMonthKey?: string;
}): Promise<OcrExtractionResult> {
  const response = await fetch('/api/marketing/ocr-meta-ads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileBase64: payload.fileBase64,
      mimeType: payload.mimeType,
      rawText: payload.rawText,
      fileName: payload.fileName,
      defaultMonthKey: payload.defaultMonthKey?.trim() || undefined,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to read Meta Ads report.');
  }

  const ext = data.extraction;
  const mappedRows: OcrExtractedRow[] = (ext?.rows || []).map((r: any, idx: number) => {
    const spend = Number(r.adSpendAED) || 0;
    const leads = Number(r.leadsGenerated) || 0;
    const sales = Number(r.banquetSalesAED) || 0;
    const impressions = Number(r.impressions) || 0;
    const hasUsefulData = spend > 0 || leads > 0 || sales > 0 || impressions > 0;
    return {
      rowId: r.rowId || `ocr_${Date.now()}_${idx}`,
      selected: hasUsefulData && Boolean(r.monthKey),
      monthKey: r.monthKey || '',
      monthLabel: r.monthLabel || getMonthLabelFromKey(r.monthKey || ''),
      adSpendAED: spend,
      facebookSpendAED: Number(r.facebookSpendAED) || 0,
      instagramSpendAED: Number(r.instagramSpendAED) || 0,
      whatsappSpendAED: Number(r.whatsappSpendAED) || 0,
      leadsGenerated: leads,
      impressions,
      clicks: Number(r.clicks) || 0,
      reportedCprAED: Number(r.reportedCprAED) || 0,
      ctrPercent: Number(r.ctrPercent) || 0,
      banquetSalesAED: sales,
      topPerformingCampaign: r.topPerformingCampaign || '',
      confidence: r.confidence || 'medium',
      rawSnippet: r.rawSnippet || '',
    };
  });

  return {
    reportTitle: ext?.reportTitle || payload.fileName || 'Meta Ads Report',
    currencyDetected: ext?.currencyDetected || 'Unknown',
    sourceSummary: ext?.sourceSummary || '',
    warnings: Array.isArray(ext?.warnings) ? ext.warnings : [],
    rows: mappedRows,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read the selected file.'));
    reader.readAsDataURL(file);
  });
}

export async function extractMetaAdsReportFile(
  file: File,
  defaultMonthKey?: string
): Promise<{ extraction: OcrExtractionResult; previewUrl: string | null }> {
  const lowerName = file.name.toLowerCase();
  const mime = file.type || '';

  // 1. Spreadsheets / CSV exports from Meta Ads Manager
  if (
    lowerName.endsWith('.csv') ||
    lowerName.endsWith('.tsv') ||
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    mime.includes('csv') ||
    mime.includes('spreadsheet') ||
    mime.includes('excel')
  ) {
    const arrayBuf = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuf, { type: 'array' });
    const sheetTexts = workbook.SheetNames.map(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      return `--- Sheet: ${sheetName} ---\n${csv}`;
    }).join('\n\n');

    const extraction = await runMetaAdsOcrRequest({
      rawText: sheetTexts,
      fileName: file.name,
      defaultMonthKey,
    });
    return { extraction, previewUrl: null };
  }

  // 2. Images or PDFs -> Send base64 to server multimodal Gemini OCR
  const isImage = mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(lowerName);
  const isPdf = mime === 'application/pdf' || lowerName.endsWith('.pdf');

  if (!isImage && !isPdf) {
    const txt = await file.text();
    const extraction = await runMetaAdsOcrRequest({
      rawText: txt,
      fileName: file.name,
      defaultMonthKey,
    });
    return { extraction, previewUrl: null };
  }

  const dataUrl = await readFileAsDataUrl(file);
  const resolvedMime = isPdf
    ? 'application/pdf'
    : mime || (lowerName.endsWith('.png') ? 'image/png' : 'image/jpeg');

  const extraction = await runMetaAdsOcrRequest({
    fileBase64: dataUrl,
    mimeType: resolvedMime,
    fileName: file.name,
    defaultMonthKey,
  });

  return {
    extraction,
    previewUrl: isImage ? dataUrl : null,
  };
}

export function buildMetaAdReportFromOcrRow(
  row: OcrExtractedRow,
  existingReports: MetaAdMonthlyReport[],
  currentUser: UserProfile,
  options?: {
    preserveExistingSales?: boolean;
    sourceTitle?: string;
  }
): MetaAdMonthlyReport {
  const preserveExistingSales = options?.preserveExistingSales ?? true;
  const cleanKey = row.monthKey.trim();
  const existing = existingReports.find(r => r.monthKey === cleanKey);
  const adSpend = Number(row.adSpendAED) || 0;
  const leads = Math.max(0, Math.round(Number(row.leadsGenerated) || 0));
  const calcCpr = leads > 0 ? parseFloat((adSpend / leads).toFixed(2)) : 0;
  const impressions = Math.max(0, Math.round(Number(row.impressions) || 0));
  const clicks = Math.max(0, Math.round(Number(row.clicks) || 0));
  const ctr =
    row.ctrPercent > 0
      ? row.ctrPercent
      : impressions > 0 && clicks > 0
      ? parseFloat(((clicks / impressions) * 100).toFixed(2))
      : existing?.ctrPercent || 0;

  const historicalSales =
    row.banquetSalesAED > 0
      ? row.banquetSalesAED
      : preserveExistingSales
      ? existing?.historicalBanquetRevenue
      : undefined;

  const roas =
    adSpend > 0 && historicalSales && historicalSales > 0
      ? parseFloat((historicalSales / adSpend).toFixed(2))
      : existing?.roasMultiplier || 0;

  const hasPlatformSplit =
    row.facebookSpendAED > 0 || row.instagramSpendAED > 0 || row.whatsappSpendAED > 0;

  return {
    id: existing?.id || `meta_rep_${cleanKey.replace('-', '_')}`,
    monthKey: cleanKey,
    monthLabel: row.monthLabel || getMonthLabelFromKey(cleanKey),
    adSpendAED: parseFloat(adSpend.toFixed(2)),
    impressions: impressions > 0 ? impressions : existing?.impressions || 0,
    clicks: clicks > 0 ? clicks : existing?.clicks || 0,
    leadsGenerated: leads,
    cprAED: calcCpr,
    ctrPercent: ctr,
    roasMultiplier: roas,
    topPerformingCampaign: row.topPerformingCampaign || existing?.topPerformingCampaign || '',
    notes: `OCR Imported from "${options?.sourceTitle || 'Meta Ads Report'}" (${new Date().toLocaleDateString()})`,
    platformBreakdown: hasPlatformSplit
      ? {
          facebookSpendAED: row.facebookSpendAED || 0,
          instagramSpendAED: row.instagramSpendAED || 0,
          whatsappSpendAED: row.whatsappSpendAED || 0,
        }
      : existing?.platformBreakdown,
    historicalBanquetRevenue: historicalSales,
    historicalDirectCosts: existing?.historicalDirectCosts,
    historicalPartiesCount: existing?.historicalPartiesCount,
    historicalGuestsCount: existing?.historicalGuestsCount,
    conversionRatePercent: existing?.conversionRatePercent,
    insertedAt: new Date().toISOString(),
    insertedBy: `${currentUser.name} (OCR Verified)`,
  };
}
