import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  Square,
  Calendar,
  Clock,
  Users,
  Building2,
  Plus,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';
import {
  BookingEvent,
  EventChecklistItem,
  UserProfile,
} from '../types';
import {
  formatCurrency,
  getBookingPaymentSummary,
  getLiveTodayInfo,
} from '../utils/costCalculations';

interface DailyOperationsChecklistProps {
  bookings: BookingEvent[];
  currentUser: UserProfile;
  onToggleChecklistItem: (
    bookingId: string,
    item: EventChecklistItem,
    nextCompleted: boolean,
    mergedChecklist: EventChecklistItem[]
  ) => void;
  onAddChecklistItem?: (
    bookingId: string,
    newItem: EventChecklistItem,
    mergedChecklist: EventChecklistItem[]
  ) => void;
  onOpenBookingModal?: () => void;
}

function buildDynamicTasksForEvent(booking: BookingEvent): EventChecklistItem[] {
  const existingMap = new Map<string, EventChecklistItem>(
    (booking.checklist || []).map((item) => [item.id, item])
  );

  const summary = getBookingPaymentSummary(booking);
  const setupMeta = [
    booking.hallName,
    booking.seatingStyle ? booking.seatingStyle : null,
    booking.eventTimeSpan ? booking.eventTimeSpan : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const generated: EventChecklistItem[] = [
    {
      id: `daily_${booking.id}_setup`,
      category: 'Decoration',
      task: `Confirm hall setup & seating for ${booking.clientName}${setupMeta ? ` (${setupMeta})` : ''}`,
      isCompleted: false,
    },
    {
      id: `daily_${booking.id}_av`,
      category: 'AV',
      task: `Verify sound system, projector & table linen (${booking.tableClothColor || 'standard linen'}) for ${booking.clientName}`,
      isCompleted: false,
    },
  ];

  if (booking.hasFoodFromHotel) {
    const menuLabel = booking.selectedMenuName || `${booking.foodPricePerGuestCharged || 60} AED Buffet`;
    const pickupNote = booking.foodPickupTime ? ` · Pickup ${booking.foodPickupTime}` : '';
    generated.push({
      id: `daily_${booking.id}_menu`,
      category: 'Kitchen Setup',
      task: `Finalize menu & kitchen readiness for ${booking.clientName} (${menuLabel}, ${booking.guestCount} guests${pickupNote})`,
      isCompleted: false,
    });
  }

  generated.push({
    id: `daily_${booking.id}_staff`,
    category: 'Staff',
    task: `Confirm F&B floor staffing & buffet replenishment for ${booking.clientName} (${booking.guestCount} guests)`,
    isCompleted: false,
  });

  if (!summary.isBalanceSettled && summary.balanceToPay > 0.01) {
    generated.push({
      id: `daily_${booking.id}_balance`,
      category: 'Cleanup',
      task: `Collect outstanding pre-event balance (${formatCurrency(summary.balanceToPay)}) from ${booking.clientName}`,
      isCompleted: false,
    });
  }

  // Merge existing saved completion state and preserve any supervisor custom items
  const generatedIds = new Set(generated.map((g) => g.id));
  const mergedGenerated = generated.map((item) => {
    const saved = existingMap.get(item.id);
    return saved
      ? {
          ...item,
          isCompleted: Boolean(saved.isCompleted),
          completedAt: saved.completedAt,
          completedBy: saved.completedBy,
        }
      : item;
  });

  const customItems = (booking.checklist || []).filter(
    (item) => !generatedIds.has(item.id)
  );

  return [...mergedGenerated, ...customItems];
}

type ChecklistHallFilter = 'All' | 'First Floor Big Hall' | 'Suite Room Hall';
const CHECKLIST_HALL_FILTERS: ChecklistHallFilter[] = [
  'All',
  'First Floor Big Hall',
  'Suite Room Hall',
];

function matchesChecklistHall(
  booking: BookingEvent,
  hallFilter: ChecklistHallFilter
): boolean {
  if (hallFilter === 'All') return true;
  const normalizedName = (booking.hallName || '').trim().toLowerCase();
  const normalizedFloor = (booking.venueFloor || '').trim().toLowerCase();
  if (hallFilter === 'First Floor Big Hall') {
    return (
      booking.hallId === 'hall_first_floor_big' ||
      normalizedName === 'first floor big hall' ||
      normalizedFloor === 'first floor big hall'
    );
  }
  return (
    booking.hallId === 'hall_suite_room' ||
    normalizedName === 'suite room hall' ||
    normalizedFloor === 'suite room hall'
  );
}

export const DailyOperationsChecklist: React.FC<DailyOperationsChecklistProps> = ({
  bookings,
  currentUser,
  onToggleChecklistItem,
  onAddChecklistItem,
  onOpenBookingModal,
}) => {
  const { todayStr, todayDisplayStr } = getLiveTodayInfo();
  const [hallFilter, setHallFilter] = useState<ChecklistHallFilter>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [previewUpcoming, setPreviewUpcoming] = useState<boolean>(false);
  const [customTaskByBooking, setCustomTaskByBooking] = useState<Record<string, string>>({});
  const [lastAuditFeedback, setLastAuditFeedback] = useState<string | null>(null);

  const todaysEventsAll = useMemo(() => {
    return bookings
      .filter((b) => b.status !== 'cancelled' && b.eventDate === todayStr)
      .sort((a, b) => a.hallName.localeCompare(b.hallName));
  }, [bookings, todayStr]);

  const todaysEvents = useMemo(() => {
    return todaysEventsAll.filter((b) => matchesChecklistHall(b, hallFilter));
  }, [todaysEventsAll, hallFilter]);

  const nextUpcomingEvent = useMemo(() => {
    return bookings
      .filter(
        (b) =>
          b.status !== 'cancelled' &&
          b.eventDate > todayStr &&
          matchesChecklistHall(b, hallFilter)
      )
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0] || null;
  }, [bookings, todayStr, hallFilter]);

  const activeEvents = useMemo(() => {
    if (todaysEvents.length > 0) return todaysEvents;
    if (todaysEventsAll.length === 0 && previewUpcoming && nextUpcomingEvent) {
      return [nextUpcomingEvent];
    }
    return [];
  }, [todaysEvents, todaysEventsAll.length, previewUpcoming, nextUpcomingEvent]);

  const eventChecklists = useMemo(() => {
    return activeEvents.map((booking) => ({
      booking,
      tasks: buildDynamicTasksForEvent(booking),
    }));
  }, [activeEvents]);

  const hallEventCounts = useMemo(() => {
    return {
      All: todaysEventsAll.length,
      'First Floor Big Hall': todaysEventsAll.filter((b) =>
        matchesChecklistHall(b, 'First Floor Big Hall')
      ).length,
      'Suite Room Hall': todaysEventsAll.filter((b) =>
        matchesChecklistHall(b, 'Suite Room Hall')
      ).length,
    };
  }, [todaysEventsAll]);

  const totalTasks = eventChecklists.reduce((s, e) => s + e.tasks.length, 0);
  const completedTasks = eventChecklists.reduce(
    (s, e) => s + e.tasks.filter((t) => t.isCompleted).length,
    0
  );
  const completionPct =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const categories = ['All', 'Decoration', 'Kitchen Setup', 'AV', 'Staff', 'Cleanup'];

  const handleToggle = (
    booking: BookingEvent,
    tasks: EventChecklistItem[],
    item: EventChecklistItem
  ) => {
    const nextCompleted = !item.isCompleted;
    const nowIso = new Date().toISOString();
    const updatedChecklist = tasks.map((t) =>
      t.id === item.id
        ? {
            ...t,
            isCompleted: nextCompleted,
            completedAt: nextCompleted ? nowIso : undefined,
            completedBy: nextCompleted ? currentUser.name : undefined,
          }
        : t
    );

    onToggleChecklistItem(booking.id, item, nextCompleted, updatedChecklist);
    const timeStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    setLastAuditFeedback(
      `Audit logged (${timeStr}): ${nextCompleted ? 'Completed' : 'Reopened'} "${item.task}" for ${booking.clientName}.`
    );
  };

  const handleAddCustomTask = (
    booking: BookingEvent,
    tasks: EventChecklistItem[]
  ) => {
    const draft = (customTaskByBooking[booking.id] || '').trim();
    if (!draft || !onAddChecklistItem) return;

    const newItem: EventChecklistItem = {
      id: `custom_${booking.id}_${Date.now()}`,
      category: 'Staff',
      task: draft,
      isCompleted: false,
    };
    const updatedChecklist = [...tasks, newItem];
    onAddChecklistItem(booking.id, newItem, updatedChecklist);
    setCustomTaskByBooking((prev) => ({ ...prev, [booking.id]: '' }));
    setLastAuditFeedback(`Audit logged: Added custom task "${draft}" for ${booking.clientName}.`);
  };

  const getCategoryTextColor = (cat: EventChecklistItem['category']) => {
    switch (cat) {
      case 'Decoration':
        return 'text-[#236B50] bg-[#E8F5EE] border-[#C5E5D5]';
      case 'Kitchen Setup':
        return 'text-amber-800 bg-amber-50 border-amber-200';
      case 'AV':
        return 'text-blue-800 bg-blue-50 border-blue-200';
      case 'Staff':
        return 'text-purple-800 bg-purple-50 border-purple-200';
      default:
        return 'text-slate-700 bg-slate-100 border-slate-200';
    }
  };

  const readinessStatus = useMemo(() => {
    if (totalTasks === 0) {
      return {
        label: 'No Tasks Scheduled',
        barColor: 'bg-[#9CB3A8]',
        badgeClasses: 'bg-[#F4F8F6] text-[#5A6F66] border-[#DCE8E2]',
      };
    }
    if (completionPct === 100) {
      return {
        label: '100% Ready for Service',
        barColor: 'bg-[#16A34A]',
        badgeClasses: 'bg-[#E8F5EE] text-[#15803D] border-[#BBE5CB]',
      };
    }
    if (completionPct >= 50) {
      return {
        label: 'Setup In Progress',
        barColor: 'bg-[#236B50]',
        badgeClasses: 'bg-[#E8F5EE] text-[#236B50] border-[#C5E5D5]',
      };
    }
    if (completionPct > 0) {
      return {
        label: 'Preparation Started',
        barColor: 'bg-amber-500',
        badgeClasses: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    }
    return {
      label: 'Action Required',
      barColor: 'bg-rose-500',
      badgeClasses: 'bg-rose-50 text-rose-800 border-rose-200',
    };
  }, [totalTasks, completionPct]);

  return (
    <section className="bg-white border border-[#E2ECE7] rounded-3xl p-5 sm:p-6 space-y-5">
      {/* Top Operational Readiness Progress Bar (Scoped to Current Day & Selected Hall) */}
      <div className="bg-[#F6FAF8] border border-[#DCE9E2] rounded-2xl p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#236B50]">
              Operational Readiness · {hallFilter === 'All' ? 'All Halls' : hallFilter}
            </span>
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${readinessStatus.badgeClasses}`}
            >
              {readinessStatus.label}
            </span>
          </div>

          <div className="flex items-baseline space-x-2 tabular-nums">
            <span className="text-xs font-semibold text-[#5A6F66]">
              {completedTasks} of {totalTasks} tasks completed
            </span>
            <span className="text-base sm:text-lg font-extrabold text-[#192A24] font-mono">
              {completionPct}%
            </span>
          </div>
        </div>

        <div
          role="progressbar"
          aria-label={`Operational readiness for ${hallFilter === 'All' ? 'All Halls' : hallFilter}`}
          aria-valuenow={completionPct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="w-full h-3 rounded-full bg-[#DCE9E2] overflow-hidden"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out ${readinessStatus.barColor}`}
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E2ECE7]">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-[#236B50]">
            <ClipboardList className="w-4 h-4" />
            <span>Today&apos;s Events · Daily Operations Checklist · {todayDisplayStr}</span>
          </div>
          <h2 className="text-base sm:text-lg font-extrabold text-[#192A24]">
            {todaysEvents.length > 0
              ? `Today's Active Banquet Tasks (${todaysEvents.length} Event${todaysEvents.length > 1 ? 's' : ''}${hallFilter !== 'All' ? ` · ${hallFilter}` : ''})`
              : todaysEventsAll.length === 0 && previewUpcoming && nextUpcomingEvent
              ? `Previewing Next Scheduled Event (${nextUpcomingEvent.eventDate}${hallFilter !== 'All' ? ` · ${hallFilter}` : ''})`
              : "Today's Events & Floor Readiness Checklist"}
          </h2>
          <p className="text-xs text-[#5A6F66]">
            Auto-generated from today&apos;s scheduled events. Filter by hall or task category; checking off any item logs directly to the audit trail.
          </p>
        </div>

        {todaysEventsAll.length === 0 && nextUpcomingEvent && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setPreviewUpcoming((prev) => !prev)}
              className="px-3.5 py-2 rounded-xl border border-[#D5E5DE] bg-[#F6FAF8] hover:bg-[#EBF5F0] text-xs font-bold text-[#236B50] transition-colors cursor-pointer"
            >
              {previewUpcoming
                ? 'Back to Today View'
                : `Preview Next Event (${nextUpcomingEvent.eventDate})`}
            </button>
          </div>
        )}
      </div>

      {/* Hall Segmented Toggle Filter Bar (Always visible for F&B Supervisor) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-[#F4F8F6] border border-[#DCE8E2]">
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#5A6F66]">
            <Building2 className="w-3.5 h-3.5 text-[#236B50]" />
            <span>Hall:</span>
          </span>
          {CHECKLIST_HALL_FILTERS.map((hallOption) => {
            const isActive = hallFilter === hallOption;
            const count = hallEventCounts[hallOption];
            return (
              <button
                key={hallOption}
                type="button"
                onClick={() => setHallFilter(hallOption)}
                aria-pressed={isActive}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-[#236B50] text-white shadow-xs'
                    : 'text-[#3F594D] hover:bg-white hover:text-[#192A24]'
                }`}
              >
                <span>{hallOption}</span>
                {todaysEventsAll.length > 0 && (
                  <span
                    className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-[#E4EFE9] text-[#236B50]'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {lastAuditFeedback && (
          <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-[#236B50] bg-[#E8F5EE] border border-[#C5E5D5] px-3 py-1.5 rounded-xl">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{lastAuditFeedback}</span>
          </div>
        )}
      </div>

      {/* Category Filter Bar (shown when events exist) */}
      {activeEvents.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-[#236B50] text-white'
                  : 'bg-[#F6FAF8] text-[#486356] border border-[#E2ECE7] hover:bg-[#EBF3EF]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Empty State when no events match today / selected hall */}
      {activeEvents.length === 0 ? (
        <div className="py-8 px-4 rounded-2xl border border-dashed border-[#C5DBD0] bg-[#FAFDFB] text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#E8F5EE] text-[#236B50] flex items-center justify-center mx-auto">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <div className="text-sm font-extrabold text-[#192A24]">
              {hallFilter !== 'All'
                ? `No banquet events scheduled today for ${hallFilter}`
                : `No banquet events scheduled for today (${todayDisplayStr})`}
            </div>
            <p className="text-xs text-[#5A6F66]">
              {hallFilter !== 'All' && todaysEventsAll.length > 0
                ? `${todaysEventsAll.length} event${todaysEventsAll.length > 1 ? 's are' : ' is'} scheduled today in the other hall. Switch to All halls to view those checklist tasks.`
                : 'When an event is scheduled for today’s date, setup, menu finalization, AV, staffing, and pre-event collection tasks will populate here automatically.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {hallFilter !== 'All' && (
              <button
                type="button"
                onClick={() => setHallFilter('All')}
                className="px-4 py-2 rounded-xl bg-[#E8F5EE] hover:bg-[#D5EFE3] border border-[#C5E5D5] text-xs font-bold text-[#236B50] cursor-pointer"
              >
                Show All Halls
              </button>
            )}
            {todaysEventsAll.length === 0 && nextUpcomingEvent && (
              <button
                type="button"
                onClick={() => setPreviewUpcoming(true)}
                className="px-4 py-2 rounded-xl bg-white border border-[#D5E5DE] hover:bg-[#F4F8F6] text-xs font-bold text-[#236B50] cursor-pointer"
              >
                Load Next Event Checklist ({nextUpcomingEvent.clientName} · {nextUpcomingEvent.eventDate})
              </button>
            )}
            {onOpenBookingModal && (
              <button
                type="button"
                onClick={onOpenBookingModal}
                className="px-4 py-2 rounded-xl bg-[#236B50] hover:bg-[#1C5740] text-white text-xs font-bold cursor-pointer"
              >
                + Register Banquet Party
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {eventChecklists.map(({ booking, tasks }) => {
            const visibleTasks =
              categoryFilter === 'All'
                ? tasks
                : tasks.filter((t) => t.category === categoryFilter);
            const doneCount = tasks.filter((t) => t.isCompleted).length;

            return (
              <div
                key={booking.id}
                className="border border-[#E2ECE7] rounded-2xl overflow-hidden bg-[#FAFDFB]"
              >
                {/* Event Strip Header */}
                <div className="px-4 py-3 bg-[#F3F8F5] border-b border-[#E2ECE7] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-extrabold text-sm text-[#192A24]">
                      {booking.clientName}
                    </span>
                    <span className="text-xs font-mono text-[#5A6F66]">
                      {booking.bookingNumber}
                    </span>
                    <span className="inline-flex items-center space-x-1 text-xs font-semibold text-[#236B50]">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{booking.hallName} ({booking.branch})</span>
                    </span>
                    <span className="inline-flex items-center space-x-1 text-xs text-[#5A6F66] tabular-nums">
                      <Users className="w-3.5 h-3.5" />
                      <span>{booking.guestCount} guests</span>
                    </span>
                    {booking.eventTimeSpan && (
                      <span className="inline-flex items-center space-x-1 text-xs text-[#5A6F66]">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{booking.eventTimeSpan}</span>
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-extrabold font-mono tabular-nums text-[#236B50]">
                    {doneCount}/{tasks.length} Done
                  </span>
                </div>

                {/* Checklist Rows */}
                <div className="divide-y divide-[#E2ECE7] bg-white">
                  {visibleTasks.length === 0 ? (
                    <div className="px-4 py-4 text-xs text-[#5A6F66]">
                      No tasks in the &ldquo;{categoryFilter}&rdquo; category for this event.
                    </div>
                  ) : (
                    visibleTasks.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleToggle(booking, tasks, item)}
                        className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left hover:bg-[#F8FBF9] transition-colors cursor-pointer"
                      >
                        <div className="flex items-start space-x-3 min-w-0">
                          {item.isCompleted ? (
                            <CheckSquare className="w-4.5 h-4.5 text-[#236B50] shrink-0 mt-0.5" />
                          ) : (
                            <Square className="w-4.5 h-4.5 text-[#8BA399] shrink-0 mt-0.5" />
                          )}
                          <div className="space-y-0.5 min-w-0">
                            <div
                              className={`text-xs sm:text-sm font-semibold leading-snug ${
                                item.isCompleted
                                  ? 'line-through text-[#7B9188]'
                                  : 'text-[#192A24]'
                              }`}
                            >
                              {item.task}
                            </div>
                            {item.isCompleted && item.completedAt && (
                              <div className="text-[11px] font-mono text-[#5A6F66] tabular-nums">
                                Checked by {item.completedBy || currentUser.name} at{' '}
                                {new Date(item.completedAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${getCategoryTextColor(
                            item.category
                          )}`}
                        >
                          {item.category}
                        </span>
                      </button>
                    ))
                  )}
                </div>

                {/* Optional Add Custom Operational Task Row */}
                {onAddChecklistItem && (
                  <div className="px-4 py-2.5 bg-[#FAFDFB] border-t border-[#E2ECE7] flex items-center gap-2">
                    <input
                      type="text"
                      value={customTaskByBooking[booking.id] || ''}
                      onChange={(e) =>
                        setCustomTaskByBooking((prev) => ({
                          ...prev,
                          [booking.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomTask(booking, tasks);
                        }
                      }}
                      placeholder={`Add custom task for ${booking.clientName}...`}
                      className="flex-1 bg-white border border-[#D5E5DE] rounded-xl px-3 py-1.5 text-xs text-[#192A24] placeholder:text-[#7E948B] focus:outline-none focus:border-[#236B50]"
                    />
                    <button
                      type="button"
                      disabled={!(customTaskByBooking[booking.id] || '').trim()}
                      onClick={() => handleAddCustomTask(booking, tasks)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-[#236B50] hover:bg-[#1C5740] disabled:opacity-45 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
