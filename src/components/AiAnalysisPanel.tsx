import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Send,
  ShieldAlert,
  ArrowRight,
  MessageSquare,
  UtensilsCrossed,
  Building2,
  BarChart2,
  Layers,
} from 'lucide-react';
import {
  BanquetHall,
  BookingEvent,
  Invoice,
  MetaAdMonthlyReport,
  RawIngredient,
  RecipeMenuItem,
  UserProfile,
} from '../types';
import {
  AiAskResult,
  AiFocusArea,
  AiStructuredAnalysis,
  buildAiAnalysisSnapshot,
} from '../utils/aiSnapshotBuilder';

interface AiAnalysisPanelProps {
  bookings: BookingEvent[];
  invoices: Invoice[];
  ingredients: RawIngredient[];
  recipes: RecipeMenuItem[];
  halls: BanquetHall[];
  marketingReports: MetaAdMonthlyReport[];
  currentUser: UserProfile;
}

interface QaThreadItem {
  id: string;
  question: string;
  answeredAt: string;
  result: AiAskResult;
}

export const AiAnalysisPanel: React.FC<AiAnalysisPanelProps> = ({
  bookings,
  invoices,
  ingredients,
  recipes,
  halls,
  marketingReports,
  currentUser,
}) => {
  const canViewProfits = currentUser.permissions.canViewProfits !== false;
  const canViewCosting = currentUser.permissions.canViewCosting !== false;
  const canViewRevenue = currentUser.permissions.canViewRevenue !== false;

  const availableFocusModes = useMemo(() => {
    const modes: Array<{
      id: AiFocusArea;
      label: string;
      description: string;
      icon: React.ComponentType<{ className?: string }>;
    }> = [
      {
        id: 'executive_overview',
        label: 'Executive Overview',
        description: 'Cross-functional operational & banquet summary',
        icon: Layers,
      },
    ];

    if (canViewCosting || canViewProfits) {
      modes.push({
        id: 'profitability_costing',
        label: canViewProfits ? 'Margins & Food Cost' : 'Kitchen & Food Cost',
        description: canViewProfits
          ? 'Menu margins, >10% variance alerts & FIFO costing'
          : 'Recipe portions, wastage & kitchen usage variance',
        icon: UtensilsCrossed,
      });
    }

    if (canViewRevenue || currentUser.permissions.canManageBookings) {
      modes.push({
        id: 'operations_cashflow',
        label: canViewRevenue ? 'Halls & Collections' : 'Hall Utilization',
        description: canViewRevenue
          ? 'Hall capacity, holds & unsettled party balances'
          : 'First Floor Big Hall vs Suite room Hall scheduling',
        icon: Building2,
      });
    }

    if (currentUser.role !== 'executive_chef') {
      modes.push({
        id: 'marketing_roas',
        label: 'Meta Ads & Funnel',
        description: 'Lead conversion efficiency, CPR & campaign ROI',
        icon: BarChart2,
      });
    }

    return modes;
  }, [canViewCosting, canViewProfits, canViewRevenue, currentUser.permissions.canManageBookings, currentUser.role]);

  const [focusArea, setFocusArea] = useState<AiFocusArea>('executive_overview');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AiStructuredAnalysis | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
  const [lastFocusAnalyzed, setLastFocusAnalyzed] = useState<AiFocusArea | null>(null);

  // Interactive Q&A state
  const [questionInput, setQuestionInput] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [qaThread, setQaThread] = useState<QaThreadItem[]>([]);

  const snapshot = useMemo(
    () =>
      buildAiAnalysisSnapshot({
        bookings,
        invoices,
        ingredients,
        recipes,
        halls,
        marketingReports,
        currentUser,
      }),
    [bookings, invoices, ingredients, recipes, halls, marketingReports, currentUser]
  );

  const defaultSuggestedQuestions = useMemo(() => {
    const q: string[] = [];
    if (canViewProfits && canViewRevenue) {
      q.push('Which hall and menu package generate the highest profit margin?');
      q.push('Which concluded parties still have outstanding balances to collect?');
    }
    if (canViewCosting) {
      q.push('Which parties exceeded theoretical food cost by more than 10% and why?');
      q.push('Which kitchen ingredients are below reorder level right now?');
    }
    if (currentUser.role !== 'executive_chef') {
      q.push('How efficiently are Meta Ads leads converting into confirmed banquet bookings?');
    }
    if (!canViewProfits && !canViewCosting) {
      q.push('How is booking volume split between First Floor Big Hall and Suite room Hall?');
      q.push('Which tentative holds or upcoming events need immediate follow-up?');
    }
    return q.slice(0, 4);
  }, [canViewCosting, canViewProfits, canViewRevenue, currentUser.role]);

  const postAiJsonWithRetry = async (url: string, payload: Record<string, any>) => {
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const rawText = await response.text();
      const trimmed = rawText.trim();
      const looksLikeHtml =
        trimmed.startsWith('<!') ||
        trimmed.toLowerCase().startsWith('<html');

      if (looksLikeHtml) {
        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1400 * (attempt + 1)));
          continue;
        }
        const isWarmup = /warm|starting|loading/i.test(trimmed);
        throw new Error(
          isWarmup
            ? 'The AI backend server is still warming up. Please wait a moment and click Retry Analysis.'
            : 'The AI endpoint returned HTML instead of JSON. Please refresh the page and retry.'
        );
      }

      let parsed: any = null;
      try {
        parsed = trimmed ? JSON.parse(trimmed) : {};
      } catch {
        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        const cleanSnippet = trimmed.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
        throw new Error(
          response.ok
            ? 'Received a malformed response from the AI server. Please click Retry Analysis.'
            : `AI server returned HTTP ${response.status}${cleanSnippet ? `: ${cleanSnippet}` : '.'}`
        );
      }

      if (!response.ok) {
        throw new Error(parsed?.error || `AI request failed with status ${response.status}.`);
      }

      return parsed;
    }

    throw new Error('Unable to reach AI analysis service. Please retry.');
  };

  const runAnalysis = async (targetFocus: AiFocusArea = focusArea) => {
    setFocusArea(targetFocus);
    setAnalysisLoading(true);
    setAnalysisError(null);

    try {
      const data = await postAiJsonWithRetry('/api/ai/analyze', {
        focusArea: targetFocus,
        role: currentUser.role,
        userName: currentUser.name,
        permissions: {
          canViewProfits,
          canViewCosting,
          canViewRevenue,
        },
        snapshot,
      });
      const rawAnalysis = data?.analysis || {};
      const normalizedAnalysis: AiStructuredAnalysis = {
        headline: rawAnalysis.headline || 'AI Analysis Complete',
        executiveSummary: rawAnalysis.executiveSummary || '',
        healthStatus:
          rawAnalysis.healthStatus === 'strong' || rawAnalysis.healthStatus === 'critical'
            ? rawAnalysis.healthStatus
            : 'attention_needed',
        keyFindings: Array.isArray(rawAnalysis.keyFindings) ? rawAnalysis.keyFindings : [],
        recommendations: Array.isArray(rawAnalysis.recommendations) ? rawAnalysis.recommendations : [],
        riskAlerts: Array.isArray(rawAnalysis.riskAlerts) ? rawAnalysis.riskAlerts : [],
        suggestedQuestions: Array.isArray(rawAnalysis.suggestedQuestions) ? rawAnalysis.suggestedQuestions : [],
      };

      setAnalysisResult(normalizedAnalysis);
      setLastGeneratedAt(data.generatedAt || new Date().toISOString());
      setLastFocusAnalyzed(targetFocus);
    } catch (err: any) {
      setAnalysisError(err?.message || 'Unable to reach AI analysis service.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleAskQuestion = async (rawQuestion?: string) => {
    const text = (rawQuestion ?? questionInput).trim();
    if (!text || askLoading) return;

    setAskLoading(true);
    setAskError(null);
    if (!rawQuestion) {
      setQuestionInput('');
    }

    try {
      const data = await postAiJsonWithRetry('/api/ai/ask', {
        question: text,
        role: currentUser.role,
        userName: currentUser.name,
        permissions: {
          canViewProfits,
          canViewCosting,
          canViewRevenue,
        },
        snapshot,
        history: qaThread.map((item) => ({
          question: item.question,
          answer: item.result.answer,
        })),
      });
      const rawResult = data?.result || {};
      const normalizedResult: AiAskResult = {
        answer: rawResult.answer || 'No answer text returned.',
        supportingMetrics: Array.isArray(rawResult.supportingMetrics) ? rawResult.supportingMetrics : [],
        followUpPrompts: Array.isArray(rawResult.followUpPrompts) ? rawResult.followUpPrompts : [],
      };

      setQaThread((prev) => [
        {
          id: `qa_${Date.now()}`,
          question: text,
          answeredAt: data.answeredAt || new Date().toISOString(),
          result: normalizedResult,
        },
        ...prev,
      ]);
    } catch (err: any) {
      setAskError(err?.message || 'Unable to answer question right now.');
    } finally {
      setAskLoading(false);
    }
  };

  const activeBookingsCount = bookings.filter((b) => b.status !== 'cancelled').length;

  const getHealthBadgeStyle = (status: AiStructuredAnalysis['healthStatus']) => {
    switch (status) {
      case 'strong':
        return {
          text: 'Nominal / Strong',
          classes: 'bg-[#E8F5EE] text-[#16A34A] border-[#C5E5D5]',
        };
      case 'critical':
        return {
          text: 'Action Required',
          classes: 'bg-red-50 text-[#DC2626] border-red-200',
        };
      default:
        return {
          text: 'Attention Needed',
          classes: 'bg-amber-50 text-[#D97706] border-amber-200',
        };
    }
  };

  const getSentimentClasses = (sentiment: 'positive' | 'warning' | 'risk') => {
    if (sentiment === 'positive') return 'text-[#16A34A]';
    if (sentiment === 'risk') return 'text-[#DC2626]';
    return 'text-[#D97706]';
  };

  const getPriorityClasses = (priority: 'high' | 'medium' | 'low') => {
    if (priority === 'high') return 'text-[#DC2626] bg-red-50 border-red-200';
    if (priority === 'medium') return 'text-[#D97706] bg-amber-50 border-amber-200';
    return 'text-[#236B50] bg-[#E8F5EE] border-[#C5E5D5]';
  };

  const activeSuggestedPrompts =
    analysisResult?.suggestedQuestions && analysisResult.suggestedQuestions.length > 0
      ? analysisResult.suggestedQuestions
      : defaultSuggestedQuestions;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Workspace Header */}
      <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs font-bold text-[#236B50] uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Crystal Plaza Hotel · Live Operational Intelligence</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#192A24] tracking-tight">
            AI Banquet &amp; Financial Analysis
          </h1>
          <p className="text-xs sm:text-sm text-[#5A6F66]">
            Role-scoped diagnostic briefing for <span className="font-bold text-[#192A24]">{currentUser.name}</span> over{' '}
            <span className="font-semibold tabular-nums">{activeBookingsCount}</span> active banquets,{' '}
            <span className="font-semibold tabular-nums">{halls.length}</span> halls
            {currentUser.role !== 'executive_chef' && (
              <>
                , and <span className="font-semibold tabular-nums">{marketingReports.length}</span> Meta Ads monthly reports
              </>
            )}
            .
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => runAnalysis(focusArea)}
            disabled={analysisLoading}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-[#236B50] hover:bg-[#1C5740] disabled:opacity-60 text-white text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${analysisLoading ? 'animate-spin' : ''}`} />
            <span>
              {analysisLoading
                ? 'Analyzing Hotel Data...'
                : analysisResult
                ? 'Refresh Analysis'
                : 'Run AI Analysis'}
            </span>
          </button>
        </div>
      </div>

      {/* Focus Mode Segmented Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {availableFocusModes.map((mode) => {
          const Icon = mode.icon;
          const isSelected = focusArea === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => {
                setFocusArea(mode.id);
                if (analysisResult && lastFocusAnalyzed !== mode.id && !analysisLoading) {
                  runAnalysis(mode.id);
                }
              }}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#EBF5F1] border-[#236B50]'
                  : 'bg-white border-[#E2ECE7] hover:border-[#C5DBD0]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-extrabold ${isSelected ? 'text-[#236B50]' : 'text-[#192A24]'}`}>
                  {mode.label}
                </span>
                <Icon className={`w-4 h-4 ${isSelected ? 'text-[#236B50]' : 'text-[#6E8279]'}`} />
              </div>
              <p className="text-[11px] text-[#5A6F66] leading-snug">{mode.description}</p>
            </button>
          );
        })}
      </div>

      {/* Error State Banner (No Fake Fallback Data) */}
      {analysisError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-extrabold text-[#DC2626]">AI Analysis Request Failed</h3>
              <p className="text-xs text-red-900 mt-0.5">{analysisError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => runAnalysis(focusArea)}
            className="px-4 py-1.5 rounded-full bg-white border border-red-300 text-xs font-bold text-[#DC2626] hover:bg-red-100 transition-colors cursor-pointer shrink-0"
          >
            Retry Analysis
          </button>
        </div>
      )}

      {/* Loading Skeleton State */}
      {analysisLoading && (
        <div className="space-y-4">
          <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 space-y-3 animate-pulse">
            <div className="h-4 w-44 bg-[#E5EFEA] rounded" />
            <div className="h-6 w-3/4 bg-[#E5EFEA] rounded" />
            <div className="h-4 w-full bg-[#EFF5F2] rounded" />
            <div className="h-4 w-5/6 bg-[#EFF5F2] rounded" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="bg-white border border-[#E2ECE7] rounded-2xl p-5 space-y-2.5 animate-pulse">
                <div className="h-3.5 w-32 bg-[#E5EFEA] rounded" />
                <div className="h-6 w-28 bg-[#E5EFEA] rounded" />
                <div className="h-3.5 w-full bg-[#EFF5F2] rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Initial Empty / Ready State */}
      {!analysisLoading && !analysisResult && !analysisError && (
        <div className="bg-white border border-[#E2ECE7] rounded-3xl p-8 sm:p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#EBF5F1] border border-[#D5E5DE] flex items-center justify-center mx-auto text-[#236B50]">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="max-w-xl mx-auto space-y-1.5">
            <h2 className="text-base sm:text-lg font-extrabold text-[#192A24]">
              Ready to Analyze Live Hotel Operations
            </h2>
            <p className="text-xs sm:text-sm text-[#5A6F66] leading-relaxed">
              Generate an instant AI diagnostic grounded strictly in Crystal Plaza Hotel’s live bookings,
              {canViewCosting ? ' kitchen food costing & variance logs,' : ''}
              {canViewRevenue ? ' receivables & hall revenue,' : ''} and Meta Ads performance.
            </p>
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => runAnalysis(focusArea)}
              className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-full bg-[#236B50] hover:bg-[#1C5740] text-white text-xs sm:text-sm font-bold transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate {availableFocusModes.find((m) => m.id === focusArea)?.label} Report</span>
            </button>
          </div>
        </div>
      )}

      {/* Populated Structured Analysis State */}
      {!analysisLoading && analysisResult && (
        <div className="space-y-6">
          {/* Executive Synthesis Card */}
          <section className="bg-white border border-[#E2ECE7] rounded-3xl p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2ECE7]">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-[#236B50]" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#236B50]">
                  {availableFocusModes.find((m) => m.id === (lastFocusAnalyzed || focusArea))?.label || 'AI Executive Briefing'}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                {lastGeneratedAt && (
                  <span className="text-[11px] font-mono text-[#5A6F66] tabular-nums">
                    Updated {new Date(lastGeneratedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                    getHealthBadgeStyle(analysisResult.healthStatus).classes
                  }`}
                >
                  {getHealthBadgeStyle(analysisResult.healthStatus).text}
                </span>
              </div>
            </div>

            <h2 className="text-lg font-extrabold text-[#192A24] leading-snug">
              {analysisResult.headline}
            </h2>
            <p className="text-sm text-[#3D5A4E] leading-relaxed">
              {analysisResult.executiveSummary}
            </p>
          </section>

          {/* Key Findings Grid */}
          {analysisResult.keyFindings.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#5A6F66] px-1">
                Key Data Findings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysisResult.keyFindings.map((finding, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-[#E2ECE7] rounded-2xl p-5 flex flex-col justify-between space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs font-bold text-[#5A6F66]">{finding.title}</span>
                      <span
                        className={`text-sm font-extrabold font-mono tabular-nums shrink-0 ${getSentimentClasses(
                          finding.sentiment
                        )}`}
                      >
                        {finding.metric}
                      </span>
                    </div>
                    <p className="text-xs text-[#3D5A4E] leading-relaxed">{finding.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Actionable Recommendations Table */}
          {analysisResult.recommendations.length > 0 && (
            <section className="bg-white border border-[#E2ECE7] rounded-3xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E2ECE7] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-[#236B50]" />
                  <h3 className="text-sm font-extrabold text-[#192A24]">
                    Prioritized Action Plan
                  </h3>
                </div>
                <span className="text-xs font-mono text-[#5A6F66] tabular-nums">
                  {analysisResult.recommendations.length} Actions
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAF9] text-[#5A6F66] border-b border-[#E2ECE7] font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-5">Priority</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Recommended Action</th>
                      <th className="py-3 px-5">Expected Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2ECE7]">
                    {analysisResult.recommendations.map((rec, idx) => (
                      <tr key={idx} className="hover:bg-[#F8FAF9] transition-colors">
                        <td className="py-3.5 px-5 align-top whitespace-nowrap">
                          <span
                            className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getPriorityClasses(
                              rec.priority
                            )}`}
                          >
                            {rec.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 align-top font-bold text-[#192A24] whitespace-nowrap">
                          {rec.department}
                        </td>
                        <td className="py-3.5 px-4 align-top text-[#192A24] leading-relaxed">
                          {rec.action}
                        </td>
                        <td className="py-3.5 px-5 align-top text-[#236B50] font-semibold leading-relaxed">
                          {rec.expectedImpact}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Risk Watchlist */}
          {analysisResult.riskAlerts && analysisResult.riskAlerts.length > 0 && (
            <section className="bg-white border border-[#E2ECE7] rounded-3xl p-6 space-y-3">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-[#D97706]" />
                <h3 className="text-sm font-extrabold text-[#192A24]">
                  Operational &amp; Financial Watchlist
                </h3>
              </div>
              <div className="divide-y divide-[#E2ECE7]">
                {analysisResult.riskAlerts.map((alert, idx) => (
                  <div key={idx} className="py-3 first:pt-1 last:pb-0 flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-xs font-extrabold text-[#192A24]">{alert.title}</div>
                      <p className="text-xs text-[#5A6F66] leading-relaxed">{alert.detail}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${
                        alert.severity === 'high'
                          ? 'bg-red-50 text-[#DC2626] border-red-200'
                          : 'bg-amber-50 text-[#D97706] border-amber-200'
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Interactive Ask AI Analyst Section */}
      <section className="bg-white border border-[#E2ECE7] rounded-3xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E2ECE7]">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-[#236B50]" />
            <div>
              <h3 className="text-sm font-extrabold text-[#192A24]">
                Ask AI Analyst About Live Records
              </h3>
              <p className="text-xs text-[#5A6F66]">
                Query specific halls, menus, party variances, balances, or monthly ad conversion directly.
              </p>
            </div>
          </div>
          {qaThread.length > 0 && (
            <button
              type="button"
              onClick={() => setQaThread([])}
              className="text-xs font-bold text-[#5A6F66] hover:text-[#192A24] cursor-pointer self-start sm:self-auto"
            >
              Clear Thread
            </button>
          )}
        </div>

        {/* Suggested Prompts */}
        <div className="flex flex-wrap gap-2">
          {activeSuggestedPrompts.map((promptText, idx) => (
            <button
              key={idx}
              type="button"
              disabled={askLoading}
              onClick={() => handleAskQuestion(promptText)}
              className="inline-flex items-center space-x-1.5 text-left text-xs font-semibold text-[#236B50] bg-[#F4F8F6] hover:bg-[#E8F2ED] border border-[#D5E5DE] px-3 py-1.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <span>{promptText}</span>
              <ArrowRight className="w-3 h-3 shrink-0" />
            </button>
          ))}
        </div>

        {/* Question Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAskQuestion();
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <input
            type="text"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            placeholder="Ask a specific question about bookings, food costs, halls, or Meta Ads..."
            className="flex-1 px-4 py-2.5 rounded-2xl border border-[#D5E5DE] bg-[#FAFDFB] text-xs sm:text-sm text-[#192A24] placeholder:text-[#7E948B] focus:outline-none focus:border-[#236B50] focus:ring-2 focus:ring-[#236B50]/15"
          />
          <button
            type="submit"
            disabled={askLoading || !questionInput.trim()}
            className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-2xl bg-[#236B50] hover:bg-[#1C5740] disabled:opacity-50 text-white text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{askLoading ? 'Analyzing...' : 'Ask AI'}</span>
          </button>
        </form>

        {askError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-[#DC2626] flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{askError}</span>
          </div>
        )}

        {/* Q&A Answers Thread */}
        {qaThread.length > 0 && (
          <div className="space-y-4 pt-2">
            {qaThread.map((item) => (
              <div
                key={item.id}
                className="border border-[#E2ECE7] rounded-2xl p-5 bg-[#FAFDFB] space-y-3"
              >
                <div className="flex items-start justify-between gap-3 pb-2 border-b border-[#E2ECE7]">
                  <div className="text-xs sm:text-sm font-extrabold text-[#192A24]">
                    {item.question}
                  </div>
                  <span className="text-[11px] font-mono text-[#5A6F66] tabular-nums shrink-0">
                    {new Date(item.answeredAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[#2A4239] leading-relaxed whitespace-pre-line">
                  {item.result.answer}
                </p>

                {item.result.supportingMetrics && item.result.supportingMetrics.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    {item.result.supportingMetrics.map((m, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-[#E2ECE7] rounded-xl px-3 py-2"
                      >
                        <div className="text-[10px] font-bold uppercase text-[#5A6F66] truncate">
                          {m.label}
                        </div>
                        <div className="text-xs sm:text-sm font-extrabold text-[#236B50] font-mono tabular-nums mt-0.5 truncate">
                          {m.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {item.result.followUpPrompts && item.result.followUpPrompts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-[#5A6F66] mr-1">Follow up:</span>
                    {item.result.followUpPrompts.map((fp, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={askLoading}
                        onClick={() => handleAskQuestion(fp)}
                        className="text-[11px] font-semibold text-[#236B50] hover:underline cursor-pointer disabled:opacity-50"
                      >
                        {fp}
                        {idx < item.result.followUpPrompts.length - 1 ? ' ·' : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
