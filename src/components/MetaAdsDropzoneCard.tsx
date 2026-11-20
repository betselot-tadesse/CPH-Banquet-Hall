import React, { useState, useRef } from 'react';
import {
  Upload,
  ScanText,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Check,
  RotateCcw,
  Maximize2,
  X,
} from 'lucide-react';
import { MetaAdMonthlyReport, UserProfile } from '../types';
import { formatCurrency } from '../utils/costCalculations';
import {
  OcrExtractedRow,
  getMonthLabelFromKey,
  extractMetaAdsReportFile,
  buildMetaAdReportFromOcrRow,
} from '../utils/metaAdsOcr';

interface MetaAdsDropzoneCardProps {
  existingReports: MetaAdMonthlyReport[];
  currentUser: UserProfile;
  onCommitReports: (reportsToSave: MetaAdMonthlyReport[], metaSummary: string) => void;
  onUndoImport?: () => void;
  canUndo?: boolean;
  onOpenFullModal?: () => void;
}

export const MetaAdsDropzoneCard: React.FC<MetaAdsDropzoneCardProps> = ({
  existingReports,
  currentUser,
  onCommitReports,
  onUndoImport,
  canUndo = false,
  onOpenFullModal,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [defaultMonthKey, setDefaultMonthKey] = useState('');
  const [fileName, setFileName] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reportTitle, setReportTitle] = useState('');
  const [currencyDetected, setCurrencyDetected] = useState('');
  const [sourceSummary, setSourceSummary] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rows, setRows] = useState<OcrExtractedRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [commitSuccessMsg, setCommitSuccessMsg] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    setCommitSuccessMsg(null);
    setFileName(file.name);
    setIsExtracting(true);
    try {
      const { extraction, previewUrl: imgPreview } = await extractMetaAdsReportFile(file, defaultMonthKey);
      setPreviewUrl(imgPreview);
      setReportTitle(extraction.reportTitle || file.name);
      setCurrencyDetected(extraction.currencyDetected || 'AED');
      setSourceSummary(extraction.sourceSummary || '');
      setWarnings(extraction.warnings || []);
      setRows(extraction.rows || []);

      if (!extraction.rows || extraction.rows.length === 0) {
        setErrorMsg(
          'No Spend, Leads, or Impressions rows were detected in that report. Upload a clearer PDF/image export or set a fallback month.'
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'OCR parsing failed. Please verify the file and try again.');
      setRows([]);
    } finally {
      setIsExtracting(false);
    }
  };

  const resetDropzone = () => {
    setRows([]);
    setWarnings([]);
    setReportTitle('');
    setCurrencyDetected('');
    setSourceSummary('');
    setErrorMsg(null);
    setPreviewUrl(null);
    setFileName('');
  };

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

  const selectedRows = rows.filter(r => r.selected);
  const invalidSelectedRows = selectedRows.filter(r => !/^\d{4}-\d{2}$/.test(r.monthKey.trim()));

  const handleCommitInline = () => {
    if (selectedRows.length === 0 || invalidSelectedRows.length > 0) return;
    const reportsToSave = selectedRows.map(row =>
      buildMetaAdReportFromOcrRow(row, existingReports, currentUser, {
        preserveExistingSales: true,
        sourceTitle: reportTitle || fileName || 'Meta Ads Report',
      })
    );
    const summary = `OCR imported ${reportsToSave.length} month(s) (${reportsToSave.map(r => r.monthKey).join(', ')}) from ${reportTitle || fileName || 'Meta Ads Report'}`;
    onCommitReports(reportsToSave, summary);
    setCommitSuccessMsg(
      `Populated ${reportsToSave.length} MetaAdMonthlyReport record${reportsToSave.length > 1 ? 's' : ''} (${reportsToSave.map(r => r.monthLabel).join(', ')}) with Spend, Leads & Impressions.`
    );
    resetDropzone();
    setTimeout(() => setCommitSuccessMsg(null), 8000);
  };

  return (
    <section className="bg-white rounded-2xl border border-[#D5E5DE] p-5 sm:p-6 space-y-4">
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#E2ECE7]">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E8F5EE] border border-[#C5E5D5] text-[#236B50] flex items-center justify-center shrink-0">
            <ScanText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#192A24] font-['Plus_Jakarta_Sans']">
              Meta Ads OCR Report Uploader
            </h2>
            <p className="text-xs text-[#5A6F66]">
              Drag and drop a PDF or image Meta Ads report to automatically extract Spend, Leads, and Impressions into monthly records.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto shrink-0">
          <div className="flex items-center gap-1.5 text-xs">
            <label htmlFor="ocr-fallback-month" className="text-[#5A6F66] font-semibold whitespace-nowrap">
              Fallback Month:
            </label>
            <input
              id="ocr-fallback-month"
              type="month"
              value={defaultMonthKey}
              onChange={(e) => setDefaultMonthKey(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-[#D5E5DE] bg-[#F8FAF9] text-xs font-mono font-bold text-[#192A24] focus:outline-none focus:border-[#236B50]"
            />
          </div>

          {onOpenFullModal && (
            <button
              type="button"
              onClick={onOpenFullModal}
              className="px-3.5 py-1.5 rounded-lg border border-[#D5E5DE] bg-[#F8FAF9] hover:bg-[#EBF3EF] text-[#192A24] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Maximize2 className="w-3.5 h-3.5 text-[#236B50]" />
              <span>Paste Text / Full Inspector</span>
            </button>
          )}
        </div>
      </div>

      {/* Commit Confirmation Banner */}
      {commitSuccessMsg && (
        <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 font-semibold flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{commitSuccessMsg}</span>
          </div>
          <div className="flex items-center gap-2">
            {canUndo && onUndoImport && (
              <button
                type="button"
                onClick={onUndoImport}
                className="px-3 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100 text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Undo Import</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setCommitSuccessMsg(null)}
              className="p-1 text-emerald-800 hover:text-emerald-950 cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Drag & Drop Target Zone */}
      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          const droppedFile = e.dataTransfer.files?.[0];
          if (droppedFile && !isExtracting) {
            handleFile(droppedFile);
          }
        }}
        onClick={() => !isExtracting && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isExtracting) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#236B50] ${
          isDragging
            ? 'border-[#236B50] bg-[#E8F5EE]'
            : 'border-[#C2D8CE] bg-[#F8FAF9] hover:border-[#236B50] hover:bg-[#F2F8F4]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.csv,.tsv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (picked) handleFile(picked);
            e.target.value = '';
          }}
        />

        {isExtracting ? (
          <div className="py-3 flex flex-col items-center gap-2">
            <RefreshCw className="w-7 h-7 text-[#236B50] animate-spin" />
            <p className="text-sm font-bold text-[#192A24]">
              Extracting Spend, Leads &amp; Impressions from {fileName}...
            </p>
            <p className="text-xs text-[#5A6F66]">
              Running OCR parser across document tables and verifying currency accuracy.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-3 text-[#236B50]">
              <Upload className="w-5 h-5" />
              <FileText className="w-5 h-5" />
              <ImageIcon className="w-5 h-5" />
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-[#192A24]">
              Drag and drop PDF or Image Meta Ads report here, or click to upload
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#5A6F66]">
              <span>PDF Reports</span>
              <span aria-hidden="true">·</span>
              <span>PNG / JPG / WEBP Screenshots</span>
              <span aria-hidden="true">·</span>
              <span>CSV / XLSX Exports</span>
            </div>
          </div>
        )}
      </div>

      {/* Error State */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-semibold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Extracted Verification & Direct Populate Panel */}
      {rows.length > 0 && (
        <div className="pt-2 space-y-4 border-t border-[#E2ECE7]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt={fileName || 'Meta Ads Report Preview'}
                  referrerPolicy="no-referrer"
                  className="w-20 h-14 object-cover rounded-lg border border-[#D5E5DE] bg-slate-50 shrink-0"
                />
              )}
              <div>
                <div className="text-sm font-extrabold text-[#192A24]">
                  {reportTitle}
                </div>
                <div className="text-xs text-[#5A6F66] flex flex-wrap items-center gap-2 mt-0.5">
                  <span>Detected Currency: <strong className="text-[#192A24]">{currencyDetected}</strong></span>
                  <span aria-hidden="true">·</span>
                  <span>{rows.length} month row{rows.length > 1 ? 's' : ''} extracted</span>
                  {sourceSummary && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{sourceSummary}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={resetDropzone}
              className="px-3 py-1.5 rounded-lg border border-[#D5E5DE] text-xs font-semibold text-[#5A6F66] hover:text-rose-700 hover:border-rose-200 flex items-center gap-1.5 cursor-pointer self-start md:self-auto shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Discard Extract</span>
            </button>
          </div>

          {warnings.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Verification Notes</span>
              </div>
              {warnings.map((w, i) => (
                <p key={i} className="text-[11px]">{w}</p>
              ))}
            </div>
          )}

          {/* Extracted Table focused on Spend, Leads, Impressions */}
          <div className="overflow-x-auto rounded-xl border border-[#D5E5DE]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#F4F8F6] text-[#486356] border-b border-[#D5E5DE] font-bold">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">Save</th>
                  <th className="py-2.5 px-3">Month</th>
                  <th className="py-2.5 px-3 text-right">Meta Ad Spend (AED)</th>
                  <th className="py-2.5 px-3 text-right">Leads</th>
                  <th className="py-2.5 px-3 text-right">Impressions</th>
                  <th className="py-2.5 px-3 text-right">Calc CPL</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2ECE7]">
                {rows.map(row => {
                  const validKey = /^\d{4}-\d{2}$/.test(row.monthKey.trim());
                  const existing = validKey
                    ? existingReports.find(r => r.monthKey === row.monthKey.trim())
                    : undefined;
                  const calcCpl = row.leadsGenerated > 0 ? row.adSpendAED / row.leadsGenerated : 0;

                  return (
                    <tr key={row.rowId} className={!row.selected ? 'bg-slate-50/70 opacity-60' : 'hover:bg-[#FAFDFB]'}>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(e) => updateRowField(row.rowId, 'selected', e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-[#236B50] focus:ring-[#236B50] cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={row.monthKey}
                          onChange={(e) => updateRowField(row.rowId, 'monthKey', e.target.value)}
                          placeholder="YYYY-MM"
                          className={`w-24 px-2 py-1 rounded-md border font-mono tabular-nums font-bold text-xs ${
                            validKey ? 'border-[#D5E5DE] bg-white text-[#192A24]' : 'border-rose-400 bg-rose-50 text-rose-900'
                          }`}
                        />
                        <span className="block text-[11px] text-[#5A6F66] mt-0.5">
                          {validKey ? getMonthLabelFromKey(row.monthKey.trim()) : 'Enter YYYY-MM'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.adSpendAED}
                          onChange={(e) => updateRowField(row.rowId, 'adSpendAED', parseFloat(e.target.value) || 0)}
                          className="w-28 px-2 py-1 rounded-md border border-[#D5E5DE] font-mono tabular-nums font-bold text-right text-[#192A24] bg-white text-xs"
                        />
                        {existing && (
                          <span className="block text-[10px] text-[#5A6F66] font-mono tabular-nums mt-0.5">
                            Was {formatCurrency(existing.adSpendAED)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          value={row.leadsGenerated}
                          onChange={(e) => updateRowField(row.rowId, 'leadsGenerated', parseInt(e.target.value, 10) || 0)}
                          className="w-20 px-2 py-1 rounded-md border border-[#D5E5DE] font-mono tabular-nums font-bold text-right text-[#192A24] bg-white text-xs"
                        />
                        {existing && (
                          <span className="block text-[10px] text-[#5A6F66] font-mono tabular-nums mt-0.5">
                            Was {existing.leadsGenerated.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          value={row.impressions}
                          onChange={(e) => updateRowField(row.rowId, 'impressions', parseInt(e.target.value, 10) || 0)}
                          className="w-28 px-2 py-1 rounded-md border border-[#D5E5DE] font-mono tabular-nums font-bold text-right text-[#192A24] bg-white text-xs"
                        />
                        {existing && existing.impressions > 0 && (
                          <span className="block text-[10px] text-[#5A6F66] font-mono tabular-nums mt-0.5">
                            Was {existing.impressions.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-[#192A24]">
                        {calcCpl > 0 ? `AED ${calcCpl.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`text-[11px] font-bold ${
                          !validKey
                            ? 'text-rose-700'
                            : existing
                            ? 'text-amber-800'
                            : 'text-[#236B50]'
                        }`}>
                          {!validKey ? 'Month Missing' : existing ? 'Updates Record' : 'New Record'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <p className="text-xs text-[#5A6F66]">
              Existing banquet sales and bookings for matched months are preserved automatically.
            </p>
            <button
              type="button"
              disabled={selectedRows.length === 0 || invalidSelectedRows.length > 0}
              onClick={handleCommitInline}
              className="px-5 py-2.5 rounded-xl bg-[#236B50] hover:bg-[#1B553F] disabled:opacity-45 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Check className="w-4 h-4" />
              <span>
                Populate {selectedRows.length} Monthly Record{selectedRows.length !== 1 ? 's' : ''}
              </span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
