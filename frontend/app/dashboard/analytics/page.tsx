"use client";

import dynamic from "next/dynamic";

const AnalyticsDashboard = dynamic(
  () => import("@/components/analytics-dashboard"),
  {
    loading: () => (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="skeleton h-7 w-44 rounded" />
          <div className="skeleton h-9 w-32 rounded-full" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-lg" />
          ))}
        </div>
        <div className="skeleton h-48 w-full rounded-lg" />
      </div>
    ),
  }
);

export default function AnalyticsPage() {
  return <AnalyticsDashboard />;
}
