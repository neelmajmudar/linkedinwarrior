"use client";

import dynamic from "next/dynamic";

const Engagement = dynamic(() => import("@/components/engagement"), {
  loading: () => (
    <div className="space-y-6">
      <div>
        <div className="skeleton h-7 w-48 rounded mb-2" />
        <div className="skeleton h-4 w-72 rounded" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="skeleton h-10 w-full rounded-lg" />
    </div>
  ),
});

export default function EngagePage() {
  return <Engagement />;
}
