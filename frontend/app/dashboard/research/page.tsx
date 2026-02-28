"use client";

import dynamic from "next/dynamic";

const CreatorAnalysis = dynamic(() => import("@/components/creator-analysis"), {
  loading: () => (
    <div className="space-y-6">
      <div>
        <div className="skeleton h-7 w-52 rounded mb-2" />
        <div className="skeleton h-4 w-80 rounded" />
      </div>
      <div className="skeleton h-12 w-full rounded-lg" />
      <div className="skeleton h-10 w-32 rounded-full" />
    </div>
  ),
});

export default function ResearchPage() {
  return <CreatorAnalysis />;
}
