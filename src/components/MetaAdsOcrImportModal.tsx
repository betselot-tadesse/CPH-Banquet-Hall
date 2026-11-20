import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  ScanText,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Trash2,
  Eye,
  ClipboardPaste,
  Check,
  ArrowRight,
  Info,
} from 'lucide-react';
import { MetaAdMonthlyReport, UserProfile } from '../types';
import { formatCurrency } from '../utils/costCalculations';
import {
  OcrExtractedRow,
  getMonthLabelFromKey,
  runMetaAdsOcrRequest,
  extractMetaAdsReportFile,
  buildMetaAdReportFromOcrRow,
} from '../utils/metaAdsOcr';

export type { OcrExtractedRow };

interface MetaAdsOcrImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingReports: MetaAdMonthlyReport[];
  currentUser: UserProfile;
  initialMonthKey?: string;
  onApplySingleToForm?: (row: OcrExtractedRow) => void;
  onCommitReports: (reportsToSave: MetaAdMonthlyReport[], metaSummary: string) => void;
}

export const MetaAdsOcrImportModal: React.FC<MetaAdsOcrImportModalProps> = ({
  isOpen,
  onClose,
  existingReports,
  currentUser,
  initialMonthKey = '',
  onApplySingleToForm,
  onCommitReports,
}) => {
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [defaultMonthKey, setDefaultMonthKey] = useState<string>(initialMonthKey);
  const [pastedText, setPastedText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [fileMimeType, setFileMimeType] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Extracted state
  const [reportTitle, setReportTitle] = useState<string>('');
  const [currencyDetected, setCurrencyDetected] = useState<string>('');
  const [sourceSummary, setSourceSummary] = useState<string>('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rows, setRows] = useState<OcrExtractedRow[]>([]);
  const [preserveExistingSales, setPreserveExistingSales] = useState<boolean>(true);
  const [expandedSnippetId, setExpandedSnippetId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDefaultMonthKey(initialMonthKey || '');
      setErrorMsg(null);
    }
  }, [isOpen, initialMonthKey]);

  const resetExtraction = () => {
    setRows([]);
    setWarnings([]);
    setReportTitle('');
    setCurrencyDetected('');
    setSourceSummary('');
    setErrorMsg(null);
    setPreviewUrl(null);
    setFileName('');
    setFileMimeType('');
    setPastedText('');
  };

  const runOcrApi = async (payload: {
    fileBase64?: string;
    mimeType?: string;
    rawText?: string;
    fileName?: string;
  }) => {
    setIsExtracting(true);
    setErrorMsg(null);
    try {
      const ext = await runMetaAdsOcrRequest({
        ...payload,
        defaultMonthKey: defaultMonthKey.trim() || undefined,
      });

      setReportTitle(ext.reportTitle);
      setCurrencyDetected(ext.currencyDetected);
      setSourceSummary(ext.sourceSummary);
      setWarnings(ext.warnings);
      setRows(ext.rows);

      if (ext.rows.length === 0) {
        setErrorMsg(
          'No Meta Ads monthly figures were detected in that file. Try a sharper screenshot, a PDF export, or paste the table text directly.'
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'OCR extraction failed. Please check the file and try again.');
    } finally {
      setIsExtracting(false);
    }
  };

  const processFile = async (file: File) => {
    setIsExtracting(true);
    setErrorMsg(null);
    setFileName(file.name);
    setFileMimeType(file.type || '');
    try {
      const { extraction, previewUrl: imgPreview } = await extractMetaAdsReportFile(file, defaultMonthKey);
      setPreviewUrl(imgPreview);
      setReportTitle(extraction.reportTitle);
      setCurrencyDetected(extraction.currencyDetected);
      setSourceSummary(extraction.sourceSummary);
      setWarnings(extraction.warnings);
      setRows(extraction.rows);

      if (extraction.rows.length === 0) {
        setErrorMsg(
          'No Meta Ads monthly figures were detected in that file. Try a sharper screenshot, a PDF export, or paste the table text directly.'
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'OCR extraction failed. Please check the file and try again.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Clipboard Ctrl+V / Cmd+V screenshot paste handler while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT');

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            const pastedFile = new File([blob], `pasted_meta_ads_${Date.now()}.png`, {
              type: item.type,
            });
            setInputMode('file');
            processFile(pastedFile);
          }
          return;
        }
      }

      // If user isn't typing in a table field and pastes text in paste mode, keep native behavior
      if (isTextInput) return;
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, defaultMonthKey]);

  if (!isOpen) return null;

  const updateRowField = (
    rowId: string,
    field: keyof OcrExtractedRow,
    value: string | number | boolean
  ) => {
    setRows(prev =>
      prev.map(row => {
        if (row.rowId !== rowId) return row;
        const updated: OcrExtractedRow = { ...row, [field]: value } as OcrExtractedRow;
        if (field === 'monthKey' && typeof value === 'string') {
          const clean = value.trim();
          updated.monthKey = clean;
          if (/^\d{4}-\d{2}$/.test(clean)) {
            updated.monthLabel = getMonthLabelFromKey(clean);
          }
        }
        return updated;
      })
    );
  };

  const removeRow = (rowId: string) => {
    setRows(prev => prev.filter(r => r.rowId !== rowId));
  };

  const selectedRows = rows.filter(r => r.selected);
  const invalidSelectedRows = selectedRows.filter(r => !/^\d{4}-\d{2}$/.test(r.monthKey.trim()));
  const currencyWarning =
    currencyDetected &&
    currencyDetected.toUpperCase() !== 'AED' &&
    currencyDetected.toUpperCase() !== 'UNKNOWN';

  const handleCommitSelected = () => {
    if (selectedRows.length === 0 || invalidSelectedRows.length > 0) return;
    const reportsToSave = selectedRows.map(row =>
      buildMetaAdReportFromOcrRow(row, existingReports, currentUser, {
        preserveExistingSales,
        sourceTitle: reportTitle || fileName || 'Meta Ads Report',
      })
    );
    const summary = `OCR imported ${reportsToSave.length} month(s) (${reportsToSave.map(r => r.monthKey).join(', ')}) from ${reportTitle || fileName || 'Meta Ads Report'}`;
    onCommitReports(reportsToSave, summary);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[93vh] flex flex-col shadow-2xl border border-[#C2D8CE] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#1A4D3A] via-[#236B50] to-[#1A4D3A] text-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-300/20 border border-amber-300/40 flex items-center justify-center text-amber-200 shrink-0">
              <ScanText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>Meta Ads Report OCR Importer</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-400/20 text-emerald-100 border border-emerald-300/30 uppercase">
                  Verified Safe Entry
                </span>
              </h3>
              <p className="text-[11px] text-emerald-100/90">
                Upload a Meta Ads screenshot, PDF, CSV/Excel export, or paste Ctrl+V — review auto-checked math &amp; diffs before saving.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-[#F9FCFA]">
          {/* Step 1: Upload / Paste Controls */}
          <div className="bg-white rounded-2xl border border-[#D5E5DE] p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2 p-1 bg-[#F2F7F5] rounded-xl border border-[#D5E5DE] self-start">
                <button
                  type="button"
                  onClick={() => setInputMode('file')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
                    inputMode === 'file'
                      ? 'bg-[#236B50] text-white shadow-xs'
                      : 'text-[#5A6F66] hover:text-[#192A24]'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Image / PDF / Excel / CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('paste')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
                    inputMode === 'paste'
                      ? 'bg-[#236B50] text-white shadow-xs'
                      : 'text-[#5A6F66] hover:text-[#192A24]'
                  }`}
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Paste Report Table Text</span>
                </button>
              </div>

              {/* Optional Month Hint */}
              <div className="flex items-center space-x-2">
                <label className="text-[11px] font-bold text-[#5A6F66] whitespace-nowrap">
                  Fallback Month (if unnamed):
                </label>
                <input
                  type="month"
                  value={defaultMonthKey}
                  onChange={(e) => setDefaultMonthKey(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-[#C2D8CE] text-xs font-bold bg-white text-[#192A24]"
                />
                {defaultMonthKey && (
                  <button
                    type="button"
                    onClick={() => setDefaultMonthKey('')}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Auto
                  </button>
                )}
              </div>
            </div>

            {inputMode === 'file' ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped) processFile(dropped);
                }}
                onClick={() => !isExtracting && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-[#236B50] bg-[#E8F5EE]'
                    : 'border-[#BFD6CB] bg-[#F7FBF9] hover:border-[#236B50] hover:bg-[#EFF8F3]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.csv,.tsv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) processFile(f);
                    e.target.value = '';
                  }}
                />

                {isExtracting ? (
                  <div className="py-4 flex flex-col items-center space-y-2.5">
                    <RefreshCw className="w-8 h-8 text-[#236B50] animate-spin" />
                    <p className="text-sm font-black text-[#192A24]">
                      Reading &amp; Verifying OCR Data from {fileName || 'Report'}...
                    </p>
                    <p className="text-xs text-[#5A6F66]">
                      Checking spend, leads, CPL math accuracy, and matching months safely.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-2">
                    <div className="flex items-center space-x-2 text-[#236B50]">
                      <ImageIcon className="w-6 h-6" />
                      <FileText className="w-6 h-6" />
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-black text-[#192A24]">
                      Drop your Meta Ads report here, click to browse, or press <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 text-[11px] font-mono">Ctrl+V</kbd> to paste a screenshot
                    </p>
                    <p className="text-[11px] text-[#5A6F66]">
                      Supports Meta Ads Manager screenshots (PNG, JPG, WEBP), PDF reports, and CSV / Excel (.xlsx) exports.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                <textarea
                  rows={5}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste copied rows from Meta Ads Manager, Google Sheets, or Excel here (e.g. September 2026 | AED 2,450.50 | 280 Leads | 8.75 CPL)..."
                  className="w-full p-3 rounded-2xl border border-[#C2D8CE] bg-[#FBFDFC] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#236B50]"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#5A6F66]">
                    Numbers are extracted verbatim and presented below for review before saving.
                  </span>
                  <button
                    type="button"
                    disabled={isExtracting || !pastedText.trim()}
                    onClick={() =>
                      runOcrApi({
                        rawText: pastedText,
                        fileName: 'Pasted Meta Ads Report',
                      })
                    }
                    className="px-4 py-2 rounded-xl bg-[#236B50] hover:bg-[#1B553F] disabled:opacity-50 text-white text-xs font-black flex items-center space-x-1.5 cursor-pointer shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isExtracting ? 'Extracting...' : 'Extract & Verify Data'}</span>
                  </button>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-bold flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Step 2: OCR Source Preview + Extracted Verification Table */}
          {rows.length > 0 && (
            <div className="space-y-4">
              {/* Source Summary & Currency Safety Banner */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {previewUrl && (
                  <div className="bg-white rounded-2xl border border-[#D5E5DE] p-3 flex flex-col space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#5A6F66]">
                      <span className="flex items-center space-x-1 truncate">
                        <Eye className="w-3.5 h-3.5 text-[#236B50]" />
                        <span className="truncate">{fileName || 'Uploaded Image'}</span>
                      </span>
                    </div>
                    <img
                      src={previewUrl}
                      alt="Meta Ads Report Preview"
                      className="w-full max-h-40 object-contain rounded-xl border border-slate-200 bg-slate-50"
                    />
                  </div>
                )}

                <div className={`${previewUrl ? 'lg:col-span-3' : 'lg:col-span-4'} bg-white rounded-2xl border border-[#D5E5DE] p-4 flex flex-col justify-between space-y-3`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-black text-[#192A24]">{reportTitle}</h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            currencyWarning
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          Currency: {currencyDetected || 'AED'}
                        </span>
                      </div>
                      {sourceSummary && (
                        <p className="text-xs text-[#5A6F66] mt-1">{sourceSummary}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={resetExtraction}
                      className="text-[11px] font-bold text-slate-500 hover:text-rose-700 flex items-center space-x-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Scan</span>
                    </button>
                  </div>

                  {(currencyWarning || warnings.length > 0) && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
                      <div className="font-extrabold flex items-center space-x-1.5 text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>OCR Safety Verification Notices</span>
                      </div>
                      {currencyWarning && (
                        <p className="text-[11px] font-bold">
                          • Report currency detected as <strong>{currencyDetected}</strong> (system ledger tracks <strong>AED</strong>). Please convert amounts if needed before approving.
                        </p>
                      )}
                      {warnings.map((w, idx) => (
                        <p key={idx} className="text-[11px]">• {w}</p>
                      ))}
                    </div>
                  )}

                  {/* Safe Merge Option */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100 text-xs">
                    <label className="flex items-center space-x-2 cursor-pointer font-semibold text-[#192A24]">
                      <input
                        type="checkbox"
                        checked={preserveExistingSales}
                        onChange={(e) => setPreserveExistingSales(e.target.checked)}
                        className="rounded border-slate-300 text-[#236B50] focus:ring-[#236B50]"
                      />
                      <span>
                        Safety Lock: Keep existing Banquet Sales if uploaded Meta Ads report only contains ad metrics
                      </span>
                    </label>

                    <div className="flex items-center space-x-3">
                      <button
                        type="button"
                        onClick={() =>
                          setRows(prev => prev.map(r => ({ ...r, selected: true })))
                        }
                        className="text-[11px] font-bold text-[#236B50] hover:underline cursor-pointer"
                      >
                        Select All ({rows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setRows(prev => prev.map(r => ({ ...r, selected: false })))
                        }
                        className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable Verification Table */}
              <div className="bg-white rounded-2xl border border-[#D5E5DE] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#F2F7F5] text-[#192A24] border-b border-[#D5E5DE]">
                      <tr>
                        <th className="py-3 px-3 w-10 text-center">Save</th>
                        <th className="py-3 px-3 min-w-[140px]">Month (YYYY-MM)</th>
                        <th className="py-3 px-3 min-w-[125px]">Meta Spend (AED)</th>
                        <th className="py-3 px-3 min-w-[100px]">Leads / Inquiries</th>
                        <th className="py-3 px-3 min-w-[95px]">Calc CPL</th>
                        <th className="py-3 px-3 min-w-[110px]">Impressions / Clicks</th>
                        <th className="py-3 px-3 min-w-[125px]">Banquet Sales (AED)</th>
                        <th className="py-3 px-3 min-w-[175px]">Safety &amp; Diff Check</th>
                        <th className="py-3 px-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row) => {
                        const validKey = /^\d{4}-\d{2}$/.test(row.monthKey.trim());
                        const existing = validKey
                          ? existingReports.find(r => r.monthKey === row.monthKey.trim())
                          : undefined;
                        const calcCpl =
                          row.leadsGenerated > 0 ? row.adSpendAED / row.leadsGenerated : 0;
                        const cprMismatch =
                          row.reportedCprAED > 0 &&
                          calcCpl > 0 &&
                          Math.abs(row.reportedCprAED - calcCpl) > 0.15;

                        return (
                          <React.Fragment key={row.rowId}>
                            <tr
                              className={`transition-colors ${
                                !row.selected
                                  ? 'bg-slate-50/60 opacity-65'
                                  : !validKey || cprMismatch
                                  ? 'bg-amber-50/40'
                                  : 'hover:bg-[#FAFDFB]'
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={row.selected}
                                  onChange={(e) =>
                                    updateRowField(row.rowId, 'selected', e.target.checked)
                                  }
                                  className="w-4 h-4 rounded border-slate-300 text-[#236B50] focus:ring-[#236B50] cursor-pointer"
                                />
                              </td>

                              {/* Month Key + Label */}
                              <td className="py-2.5 px-3">
                                <input
                                  type="text"
                                  value={row.monthKey}
                                  onChange={(e) =>
                                    updateRowField(row.rowId, 'monthKey', e.target.value)
                                  }
                                  placeholder="YYYY-MM"
                                  className={`w-28 px-2 py-1 rounded-lg border font-mono font-bold text-xs ${
                                    validKey
                                      ? 'border-slate-300 bg-white text-[#192A24]'
                                      : 'border-rose-400 bg-rose-50 text-rose-900'
                                  }`}
                                />
                                <span className="block text-[10px] text-[#5A6F66] font-semibold mt-0.5">
                                  {validKey ? getMonthLabelFromKey(row.monthKey.trim()) : 'Enter YYYY-MM'}
                                </span>
                              </td>

                              {/* Meta Ad Spend */}
                              <td className="py-2.5 px-3">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={row.adSpendAED}
                                  onChange={(e) =>
                                    updateRowField(
                                      row.rowId,
                                      'adSpendAED',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-28 px-2 py-1 rounded-lg border border-slate-300 font-mono font-black text-amber-800 bg-white text-xs"
                                />
                                {existing && (
                                  <span className="block text-[10px] text-slate-500 mt-0.5 font-mono">
                                    Prev: {existing.adSpendAED.toFixed(2)}
                                  </span>
                                )}
                              </td>

                              {/* Leads */}
                              <td className="py-2.5 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  value={row.leadsGenerated}
                                  onChange={(e) =>
                                    updateRowField(
                                      row.rowId,
                                      'leadsGenerated',
                                      parseInt(e.target.value, 10) || 0
                                    )
                                  }
                                  className="w-20 px-2 py-1 rounded-lg border border-slate-300 font-mono font-black text-indigo-800 bg-white text-xs"
                                />
                                {existing && (
                                  <span className="block text-[10px] text-slate-500 mt-0.5 font-mono">
                                    Prev: {existing.leadsGenerated}
                                  </span>
                                )}
                              </td>

                              {/* Auto-Calculated CPL & Math Check */}
                              <td className="py-2.5 px-3 font-mono">
                                <span className="font-bold text-[#192A24] block">
                                  {calcCpl > 0 ? `AED ${calcCpl.toFixed(2)}` : '—'}
                                </span>
                                {row.reportedCprAED > 0 && (
                                  <span
                                    className={`text-[10px] block font-bold ${
                                      cprMismatch ? 'text-amber-700' : 'text-emerald-700'
                                    }`}
                                  >
                                    {cprMismatch
                                      ? `OCR: ${row.reportedCprAED.toFixed(2)} ≠ Calc`
                                      : `✓ OCR: ${row.reportedCprAED.toFixed(2)}`}
                                  </span>
                                )}
                              </td>

                              {/* Impressions / Clicks */}
                              <td className="py-2.5 px-3">
                                <div className="space-y-1">
                                  <input
                                    type="number"
                                    min="0"
                                    value={row.impressions}
                                    onChange={(e) =>
                                      updateRowField(
                                        row.rowId,
                                        'impressions',
                                        parseInt(e.target.value, 10) || 0
                                      )
                                    }
                                    placeholder="Impr."
                                    className="w-24 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[11px] bg-white block"
                                    title="Impressions"
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    value={row.clicks}
                                    onChange={(e) =>
                                      updateRowField(
                                        row.rowId,
                                        'clicks',
                                        parseInt(e.target.value, 10) || 0
                                      )
                                    }
                                    placeholder="Clicks"
                                    className="w-24 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[11px] bg-white block"
                                    title="Clicks"
                                  />
                                </div>
                              </td>

                              {/* Banquet Sales (optional) */}
                              <td className="py-2.5 px-3">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={row.banquetSalesAED}
                                  onChange={(e) =>
                                    updateRowField(
                                      row.rowId,
                                      'banquetSalesAED',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-28 px-2 py-1 rounded-lg border border-slate-300 font-mono font-bold text-[#236B50] bg-white text-xs"
                                />
                                {row.banquetSalesAED === 0 &&
                                  preserveExistingSales &&
                                  existing?.historicalBanquetRevenue ? (
                                    <span className="block text-[10px] text-emerald-700 font-semibold mt-0.5">
                                      Keeps AED {existing.historicalBanquetRevenue.toLocaleString()}
                                    </span>
                                  ) : null}
                              </td>

                              {/* Safety & Diff Badges */}
                              <td className="py-2.5 px-3 space-y-1">
                                <div className="flex flex-wrap gap-1">
                                  {!validKey ? (
                                    <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-200">
                                      Missing Month
                                    </span>
                                  ) : existing ? (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-200">
                                      Update Existing
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200">
                                      New Month
                                    </span>
                                  )}

                                  {cprMismatch ? (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-200">
                                      ⚠ Math Variance
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                                      {row.confidence === 'high'
                                        ? 'High Conf.'
                                        : row.confidence === 'medium'
                                        ? 'Med Conf.'
                                        : 'Review'}
                                    </span>
                                  )}
                                </div>

                                {row.rawSnippet && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedSnippetId(
                                        expandedSnippetId === row.rowId ? null : row.rowId
                                      )
                                    }
                                    className="text-[10px] font-bold text-[#236B50] hover:underline flex items-center space-x-1 cursor-pointer"
                                  >
                                    <Info className="w-3 h-3" />
                                    <span>
                                      {expandedSnippetId === row.rowId
                                        ? 'Hide OCR text'
                                        : 'Inspect OCR text'}
                                    </span>
                                  </button>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeRow(row.rowId)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                                  title="Remove row"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>

                            {expandedSnippetId === row.rowId && (
                              <tr className="bg-[#F4F8F6]">
                                <td colSpan={9} className="px-4 py-2 text-[11px] text-[#192A24]">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <span className="font-black text-[#236B50] mr-2">
                                        Raw OCR Read:
                                      </span>
                                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                                        {row.rawSnippet}
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-[10px] font-bold text-[#5A6F66]">
                                        Top Campaign:
                                      </span>
                                      <input
                                        type="text"
                                        value={row.topPerformingCampaign}
                                        onChange={(e) =>
                                          updateRowField(
                                            row.rowId,
                                            'topPerformingCampaign',
                                            e.target.value
                                          )
                                        }
                                        placeholder="Campaign name"
                                        className="px-2 py-0.5 rounded border border-slate-300 bg-white text-[11px] w-56"
                                      />
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white border-t border-[#D5E5DE] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2 text-xs text-[#5A6F66]">
            <ShieldCheck className="w-4 h-4 text-[#236B50] shrink-0" />
            <span>
              {selectedRows.length > 0
                ? `${selectedRows.length} month(s) selected for verified import • Total Spend ${formatCurrency(
                    selectedRows.reduce((s, r) => s + r.adSpendAED, 0)
                  )} • ${selectedRows.reduce((s, r) => s + r.leadsGenerated, 0).toLocaleString()} leads`
                : 'Upload or paste a Meta Ads report above to verify numbers before saving.'}
            </span>
          </div>

          <div className="flex items-center space-x-2.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>

            {onApplySingleToForm && selectedRows.length === 1 && (
              <button
                type="button"
                disabled={invalidSelectedRows.length > 0}
                onClick={() => {
                  onApplySingleToForm(selectedRows[0]);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-white border border-[#236B50] text-[#236B50] hover:bg-[#E8F5EE] text-xs font-black flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Fill Form Only</span>
              </button>
            )}

            <button
              type="button"
              disabled={selectedRows.length === 0 || invalidSelectedRows.length > 0}
              onClick={handleCommitSelected}
              className="px-5 py-2.5 rounded-xl bg-[#236B50] hover:bg-[#1B553F] disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-black shadow-md flex items-center space-x-2 cursor-pointer transition-all"
            >
              <Check className="w-4 h-4" />
              <span>
                Import {selectedRows.length} Verified {selectedRows.length === 1 ? 'Month' : 'Months'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
