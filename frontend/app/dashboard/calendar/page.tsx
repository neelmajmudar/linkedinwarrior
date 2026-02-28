"use client";

import dynamic from "next/dynamic";

const CalendarView = dynamic(() => import("@/components/calendar-view"), {
  loading: () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="skeleton h-7 w-40 rounded" />
        <div className="skeleton h-9 w-24 rounded-full" />
      </div>
      <div className="skeleton h-64 w-full rounded-lg" />
    </div>
  ),
});

export default function CalendarPage() {
  return <CalendarView />;
}
