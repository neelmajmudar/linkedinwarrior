"use client";

import { useState, useEffect, useMemo } from "react";
import { apiGet } from "@/lib/api";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
} from "date-fns";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";

interface ContentItem {
  id: string;
  body: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
}

const STATUS_DOT: Record<string, string> = {
  draft: "bg-[#94a3b8]",
  scheduled: "bg-[#fbbf24]",
  published: "bg-[#34d399]",
  failed: "bg-[var(--destructive)]",
};

export default function CalendarView() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    try {
      const data = await apiGet<ContentItem[]>("/api/content");
      setItems(data);
    } catch {
      // ignore
    }
    setLoading(false);
  }

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const startDayOfWeek = getDay(startOfMonth(currentMonth));

  function getItemsForDay(day: Date): ContentItem[] {
    return items.filter((item) => {
      const dateStr = item.published_at || item.scheduled_at || item.created_at;
      if (!dateStr) return false;
      return isSameDay(new Date(dateStr), day);
    });
  }

  const selectedDayItems = selectedDay ? getItemsForDay(selectedDay) : [];

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold tracking-tight">
        Content <span className="gradient-text">Calendar</span>
      </h2>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="btn-ghost p-2 rounded-lg border border-[var(--border)]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-lg font-semibold tracking-tight">
          {format(currentMonth, "MMMM yyyy")}
        </h3>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="btn-ghost p-2 rounded-lg border border-[var(--border)]"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="glass-card overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 border-b border-[var(--border)]">
          {weekDays.map((d) => (
            <div
              key={d}
              className="px-2 py-2.5 text-center text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {/* Empty cells for offset */}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="min-h-[80px] border-t border-r border-[var(--border)] bg-[var(--background)]/50"
            />
          ))}

          {days.map((day) => {
            const dayItems = getItemsForDay(day);
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const isToday = isSameDay(day, new Date());

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                className={`min-h-[80px] border-t border-r border-[var(--border)] p-1.5 text-left transition-all ${
                  isSelected
                    ? "bg-[var(--primary)]/5 border-[var(--primary)]/20"
                    : "hover:bg-[var(--muted)]"
                }`}
              >
                <span
                  className={`text-xs font-medium inline-flex ${
                    isToday
                      ? "bg-[var(--primary)] text-white rounded-full w-6 h-6 items-center justify-center"
                      : "text-[var(--muted-foreground)]"
                  }`}
                >
                  {format(day, "d")}
                </span>
                {dayItems.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {dayItems.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex items-center gap-1">
                        <div
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[item.status] || "bg-[#94a3b8]"}`}
                        />
                        <span className="text-[10px] text-[var(--muted-foreground)] truncate">
                          {item.body.slice(0, 25)}...
                        </span>
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        +{dayItems.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="space-y-3 animate-fade-in">
          <h3 className="text-sm font-medium text-[var(--muted-foreground)]">
            {format(selectedDay, "EEEE, MMMM d, yyyy")}
          </h3>
          {selectedDayItems.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] opacity-60">
              No posts for this day.
            </p>
          ) : (
            selectedDayItems.map((item) => (
              <div
                key={item.id}
                className="glass-card p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-2 h-2 rounded-full ${STATUS_DOT[item.status] || "bg-[#94a3b8]"}`}
                  />
                  <span className="text-xs font-medium capitalize text-[var(--foreground)]">
                    {item.status}
                  </span>
                  {item.scheduled_at && item.status === "scheduled" && (
                    <span className="text-xs text-[var(--muted-foreground)]">
                      at {format(new Date(item.scheduled_at), "h:mm a")}
                    </span>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed text-[var(--card-foreground)]">
                  {item.body.length > 300
                    ? item.body.slice(0, 300) + "..."
                    : item.body}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-4">
          <FileText className="h-5 w-5 animate-pulse text-[var(--primary)]" />
        </div>
      )}
    </div>
  );
}
