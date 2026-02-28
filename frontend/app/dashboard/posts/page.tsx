"use client";

import dynamic from "next/dynamic";

const ContentList = dynamic(() => import("@/components/content-list"), {
  loading: () => (
    <div className="space-y-4">
      <div className="skeleton h-7 w-40 rounded" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton h-24 w-full rounded-lg" />
      ))}
    </div>
  ),
});

export default function PostsPage() {
  return <ContentList />;
}
