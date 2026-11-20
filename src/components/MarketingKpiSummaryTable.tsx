import React, { useState, useMemo } from 'react';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Download, 
  Filter, 
  Calendar, 
  DollarSign, 
  Target, 
  Percent, 
  FileText,
  Sparkles,
  TrendingUp,
  BarChart2
} from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/costCalculations';
import { MonthlyComparativeMetric } from './MarketingRoasBarChart';

interface MarketingKpiSummaryTableProps {
  data: MonthlyComparativeMetric[];
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
}

type SortField = 'monthKey' | 'adSpendAED' | 'leadsGenerated' | 'conversionRate' | 'cpr' | 'totalBanquetRevenue' | 'roas' | 'cac' | 'netProfitAfterMarketing';

export const MarketingKpiSummaryTable: React.FC<MarketingKpiSummaryTableProps> = ({
  data,
  selectedMonthKey,
  onSelectMonth,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('monthKey');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Filtered by search term
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchMonth = item.monthLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.monthKey.toLowerCase().includes(searchTerm.toLowerCase());
      return matchMonth;
    });
  }, [data, searchTerm]);

  // Sorted data
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [filteredData, sortField, sortOrder]);

  // Paginated chunk
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

  // Handle sort column click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  // Render sort icon helper
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 inline ml-1 transition-colors" />;
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="w-3.5 h-3.5 text-[#236B50] inline ml-1 font-bold" />
      : <ArrowDown className="w-3.5 h-3.5 text-[#236B50] inline ml-1 font-bold" />;
  };

  // Export CSV helper
  const handleExportCsv = () => {
    const headers = ['Month', 'Total Marketing Spend (AED)', 'Leads Generated', 'Conversion Rate (%)', 'CPR (Cost Per Result AED)', 'Resulting Banquet Revenue (AED)', 'ROAS Multiplier', 'Parties Booked', 'CAC Per Party (AED)', 'Net Return After Ads (AED)'];
    const rows = sortedData.map(d => [
      `"${d.monthLabel}"`,
      d.adSpendAED.toFixed(2),
      d.leadsGenerated,
      `${d.conversionRate.toFixed(2)}%`,
      d.cpr.toFixed(2),
      d.totalBanquetRevenue.toFixed(2),
      `${d.roas.toFixed(2)}x`,
      d.bookingsCount,
      d.cac.toFixed(2),
      d.netProfitAfterMarketing.toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Crystal_Plaza_Marketing_KPI_Summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 sm:p-7 shadow-xs space-y-5 font-['Plus_Jakarta_Sans']">
      {/* Table Header with Search & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-[#E2ECE7] gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#236B50] text-xs font-black uppercase tracking-wider">
            <FileText className="w-4 h-4" />
            <span>Monthly Performance Metrics Grid</span>
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold text-[#192A24] mt-0.5 tracking-tight">
            Marketing Performance & Banquet Revenue Summary Table
          </h3>
          <p className="text-xs text-[#5A6F66] mt-0.5">
            Sortable, paginated audit ledger of Monthly Spend, Leads, Conversion Rate, CPR, and Resulting Banquet Revenue.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search month (e.g. October)..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#F6FAF8] border border-[#D5E5DE] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#192A24] font-medium focus:outline-none focus:border-[#236B50]"
            />
          </div>

          {/* Export CSV button */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-1.5 rounded-xl bg-[#F4F8F6] hover:bg-[#E8F2EC] text-[#236B50] border border-[#D5E5DE] text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            title="Download full sortable grid as CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Sortable Table Container */}
      <div className="overflow-x-auto rounded-2xl border border-[#D5E5DE] shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F8FAF9] text-[#3D5A4E] border-b border-[#E2ECE7] font-extrabold select-none">
            <tr>
              {/* 1. Month */}
              <th 
                onClick={() => handleSort('monthKey')}
                className="py-3.5 px-4 cursor-pointer hover:bg-[#EBF3EF] transition-colors group"
              >
                <div className="flex items-center space-x-1">
                  <span>Month / Period</span>
                  {renderSortIcon('monthKey')}
                </div>
              </th>

              {/* 2. Total Marketing Spend */}
              <th 
                onClick={() => handleSort('adSpendAED')}
                className="py-3.5 px-4 cursor-pointer hover:bg-[#EBF3EF] transition-colors group"
              >
                <div className="flex items-center space-x-1">
                  <span>Spend (AED)</span>
                  {renderSortIcon('adSpendAED')}
                </div>
              </th>

              {/* 3. Leads Generated */}
              <th 
                onClick={() => handleSort('leadsGenerated')}
                className="py-3.5 px-4 cursor-pointer hover:bg-[#EBF3EF] transition-colors group"
              >
                <div className="flex items-center space-x-1">
                  <span>Leads Generated</span>
                  {renderSortIcon('leadsGenerated')}
                </div>
              </th>

              {/* 4. Conversion Rate */}
              <th 
                onClick={() => handleSort('conversionRate')}
                className="py-3.5 px-4 cursor-pointer hover:bg-[#EBF3EF] transition-colors group"
              >
                <div className="flex items-center space-x-1">
                  <span>Conversion Rate</span>
                  {renderSortIcon('conversionRate')}
                </div>
              </th>

              {/* 5. CPR */}
              <th 
                onClick={() => handleSort('cpr')}
                className="py-3.5 px-4 cursor-pointer hover:bg-[#EBF3EF] transition-colors group"
              >
                <div className="flex items-center space-x-1">
                  <span>CPR (Cost / Lead)</span>
                  {renderSortIcon('cpr')}
                </div>
              </th>

              {/* 6. Resulting Banquet Revenue */}
              <th 
                onClick={() => handleSort('totalBanquetRevenue')}
                className="py-3.5 px-4 cursor-pointer hover:bg-[#EBF3EF] transition-colors group"
              >
                <div className="flex items-center space-x-1 text-[#236B50]">
                  <span>Resulting Banquet Revenue</span>
                  {renderSortIcon('totalBanquetRevenue')}
                </div>
              </th>

              {/* 7. ROAS */}
              <th 
                onClick={() => handleSort('roas')}
                className="py-3.5 px-4 cursor-pointer hover:bg-[#EBF3EF] transition-colors group"
              >
                <div className="flex items-center space-x-1">
                  <span>ROAS Multiplier</span>
                  {renderSortIcon('roas')}
                </div>
              </th>

              {/* 8. Net Return After Ads */}
              <th 
                onClick={() => handleSort('netProfitAfterMarketing')}
                className="py-3.5 px-4 text-right cursor-pointer hover:bg-[#EBF3EF] transition-colors group"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Net Return After Ads</span>
                  {renderSortIcon('netProfitAfterMarketing')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2ECE7]">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  No monthly performance records matching "{searchTerm}".
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => {
                const isSelected = selectedMonthKey === row.monthKey;
                return (
                  <tr
                    key={row.monthKey}
                    onClick={() => onSelectMonth(row.monthKey)}
                    className={`hover:bg-[#FAFDFB] transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#EBF5F0]/70 font-semibold' : ''
                    }`}
                  >
                    {/* Month */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-[#192A24]">{row.monthLabel}</span>
                        {row.monthKey === '2026-08' && (
                          <span className="px-1.5 py-0.5 rounded bg-[#236B50] text-white text-[9px] font-black uppercase">
                            Latest
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#5A6F66] block">
                        {row.bookingsCount} Confirmed Parties ({row.finishedCount} finished, {row.upcomingCount} booked)
                      </span>
                    </td>

                    {/* Spend */}
                    <td className="py-3.5 px-4 font-black text-amber-800">
                      {row.adSpendAED > 0 ? formatCurrency(row.adSpendAED) : '—'}
                    </td>

                    {/* Leads */}
                    <td className="py-3.5 px-4 font-bold text-[#192A24]">
                      {row.leadsGenerated > 0 ? `${row.leadsGenerated} Inquiries` : '—'}
                    </td>

                    {/* Conversion Rate */}
                    <td className="py-3.5 px-4">
                      {row.leadsGenerated > 0 ? (
                        <span className="font-black text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full text-[11px]">
                          {row.conversionRate.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-slate-400 font-semibold">—</span>
                      )}
                    </td>

                    {/* CPR */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                      {row.cpr > 0 ? `AED ${row.cpr.toFixed(2)}` : '—'}
                    </td>

                    {/* Resulting Banquet Revenue */}
                    <td className="py-3.5 px-4 font-black text-[#236B50] text-sm">
                      {row.totalBanquetRevenue > 0 ? formatCurrency(row.totalBanquetRevenue) : '—'}
                    </td>

                    {/* ROAS */}
                    <td className="py-3.5 px-4">
                      {row.adSpendAED > 0 ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-[#1D6047] font-black text-[11px] border border-emerald-300">
                          {row.roas.toFixed(2)}x
                        </span>
                      ) : (
                        <span className="text-slate-400 font-semibold">—</span>
                      )}
                    </td>

                    {/* Net Return After Ads */}
                    <td className={`py-3.5 px-4 text-right font-black ${
                      row.netProfitAfterMarketing >= 0 ? 'text-[#236B50]' : 'text-rose-700'
                    }`}>
                      {row.netProfitAfterMarketing >= 0
                        ? `+${formatCurrency(row.netProfitAfterMarketing)}`
                        : formatCurrency(row.netProfitAfterMarketing)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 gap-3 text-xs">
        {/* Count overview */}
        <div className="text-[#5A6F66]">
          Showing <strong className="text-[#192A24]">{sortedData.length === 0 ? 0 : startIndex + 1}</strong> to <strong className="text-[#192A24]">{Math.min(startIndex + pageSize, sortedData.length)}</strong> of <strong className="text-[#192A24]">{sortedData.length}</strong> months
        </div>

        {/* Page size & Navigation */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] text-[#5A6F66]">Per Page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-[#D5E5DE] rounded-lg px-2 py-1 text-xs text-[#192A24] font-bold focus:outline-none focus:border-[#236B50] cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
            </select>
          </div>

          <div className="flex items-center space-x-1">
            <button
              type="button"
              disabled={activePage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className={`p-1.5 rounded-lg border transition-all ${
                activePage <= 1
                  ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                  : 'bg-white hover:bg-[#EBF3EF] border-[#D5E5DE] text-[#192A24] cursor-pointer shadow-2xs'
              }`}
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
              <button
                key={`page_${pageNum}`}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                className={`w-7 h-7 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  activePage === pageNum
                    ? 'bg-[#236B50] text-white shadow-xs'
                    : 'bg-white hover:bg-[#EBF3EF] text-[#192A24] border border-[#D5E5DE]'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              type="button"
              disabled={activePage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className={`p-1.5 rounded-lg border transition-all ${
                activePage >= totalPages
                  ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                  : 'bg-white hover:bg-[#EBF3EF] border-[#D5E5DE] text-[#192A24] cursor-pointer shadow-2xs'
              }`}
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
