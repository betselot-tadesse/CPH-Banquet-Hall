import React, { useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  Target,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
} from 'lucide-react';
import { BookingEvent, InquiryStage } from '../types';
import { calculateEventFinancials, formatCurrency } from '../utils/costCalculations';
import { AppStorage } from '../services/storage';

interface MarketingRollingForecastWidgetProps {
  bookings: BookingEvent[];
  todayStr: string;
  onNavigate: (tab: string, meta?: any) => void;
}

const STAGE_PROBABILITY: Record<InquiryStage, number> = {
  new_lead: 0.2,
  menu_sent: 0.35,
  tasting_hall_tour: 0.55,
  tentative_hold: 0.75,
  converted_won: 1.0,
  lost: 0,
};

export const MarketingRollingForecastWidget: React.FC<MarketingRollingForecastWidgetProps> = ({
  bookings,
  todayStr,
  onNavigate,
}) => {
  const forecastData = useMemo(() => {
    const leads = AppStorage.getBanquetLeads();
    const validBookings = bookings.filter(b => b.status !== 'cancelled');

    // 1. Average Booking Value (ABV) from all non-cancelled bookings
    const totalHistoricalRev = validBookings.reduce(
      (sum, b) => sum + calculateEventFinancials(b).subtotalRevenue,
      0
    );
    const averageBookingValue =
      validBookings.length > 0 ? totalHistoricalRev / validBookings.length : 8500;

    // 2. Build 3-month rolling window starting from current baseline month (todayStr YYYY-MM)
    const [baseYearStr, baseMonthStr] = todayStr.split('-');
    const baseYear = parseInt(baseYearStr, 10) || 2026;
    const baseMonthIdx = (parseInt(baseMonthStr, 10) || 10) - 1; // 0-indexed

    const rollingMonthDefs = [0, 1, 2].map(offset => {
      const d = new Date(baseYear, baseMonthIdx + offset, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${y}-${m}`;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const shortLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      return { key, label, shortLabel, offset };
    });

    // Active open pipeline leads (excluding converted_won & lost)
    const openLeads = leads.filter(
      l => l.stage !== 'converted_won' && l.stage !== 'lost'
    );

    const months = rollingMonthDefs.map(m => {
      // Upcoming confirmed events in bookings for this month
      const confirmedUpcoming = validBookings.filter(
        b =>
          b.eventDate.startsWith(m.key) &&
          b.eventDate >= todayStr &&
          !b.partyEnded &&
          b.status !== 'completed'
      );

      const confirmedCount = confirmedUpcoming.length;
      const confirmedRevenue = confirmedUpcoming.reduce(
        (sum, b) => sum + calculateEventFinancials(b).subtotalRevenue,
        0
      );
      const confirmedAbvBenchmark = confirmedCount * averageBookingValue;

      // Active inquiries targeting this month (or unassigned future inquiries distributed cleanly)
      const monthLeads = openLeads.filter(
        l => l.targetEventDate && l.targetEventDate.startsWith(m.key)
      );

      const weightedExpectedEvents = monthLeads.reduce(
        (sum, l) => sum + (STAGE_PROBABILITY[l.stage] || 0.2),
        0
      );

      // Forecast pipeline revenue using Average Booking Value (ABV)
      const pipelineAbvForecast = weightedExpectedEvents * averageBookingValue;
      const totalForecastRevenue = confirmedRevenue + pipelineAbvForecast;

      return {
        ...m,
        confirmedCount,
        confirmedRevenue,
        confirmedAbvBenchmark,
        activeLeadCount: monthLeads.length,
        weightedExpectedEvents,
        pipelineAbvForecast,
        totalForecastRevenue,
      };
    });

    const total3MonthForecast = months.reduce((s, m) => s + m.totalForecastRevenue, 0);
    const totalConfirmedRevenue = months.reduce((s, m) => s + m.confirmedRevenue, 0);
    const totalConfirmedCount = months.reduce((s, m) => s + m.confirmedCount, 0);
    const totalPipelineAbvForecast = months.reduce((s, m) => s + m.pipelineAbvForecast, 0);
    const totalActiveLeadsInWindow = months.reduce((s, m) => s + m.activeLeadCount, 0);
    const totalWeightedExpectedWins = months.reduce(
      (s, m) => s + m.weightedExpectedEvents,
      0
    );
    const maxMonthForecast = Math.max(
      1,
      ...months.map(m => m.totalForecastRevenue)
    );

    return {
      averageBookingValue,
      totalBookingsSampled: validBookings.length,
      months,
      total3MonthForecast,
      totalConfirmedRevenue,
      totalConfirmedCount,
      totalPipelineAbvForecast,
      totalActiveLeadsInWindow,
      totalWeightedExpectedWins,
      maxMonthForecast,
    };
  }, [bookings, todayStr]);

  return (
    <section className="bg-white border border-[#D5E5DE] rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E2ECE7]">
        <div className="flex items-start space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-600 to-[#236B50] text-white flex items-center justify-center shadow-sm shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-900 border border-teal-200">
                Marketing Pipeline Forecast
              </span>
              <span className="text-[11px] font-bold text-[#5A6F66]">
                {forecastData.months[0]?.shortLabel} – {forecastData.months[2]?.shortLabel}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-[#192A24] mt-0.5">
              3-Month Rolling Revenue Forecast (ABV + Confirmed Pipeline)
            </h2>
            <p className="text-xs text-[#5A6F66]">
              Projected banquet income combining upcoming confirmed events and stage-weighted pipeline inquiries priced at Average Booking Value.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('marketing_kpi')}
          className="px-4 py-2 rounded-xl bg-[#236B50] hover:bg-[#1C5740] text-white text-xs font-black transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Target className="w-3.5 h-3.5" />
          <span>Manage Inquiry Pipeline</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Top 4 Forecast Summary Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-[#F3FAF6] to-white p-4 rounded-2xl border border-[#C5E5D5] space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#236B50] flex items-center space-x-1">
            <Sparkles className="w-3 h-3" />
            <span>3-Month Rolling Forecast</span>
          </span>
          <div className="text-xl sm:text-2xl font-black text-[#192A24] font-mono">
            {formatCurrency(forecastData.total3MonthForecast)}
          </div>
          <div className="text-[11px] text-[#5A6F66]">
            Confirmed + ABV-weighted pipeline
          </div>
        </div>

        <div className="bg-[#FAFDFB] p-4 rounded-2xl border border-[#E2ECE7] space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#5A6F66] flex items-center space-x-1">
            <DollarSign className="w-3 h-3 text-[#236B50]" />
            <span>Avg Booking Value (ABV)</span>
          </span>
          <div className="text-xl sm:text-2xl font-black text-[#236B50] font-mono">
            {formatCurrency(forecastData.averageBookingValue)}
          </div>
          <div className="text-[11px] text-[#5A6F66]">
            Across {forecastData.totalBookingsSampled} active/past banquets
          </div>
        </div>

        <div className="bg-[#FAFDFB] p-4 rounded-2xl border border-[#E2ECE7] space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#5A6F66] flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Confirmed Upcoming</span>
          </span>
          <div className="text-xl sm:text-2xl font-black text-[#192A24] font-mono">
            {formatCurrency(forecastData.totalConfirmedRevenue)}
          </div>
          <div className="text-[11px] text-emerald-800 font-bold">
            {forecastData.totalConfirmedCount} confirmed upcoming events
          </div>
        </div>

        <div className="bg-[#FAFDFB] p-4 rounded-2xl border border-[#E2ECE7] space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#5A6F66] flex items-center space-x-1">
            <Clock className="w-3 h-3 text-teal-600" />
            <span>ABV Pipeline Upside</span>
          </span>
          <div className="text-xl sm:text-2xl font-black text-teal-800 font-mono">
            +{formatCurrency(forecastData.totalPipelineAbvForecast)}
          </div>
          <div className="text-[11px] text-[#5A6F66]">
            {forecastData.totalActiveLeadsInWindow} active leads (~{forecastData.totalWeightedExpectedWins.toFixed(1)} expected wins × ABV)
          </div>
        </div>
      </div>

      {/* 3-Month Rolling Breakdown Cards with Visual Stacked Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {forecastData.months.map((m, idx) => {
          const confirmedWidth =
            forecastData.maxMonthForecast > 0
              ? (m.confirmedRevenue / forecastData.maxMonthForecast) * 100
              : 0;
          const pipelineWidth =
            forecastData.maxMonthForecast > 0
              ? (m.pipelineAbvForecast / forecastData.maxMonthForecast) * 100
              : 0;

          return (
            <div
              key={m.key}
              className={`p-4 rounded-2xl border transition-all space-y-3 ${
                idx === 0
                  ? 'bg-[#F8FCFA] border-[#B8DFC9]'
                  : 'bg-white border-[#E2ECE7] hover:border-[#C5E5D5]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-[#236B50]" />
                  <span className="font-extrabold text-sm text-[#192A24]">{m.label}</span>
                </div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#E8F5EE] text-[#236B50] border border-[#C5E5D5]">
                  {idx === 0 ? 'Month 1 (Current)' : idx === 1 ? 'Month 2 (+30d)' : 'Month 3 (+60d)'}
                </span>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase text-[#5A6F66]">
                  Projected Total Revenue
                </div>
                <div className="text-xl font-black text-[#192A24] font-mono">
                  {formatCurrency(m.totalForecastRevenue)}
                </div>
              </div>

              {/* Visual Stacked Bar */}
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                <div
                  className="bg-[#236B50] h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, confirmedWidth)}%` }}
                  title={`Confirmed Upcoming: ${formatCurrency(m.confirmedRevenue)}`}
                />
                <div
                  className="bg-teal-400 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100 - confirmedWidth, pipelineWidth)}%` }}
                  title={`ABV Pipeline Forecast: ${formatCurrency(m.pipelineAbvForecast)}`}
                />
              </div>

              {/* Split breakdown */}
              <div className="space-y-1.5 pt-1 text-xs border-t border-[#E2ECE7]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 text-[#3D5A4E]">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#236B50] inline-block" />
                    <span>Confirmed ({m.confirmedCount} events):</span>
                  </span>
                  <strong className="font-mono text-[#192A24]">
                    {formatCurrency(m.confirmedRevenue)}
                  </strong>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 text-[#3D5A4E]">
                    <span className="w-2.5 h-2.5 rounded-xs bg-teal-400 inline-block" />
                    <span>Pipeline ({m.activeLeadCount} leads · {m.weightedExpectedEvents.toFixed(1)}× ABV):</span>
                  </span>
                  <strong className="font-mono text-teal-800">
                    +{formatCurrency(m.pipelineAbvForecast)}
                  </strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Transparent Formula Legend */}
      <div className="bg-[#F6FAF8] px-4 py-2.5 rounded-2xl border border-[#E2ECE7] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5A6F66]">
        <span>
          <strong>Forecast Model:</strong> Upcoming Confirmed Booking Value + (Stage-Weighted Active Pipeline Inquiries × Average Booking Value of {formatCurrency(forecastData.averageBookingValue)})
        </span>
        <span className="font-semibold text-[#236B50]">
          Weights: New Lead 20% · Menu Sent 35% · Tasting/Tour 55% · 48h Hold 75%
        </span>
      </div>
    </section>
  );
};
