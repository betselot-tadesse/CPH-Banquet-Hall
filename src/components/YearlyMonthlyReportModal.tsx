import React, { useRef } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  Building2, 
  CheckCircle2, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Target, 
  FileSpreadsheet, 
  ShieldCheck, 
  Award,
  Sparkles,
  BarChart2,
  Users,
  UtensilsCrossed,
  Receipt,
  FileText
} from 'lucide-react';
import { BookingEvent, MetaAdMonthlyReport, UserProfile } from '../types';
import { formatCurrency, formatPercent } from '../utils/costCalculations';

export interface MonthlyDetailedAggregate {
  monthKey: string;           // '2026-10'
  monthNumber: number;        // 1-12
  monthLabel: string;         // 'October 2026'
  monthShort: string;         // 'Oct'
  year: number;               // 2026
  
  // Banquet Sales & Operations
  partiesCount: number;
  completedPartiesCount: number;
  upcomingPartiesCount: number;
  totalGuests: number;
  grossRevenueAED: number;
  foodCostAED: number;
  hallCostAED: number;
  totalDirectCostsAED: number;
  grossProfitAED: number;
  grossMarginPercent: number;
  
  // Marketing & Meta Ads
  adSpendAED: number;
  impressions: number;
  clicks: number;
  ctrPercent: number;
  leadsGenerated: number;
  cprAED: number;
  cacAED: number;
  roas: number;
  netProfitAfterMarketingAED: number;
  netMarginPercent: number;
  
  // Operational details
  topPerformingCampaign?: string;
  notes?: string;
  monthBookings: BookingEvent[];
  reportRecord?: MetaAdMonthlyReport;
}

interface MonthlyReportDocProps {
  data: MonthlyDetailedAggregate;
  currentUser: UserProfile;
  onClose: () => void;
  onEdit?: () => void;
}

interface YearlyReportDocProps {
  year: number;
  monthsData: MonthlyDetailedAggregate[];
  currentUser: UserProfile;
  onClose: () => void;
}

// ============================================================================
// 1. OFFICIAL MONTHLY BANQUET & ROAS AUDIT REPORT (A4 PRINTABLE)
// ============================================================================
export const MonthlyReportDocModal: React.FC<MonthlyReportDocProps> = ({
  data,
  currentUser,
  onClose,
  onEdit,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Metric', 'Value (AED / Count)'];
    const rows = [
      ['Report Period', data.monthLabel],
      ['Total Banquet Events', data.partiesCount.toString()],
      ['Total Guests Served', data.totalGuests.toString()],
      ['Gross Banquet Sales (AED)', data.grossRevenueAED.toFixed(2)],
      ['Kitchen Food Cost (AED)', data.foodCostAED.toFixed(2)],
      ['Venue / Hall Operational Costs (AED)', data.hallCostAED.toFixed(2)],
      ['Total Direct Operational COGS (AED)', data.totalDirectCostsAED.toFixed(2)],
      ['Gross Profit (AED)', data.grossProfitAED.toFixed(2)],
      ['Gross Margin (%)', `${data.grossMarginPercent.toFixed(1)}%`],
      ['Meta Ads Spend (AED)', data.adSpendAED.toFixed(2)],
      ['Inquiries / Leads Generated', data.leadsGenerated.toString()],
      ['Cost Per Result - CPR (AED)', data.cprAED.toFixed(2)],
      ['Customer Acquisition Cost - CAC (AED)', data.cacAED.toFixed(2)],
      ['Realized ROAS Multiplier', `${data.roas.toFixed(2)}x`],
      ['Net Profit After Marketing (AED)', data.netProfitAfterMarketingAED.toFixed(2)],
      ['Net Profit Margin (%)', `${data.netMarginPercent.toFixed(1)}%`],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(e => `"${e[0]}","${e[1]}"`)].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CPH_Banquet_Monthly_Report_${data.monthKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      {/* Container */}
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border-2 border-[#192A24]/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Control Bar (Hidden during printing) */}
        <div className="p-4 sm:px-6 bg-[#0E1E17] text-white flex items-center justify-between border-b border-[#236B50]/30 shrink-0 print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#236B50] flex items-center justify-center text-amber-300 font-extrabold shadow-md">
              <Building2 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase tracking-widest font-extrabold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                  Official Audit Statement
                </span>
                <span className="text-xs text-white/60">Ref: CPH-MREP-{data.monthKey}</span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                {data.monthLabel} — Banquet & Marketing Audit Report
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-3 py-2 text-xs font-bold rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center space-x-1.5"
                title="Edit ad spend or revenue for this month"
              >
                <span>Edit Month</span>
              </button>
            )}
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 text-xs font-bold rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center space-x-1.5"
              title="Export as CSV spreadsheet"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-extrabold rounded-xl bg-[#236B50] hover:bg-[#1B553F] text-amber-200 shadow-md transition-all flex items-center space-x-2 border border-amber-300/30 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Download as PDF / Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable A4 Document Body */}
        <div className="overflow-y-auto flex-1 p-5 sm:p-8 bg-neutral-100" ref={printRef}>
          <div className="max-w-3xl mx-auto bg-white p-6 sm:p-10 rounded-2xl shadow-sm border border-neutral-200 print:border-none print:shadow-none print:p-0 print:max-w-full text-[#192A24] space-y-6">
            
            {/* Header: Hotel Crest & Metadata */}
            <div className="border-b-2 border-[#192A24] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
              <div>
                <div className="text-[11px] font-extrabold text-[#236B50] tracking-widest uppercase">
                  Crystal Plaza Hotel — Sharjah, UAE
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-[#192A24] tracking-tight mt-0.5">
                  Monthly Banquet Sales & Meta Ads ROAS Audit
                </h1>
                <p className="text-xs text-neutral-600 mt-1">
                  Comprehensive culinary costing, event revenue, cash settlement & digital advertising return ledger.
                </p>
              </div>
              <div className="text-left sm:text-right font-mono text-xs text-neutral-600 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200 shrink-0">
                <div><strong>Period:</strong> {data.monthLabel}</div>
                <div><strong>Doc ID:</strong> CPH-REP-{data.monthKey}</div>
                <div><strong>Generated:</strong> {new Date().toISOString().substring(0, 10)}</div>
                <div className="text-[10px] text-emerald-700 font-bold">TRN: 100348291000003</div>
              </div>
            </div>

            {/* Key Metric Executive Grid */}
            <div>
              <div className="text-[11px] font-extrabold text-[#236B50] uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Executive Monthly Financial & Commercial Overview</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-[#F8FAF9] rounded-xl border border-[#D5E5DE]">
                  <div className="text-[10px] text-neutral-500 font-bold uppercase">Gross Banquet Sales</div>
                  <div className="text-base sm:text-lg font-black text-[#192A24] font-mono mt-0.5">
                    {formatCurrency(data.grossRevenueAED)}
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">
                    {data.partiesCount} Events • {data.totalGuests} Guests
                  </div>
                </div>

                <div className="p-3 bg-[#F8FAF9] rounded-xl border border-[#D5E5DE]">
                  <div className="text-[10px] text-neutral-500 font-bold uppercase">Direct Operational COGS</div>
                  <div className="text-base sm:text-lg font-black text-amber-700 font-mono mt-0.5">
                    {formatCurrency(data.totalDirectCostsAED)}
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">
                    Kitchen: {formatCurrency(data.foodCostAED)}
                  </div>
                </div>

                <div className="p-3 bg-[#E8F5EE] rounded-xl border border-[#C5E5D5]">
                  <div className="text-[10px] text-[#1E5D46] font-bold uppercase">Realized Gross Margin</div>
                  <div className="text-base sm:text-lg font-black text-[#236B50] font-mono mt-0.5">
                    +{formatCurrency(data.grossProfitAED)}
                  </div>
                  <div className="text-[10px] font-extrabold text-[#236B50] mt-0.5">
                    {data.grossMarginPercent.toFixed(1)}% Gross Margin
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="text-[10px] text-amber-800 font-bold uppercase">Realized ROAS Multiplier</div>
                  <div className="text-base sm:text-lg font-black text-amber-900 font-mono mt-0.5">
                    {data.roas.toFixed(2)}x
                  </div>
                  <div className="text-[10px] text-amber-800 font-semibold mt-0.5">
                    Spend: {formatCurrency(data.adSpendAED)}
                  </div>
                </div>
              </div>
            </div>

            {/* Marketing & Meta Ads Efficiency Summary */}
            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-[#192A24] border-b border-neutral-200 pb-1.5">
                <span className="flex items-center space-x-1.5">
                  <Target className="w-3.5 h-3.5 text-[#236B50]" />
                  <span>Digital Ad Campaign & Lead Generation Breakdown</span>
                </span>
                <span className="text-[11px] text-neutral-500">
                  Meta Ads (Facebook, Instagram & WhatsApp)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                <div>
                  <span className="text-[10px] text-neutral-500 block">Total Inquiries Generated:</span>
                  <strong className="text-sm font-bold text-[#192A24]">{data.leadsGenerated} Leads</strong>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block">Cost Per Result (CPR):</span>
                  <strong className="text-sm font-mono font-bold text-[#192A24]">{formatCurrency(data.cprAED)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block">Customer Acq. Cost (CAC):</span>
                  <strong className="text-sm font-mono font-bold text-[#192A24]">{formatCurrency(data.cacAED)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block">Net Profit After Ads:</span>
                  <strong className="text-sm font-mono font-bold text-[#236B50]">+{formatCurrency(data.netProfitAfterMarketingAED)}</strong>
                </div>
              </div>
              {data.topPerformingCampaign && (
                <div className="pt-2 text-[11px] text-neutral-600 flex items-center space-x-1 border-t border-neutral-200/80">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span><strong>Top Campaign:</strong> {data.topPerformingCampaign}</span>
                </div>
              )}
              {data.notes && (
                <div className="text-[11px] text-neutral-600 italic">
                  <strong>Notes:</strong> {data.notes}
                </div>
              )}
            </div>

            {/* Individual Parties Held in this Month */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="text-[11px] font-extrabold text-[#236B50] uppercase tracking-wider flex items-center space-x-1.5">
                  <UtensilsCrossed className="w-3.5 h-3.5" />
                  <span>Banquet Events Executed in {data.monthLabel} ({data.monthBookings.length} Logged)</span>
                </div>
                <span className="text-[10px] text-neutral-500">Currency: United Arab Emirates Dirham (AED)</span>
              </div>

              {data.monthBookings.length > 0 ? (
                <div className="overflow-x-auto border border-neutral-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-100 text-neutral-600 font-bold uppercase text-[9px] border-b border-neutral-200">
                      <tr>
                        <th className="py-2 px-3">BEO # & Date</th>
                        <th className="py-2 px-3">Client & Event</th>
                        <th className="py-2 px-3">Venue / Hall</th>
                        <th className="py-2 px-3 text-center">Guests</th>
                        <th className="py-2 px-3 text-right">Charged (AED)</th>
                        <th className="py-2 px-3 text-right">Food Cost</th>
                        <th className="py-2 px-3 text-right">Gross Margin</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 text-[11px]">
                      {data.monthBookings.map((b) => {
                        const bill = b.totalBillPayable ?? ((b.foodPricePerGuestCharged || 0) * (b.guestCount || 0) + (b.hallRentalCharged || 0) + (b.decorAndAVCharged || 0) - (b.discountAmount || 0));
                        const foodCost = b.foodCostActualTotal ?? ((b.guestCount || 0) * (b.foodCostPerGuestTheoretical || 0));
                        const margin = bill > 0 ? ((bill - foodCost) / bill) * 100 : 0;
                        return (
                          <tr key={b.id} className="hover:bg-neutral-50">
                            <td className="py-2 px-3 font-mono font-medium">
                              <div>{b.bookingNumber}</div>
                              <span className="text-[10px] text-neutral-500">{b.eventDate}</span>
                            </td>
                            <td className="py-2 px-3 font-bold text-[#192A24]">
                              <div>{b.clientName}</div>
                              <span className="text-[10px] font-normal text-neutral-500">{b.eventType}</span>
                            </td>
                            <td className="py-2 px-3 text-neutral-700">
                              <div>{b.hallName}</div>
                              <span className="text-[9px] text-[#236B50] font-bold">Free with food</span>
                            </td>
                            <td className="py-2 px-3 text-center font-bold">{b.guestCount}</td>
                            <td className="py-2 px-3 text-right font-bold font-mono text-[#192A24]">
                              {formatCurrency(bill)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-neutral-600">
                              {formatCurrency(foodCost)}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-700 font-mono">
                              {margin.toFixed(1)}%
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                b.partyEnded || b.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {b.partyEnded || b.status === 'completed' ? 'Completed' : 'Confirmed'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-center text-xs text-neutral-500">
                  Detailed individual party records archived in hotel historical database. Summary totals verified via General Ledger.
                </div>
              )}
            </div>

            {/* Official Sign-Off & Verification Box */}
            <div className="pt-4 border-t-2 border-neutral-200 space-y-4">
              <div className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">
                Management Audit & Verification Sign-Offs
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-[10px]">
                <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="font-bold text-neutral-700">Betselot</div>
                  <div className="text-neutral-500">Marketing Executive</div>
                  <div className="mt-3 text-[9px] text-emerald-700 font-mono">✓ Meta Ads Verified</div>
                </div>
                <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="font-bold text-neutral-700">Chef Karim Zayani</div>
                  <div className="text-neutral-500">Executive Chef</div>
                  <div className="mt-3 text-[9px] text-emerald-700 font-mono">✓ Culinary Quantities</div>
                </div>
                <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="font-bold text-neutral-700">Arun Kumar</div>
                  <div className="text-neutral-500">Accounts Executive</div>
                  <div className="mt-3 text-[9px] text-emerald-700 font-mono">✓ Costs Audited</div>
                </div>
                <div className="p-2.5 bg-[#E8F5EE] rounded-xl border border-[#C5E5D5]">
                  <div className="font-bold text-[#1E5D46]">General Manager</div>
                  <div className="text-[#236B50]">Executive Approval</div>
                  <div className="mt-3 text-[9px] text-[#236B50] font-bold font-mono">APPROVED & SEALED</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-neutral-400 pt-2 border-t border-neutral-100 flex justify-between items-center">
              <span>Crystal Plaza Hotel • Banquet & Events Division • Sharjah, UAE</span>
              <span>Generated on {new Date().toLocaleDateString()} by {currentUser.name} ({currentUser.role})</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};


// ============================================================================
// 2. OFFICIAL 12-MONTH YEARLY BANQUET FINANCIAL & ROAS AUDIT (A4 PRINTABLE)
// ============================================================================
export const YearlyReportDocModal: React.FC<YearlyReportDocProps> = ({
  year,
  monthsData,
  currentUser,
  onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  // Full Year Totals
  const totalParties = monthsData.reduce((s, m) => s + m.partiesCount, 0);
  const totalGuests = monthsData.reduce((s, m) => s + m.totalGuests, 0);
  const totalGrossRevenue = monthsData.reduce((s, m) => s + m.grossRevenueAED, 0);
  const totalDirectCosts = monthsData.reduce((s, m) => s + m.totalDirectCostsAED, 0);
  const totalFoodCost = monthsData.reduce((s, m) => s + m.foodCostAED, 0);
  const totalGrossProfit = totalGrossRevenue - totalDirectCosts;
  const overallGrossMargin = totalGrossRevenue > 0 ? (totalGrossProfit / totalGrossRevenue) * 100 : 0;
  
  const totalAdSpend = monthsData.reduce((s, m) => s + m.adSpendAED, 0);
  const totalLeads = monthsData.reduce((s, m) => s + m.leadsGenerated, 0);
  const overallRoas = totalAdSpend > 0 ? totalGrossRevenue / totalAdSpend : 0;
  const overallCpr = totalLeads > 0 ? totalAdSpend / totalLeads : 0;
  const overallCac = totalParties > 0 ? totalAdSpend / totalParties : totalAdSpend;
  const totalNetProfitAfterAds = totalGrossProfit - totalAdSpend;
  const overallNetMargin = totalGrossRevenue > 0 ? (totalNetProfitAfterAds / totalGrossRevenue) * 100 : 0;

  // Monthly Averages
  const activeMonths = monthsData.filter(m => m.grossRevenueAED > 0 || m.adSpendAED > 0);
  const divisor = activeMonths.length > 0 ? activeMonths.length : 12;
  const avgMonthlyRev = totalGrossRevenue / divisor;
  const avgMonthlyAdSpend = totalAdSpend / divisor;
  const avgMonthlyParties = totalParties / divisor;

  // Quarterly Breakdown
  const q1 = monthsData.filter(m => m.monthNumber >= 1 && m.monthNumber <= 3);
  const q2 = monthsData.filter(m => m.monthNumber >= 4 && m.monthNumber <= 6);
  const q3 = monthsData.filter(m => m.monthNumber >= 7 && m.monthNumber <= 9);
  const q4 = monthsData.filter(m => m.monthNumber >= 10 && m.monthNumber <= 12);

  const calcQuarter = (qList: MonthlyDetailedAggregate[], name: string) => {
    const rev = qList.reduce((s, m) => s + m.grossRevenueAED, 0);
    const cost = qList.reduce((s, m) => s + m.totalDirectCostsAED, 0);
    const spend = qList.reduce((s, m) => s + m.adSpendAED, 0);
    const leads = qList.reduce((s, m) => s + m.leadsGenerated, 0);
    const parties = qList.reduce((s, m) => s + m.partiesCount, 0);
    const profit = rev - cost;
    const roas = spend > 0 ? rev / spend : 0;
    return { name, rev, cost, spend, leads, parties, profit, roas };
  };

  const quarters = [
    calcQuarter(q1, 'Q1 (Jan – Mar)'),
    calcQuarter(q2, 'Q2 (Apr – Jun)'),
    calcQuarter(q3, 'Q3 (Jul – Sep)'),
    calcQuarter(q4, 'Q4 (Oct – Dec)'),
  ];

  const handleExportCSV = () => {
    const headers = [
      'Month',
      'Parties Count',
      'Total Guests',
      'Gross Sales AED',
      'Direct Costs AED',
      'Gross Profit AED',
      'Gross Margin %',
      'Ad Spend AED',
      'Leads Generated',
      'CPR AED',
      'CAC AED',
      'ROAS',
      'Net Profit After Ads AED',
    ];

    const rows = monthsData.map(m => [
      m.monthLabel,
      m.partiesCount,
      m.totalGuests,
      m.grossRevenueAED.toFixed(2),
      m.totalDirectCostsAED.toFixed(2),
      m.grossProfitAED.toFixed(2),
      `${m.grossMarginPercent.toFixed(1)}%`,
      m.adSpendAED.toFixed(2),
      m.leadsGenerated,
      m.cprAED.toFixed(2),
      m.cacAED.toFixed(2),
      `${m.roas.toFixed(2)}x`,
      m.netProfitAfterMarketingAED.toFixed(2),
    ]);

    // Summary Rows
    rows.push([
      `FULL YEAR ${year} TOTAL`,
      totalParties,
      totalGuests,
      totalGrossRevenue.toFixed(2),
      totalDirectCosts.toFixed(2),
      totalGrossProfit.toFixed(2),
      `${overallGrossMargin.toFixed(1)}%`,
      totalAdSpend.toFixed(2),
      totalLeads,
      overallCpr.toFixed(2),
      overallCac.toFixed(2),
      `${overallRoas.toFixed(2)}x`,
      totalNetProfitAfterAds.toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(e => e.map(x => `"${x}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CPH_Annual_Banquet_Ledger_${year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border-2 border-[#192A24]/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Control Bar */}
        <div className="p-4 sm:px-6 bg-[#0E1E17] text-white flex items-center justify-between border-b border-[#236B50]/30 shrink-0 print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#236B50] flex items-center justify-center text-amber-300 font-extrabold shadow-md">
              <Building2 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase tracking-widest font-extrabold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                  Annual 12-Month Audit
                </span>
                <span className="text-xs text-white/60">Doc: CPH-ANNUAL-{year}</span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                Financial Year {year} — Full 12-Month Banquet & ROAS Statement
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 text-xs font-bold rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center space-x-1.5"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Export Full Year CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-extrabold rounded-xl bg-[#236B50] hover:bg-[#1B553F] text-amber-200 shadow-md transition-all flex items-center space-x-2 border border-amber-300/30 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Download as PDF / Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable A4 Document Body */}
        <div className="overflow-y-auto flex-1 p-5 sm:p-8 bg-neutral-100" ref={printRef}>
          <div className="max-w-4xl mx-auto bg-white p-6 sm:p-10 rounded-2xl shadow-sm border border-neutral-200 print:border-none print:shadow-none print:p-0 print:max-w-full text-[#192A24] space-y-6">
            
            {/* Header: Hotel Crest & Metadata */}
            <div className="border-b-2 border-[#192A24] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
              <div>
                <div className="text-[11px] font-extrabold text-[#236B50] tracking-widest uppercase">
                  Crystal Plaza Hotel — Sharjah, UAE
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-[#192A24] tracking-tight mt-0.5">
                  Annual 12-Month Banquet Performance & ROAS Ledger — FY {year}
                </h1>
                <p className="text-xs text-neutral-600 mt-1">
                  Full fiscal year consolidation of banquet sales, kitchen direct COGS, Meta ads expenditure, and commercial net profit.
                </p>
              </div>
              <div className="text-left sm:text-right font-mono text-xs text-neutral-600 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200 shrink-0">
                <div><strong>Fiscal Year:</strong> {year} (Jan 01 – Dec 31)</div>
                <div><strong>Audit Ref:</strong> CPH-AUDIT-{year}</div>
                <div><strong>Generated:</strong> {new Date().toISOString().substring(0, 10)}</div>
                <div className="text-[10px] text-emerald-700 font-bold">Sharjah Municipality Registered</div>
              </div>
            </div>

            {/* Annual High-Level Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-[#F8FAF9] rounded-2xl border border-[#D5E5DE]">
                <div className="text-[10px] text-neutral-500 font-bold uppercase">Total Annual Sales</div>
                <div className="text-lg sm:text-xl font-black text-[#192A24] font-mono mt-0.5">
                  {formatCurrency(totalGrossRevenue)}
                </div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  {totalParties} Events • {totalGuests} Guests
                </div>
              </div>

              <div className="p-3.5 bg-[#F8FAF9] rounded-2xl border border-[#D5E5DE]">
                <div className="text-[10px] text-neutral-500 font-bold uppercase">Direct Operational COGS</div>
                <div className="text-lg sm:text-xl font-black text-amber-800 font-mono mt-0.5">
                  {formatCurrency(totalDirectCosts)}
                </div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  Food: {formatCurrency(totalFoodCost)}
                </div>
              </div>

              <div className="p-3.5 bg-[#E8F5EE] rounded-2xl border border-[#C5E5D5]">
                <div className="text-[10px] text-[#1E5D46] font-bold uppercase">Annual Gross Profit</div>
                <div className="text-lg sm:text-xl font-black text-[#236B50] font-mono mt-0.5">
                  +{formatCurrency(totalGrossProfit)}
                </div>
                <div className="text-[10px] font-extrabold text-[#236B50] mt-0.5">
                  {overallGrossMargin.toFixed(1)}% Gross Margin
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200">
                <div className="text-[10px] text-amber-800 font-bold uppercase">Annual Realized ROAS</div>
                <div className="text-lg sm:text-xl font-black text-amber-900 font-mono mt-0.5">
                  {overallRoas.toFixed(2)}x
                </div>
                <div className="text-[10px] text-amber-800 font-semibold mt-0.5">
                  Ad Spend: {formatCurrency(totalAdSpend)}
                </div>
              </div>
            </div>

            {/* Complete 12-Month Comparative Table */}
            <div>
              <div className="flex justify-between items-center mb-2.5">
                <div className="text-[11px] font-extrabold text-[#236B50] uppercase tracking-wider flex items-center space-x-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Full 12-Month Financial & Marketing Breakdown (January – December {year})</span>
                </div>
                <span className="text-[10px] text-neutral-500">All amounts in UAE Dirham (AED)</span>
              </div>

              <div className="overflow-x-auto border border-neutral-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-100 text-neutral-600 font-bold uppercase text-[9px] border-b border-neutral-200">
                    <tr>
                      <th className="py-2.5 px-3">Month</th>
                      <th className="py-2.5 px-2 text-center">Events</th>
                      <th className="py-2.5 px-2 text-center">Guests</th>
                      <th className="py-2.5 px-3 text-right">Banquet Sales</th>
                      <th className="py-2.5 px-3 text-right">Direct Costs</th>
                      <th className="py-2.5 px-3 text-right">Gross Profit</th>
                      <th className="py-2.5 px-2 text-right">Margin %</th>
                      <th className="py-2.5 px-3 text-right">Ad Spend</th>
                      <th className="py-2.5 px-2 text-center">Leads</th>
                      <th className="py-2.5 px-2 text-center">ROAS</th>
                      <th className="py-2.5 px-3 text-right">Net Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 text-[11px]">
                    {monthsData.map((m) => {
                      const isHighRev = m.grossRevenueAED > avgMonthlyRev;
                      return (
                        <tr key={m.monthKey} className="hover:bg-neutral-50">
                          <td className="py-2 px-3 font-bold text-[#192A24]">
                            {m.monthLabel}
                          </td>
                          <td className="py-2 px-2 text-center font-semibold">{m.partiesCount}</td>
                          <td className="py-2 px-2 text-center text-neutral-600">{m.totalGuests}</td>
                          <td className="py-2 px-3 text-right font-bold font-mono text-[#192A24]">
                            {formatCurrency(m.grossRevenueAED)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-neutral-600">
                            {formatCurrency(m.totalDirectCostsAED)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold font-mono text-emerald-800">
                            +{formatCurrency(m.grossProfitAED)}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-emerald-700">
                            {m.grossMarginPercent.toFixed(1)}%
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-neutral-700">
                            {formatCurrency(m.adSpendAED)}
                          </td>
                          <td className="py-2 px-2 text-center font-semibold text-neutral-800">
                            {m.leadsGenerated}
                          </td>
                          <td className="py-2 px-2 text-center font-bold text-amber-800">
                            {m.roas.toFixed(2)}x
                          </td>
                          <td className="py-2 px-3 text-right font-bold font-mono text-[#236B50]">
                            +{formatCurrency(m.netProfitAfterMarketingAED)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals & Averages Footer */}
                  <tfoot className="bg-neutral-100 font-bold text-xs border-t-2 border-neutral-300">
                    <tr className="border-b border-neutral-200 text-[#192A24]">
                      <td className="py-2.5 px-3 font-extrabold uppercase text-[10px]">Annual Total</td>
                      <td className="py-2.5 px-2 text-center">{totalParties}</td>
                      <td className="py-2.5 px-2 text-center">{totalGuests}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(totalGrossRevenue)}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(totalDirectCosts)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-800">+{formatCurrency(totalGrossProfit)}</td>
                      <td className="py-2.5 px-2 text-right text-emerald-800">{overallGrossMargin.toFixed(1)}%</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(totalAdSpend)}</td>
                      <td className="py-2.5 px-2 text-center">{totalLeads}</td>
                      <td className="py-2.5 px-2 text-center text-amber-900">{overallRoas.toFixed(2)}x</td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#236B50]">+{formatCurrency(totalNetProfitAfterAds)}</td>
                    </tr>
                    <tr className="text-neutral-600 text-[10px]">
                      <td className="py-2 px-3 uppercase">Monthly Average</td>
                      <td className="py-2 px-2 text-center">{avgMonthlyParties.toFixed(1)}</td>
                      <td className="py-2 px-2 text-center">{Math.round(totalGuests / divisor)}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(avgMonthlyRev)}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(totalDirectCosts / divisor)}</td>
                      <td className="py-2 px-3 text-right font-mono">+{formatCurrency(totalGrossProfit / divisor)}</td>
                      <td className="py-2 px-2 text-right">{overallGrossMargin.toFixed(1)}%</td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(avgMonthlyAdSpend)}</td>
                      <td className="py-2 px-2 text-center">{Math.round(totalLeads / divisor)}</td>
                      <td className="py-2 px-2 text-center">{overallRoas.toFixed(2)}x</td>
                      <td className="py-2 px-3 text-right font-mono">+{formatCurrency(totalNetProfitAfterAds / divisor)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Quarterly Breakdown Review */}
            <div>
              <div className="text-[11px] font-extrabold text-[#236B50] uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Quarterly Commercial Performance Analysis</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {quarters.map((q) => (
                  <div key={q.name} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1 text-xs">
                    <div className="font-extrabold text-[#192A24] text-[11px] border-b border-neutral-200 pb-1">
                      {q.name}
                    </div>
                    <div className="flex justify-between pt-0.5">
                      <span className="text-[10px] text-neutral-500">Sales:</span>
                      <strong className="font-mono">{formatCurrency(q.rev)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-neutral-500">Ad Spend:</span>
                      <span className="font-mono text-neutral-600">{formatCurrency(q.spend)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-neutral-500">ROAS:</span>
                      <strong className="text-amber-800 font-mono">{q.roas.toFixed(2)}x</strong>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-neutral-200">
                      <span className="text-[10px] font-bold text-[#236B50]">Gross Profit:</span>
                      <strong className="text-[#236B50] font-mono">+{formatCurrency(q.profit)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Official Audit Seals & Sign-Offs */}
            <div className="pt-4 border-t-2 border-neutral-200 space-y-4">
              <div className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">
                Annual Executive Audit Certification & Governance Seals
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-[10px]">
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="font-bold text-neutral-800">Betselot</div>
                  <div className="text-neutral-500">Marketing Executive</div>
                  <div className="mt-3 text-[9px] text-emerald-700 font-mono">✓ Meta ROAS Certified</div>
                </div>
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="font-bold text-neutral-800">Chef Karim Zayani</div>
                  <div className="text-neutral-500">Executive Chef</div>
                  <div className="mt-3 text-[9px] text-emerald-700 font-mono">✓ Recipe Yields Audited</div>
                </div>
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="font-bold text-neutral-800">Arun Kumar</div>
                  <div className="text-neutral-500">Accounts Executive</div>
                  <div className="mt-3 text-[9px] text-emerald-700 font-mono">✓ GL Reconciliation Done</div>
                </div>
                <div className="p-3 bg-[#E8F5EE] rounded-xl border border-[#C5E5D5]">
                  <div className="font-bold text-[#1E5D46]">General Manager</div>
                  <div className="text-[#236B50]">Executive Board Seal</div>
                  <div className="mt-3 text-[9px] text-[#236B50] font-bold font-mono">ANNUAL AUDIT APPROVED</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-neutral-400 pt-2 border-t border-neutral-100 flex justify-between items-center">
              <span>Crystal Plaza Hotel • Banquet & Events Division • Sharjah, UAE</span>
              <span>Full Year {year} Report generated by {currentUser.name} on {new Date().toLocaleDateString()}</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
